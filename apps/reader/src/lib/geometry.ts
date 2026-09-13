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
