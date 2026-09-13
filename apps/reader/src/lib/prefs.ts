/**
 * Display and accessibility preferences — how this device shows the text.
 *
 * Kept in `localStorage`, not in the IndexedDB stores, for the same reason the
 * assistant switch is: these describe *this device* — its screen, its user's
 * eyes — rather than the user's work, so they are neither exported nor
 * mirrored, and reading them synchronously means the first paint can already
 * honour them. `index.html` carries a tiny inline script that applies the same
 * values before any stylesheet resolves; `tests/unit/prefs.test.ts` asserts the
 * two agree on every name, because two copies of one truth drift.
 *
 * `system` is never written to the DOM. The `prefers-*` media queries are the
 * defaults, and an absent attribute is how the stylesheet knows to use them.
 *
 * ⚠️ No `import.meta` here: jest reaches this module, and `import.meta` is
 * exactly what it cannot evaluate under the test config (see lib/units.ts).
 */
import { useCallback, useState } from 'react';

export const THEMES = ['system', 'light', 'dark', 'hc-light', 'hc-dark', 'sepia'] as const;
export type Theme = (typeof THEMES)[number];

export const TEXT_SIZES = [100, 112, 125, 150, 175, 200] as const;
export type TextSize = (typeof TEXT_SIZES)[number];

export const SPACINGS = ['normal', 'relaxed', 'loose'] as const;
export type Spacing = (typeof SPACINGS)[number];

export const MEASURES = ['narrow', 'normal', 'wide'] as const;
export type Measure = (typeof MEASURES)[number];

export const MOTIONS = ['system', 'reduce'] as const;
export type Motion = (typeof MOTIONS)[number];

export interface DisplayPrefs {
  theme: Theme;
  textSize: TextSize;
  spacing: Spacing;
  measure: Measure;
  motion: Motion;
  /** Draw a glyph as well as a colour on every highlight (1.4.1). */
  markers: boolean;
}

export const DEFAULT_PREFS: DisplayPrefs = {
  theme: 'system',
  textSize: 100,
  spacing: 'normal',
  measure: 'normal',
  motion: 'system',
  markers: false,
};

/** The localStorage key. Mirrored in index.html's inline script. */
export const STORAGE_KEY = 'scriptura-display';

/**
 * Line height and the gap between verses, per preset.
 *
 * 1.4.8 asks for line spacing of at least 1.5 and paragraph spacing of at
 * least 1.5 × the *line spacing* — not the font size. A verse is a paragraph
 * here, so at a 1.9 leading the gap has to be 2.85em, which is generous by
 * design: the criterion exists for readers who lose their place between
 * lines. The default keeps the column's designed rhythm and does not claim
 * the rule; *relaxed* and *loose* meet it exactly (1.5 × 1.9 and 1.5 × 2.1).
 * The values are what the stylesheet's `--reading-leading` and `--verse-gap`
 * are set to.
 */
export const SPACING_VALUES: Record<Spacing, { leading: string; gap: string }> = {
  normal: { leading: '1.75', gap: '.85rem' },
  relaxed: { leading: '1.9', gap: '2.85em' },
  loose: { leading: '2.1', gap: '3.15em' },
};

/** Column width in `ch`. Never above 70: 1.4.8's ceiling is 80 characters. */
export const MEASURE_VALUES: Record<Measure, string> = {
  narrow: '56ch',
  normal: '64ch',
  wide: '70ch',
};

/** The browser-chrome colour for each pinned theme; `system` uses the metas' own media queries. */
export const THEME_PAPER: Record<Exclude<Theme, 'system'>, string> = {
  light: '#faf9f7',
  dark: '#171614',
  'hc-light': '#ffffff',
  'hc-dark': '#000000',
  sepia: '#f4ecd8',
};

const oneOf = <T extends readonly unknown[]>(values: T, v: unknown, fallback: T[number]): T[number] =>
  (values as readonly unknown[]).includes(v) ? (v as T[number]) : fallback;

/** Validate whatever was stored; anything unknown falls back field by field, never throws. */
export function normalizePrefs(raw: unknown): DisplayPrefs {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  return {
    theme: oneOf(THEMES, r.theme, DEFAULT_PREFS.theme),
    textSize: oneOf(TEXT_SIZES, Number(r.textSize), DEFAULT_PREFS.textSize),
    spacing: oneOf(SPACINGS, r.spacing, DEFAULT_PREFS.spacing),
    measure: oneOf(MEASURES, r.measure, DEFAULT_PREFS.measure),
    motion: oneOf(MOTIONS, r.motion, DEFAULT_PREFS.motion),
    markers: r.markers === true,
  };
}

export function loadPrefs(): DisplayPrefs {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return normalizePrefs(stored ? JSON.parse(stored) : undefined);
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

export function savePrefs(prefs: DisplayPrefs): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    /* a blocked or full store is not worth breaking the app over */
  }
}

/**
 * Write the preferences onto the document.
 *
 * Attributes for the discrete choices (theme, motion, markers) — the state
 * channel the stylesheet and the tests read — and custom properties for the
 * continuous ones. Safe to call before React mounts and on every change.
 */
export function applyPrefs(prefs: DisplayPrefs): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const set = (name: string, value: string | null) =>
    value === null ? root.removeAttribute(name) : root.setAttribute(name, value);

  set('data-theme', prefs.theme === 'system' ? null : prefs.theme);
  set('data-motion', prefs.motion === 'system' ? null : prefs.motion);
  set('data-markers', prefs.markers ? 'true' : null);

  root.style.setProperty('--text-scale', String(prefs.textSize / 100));
  root.style.setProperty('--reading-leading', SPACING_VALUES[prefs.spacing].leading);
  root.style.setProperty('--verse-gap', SPACING_VALUES[prefs.spacing].gap);
  root.style.setProperty('--measure', MEASURE_VALUES[prefs.measure]);

  // The browser chrome follows the theme. With `system` each meta keeps its
  // own media query; a pinned theme colours both.
  for (const meta of document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')) {
    const own = meta.dataset.default;
    if (prefs.theme === 'system') {
      if (own) meta.content = own;
    } else {
      if (!own) meta.dataset.default = meta.content;
      meta.content = THEME_PAPER[prefs.theme];
    }
  }
}

/**
 * Whether motion should be avoided right now — the reader's switch or the
 * operating system's. For JavaScript-driven motion (`scrollIntoView`), which
 * the stylesheet cannot reach.
 */
export function prefersReducedMotion(): boolean {
  if (typeof document === 'undefined') return false;
  if (document.documentElement.dataset.motion === 'reduce') return true;
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** React state over the stored preferences; every change is applied and saved. */
export function usePrefs(): [DisplayPrefs, (patch: Partial<DisplayPrefs>) => void] {
  const [prefs, setPrefs] = useState<DisplayPrefs>(() => loadPrefs());
  const update = useCallback((patch: Partial<DisplayPrefs>) => {
    setPrefs((current) => {
      const next = normalizePrefs({ ...current, ...patch });
      applyPrefs(next);
      savePrefs(next);
      return next;
    });
  }, []);
  return [prefs, update];
}
