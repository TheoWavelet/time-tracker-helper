import type { StartTimerInput, TimersSnapshot } from '@shared/types';
declare const api: {
    timers: {
        getSnapshot: () => Promise<TimersSnapshot>;
        start: (input: StartTimerInput) => Promise<any>;
        pause: (id: string) => Promise<any>;
        resume: (id: string) => Promise<any>;
        stop: (id: string) => Promise<any>;
        submit: (id: string, tagLabel: string) => Promise<any>;
        discard: (id: string) => Promise<any>;
        onChanged: (callback: (snapshot: TimersSnapshot) => void) => (() => void);
    };
    overlay: {
        setExpanded: (expanded: boolean) => Promise<boolean>;
    };
};
export type OverlayApi = typeof api;
export {};
