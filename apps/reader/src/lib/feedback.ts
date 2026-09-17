/**
 * Where a translation reviewer's correction goes.
 *
 * Each interface language has its own GitHub issue form
 * (.github/ISSUE_TEMPLATE/translation-*.yml), written in that language, and
 * GitHub fills a form's fields from query parameters named by their ids — so
 * the link says which language and which build the reader was looking at.
 *
 * ⚠️ Kept free of React, the DOM and `import.meta`, so jest can test it.
 */
import type { Locale } from '../i18n/locales';

const NEW_ISSUE = 'https://github.com/AlanRoman117/Scriptura/issues/new';

/** Each interface language's own form. */
export const FEEDBACK_FORMS: Record<Locale, string> = {
  'en-US': 'translation-en.yml',
  'es-MX': 'translation-es.yml',
  'fr-FR': 'translation-fr.yml',
  'ja-JP': 'translation-ja.yml',
};

/** The correction form for `locale`, with the language and `version` filled in. */
export function feedbackUrl(locale: Locale, version: string): string {
  const url = new URL(NEW_ISSUE);
  url.searchParams.set('template', FEEDBACK_FORMS[locale]);
  url.searchParams.set('language', locale);
  if (version) url.searchParams.set('version', version);
  return url.href;
}
