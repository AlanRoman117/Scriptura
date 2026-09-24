/**
 * The reader's colour tokens, read out of the stylesheet and evaluated.
 *
 * styles.css keeps its tokens in marked blocks — each opens with an
 * `@tokens <name>` comment (a palette), `@derived`, `@hues` or `@style`, and
 * closes with the matching `end` comment. A palette's values are hex or
 * `light-dark(hex, hex)`; a derived value is a formula over the palette —
 * `var()`, `light-dark()` and `color-mix(in srgb, …)` — which this module
 * evaluates the way the browser does, so what the test measures is what the
 * page paints.
 *
 * A theme is one palette in one polarity: the palette's own declarations, then
 * the derived formulas, the hues and the style block beneath them. Palettes do
 * not inherit from one another — each stylesheet selector applies one — so a
 * token a palette leaves out falls to its derived formula, never to another
 * palette's value.
 *
 * Anything left translucent is composited over the theme's paper, which is
 * what sits beneath the bars and tints it applies to.
 */

export type Scheme = 'light' | 'dark';
export type Decls = Record<string, string>;

export interface Sheet {
  palettes: Map<string, Decls>;
  derived: Decls;
  hues: Decls;
  style: Decls;
}

/** Strip comments, so a hex quoted in prose is not read as a value. */
export const stripComments = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, '');

function declarations(block: string): Decls {
  const out: Decls = {};
  for (const m of stripComments(block).matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) out[m[1]] = m[2].trim();
  return out;
}

export function readSheet(css: string): Sheet {
  const palettes = new Map<string, Decls>();
  for (const m of css.matchAll(/\/\* @tokens ([\w-]+) \*\/([\s\S]*?)\/\* @tokens end \*\//g)) {
    palettes.set(m[1], declarations(m[2]));
  }
  const one = (name: string) => {
    const m = css.match(new RegExp(`/\\* @${name} \\*/([\\s\\S]*?)/\\* @${name} end \\*/`));
    return m ? declarations(m[1]) : {};
  };
  return { palettes, derived: one('derived'), hues: one('hues'), style: one('style') };
}

/** The polarities a palette is drawn in: both when it pairs values, else light. */
export function schemesOf(palette: Decls): Scheme[] {
  return Object.values(palette).some((v) => v.includes('light-dark(')) ? ['light', 'dark'] : ['light'];
}

type RGBA = [number, number, number, number];

/** Split on commas at the top level of a function's arguments. */
function args(inner: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let from = 0;
  for (let i = 0; i < inner.length; i++) {
    const c = inner[i];
    if (c === '(') depth++;
    else if (c === ')') depth--;
    else if (c === ',' && depth === 0) {
      out.push(inner.slice(from, i).trim());
      from = i + 1;
    }
  }
  out.push(inner.slice(from).trim());
  return out;
}

/** The first `name(` call in `s` whose arguments hold no call of the same name. */
function innermost(s: string, name: string): { start: number; end: number; inner: string } | null {
  for (const m of s.matchAll(new RegExp(`\\b${name}\\(`, 'g'))) {
    const start = m.index!;
    const open = start + name.length;
    let depth = 0;
    for (let i = open; i < s.length; i++) {
      if (s[i] === '(') depth++;
      else if (s[i] === ')' && --depth === 0) {
        const inner = s.slice(open + 1, i);
        if (!new RegExp(`\\b${name}\\(`).test(inner)) return { start, end: i + 1, inner };
        break;
      }
    }
  }
  return null;
}

function hex(value: string): RGBA | null {
  const m = value.trim().match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!m) return null;
  const h = m[1].length === 3 ? [...m[1]].map((c) => c + c).join('') : m[1];
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 1];
}

/** A colour with an optional trailing percentage, as `color-mix()` takes it. */
function weighted(arg: string, evalColor: (s: string) => RGBA): { c: RGBA; p: number | null } {
  const m = arg.match(/^([\s\S]*?)\s+(\d+(?:\.\d+)?)%$/);
  return m ? { c: evalColor(m[1]), p: Number(m[2]) / 100 } : { c: evalColor(arg), p: null };
}

