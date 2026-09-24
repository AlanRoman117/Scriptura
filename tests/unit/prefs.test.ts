import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { DEFAULT_LOCALE, LANGUAGE_TO_LOCALE, LOCALES, matchLocale } from '../../apps/reader/src/i18n/locales';
import {
  APPEARANCES,
  DEFAULT_PREFS,
  LEGACY_THEMES,
  MEASURE_VALUES,
  SPACING_VALUES,
  STORAGE_KEY,
  STYLES,
  STYLE_PAPER,
  loadPrefs,
  normalizePrefs,
  resolveLocale,
  savePrefs,
} from '../../apps/reader/src/lib/prefs';
import { readSheet, theme } from '../helpers/tokens';

/**
 * Display preferences: whatever is in storage, the app gets a valid object.
 *
 * The other half of this file guards the duplicate: index.html carries an
 * inline script that applies the same preferences before the stylesheet
 * resolves, and two copies of one truth drift unless something reads both.
 */

const INDEX = fileURLToPath(new URL('../../apps/reader/index.html', import.meta.url));
const STYLESHEET = fileURLToPath(new URL('../../apps/reader/src/styles.css', import.meta.url));

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

  test('the language is one of ours, or the device’s', () => {
    expect(normalizePrefs({}).language).toBe('system');
    expect(normalizePrefs({ language: 'es-MX' }).language).toBe('es-MX');
    // Canonical case only: this is the value that becomes the page's lang.
    expect(normalizePrefs({ language: 'es-mx' }).language).toBe('system');
    expect(normalizePrefs({ language: 'de-DE' }).language).toBe('system');
  });

  test('markers is only ever a real boolean true', () => {
    expect(normalizePrefs({ markers: 'true' }).markers).toBe(false);
    expect(normalizePrefs({ markers: 1 }).markers).toBe(false);
  });

  /**
   * The preference was one `theme` before it was a style and an appearance.
   * A reader who chose high contrast, dark, keeps it.
   */
  test.each(Object.entries(LEGACY_THEMES))('a stored theme %s becomes %j', (old, [style, appearance]) => {
    expect(normalizePrefs({ theme: old })).toEqual({ ...DEFAULT_PREFS, style, appearance });
  });

  test('a stored style and appearance win over an old theme', () => {
    expect(normalizePrefs({ theme: 'hc-dark', style: 'sepia', appearance: 'light' })).toMatchObject({ style: 'sepia', appearance: 'light' });
    expect(normalizePrefs({ theme: 'hc-dark', appearance: 'system' })).toMatchObject({ style: 'contrast', appearance: 'system' });
    // An unknown new value falls back to what the old theme meant.
    expect(normalizePrefs({ theme: 'hc-dark', style: 'neon' })).toMatchObject({ style: 'contrast', appearance: 'dark' });
  });
});

describe('STYLE_PAPER', () => {
  const sheet = readSheet(readFileSync(STYLESHEET, 'utf8'));
  test.each([...STYLES])('%s is the paper its palette paints, light and dark', (style) => {
    for (const scheme of ['light', 'dark'] as const) {
      expect(theme(sheet, style, scheme).color('--paper')).toBe(STYLE_PAPER[style][scheme]);
    }
  });

  test('every style has a palette and every palette a style', () => {
    const palettes = [...sheet.palettes.keys()].filter((name) => !name.endsWith('-auto')).sort();
    expect(palettes).toEqual([...STYLES].sort());
  });
});

describe('resolveLocale', () => {
  test('a chosen language wins over the device', () => {
    expect(resolveLocale('ja-JP', ['es-MX'])).toBe('ja-JP');
  });

  test('otherwise the device decides, and nothing we have means English', () => {
    expect(resolveLocale('system', ['es-AR', 'en-US'])).toBe('es-MX');
    expect(resolveLocale('system', ['de-DE'])).toBe('en-US');
    expect(resolveLocale('system', [])).toBe('en-US');
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
    const prefs = { ...DEFAULT_PREFS, style: 'sepia' as const, appearance: 'dark' as const, textSize: 175 as const, spacing: 'loose' as const };
    savePrefs(prefs);
    expect(loadPrefs()).toEqual(prefs);
  });
});

