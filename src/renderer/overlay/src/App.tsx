import { useEffect, useRef, useState } from 'react'
import type { AppSettings, TimerDTO, TimersSnapshot } from '@shared/types'
import { formatElapsedClock } from '@shared/format'
import { useElapsedMs, useStatusPulse } from '../../components/timerDisplay'
import { StartTimerForm, type StartTimerFormValue } from '../../components/TimerStarter'
import { HistoryTimerRow, TimerRow } from '../../components/TimerRows'
import { ChevronDownIcon, LogsIcon, ToastStack, useToasts } from '../../components/ui'
import { isWindowDragInProgress, startWindowDrag } from './windowDrag'

const COLLAPSE_DELAY_MS = 250
const EXPAND_DELAY_MS = 300
const NEW_TIMER_FLASH_MS = 1800

function BarRow({
  timer,
  onClick,
  showTitle,
  highlightPaused,
  isNew
}: {
  timer: TimerDTO
  onClick: () => void
  showTitle: boolean
  highlightPaused: boolean
  isNew: boolean
}): JSX.Element {
  const elapsed = useElapsedMs(timer)
  const pulse = useStatusPulse(timer.status, timer.pausedReason)
  const className = [
    'bar-row',
    timer.status === 'running' ? 'bar-row--running' : '',
    highlightPaused && timer.status === 'paused' ? 'bar-row--paused-alert' : '',
    showTitle ? 'bar-row--wide' : '',
    isNew ? 'bar-row--new-timer' : '',
    pulse ?? ''
  ]
    .filter(Boolean)
    .join(' ')
  return (
    <div className={className} title={timer.title} onMouseDown={(e) => startWindowDrag(e, onClick)}>
      {showTitle && <span className="bar-row__title">{timer.title}</span>}
      <span className="bar-row__clock">{formatElapsedClock(elapsed)}</span>
    </div>
  )
}

