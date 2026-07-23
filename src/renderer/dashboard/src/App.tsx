import { useEffect, useState } from 'react'
import type { AppSettings, BrowserPairingInfo, DockSide, TimersSnapshot } from '@shared/types'
import { StartTimerForm, type StartTimerFormValue } from '../../shared/StartTimerForm'
import { TimerRow } from '../../shared/TimerRow'
import { HistoryTimerRow } from '../../shared/HistoryTimerRow'
import { useToasts, ToastStack } from '../../shared/Toast'
import { groupHistory } from './groupHistory'

function handleDeleteTimer(id: string): void {
  window.api.timers.delete(id)
}

const PAIRING_POLL_INTERVAL_MS = 3000

export function App(): JSX.Element {
  const [snapshot, setSnapshot] = useState<TimersSnapshot | null>(null)
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [pairingInfo, setPairingInfo] = useState<BrowserPairingInfo | null>(null)
  const [domainFilterInput, setDomainFilterInput] = useState('')
  const { toasts, pushToast } = useToasts()

  useEffect(() => {
    window.api.timers.getSnapshot().then(setSnapshot)
    window.api.settings.get().then((s) => {
      setSettings(s)
      setDomainFilterInput(s.browserDomainFilter)
    })
    const offTimers = window.api.timers.onChanged(setSnapshot)
    const offSettings = window.api.settings.onChanged((s) => {
      setSettings(s)
      setDomainFilterInput(s.browserDomainFilter)
    })
    return () => {
      offTimers()
      offSettings()
    }
  }, [])

  // Polled rather than pushed — it's a low-stakes status dot, not worth a dedicated broadcast channel.
  useEffect(() => {
    window.api.browser.getPairingInfo().then(setPairingInfo)
    const interval = window.setInterval(() => {
      window.api.browser.getPairingInfo().then(setPairingInfo)
    }, PAIRING_POLL_INTERVAL_MS)
    return () => window.clearInterval(interval)
  }, [])

  function handleCopyPairingToken(): void {
    if (pairingInfo) navigator.clipboard.writeText(pairingInfo.token)
  }

  async function commitDomainFilter(): Promise<void> {
    const updated = await window.api.settings.setBrowserDomainFilter(domainFilterInput)
    setSettings(updated)
    setDomainFilterInput(updated.browserDomainFilter)
  }

  async function handleDockSideChange(dockSide: DockSide): Promise<void> {
    const updated = await window.api.settings.setDockSide(dockSide)
    setSettings(updated)
  }

  async function handleToggleHighlightPaused(): Promise<void> {
    const updated = await window.api.settings.setHighlightPausedTimers(!settings?.highlightPausedTimers)
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

  // Not "any paused timer" — switching between timers pauses the old one constantly and would
  // flash on every normal switch. Only worth flagging when nothing at all is running.
  const allActivePaused = activeTimers.length > 0 && activeTimers.every((t) => t.status === 'paused')
  const highlightPaused = (settings?.highlightPausedTimers ?? true) && allActivePaused

  return (
    <div className="app">
      <ToastStack toasts={toasts} />
      <header className="app__header">
        <h1>Time Tracker</h1>
        <div className="app__header-controls">
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
          <label className="setting-toggle">
            <input
              type="checkbox"
              checked={settings?.highlightPausedTimers ?? true}
              onChange={handleToggleHighlightPaused}
            />
            Highlight when all timers are paused
          </label>
        </div>
      </header>

      <section className="app__section">
        <h2>Browser extension</h2>
        <div className="browser-pairing">
          <span className={`browser-pairing__dot${pairingInfo?.connected ? ' is-connected' : ''}`} />
          <span>{pairingInfo?.connected ? 'Connected' : 'Not connected'}</span>
          <code className="browser-pairing__token">{pairingInfo?.token ?? '…'}</code>
          <button type="button" onClick={handleCopyPairingToken}>
            Copy token
          </button>
        </div>
        <label className="browser-pairing__domain">
          Only show open tabs &amp; history matching this domain:
          <input
            type="text"
            value={domainFilterInput}
            onChange={(e) => setDomainFilterInput(e.target.value)}
            onBlur={commitDomainFilter}
            onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
            placeholder="atlassian.net"
          />
        </label>
        {/* <p className="app__empty">
          Load the <code>browser-extension/</code> folder as an unpacked extension in{' '}
          <code>chrome://extensions</code>, then paste this token into its options page.
        </p> */}
      </section>

      {/* <section className="app__section">
        <h2>Start a timer</h2>
        <StartTimerForm onStart={handleStart} />
      </section> */}

      {/* <section className="app__section">
        <h2>Active ({activeTimers.length})</h2>
        {activeTimers.length === 0 && <p className="app__empty">Nothing running right now.</p>}
        {activeTimers.map((timer) => (
          <TimerRow key={timer.id} timer={timer} {...timerActions} highlightPaused={highlightPaused} />
        ))}
      </section> */}

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
