import { useEffect, useRef, useState } from 'react'
import type { DomainHistoryItem, OpenTabInfo, TagPickerEntry } from '@shared/types'

type PickerView = 'open' | 'recent' | 'most_used' | 'favorites' | 'history'

interface TagPickerProps {
  value: string
  onChange: (text: string) => void
  onPickTag: (tag: TagPickerEntry) => void
  placeholder?: string
}

function sortTags(tags: TagPickerEntry[], view: PickerView): TagPickerEntry[] {
  const sorted = [...tags]
  sorted.sort((a, b) =>
    view === 'most_used'
      ? b.usageCount - a.usageCount || a.label.localeCompare(b.label)
      : (b.lastUsedAt ?? 0) - (a.lastUsedAt ?? 0) || a.label.localeCompare(b.label)
  )
  return sorted
}

function matchesQuery(query: string, title: string, url: string): boolean {
  return !query || title.toLowerCase().includes(query) || url.toLowerCase().includes(query)
}

interface PickerRowProps {
  title: string
  url?: string
  isFavorite: boolean
  onPick: () => void
  onToggleFavorite: () => void
}

/** One row shape shared by every view — a pick button plus a favorite-star button, side by side. */
function PickerRow({ title, url, isFavorite, onPick, onToggleFavorite }: PickerRowProps): JSX.Element {
  return (
    <div className="tag-picker__row--tag">
      <button type="button" className="tag-picker__row-main" onClick={onPick}>
        <span className="tag-picker__row-label">{title}</span>
        {url && <span className="tag-picker__row-url">{url}</span>}
      </button>
      <button
        type="button"
        className={`tag-picker__favorite-btn${isFavorite ? ' is-favorite' : ''}`}
        onClick={(e) => {
          e.stopPropagation()
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

/**
 * A single field that doubles as a plain-text title input and a tag autocomplete: typing without
 * picking a suggestion is just a title, picking one attaches that tag. Exactly one of the five
 * views (Open/Recent/Most used/Favorites/History) is active at a time. The "Open" and "History"
 * views surface data from the paired browser extension (empty when it isn't paired — a normal
 * "no signal" case, not an error), both restricted to the `browserDomainFilter` setting
 * server-side before they ever get here. Every row, in every view, has a favorite-star button —
 * for browser-sourced rows that means find-or-creating the underlying tag on first favorite.
 */
export function TagPicker({ value, onChange, onPickTag, placeholder }: TagPickerProps): JSX.Element {
  const [open, setOpen] = useState(false)
  const [view, setView] = useState<PickerView>('open')
  const [allTags, setAllTags] = useState<TagPickerEntry[]>([])
  const [openTabs, setOpenTabs] = useState<OpenTabInfo[]>([])
  const [domainHistory, setDomainHistory] = useState<DomainHistoryItem[]>([])
  const [domainFilter, setDomainFilter] = useState('')
  const wrapperRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handleOutsideMouseDown(event: MouseEvent): void {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleOutsideMouseDown)
    return () => document.removeEventListener('mousedown', handleOutsideMouseDown)
  }, [open])

  // Bound to both focus and click so the dropdown reliably (re)opens whichever way the
  // input gains attention — e.g. clicking an input that already has focus wouldn't fire
  // a new focus event, but should still bring the list back up.
  function openDropdown(): void {
    setOpen(true)
    window.api.tags.listForPicker().then(setAllTags)
    window.api.browser.listOpenTabs().then(setOpenTabs)
    window.api.browser.searchHistoryByDomain().then(setDomainHistory)
    window.api.settings.get().then((settings) => setDomainFilter(settings.browserDomainFilter))
  }

  function upsertTag(tag: TagPickerEntry): void {
    setAllTags((prev) => (prev.some((t) => t.id === tag.id) ? prev.map((t) => (t.id === tag.id ? tag : t)) : [...prev, tag]))
  }

  /** A tag matching this label may not exist yet — treated as "not favorited" until it does. */
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

  return (
    <div className="tag-picker" ref={wrapperRef}>
      <input
        className="tag-picker__input"
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={openDropdown}
        onClick={openDropdown}
        onKeyDown={(e) => e.key === 'Escape' && setOpen(false)}
        placeholder={placeholder}
      />
      {open && (
        <div className="tag-picker__dropdown">
          <div className="tag-picker__header">
            <div className="tag-picker__group">
              <button type="button" className={view === 'open' ? 'is-active' : ''} onClick={() => setView('open')}>
                Open
              </button>
              <button type="button" className={view === 'recent' ? 'is-active' : ''} onClick={() => setView('recent')}>
                Recent
              </button>
              <button
                type="button"
                className={view === 'most_used' ? 'is-active' : ''}
                onClick={() => setView('most_used')}
              >
                Most used
              </button>
              <button
                type="button"
                className={view === 'favorites' ? 'is-active' : ''}
                onClick={() => setView('favorites')}
              >
                ★ Favorites
              </button>
              <button type="button" className={view === 'history' ? 'is-active' : ''} onClick={() => setView('history')}>
                History
              </button>
            </div>
          </div>
          {view === 'open' ? (
            <div className="tag-picker__list">
              {visibleTabs.length === 0 && (
                <div className="tag-picker__empty">No open tabs{domainSuffix ? ` match${domainSuffix}` : ''}</div>
              )}
              {visibleTabs.map((tab, index) => (
                <PickerRow
                  key={`${tab.url}-${index}`}
                  title={tab.title}
                  url={tab.url}
                  isFavorite={isLabelFavorited(tab.title)}
                  onPick={() => handlePickBrowserEntry(tab.title, tab.url)}
                  onToggleFavorite={() => handleToggleFavoriteForEntry(tab.title, tab.url)}
                />
              ))}
            </div>
          ) : view === 'history' ? (
            <div className="tag-picker__list">
              {visibleHistory.length === 0 && (
                <div className="tag-picker__empty">No history{domainSuffix ? ` matches${domainSuffix}` : ''}</div>
              )}
              {visibleHistory.map((item) => (
                <PickerRow
                  key={`${item.url}-${item.lastVisitTime}`}
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
              {visible.length === 0 && (
                <div className="tag-picker__empty">No matching tags — Start will use this as a plain title</div>
              )}
              {visible.map((tag) => (
                <PickerRow
                  key={tag.id}
                  title={tag.label}
                  url={tag.targetUrl ?? undefined}
                  isFavorite={tag.isFavorite}
                  onPick={() => {
                    onPickTag(tag)
                    setOpen(false)
                  }}
                  onToggleFavorite={() => handleToggleFavorite(tag.id)}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
