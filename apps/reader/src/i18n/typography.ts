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
 * Code spans (between backticks) are left exactly as written.
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

/** The same object, with every string and every string a function returns respaced. */
export function withFrenchSpacing<T>(value: T): T {
  return respace(value) as T;
}

function respace(value: unknown): unknown {
  if (typeof value === 'string') return frenchSpacing(value);
  if (typeof value === 'function') {
    const fn = value as (...args: unknown[]) => unknown;
    return (...args: unknown[]) => respace(fn(...args));
  }
  if (Array.isArray(value)) return value.map(respace);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, respace(v)]));
  }
  return value;
}
