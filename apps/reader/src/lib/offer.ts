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

/**
 * The script a tag names, lower-cased, or '' for a tag that names none:
 * `zh-Hant` → `hant`, `pt-BR` and `ja` → ''.
 *
 * Read with a regex rather than `Intl.Locale`, which throws on a tag it does
 * not like — a catalog is data from the network, and an offer is not worth a
 * blank screen.
 */
const scriptOf = (tag: string): string =>
  (/^[a-z]{2,3}[-_]([a-z]{4})(?:[-_]|$)/i.exec(tag)?.[1] ?? '').toLowerCase();

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

  // Chinese is one translation in two scripts, so both are offered — but the
  // reader's own script goes first. `sort` is stable, so the rest keep library
  // order, and a language whose interface names no script keeps it entirely.
  const want = scriptOf(locale);
  if (!want) return inLanguage;
  return [...inLanguage].sort(
    (a, b) => Number(scriptOf(b.language) === want) - Number(scriptOf(a.language) === want)
  );
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
