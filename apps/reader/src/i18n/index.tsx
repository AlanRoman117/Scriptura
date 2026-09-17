/**
 * The interface language, for components: `const { t, fmt, locale } = useI18n()`.
 *
 * `t` is the typed catalog for the current language, so a key is checked by
 * the compiler rather than looked up by string. `fmt` formats numbers, sizes,
 * lists and language names in the same language.
 */
import { createContext, useContext, useMemo } from 'react';
import type { ReactNode } from 'react';
import { DEFAULT_LOCALE, type Locale } from './locales';
import { formattersFor, type Formatters } from './format';
import { CATALOGS } from './catalogs';
import type { Messages } from './messages/en-US';

export interface I18n {
  locale: Locale;
  t: Messages;
  fmt: Formatters;
}

const built = new Map<Locale, I18n>();

/** The catalog and formatters for `locale`, built once each. */
export function i18nFor(locale: Locale): I18n {
  let value = built.get(locale);
  if (!value) {
    value = { locale, t: CATALOGS[locale], fmt: formattersFor(locale) };
    built.set(locale, value);
  }
  return value;
}

const I18nContext = createContext<I18n>(i18nFor(DEFAULT_LOCALE));

export function I18nProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  const value = useMemo(() => i18nFor(locale), [locale]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export const useI18n = (): I18n => useContext(I18nContext);
