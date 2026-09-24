import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { contrastRatio, NON_TEXT_MIN, TEXT_MIN } from '../helpers/contrast';
import { HIGHLIGHTS, NON_TEXT, PALETTE, TEXT } from '../helpers/token-pairs';
import { readSheet, schemesOf, stripComments, theme, type Theme } from '../helpers/tokens';

/**
 * The colour tokens, measured.
 *
 * WCAG 2.2 AAA asks 7:1 for text (1.4.6) and 3:1 for the boundary of a control
 * or a focus ring (1.4.11, 2.4.13). axe can only measure what the browser
 * resolves, and reports contrast over `color-mix()` and blurred surfaces as
 * "incomplete" — so this test is the gate and axe is the backstop. It reads
 * the token blocks straight out of the stylesheet (tests/helpers/tokens.ts
 * describes the markers) and evaluates the derived formulas the way the
 * browser does, so a value changed in the CSS is a value measured here
 * without anyone remembering to update a table.
 *
 * Every palette is found, not listed: a new one is measured the moment it is
 * written. A palette whose name ends in `-auto` is the same tokens applied
 * from a media query — CSS cannot reference a block from inside one — and
 * must agree with its namesake token for token.
 */

const STYLESHEET = fileURLToPath(new URL('../../apps/reader/src/styles.css', import.meta.url));
const css = readFileSync(STYLESHEET, 'utf8');
const sheet = readSheet(css);

const themes: Theme[] = [...sheet.palettes.entries()]
  .filter(([name]) => !name.endsWith('-auto'))
  .flatMap(([name, decls]) => schemesOf(decls).map((scheme) => theme(sheet, name, scheme)));

const ratio = (a: string, b: string) => Number(contrastRatio(a, b).toFixed(2));

describe('colour tokens', () => {
  test('the stylesheet has its token blocks', () => {
    expect(themes.length).toBeGreaterThanOrEqual(5);
    expect(Object.keys(sheet.derived).length).toBeGreaterThan(0);
    expect(Object.keys(sheet.style).length).toBeGreaterThan(0);
  });

  test('every palette chooses every palette token', () => {
    const missing = themes.flatMap((t) => PALETTE.filter((name) => !t.declares(name)).map((name) => `${t.palette} ${name}`));
    expect([...new Set(missing)]).toEqual([]);
  });

  test('every -auto copy matches its namesake token for token', () => {
    const autos = [...sheet.palettes.keys()].filter((name) => name.endsWith('-auto'));
    expect(autos.length).toBeGreaterThan(0);
    for (const auto of autos) expect(sheet.palettes.get(auto)).toEqual(sheet.palettes.get(auto.replace(/-auto$/, '')));
  });

  /**
   * One test per pair, with both colours in its name: jest's `expect` takes no
   * message argument, so the name is what tells you which pair fell short.
   */
  for (const t of themes) {
    const label = (fg: string, bg: string) => `${fg} ${t.color(fg)} on ${bg} ${t.color(bg)}`;
    describe(`${t.palette} ${t.scheme}`, () => {
      test.each(TEXT.map(([fg, bg]) => [label(fg, bg), t.color(fg), t.color(bg)]))(
        'text: %s reads at 7:1 or better',
        (_label, fg, bg) => {
          expect(ratio(fg, bg)).toBeGreaterThanOrEqual(TEXT_MIN);
        }
      );
      test.each(NON_TEXT.map(([fg, bg]) => [label(fg, bg), t.color(fg), t.color(bg)]))(
        'boundary: %s is distinguishable at 3:1 or better',
        (_label, fg, bg) => {
          expect(ratio(fg, bg)).toBeGreaterThanOrEqual(NON_TEXT_MIN);
        }
      );
    });
  }
});

describe('the evaluator', () => {
  // Checked against what Chromium resolves for the same expressions.
  const probe = readSheet(`/* @tokens probe */ :root { --paper: light-dark(#ffffff, #000000); --ink: #000000; --accent: #336699; } /* @tokens end */
    /* @derived */ :root { --half: color-mix(in srgb, var(--ink) 50%, var(--paper)); --veil: color-mix(in srgb, var(--accent) 20%, transparent); --pick: var(--missing, #ff0000); } /* @derived end */`);
  test('mixes in sRGB and composites translucency over the paper', () => {
    expect(theme(probe, 'probe', 'light').color('--half')).toBe('#808080');
    expect(theme(probe, 'probe', 'dark').color('--half')).toBe('#000000');
    expect(theme(probe, 'probe', 'light').color('--veil')).toBe('#d6e0eb');
    expect(theme(probe, 'probe', 'light').color('--pick')).toBe('#ff0000');
  });
});

/*
 * Component rules take every colour, radius, shadow and type size from a
 * token, so a theme can change them and this test can measure them. The token
 * blocks themselves are where the literals live.
 */
describe('stylesheet hygiene', () => {
  const rules = stripComments(
    css.replace(/\/\* @(tokens [\w-]+|style [\w-]+|derived|hues|style) \*\/[\s\S]*?\/\* @(tokens|derived|hues|style) end \*\//g, '')
  );

  test('nothing removes the focus ring', () => {
    expect(css.match(/outline:\s*(none|0)\b/g) ?? []).toEqual([]);
  });

  test('the danger colour is a token, never a literal', () => {
    expect(css.toLowerCase().includes('#b3261e')).toBe(false);
  });

  test('no colour literal outside the token blocks', () => {
    expect(rules.match(/#[0-9a-f]{3,8}\b|\brgba?\(|\bhsla?\(/gi) ?? []).toEqual([]);
  });

  test('no corner radius in pixels outside the scale', () => {
    const literal = (rules.match(/radius:[^;]*/g) ?? []).filter((v) => /\d+px/.test(v) && !v.includes('var(--radius'));
    expect(literal).toEqual([]);
  });

  test('no interface type size in rem or px outside the scale', () => {
    expect(rules.match(/font-size:\s*[\d.]+(rem|px)/g) ?? []).toEqual([]);
  });
});
