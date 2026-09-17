/**
 * French spacing, applied to a whole catalog.
 *
 * French typography puts a no-break space before a colon and inside
 * guillemets, and a narrow no-break space before ; ! and ?. Typing those by
 * hand is error-prone and invisible in an editor, so the French catalog is
 * written with ordinary spaces and passed through this once. Every string is
 * converted, and every function's result is converted as it is produced.
 * tests/unit/i18n.test.ts then checks that no plain space is left where a
 * no-break one belongs.
 *
 * Left exactly as written:
 * - code spans (between backticks);
 * - what a message quotes. A function's result holds the names it was given —
 *   a note called "Plan: week 1", a card's label — and those are the reader's
 *   words or a Bible's, not the catalog's. Respacing the whole result turned
 *   that note into "Plan : week 1" in every French message that named it.
 *   The arguments themselves are never changed, so a message's own logic
 *   (a `kind` it switches on, a colour that may be absent) sees what it was
 *   given.
 */

const NBSP = ' ';
const NNBSP = ' ';

export function frenchSpacing(text: string): string {
  return text
    .split(/(`[^`]*`)/)
    .map((part, i) =>
      i % 2 === 1
        ? part
        : part
            .replace(/ :/g, `${NBSP}:`)
            .replace(/ ([;!?])/g, `${NNBSP}$1`)
            .replace(/« /g, `«${NBSP}`)
            .replace(/ »/g, `${NBSP}»`)
    )
    .join('');
}

/**
 * Respace `text`, leaving every occurrence of a `keep` string as it is.
 *
 * The kept strings are found first, longest first, so a name that holds
 * another stays whole; only the text between them is respaced.
 */
function spaceAround(text: string, keep: readonly string[]): string {
  // Never an empty string: it would be found everywhere and never passed.
  const kept = [...new Set(keep)].filter(Boolean).sort((a, b) => b.length - a.length);
  if (kept.length === 0) return frenchSpacing(text);
  let out = '';
  let at = 0;
  while (at < text.length) {
    let found = -1;
    let length = 0;
    for (const k of kept) {
      const i = text.indexOf(k, at);
      if (i !== -1 && (found === -1 || i < found)) {
        found = i;
        length = k.length;
      }
    }
    if (found === -1) break;
    out += frenchSpacing(text.slice(at, found)) + text.slice(found, found + length);
    at = found + length;
  }
  return out + frenchSpacing(text.slice(at));
}

/** A space, or a mark the rules above space: only a string holding one can be changed. */
const TOUCHABLE = /[\s:;!?«»]/;

/** The strings in a function's arguments that respacing could change, however deep. */
function quoted(value: unknown, out: string[] = []): string[] {
  if (typeof value === 'string') {
    if (TOUCHABLE.test(value)) out.push(value);
  } else if (Array.isArray(value)) {
    for (const v of value) quoted(v, out);
  } else if (value && typeof value === 'object') {
    for (const v of Object.values(value)) quoted(v, out);
  }
  return out;
}

/** The same object, with every string and every string a function returns respaced. */
export function withFrenchSpacing<T>(value: T): T {
  return respace(value, []) as T;
}

function respace(value: unknown, keep: readonly string[]): unknown {
  if (typeof value === 'string') return spaceAround(value, keep);
  if (typeof value === 'function') {
    const fn = value as (...args: unknown[]) => unknown;
    return (...args: unknown[]) => respace(fn(...args), [...keep, ...quoted(args)]);
  }
  if (Array.isArray(value)) return value.map((v) => respace(v, keep));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, respace(v, keep)]));
  }
  return value;
}
