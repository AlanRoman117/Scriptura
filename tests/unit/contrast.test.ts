import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { contrastRatio, NON_TEXT_MIN, TEXT_MIN } from '../helpers/contrast';

/**
 * The colour tokens, measured.
 *
 * WCAG 2.2 AAA asks 7:1 for text (1.4.6) and 3:1 for the boundary of a control
 * or a focus ring (1.4.11, 2.4.13). axe can only measure what the browser
 * resolves, and reports contrast over `color-mix()` and blurred surfaces as
 * "incomplete" — so this test is the gate and axe is the backstop. It reads
 * the token blocks straight out of the stylesheet — each sits between an
 * `@tokens <name>` comment and an `@tokens end` comment — so a value changed in
 * the CSS is a value measured here without anyone remembering to update a
 * table. (The markers are not spelled out with their comment delimiters here
 * because the closing one would end this very comment.)
 *
 * `light-dark(a, b)` pairs split into two themes; plain values apply to both.
 * The `hc` block and the `hc-auto` block (the same tokens applied under
 * `prefers-contrast: more`) must agree token for token — the duplication is a
 * CSS limitation, and this is what keeps it from drifting.
 */

const STYLESHEET = fileURLToPath(new URL('../../apps/reader/src/styles.css', import.meta.url));
const css = readFileSync(STYLESHEET, 'utf8');

type Tokens = Record<string, string>;

function blocks(): Map<string, string> {
  const found = new Map<string, string>();
  const re = /\/\* @tokens ([\w-]+) \*\/([\s\S]*?)\/\* @tokens end \*\//g;
  for (const m of css.matchAll(re)) found.set(m[1], m[2]);
  return found;
}

/** Declarations in a block, split into a light and a dark reading. */
function parse(block: string): { light: Tokens; dark: Tokens } {
  const light: Tokens = {};
  const dark: Tokens = {};
  const decl = /(--[\w-]+)\s*:\s*([^;]+);/g;
  for (const m of block.matchAll(decl)) {
    const [, name, value] = m;
    const pair = value.trim().match(/^light-dark\(\s*(#[0-9a-f]{6})\s*,\s*(#[0-9a-f]{6})\s*\)$/i);
    if (pair) {
      light[name] = pair[1];
      dark[name] = pair[2];
    } else if (/^#[0-9a-f]{6}$/i.test(value.trim())) {
      light[name] = value.trim();
      dark[name] = value.trim();
    }
  }
  return { light, dark };
}

const HIGHLIGHTS = ['amber', 'rose', 'sky', 'mint', 'violet'];

function themes(): Record<string, Tokens> {
  const b = blocks();
  const base = parse(b.get('light-dark') ?? '');
  const hc = parse(b.get('hc') ?? '');
  const sepia = parse(b.get('sepia') ?? '');
  return {
    light: base.light,
    dark: base.dark,
    'hc-light': hc.light,
    'hc-dark': hc.dark,
    sepia: sepia.light,
  };
}

const ratio = (a: string, b: string) => Number(contrastRatio(a, b).toFixed(2));

describe('colour tokens', () => {
  const all = themes();
  const required = [
    '--ink',
    '--ink-soft',
    '--paper',
    '--paper-raised',
    '--rule',
    '--edge',
    '--accent',
    '--danger',
    '--focus',
    ...HIGHLIGHTS.flatMap((h) => [`--hl-${h}`, `--hl-${h}-strong`]),
  ];

  test('every theme defines every token', () => {
    const missing = Object.entries(all).flatMap(([theme, tokens]) =>
      required.filter((t) => !tokens[t]).map((t) => `${theme} ${t}`)
    );
    expect(missing).toEqual([]);
  });

  test('the prefers-contrast copy matches the hc block token for token', () => {
    const b = blocks();
    expect(b.has('hc-auto')).toBe(true);
    const auto = parse(b.get('hc-auto') ?? '');
    const hc = parse(b.get('hc') ?? '');
    expect(auto.light).toEqual(hc.light);
    expect(auto.dark).toEqual(hc.dark);
  });

  /**
   * One test per pair, with both colours in its name: jest's `expect` takes no
   * message argument, so the name is what tells you which pair fell short.
   */
  for (const [theme, t] of Object.entries(all)) {
    const surfaces: [string, string][] = [
      ['--paper', t['--paper']],
      ['--paper-raised', t['--paper-raised']],
    ];
    const text: [string, string, string, number][] = [];
    const nonText: [string, string, string, number][] = [];

    for (const token of ['--ink', '--ink-soft', '--accent', '--danger']) {
      for (const [surface, bg] of surfaces) {
        text.push([`${token} ${t[token]} on ${surface} ${bg}`, t[token], bg, TEXT_MIN]);
      }
    }
    for (const h of HIGHLIGHTS) {
      text.push([`--ink ${t['--ink']} on --hl-${h} ${t[`--hl-${h}`]}`, t['--ink'], t[`--hl-${h}`], TEXT_MIN]);
    }
    for (const token of ['--edge', '--focus', ...HIGHLIGHTS.map((h) => `--hl-${h}-strong`)]) {
      for (const [surface, bg] of surfaces) {
        nonText.push([`${token} ${t[token]} on ${surface} ${bg}`, t[token], bg, NON_TEXT_MIN]);
      }
    }
    // The pane divider is a bar in the rule colour holding a grip, two buttons
    // and, when focused, a ring. --edge is too faint on it in the light theme,
    // so the grip and the buttons' borders there are --ink-soft; hovering or
    // focusing turns the grip --accent.
    for (const token of ['--ink-soft', '--focus', '--accent']) {
      nonText.push([`${token} ${t[token]} on the divider bar --rule ${t['--rule']}`, t[token], t['--rule'], NON_TEXT_MIN]);
    }

    describe(theme, () => {
      test.each(text)('text: %s reads at 7:1 or better', (_label, fg, bg, min) => {
        expect(ratio(fg, bg)).toBeGreaterThanOrEqual(min);
      });
      test.each(nonText)('boundary: %s is distinguishable at 3:1 or better', (_label, fg, bg, min) => {
        expect(ratio(fg, bg)).toBeGreaterThanOrEqual(min);
      });
    });
  }
});

describe('stylesheet hygiene', () => {
  test('nothing removes the focus ring', () => {
    expect(css.match(/outline:\s*(none|0)\b/g) ?? []).toEqual([]);
  });

  test('the danger colour is a token, never a literal', () => {
    expect(css.toLowerCase().includes('#b3261e')).toBe(false);
  });
});
