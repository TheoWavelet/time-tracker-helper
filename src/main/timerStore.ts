import { randomUUID } from 'node:crypto'
import { getRawSqlite } from './db/connection'
import * as timersRepo from './db/repositories/timers.repo'
import * as tagsRepo from './db/repositories/tags.repo'
import * as statsStore from './statsStore'
import * as clockworkSync from './clockworkSync'
import { formatDefaultTimerTitle } from '@shared/format'
import type { CustomTimerLogInput, StartTimerInput, TimerDTO, TimersSnapshot } from '@shared/types'

type Listener = (snapshot: TimersSnapshot) => void

const listeners = new Set<Listener>()

export function onTimersChanged(listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function emitChange(): void {
  const snapshot = getSnapshot()
  for (const listener of listeners) listener(snapshot)
}

export function getSnapshot(): TimersSnapshot {
  const timers = timersRepo.listTimers()
  const running = timers.find((t) => t.status === 'running')
  return { timers, runningTimerId: running ? running.id : null }
}

export function startTimer(input: StartTimerInput): TimerDTO {
  const sqlite = getRawSqlite()
  const now = Date.now()
  const title = input.title?.trim() || formatDefaultTimerTitle(now)

  let previousRunning: { id: string; tagId: string | null } | undefined
  const newId = sqlite.transaction(() => {
    const running = timersRepo.findRunningTimer()
    if (running) {
      timersRepo.pauseTimerRow(running.id, 'switched', title)
      previousRunning = { id: running.id, tagId: running.tagId }
    }

    const tagId = input.tagLabel?.trim() ? tagsRepo.findOrCreateTagByLabel(input.tagLabel).id : null
    const id = randomUUID()
    timersRepo.insertTimer({ id, title, kind: input.kind ?? 'persistent', tagId, startedAt: now })
    return id
  })()

  emitChange()
  const created = timersRepo.findTimerById(newId)
  if (!created) throw new Error('Timer disappeared immediately after creation')

  if (previousRunning) void clockworkSync.notifyTimerSegmentEnded(previousRunning.id, previousRunning.tagId)
  void clockworkSync.notifyTimerRunning(created.id, created.tagId)

  return created
}

export function createCustomTimerLog(input: CustomTimerLogInput): TimerDTO {
  if (!Number.isInteger(input.durationMinutes) || input.durationMinutes < 1 || input.durationMinutes > 24 * 60) {
    throw new Error('Custom log duration must be a whole number between 1 and 1,440 minutes')
  }

  const sqlite = getRawSqlite()
  const loggedAt = Date.now()
  const title = input.title?.trim() || formatDefaultTimerTitle(loggedAt)
  const id = sqlite.transaction(() => {
    const tagId = input.tagLabel?.trim() ? tagsRepo.findOrCreateTagByLabel(input.tagLabel).id : null
    const customLogId = randomUUID()
    timersRepo.insertCustomTimerLog({
      id: customLogId,
      title,
      tagId,
      durationMs: input.durationMinutes * 60_000,
      loggedAt
    })
    return customLogId
  })()

  emitChange()
  const created = timersRepo.findTimerById(id)
  if (!created) throw new Error('Custom log disappeared immediately after creation')
  return created
}

export function pauseTimer(id: string): void {
  const timer = timersRepo.findTimerById(id)
  timersRepo.pauseTimerRow(id, 'manual', null)
  emitChange()
  void clockworkSync.notifyTimerSegmentEnded(id, timer?.tagId ?? null)
}

/** Auto-pause from idle detection, backdated to when activity actually stopped (see idleMonitor.ts). */
export function pauseTimerForIdle(id: string, endAt: number): void {
  const timer = timersRepo.findTimerById(id)
  timersRepo.pauseTimerRow(id, 'idle', null, endAt)
  emitChange()
  void clockworkSync.notifyTimerSegmentEnded(id, timer?.tagId ?? null)
}

export function resumeTimer(id: string): void {
  const sqlite = getRawSqlite()
  let previousRunning: { id: string; tagId: string | null } | undefined
  const target = sqlite.transaction(() => {
    const running = timersRepo.findRunningTimer()
    const target = timersRepo.findTimerById(id)
    if (running && running.id !== id) {
      timersRepo.pauseTimerRow(running.id, 'switched', target?.title ?? null)
      previousRunning = { id: running.id, tagId: running.tagId }
    }
    timersRepo.resumeTimerRow(id)
    return target
  })()
  emitChange()

  if (previousRunning) void clockworkSync.notifyTimerSegmentEnded(previousRunning.id, previousRunning.tagId)
  void clockworkSync.notifyTimerRunning(id, target?.tagId ?? null)
}

export function stopTimer(id: string): void {
  timersRepo.stopTimerRow(id)
  const stopped = timersRepo.findTimerById(id)
  if (stopped && stopped.stoppedAt != null) {
    statsStore.recordTrackedTime(stopped.stoppedAt, stopped.accumulatedMs)
  }
  emitChange()

  if (stopped) {
    void clockworkSync.notifyTimerSaved(id, stopped.tagId).then((logged) => {
      if (logged) {
        timersRepo.markClockworkLogged(id)
        emitChange()
      }
    })
  }
}

/** Soft delete — moves the timer to the archive (see the "Archive & stats" window) rather than
 *  destroying it. Its already-recorded stats contribution, if any, is untouched either way. */
export function deleteTimer(id: string): void {
  timersRepo.archiveTimerRow(id)
  emitChange()
}

export function listArchivedTimers(): TimerDTO[] {
  return timersRepo.listArchivedTimers()
}

export function clearArchive(): void {
  timersRepo.clearArchive()
}

export function updateTimerTitle(id: string, title: string): void {
  timersRepo.updateTimerTitle(id, title)
  emitChange()
}

export function markTimerLinkOpened(id: string): void {
  timersRepo.markTimerLinkOpened(id)
  emitChange()
}

export function toggleTimerLoggedConfirmed(id: string): void {
  timersRepo.toggleTimerLoggedConfirmed(id)
  emitChange()
}

export function setTimersLoggedConfirmed(ids: string[], confirmed: boolean): void {
  timersRepo.setTimersLoggedConfirmed(ids, confirmed)
  emitChange()
}

export function listTags() {
  return tagsRepo.listTags()
}

export function listTagsForPicker() {
  return tagsRepo.listTagsForPicker()
}

export function findOrCreateTagByLabelAndUrl(label: string, url: string) {
  return tagsRepo.findOrCreateTagByLabelAndUrl(label, url)
}

export function toggleTagFavorite(id: string) {
  return tagsRepo.toggleTagFavorite(id)
}
