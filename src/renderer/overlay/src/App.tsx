import { useEffect, useRef, useState } from 'react'
import type { AppSettings, TimerDTO, TimersSnapshot } from '@shared/types'
import { formatElapsedClock } from '@shared/format'
import { useElapsedMs, useStatusPulse } from '../../components/timerDisplay'
import { StartTimerForm, type StartTimerFormValue } from '../../components/TimerStarter'
import { TimerRow } from '../../components/TimerRows'
import { ChevronDownIcon, DotModeIcon, LogsIcon, ToastStack, useToasts } from '../../components/ui'
import { isWindowDragInProgress, startWindowDrag } from './windowDrag'

const COLLAPSE_DELAY_MS = 250
const EXPAND_DELAY_MS = 300
const NEW_TIMER_FLASH_MS = 1800
// Deliberately much longer than the instant widen dot mode's off — a 16px dot is easy to brush by
// accident, so revealing the wide bar needs an actual dwell, not just a passing hover.
const DOT_HOVER_DELAY_MS = 500
// Widening the bar animates its bounds over ~140ms (see RESIZE_ANIMATION_MS in overlayWindow.ts),
// and each intermediate setBounds() call during that animation can make Chromium fire a synthetic
// mouseleave/mouseenter on whatever now sits under the (physically stationary) cursor — the same
// mechanism windowDrag.ts already documents for dragging. Right at a docked edge this could cause
// narrow→widen→narrow to retrigger itself in a loop. Debouncing just the narrow side absorbs a
// spurious leave-then-immediate-enter pair without adding any perceptible delay to a real one.
const BAR_NARROW_DELAY_MS = 180

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
  const barNarrowTimerRef = useRef<number | undefined>(undefined)
  const dotRevealTimerRef = useRef<number | undefined>(undefined)
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
      if (barNarrowTimerRef.current != null) window.clearTimeout(barNarrowTimerRef.current)
      if (dotRevealTimerRef.current != null) window.clearTimeout(dotRevealTimerRef.current)
    }
  }, [])

  async function toggleExpanded(next: boolean): Promise<void> {
    await window.api.overlay.setExpanded(next)
    setExpanded(next)
    if (!next) {
      // The main process already resets its own barWide to false on collapse (so the window
      // itself resizes narrow) — but this renderer-side flag is separate state and was never
      // told to follow, so a stale `true` here renders titles against an already-narrow window.
      cancelScheduledBarNarrow()
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

  function cancelScheduledBarNarrow(): void {
    if (barNarrowTimerRef.current != null) {
      window.clearTimeout(barNarrowTimerRef.current)
      barNarrowTimerRef.current = undefined
    }
  }

  function cancelScheduledDotReveal(): void {
    if (dotRevealTimerRef.current != null) {
      window.clearTimeout(dotRevealTimerRef.current)
      dotRevealTimerRef.current = undefined
    }
  }

  // Flips render and window bounds together, same as before dot mode existed. An earlier version
  // deferred the render flip until the window's own resize animation finished, so the dot would
  // stay put on screen throughout — but that introduced a race: the resize itself can fire a
  // spurious mouseleave/mouseenter pair (see the note on BAR_NARROW_DELAY_MS below), and that
  // synthetic re-enter restarted the whole DOT_HOVER_DELAY_MS dwell from scratch even though the
  // window had already committed to widening, leaving the dot rendered — stuck — inside an
  // already-wide window until a second dwell finally elapsed. Instant, atomic like this, avoids
  // that entirely; the dot staying visually still while IT'S visible is handled purely by
  // .overlay-dot's edge-pinned CSS, not by keeping it around longer.
  function revealWideBar(): void {
    setBarWideState(true)
    window.api.overlay.setBarWide(true)
  }

  // Attached to the shared container (rows + "see more" arrow, or the dot) rather than either
  // child individually — moving between the two never crosses the container's own boundary, so it
  // can't flicker narrow-then-wide the way two separate per-child hover pairs would.
  function handleBarContainerMouseEnter(): void {
    if (isWindowDragInProgress()) return
    cancelScheduledBarNarrow()
    // The wide bar only exists to show timer titles/clocks — with nothing running there's nothing
    // for it to reveal, so skip straight to the same expand-on-hover the "see more" arrow uses
    // instead of forcing an extra hover step through a wide bar that'd just say "No timer running".
    const hasActiveTimers = snapshot?.timers.some((t) => t.status === 'running' || t.status === 'paused') ?? false
    if (!hasActiveTimers) {
      handleSeeMoreMouseEnter()
      return
    }
    // Dot mode's whole point is that brushing past a 16px hit target shouldn't reveal anything —
    // only a deliberate dwell should. Off dot mode, widening stays instant, as it always has.
    if (settings?.overlayDotMode) {
      cancelScheduledDotReveal()
      dotRevealTimerRef.current = window.setTimeout(() => {
        if (!isWindowDragInProgress()) revealWideBar()
      }, DOT_HOVER_DELAY_MS)
    } else {
      revealWideBar()
    }
  }

  function handleBarContainerMouseLeave(): void {
    if (isWindowDragInProgress()) return
    cancelScheduledDotReveal()
    cancelScheduledExpand()
    cancelScheduledBarNarrow()
    barNarrowTimerRef.current = window.setTimeout(() => {
      setBarWideState(false)
      window.api.overlay.setBarWide(false)
    }, BAR_NARROW_DELAY_MS)
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
    // Used to force-collapse here, but shrinking the window out from under the cursor left it
    // sitting over the "see more" arrow at the new, smaller bounds, which just reopened the panel
    // again via the normal hover-to-expand path a moment later. Leaving it open and letting the
    // existing hover-out-to-collapse (handlePanelMouseLeave) handle it avoids that entirely.
  }

  async function handleCreateCustomLog(value: StartTimerFormValue, durationMinutes: number): Promise<void> {
    const created = await window.api.timers.createCustomLog({ ...value, durationMinutes })
    pushToast(`Logged ${durationMinutes} min for “${created.title}”`)
    setNewTimerId(created.id)
    window.setTimeout(() => {
      setNewTimerId((current) => (current === created.id ? null : current))
    }, NEW_TIMER_FLASH_MS)
  }

  const panelTimerActions = {
    onPause: handlePauseFromPanel,
    onResume: (id: string) => window.api.timers.resume(id),
    onStop: (id: string) => window.api.timers.stop(id),
    onDelete: handleDeleteFromPanel
  }

  async function handleToggleDotMode(): Promise<void> {
    const updated = await window.api.settings.setOverlayDotMode(!settings?.overlayDotMode)
    setSettings(updated)
  }

  if (!snapshot) return <div className="bar-container" />

  const activeTimers = snapshot.timers.filter((t) => t.status === 'running' || t.status === 'paused')

  // Not "any paused timer" — switching between timers pauses the old one constantly and would
  // flash on every normal switch. Only worth flagging when nothing at all is running. Custom logs
  // are excluded from the trigger itself (a deliberately-logged paused chunk isn't a forgotten
  // timer) — though if something else genuinely triggers the alert, they still flash along with
  // every other paused row, since they render with no special-casing otherwise.
  const flashTriggerTimers = activeTimers.filter((t) => t.kind !== 'custom_log')
  const allActivePaused = flashTriggerTimers.length > 0 && flashTriggerTimers.every((t) => t.status === 'paused')
  const highlightPaused = (settings?.highlightPausedTimers ?? false) && allActivePaused
  // Separate opt-in (default off): flags the overlay having nothing in it at all, not just
  // everything-paused — off by default since an empty overlay isn't necessarily a forgotten timer.
  const highlightNoTimers = (settings?.highlightNoTimers ?? false) && activeTimers.length === 0
  const dotMode = settings?.overlayDotMode ?? false
  const anyTimerRunning = activeTimers.some((timer) => timer.status === 'running')

  if (!expanded) {
    // The rows themselves are draggable+clickable (see BarRow); expanding only happens via the
    // dedicated "see more" strip below, so grabbing/clicking a row never triggers it by accident.
    // Dot mode's resting state is just this same hover surface rendering a dot instead of the bar
    // — once widened (via the longer dwell in handleBarContainerMouseEnter) it's identical to the
    // non-dot-mode bar below, "see more" arrow included.
    if (dotMode && !barWide) {
      return (
        <div className="bar-container" onMouseEnter={handleBarContainerMouseEnter} onMouseLeave={handleBarContainerMouseLeave}>
          <div
            className={`overlay-dot ${settings?.dockSide === 'left' ? 'overlay-dot--dock-left' : 'overlay-dot--dock-right'} ${anyTimerRunning ? 'overlay-dot--running' : 'overlay-dot--idle'}`}
            title={anyTimerRunning ? 'Timer running' : 'No timer running'}
          />
        </div>
      )
    }
    return (
      <div className="bar-container" onMouseEnter={handleBarContainerMouseEnter} onMouseLeave={handleBarContainerMouseLeave}>
        <div className="bar-stack">
          {activeTimers.length === 0 ? (
            <div
              className={`bar-row${barWide ? ' bar-row--wide' : ''}${highlightNoTimers ? ' bar-row--paused-alert' : ''}`}
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
            className={`icon-button panel__dot-toggle${settings?.overlayDotMode ? ' is-active' : ''}`}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={handleToggleDotMode}
            aria-pressed={settings?.overlayDotMode ?? false}
            aria-label={settings?.overlayDotMode ? 'Disable dot mode' : 'Enable dot mode'}
            title={
              settings?.overlayDotMode
                ? 'Dot mode on — shrinks to a dot when idle'
                : 'Dot mode off — shrink the overlay to a dot when idle'
            }
          >
            <DotModeIcon />
          </button>
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
        <StartTimerForm
          onStart={handleStartFromPanel}
          onCreateCustomLog={handleCreateCustomLog}
          clockworkSyncActive={settings?.clockworkSyncEnabled ?? false}
        />

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
      </div>
    </div>
  )
}
