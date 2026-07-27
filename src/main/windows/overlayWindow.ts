import path from 'node:path'
import { BrowserWindow, ipcMain, screen } from 'electron'
import { getSettings, setDockYOffset } from '../settingsStore'
import type { DockSide } from '@shared/types'

const BAR_WIDTH = 88
const BAR_WIDE_WIDTH = BAR_WIDTH * 4
const BAR_ROW_HEIGHT = 44
const SEE_MORE_HEIGHT = 36
const PANEL_SIZE = { width: 320, height: 440 }
const EDGE_MARGIN = 8
const MOVE_SAVE_DEBOUNCE_MS = 300
const RESIZE_ANIMATION_MS = 140
const RESIZE_ANIMATION_STEP_MS = 8

let overlayWindow: BrowserWindow | null = null
let expanded = false
let barWide = false
let activeTimerCount = 0
let moveSaveTimer: NodeJS.Timeout | null = null
let dragActive = false
let dragAnchorCursorY = 0
let dragAnchorWindowY = 0
let resizeAnimationTimer: NodeJS.Timeout | null = null

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3)
}

/**
 * Windows' `setBounds()` has no built-in animation (unlike macOS), so this steps toward the
 * target itself. Restarting from the window's CURRENT bounds (not the previous target) means an
 * interrupted animation — e.g. a hover flipping again mid-transition — redirects smoothly instead
 * of snapping back to where the last animation started.
 */
function animateBoundsTo(target: { x: number; y: number; width: number; height: number }): void {
  if (!overlayWindow || overlayWindow.isDestroyed()) return
  if (resizeAnimationTimer) {
    clearInterval(resizeAnimationTimer)
    resizeAnimationTimer = null
  }

  const start = overlayWindow.getBounds()
  const startedAt = Date.now()

  resizeAnimationTimer = setInterval(() => {
    if (!overlayWindow || overlayWindow.isDestroyed()) {
      if (resizeAnimationTimer) clearInterval(resizeAnimationTimer)
      resizeAnimationTimer = null
      return
    }
    const t = Math.min(1, (Date.now() - startedAt) / RESIZE_ANIMATION_MS)
    const eased = easeOutCubic(t)
    overlayWindow.setBounds({
      x: Math.round(start.x + (target.x - start.x) * eased),
      y: Math.round(start.y + (target.y - start.y) * eased),
      width: Math.round(start.width + (target.width - start.width) * eased),
      height: Math.round(start.height + (target.height - start.height) * eased)
    })
    if (t >= 1 && resizeAnimationTimer) {
      clearInterval(resizeAnimationTimer)
      resizeAnimationTimer = null
    }
  }, RESIZE_ANIMATION_STEP_MS)
}

function collapsedHeight(workAreaHeight: number): number {
  const rowCount = Math.max(1, activeTimerCount)
  // +1px per divider between rows (.bar-row + .bar-row's border-top) — otherwise each border
  // eats into the flex-shrink:0 rows' own box and the stack overflows by a few px, letting the
  // "see more" arrow visually clip the bottom of the last row.
  const desired = BAR_ROW_HEIGHT * rowCount + Math.max(0, rowCount - 1) + SEE_MORE_HEIGHT
  return Math.min(desired, workAreaHeight - 2 * EDGE_MARGIN)
}

function currentSize(workAreaHeight: number, isExpanded: boolean): { width: number; height: number } {
  if (isExpanded) return PANEL_SIZE
  return { width: barWide ? BAR_WIDE_WIDTH : BAR_WIDTH, height: collapsedHeight(workAreaHeight) }
}

function xForDockSide(dockSide: DockSide, workAreaX: number, workAreaWidth: number, width: number): number {
  return dockSide === 'left' ? workAreaX + EDGE_MARGIN : workAreaX + workAreaWidth - width - EDGE_MARGIN
}

function computeBounds(
  dockSide: DockSide,
  isExpanded: boolean,
  dockYOffset: number | null
): { x: number; y: number; width: number; height: number } {
  const display = screen.getPrimaryDisplay()
  const { x: wx, y: wy, width: ww, height: wh } = display.workArea
  const size = currentSize(wh, isExpanded)
  const x = xForDockSide(dockSide, wx, ww, size.width)
  const y =
    dockYOffset != null
      ? clamp(wy + dockYOffset, wy, wy + wh - size.height)
      : wy + Math.round((wh - size.height) / 2)
  return { x, y, width: size.width, height: size.height }
}

function repositionOverlay(): void {
  if (!overlayWindow || overlayWindow.isDestroyed()) return
  const { dockSide, dockYOffset } = getSettings()
  const target = computeBounds(dockSide, expanded, dockYOffset)
  // Never animate while the user is actively dragging — dragUpdate() already drives bounds
  // directly every tick, and easing on top of that would just add lag behind the cursor.
  if (dragActive) {
    overlayWindow.setBounds(target)
    return
  }
  animateBoundsTo(target)
}

