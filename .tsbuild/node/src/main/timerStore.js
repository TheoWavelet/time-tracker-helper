import { randomUUID } from 'node:crypto';
import { getDb } from './db/connection';
import * as timersRepo from './db/repositories/timers.repo';
import * as tagsRepo from './db/repositories/tags.repo';
import { formatDefaultTimerTitle } from '@shared/format';
const listeners = new Set();
export function onTimersChanged(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
}
function emitChange() {
    const snapshot = getSnapshot();
    for (const listener of listeners)
        listener(snapshot);
}
export function getSnapshot() {
    const timers = timersRepo.listTimers();
    const running = timers.find((t) => t.status === 'running');
    return { timers, runningTimerId: running ? running.id : null };
}
export function startTimer(input) {
    const db = getDb();
    const now = Date.now();
    const title = input.title?.trim() || formatDefaultTimerTitle(now);
    const newId = db.transaction(() => {
        const running = timersRepo.findRunningTimer();
        if (running) {
            timersRepo.pauseTimerRow(running.id, 'switched', title);
        }
        const tagId = input.tagLabel?.trim() ? tagsRepo.findOrCreateTagByLabel(input.tagLabel).id : null;
        const id = randomUUID();
        timersRepo.insertTimer({ id, title, kind: input.kind, tagId, startedAt: now });
        return id;
    })();
    emitChange();
    const created = timersRepo.findTimerById(newId);
    if (!created)
        throw new Error('Timer disappeared immediately after creation');
    return created;
}
export function pauseTimer(id) {
    timersRepo.pauseTimerRow(id, 'manual', null);
    emitChange();
}
export function resumeTimer(id) {
    const db = getDb();
    db.transaction(() => {
        const running = timersRepo.findRunningTimer();
        const target = timersRepo.findTimerById(id);
        if (running && running.id !== id) {
            timersRepo.pauseTimerRow(running.id, 'switched', target?.title ?? null);
        }
        timersRepo.resumeTimerRow(id);
    })();
    emitChange();
}
export function stopTimer(id) {
    timersRepo.stopTimerRow(id);
    emitChange();
}
export function submitTimer(id, tagLabel) {
    const db = getDb();
    const updated = db.transaction(() => {
        const tag = tagsRepo.findOrCreateTagByLabel(tagLabel);
        timersRepo.submitTimerRow(id, tag.id);
        return timersRepo.findTimerById(id);
    })();
    emitChange();
    if (!updated)
        throw new Error(`Timer ${id} not found after submit`);
    return updated;
}
export function discardTimer(id) {
    timersRepo.discardTimerRow(id);
    emitChange();
}
export function updateTimerTitle(id, title) {
    timersRepo.updateTimerTitle(id, title);
    emitChange();
}
export function listTags() {
    return tagsRepo.listTags();
}
