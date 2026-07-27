import { useEffect, useRef, useState } from 'react'
import type { DomainHistoryItem, OpenTabInfo, TagPickerEntry } from '@shared/types'
import { formatDefaultTimerTitle } from '@shared/format'
import { ClockPlusIcon, PlusIcon } from './ui'

export interface StartTimerFormValue {
  title?: string
  tagLabel?: string
}

interface StartTimerFormProps {
  onStart: (value: StartTimerFormValue) => void
  onCreateCustomLog: (value: StartTimerFormValue, durationMinutes: number) => void
}

type PickerView = 'all' | 'recent' | 'most_used' | 'favorites'

const BROWSER_PAGE_SIZE = 50

interface TagPickerProps {
  value: string
  onChange: (text: string) => void
  onPickTag: (tag: TagPickerEntry) => void
  placeholder?: string
}

interface PickerRowProps {
  title: string
  url?: string
  isFavorite: boolean
  onPick: () => void
  onToggleFavorite: () => void
}

interface BrowserPickItem {
  key: string
  title: string
  url: string
}

function sortTags(tags: TagPickerEntry[], view: PickerView): TagPickerEntry[] {
  return [...tags].sort((first, second) =>
    view === 'most_used'
      ? second.usageCount - first.usageCount || first.label.localeCompare(second.label)
      : (second.lastUsedAt ?? 0) - (first.lastUsedAt ?? 0) || first.label.localeCompare(second.label)
  )
}

function matchesQuery(query: string, title: string, url: string): boolean {
  return !query || title.toLowerCase().includes(query) || url.toLowerCase().includes(query)
}

/** The URL is available as a native tooltip on hover (via `title`) rather than shown inline. */
function PickerRow({ title, url, isFavorite, onPick, onToggleFavorite }: PickerRowProps): JSX.Element {
  return (
    <div className="tag-picker__row--tag">
      <button type="button" className="tag-picker__row-main" onClick={onPick} title={url}>
        <span className="tag-picker__row-label">{title}</span>
      </button>
      <button
        type="button"
        className={`tag-picker__favorite-btn${isFavorite ? ' is-favorite' : ''}`}
        onClick={(event) => {
          event.stopPropagation()
          onToggleFavorite()
        }}
        title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
        aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
      >
        ★
      </button>
    </div>
  )
}

