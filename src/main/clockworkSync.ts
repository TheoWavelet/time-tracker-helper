import { app, powerMonitor } from 'electron'
import * as tagsRepo from './db/repositories/tags.repo'
import * as timersRepo from './db/repositories/timers.repo'
import { startClockworkTimer, stopClockworkTimer } from './clockworkClient'
import { getSettings } from './settingsStore'
import { hasClockworkApiToken } from './clockworkTokenStore'

// issueKey -> timerId currently mirrored as "running" on Clockwork's side. Used both to avoid
// redundant calls and as the safety-net list to flush on quit/sleep/lock.
const activeMirrors = new Map<string, string>()

// timerId -> true once a start/stop call for it has failed. A timer with no *live* mirror at save
// time is normally "already fully logged" (its segments were closed out as they ended) — but not
// if getting there involved a failure, which this catches so a broken sync doesn't still show the
// "logged automatically" checkmark.
const unreliableTimerIds = new Set<string>()

// timerId -> true once notifyTimerRunning has actually attempted to mirror it to Clockwork at least
// once. A custom log is inserted directly as "paused" and never runs through notifyTimerRunning, so
// without this a save would see "no active mirror" and wrongly read that as "already fully synced"
// rather than "never synced at all" — this set is what tells the two apart.
const engagedTimerIds = new Set<string>()

function isSyncActive(): boolean {
  return getSettings().clockworkSyncEnabled && hasClockworkApiToken()
}

function resolveIssueKey(tagId: string | null): string | null {
  if (!tagId) return null
  return tagsRepo.findTagById(tagId)?.clockworkIssueKey ?? null
}

/** Call when a timer starts running (fresh start or resume) — mirrors it to Clockwork if its tag
 *  resolves to an issue key and sync is enabled. Best-effort: never throws. */
export async function notifyTimerRunning(timerId: string, tagId: string | null): Promise<void> {
  if (!isSyncActive()) return
  const issueKey = resolveIssueKey(tagId)
  if (!issueKey) return
  engagedTimerIds.add(timerId)
  const ok = await startClockworkTimer(issueKey)
  if (ok) activeMirrors.set(issueKey, timerId)
  else unreliableTimerIds.add(timerId)
}

/** Call whenever a running segment ends WITHOUT it being the timer's final save — manual pause,
 *  idle auto-pause, or getting auto-paused because another timer started. */
export async function notifyTimerSegmentEnded(timerId: string, tagId: string | null): Promise<void> {
  const issueKey = resolveIssueKey(tagId)
  if (!issueKey || activeMirrors.get(issueKey) !== timerId) return
  activeMirrors.delete(issueKey)
  const ok = await stopClockworkTimer(issueKey)
  if (!ok) unreliableTimerIds.add(timerId)
}

/** Call on final Stop/Save. Returns whether Clockwork's record for this timer is fully up to date,
 *  so the caller can mark it "logged automatically." If the timer was already paused (its last
 *  segment closed out via notifyTimerSegmentEnded), there's nothing live left to stop — that's a
 *  success, not a failure, and calling stop_timer again would just fail since nothing is running. */
export async function notifyTimerSaved(timerId: string, tagId: string | null): Promise<boolean> {
  if (!isSyncActive()) return false
  const issueKey = resolveIssueKey(tagId)
  if (!issueKey) return false

  if (activeMirrors.get(issueKey) === timerId) {
    activeMirrors.delete(issueKey)
    const ok = await stopClockworkTimer(issueKey)
    if (!ok) unreliableTimerIds.add(timerId)
  }

  const reliable = engagedTimerIds.has(timerId) && !unreliableTimerIds.has(timerId)
  unreliableTimerIds.delete(timerId)
  engagedTimerIds.delete(timerId)
  return reliable
}

async function stopAllActiveMirrors(): Promise<void> {
  const issueKeys = Array.from(activeMirrors.keys())
  activeMirrors.clear()
  await Promise.all(issueKeys.map((key) => stopClockworkTimer(key)))
}

/** Resumes mirroring for whatever timer was left "running" locally across an app restart. The
 *  local timer never stops ticking across a restart by design (it's wall-clock based) — so once
 *  sync is available again, Clockwork's side should resume tracking it too rather than staying
 *  stopped from the last quit/sleep safety-net flush. */
async function reconcileOnStartup(): Promise<void> {
  if (!isSyncActive()) return
  const running = timersRepo.listTimers().find((t) => t.status === 'running')
  if (!running) return
  await notifyTimerRunning(running.id, running.tagId)
}

export function startClockworkSync(): void {
  void reconcileOnStartup()

  // Safety nets: a Clockwork-side timer must never be left running past the point the app quits
  // or the machine sleeps/locks — that's exactly the "accidentally left running" risk this
  // real-time-mirroring design has to guard against.
  let quitting = false
  app.on('before-quit', (event) => {
    if (quitting || activeMirrors.size === 0) return
    event.preventDefault()
    quitting = true
    void stopAllActiveMirrors().finally(() => app.quit())
  })

  powerMonitor.on('suspend', () => void stopAllActiveMirrors())
  powerMonitor.on('lock-screen', () => void stopAllActiveMirrors())
}
