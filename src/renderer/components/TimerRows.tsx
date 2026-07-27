import type { TimerDTO } from '@shared/types'
import { formatDurationHuman, formatElapsedClock } from '@shared/format'
import { useElapsedMs, useStatusPulse } from './timerDisplay'
import { CheckIcon, TrashIcon } from './ui'

interface TimerRowProps {
  timer: TimerDTO
  onPause: (id: string) => void
  onResume: (id: string) => void
  onStop: (id: string) => void
  highlightPaused?: boolean
  isNew?: boolean
  /** Omitted entirely in contexts that don't offer deleting an active timer outright. */
  onDelete?: (id: string) => void
}

interface HistoryTimerRowProps {
  timer: TimerDTO
  /** Omitted entirely in read-only contexts (like the archive view) that don't offer deleting. */
  onDelete?: (id: string) => void
  /** Omitted entirely in contexts (like the overlay's "Just logged" list) that don't need it. */
  onToggleConfirmed?: (id: string) => void
  onLinkOpened?: (id: string) => void
}

function statusLabel(timer: TimerDTO): string {
  if (timer.status === 'paused') {
    if (timer.pausedReason === 'switched') return `Paused — switched to "${timer.switchedToTitle ?? '…'}"`
    if (timer.pausedReason === 'idle') return 'Paused — inactivity'
    return 'Paused by you'
  }
  return 'Running'
}

export function TimerRow({
  timer,
  onPause,
  onResume,
  onStop,
  highlightPaused = true,
  isNew = false,
  onDelete
}: TimerRowProps): JSX.Element {
  const elapsed = useElapsedMs(timer)
  const pulse = useStatusPulse(timer.status, timer.pausedReason)

  function handleRowClick(): void {
    if (timer.status === 'running') onPause(timer.id)
    else onResume(timer.id)
  }

  function handleStopClick(event: React.MouseEvent): void {
    event.stopPropagation()
    onStop(timer.id)
  }

  function handleDeleteClick(event: React.MouseEvent): void {
    event.stopPropagation()
    onDelete?.(timer.id)
  }

  const className = [
    'timer-row',
    timer.status === 'running' ? 'timer-row--running' : '',
    highlightPaused && timer.status === 'paused' ? 'timer-row--paused-alert' : '',
    isNew ? 'timer-row--new-timer' : '',
    pulse ?? ''
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={className} onClick={handleRowClick}>
      <div className="timer-row__main">
        <span className="timer-row__title">{timer.title}</span>
        <span className="timer-row__clock">{formatElapsedClock(elapsed)}</span>
        <div className="timer-row__actions">
          <button
            className="icon-button icon-button--save"
            onClick={handleStopClick}
            onMouseDown={(event) => event.stopPropagation()}
            aria-label="Stop and save"
          >
            <CheckIcon />
          </button>
          {onDelete && (
            <button
              className="icon-button icon-button--danger"
              onClick={handleDeleteClick}
              onMouseDown={(event) => event.stopPropagation()}
              aria-label="Delete"
              title="Delete this timer everywhere"
            >
              <TrashIcon />
            </button>
          )}
        </div>
      </div>
      <div className="timer-row__meta">
        <span className="timer-row__status">{statusLabel(timer)}</span>
      </div>
    </div>
  )
}

export function HistoryTimerRow({ timer, onDelete, onToggleConfirmed, onLinkOpened }: HistoryTimerRowProps): JSX.Element {
  const isConfirmed = timer.loggedConfirmedAt != null
  const isVisited = timer.linkOpenedAt != null

  function handleDelete(): void {
    onDelete?.(timer.id)
  }

  function handleOpenTagLink(): void {
    window.api.shell.openExternal(timer.tagTargetUrl!)
    onLinkOpened?.(timer.id)
  }

  return (
    <div className="history-row">
      <div className="history-row__main">
        <span className={`history-row__title${isConfirmed ? ' is-confirmed' : ''}`}>{timer.title}</span>
        <span className="history-row__duration">{formatDurationHuman(timer.accumulatedMs)}</span>
        {timer.clockworkLoggedAt != null && (
          <span className="clockwork-logged-badge" title="Logged automatically to Clockwork">
            <CheckIcon />
          </span>
        )}
      </div>
      <div className="history-row__meta">
        <div className="history-row__meta-left">
          {timer.tagLabel &&
            (timer.tagTargetUrl ? (
              <button
                className={`link-button${isVisited ? ' is-visited' : ''}${isConfirmed ? ' is-confirmed' : ''}`}
                onClick={handleOpenTagLink}
              >
                {timer.tagLabel}
              </button>
            ) : (
              <span className={`history-row__tag${isConfirmed ? ' is-confirmed' : ''}`}>{timer.tagLabel}</span>
            ))}
        </div>
        <div className="history-row__meta-right">
          {onToggleConfirmed && (
            <input
              type="checkbox"
              className="history-row__checkbox"
              checked={isConfirmed}
              onChange={() => onToggleConfirmed(timer.id)}
              aria-label="Mark as logged in the proper place"
              title="Mark as logged in the proper place"
            />
          )}
          {onDelete && (
            <button className="icon-button icon-button--danger" onClick={handleDelete} aria-label="Delete">
              <TrashIcon />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}