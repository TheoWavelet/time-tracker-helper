import { randomUUID } from 'node:crypto'
import { getRawSqlite } from './db/connection'
import * as timersRepo from './db/repositories/timers.repo'
import * as tagsRepo from './db/repositories/tags.repo'
import { formatDefaultTimerTitle } from '@shared/format'
import type { StartTimerInput, TimerDTO, TimersSnapshot } from '@shared/types'

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

  const newId = sqlite.transaction(() => {
    const running = timersRepo.findRunningTimer()
    if (running) {
      timersRepo.pauseTimerRow(running.id, 'switched', title)
    }

    const tagId = input.tagLabel?.trim() ? tagsRepo.findOrCreateTagByLabel(input.tagLabel).id : null
    const id = randomUUID()
    timersRepo.insertTimer({ id, title, kind: input.kind ?? 'persistent', tagId, startedAt: now })
    return id
  })()

  emitChange()
  const created = timersRepo.findTimerById(newId)
  if (!created) throw new Error('Timer disappeared immediately after creation')
  return created
}

export function pauseTimer(id: string): void {
  timersRepo.pauseTimerRow(id, 'manual', null)
  emitChange()
}

export function resumeTimer(id: string): void {
  const sqlite = getRawSqlite()
  sqlite.transaction(() => {
    const running = timersRepo.findRunningTimer()
    const target = timersRepo.findTimerById(id)
    if (running && running.id !== id) {
      timersRepo.pauseTimerRow(running.id, 'switched', target?.title ?? null)
    }
    timersRepo.resumeTimerRow(id)
  })()
  emitChange()
}

export function stopTimer(id: string, endAt?: number): void {
  timersRepo.stopTimerRow(id, endAt)
  emitChange()
}

export function deleteTimer(id: string): void {
  timersRepo.deleteTimerRow(id)
  emitChange()
}

export function updateTimerTitle(id: string, title: string): void {
  timersRepo.updateTimerTitle(id, title)
  emitChange()
}

export function listTags() {
  return tagsRepo.listTags()
}

export function listTagsForPicker() {
  return tagsRepo.listTagsForPicker()
}
