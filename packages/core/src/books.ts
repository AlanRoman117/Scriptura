/**
 * Book addressing helpers.
 *
 * Every book file is named `NN-slug.json` (e.g. `43-john.json`). That slug is
 * the language-independent key: it stays `john` even in `data/bungo/`, where
 * the book's `name` is `ヨハネによる福音書`. It is what the REST routes use as
 * the `:book` segment, and what `scripts/build-static-api.mjs` builds its
 * static tree from.
 *
 * Because the slug already *is* the canonical English name in kebab-case, none
 * of this needs a book table — so it adds no fourth canon definition to keep in
 * sync with `packages/validate/src/canon.ts`, `scripts/validate.py` and
 * `scripts/ingest.py`.
 */

/**
 * Derive the URL slug from a book filename: `43-john.json` → `john`.
 *
 * Must stay identical to `slugFromFilename` in `scripts/build-static-api.mjs`,
 * or the static tree and the live API will address books differently. The
 * integration suite asserts the two agree.
 */
export function slugFromFilename(filename: string): string {
  return filename.replace(/\.json$/i, '').replace(/^\d+-/, '');
}

/**
 * Fold a book name or slug into a comparable key.
 *
 * Lowercases, strips diacritics, and reduces any run of spaces, underscores or
 * hyphens to a single hyphen — so `Génesis`, `genesis` and `GENESIS` all meet
 * at `genesis`, and `1 Samuel` meets the `1-samuel` slug.
 */
export function normalizeBookKey(value: string): string {
  return value
    .normalize('NFD')
    // Latin combining marks ONLY. A general \p{M} strip would eat the Japanese
    // dakuten (U+3099) and silently turn ガラテヤ into カラテヤ.
    .replace(/[\u0300-\u036f]/g, '')
    .normalize('NFC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '');
}