/** Debounced so a native drag (which fires 'move' continuously) doesn't hammer disk writes. */
function scheduleSaveOfDraggedPosition(): void {
  if (expanded || !overlayWindow || overlayWindow.isDestroyed()) return
  if (moveSaveTimer) clearTimeout(moveSaveTimer)
  moveSaveTimer = setTimeout(() => {
    if (!overlayWindow || overlayWindow.isDestroyed()) return
    const { y: wy } = screen.getPrimaryDisplay().workArea
    setDockYOffset(overlayWindow.getBounds().y - wy)
  }, MOVE_SAVE_DEBOUNCE_MS)
}

export function createOverlayWindow(): BrowserWindow {
  if (overlayWindow && !overlayWindow.isDestroyed()) return overlayWindow

  const { dockSide, dockYOffset } = getSettings()
  const bounds = computeBounds(dockSide, false, dockYOffset)

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
  })

  overlayWindow.setAlwaysOnTop(true, 'screen-saver')

  overlayWindow.on('ready-to-show', () => overlayWindow?.show())
  overlayWindow.on('move', scheduleSaveOfDraggedPosition)

  if (process.env['ELECTRON_RENDERER_URL']) {
    overlayWindow.loadURL(`${process.env['ELECTRON_RENDERER_URL']}/overlay/`)
  } else {
    overlayWindow.loadFile(path.join(__dirname, '../renderer/overlay/index.html'))
  }

  screen.on('display-metrics-changed', repositionOverlay)
  screen.on('display-added', repositionOverlay)
  screen.on('display-removed', repositionOverlay)

  return overlayWindow
}

export function setOverlayExpanded(next: boolean): void {
  expanded = next
  barWide = false // only ever meant to apply while hovering the collapsed bar
  repositionOverlay()
}

export function applyDockSide(_dockSide: DockSide): void {
  repositionOverlay()
}

/** Grows/shrinks the collapsed bar to fit one row per running/paused timer. */
export function setActiveTimerCount(count: number): void {
  if (count === activeTimerCount) return
  activeTimerCount = count
  repositionOverlay()
}

/** Widens the collapsed bar (roughly doubling it) so timer titles have room, while hovering it. */
export function setBarWide(wide: boolean): void {
  if (wide === barWide || expanded) return
  barWide = wide
  repositionOverlay()
}

function dragStart(): void {
  if (!overlayWindow || overlayWindow.isDestroyed()) return
  if (resizeAnimationTimer) {
    clearInterval(resizeAnimationTimer)
    resizeAnimationTimer = null
  }
  dragActive = true
  dragAnchorCursorY = screen.getCursorScreenPoint().y
  dragAnchorWindowY = overlayWindow.getBounds().y
}

/**
 * Computed as an absolute offset from the drag's start point every time — never by chaining
 * incremental deltas tick-to-tick — so nothing can accumulate/drift over the course of a drag.
 * Reads the cursor position directly from the OS (screen.getCursorScreenPoint()) rather than
 * trusting a renderer-supplied MouseEvent.screenY, which can lag behind our own setBounds calls.
 * x/width/height are likewise always re-derived from our own formulas, never trusted from a
 * prior getBounds() read, so a drag can't let the window's size drift either.
 */
function dragUpdate(): void {
  if (!dragActive || !overlayWindow || overlayWindow.isDestroyed()) return
  const { dockSide } = getSettings()
  const { x: wx, y: wy, width: ww, height: wh } = screen.getPrimaryDisplay().workArea
  const size = currentSize(wh, expanded)
  const x = xForDockSide(dockSide, wx, ww, size.width)
  const cursorY = screen.getCursorScreenPoint().y
  const newY = clamp(dragAnchorWindowY + (cursorY - dragAnchorCursorY), wy, wy + wh - size.height)
  overlayWindow.setBounds({ x, y: newY, width: size.width, height: size.height })
}

function dragEnd(): void {
  dragActive = false
}

export function registerOverlayIpc(): void {
  ipcMain.handle('overlay:setExpanded', (_event, next: boolean) => {
    setOverlayExpanded(next)
    return next
  })

  ipcMain.handle('overlay:setBarWide', (_event, wide: boolean) => {
    setBarWide(wide)
    return wide
  })

  // The resulting position is persisted automatically by the 'move' listener above.
  ipcMain.on('overlay:dragStart', () => dragStart())
  ipcMain.on('overlay:dragMove', () => dragUpdate())
  ipcMain.on('overlay:dragEnd', () => dragEnd())
}
