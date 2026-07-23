import type { TimerDTO } from '@shared/types'
import { useElapsedMs } from './useElapsedTime'
import { formatElapsedClock } from '@shared/format'
import { useStatusPulse } from './useStatusPulse'
import { CheckIcon } from './icons'

interface TimerRowProps {
  timer: TimerDTO
  onPause: (id: string) => void
  onResume: (id: string) => void
  onStop: (id: string) => void
  highlightPaused?: boolean
}

function statusLabel(timer: TimerDTO): string {
  if (timer.status === 'paused') {
    if (timer.pausedReason === 'switched') return `Paused — switched to "${timer.switchedToTitle ?? '…'}"`
    if (timer.pausedReason === 'idle') return 'Paused — inactivity'
    return 'Paused by you'
  }
  return 'Running'
}

/** The whole row is the click target: running -> pause, paused -> resume (switches to this one). */
export function TimerRow({ timer, onPause, onResume, onStop, highlightPaused = true }: TimerRowProps): JSX.Element {
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

  const className = [
    'timer-row',
    timer.status === 'running' ? 'timer-row--running' : '',
    highlightPaused && timer.status === 'paused' ? 'timer-row--paused-alert' : '',
    pulse ?? ''
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={className} onClick={handleRowClick}>
      <div className="timer-row__main">
        <span className="timer-row__title">{timer.title}</span>
        <span className="timer-row__clock">{formatElapsedClock(elapsed)}</span>
        <button
          className="icon-button icon-button--save"
          onClick={handleStopClick}
          onMouseDown={(e) => e.stopPropagation()}
          aria-label="Stop and save"
        >
          <CheckIcon />
        </button>
      </div>
      <div className="timer-row__meta">
        <span className="timer-row__status">{statusLabel(timer)}</span>
      </div>
    </div>
  )
}
