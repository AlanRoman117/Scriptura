/**
 * Keeping a stored translation's licence words current.
 *
 * A downloaded translation is kept whole in IndexedDB and read from there for
 * good, metadata included, so a correction to an attribution would otherwise
 * never reach anyone who already has the text: their copy would go on showing
 * words we know to be wrong. Only these fields are refreshed. The text is
 * whatever the reader downloaded.
 *
 * Kept free of `import.meta` so jest can reach it.
 */
import type { TranslationMeta } from '@scriptura/core/types';

const RIGHTS_FIELDS = ['license', 'attribution', 'attribution_lang', 'license_url', 'rights_notice', 'source_url'] as const;

/**
 * `meta` with the catalogue's licence words, or `meta` itself when they already
 * agree, so a caller can tell by identity that there is nothing to do.
 *
 * A field the catalogue no longer has is removed: a notice that was withdrawn
 * must stop being shown.
 */
export function withCurrentRights<T extends TranslationMeta>(meta: T, current: TranslationMeta | undefined): T {
  if (!current || RIGHTS_FIELDS.every((field) => meta[field] === current[field])) return meta;
  const next: T = { ...meta };
  for (const field of RIGHTS_FIELDS) {
    if (current[field] === undefined) delete next[field];
    else Object.assign(next, { [field]: current[field] });
  }
  return next;
}
