import { and, desc, eq, sql } from 'drizzle-orm'
import { getDb } from '../connection'
import { tags, timers } from '../schema'
import type { TimerDTO, TimerKind } from '@shared/types'

function mapRow(row: typeof timers.$inferSelect, tagLabel: string | null, tagTargetUrl: string | null): TimerDTO {
  return { ...row, tagLabel, tagTargetUrl }
}

const timerWithTag = { timer: timers, tagLabel: tags.label, tagTargetUrl: tags.targetUrl }

export function listTimers(): TimerDTO[] {
  // Ordered by startedAt (set once at creation, never touched by pause/resume/stop) rather than
  // updatedAt, so toggling a timer doesn't reshuffle its position in the list every time.
  const rows = getDb()
    .select(timerWithTag)
    .from(timers)
    .leftJoin(tags, eq(tags.id, timers.tagId))
    .orderBy(desc(timers.startedAt))
    .all()
  return rows.map((row) => mapRow(row.timer, row.tagLabel, row.tagTargetUrl))
}

export function findRunningTimer(): TimerDTO | null {
  const row = getDb()
    .select(timerWithTag)
    .from(timers)
    .leftJoin(tags, eq(tags.id, timers.tagId))
    .where(eq(timers.status, 'running'))
    .get()
  return row ? mapRow(row.timer, row.tagLabel, row.tagTargetUrl) : null
}

export function findTimerById(id: string): TimerDTO | null {
  const row = getDb()
    .select(timerWithTag)
    .from(timers)
    .leftJoin(tags, eq(tags.id, timers.tagId))
    .where(eq(timers.id, id))
    .get()
  return row ? mapRow(row.timer, row.tagLabel, row.tagTargetUrl) : null
}

export interface InsertTimerInput {
  id: string
  title: string
  kind: TimerKind
  tagId: string | null
  startedAt: number
}

export function insertTimer(input: InsertTimerInput): void {
  const now = Date.now()
  getDb()
    .insert(timers)
    .values({
      id: input.id,
      title: input.title,
      kind: input.kind,
      status: 'running',
      tagId: input.tagId,
      startedAt: input.startedAt,
      currentSegmentStartedAt: input.startedAt,
      accumulatedMs: 0,
      createdAt: now,
      updatedAt: now
    })
    .run()
}

export function pauseTimerRow(id: string, reason: 'manual' | 'switched', switchedToTitle: string | null): void {
  const now = Date.now()
  getDb()
    .update(timers)
    .set({
      accumulatedMs: sql`${timers.accumulatedMs} + (${now} - ${timers.currentSegmentStartedAt})`,
      currentSegmentStartedAt: null,
      status: 'paused',
      pausedReason: reason,
      switchedToTitle,
      updatedAt: now
    })
    .where(and(eq(timers.id, id), eq(timers.status, 'running')))
    .run()
}

export function resumeTimerRow(id: string): void {
  const now = Date.now()
  getDb()
    .update(timers)
    .set({ status: 'running', currentSegmentStartedAt: now, pausedReason: null, switchedToTitle: null, updatedAt: now })
    .where(eq(timers.id, id))
    .run()
}

/**
 * `endAt` lets a caller (the idle monitor) finalize the timer as of when activity actually
 * stopped, rather than "now" — so an auto-stop doesn't bill the idle gap itself as tracked time.
 */
export function stopTimerRow(id: string, endAt?: number): void {
  const now = Date.now()
  const effectiveEnd = endAt ?? now
  const db = getDb()
  const row = db.select({ currentSegmentStartedAt: timers.currentSegmentStartedAt }).from(timers).where(eq(timers.id, id)).get()
  if (!row) return

  if (row.currentSegmentStartedAt != null) {
    db.update(timers)
      .set({
        accumulatedMs: sql`${timers.accumulatedMs} + (${effectiveEnd} - ${timers.currentSegmentStartedAt})`,
        currentSegmentStartedAt: null,
        status: 'stopped',
        stoppedAt: effectiveEnd,
        updatedAt: now
      })
      .where(eq(timers.id, id))
      .run()
  } else {
    db.update(timers).set({ status: 'stopped', stoppedAt: effectiveEnd, updatedAt: now }).where(eq(timers.id, id)).run()
  }
}

export function updateTimerTitle(id: string, title: string): void {
  getDb().update(timers).set({ title, updatedAt: Date.now() }).where(eq(timers.id, id)).run()
}

export function deleteTimerRow(id: string): void {
  getDb().delete(timers).where(eq(timers.id, id)).run()
}
