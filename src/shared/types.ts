export type TimerKind = 'one_off' | 'persistent' | 'custom_log'

export type TimerStatus = 'running' | 'paused' | 'stopped' | 'submitted' | 'discarded'

export interface TimerDTO {
  id: string
  title: string
  kind: TimerKind
  status: TimerStatus
  tagId: string | null
  tagLabel: string | null
  tagTargetUrl: string | null
  startedAt: number
  currentSegmentStartedAt: number | null
  accumulatedMs: number
  stoppedAt: number | null
  submittedAt: number | null
  discardedAt: number | null
  note: string | null
  /** UI-only reason a paused timer isn't running: manual pause, switched to another timer, or idle-auto-paused. */
  pausedReason: 'manual' | 'switched' | 'idle' | null
  switchedToTitle: string | null
  /** Set the first time the tag's link was opened from history — drives the "visited" tint. */
  linkOpenedAt: number | null
  /** User-ticked "I've logged this time somewhere proper" checkbox in history. */
  loggedConfirmedAt: number | null
  /** Set when deleted from history — soft-deleted into the archive rather than destroyed. */
  archivedAt: number | null
  /** Set once this timer's time was successfully mirrored to Clockwork — drives the "logged
   *  automatically" indicator in history. */
  clockworkLoggedAt: number | null
  createdAt: number
  updatedAt: number
}

export interface TagDTO {
  id: string
  label: string
  targetUrl: string | null
  isFavorite: boolean
  /** Auto-derived from targetUrl (e.g. ".../browse/SSP-13") — drives automatic Clockwork sync. */
  clockworkIssueKey: string | null
  createdAt: number
  updatedAt: number
}

/** A tag plus the usage stats needed to sort/filter it in the tag-or-title picker. */
export interface TagPickerEntry extends TagDTO {
  usageCount: number
  lastUsedAt: number | null
}

export interface TimersSnapshot {
  timers: TimerDTO[]
  runningTimerId: string | null
}

export interface StartTimerInput {
  title?: string
  /** All timers are 'persistent' (ongoing) going forward; this stays optional for old data/tests. */
  kind?: TimerKind
  tagLabel?: string
}

export interface CustomTimerLogInput {
  title?: string
  /** A manually entered, whole-minute duration for a completed time log. */
  durationMinutes: number
  tagLabel?: string
}

export type DockSide = 'left' | 'right'

/** Which browser history/tag links should force-open in. "chrome" just falls back to the OS
 *  default (there's no universally reliable "open in Chrome specifically" URI scheme); "edge"
 *  uses the microsoft-edge: deep-link scheme Windows registers for it. */
export type LinkBrowser = 'chrome' | 'edge'

export interface AppSettings {
  dockSide: DockSide
  /** Vertical pixel offset from the display's work-area top, for the dragged bar position. null = auto-centered. */
  dockYOffset: number | null
  /** When on, all active timers flash red whenever none of them are running (all paused, nothing tracking). */
  highlightPausedTimers: boolean
  /** When on, the overlay's "No timer running" bar flashes red whenever there are no timers in it at all. */
  highlightNoTimers: boolean
  /** When on, the collapsed overlay rests as a tiny colored dot instead of the timer bar, only
   *  widening back out after a deliberate hover dwell — toggled from the overlay panel itself. */
  overlayDotMode: boolean
  /** Substring match against tab/page URLs — restricts both open tabs and history to this domain. Blank = no filter. */
  browserDomainFilter: string
  /** Master on/off switch for the whole Clockwork integration — off by default even with a token set. */
  clockworkSyncEnabled: boolean
  /** Which browser to force-open history/tag links in — a user-picked default, not auto-detected. */
  defaultLinkBrowser: LinkBrowser
}

/** A currently-open browser tab, reported live by the paired browser extension, already domain-filtered. */
export interface OpenTabInfo {
  title: string
  url: string
  /** Chrome/Edge ~v121+ only — 0 on older versions, which just sorts last rather than erroring. */
  lastAccessed: number
}

/** A visited page matching the domain filter, reported by the paired browser extension. */
export interface DomainHistoryItem {
  title: string
  url: string
  lastVisitTime: number
}

export interface BrowserPairingInfo {
  token: string
  connected: boolean
}

export interface ClockworkStatus {
  hasToken: boolean
}

/** One day's slot in the current (Monday-start) week. */
export interface WeeklyStatsDay {
  label: string
  totalMs: number
  /** True for days later in the week than today — kept out of the daily-average denominator. */
  isFuture: boolean
}

export interface WeeklyStats {
  days: WeeklyStatsDay[]
  totalMs: number
  dailyAverageMs: number
}
