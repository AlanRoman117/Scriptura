import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { contrastRatio, NON_TEXT_MIN, TEXT_MIN } from '../helpers/contrast';
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

const HIGHLIGHTS = ['amber', 'rose', 'sky', 'mint', 'violet'];

/** What a palette must choose for itself; everything else may be derived. */
const PALETTE = ['--ink', '--ink-soft', '--paper', '--paper-raised', '--rule', '--edge', '--accent', '--danger', '--focus'];

const themes: Theme[] = [...sheet.palettes.entries()]
  .filter(([name]) => !name.endsWith('-auto'))
  .flatMap(([name, decls]) => schemesOf(decls).map((scheme) => theme(sheet, name, scheme)));

const ratio = (a: string, b: string) => Number(contrastRatio(a, b).toFixed(2));

/**
 * Every pair the stylesheet draws, as [foreground, background]. Kept to the
 * pairs that exist: a colour that is never text on a surface is not held to
 * 7:1 on it.
 */
const TEXT: [string, string][] = [
  // Text on the three papers.
  ...['--ink', '--ink-soft', '--accent', '--danger', '--rubric', '--heading'].flatMap((fg) =>
    ['--paper', '--paper-raised'].map((bg): [string, string] => [fg, bg])
  ),
  ['--ink', '--paper-sunken'],
  ['--ink-soft', '--paper-sunken'],
  // Ink on every fill: rows under the pointer, pressed and selected controls,
  // count pills, the verse being acted on, the sticky bars, and each tint.
  ...['--hover', '--press', '--accent-tint', '--accent-wash', '--accent-pill', '--selection-wash', '--bar-bg', '--bar-bg-raised'].map(
    (bg): [string, string] => ['--ink', bg]
  ),
  ...HIGHLIGHTS.map((h): [string, string] => ['--ink', `--hl-${h}`]),
  // A quiet control's label, under the pointer or pressed, and on a bar.
  ['--ink-soft', '--hover'],
  ['--ink-soft', '--press'],
  ['--ink-soft', '--bar-bg'],
  // A result's reference on its hovered row; a link in a previewed note.
  ['--accent', '--hover'],
  ['--accent', '--accent-tint'],
  // A verse number on a hovered verse. On the verse being acted on, as on a
  // highlighted one, the number turns to ink.
  ['--rubric', '--hover'],
  // The delete button's words on its fill.
  ['--paper', '--danger'],
];

const NON_TEXT: [string, string][] = [
  // Control boundaries and focus rings on every paper, sunken bars included.
  ...['--edge', '--focus'].flatMap((fg) =>
    ['--paper', '--paper-raised', '--paper-sunken'].map((bg): [string, string] => [fg, bg])
  ),
  // A collection's rule beside a verse, and its colour on a card's edge.
  ...HIGHLIGHTS.flatMap((h) => ['--paper', '--paper-raised'].map((bg): [string, string] => [`--hl-${h}-strong`, bg])),
  // The pane divider is a bar in the rule colour holding a grip, two buttons
  // and, when focused, a ring. --edge is too faint on it in the light theme,
  // so the grip and the buttons' borders there are --ink-soft; hovering or
  // focusing turns the grip --accent.
  ['--ink-soft', '--rule'],
  ['--focus', '--rule'],
  ['--accent', '--rule'],
  // A focused verse number inside the verse being acted on.
  ['--focus', '--selection-wash'],
  // The glyph on each swatch, when Settings asks for one.
  ...HIGHLIGHTS.map((h): [string, string] => ['--sw-glyph', `--sw-${h}`]),
];

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
    css.replace(/\/\* @(tokens [\w-]+|derived|hues|style) \*\/[\s\S]*?\/\* @(tokens|derived|hues|style) end \*\//g, '')
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
