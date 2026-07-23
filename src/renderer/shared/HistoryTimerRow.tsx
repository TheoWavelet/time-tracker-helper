import type { TimerDTO } from '@shared/types'
import { formatDurationHuman } from '@shared/format'
import { TrashIcon } from './icons'

interface HistoryTimerRowProps {
  timer: TimerDTO
  onDelete: (id: string) => void
}

/**
 * Tells the paired browser extension (via a query param it watches for on page load) to click
 * Jira's "Log work" button automatically — see browser-extension/background.js.
 */
function withLogWorkTrigger(url: string): string {
  try {
    const parsed = new URL(url)
    parsed.searchParams.set('tt_logwork', '1')
    return parsed.toString()
  } catch {
    return url
  }
}

export function HistoryTimerRow({ timer, onDelete }: HistoryTimerRowProps): JSX.Element {
  function handleDelete(): void {
    if (window.confirm('Delete this saved timer? This cannot be undone.')) onDelete(timer.id)
  }

  function handleOpenTagLink(): void {
    window.api.shell.openExternal(withLogWorkTrigger(timer.tagTargetUrl!))
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
            <button className="link-button" onClick={handleOpenTagLink}>
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
