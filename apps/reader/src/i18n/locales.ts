/**
 * The interface languages, as BCP 47 tags.
 *
 * Each tag is built from subtags in the IANA Language Subtag Registry
 * (https://www.iana.org/assignments/language-subtag-registry): a language
 * (`en`, `es`, `fr`, `ja`, `pt`, `zh`) and then whichever subtag actually
 * distinguishes the text — a region (`US`, `MX`, `FR`, `JP`, `BR`) or, for
 * Chinese, a script (`Hans`, `Hant`). Canonical case throughout: language
 * lower, script title, region upper (RFC 5646 §2.1.1). The page's `lang` is
 * always one of these, so a screen reader picks the right voice (WCAG 3.1.1).
 *
 * They are the languages of the Bibles the library offers. Neither subtag is
 * decoration: the region decides how numbers are grouped (`es-MX` writes
 * 28,123, while `es-ES` would write 28.123) and which words are natural, and
 * the script decides both the characters and the wording — Taiwan writes 搜尋
 * where the mainland writes 搜索.
 *
 * ⚠️ `zh` takes a script and not a region on purpose. Simplified and
 * Traditional each span several regions (`zh-CN`/`zh-SG`, `zh-TW`/`zh-HK`),
 * and the two Bibles are one translation in two scripts, so the script is
 * what the catalog and the font stack are really keyed on.
 *
 * ⚠️ Kept free of React, `import.meta` and the DOM: jest reads this file, and
 * index.html's inline script repeats `LANGUAGE_TO_LOCALE` — the two are
 * checked against each other in tests/unit/prefs.test.ts.
 */

export const LOCALES = ['en-US', 'es-MX', 'fr-FR', 'ja-JP', 'pt-BR', 'zh-Hans', 'zh-Hant'] as const;
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
  'pt-BR': 'Português (Brasil)',
  'zh-Hans': '中文（简体）',
  'zh-Hant': '中文（繁體）',
};

/**
 * A device language's primary subtag, mapped to the interface we have for it.
 * `zh` resolves further by script — see `chineseLocale`, which this map's
 * entry is the answer for a bare `zh` with nothing else to go on.
 */
export const LANGUAGE_TO_LOCALE: Record<string, Locale> = {
  en: 'en-US',
  es: 'es-MX',
  fr: 'fr-FR',
  ja: 'ja-JP',
  pt: 'pt-BR',
  zh: 'zh-Hans',
};

export const isLocale = (value: unknown): value is Locale =>
  (LOCALES as readonly unknown[]).includes(value);

/** `es-419` → `es`; `ZH-hant-TW` → `zh`. */
export const primaryLanguage = (tag: string): string => String(tag).split(/[-_]/)[0].toLowerCase();

/**
 * The regions that write Traditional Chinese. The mainland and Singapore
 * write Simplified, which is the default, so only these three are listed.
 */
const TRADITIONAL_REGIONS = new Set(['tw', 'hk', 'mo']);

/**
 * Which Chinese, from whatever the browser says. It may name the script
 * (`zh-Hant`), a region that decides it (`zh-TW`, `zh-HK`, `zh-MO`), both
 * (`zh-Hant-TW`), or neither (`zh`) — and Windows still reports the legacy
 * `zh-CHS`/`zh-CHT` from Internet Explorer's day.
 *
 * ⚠️ Simplified is the fallback rather than an error: a bare `zh` is far more
 * often the mainland, and either script is readable where the other is
 * expected. Settings has both, named in their own characters.
 */
export function chineseLocale(tag: string): Locale {
  for (const part of String(tag).split(/[-_]/).slice(1)) {
    const subtag = part.toLowerCase();
    if (subtag === 'hant' || subtag === 'cht') return 'zh-Hant';
    if (subtag === 'hans' || subtag === 'chs') return 'zh-Hans';
    if (TRADITIONAL_REGIONS.has(subtag)) return 'zh-Hant';
  }
  return LANGUAGE_TO_LOCALE.zh;
}

/**
 * The interface for a device's language list, in the device's order of
 * preference: the first language we have wins, whatever its region, so a
 * `fr-CA` browser gets French. None of them means English.
 *
 * ⚠️ Chinese is the exception, because its subtags are not decoration: a
 * `zh-TW` browser gets Traditional, not whichever Chinese comes first in a
 * map. index.html's inline script resolves it the same way.
 */
export function matchLocale(languages: readonly string[] | undefined): Locale {
  for (const tag of languages ?? []) {
    const language = primaryLanguage(tag);
    if (language === 'zh') return chineseLocale(tag);
    const match = LANGUAGE_TO_LOCALE[language];
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
