import type { TimerDTO } from '@shared/types'

export interface HistoryGroups {
  today: TimerDTO[]
  thisWeek: TimerDTO[]
  older: TimerDTO[]
}

function startOfDay(timestamp: number): number {
  const d = new Date(timestamp)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

/** Monday-start week boundary containing the given timestamp. */
function startOfWeek(timestamp: number): number {
  const d = new Date(timestamp)
  d.setHours(0, 0, 0, 0)
  const day = d.getDay() // 0 = Sunday .. 6 = Saturday
  const daysSinceMonday = day === 0 ? 6 : day - 1
  d.setDate(d.getDate() - daysSinceMonday)
  return d.getTime()
}

function historyTimestamp(timer: TimerDTO): number {
  return timer.stoppedAt ?? timer.updatedAt
}

/** Buckets saved (stopped) timers into Today, this (Monday-start) week, and older — nothing is dropped. */
export function groupHistory(timers: TimerDTO[], now: number): HistoryGroups {
  const todayStart = startOfDay(now)
  const weekStart = startOfWeek(now)

  const groups: HistoryGroups = { today: [], thisWeek: [], older: [] }
  for (const timer of timers) {
    const ts = historyTimestamp(timer)
    if (ts >= todayStart) groups.today.push(timer)
    else if (ts >= weekStart) groups.thisWeek.push(timer)
    else groups.older.push(timer)
  }
  return groups
}
