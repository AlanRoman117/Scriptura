import { downloadPercent, formatBytes } from '../../apps/reader/src/lib/units';

/**
 * The arithmetic behind the library's progress and size labels.
 *
 * Pinned here rather than only in the browser because the interesting cases —
 * a gzipped response whose Content-Length is smaller than the bytes that
 * actually arrive, an unknown total — are precisely the ones a happy-path
 * download over localhost never produces.
 */

describe('downloadPercent', () => {
  test('reports the ratio', () => {
    expect(downloadPercent(0, 100)).toBe(0);
    expect(downloadPercent(25, 100)).toBe(25);
    expect(downloadPercent(100, 100)).toBe(100);
  });

  test('never exceeds 100, however wrong the denominator', () => {
    // Content-Length on a gzipped response is the compressed size, while the
    // body yields decompressed bytes — roughly 4x more here.
    expect(downloadPercent(5_000_000, 1_260_000)).toBe(100);
  });

  test('an unknown total reports nothing rather than NaN', () => {
    expect(downloadPercent(1000, 0)).toBe(0);
    expect(downloadPercent(0, 0)).toBe(0);
  });
});

describe('formatBytes', () => {
  test('reads in the units a person thinks in', () => {
    expect(formatBytes(6 * 1048576)).toBe('6.0 MB');
    expect(formatBytes(2 * 1024 * 1048576)).toBe('2.0 GB');
  });

  test('nothing is an em dash, not "0.0 MB"', () => {
    expect(formatBytes(0)).toBe('—');
  });
});
