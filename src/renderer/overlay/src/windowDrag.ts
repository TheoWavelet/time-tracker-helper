import type { MouseEvent as ReactMouseEvent } from 'react'

const CLICK_MOVEMENT_THRESHOLD_PX = 4

let dragInProgress = false

/**
 * Whether a drag is currently underway. Moving the window via setBounds mid-drag causes
 * Chromium to fire synthetic mouseenter/mouseleave on whatever element now sits under the
 * (physically stationary) cursor — hover-triggered actions should ignore those while dragging,
 * or a drag can spuriously trigger an expand/collapse it never intended.
 */
export function isWindowDragInProgress(): boolean {
  return dragInProgress
}

/**
 * Tells the main process to reposition the overlay window as the cursor moves, and — since the
 * transparent bar/rows need to be both draggable and clickable — decides on mouseup whether this
 * was a click or a drag, never on mousedown. `onClick` (if given) only fires when the cursor
 * never moved more than a few pixels from where the press started.
 *
 * Position updates ping main (throttled to once per animation frame); main computes the new
 * position itself from the OS cursor position directly (screen.getCursorScreenPoint()) as an
 * absolute offset from where the drag started. Deliberately NOT computed from this event's own
 * screenX/screenY: those can lag behind our own rapid setBounds calls and drift further the
 * longer a drag continues (surfaced as the window accelerating away from the cursor). The
 * click-vs-drag threshold below only uses screenY for a simple max-distance comparison, which
 * doesn't have that accumulation problem.
 */
export function startWindowDrag(event: ReactMouseEvent, onClick?: () => void): void {
  event.preventDefault()
  dragInProgress = true
  window.api.overlay.dragStart()

  const startScreenY = event.screenY
  let maxMovement = 0
  let frameRequested = false

  function onMouseMove(moveEvent: MouseEvent): void {
    maxMovement = Math.max(maxMovement, Math.abs(moveEvent.screenY - startScreenY))
    // Stay a no-op for anything that might still turn out to be a click — even a "successful"
    // click involves a pixel or two of natural jitter, and moving the window for that (however
    // slightly) before the click handler runs reads as "toggling nudges the window." Since main
    // computes position as an absolute offset from the original mousedown anchor (not from
    // wherever we happen to start pinging), waiting to cross the threshold before the first
    // ping causes no jump/catch-up once a real drag is confirmed.
    if (maxMovement < CLICK_MOVEMENT_THRESHOLD_PX) return
    if (frameRequested) return
    frameRequested = true
    requestAnimationFrame(() => {
      frameRequested = false
      window.api.overlay.dragMove()
    })
  }

  function onMouseUp(): void {
    dragInProgress = false
    window.api.overlay.dragEnd()
    window.removeEventListener('mousemove', onMouseMove)
    window.removeEventListener('mouseup', onMouseUp)
    if (onClick && maxMovement < CLICK_MOVEMENT_THRESHOLD_PX) onClick()
  }

  window.addEventListener('mousemove', onMouseMove)
  window.addEventListener('mouseup', onMouseUp)
}
