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
import { useSyncExternalStore } from 'react';
import { LOCALES, deviceLanguages, isLocale, matchLocale, type Locale } from '../i18n/locales';

/**
 * How the reader looks: a style, drawn light or dark.
 *
 * A style is a whole look — its palette, its corners and depth, its reading
 * face, how a chapter title is set — and every style has a light and a dark
 * palette, so the two choices are independent: any style follows the device
 * or is pinned to either polarity. Classic is the default and is written as
 * an *absent* `data-style`, which is also what lets the operating system's
 * "more contrast" request swap in the high-contrast palette (styles.css).
 */
export const STYLES = ['classic', 'contrast', 'sepia'] as const;
export type Style = (typeof STYLES)[number];

export const APPEARANCES = ['system', 'light', 'dark'] as const;
export type Appearance = (typeof APPEARANCES)[number];

export const TEXT_SIZES = [100, 112, 125, 150, 175, 200] as const;
export type TextSize = (typeof TEXT_SIZES)[number];

export const SPACINGS = ['normal', 'relaxed', 'loose'] as const;
export type Spacing = (typeof SPACINGS)[number];

export const MEASURES = ['narrow', 'normal', 'wide'] as const;
export type Measure = (typeof MEASURES)[number];

export const MOTIONS = ['system', 'reduce'] as const;
export type Motion = (typeof MOTIONS)[number];

/**
 * How a note is written: drawn as it is typed (`live`), or as the Markdown
 * source in a plain textarea — the fallback for a keyboard or a screen reader
 * that copes badly with the live editor.
 */
export const EDITORS = ['live', 'plain'] as const;
export type EditorPref = (typeof EDITORS)[number];

/** The interface language: one of ours, or whatever the device prefers. */
export const LANGUAGES = ['system', ...LOCALES] as const;
export type LanguagePref = (typeof LANGUAGES)[number];

export interface DisplayPrefs {
  style: Style;
  appearance: Appearance;
  textSize: TextSize;
  spacing: Spacing;
  measure: Measure;
  motion: Motion;
  /** Draw a glyph as well as a colour on every highlight (1.4.1). */
  markers: boolean;
  /** The interface language; `system` follows the device's languages. */
  language: LanguagePref;
  /** The note editor. */
  editor: EditorPref;
}

