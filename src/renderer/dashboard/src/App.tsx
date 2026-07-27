import { useEffect, useRef, useState } from 'react'
import type { AppSettings, BrowserPairingInfo, DockSide, TimersSnapshot } from '@shared/types'
import { StartTimerForm, type StartTimerFormValue } from '../../components/TimerStarter'
import { HistoryTimerRow, TimerRow } from '../../components/TimerRows'
import { ChartIcon, GearIcon, ToastStack, TrashIcon, useToasts } from '../../components/ui'
import { groupHistory } from './groupHistory'

const PAIRING_POLL_INTERVAL_MS = 1500
const UNDO_DELETE_WINDOW_MS = 5000
const CHROME_EXTENSIONS_URL = 'chrome://extensions/'
// Publicly-accessible folder the extension zip is manually uploaded to on each release.
const EXTENSION_DOWNLOAD_URL = 'https://drive.google.com/drive/u/1/folders/1Jg0-a5bE0InWvpB-xyORBsQWbTrqhASP'

export function App(): JSX.Element {
  const [snapshot, setSnapshot] = useState<TimersSnapshot | null>(null)
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [pairingInfo, setPairingInfo] = useState<BrowserPairingInfo | null>(null)
  const [domainFilterInput, setDomainFilterInput] = useState('')
  const [pendingDeleteIds, setPendingDeleteIds] = useState<Set<string>>(new Set())
  const [settingsOpen, setSettingsOpen] = useState(false)
  const pendingDeleteTimers = useRef(new Map<string, number>())
  const settingsRef = useRef<HTMLDivElement>(null)
  const { toasts, pushToast, dismissToast } = useToasts()

  useEffect(() => {
    return () => {
      for (const timer of pendingDeleteTimers.current.values()) window.clearTimeout(timer)
    }
  }, [])

  useEffect(() => {
    if (!settingsOpen) return
    function handleOutsideMouseDown(event: MouseEvent): void {
      if (settingsRef.current && !settingsRef.current.contains(event.target as Node)) setSettingsOpen(false)
    }
    document.addEventListener('mousedown', handleOutsideMouseDown)
    return () => document.removeEventListener('mousedown', handleOutsideMouseDown)
  }, [settingsOpen])

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
    if (!pairingInfo) return
    navigator.clipboard.writeText(pairingInfo.token)
    pushToast('Copied pairing token')
  }

  function handleOpenChromeExtensions(): void {
    // chrome:// isn't a registered OS protocol, so this silently no-ops on some setups — the
    // Copy button right next to it is the reliable fallback, not an alternative for other cases.
    window.api.shell.openExternal(CHROME_EXTENSIONS_URL).catch(() => {})
  }

  function handleCopyChromeExtensionsLink(): void {
    navigator.clipboard.writeText(CHROME_EXTENSIONS_URL)
    pushToast('Copied chrome://extensions/ link')
  }

  function handleDownloadExtension(): void {
    window.api.shell.openExternal(EXTENSION_DOWNLOAD_URL)
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

  // Optimistic delete: the row disappears immediately, but the actual IPC delete is deferred —
  // clicking "Undo" within the window just cancels the pending timeout, nothing was ever lost.
  function scheduleDelete(ids: string[]): void {
    setPendingDeleteIds((previous) => new Set([...previous, ...ids]))
    for (const id of ids) {
      const timer = window.setTimeout(() => {
        pendingDeleteTimers.current.delete(id)
        window.api.timers.delete(id)
        setPendingDeleteIds((previous) => {
          const next = new Set(previous)
          next.delete(id)
          return next
        })
      }, UNDO_DELETE_WINDOW_MS)
      pendingDeleteTimers.current.set(id, timer)
    }
  }

  function cancelPendingDelete(ids: string[]): void {
    for (const id of ids) {
      const timer = pendingDeleteTimers.current.get(id)
      if (timer != null) {
        window.clearTimeout(timer)
        pendingDeleteTimers.current.delete(id)
      }
    }
    setPendingDeleteIds((previous) => {
      const next = new Set(previous)
      for (const id of ids) next.delete(id)
      return next
    })
  }

  function handleDeleteTimer(id: string): void {
    const timer = snapshot!.timers.find((t) => t.id === id)
    scheduleDelete([id])
    pushToast(`Deleted “${timer?.title ?? 'timer'}”`, {
      actionLabel: 'Undo',
      onAction: () => cancelPendingDelete([id]),
      durationMs: UNDO_DELETE_WINDOW_MS
    })
  }

  function handleBulkDelete(ids: string[], sectionLabel: string): void {
    if (ids.length === 0) return
    scheduleDelete(ids)
    pushToast(`Deleted ${ids.length} timer${ids.length === 1 ? '' : 's'} from ${sectionLabel}`, {
      actionLabel: 'Undo',
      onAction: () => cancelPendingDelete(ids),
      durationMs: UNDO_DELETE_WINDOW_MS
    })
  }

  function handleToggleConfirmed(id: string): void {
    window.api.timers.toggleLoggedConfirmed(id)
  }

  function handleLinkOpened(id: string): void {
    window.api.timers.markLinkOpened(id)
  }

  function handleCheckAll(ids: string[], sectionLabel: string, confirmed: boolean): void {
    if (ids.length === 0) return
    window.api.timers.setLoggedConfirmed(ids, confirmed)
    pushToast(`Marked ${ids.length} timer${ids.length === 1 ? '' : 's'} from ${sectionLabel} as ${confirmed ? 'logged' : 'not logged'}`)
  }

  function handleDeleteChecked(): void {
    const ids = historyTimers.filter((timer) => timer.loggedConfirmedAt != null).map((timer) => timer.id)
    if (ids.length === 0) return
    scheduleDelete(ids)
    pushToast(`Deleted ${ids.length} checked timer${ids.length === 1 ? '' : 's'}`, {
      actionLabel: 'Undo',
      onAction: () => cancelPendingDelete(ids),
      durationMs: UNDO_DELETE_WINDOW_MS
    })
  }

  const activeTimers = snapshot.timers.filter((t) => t.status === 'running' || t.status === 'paused')
  const historyTimers = snapshot.timers.filter((t) => t.status === 'stopped' && !pendingDeleteIds.has(t.id))
  const history = groupHistory(historyTimers, Date.now())
  const checkedCount = historyTimers.filter((timer) => timer.loggedConfirmedAt != null).length

  // Not "any paused timer" — switching between timers pauses the old one constantly and would
  // flash on every normal switch. Only worth flagging when nothing at all is running.
  const allActivePaused = activeTimers.length > 0 && activeTimers.every((t) => t.status === 'paused')
  const highlightPaused = (settings?.highlightPausedTimers ?? false) && allActivePaused

  return (
    <div className="app">
      <ToastStack toasts={toasts} onDismiss={dismissToast} />
      <header className="app__header">
        <h1>Time Tracker</h1>
        <div className="app__header-actions">
          <button
            type="button"
            className="icon-button settings-cog-button"
            onClick={() => window.api.app.openStats()}
            aria-label="Archive & stats"
            title="Archive & stats"
          >
            <ChartIcon />
          </button>
          <div className="settings-popover-wrapper" ref={settingsRef}>
            <button
              type="button"
              className="icon-button settings-cog-button"
              onClick={() => setSettingsOpen((open) => !open)}
              aria-label="Settings"
              title="Settings"
            >
              <GearIcon />
            </button>
            {settingsOpen && (
            <div className="settings-popover">
              <div className="settings-popover__group">
                <span className="settings-popover__label">Overlay position</span>
                <div className="dock-toggle">
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
              </div>
              <label className="setting-toggle">
                <input
                  type="checkbox"
                  checked={settings?.highlightPausedTimers ?? false}
                  onChange={handleToggleHighlightPaused}
                />
                Highlight when all timers are paused
              </label>

              <div className="settings-popover__divider" />

              <div className="settings-popover__group">
                <span className="settings-popover__label">Browser extension</span>
                <div className="browser-pairing">
                  <span className={`browser-pairing__dot${pairingInfo?.connected ? ' is-connected' : ''}`} />
                  <span>{pairingInfo?.connected ? 'Connected' : 'Not connected'}</span>
                </div>
                <div className="browser-pairing__token-row">
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
                <ol className="extension-guide__steps">
                  <li>Download the extension below and unzip it.</li>
                  <li>
                    Open <code>chrome://extensions</code> and turn on Developer mode.
                  </li>
                  <li>Click “Load unpacked” and select the unzipped folder.</li>
                  <li>Paste the pairing token above into the extension’s options page.</li>
                </ol>
                <div className="browser-pairing__token-row">
                  <code className="browser-pairing__token">chrome://extensions/</code>
                  <button type="button" onClick={handleOpenChromeExtensions}>
                    Open
                  </button>
                  <button type="button" onClick={handleCopyChromeExtensionsLink}>
                    Copy
                  </button>
                </div>
                <div className="browser-pairing__token-row">
                  <button type="button" onClick={handleDownloadExtension}>
                    Download extension (.zip)
                  </button>
                </div>
              </div>
            </div>
            )}
          </div>
        </div>
      </header>

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

      <div className="history-toolbar">
        <button
          type="button"
          className="icon-button icon-button--danger"
          onClick={handleDeleteChecked}
          disabled={checkedCount === 0}
          aria-label="Delete checked timers"
          title="Delete every timer checked as logged"
        >
          <TrashIcon />
          <span>Delete checked ({checkedCount})</span>
        </button>
      </div>

      <section className="app__section">
        <div className="app__section-header">
          <h2>Today ({history.today.length})</h2>
          {history.today.length > 0 && (
            <div className="app__section-actions">
              <input
                type="checkbox"
                className="check-all-checkbox"
                checked={history.today.every((timer) => timer.loggedConfirmedAt != null)}
                onChange={(event) => handleCheckAll(history.today.map((timer) => timer.id), 'today', event.target.checked)}
                aria-label="Check all of today's timers as logged"
                title="Check all of today's timers as logged"
              />
              <button
                type="button"
                className="icon-button icon-button--danger"
                onClick={() => handleBulkDelete(history.today.map((timer) => timer.id), 'today')}
                aria-label="Delete all of today's timers"
                title="Delete all of today's timers"
              >
                <TrashIcon />
              </button>
            </div>
          )}
        </div>
        {history.today.length === 0 && <p className="app__empty">Nothing saved today yet.</p>}
        {history.today.map((timer) => (
          <HistoryTimerRow
            key={timer.id}
            timer={timer}
            onDelete={handleDeleteTimer}
            onToggleConfirmed={handleToggleConfirmed}
            onLinkOpened={handleLinkOpened}
          />
        ))}
      </section>

      <section className="app__section">
        <div className="app__section-header">
          <h2>This week ({history.thisWeek.length})</h2>
          {history.thisWeek.length > 0 && (
            <div className="app__section-actions">
              <input
                type="checkbox"
                className="check-all-checkbox"
                checked={history.thisWeek.every((timer) => timer.loggedConfirmedAt != null)}
                onChange={(event) =>
                  handleCheckAll(history.thisWeek.map((timer) => timer.id), 'this week', event.target.checked)
                }
                aria-label="Check all of this week's timers as logged"
                title="Check all of this week's timers as logged"
              />
              <button
                type="button"
                className="icon-button icon-button--danger"
                onClick={() => handleBulkDelete(history.thisWeek.map((timer) => timer.id), 'this week')}
                aria-label="Delete all of this week's timers"
                title="Delete all of this week's timers"
              >
                <TrashIcon />
              </button>
            </div>
          )}
        </div>
        {history.thisWeek.length === 0 && <p className="app__empty">Nothing earlier this week.</p>}
        {history.thisWeek.map((timer) => (
          <HistoryTimerRow
            key={timer.id}
            timer={timer}
            onDelete={handleDeleteTimer}
            onToggleConfirmed={handleToggleConfirmed}
            onLinkOpened={handleLinkOpened}
          />
        ))}
      </section>

      <section className="app__section">
        <div className="app__section-header">
          <h2>Older ({history.older.length})</h2>
          {history.older.length > 0 && (
            <div className="app__section-actions">
              <input
                type="checkbox"
                className="check-all-checkbox"
                checked={history.older.every((timer) => timer.loggedConfirmedAt != null)}
                onChange={(event) => handleCheckAll(history.older.map((timer) => timer.id), 'older', event.target.checked)}
                aria-label="Check all older timers as logged"
                title="Check all older timers as logged"
              />
              <button
                type="button"
                className="icon-button icon-button--danger"
                onClick={() => handleBulkDelete(history.older.map((timer) => timer.id), 'older')}
                aria-label="Delete all older timers"
                title="Delete all older timers"
              >
                <TrashIcon />
              </button>
            </div>
          )}
        </div>
        {history.older.length === 0 && <p className="app__empty">Nothing older.</p>}
        {history.older.map((timer) => (
          <HistoryTimerRow
            key={timer.id}
            timer={timer}
            onDelete={handleDeleteTimer}
            onToggleConfirmed={handleToggleConfirmed}
            onLinkOpened={handleLinkOpened}
          />
        ))}
      </section>
    </div>
  )
}
