import {
  FLING_SPEED,
  ZOOM_MAX,
  ZOOM_MIN,
  clampZoom,
  pinchView,
  snapSheet,
  stepSheet,
  zoomAround,
  type SheetSizes,
  type View,
} from '../../apps/reader/src/lib/geometry';

/**
 * Where a released notes sheet comes to rest. The sizes are a Pixel 7 at
 * rest: a 52px grip, half of an 839px visual viewport, and 92% of it.
 */
const sizes: SheetSizes = { peek: 52, half: 419.5, full: 772 };

describe('snapSheet', () => {
  test('a slow release settles at the nearest position', () => {
    expect(snapSheet(60, 0, sizes)).toBe('peek');
    expect(snapSheet(300, 0.1, sizes)).toBe('half');
    expect(snapSheet(610, -0.2, sizes)).toBe('full');
  });

  test('a fling upward goes on to the next position above', () => {
    // Nearest would be peek; the flick says "open".
    expect(snapSheet(120, FLING_SPEED + 0.1, sizes)).toBe('half');
    expect(snapSheet(430, 2, sizes)).toBe('full');
  });

  test('a fling downward goes on to the next position below', () => {
    expect(snapSheet(700, -(FLING_SPEED + 0.1), sizes)).toBe('half');
    expect(snapSheet(400, -3, sizes)).toBe('peek');
  });

  test('a fling past either end stays at that end', () => {
    expect(snapSheet(780, 5, sizes)).toBe('full');
    expect(snapSheet(40, -5, sizes)).toBe('peek');
  });
});

describe('stepSheet', () => {
  test('arrow keys step one position and stop at the ends', () => {
    expect(stepSheet('peek', 1)).toBe('half');
    expect(stepSheet('half', 1)).toBe('full');
    expect(stepSheet('full', 1)).toBe('full');
    expect(stepSheet('half', -1)).toBe('peek');
    expect(stepSheet('peek', -1)).toBe('peek');
  });
});


/** Where a board point lands on screen under a view. */
const onScreen = (view: View, board: { x: number; y: number }) => ({
  x: board.x * view.zoom + view.pan.x,
  y: board.y * view.zoom + view.pan.y,
});

describe('zoomAround', () => {
  const view: View = { zoom: 1, pan: { x: -120, y: 40 } };

  test('the board point under the anchor stays under it', () => {
    const anchor = { x: 300, y: 200 };
    const underAnchor = { x: (anchor.x - view.pan.x) / view.zoom, y: (anchor.y - view.pan.y) / view.zoom };
    for (const next of [0.5, 1.12, 1.8]) {
      const after = zoomAround(view, next, anchor);
      const landed = onScreen(after, underAnchor);
      expect(landed.x).toBeCloseTo(anchor.x, 9);
      expect(landed.y).toBeCloseTo(anchor.y, 9);
    }
  });

  test('zoom is clamped to one range for every way of zooming', () => {
    expect(zoomAround(view, 10, { x: 0, y: 0 }).zoom).toBe(ZOOM_MAX);
    expect(zoomAround(view, 0.01, { x: 0, y: 0 }).zoom).toBe(ZOOM_MIN);
    expect(clampZoom(0.4)).toBe(0.4);
    expect(ZOOM_MIN).toBe(0.3);
  });
});

describe('pinchView', () => {
  const start = { view: { zoom: 1, pan: { x: 0, y: 0 } }, mid: { x: 200, y: 150 }, distance: 100 };

  test('spreading the fingers to twice the distance doubles the zoom about the midpoint', () => {
    const after = pinchView(start, start.mid, 200);
    expect(after.zoom).toBe(2);
    const landed = onScreen(after, { x: 200, y: 150 });
    expect(landed.x).toBeCloseTo(200, 9);
    expect(landed.y).toBeCloseTo(150, 9);
  });

  test('moving both fingers together pans without zooming', () => {
    const after = pinchView(start, { x: 260, y: 110 }, 100);
    expect(after.zoom).toBe(1);
    expect(after.pan).toEqual({ x: 60, y: -40 });
  });

  test('a pinch is clamped like any other zoom', () => {
    expect(pinchView(start, start.mid, 10_000).zoom).toBe(ZOOM_MAX);
    expect(pinchView(start, start.mid, 1).zoom).toBe(ZOOM_MIN);
  });
});
