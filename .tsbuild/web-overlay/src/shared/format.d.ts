/** Live ticking display, e.g. "01:23:45" (or "12:34" under an hour). */
export declare function formatElapsedClock(ms: number): string;
/** Human summary for submitting/logging, e.g. "1h 2m" (rounded to the nearest minute). */
export declare function formatDurationHuman(ms: number): string;
export declare function formatDefaultTimerTitle(startedAt: number): string;