function mix(a: { c: RGBA; p: number | null }, b: { c: RGBA; p: number | null }): RGBA {
  let p1 = a.p;
  let p2 = b.p;
  if (p1 === null && p2 === null) p1 = p2 = 0.5;
  else if (p1 === null) p1 = 1 - p2!;
  else if (p2 === null) p2 = 1 - p1;
  const sum = p1! + p2!;
  const scale = sum < 1 ? sum : 1;
  const w1 = p1! / sum;
  const w2 = p2! / sum;
  // Premultiplied, as CSS Color 5 specifies: a mix with `transparent` fades
  // the colour rather than darkening it towards black.
  const alpha = a.c[3] * w1 + b.c[3] * w2;
  if (alpha === 0) return [0, 0, 0, 0];
  const ch = (i: number) => (a.c[i] * a.c[3] * w1 + b.c[i] * b.c[3] * w2) / alpha;
  return [ch(0), ch(1), ch(2), alpha * scale];
}

export interface Theme {
  palette: string;
  scheme: Scheme;
  /** The token's raw value after `var()` and `light-dark()` are resolved. */
  raw(name: string): string;
  /** The token as an opaque `#rrggbb`, composited over the paper if translucent. */
  color(name: string): string;
  /** Whether the palette itself declares the token. */
  declares(name: string): boolean;
}

export function theme(sheet: Sheet, palette: string, scheme: Scheme): Theme {
  const own = sheet.palettes.get(palette);
  if (!own) throw new Error(`no palette ${palette}`);
  const lookup = (name: string) => own[name] ?? sheet.derived[name] ?? sheet.hues[name] ?? sheet.style[name];

  const substitute = (value: string, seen: string[] = []): string => {
    let s = value;
    for (let guard = 0; guard < 200; guard++) {
      const v = innermost(s, 'var');
      if (!v) break;
      const [name, fallback] = args(v.inner);
      if (seen.includes(name)) throw new Error(`cycle through ${name}`);
      const found = lookup(name) ?? fallback;
      if (found === undefined) throw new Error(`${name} is not defined for ${palette}`);
      s = s.slice(0, v.start) + substitute(found, [...seen, name]) + s.slice(v.end);
    }
    for (let guard = 0; guard < 200; guard++) {
      const ld = innermost(s, 'light-dark');
      if (!ld) break;
      const [light, dark] = args(ld.inner);
      s = s.slice(0, ld.start) + (scheme === 'light' ? light : dark) + s.slice(ld.end);
    }
    return s.trim();
  };

  const evalColor = (expr: string): RGBA => {
    const s = expr.trim();
    if (s === 'transparent') return [0, 0, 0, 0];
    const h = hex(s);
    if (h) return h;
    const m = s.match(/^color-mix\(([\s\S]*)\)$/);
    if (m) {
      const [space, a, b] = args(m[1]);
      if (space !== 'in srgb') throw new Error(`only srgb mixing is evaluated, not "${space}"`);
      return mix(weighted(a, evalColor), weighted(b, evalColor));
    }
    throw new Error(`cannot evaluate "${s}" as a colour`);
  };

  const opaque = (c: RGBA): string => {
    let rgb = c;
    if (c[3] < 1) {
      const paper = evalColor(substitute('var(--paper)'));
      rgb = [0, 1, 2].map((i) => c[i] * c[3] + paper[i] * (1 - c[3])) as unknown as RGBA;
    }
    return '#' + [0, 1, 2].map((i) => Math.round(rgb[i]).toString(16).padStart(2, '0')).join('');
  };

  return {
    palette,
    scheme,
    raw: (name) => substitute(`var(${name})`),
    color: (name) => opaque(evalColor(substitute(`var(${name})`))),
    declares: (name) => name in own,
  };
}
