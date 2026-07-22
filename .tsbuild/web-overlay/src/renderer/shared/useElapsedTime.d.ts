import type { TimerDTO } from '@shared/types';
/** Renderer-local ticking clock: never depends on IPC firing every second, just a timestamp diff. */
export declare function useElapsedMs(timer: TimerDTO | null | undefined): number;
