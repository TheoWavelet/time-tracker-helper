import { and, desc, eq, isNotNull, isNull, sql } from 'drizzle-orm'
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
    .where(isNull(timers.archivedAt))
    .orderBy(desc(timers.startedAt))
    .all()
  return rows.map((row) => mapRow(row.timer, row.tagLabel, row.tagTargetUrl))
}

/** Timers deleted from history — soft-deleted, so they still exist here until the archive is cleared. */
export function listArchivedTimers(): TimerDTO[] {
  const rows = getDb()
    .select(timerWithTag)
    .from(timers)
    .leftJoin(tags, eq(tags.id, timers.tagId))
    .where(isNotNull(timers.archivedAt))
    .orderBy(desc(timers.archivedAt))
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

export interface InsertCustomTimerLogInput {
  id: string
  title: string
  tagId: string | null
  durationMs: number
  loggedAt: number
}

export function insertCustomTimerLog(input: InsertCustomTimerLogInput): void {
  getDb()
    .insert(timers)
    .values({
      id: input.id,
      title: input.title,
      kind: 'custom_log',
      status: 'stopped',
      tagId: input.tagId,
      startedAt: input.loggedAt - input.durationMs,
      currentSegmentStartedAt: null,
      accumulatedMs: input.durationMs,
      stoppedAt: input.loggedAt,
      createdAt: input.loggedAt,
      updatedAt: input.loggedAt
    })
    .run()
}

/**
 * `endAt` lets a caller (the idle monitor) finalize the segment as of when activity actually
 * stopped, rather than "now" — so an idle auto-pause doesn't bill the idle gap as tracked time.
 */
export function pauseTimerRow(
  id: string,
  reason: 'manual' | 'switched' | 'idle',
  switchedToTitle: string | null,
  endAt?: number
): void {
  const now = Date.now()
  const effectiveEnd = endAt ?? now
  getDb()
    .update(timers)
    .set({
      accumulatedMs: sql`${timers.accumulatedMs} + (${effectiveEnd} - ${timers.currentSegmentStartedAt})`,
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

export function stopTimerRow(id: string): void {
  const now = Date.now()
  const db = getDb()
  const row = db.select({ currentSegmentStartedAt: timers.currentSegmentStartedAt }).from(timers).where(eq(timers.id, id)).get()
  if (!row) return

  if (row.currentSegmentStartedAt != null) {
    db.update(timers)
      .set({
        accumulatedMs: sql`${timers.accumulatedMs} + (${now} - ${timers.currentSegmentStartedAt})`,
        currentSegmentStartedAt: null,
        status: 'stopped',
        stoppedAt: now,
        updatedAt: now
      })
      .where(eq(timers.id, id))
      .run()
  } else {
    db.update(timers).set({ status: 'stopped', stoppedAt: now, updatedAt: now }).where(eq(timers.id, id)).run()
  }
}

export function updateTimerTitle(id: string, title: string): void {
  getDb().update(timers).set({ title, updatedAt: Date.now() }).where(eq(timers.id, id)).run()
}

export function markTimerLinkOpened(id: string): void {
  const now = Date.now()
  getDb().update(timers).set({ linkOpenedAt: now, updatedAt: now }).where(eq(timers.id, id)).run()
}

export function toggleTimerLoggedConfirmed(id: string): void {
  const current = getDb().select({ loggedConfirmedAt: timers.loggedConfirmedAt }).from(timers).where(eq(timers.id, id)).get()
  if (!current) return
  const now = Date.now()
  getDb()
    .update(timers)
    .set({ loggedConfirmedAt: current.loggedConfirmedAt == null ? now : null, updatedAt: now })
    .where(eq(timers.id, id))
    .run()
}

/** Idempotent set (not toggle) — used by "check all" bulk actions, safe to click more than once. */
export function setTimersLoggedConfirmed(ids: string[], confirmed: boolean): void {
  if (ids.length === 0) return
  const now = Date.now()
  const db = getDb()
  for (const id of ids) {
    db.update(timers)
      .set({ loggedConfirmedAt: confirmed ? now : null, updatedAt: now })
      .where(eq(timers.id, id))
      .run()
  }
}

/** Soft delete — the row still exists (in the archive) until clearArchive() runs. */
export function archiveTimerRow(id: string): void {
  const now = Date.now()
  getDb().update(timers).set({ archivedAt: now, updatedAt: now }).where(eq(timers.id, id)).run()
}

/** Permanently removes every archived timer. Never touches daily_stats. */
export function clearArchive(): void {
  getDb().delete(timers).where(isNotNull(timers.archivedAt)).run()
}
