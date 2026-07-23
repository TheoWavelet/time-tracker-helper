import { useEffect, useRef, useState } from 'react'
import type { AppSettings, TimerDTO, TimersSnapshot } from '@shared/types'
import { formatElapsedClock } from '@shared/format'
import { useElapsedMs } from '../../shared/useElapsedTime'
import { StartTimerForm, type StartTimerFormValue } from '../../shared/StartTimerForm'
import { TimerRow } from '../../shared/TimerRow'
import { LogsIcon } from '../../shared/icons'
import { useToasts, ToastStack } from '../../shared/Toast'
import { useStatusPulse } from '../../shared/useStatusPulse'
import { isWindowDragInProgress, startWindowDrag } from './windowDrag'

const COLLAPSE_DELAY_MS = 250

function BarRow({
  timer,
  onClick,
  showTitle,
  highlightPaused
}: {
  timer: TimerDTO
  onClick: () => void
  showTitle: boolean
  highlightPaused: boolean
}): JSX.Element {
  const elapsed = useElapsedMs(timer)
  const pulse = useStatusPulse(timer.status, timer.pausedReason)
  const className = [
    'bar-row',
    timer.status === 'running' ? 'bar-row--running' : '',
    highlightPaused && timer.status === 'paused' ? 'bar-row--paused-alert' : '',
    showTitle ? 'bar-row--wide' : '',
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
  const { toasts, pushToast } = useToasts()

  useEffect(() => {
    window.api.timers.getSnapshot().then(setSnapshot)
    window.api.settings.get().then(setSettings)
    const offTimers = window.api.timers.onChanged(setSnapshot)
    const offSettings = window.api.settings.onChanged(setSettings)
    return () => {
      offTimers()
      offSettings()
    }
  }, [])

  async function toggleExpanded(next: boolean): Promise<void> {
    await window.api.overlay.setExpanded(next)
    setExpanded(next)
  }

  function cancelScheduledCollapse(): void {
    if (collapseTimerRef.current != null) {
      window.clearTimeout(collapseTimerRef.current)
      collapseTimerRef.current = undefined
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
    if (!isWindowDragInProgress()) void toggleExpanded(true)
  }

  function handlePanelMouseLeave(): void {
    if (!isWindowDragInProgress()) scheduleCollapse()
  }

  function toggleTimer(timer: TimerDTO): void {
    if (timer.status === 'running') window.api.timers.pause(timer.id)
    else window.api.timers.resume(timer.id)
  }

  // Hovering the timer rows (not the "see more" strip) widens the bar so titles have room —
  // guarded against drag the same way as the other hover-driven behaviors above.
  function handleStackMouseEnter(): void {
    if (isWindowDragInProgress()) return
    setBarWideState(true)
    window.api.overlay.setBarWide(true)
  }

  function handleStackMouseLeave(): void {
    if (isWindowDragInProgress()) return
    setBarWideState(false)
    window.api.overlay.setBarWide(false)
  }

  function handlePauseFromPanel(id: string): void {
    const timer = snapshot?.timers.find((t) => t.id === id)
    window.api.timers.pause(id)
    pushToast(`Paused “${timer?.title ?? 'timer'}”`)
  }

  async function handleStartFromPanel(value: StartTimerFormValue): Promise<void> {
    const created = await window.api.timers.start(value)
    pushToast(`Started “${created.title}”`)
  }

  const panelTimerActions = {
    onPause: handlePauseFromPanel,
    onResume: (id: string) => window.api.timers.resume(id),
    onStop: (id: string) => window.api.timers.stop(id)
  }

  if (!snapshot) return <div className="bar-container" />

  const activeTimers = snapshot.timers.filter((t) => t.status === 'running' || t.status === 'paused')

  // Not "any paused timer" — switching between timers pauses the old one constantly and would
  // flash on every normal switch. Only worth flagging when nothing at all is running.
  const allActivePaused = activeTimers.length > 0 && activeTimers.every((t) => t.status === 'paused')
  const highlightPaused = (settings?.highlightPausedTimers ?? true) && allActivePaused

  if (!expanded) {
    // The rows themselves are draggable+clickable (see BarRow); expanding only happens via the
    // dedicated "see more" strip below, so grabbing/clicking a row never triggers it by accident.
    return (
      <div className="bar-container">
        <div className="bar-stack" onMouseEnter={handleStackMouseEnter} onMouseLeave={handleStackMouseLeave}>
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
              />
            ))
          )}
        </div>
        <button className="see-more" onMouseEnter={handleSeeMoreMouseEnter} aria-label="Show more">
          ⌄
        </button>
      </div>
    )
  }

  return (
    <div className="panel" onMouseEnter={cancelScheduledCollapse} onMouseLeave={handlePanelMouseLeave}>
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
        <StartTimerForm onStart={handleStartFromPanel} />

        {activeTimers.length > 0 && (
          <section className="panel__section">
            <h3>Active</h3>
            {activeTimers.map((timer) => (
              <TimerRow key={timer.id} timer={timer} {...panelTimerActions} highlightPaused={highlightPaused} />
            ))}
          </section>
        )}
      </div>
    </div>
  )
}
