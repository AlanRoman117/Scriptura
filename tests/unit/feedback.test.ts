import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { FEEDBACK_FORMS, feedbackUrl } from '../../apps/reader/src/lib/feedback';
import { LOCALES } from '../../apps/reader/src/i18n/locales';

/**
 * Where a translation reviewer's correction goes.
 *
 * The preview's link opens the issue form in the reader's interface language,
 * with the language and the build filled in. GitHub fills a form field from
 * the query parameter named by its id, so the form must have those ids — and
 * must exist, or the link opens GitHub's form chooser instead.
 */

const FORMS = fileURLToPath(new URL('../../.github/ISSUE_TEMPLATE/', import.meta.url));

describe('the correction link', () => {
  test.each([...LOCALES])('%s opens its own form, with the language and version filled in', (locale) => {
    const url = new URL(feedbackUrl(locale, '0.1.0-preview.1 (abc1234)'));
    expect(url.origin + url.pathname).toBe('https://github.com/AlanRoman117/Scriptura/issues/new');
    expect(url.searchParams.get('template')).toBe(FEEDBACK_FORMS[locale]);
    expect(url.searchParams.get('language')).toBe(locale);
    expect(url.searchParams.get('version')).toBe('0.1.0-preview.1 (abc1234)');
  });

  test('a build that does not know its version leaves the field for the reviewer', () => {
    expect(new URL(feedbackUrl('es-MX', '')).searchParams.has('version')).toBe(false);
  });

  test.each([...LOCALES])('the %s form exists and has the fields the link fills', (locale) => {
    const form = readFileSync(`${FORMS}${FEEDBACK_FORMS[locale]}`, 'utf-8');
    expect(form).toMatch(/^\s+id: language$/m);
    expect(form).toMatch(/^\s+id: version$/m);
    // One form per language, each titled with its tag so the list sorts by language.
    expect(form).toMatch(new RegExp(`^title: "\\[${locale}\\] "$`, 'm'));
  });
});
