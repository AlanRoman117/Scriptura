import { FLING_SPEED, snapSheet, stepSheet, type SheetSizes } from '../../apps/reader/src/lib/geometry';

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
