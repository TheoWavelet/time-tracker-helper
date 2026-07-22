import type { TimerDTO, TimerKind } from '@shared/types';
export declare function listTimers(): TimerDTO[];
export declare function findRunningTimer(): TimerDTO | null;
export declare function findTimerById(id: string): TimerDTO | null;
export interface InsertTimerInput {
    id: string;
    title: string;
    kind: TimerKind;
    tagId: string | null;
    startedAt: number;
}
export declare function insertTimer(input: InsertTimerInput): void;
export declare function pauseTimerRow(id: string, reason: 'manual' | 'switched', switchedToTitle: string | null): void;
export declare function resumeTimerRow(id: string): void;
export declare function stopTimerRow(id: string): void;
export declare function submitTimerRow(id: string, tagId: string): void;
export declare function discardTimerRow(id: string): void;
export declare function updateTimerTitle(id: string, title: string): void;
export declare function assignTimerTag(id: string, tagId: string | null): void;
