import { Notification, powerMonitor } from 'electron'
import * as timerStore from './timerStore'

const POLL_INTERVAL_MS = 15_000
const IDLE_STOP_THRESHOLD_SECONDS = 10 * 60

let pollTimer: NodeJS.Timeout | null = null

/**
 * Uses Electron's OS-level idle time (keyboard/mouse input, not app focus) rather than anything
 * the renderer reports, so it keeps working even while the overlay/dashboard aren't focused.
 */
function checkIdle(): void {
  const running = timerStore.getSnapshot().timers.find((t) => t.status === 'running')
  if (!running) return

  const idleSeconds = powerMonitor.getSystemIdleTime()
  if (idleSeconds < IDLE_STOP_THRESHOLD_SECONDS) return

  // Finalize as of when activity actually stopped, not "now" — otherwise the idle gap itself
  // would get billed as tracked time.
  const stoppedAt = Date.now() - idleSeconds * 1000
  timerStore.stopTimer(running.id, stoppedAt)

  new Notification({
    title: 'Timer auto-stopped',
    body: `"${running.title}" was stopped after ${Math.round(IDLE_STOP_THRESHOLD_SECONDS / 60)} minutes of inactivity.`
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
