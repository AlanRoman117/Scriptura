import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

/**
 * Pictures are drawn by components/Icon.tsx, never by a font.
 *
 * An emoji or a text symbol is whatever the system's fonts make of it, so it
 * can look different from one system to the next, or fall back to something
 * else. This fails on one written back into a component. The catalogs are not
 * read: Help's prose can name a button by a symbol, and an edge between two
 * cards is written with an arrow into exported text.
 */
const ROOT = fileURLToPath(new URL('../../apps/reader/src/components', import.meta.url));

/** Arrows, technical signs, shapes, dingbats, emoji, and the multiplication sign that was a close button. */
const SYMBOL = /[\u2190-\u21ff\u2300-\u23ff\u25a0-\u27bf\u2900-\u2bff\u{1f300}-\u{1faff}\ufe0f\u00d7]/gu;

/** Comments may say anything, and the old symbols are worth naming there. */
const withoutComments = (source: string) => source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const symbols = (source: string) => withoutComments(source).match(SYMBOL) ?? [];

describe('no component draws a picture with a font', () => {
  test.each(readdirSync(ROOT).filter((name) => name.endsWith('.tsx')))('%s', (name) => {
    expect(symbols(readFileSync(join(ROOT, name), 'utf8'))).toEqual([]);
  });

  test('the check would find one', () => {
    expect(symbols('<button aria-label={t.close}>\n  \u2715\n</button>')).toEqual(['\u2715']);
    expect(symbols('<span>\u2699\ufe0f</span>')).toEqual(['\u2699', '\ufe0f']);
    expect(symbols('<button>\u00d7</button>')).toEqual(['\u00d7']);
  });

  test('and lets comments through', () => {
    expect(symbols('/* the \u25be button */\n// \u2192 next\nconst x = 1;')).toEqual([]);
  });
});
