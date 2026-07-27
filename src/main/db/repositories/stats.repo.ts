import { inArray } from 'drizzle-orm'
import { getDb, getRawSqlite } from '../connection'
import { dailyStats } from '../schema'

/** Adds ms to a day's running total — never overwrites, so multiple timers finishing on the same
 *  day accumulate correctly. */
export function addTrackedMs(dateKey: string, ms: number): void {
  const now = Date.now()
  getRawSqlite()
    .prepare(
      `INSERT INTO daily_stats (date, total_ms, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(date) DO UPDATE SET total_ms = total_ms + excluded.total_ms, updated_at = excluded.updated_at`
    )
    .run(dateKey, ms, now)
}

export function getTrackedMsForDates(dateKeys: string[]): Map<string, number> {
  if (dateKeys.length === 0) return new Map()
  const rows = getDb().select().from(dailyStats).where(inArray(dailyStats.date, dateKeys)).all()
  return new Map(rows.map((row) => [row.date, row.totalMs]))
}
