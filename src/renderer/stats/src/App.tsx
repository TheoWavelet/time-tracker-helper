import { useEffect, useState } from 'react'
import type { TimerDTO, WeeklyStats } from '@shared/types'
import { formatDurationHuman } from '@shared/format'
import { HistoryTimerRow } from '../../components/TimerRows'
import { TrashIcon } from '../../components/ui'

export function App(): JSX.Element {
  const [weeklyStats, setWeeklyStats] = useState<WeeklyStats | null>(null)
  const [archived, setArchived] = useState<TimerDTO[] | null>(null)

  function refetch(): void {
    window.api.stats.getWeekly().then(setWeeklyStats)
    window.api.archive.list().then(setArchived)
  }

  useEffect(() => {
    refetch()
    return window.api.timers.onChanged(refetch)
  }, [])

  async function handleClearArchive(): Promise<void> {
    await window.api.archive.clear()
    setArchived([])
  }

  if (!weeklyStats || !archived) {
    return <div className="app-loading">Loading…</div>
  }

  const maxDayMs = Math.max(1, ...weeklyStats.days.map((d) => d.totalMs))

  return (
    <div className="app">
      <header className="app__header">
        <h1>Archive &amp; Stats</h1>
      </header>

      <section className="app__section">
        <h2>This week</h2>
        <div className="week-chart">
          {weeklyStats.days.map((day) => (
            <div key={day.label} className={`week-chart__col${day.isFuture ? ' is-future' : ''}`}>
              <span className="week-chart__value">{day.totalMs > 0 ? formatDurationHuman(day.totalMs) : '—'}</span>
              <div className="week-chart__bar-track">
                <div className="week-chart__bar" style={{ height: `${(day.totalMs / maxDayMs) * 100}%` }} />
              </div>
              <span className="week-chart__label">{day.label}</span>
            </div>
          ))}
        </div>
        <div className="week-summary">
          <span>Daily average</span>
          <strong>{formatDurationHuman(weeklyStats.dailyAverageMs)}</strong>
        </div>
      </section>

      <div className="archive-toolbar">
        <h2>Deleted items</h2>
        <button
          type="button"
          className="icon-button icon-button--danger"
          onClick={handleClearArchive}
          disabled={archived.length === 0}
          aria-label="Clear archive"
          title="Permanently delete every item below"
        >
          <TrashIcon />
          <span>Clear archive ({archived.length})</span>
        </button>
      </div>

      <section className="app__section">
        {archived.length === 0 && <p className="app__empty">Nothing deleted yet.</p>}
        {archived.map((timer) => (
          <HistoryTimerRow key={timer.id} timer={timer} />
        ))}
      </section>
    </div>
  )
}
