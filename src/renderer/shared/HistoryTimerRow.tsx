import type { TimerDTO } from '@shared/types'
import { formatDurationHuman } from '@shared/format'
import { TrashIcon } from './icons'

interface HistoryTimerRowProps {
  timer: TimerDTO
  onDelete: (id: string) => void
}

export function HistoryTimerRow({ timer, onDelete }: HistoryTimerRowProps): JSX.Element {
  function handleDelete(): void {
    if (window.confirm('Delete this saved timer? This cannot be undone.')) onDelete(timer.id)
  }

  return (
    <div className="history-row">
      <div className="history-row__main">
        <span className="history-row__title">{timer.title}</span>
        <span className="history-row__duration">{formatDurationHuman(timer.accumulatedMs)}</span>
      </div>
      <div className="history-row__meta">
        {timer.tagLabel &&
          (timer.tagTargetUrl ? (
            <button className="link-button" onClick={() => window.api.shell.openExternal(timer.tagTargetUrl!)}>
              {timer.tagLabel}
            </button>
          ) : (
            <span className="history-row__tag">{timer.tagLabel}</span>
          ))}
        <button className="icon-button icon-button--danger" onClick={handleDelete} aria-label="Delete">
          <TrashIcon />
        </button>
      </div>
    </div>
  )
}
