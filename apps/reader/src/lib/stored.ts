/**
 * Bibles on this device that the catalog does not list.
 *
 * A translation can leave the catalog while a reader holds it: `cuvs`, `cuvt`
 * and `ostervald` were withdrawn on 2026-11-01 when their licences turned out
 * to be wrong. Nothing on a device is deleted behind its owner's back, so the
 * copy stays and still opens. But the library was drawn from the catalog alone,
 * which left it with no row, and so no way to read that copy again or to remove
 * it. These rows are built from what the device itself holds.
 *
 * ⚠️ Kept free of React, the DOM and `import.meta`, so jest can test it.
 */
import type { TranslationMeta } from '@scriptura/core/types';
import type { CatalogEntry } from './library';

/** The ids stored here that the catalog does not list. */
export const outsideCatalog = (catalog: readonly CatalogEntry[], installed: readonly string[]): string[] =>
  installed.filter((id) => !catalog.some((entry) => entry.id === id));

/**
 * A library row for a stored translation.
 *
 * `catalogKnown` is false when no catalog could be read at all: every row is
 * then outside it, and telling a reader that all their Bibles have been
 * withdrawn because the network is down would be false.
 *
 * Only the metadata is kept: the row must not pin a whole Bible in memory.
 * Whatever the store holds may be damaged or from an older shape, and a row
 * that cannot be drawn is a copy that cannot be removed, so each field has a
 * floor. A language `Intl.DisplayNames` would throw on becomes `und`.
 */
export function storedEntry(
  id: string,
  stored: Partial<TranslationMeta> | undefined,
  catalogKnown: boolean
): CatalogEntry {
  const language = stored?.language;
  return {
    id,
    name: stored?.name || id.toUpperCase(),
    language: typeof language === 'string' && /^[a-z]{2,3}(-[a-z0-9]{2,8})*$/i.test(language) ? language : 'und',
    license: stored?.license,
    attribution: stored?.attribution,
    source_url: stored?.source_url,
    year: stored?.year,
    testament: stored?.testament,
    book_count: stored?.book_count,
    storedOnly: catalogKnown ? 'no-longer-offered' : 'catalog-unavailable',
  } as CatalogEntry;
}
