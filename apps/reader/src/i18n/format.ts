/**
 * Numbers, plurals, sizes, lists and language names, in a given locale —
 * through the browser's own `Intl`, never by hand.
 *
 * Hand-rolled plurals (`n === 1 ? '' : 's'`) are wrong in three of our four
 * languages. `Intl.PluralRules` knows that French treats 0 as singular, that
 * Spanish and French have a separate form for millions, and that Japanese has
 * no plural at all:
 *
 *   en-US  one, other
 *   es-MX  one, many, other
 *   fr-FR  one (0 and 1), many, other
 *   ja-JP  other
 *
 * ⚠️ Kept free of React, `import.meta` and the DOM, so jest can test it.
 */
import type { Locale } from './locales';

export interface PluralForms {
  zero?: string;
  one?: string;
  two?: string;
  few?: string;
  many?: string;
  other: string;
}

/** Pick the form `n` takes in `locale`; a form a catalog does not give falls back to `other`. */
export function pluralFor(locale: Locale): (n: number, forms: PluralForms) => string {
  const rules = new Intl.PluralRules(locale);
  return (n, forms) => forms[rules.select(n) as keyof PluralForms] ?? forms.other;
}

/** 28123 → "28,123", or "28 123" (with a narrow no-break space) in French. */
export function numberFor(locale: Locale): (n: number) => string {
  const format = new Intl.NumberFormat(locale);
  return (n) => format.format(n);
}

/** 45 → "45%", or "45 %" in French. Whole percentages only. */
export function percentFor(locale: Locale): (n: number) => string {
  const format = new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 0 });
  return (n) => format.format(n / 100);
}

/** Bytes, rounded to something worth reading: "4.4 MB", "4,4 Mo". Zero or unknown is a dash. */
export function bytesFor(locale: Locale): (bytes: number) => string {
  const unit = (name: 'megabyte' | 'gigabyte') =>
    new Intl.NumberFormat(locale, {
      style: 'unit',
      unit: name,
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    });
  const mb = unit('megabyte');
  const gb = unit('gigabyte');
  return (bytes) => {
    if (!bytes) return '—';
    const megabytes = bytes / 1048576;
    return megabytes >= 1024 ? gb.format(megabytes / 1024) : mb.format(megabytes);
  };
}

/** ["KJV", "RV1909"] → "KJV and RV1909", "KJV y RV1909", "KJV、RV1909". */
export function listFor(locale: Locale): (items: string[]) => string {
  const format = new Intl.ListFormat(locale, { type: 'conjunction' });
  return (items) => format.format(items);
}

/**
 * A language code as a heading, in the interface language: "es" is "Spanish",
 * "Español", "Espagnol" or "スペイン語". The first letter is raised because a
 * heading starts with a capital even where the language writes its names in
 * lower case, as Spanish and French do.
 */
export function languageNameFor(locale: Locale): (code: string) => string {
  const word = languageWordFor(locale);
  return (code) => {
    const name = word(code);
    return name.charAt(0).toLocaleUpperCase(locale) + name.slice(1);
  };
}

/** A language code as a word inside a sentence, cased as the language writes it: "español", "japonais". */
export function languageWordFor(locale: Locale): (code: string) => string {
  let names: Intl.DisplayNames | null = null;
  try {
    names = new Intl.DisplayNames([locale], { type: 'language' });
  } catch {
    // Widely supported, not universally: a code is a poor heading, not a broken one.
  }
  return (code) => names?.of(code) ?? code;
}

/** Everything a component formats, bound to one locale. */
export interface Formatters {
  number: (n: number) => string;
  /** A whole percentage, given as 0–100. */
  percent: (n: number) => string;
  bytes: (bytes: number) => string;
  list: (items: string[]) => string;
  languageName: (code: string) => string;
  languageWord: (code: string) => string;
  /** Sort order for names, in the interface language. */
  compare: (a: string, b: string) => number;
}

export function formattersFor(locale: Locale): Formatters {
  const collator = new Intl.Collator(locale);
  return {
    number: numberFor(locale),
    percent: percentFor(locale),
    bytes: bytesFor(locale),
    list: listFor(locale),
    languageName: languageNameFor(locale),
    languageWord: languageWordFor(locale),
    compare: (a, b) => collator.compare(a, b),
  };
}
