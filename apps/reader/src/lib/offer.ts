/**
 * Which Bibles to offer a reader whose interface is not in English.
 *
 * A reader whose browser is in Spanish gets a Spanish interface, but the
 * bundled Bible is English (BSB). So when the interface language has Bibles
 * in the library and none of them is on this device yet, the reader is
 * offered every one of them. Nothing downloads without a press, and "Not now"
 * is remembered for that language on this device.
 *
 * English is never offered anything: the bundled Bible is already English.
 * The dismissals describe this device, not the reader's work, so they live in
 * `localStorage` beside the display preferences and are neither exported nor
 * mirrored.
 *
 * ⚠️ Kept free of React, the DOM and `import.meta`, so jest can test it.
 */
import type { CatalogEntry } from './library';
import { primaryLanguage, type Locale } from '../i18n/locales';

export const DISMISSED_KEY = 'scriptura-offer-dismissed';

/** The Bibles to offer, in library order; empty when there is nothing to offer. */
export function offerFor(
  locale: Locale,
  catalog: readonly CatalogEntry[],
  installed: readonly string[],
  dismissed: readonly string[]
): CatalogEntry[] {
  const language = primaryLanguage(locale);
  if (language === 'en' || dismissed.includes(language)) return [];
  const inLanguage = catalog.filter((entry) => primaryLanguage(entry.language) === language);
  if (inLanguage.some((entry) => installed.includes(entry.id))) return [];
  return inLanguage;
}

/** The languages whose offer was put away on this device. */
export function loadDismissed(): string[] {
  try {
    const stored = JSON.parse(localStorage.getItem(DISMISSED_KEY) ?? '[]');
    return Array.isArray(stored) ? stored.filter((v): v is string => typeof v === 'string') : [];
  } catch {
    return [];
  }
}

/** Remember that the offer for `language` was put away. Returns the new list. */
export function dismissOffer(language: string): string[] {
  const next = [...new Set([...loadDismissed(), language])];
  try {
    localStorage.setItem(DISMISSED_KEY, JSON.stringify(next));
  } catch {
    /* a blocked store only means the offer comes back next visit */
  }
  return next;
}
