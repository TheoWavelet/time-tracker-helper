import type { AppSettings, DockSide, StartTimerInput, TagDTO, TimerKind, TimersSnapshot } from '@shared/types';
declare const api: {
    timers: {
        getSnapshot: () => Promise<TimersSnapshot>;
        start: (input: StartTimerInput) => Promise<any>;
        pause: (id: string) => Promise<any>;
        resume: (id: string) => Promise<any>;
        stop: (id: string) => Promise<any>;
        submit: (id: string, tagLabel: string) => Promise<any>;
        discard: (id: string) => Promise<any>;
        updateTitle: (id: string, title: string) => Promise<any>;
        onChanged: (callback: (snapshot: TimersSnapshot) => void) => (() => void);
    };
    tags: {
        list: () => Promise<TagDTO[]>;
    };
    settings: {
        get: () => Promise<AppSettings>;
        setDockSide: (dockSide: DockSide) => Promise<AppSettings>;
    };
};
export type DashboardApi = typeof api;
export type { TimerKind };