function TagPicker({ value, onChange, onPickTag, placeholder }: TagPickerProps): JSX.Element {
  const [open, setOpen] = useState(false)
  const [view, setView] = useState<PickerView>('all')
  const [allTags, setAllTags] = useState<TagPickerEntry[]>([])
  const [openTabs, setOpenTabs] = useState<OpenTabInfo[]>([])
  const [domainHistory, setDomainHistory] = useState<DomainHistoryItem[]>([])
  const [domainFilter, setDomainFilter] = useState('')
  const [browserPageCount, setBrowserPageCount] = useState(BROWSER_PAGE_SIZE)
  const wrapperRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handleOutsideMouseDown(event: MouseEvent): void {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleOutsideMouseDown)
    return () => document.removeEventListener('mousedown', handleOutsideMouseDown)
  }, [open])

  function openDropdown(): void {
    setOpen(true)
    window.api.tags.listForPicker().then(setAllTags)
    window.api.browser.listOpenTabs().then(setOpenTabs)
    window.api.browser.searchHistoryByDomain().then(setDomainHistory)
    window.api.settings.get().then((settings) => setDomainFilter(settings.browserDomainFilter))
  }

  function upsertTag(tag: TagPickerEntry): void {
    setAllTags((previous) =>
      previous.some((current) => current.id === tag.id)
        ? previous.map((current) => (current.id === tag.id ? tag : current))
        : [...previous, tag]
    )
  }

  function isLabelFavorited(title: string): boolean {
    return allTags.find((tag) => tag.label === title)?.isFavorite ?? false
  }

  async function handlePickBrowserEntry(title: string, url: string): Promise<void> {
    const tag = await window.api.tags.findOrCreateByLabelAndUrl(title, url)
    onPickTag(tag)
    setOpen(false)
  }

  async function handleToggleFavorite(id: string): Promise<void> {
    const updated = await window.api.tags.toggleFavorite(id)
    upsertTag(updated)
  }

  async function handleToggleFavoriteForEntry(title: string, url: string): Promise<void> {
    const tag = await window.api.tags.findOrCreateByLabelAndUrl(title, url)
    const updated = await window.api.tags.toggleFavorite(tag.id)
    upsertTag(updated)
  }

  const query = value.trim().toLowerCase()
  const filtered = allTags
    .filter((tag) => view !== 'favorites' || tag.isFavorite)
    .filter((tag) => !query || tag.label.toLowerCase().includes(query) || tag.targetUrl?.toLowerCase().includes(query))
  const visible = sortTags(filtered, view)
  const visibleTabs = openTabs.filter((tab) => matchesQuery(query, tab.title, tab.url))
  const visibleHistory = domainHistory.filter((item) => matchesQuery(query, item.title, item.url))
  const domainSuffix = domainFilter ? ` (${domainFilter})` : ''

  // Open tabs first, then history — combined into one searchable, paginated list under "All".
  const allBrowserItems: BrowserPickItem[] = [
    ...visibleTabs.map((tab, index) => ({ key: `tab-${tab.url}-${index}`, title: tab.title, url: tab.url })),
    ...visibleHistory.map((item) => ({ key: `history-${item.url}-${item.lastVisitTime}`, title: item.title, url: item.url }))
  ]
  const visibleBrowserItems = allBrowserItems.slice(0, browserPageCount)

  useEffect(() => {
    setBrowserPageCount(BROWSER_PAGE_SIZE)
  }, [query, open])

  function handleBrowserListScroll(event: React.UIEvent<HTMLDivElement>): void {
    const list = event.currentTarget
    if (list.scrollTop + list.clientHeight < list.scrollHeight - 24) return
    setBrowserPageCount((count) => Math.min(allBrowserItems.length, count + BROWSER_PAGE_SIZE))
  }

  return (
    <div className="tag-picker" ref={wrapperRef}>
      <input
        className="tag-picker__input"
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onFocus={openDropdown}
        onClick={openDropdown}
        onKeyDown={(event) => event.key === 'Escape' && setOpen(false)}
        placeholder={placeholder}
      />
      {open && (
        <div className="tag-picker__dropdown">
          <div className="tag-picker__header">
            <div className="tag-picker__group">
              <button type="button" className={view === 'all' ? 'is-active' : ''} onClick={() => setView('all')}>All</button>
              <button type="button" className={view === 'recent' ? 'is-active' : ''} onClick={() => setView('recent')}>Recent</button>
              <button type="button" className={view === 'most_used' ? 'is-active' : ''} onClick={() => setView('most_used')}>Most used</button>
              <button type="button" className={view === 'favorites' ? 'is-active' : ''} onClick={() => setView('favorites')}>★ Favorites</button>
            </div>
          </div>
          {view === 'all' ? (
            <div className="tag-picker__list" onScroll={handleBrowserListScroll}>
              {visibleBrowserItems.length === 0 && (
                <div className="tag-picker__empty">No open tabs or history{domainSuffix ? ` match${domainSuffix}` : ''}</div>
              )}
              {visibleBrowserItems.map((item) => (
                <PickerRow
                  key={item.key}
                  title={item.title}
                  url={item.url}
                  isFavorite={isLabelFavorited(item.title)}
                  onPick={() => handlePickBrowserEntry(item.title, item.url)}
                  onToggleFavorite={() => handleToggleFavoriteForEntry(item.title, item.url)}
                />
              ))}
            </div>
          ) : (
            <div className="tag-picker__list">
              {visible.length === 0 && <div className="tag-picker__empty">No matching tags — Start will use this as a plain title</div>}
              {visible.map((tag) => <PickerRow key={tag.id} title={tag.label} url={tag.targetUrl ?? undefined} isFavorite={tag.isFavorite} onPick={() => { onPickTag(tag); setOpen(false) }} onToggleFavorite={() => handleToggleFavorite(tag.id)} />)}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

const DEFAULT_CUSTOM_LOG_HOURS = '0'
const DEFAULT_CUSTOM_LOG_MINUTES = '15'

export function StartTimerForm({ onStart, onCreateCustomLog }: StartTimerFormProps): JSX.Element {
  const [text, setText] = useState('')
  const [pickedTag, setPickedTag] = useState<TagPickerEntry | null>(null)
  const [customLogOpen, setCustomLogOpen] = useState(false)
  const [customLogHours, setCustomLogHours] = useState(DEFAULT_CUSTOM_LOG_HOURS)
  const [customLogMinutes, setCustomLogMinutes] = useState(DEFAULT_CUSTOM_LOG_MINUTES)
  const customLogRef = useRef<HTMLDivElement>(null)
  const defaultTitlePreview = formatDefaultTimerTitle(Date.now())

  const totalCustomLogMinutes = Math.round((Number(customLogHours) || 0) * 60 + (Number(customLogMinutes) || 0))
  const isCustomLogDurationValid = totalCustomLogMinutes >= 1 && totalCustomLogMinutes <= 24 * 60

  useEffect(() => {
    if (!customLogOpen) return
    function handleOutsideMouseDown(event: MouseEvent): void {
      if (customLogRef.current && !customLogRef.current.contains(event.target as Node)) setCustomLogOpen(false)
    }
    document.addEventListener('mousedown', handleOutsideMouseDown)
    return () => document.removeEventListener('mousedown', handleOutsideMouseDown)
  }, [customLogOpen])

  function handleChange(newText: string): void {
    setText(newText)
    if (pickedTag && newText !== pickedTag.label) setPickedTag(null)
  }

  function handlePickTag(tag: TagPickerEntry): void {
    setText(tag.label)
    setPickedTag(tag)
  }

  function currentValue(): StartTimerFormValue {
    return { title: pickedTag ? pickedTag.label : text.trim() || undefined, tagLabel: pickedTag ? pickedTag.label : undefined }
  }

  function handleSubmit(event: React.FormEvent): void {
    event.preventDefault()
    onStart(currentValue())
    setText('')
    setPickedTag(null)
  }

  function handleCreateCustomLog(): void {
    if (!isCustomLogDurationValid) return
    onCreateCustomLog(currentValue(), totalCustomLogMinutes)
    setText('')
    setPickedTag(null)
    setCustomLogHours(DEFAULT_CUSTOM_LOG_HOURS)
    setCustomLogMinutes(DEFAULT_CUSTOM_LOG_MINUTES)
    setCustomLogOpen(false)
  }

  function handleCustomLogKeyDown(event: React.KeyboardEvent): void {
    if (event.key === 'Enter') {
      event.preventDefault()
      handleCreateCustomLog()
    } else if (event.key === 'Escape') {
      setCustomLogOpen(false)
    }
  }

  return (
    <form className="start-timer-form" onSubmit={handleSubmit}>
      <TagPicker value={text} onChange={handleChange} onPickTag={handlePickTag} placeholder={`Plain title (e.g. ${defaultTitlePreview}) or pick a tag…`} />
      <button type="submit" className="icon-button icon-button--add" aria-label="Start timer"><PlusIcon /></button>
      <div className="custom-log-popover-wrapper" ref={customLogRef}>
        <button
          type="button"
          className="icon-button icon-button--custom-log"
          onClick={() => setCustomLogOpen((open) => !open)}
          aria-label="Log custom duration"
          title="Log custom duration — uses the title/tag above"
        >
          <ClockPlusIcon />
        </button>
        {customLogOpen && (
          <div className="custom-log-popover" onKeyDown={handleCustomLogKeyDown}>
            <div className="custom-log-popover__fields">
              <label>
                <input
                  type="number"
                  value={customLogHours}
                  onChange={(event) => setCustomLogHours(event.target.value)}
                  min={0}
                  max={24}
                  step={1}
                  autoFocus
                />
                h
              </label>
              <label>
                <input
                  type="number"
                  value={customLogMinutes}
                  onChange={(event) => setCustomLogMinutes(event.target.value)}
                  min={0}
                  max={59}
                  step={1}
                />
                m
              </label>
            </div>
            <button
              type="button"
              className="icon-button icon-button--add custom-log-popover__submit"
              onClick={handleCreateCustomLog}
              disabled={!isCustomLogDurationValid}
              aria-label="Confirm custom log"
            >
              Log
            </button>
          </div>
        )}
      </div>
    </form>
  )
}