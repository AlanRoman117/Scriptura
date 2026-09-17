/**
 * Every catalog, by locale. Imported statically on purpose: together they are
 * a few tens of kilobytes, the service worker precaches them with the app,
 * and switching language then works offline with nothing to fetch.
 *
 * ⚠️ Kept free of React so jest can read every catalog.
 */
import type { Locale } from './locales';
import { enUS, type Messages } from './messages/en-US';

export const CATALOGS: Record<Locale, Messages> = {
  'en-US': enUS,
  // Until each catalog lands, its language falls back to English.
  'es-MX': enUS,
  'fr-FR': enUS,
  'ja-JP': enUS,
};
