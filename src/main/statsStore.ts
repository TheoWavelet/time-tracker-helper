import * as statsRepo from './db/repositories/stats.repo'
import type { WeeklyStats } from '@shared/types'

const DAY_MS = 24 * 60 * 60 * 1000

function startOfDay(timestamp: number): number {
  const d = new Date(timestamp)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

/** Monday-start week boundary containing the given timestamp — matches groupHistory.ts's rule. */
function startOfWeek(timestamp: number): number {
  const d = new Date(timestamp)
  d.setHours(0, 0, 0, 0)
  const day = d.getDay() // 0 = Sunday .. 6 = Saturday
  const daysSinceMonday = day === 0 ? 6 : day - 1
  d.setDate(d.getDate() - daysSinceMonday)
  return d.getTime()
}

function localDateKey(timestamp: number): string {
  const d = new Date(timestamp)
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/** Called once a timer is finalized (stopped or custom-logged) — never re-derived from live
 *  timer rows afterward, so archiving/clearing history later can't change past totals. */
export function recordTrackedTime(finishedAt: number, ms: number): void {
  if (ms <= 0) return
  statsRepo.addTrackedMs(localDateKey(finishedAt), ms)
}

export function getWeeklyStats(now: number = Date.now()): WeeklyStats {
  const weekStart = startOfWeek(now)
  const todayStart = startOfDay(now)

  const dayStarts = Array.from({ length: 7 }, (_, i) => weekStart + i * DAY_MS)
  const dateKeys = dayStarts.map(localDateKey)
  const totals = statsRepo.getTrackedMsForDates(dateKeys)

  const days = dayStarts.map((dayStart, i) => ({
    label: new Date(dayStart).toLocaleDateString('en-US', { weekday: 'short' }),
    totalMs: totals.get(dateKeys[i]) ?? 0,
    isFuture: dayStart > todayStart
  }))

  const elapsedDays = Math.floor((todayStart - weekStart) / DAY_MS) + 1
  const totalMs = days.reduce((sum, d) => sum + d.totalMs, 0)
  const dailyAverageMs = totalMs / Math.max(1, elapsedDays)

  return { days, totalMs, dailyAverageMs }
}
