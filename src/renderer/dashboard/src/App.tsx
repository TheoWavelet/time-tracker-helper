import { useEffect, useState } from 'react'
import type { AppSettings, DockSide, TimersSnapshot } from '@shared/types'
import { StartTimerForm, type StartTimerFormValue } from '../../shared/StartTimerForm'
import { TimerRow } from '../../shared/TimerRow'
import { HistoryTimerRow } from '../../shared/HistoryTimerRow'
import { useToasts, ToastStack } from '../../shared/Toast'
import { groupHistory } from './groupHistory'

function handleDeleteTimer(id: string): void {
  window.api.timers.delete(id)
}

export function App(): JSX.Element {
  const [snapshot, setSnapshot] = useState<TimersSnapshot | null>(null)
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const { toasts, pushToast } = useToasts()

  useEffect(() => {
    window.api.timers.getSnapshot().then(setSnapshot)
    window.api.settings.get().then(setSettings)
    return window.api.timers.onChanged(setSnapshot)
  }, [])

  async function handleDockSideChange(dockSide: DockSide): Promise<void> {
    const updated = await window.api.settings.setDockSide(dockSide)
    setSettings(updated)
  }

  if (!snapshot) {
    return <div className="app-loading">Loading…</div>
  }

  function handlePause(id: string): void {
    const timer = snapshot!.timers.find((t) => t.id === id)
    window.api.timers.pause(id)
    pushToast(`Paused “${timer?.title ?? 'timer'}”`)
  }

  async function handleStart(value: StartTimerFormValue): Promise<void> {
    const created = await window.api.timers.start(value)
    pushToast(`Started “${created.title}”`)
  }

  const timerActions = {
    onPause: handlePause,
    onResume: (id: string) => window.api.timers.resume(id),
    onStop: (id: string) => window.api.timers.stop(id)
  }

  const activeTimers = snapshot.timers.filter((t) => t.status === 'running' || t.status === 'paused')
  const historyTimers = snapshot.timers.filter((t) => t.status === 'stopped')
  const history = groupHistory(historyTimers, Date.now())

  return (
    <div className="app">
      <ToastStack toasts={toasts} />
      <header className="app__header">
        <h1>Time Tracker</h1>
        <div className="dock-toggle">
          <span>Overlay position:</span>
          <button
            className={settings?.dockSide === 'left' ? 'is-selected' : ''}
            onClick={() => handleDockSideChange('left')}
          >
            Left
          </button>
          <button
            className={settings?.dockSide === 'right' ? 'is-selected' : ''}
            onClick={() => handleDockSideChange('right')}
          >
            Right
          </button>
        </div>
      </header>

      <section className="app__section">
        <h2>Start a timer</h2>
        <StartTimerForm onStart={handleStart} />
      </section>

      <section className="app__section">
        <h2>Active ({activeTimers.length})</h2>
        {activeTimers.length === 0 && <p className="app__empty">Nothing running right now.</p>}
        {activeTimers.map((timer) => (
          <TimerRow key={timer.id} timer={timer} {...timerActions} />
        ))}
      </section>

      <section className="app__section">
        <h2>Today ({history.today.length})</h2>
        {history.today.length === 0 && <p className="app__empty">Nothing saved today yet.</p>}
        {history.today.map((timer) => (
          <HistoryTimerRow key={timer.id} timer={timer} onDelete={handleDeleteTimer} />
        ))}
      </section>

      <section className="app__section">
        <h2>This week ({history.thisWeek.length})</h2>
        {history.thisWeek.length === 0 && <p className="app__empty">Nothing earlier this week.</p>}
        {history.thisWeek.map((timer) => (
          <HistoryTimerRow key={timer.id} timer={timer} onDelete={handleDeleteTimer} />
        ))}
      </section>

      <section className="app__section">
        <h2>Older ({history.older.length})</h2>
        {history.older.length === 0 && <p className="app__empty">Nothing older.</p>}
        {history.older.map((timer) => (
          <HistoryTimerRow key={timer.id} timer={timer} onDelete={handleDeleteTimer} />
        ))}
      </section>
    </div>
  )
}
