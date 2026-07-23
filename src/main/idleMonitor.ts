import { Notification, powerMonitor } from 'electron'
import * as timerStore from './timerStore'

const POLL_INTERVAL_MS = 15_000
const IDLE_PAUSE_THRESHOLD_SECONDS = 10 * 60
// const IDLE_PAUSE_THRESHOLD_SECONDS = 15

let pollTimer: NodeJS.Timeout | null = null

/**
 * Uses Electron's OS-level idle time (keyboard/mouse input, not app focus) rather than anything
 * the renderer reports, so it keeps working even while the overlay/dashboard aren't focused.
 */
function checkIdle(): void {
  const running = timerStore.getSnapshot().timers.find((t) => t.status === 'running')
  if (!running) return

  const idleSeconds = powerMonitor.getSystemIdleTime()
  if (idleSeconds < IDLE_PAUSE_THRESHOLD_SECONDS) return

  // Finalize the segment as of when activity actually stopped, not "now" — otherwise the idle
  // gap itself would get billed as tracked time.
  const pausedAt = Date.now() - idleSeconds * 1000
  timerStore.pauseTimerForIdle(running.id, pausedAt)

  new Notification({
    title: 'Timer paused',
    body: `"${running.title}" was paused after ${Math.round(IDLE_PAUSE_THRESHOLD_SECONDS / 60)} minutes of inactivity.`
  }).show()
}

export function startIdleMonitor(): void {
  if (pollTimer) return
  pollTimer = setInterval(checkIdle, POLL_INTERVAL_MS)
}

export function stopIdleMonitor(): void {
  if (pollTimer) clearInterval(pollTimer)
  pollTimer = null
}
