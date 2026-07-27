import { getClockworkApiToken } from './clockworkTokenStore'

const CLOCKWORK_API_BASE = 'https://api.clockwork.report/v1'
const REQUEST_TIMEOUT_MS = 8000

/**
 * Clockwork's API has no endpoint to log a specific past duration directly — only a live
 * start_timer/stop_timer pair, whose duration is however long elapses between the two calls on
 * Clockwork's own server. Getting an accurate duration into Clockwork therefore requires mirroring
 * the local timer's running/paused segments in real time (see clockworkSync.ts), not a single
 * call at save time.
 */
async function callClockwork(path: '/start_timer' | '/stop_timer', issueKey: string): Promise<boolean> {
  const token = getClockworkApiToken()
  if (!token) return false

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    const response = await fetch(`${CLOCKWORK_API_BASE}${path}?issue_key=${encodeURIComponent(issueKey)}`, {
      method: 'POST',
      headers: { Authorization: `Token ${token}` },
      signal: controller.signal
    })
    if (!response.ok) {
      console.error(`Clockwork API ${path} failed for ${issueKey}: HTTP ${response.status}`)
    }
    return response.ok
  } catch (error) {
    console.error(`Clockwork API ${path} failed for ${issueKey}`, error)
    return false
  } finally {
    clearTimeout(timeout)
  }
}

export function startClockworkTimer(issueKey: string): Promise<boolean> {
  return callClockwork('/start_timer', issueKey)
}

export function stopClockworkTimer(issueKey: string): Promise<boolean> {
  return callClockwork('/stop_timer', issueKey)
}
