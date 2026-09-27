/**
 * The reader's styles and appearances, for the browser specs.
 *
 * A copy of `STYLES` and `STYLE_PAPER` in apps/reader/src/lib/prefs.ts, kept
 * here because the Playwright specs do not import app code.
 * tests/unit/prefs.test.ts fails if the two disagree.
 */

export const STYLES = ['classic', 'contrast', 'sepia', 'vellum', 'emerald', 'slate', 'nocturne', 'ember'] as const;
export type StyleName = (typeof STYLES)[number];

export const APPEARANCES = ['system', 'light', 'dark'] as const;
export type AppearanceName = (typeof APPEARANCES)[number];

/** Each style's paper, light and dark, as `theme-color` carries it. */
export const PAPER: Record<StyleName, { light: string; dark: string }> = {
  classic: { light: '#faf9f7', dark: '#171614' },
  contrast: { light: '#ffffff', dark: '#000000' },
  sepia: { light: '#f4ecd8', dark: '#1e1912' },
  vellum: { light: '#f6efe0', dark: '#1c1611' },
  emerald: { light: '#f3f7f4', dark: '#0d1a15' },
  slate: { light: '#f4f5f7', dark: '#16191d' },
  nocturne: { light: '#f5f6fa', dark: '#0f1424' },
  ember: { light: '#fbf0e2', dark: '#000000' },
};

/** `#rrggbb` as a computed style reports it. */
export const rgb = (hex: string): string => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return `rgb(${r}, ${g}, ${b})`;
};

/** A computed `rgb()` as `#rrggbb`. */
export const hex = (rgbText: string): string =>
  '#' + rgbText.match(/\d+/g)!.slice(0, 3).map((n) => Number(n).toString(16).padStart(2, '0')).join('');

/**
 * The stored display preferences for a style and appearance. Classic and
 * `system` are the defaults, so they are left out as the app itself would.
 */
export const displayPrefs = (style: StyleName, appearance: AppearanceName): string =>
  JSON.stringify({
    ...(style === 'classic' ? {} : { style }),
    ...(appearance === 'system' ? {} : { appearance }),
  });
