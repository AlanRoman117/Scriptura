/**
 * Gesture arithmetic, kept free of the DOM and of imports so jest can check it.
 *
 * The drags themselves live in components; what a drag *means* — where a
 * released sheet should come to rest, where a zoom should be anchored — lives
 * here, where a test can state it exactly.
 */

export type SheetPosition = 'peek' | 'half' | 'full';

export const SHEET_ORDER: readonly SheetPosition[] = ['peek', 'half', 'full'];

export interface SheetSizes {
  peek: number;
  half: number;
  full: number;
}

/**
 * Below this speed (px/ms) a released sheet settles at the nearest position;
 * above it, the release is a fling and the sheet goes on to the next position
 * in the direction it was travelling. Half a pixel a millisecond is a
 * deliberate flick, not a drag that stopped.
 */
export const FLING_SPEED = 0.5;

/** Presses that move less than this are taps, and are left to the click. */
export const TAP_SLOP = 8;

/**
 * Where a released sheet comes to rest.
 *
 * `height` is the sheet's height at release; `velocity` is px/ms, positive
 * when the sheet was growing (the finger moving up). A slow release goes to
 * the nearest position; a fling goes to the next position beyond the current
 * height in the direction of travel, or stays at the end it was flung toward.
 */
export function snapSheet(height: number, velocity: number, sizes: SheetSizes): SheetPosition {
  const stops = SHEET_ORDER.map((position) => ({ position, size: sizes[position] }));

  if (Math.abs(velocity) > FLING_SPEED) {
    if (velocity > 0) {
      return (stops.find((s) => s.size > height) ?? stops[stops.length - 1]).position;
    }
    return ([...stops].reverse().find((s) => s.size < height) ?? stops[0]).position;
  }

  return stops.reduce((best, s) => (Math.abs(s.size - height) < Math.abs(best.size - height) ? s : best)).position;
}

/** One step up or down the sheet's positions, stopping at either end. */
export function stepSheet(current: SheetPosition, direction: 1 | -1): SheetPosition {
  const at = SHEET_ORDER.indexOf(current);
  return SHEET_ORDER[Math.min(SHEET_ORDER.length - 1, Math.max(0, at + direction))];
}

/* ── The board's view: zoom and pan ──────────────────────────────────────── */

export interface Point {
  x: number;
  y: number;
}

/** How the plane is shown: `screen = board × zoom + pan`. */
export interface View {
  zoom: number;
  pan: Point;
}

/**
 * The zoom range, for every way of zooming. The wheel used to stop at 0.3 and
 * the buttons at 0.4, so a board zoomed out with one could not be reached
 * with the other.
 */
export const ZOOM_MIN = 0.3;
export const ZOOM_MAX = 2;

export const clampZoom = (zoom: number): number => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, zoom));

/**
 * Zoom to `next`, keeping the board point under `anchor` (screen coordinates,
 * relative to the frame) exactly where it is. Zooming towards anything but
 * what you are looking at loses it, which is the reason to zoom in at all.
 */
export function zoomAround(view: View, next: number, anchor: Point): View {
  const zoom = clampZoom(next);
  const board = { x: (anchor.x - view.pan.x) / view.zoom, y: (anchor.y - view.pan.y) / view.zoom };
  return { zoom, pan: { x: anchor.x - board.x * zoom, y: anchor.y - board.y * zoom } };
}

/** Where a two-finger pinch began. */
export interface PinchStart {
  view: View;
  /** Midpoint of the two fingers, relative to the frame. */
  mid: Point;
  /** Distance between them, > 0. */
  distance: number;
}

/**
 * The view for a pinch in progress: zoom by how far the fingers have spread,
 * and keep the board point that was under their starting midpoint under their
 * current midpoint — so moving both fingers together pans, and spreading them
 * zooms about the place they are touching.
 */
export function pinchView(start: PinchStart, mid: Point, distance: number): View {
  const zoom = clampZoom(start.view.zoom * (distance / start.distance));
  const board = {
    x: (start.mid.x - start.view.pan.x) / start.view.zoom,
    y: (start.mid.y - start.view.pan.y) / start.view.zoom,
  };
  return { zoom, pan: { x: mid.x - board.x * zoom, y: mid.y - board.y * zoom } };
}
