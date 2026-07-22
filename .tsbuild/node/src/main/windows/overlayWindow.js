import path from 'node:path';
import { BrowserWindow, ipcMain, screen } from 'electron';
import { getSettings, setDockYOffset } from '../settingsStore';
const BAR_WIDTH = 88;
const BAR_ROW_HEIGHT = 30;
const PANEL_SIZE = { width: 320, height: 440 };
const EDGE_MARGIN = 8;
const MOVE_SAVE_DEBOUNCE_MS = 300;
let overlayWindow = null;
let expanded = false;
let activeTimerCount = 0;
let moveSaveTimer = null;
function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}
function collapsedHeight(workAreaHeight) {
    const desired = BAR_ROW_HEIGHT * Math.max(1, activeTimerCount);
    return Math.min(desired, workAreaHeight - 2 * EDGE_MARGIN);
}
function computeBounds(dockSide, isExpanded, dockYOffset) {
    const display = screen.getPrimaryDisplay();
    const { x: wx, y: wy, width: ww, height: wh } = display.workArea;
    const size = isExpanded ? PANEL_SIZE : { width: BAR_WIDTH, height: collapsedHeight(wh) };
    const x = dockSide === 'left' ? wx + EDGE_MARGIN : wx + ww - size.width - EDGE_MARGIN;
    const y = dockYOffset != null
        ? clamp(wy + dockYOffset, wy, wy + wh - size.height)
        : wy + Math.round((wh - size.height) / 2);
    return { x, y, width: size.width, height: size.height };
}
function repositionOverlay() {
    if (!overlayWindow || overlayWindow.isDestroyed())
        return;
    const { dockSide, dockYOffset } = getSettings();
    overlayWindow.setBounds(computeBounds(dockSide, expanded, dockYOffset));
}
/** Debounced so a native drag (which fires 'move' continuously) doesn't hammer disk writes. */
function scheduleSaveOfDraggedPosition() {
    if (expanded || !overlayWindow || overlayWindow.isDestroyed())
        return;
    if (moveSaveTimer)
        clearTimeout(moveSaveTimer);
    moveSaveTimer = setTimeout(() => {
        if (!overlayWindow || overlayWindow.isDestroyed())
            return;
        const { y: wy } = screen.getPrimaryDisplay().workArea;
        setDockYOffset(overlayWindow.getBounds().y - wy);
    }, MOVE_SAVE_DEBOUNCE_MS);
}
export function createOverlayWindow() {
    if (overlayWindow && !overlayWindow.isDestroyed())
        return overlayWindow;
    const { dockSide, dockYOffset } = getSettings();
    const bounds = computeBounds(dockSide, false, dockYOffset);
    overlayWindow = new BrowserWindow({
        ...bounds,
        frame: false,
        transparent: true,
        resizable: false,
        movable: true,
        skipTaskbar: true,
        hasShadow: false,
        show: false,
        backgroundColor: '#00000000',
        webPreferences: {
            preload: path.join(__dirname, '../preload/overlay.js'),
            contextIsolation: true,
            nodeIntegration: false
        }
    });
    overlayWindow.setAlwaysOnTop(true, 'screen-saver');
    overlayWindow.on('ready-to-show', () => overlayWindow?.show());
    overlayWindow.on('move', scheduleSaveOfDraggedPosition);
    if (process.env['ELECTRON_RENDERER_URL']) {
        overlayWindow.loadURL(`${process.env['ELECTRON_RENDERER_URL']}/overlay/`);
    }
    else {
        overlayWindow.loadFile(path.join(__dirname, '../renderer/overlay/index.html'));
    }
    screen.on('display-metrics-changed', repositionOverlay);
    screen.on('display-added', repositionOverlay);
    screen.on('display-removed', repositionOverlay);
    return overlayWindow;
}
export function setOverlayExpanded(next) {
    expanded = next;
    repositionOverlay();
}
export function applyDockSide(_dockSide) {
    repositionOverlay();
}
/** Grows/shrinks the collapsed bar to fit one row per running/paused timer. */
export function setActiveTimerCount(count) {
    if (count === activeTimerCount)
        return;
    activeTimerCount = count;
    repositionOverlay();
}
export function registerOverlayIpc() {
    ipcMain.handle('overlay:setExpanded', (_event, next) => {
        setOverlayExpanded(next);
        return next;
    });
}
