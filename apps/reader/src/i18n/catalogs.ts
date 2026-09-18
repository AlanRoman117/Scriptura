/**
 * Every catalog, by locale. Imported statically on purpose: together they are
 * a few tens of kilobytes, the service worker precaches them with the app,
 * and switching language then works offline with nothing to fetch.
 *
 * ⚠️ Kept free of React so jest can read every catalog.
 */
import type { Locale } from './locales';
import { enUS, type Messages } from './messages/en-US';
import { esMX } from './messages/es-MX';
import { frFR } from './messages/fr-FR';
import { jaJP } from './messages/ja-JP';
import { ptBR } from './messages/pt-BR';
import { zhHans } from './messages/zh-Hans';
import { zhHant } from './messages/zh-Hant';

export const CATALOGS: Record<Locale, Messages> = {
  'en-US': enUS,
  'es-MX': esMX,
  'fr-FR': frFR,
  'ja-JP': jaJP,
  'pt-BR': ptBR,
  'zh-Hans': zhHans,
  'zh-Hant': zhHant,
};
