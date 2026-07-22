import { useEffect, useRef, useState } from 'react'
import type { TagPickerEntry } from '@shared/types'

type SortBy = 'recent' | 'most_used'

interface TagPickerProps {
  value: string
  onChange: (text: string) => void
  onPickTag: (tag: TagPickerEntry) => void
  placeholder?: string
}

function sortTags(tags: TagPickerEntry[], sortBy: SortBy): TagPickerEntry[] {
  const sorted = [...tags]
  sorted.sort((a, b) =>
    sortBy === 'most_used'
      ? b.usageCount - a.usageCount || a.label.localeCompare(b.label)
      : (b.lastUsedAt ?? 0) - (a.lastUsedAt ?? 0) || a.label.localeCompare(b.label)
  )
  return sorted
}

/**
 * A single field that doubles as a plain-text title input and a tag autocomplete:
 * typing without picking a suggestion is just a title, picking one attaches that tag.
 * Note: only surfaces tags you've already used/favorited — showing open browser tabs
 * here depends on the companion browser extension, which doesn't exist yet.
 */
export function TagPicker({ value, onChange, onPickTag, placeholder }: TagPickerProps): JSX.Element {
  const [open, setOpen] = useState(false)
  const [sortBy, setSortBy] = useState<SortBy>('recent')
  const [favoritesOnly, setFavoritesOnly] = useState(false)
  const [allTags, setAllTags] = useState<TagPickerEntry[]>([])
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
  }

  const query = value.trim().toLowerCase()
  const filtered = allTags
    .filter((tag) => !favoritesOnly || tag.isFavorite)
    .filter((tag) => !query || tag.label.toLowerCase().includes(query) || tag.targetUrl?.toLowerCase().includes(query))
  const visible = sortTags(filtered, sortBy)

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
              <button type="button" className={sortBy === 'recent' ? 'is-active' : ''} onClick={() => setSortBy('recent')}>
                Recent
              </button>
              <button
                type="button"
                className={sortBy === 'most_used' ? 'is-active' : ''}
                onClick={() => setSortBy('most_used')}
              >
                Most used
              </button>
            </div>
            <div className="tag-picker__group">
              <button type="button" className={!favoritesOnly ? 'is-active' : ''} onClick={() => setFavoritesOnly(false)}>
                All
              </button>
              <button
                type="button"
                className={favoritesOnly ? 'is-active' : ''}
                onClick={() => setFavoritesOnly(true)}
              >
                ★ Favorites
              </button>
            </div>
          </div>
          <div className="tag-picker__list">
            {visible.length === 0 && (
              <div className="tag-picker__empty">No matching tags — Start will use this as a plain title</div>
            )}
            {visible.map((tag) => (
              <button
                key={tag.id}
                type="button"
                className="tag-picker__row"
                onClick={() => {
                  onPickTag(tag)
                  setOpen(false)
                }}
              >
                <span className="tag-picker__row-label">
                  {tag.isFavorite ? '★ ' : ''}
                  {tag.label}
                </span>
                {tag.targetUrl && <span className="tag-picker__row-url">{tag.targetUrl}</span>}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
