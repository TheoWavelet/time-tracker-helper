export type TimerKind = 'one_off' | 'persistent'

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
  /** UI-only reason a paused timer isn't running: did the user pause it, or did another timer take over? */
  pausedReason: 'manual' | 'switched' | null
  switchedToTitle: string | null
  createdAt: number
  updatedAt: number
}

export interface TagDTO {
  id: string
  label: string
  targetUrl: string | null
  isFavorite: boolean
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

export type DockSide = 'left' | 'right'

export interface AppSettings {
  dockSide: DockSide
  /** Vertical pixel offset from the display's work-area top, for the dragged bar position. null = auto-centered. */
  dockYOffset: number | null
}