describe('the inline script in index.html agrees with the module', () => {
  const html = readFileSync(INDEX, 'utf8');
  const script = html.slice(html.indexOf('<script>'), html.indexOf('</script>'));

  test('same storage key and attribute names', () => {
    expect(script).toContain(`'${STORAGE_KEY}'`);
    for (const attr of ['data-style', 'data-appearance', 'data-motion', 'data-markers']) expect(script).toContain(`'${attr}'`);
  });

  test('same custom properties', () => {
    for (const prop of ['--text-scale', '--reading-leading', '--verse-gap', '--measure']) {
      expect(script).toContain(`'${prop}'`);
    }
  });

  test('same papers, spacing and measure values', () => {
    for (const [style, { light, dark }] of Object.entries(STYLE_PAPER)) expect(script).toContain(`${style}: ['${light}', '${dark}']`);
    for (const { leading, gap } of Object.values(SPACING_VALUES)) {
      expect(script).toContain(`'${leading}'`);
      expect(script).toContain(`'${gap}'`);
    }
    for (const m of Object.values(MEASURE_VALUES)) expect(script).toContain(`'${m}'`);
  });

  test('same languages, resolved the same way', () => {
    expect(script).toContain("setAttribute('lang'");
    expect(script).toContain('p.language');
    expect(script).toContain('navigator.languages');
    for (const locale of LOCALES) expect(script).toContain(`'${locale}'`);
    for (const [language, locale] of Object.entries(LANGUAGE_TO_LOCALE)) {
      expect(script).toContain(`${language}: '${locale}'`);
    }
    expect(script).toContain(`lang || '${DEFAULT_LOCALE}'`);
    // The page carries a real tag even if the script never runs.
    expect(html).toContain(`<html lang="${DEFAULT_LOCALE}">`);
  });

  /**
   * The script, run against stubs: the two are compared by what they do, not
   * by what they contain. Chinese is why this is worth the machinery — the
   * script chooses a script subtag from a region, and no amount of reading the
   * source as text says whether it chooses the same one.
   */
  function runInline(languages: string[], stored: Record<string, unknown> = {}) {
    const attrs = new Map<string, string>();
    const root = {
      setAttribute: (name: string, value: string) => void attrs.set(name, value),
      style: { setProperty: () => {} },
    };
    const metas = [
      { media: '(prefers-color-scheme: light)', content: '' },
      { media: '(prefers-color-scheme: dark)', content: '' },
    ];
    const run = new Function(
      'localStorage',
      'document',
      'navigator',
      script.replace('<script>', '')
    ) as (l: unknown, d: unknown, n: unknown) => void;
    run(
      { getItem: (key: string) => (key === STORAGE_KEY ? JSON.stringify(stored) : null) },
      { documentElement: root, querySelectorAll: () => metas },
      { languages, language: languages[0] ?? '' }
    );
    return { attrs, metas: metas.map((m) => m.content) };
  }
  const inlineLang = (languages: string[], stored: Record<string, unknown> = {}) =>
    runInline(languages, stored).attrs.get('lang') ?? '';

  /** What lib/prefs.ts writes for the same stored value. */
  function moduleWrites(stored: Record<string, unknown>) {
    const { style, appearance } = normalizePrefs(stored);
    const paper = (own: 'light' | 'dark') => STYLE_PAPER[style][appearance === 'system' ? own : appearance];
    return {
      style: style === 'classic' ? undefined : style,
      appearance: appearance === 'system' ? undefined : appearance,
      metas: [paper('light'), paper('dark')],
    };
  }

  test.each([
    {},
    ...Object.keys(LEGACY_THEMES).map((old) => ({ theme: old })),
    ...STYLES.flatMap((style) => APPEARANCES.map((appearance) => ({ style, appearance }))),
    { theme: 'hc-dark', style: 'neon' },
    { theme: 'neon', appearance: 'dusk' },
  ])('the script writes the same style, appearance and theme-color as the module for %j', (stored) => {
    const { attrs, metas } = runInline(['en-US'], stored);
    const want = moduleWrites(stored);
    expect(attrs.get('data-style')).toBe(want.style);
    expect(attrs.get('data-appearance')).toBe(want.appearance);
    expect(metas).toEqual(want.metas);
  });

  test.each([
    [['en-US']],
    [['pt-BR']],
    [['pt-PT']],
    [['zh']],
    [['zh-CN']],
    [['zh-SG']],
    [['zh-TW']],
    [['zh-HK']],
    [['zh-MO']],
    [['zh-Hant']],
    [['zh-Hans-CN']],
    [['ZH-hant-tw']],
    [['zh-CHT']],
    [['de-DE', 'zh-TW']],
    [['de-DE']],
    [[]],
  ])('the script resolves %j to the same language as matchLocale', (languages) => {
    expect(inlineLang(languages)).toBe(matchLocale(languages));
  });

  test('a chosen language still wins in the script', () => {
    expect(inlineLang(['zh-TW'], { language: 'pt-BR' })).toBe(resolveLocale('pt-BR', ['zh-TW']));
    // And one we do not have is ignored rather than written to the page.
    expect(inlineLang(['zh-TW'], { language: 'ko-KR' })).toBe(matchLocale(['zh-TW']));
  });

  test('the metas the script updates exist, one per scheme', () => {
    expect(html.match(/<meta name="theme-color"/g)).toHaveLength(2);
    expect(html).toContain('media="(prefers-color-scheme: light)"');
    expect(html).toContain('media="(prefers-color-scheme: dark)"');
  });
});
