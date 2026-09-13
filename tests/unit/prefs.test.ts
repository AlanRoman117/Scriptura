import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  DEFAULT_PREFS,
  MEASURE_VALUES,
  SPACING_VALUES,
  STORAGE_KEY,
  THEME_PAPER,
  loadPrefs,
  normalizePrefs,
  savePrefs,
} from '../../apps/reader/src/lib/prefs';

/**
 * Display preferences: whatever is in storage, the app gets a valid object.
 *
 * The other half of this file guards the duplicate: index.html carries an
 * inline script that applies the same preferences before the stylesheet
 * resolves, and two copies of one truth drift unless something reads both.
 */

const INDEX = fileURLToPath(new URL('../../apps/reader/index.html', import.meta.url));

describe('normalizePrefs', () => {
  test('nothing stored means the defaults', () => {
    expect(normalizePrefs(undefined)).toEqual(DEFAULT_PREFS);
    expect(normalizePrefs(null)).toEqual(DEFAULT_PREFS);
    expect(normalizePrefs('garbage')).toEqual(DEFAULT_PREFS);
  });

  test('an unknown value falls back field by field, keeping the valid ones', () => {
    const out = normalizePrefs({ theme: 'neon', textSize: 150, spacing: 'huge', markers: true, motion: 'reduce' });
    expect(out).toEqual({ ...DEFAULT_PREFS, textSize: 150, markers: true, motion: 'reduce' });
  });

  test('a text size stored as a string still counts', () => {
    expect(normalizePrefs({ textSize: '125' }).textSize).toBe(125);
    expect(normalizePrefs({ textSize: 130 }).textSize).toBe(100);
  });

  test('markers is only ever a real boolean true', () => {
    expect(normalizePrefs({ markers: 'true' }).markers).toBe(false);
    expect(normalizePrefs({ markers: 1 }).markers).toBe(false);
  });
});

describe('loadPrefs and savePrefs', () => {
  const store = new Map<string, string>();
  const fake = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
  };

  afterEach(() => {
    store.clear();
    delete (globalThis as { localStorage?: unknown }).localStorage;
  });

  test('with no storage at all, the defaults come back rather than a throw', () => {
    delete (globalThis as { localStorage?: unknown }).localStorage;
    expect(loadPrefs()).toEqual(DEFAULT_PREFS);
  });

  test('malformed JSON is the defaults', () => {
    Object.defineProperty(globalThis, 'localStorage', { value: fake, configurable: true });
    store.set(STORAGE_KEY, '{not json');
    expect(loadPrefs()).toEqual(DEFAULT_PREFS);
  });

  test('a saved object round-trips', () => {
    Object.defineProperty(globalThis, 'localStorage', { value: fake, configurable: true });
    const prefs = { ...DEFAULT_PREFS, theme: 'sepia' as const, textSize: 175 as const, spacing: 'loose' as const };
    savePrefs(prefs);
    expect(loadPrefs()).toEqual(prefs);
  });
});

describe('the inline script in index.html agrees with the module', () => {
  const html = readFileSync(INDEX, 'utf8');
  const script = html.slice(html.indexOf('<script>'), html.indexOf('</script>'));

  test('same storage key and attribute names', () => {
    expect(script).toContain(`'${STORAGE_KEY}'`);
    for (const attr of ['data-theme', 'data-motion', 'data-markers']) expect(script).toContain(`'${attr}'`);
  });

  test('same custom properties', () => {
    for (const prop of ['--text-scale', '--reading-leading', '--verse-gap', '--measure']) {
      expect(script).toContain(`'${prop}'`);
    }
  });

  test('same theme colours, spacing and measure values', () => {
    for (const hex of Object.values(THEME_PAPER)) expect(script).toContain(hex);
    for (const { leading, gap } of Object.values(SPACING_VALUES)) {
      expect(script).toContain(`'${leading}'`);
      expect(script).toContain(`'${gap}'`);
    }
    for (const m of Object.values(MEASURE_VALUES)) expect(script).toContain(`'${m}'`);
  });

  test('the metas the script updates exist, one per scheme', () => {
    expect(html.match(/<meta name="theme-color"/g)).toHaveLength(2);
    expect(html).toContain('media="(prefers-color-scheme: light)"');
    expect(html).toContain('media="(prefers-color-scheme: dark)"');
  });
});
