/**
 * The interface languages, as BCP 47 tags.
 *
 * Each tag is built from subtags in the IANA Language Subtag Registry
 * (https://www.iana.org/assignments/language-subtag-registry): a language
 * (`en`, `es`, `fr`, `ja`) and a region (`US`, `MX`, `FR`, `JP`), written in
 * the canonical case — language lower, region upper (RFC 5646 §2.1.1). The
 * page's `lang` is always one of these, so a screen reader picks the right
 * voice (WCAG 3.1.1).
 *
 * They are the languages of the Bibles the library offers. The region is not
 * decoration: it decides how numbers are grouped (`es-MX` writes 28,123, while
 * `es-ES` would write 28.123) and which words are natural.
 *
 * ⚠️ Kept free of React, `import.meta` and the DOM: jest reads this file, and
 * index.html's inline script repeats `LANGUAGE_TO_LOCALE` — the two are
 * checked against each other in tests/unit/prefs.test.ts.
 */

export const LOCALES = ['en-US', 'es-MX', 'fr-FR', 'ja-JP'] as const;
export type Locale = (typeof LOCALES)[number];

/** What the app falls back to when the device's languages include none of ours. */
export const DEFAULT_LOCALE: Locale = 'en-US';

/**
 * Each language named in itself, as the picker shows it. Each option also
 * carries its own `lang`, so it is read in its own voice (3.1.2).
 */
export const LOCALE_LABELS: Record<Locale, string> = {
  'en-US': 'English (United States)',
  'es-MX': 'Español (México)',
  'fr-FR': 'Français (France)',
  'ja-JP': '日本語 (日本)',
};

/** A device language's primary subtag, mapped to the interface we have for it. */
export const LANGUAGE_TO_LOCALE: Record<string, Locale> = {
  en: 'en-US',
  es: 'es-MX',
  fr: 'fr-FR',
  ja: 'ja-JP',
};

export const isLocale = (value: unknown): value is Locale =>
  (LOCALES as readonly unknown[]).includes(value);

/** `es-419` → `es`; `ZH-hant-TW` → `zh`. */
export const primaryLanguage = (tag: string): string => String(tag).split(/[-_]/)[0].toLowerCase();

/**
 * The interface for a device's language list, in the device's order of
 * preference: the first language we have wins, whatever its region, so a
 * `fr-CA` browser gets French. None of them means English.
 */
export function matchLocale(languages: readonly string[] | undefined): Locale {
  for (const tag of languages ?? []) {
    const match = LANGUAGE_TO_LOCALE[primaryLanguage(tag)];
    if (match) return match;
  }
  return DEFAULT_LOCALE;
}

/** The languages the browser reports, or none outside a browser. */
export function deviceLanguages(): readonly string[] {
  if (typeof navigator === 'undefined') return [];
  if (navigator.languages?.length) return navigator.languages;
  return navigator.language ? [navigator.language] : [];
}