export function App(): JSX.Element {
  const [snapshot, setSnapshot] = useState<TimersSnapshot | null>(null)
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [expanded, setExpanded] = useState(false)
  const [barWide, setBarWideState] = useState(false)
  const collapseTimerRef = useRef<number | undefined>(undefined)
  const expandTimerRef = useRef<number | undefined>(undefined)
  const [recentCustomLogIds, setRecentCustomLogIds] = useState<string[]>([])
  const [newTimerId, setNewTimerId] = useState<string | null>(null)
  const { toasts, pushToast } = useToasts()

  useEffect(() => {
    window.api.timers.getSnapshot().then(setSnapshot)
    window.api.settings.get().then(setSettings)
    const offTimers = window.api.timers.onChanged(setSnapshot)
    const offSettings = window.api.settings.onChanged(setSettings)
    return () => {
      offTimers()
      offSettings()
      if (expandTimerRef.current != null) window.clearTimeout(expandTimerRef.current)
      if (collapseTimerRef.current != null) window.clearTimeout(collapseTimerRef.current)
    }
  }, [])

  async function toggleExpanded(next: boolean): Promise<void> {
    await window.api.overlay.setExpanded(next)
    setExpanded(next)
    if (!next) {
      setRecentCustomLogIds([])
      // The main process already resets its own barWide to false on collapse (so the window
      // itself resizes narrow) — but this renderer-side flag is separate state and was never
      // told to follow, so a stale `true` here renders titles against an already-narrow window.
      setBarWideState(false)
    }
  }

  function cancelScheduledCollapse(): void {
    if (collapseTimerRef.current != null) {
      window.clearTimeout(collapseTimerRef.current)
      collapseTimerRef.current = undefined
    }
  }

  function cancelScheduledExpand(): void {
    if (expandTimerRef.current != null) {
      window.clearTimeout(expandTimerRef.current)
      expandTimerRef.current = undefined
    }
  }

  function scheduleCollapse(): void {
    cancelScheduledCollapse()
    collapseTimerRef.current = window.setTimeout(() => {
      void toggleExpanded(false)
    }, COLLAPSE_DELAY_MS)
  }

  // Dragging the window moves it under a stationary cursor, which makes Chromium fire synthetic
  // mouseenter/mouseleave on whatever's now underneath — ignore those so a drag can't accidentally
  // trigger the hover-driven expand/collapse.
  function handleSeeMoreMouseEnter(): void {
    if (isWindowDragInProgress()) return
    cancelScheduledExpand()
    expandTimerRef.current = window.setTimeout(() => {
      if (!isWindowDragInProgress()) void toggleExpanded(true)
    }, EXPAND_DELAY_MS)
  }

  function handlePanelMouseLeave(): void {
    if (!isWindowDragInProgress()) scheduleCollapse()
  }

  function handlePanelMouseEnter(): void {
    cancelScheduledCollapse()
  }

  function handleSeeMoreMouseLeave(): void {
    cancelScheduledExpand()
  }

  function toggleTimer(timer: TimerDTO): void {
    if (timer.status === 'running') window.api.timers.pause(timer.id)
    else window.api.timers.resume(timer.id)
  }

  // Attached to the shared container (rows + "see more" arrow) rather than either child
  // individually — moving between the two never crosses the container's own boundary, so it
  // can't flicker narrow-then-wide the way two separate per-child hover pairs would.
  function handleBarContainerMouseEnter(): void {
    if (isWindowDragInProgress()) return
    setBarWideState(true)
    window.api.overlay.setBarWide(true)
  }

  function handleBarContainerMouseLeave(): void {
    if (isWindowDragInProgress()) return
    setBarWideState(false)
    window.api.overlay.setBarWide(false)
  }

  function handlePauseFromPanel(id: string): void {
    const timer = snapshot?.timers.find((t) => t.id === id)
    window.api.timers.pause(id)
    pushToast(`Paused “${timer?.title ?? 'timer'}”`)
  }

  function handleDeleteFromPanel(id: string): void {
    const timer = snapshot?.timers.find((t) => t.id === id)
    window.api.timers.delete(id)
    pushToast(`Deleted “${timer?.title ?? 'timer'}”`)
  }

  async function handleStartFromPanel(value: StartTimerFormValue): Promise<void> {
    const created = await window.api.timers.start(value)
    pushToast(`Started “${created.title}”`)
    setNewTimerId(created.id)
    window.setTimeout(() => {
      setNewTimerId((current) => (current === created.id ? null : current))
    }, NEW_TIMER_FLASH_MS)
    void toggleExpanded(false)
  }

  async function handleCreateCustomLog(value: StartTimerFormValue, durationMinutes: number): Promise<void> {
    const created = await window.api.timers.createCustomLog({ ...value, durationMinutes })
    setRecentCustomLogIds((ids) => [created.id, ...ids])
    pushToast(`Logged ${durationMinutes} min for “${created.title}”`)
  }

  const panelTimerActions = {
    onPause: handlePauseFromPanel,
    onResume: (id: string) => window.api.timers.resume(id),
    onStop: (id: string) => window.api.timers.stop(id),
    onDelete: handleDeleteFromPanel
  }

  if (!snapshot) return <div className="bar-container" />

  const activeTimers = snapshot.timers.filter((t) => t.status === 'running' || t.status === 'paused')
  const recentCustomLogs = recentCustomLogIds
    .map((id) => snapshot.timers.find((timer) => timer.id === id))
    .filter((timer): timer is TimerDTO => timer != null)

  // Not "any paused timer" — switching between timers pauses the old one constantly and would
  // flash on every normal switch. Only worth flagging when nothing at all is running.
  const allActivePaused = activeTimers.length > 0 && activeTimers.every((t) => t.status === 'paused')
  const highlightPaused = (settings?.highlightPausedTimers ?? false) && allActivePaused

  if (!expanded) {
    // The rows themselves are draggable+clickable (see BarRow); expanding only happens via the
    // dedicated "see more" strip below, so grabbing/clicking a row never triggers it by accident.
    return (
      <div className="bar-container" onMouseEnter={handleBarContainerMouseEnter} onMouseLeave={handleBarContainerMouseLeave}>
        <div className="bar-stack">
          {activeTimers.length === 0 ? (
            <div
              className={`bar-row${barWide ? ' bar-row--wide' : ''}`}
              title="No timer running"
              onMouseDown={(e) => startWindowDrag(e)}
            >
              {barWide && <span className="bar-row__title">No timer running</span>}
              <span className="bar-row__clock">--:--</span>
            </div>
          ) : (
            activeTimers.map((timer) => (
              <BarRow
                key={timer.id}
                timer={timer}
                onClick={() => toggleTimer(timer)}
                showTitle={barWide}
                highlightPaused={highlightPaused}
                isNew={timer.id === newTimerId}
              />
            ))
          )}
        </div>
        <button className="see-more" onMouseEnter={handleSeeMoreMouseEnter} onMouseLeave={handleSeeMoreMouseLeave} aria-label="Show more">
          <ChevronDownIcon />
        </button>
      </div>
    )
  }

  return (
    <div className="panel" onMouseEnter={handlePanelMouseEnter} onMouseLeave={handlePanelMouseLeave}>
      <ToastStack toasts={toasts} />
      <div className="panel__header" onMouseDown={startWindowDrag}>
        <span>Time Tracker</span>
        <div className="panel__header-actions">
          <button
            className="panel__history-button icon-button"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={() => window.api.app.openDashboard()}
            aria-label="Open logs"
          >
            <LogsIcon />
          </button>
          <button
            className="panel__collapse"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={() => toggleExpanded(false)}
            aria-label="Collapse"
          >
            ✕
          </button>
        </div>
      </div>

      <div className="panel__body">
        <StartTimerForm onStart={handleStartFromPanel} onCreateCustomLog={handleCreateCustomLog} />

        {activeTimers.length > 0 && (
          <section className="panel__section">
            <h3>Active</h3>
            {activeTimers.map((timer) => (
              <TimerRow
                key={timer.id}
                timer={timer}
                {...panelTimerActions}
                highlightPaused={highlightPaused}
                isNew={timer.id === newTimerId}
              />
            ))}
          </section>
        )}

        {recentCustomLogs.length > 0 && (
          <section className="panel__section">
            <h3>Just logged</h3>
            {recentCustomLogs.map((timer) => <HistoryTimerRow key={timer.id} timer={timer} onDelete={(id) => window.api.timers.delete(id)} />)}
          </section>
        )}
      </div>
    </div>
  )
}
