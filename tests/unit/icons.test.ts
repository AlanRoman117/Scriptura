import { readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * The app's PNG icons, rendered from the SVG by
 * apps/reader/scripts/render-icons.mjs and committed so that a checkout
 * without a browser still builds. iOS takes only a PNG for the home screen,
 * and Android wants a maskable icon of its own (brief 94).
 */

const ICONS = fileURLToPath(new URL('../../apps/reader/public/icons/', import.meta.url));
const CONFIG = readFileSync(fileURLToPath(new URL('../../apps/reader/vite.config.ts', import.meta.url)), 'utf8');
const INDEX = readFileSync(fileURLToPath(new URL('../../apps/reader/index.html', import.meta.url)), 'utf8');

/** Width and height from a PNG's IHDR chunk: no image library needed. */
function pngSize(file: string): { width: number; height: number } {
  const bytes = readFileSync(ICONS + file);
  expect(bytes.subarray(0, 8)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  expect(bytes.subarray(12, 16).toString('ascii')).toBe('IHDR');
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

describe('the app icons', () => {
  test.each([
    ['icon-180.png', 180],
    ['icon-192.png', 192],
    ['icon-512.png', 512],
    ['icon-512-maskable.png', 512],
  ])('%s is a %i px square PNG, and small', (file, size) => {
    expect(pngSize(file)).toEqual({ width: size, height: size });
    // Binary files in a repository whose product is text: kept small.
    expect(statSync(ICONS + file).size).toBeLessThanOrEqual(20 * 1024);
  });

  test('the manifest names a maskable icon apart from the ones for any shape', () => {
    const entries = [...CONFIG.matchAll(/\{ src: '(icons\/[^']+)', sizes: '(\d+)x\d+', type: '([^']+)', purpose: '([^']+)' \}/g)];
    expect(entries.length).toBeGreaterThanOrEqual(3);
    for (const [, src, size, type, purpose] of entries) {
      // One icon claiming "any maskable" is either cropped or shows its corners.
      expect(purpose.split(' ')).toHaveLength(1);
      if (type === 'image/png') expect(pngSize(src.replace('icons/', ''))).toEqual({ width: Number(size), height: Number(size) });
    }
    expect(entries.map(([, , , , purpose]) => purpose)).toEqual(expect.arrayContaining(['any', 'maskable']));
  });

  test('index.html links the apple-touch-icon', () => {
    expect(INDEX).toMatch(/<link rel="apple-touch-icon" href="\/icons\/icon-180\.png" \/>/);
  });
});