export const DEFAULT_PREFS: DisplayPrefs = {
  style: 'classic',
  appearance: 'system',
  textSize: 100,
  spacing: 'normal',
  measure: 'normal',
  motion: 'system',
  markers: false,
  language: 'system',
  editor: 'live',
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

/**
 * Each style's paper, light and dark: the browser chrome's colour
 * (`theme-color`). Mirrored in index.html's inline script, and checked
 * against each palette's `--paper` in styles.css by tests/unit/prefs.test.ts.
 */
export const STYLE_PAPER: Record<Style, { light: string; dark: string }> = {
  classic: { light: '#faf9f7', dark: '#171614' },
  contrast: { light: '#ffffff', dark: '#000000' },
  sepia: { light: '#f4ecd8', dark: '#1e1912' },
};

/**
 * The single `theme` this preference used to be, as a style and an
 * appearance, so a reader's choice survives the change. Mirrored in
 * index.html's inline script.
 */
export const LEGACY_THEMES: Record<string, [Style, Appearance]> = {
  system: ['classic', 'system'],
  light: ['classic', 'light'],
  dark: ['classic', 'dark'],
  'hc-light': ['contrast', 'light'],
  'hc-dark': ['contrast', 'dark'],
  sepia: ['sepia', 'light'],
};

const oneOf = <T extends readonly unknown[]>(values: T, v: unknown, fallback: T[number]): T[number] =>
  (values as readonly unknown[]).includes(v) ? (v as T[number]) : fallback;

/** Validate whatever was stored; anything unknown falls back field by field, never throws. */
export function normalizePrefs(raw: unknown): DisplayPrefs {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const legacy = typeof r.theme === 'string' && Object.hasOwn(LEGACY_THEMES, r.theme) ? LEGACY_THEMES[r.theme] : undefined;
  return {
    // A valid new value, else what the old theme meant, else the default.
    style: oneOf(STYLES, r.style, legacy?.[0] ?? DEFAULT_PREFS.style),
    appearance: oneOf(APPEARANCES, r.appearance, legacy?.[1] ?? DEFAULT_PREFS.appearance),
    textSize: oneOf(TEXT_SIZES, Number(r.textSize), DEFAULT_PREFS.textSize),
    spacing: oneOf(SPACINGS, r.spacing, DEFAULT_PREFS.spacing),
    measure: oneOf(MEASURES, r.measure, DEFAULT_PREFS.measure),
    motion: oneOf(MOTIONS, r.motion, DEFAULT_PREFS.motion),
    markers: r.markers === true,
    language: oneOf(LANGUAGES, r.language, DEFAULT_PREFS.language),
    editor: oneOf(EDITORS, r.editor, DEFAULT_PREFS.editor),
  };
}

/**
 * The interface language a preference means on this device right now: the
 * chosen one, or the first of the device's languages we have, or English.
 * Mirrored in index.html's inline script, which sets `lang` before first paint.
 */
export function resolveLocale(pref: LanguagePref, languages: readonly string[] = deviceLanguages()): Locale {
  return pref !== 'system' && isLocale(pref) ? pref : matchLocale(languages);
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
 * Attributes for the discrete choices (style, appearance, motion, markers) — the state
 * channel the stylesheet and the tests read — and custom properties for the
 * continuous ones. Safe to call before React mounts and on every change.
 */
export function applyPrefs(prefs: DisplayPrefs): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const set = (name: string, value: string | null) =>
    value === null ? root.removeAttribute(name) : root.setAttribute(name, value);

  set('data-style', prefs.style === 'classic' ? null : prefs.style);
  set('data-appearance', prefs.appearance === 'system' ? null : prefs.appearance);
  set('data-motion', prefs.motion === 'system' ? null : prefs.motion);
  set('data-markers', prefs.markers ? 'true' : null);
  // Always present: the page's language is how a screen reader picks its voice (3.1.1).
  set('lang', resolveLocale(prefs.language));

  root.style.setProperty('--text-scale', String(prefs.textSize / 100));
  root.style.setProperty('--reading-leading', SPACING_VALUES[prefs.spacing].leading);
  root.style.setProperty('--verse-gap', SPACING_VALUES[prefs.spacing].gap);
  root.style.setProperty('--measure', MEASURE_VALUES[prefs.measure]);

  // The browser chrome follows the paper. Each meta answers its own media
  // query — one light, one dark — unless the appearance is pinned, which
  // colours both.
  for (const meta of document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')) {
    const own = meta.media.includes('dark') ? 'dark' : 'light';
    meta.content = STYLE_PAPER[prefs.style][prefs.appearance === 'system' ? own : prefs.appearance];
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

/*
 * One copy of the preferences for the whole page. The app and the language
 * provider around it both read them, so they are a small store rather than
 * state inside one component: a change made in Settings reaches the provider
 * in the same render.
 */
let current: DisplayPrefs | null = null;
const listeners = new Set<() => void>();
const snapshot = (): DisplayPrefs => (current ??= loadPrefs());
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/** Change some preferences: applied to the document first, then saved, then every reader told. */
export function updatePrefs(patch: Partial<DisplayPrefs>): void {
  current = normalizePrefs({ ...snapshot(), ...patch });
  applyPrefs(current);
  savePrefs(current);
  for (const listener of listeners) listener();
}

/** The stored preferences, and the way to change them. */
export function usePrefs(): [DisplayPrefs, (patch: Partial<DisplayPrefs>) => void] {
  return [useSyncExternalStore(subscribe, snapshot, snapshot), updatePrefs];
}
