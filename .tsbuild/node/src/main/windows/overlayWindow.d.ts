import { BrowserWindow } from 'electron';
import type { DockSide } from '@shared/types';
export declare function createOverlayWindow(): BrowserWindow;
export declare function setOverlayExpanded(next: boolean): void;
export declare function applyDockSide(_dockSide: DockSide): void;
/** Grows/shrinks the collapsed bar to fit one row per running/paused timer. */
export declare function setActiveTimerCount(count: number): void;
export declare function registerOverlayIpc(): void;
