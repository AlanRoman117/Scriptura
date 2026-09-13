/**
 * WCAG contrast arithmetic, shared by the specs that measure colours.
 *
 * The formulas are the ones in WCAG 2.2 §1.4.3 / §1.4.6: relative luminance
 * from linearised sRGB channels, then (L1 + 0.05) / (L2 + 0.05). Kept in one
 * file so a threshold change (4.5 → 7 for AAA) is made once and every spec
 * measuring against it moves together.
 */

/** Parse `rgb(…)`, `rgba(…)` or `#rrggbb` into channels 0–255 (alpha ignored). */
export function channels(color: string): [number, number, number] {
  const hex = color.trim().match(/^#([0-9a-f]{6})$/i);
  if (hex) {
    const n = parseInt(hex[1], 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  const [r, g, b] = (color.match(/\d+(\.\d+)?/g) ?? ['0', '0', '0']).slice(0, 3).map(Number);
  return [r, g, b];
}

/** Relative luminance per WCAG, from an `rgb(...)` or `#rrggbb` string. */
export function luminance(color: string): number {
  const channel = (c: number) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  const [r, g, b] = channels(color);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** Minimum ratios the reader holds itself to. AAA for text; 3:1 for everything else. */
export const TEXT_MIN = 7;
export const LARGE_TEXT_MIN = 4.5;
export const NON_TEXT_MIN = 3;
