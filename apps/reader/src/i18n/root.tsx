import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { I18nProvider, i18nFor } from './index';
import { deviceLanguages } from './locales';
import { resolveLocale, usePrefs } from '../lib/prefs';
import { announce } from '../lib/announce';

/**
 * The interface language for the whole page, from the reader's choice or the
 * device.
 *
 * With "Match this device" chosen, a change to the browser's languages
 * (`languagechange`) is followed without a reload. Whenever the language
 * changes, the page's `lang` changes first and the change is then announced
 * in the new language, so a screen reader says it in the voice that follows.
 */
export function I18nRoot({ children }: { children: ReactNode }) {
  const [prefs] = usePrefs();
  const [languages, setLanguages] = useState<readonly string[]>(() => deviceLanguages());

  useEffect(() => {
    const onChange = () => setLanguages([...deviceLanguages()]);
    window.addEventListener('languagechange', onChange);
    return () => window.removeEventListener('languagechange', onChange);
  }, []);

  const locale = resolveLocale(prefs.language, languages);

  useLayoutEffect(() => {
    document.documentElement.setAttribute('lang', locale);
  }, [locale]);

  const previous = useRef(locale);
  useEffect(() => {
    if (previous.current === locale) return;
    previous.current = locale;
    announce(i18nFor(locale).t.app.languageChanged, { force: true });
  }, [locale]);

  return <I18nProvider locale={locale}>{children}</I18nProvider>;
}
