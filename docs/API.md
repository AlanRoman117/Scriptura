# Scriptura API Reference

Run it locally with `npm run dev:api` (hot reload) or `npm run start:api`
(compiled). Default port 3000, override with `PORT`.

Every response below is **byte-identical to the static CDN build**, where the
same routes exist as files with a `.json` extension
(`/translations/kjv/john/3/16.json`). A client can point at either without
changing a line; [`tests/integration/static-parity.test.ts`](../tests/integration/static-parity.test.ts)
enforces it.

## Addressing a book

The `:book` segment is the **English slug** taken from the book's filename
(`43-john.json` → `john`). It is language-independent: `john` addresses that
book in every translation, including `bungo`, where the book is named
ヨハネによる福音書.

Four forms resolve, so these are all the same verse:

```
/translations/rv1909/john/3/16      # slug           (canonical — use this)
/translations/rv1909/Juan/3/16      # localized name
/translations/rv1909/Jhn/3/16       # abbreviation
/translations/rv1909/43/3/16        # canonical book number
```

Matching folds case, accents and separators, so `Génesis`, `genesis` and
`GENESIS` all work, as do `1-samuel`, `1 Samuel` and `1_Samuel`.

## REST endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/` | Index of endpoints, with working examples |
| `GET` | `/translations` | All available translations |
| `GET` | `/translations/:id` | One translation's metadata plus its book index |
| `GET` | `/translations/:id/:book` | A book's chapter index with verse counts |
| `GET` | `/translations/:id/:book/:chapter` | A full chapter |
| `GET` | `/translations/:id/:book/:chapter/:verse` | A single verse |
| `GET` | `/search?q=&translation=&limit=&offset=` | Full-text search |
| `GET` | `/compare?ref=&translations=` | One verse across translations |
| `GET` | `/compare/chapter?book=&chapter=&translations=` | A whole chapter across translations |

### `GET /`

A browsable index — open `http://localhost:3000/` in a browser and start here.
Lists every endpoint, explains book addressing, and gives example URLs that are
covered by a test, so they cannot rot.

### `GET /translations`

```json
[
  { "id": "kjv", "name": "King James Version", "language": "en",
    "license": "public-domain", "attribution": "King James Version — Public Domain",
    "source_url": "https://github.com/aruljohn/Bible-kjv", "year": 1769,
    "testament": "both", "book_count": 66 }
]
```

### `GET /translations/kjv`

Translation metadata, plus a book index you can navigate from.

```json
{
  "id": "kjv", "name": "King James Version", "language": "en", "…": "…",
  "books": [
    { "number": 1, "name": "Genesis", "slug": "genesis", "chapters": 50 },
    { "number": 43, "name": "John", "slug": "john", "chapters": 21 }
  ]
}
```

### `GET /translations/kjv/john`

```json
{
  "translation": "kjv", "book": "John", "slug": "john", "number": 43,
  "abbreviation": "Jhn", "testament": "NT",
  "chapters": [{ "number": 1, "verses": 51 }, { "number": 3, "verses": 36 }]
}
```

### `GET /translations/kjv/john/3`

```json
{
  "translation": "kjv", "book": "John", "book_slug": "john", "book_number": 43,
  "chapter": 3,
  "verses": [{ "number": 1, "text": "There was a man of the Pharisees…" }]
}
```

### `GET /translations/kjv/john/3/16`

`book` and `reference` use the translation's own name for the book, so this is
`Juan 3:16` for `rv1909`.

```json
{
  "translation": "kjv", "book": "John", "book_slug": "john", "book_number": 43,
  "chapter": 3, "verse": 16, "reference": "John 3:16",
  "text": "For God so loved the world, that he gave his only begotten Son…"
}
```

### `GET /search?q=love&translation=kjv&limit=5`

Paginated: `limit` defaults to 100 and caps at 500, `offset` defaults to 0.

Query params are flat scalars. The example server runs Express 5, whose default
query parser is `simple`, so bracket-array syntax (`?q[]=love`) is **not**
supported — send `?q=love`. Repeated params (`?q=a&q=b`) resolve to the last value.
`total` is the full match count, not the page size — `q=the` matches about
28,000 verses in the KJV.

```json
{
  "query": "love", "translation": "kjv", "total": 442, "limit": 5, "offset": 0,
  "results": [
    { "ref": "Genesis 27:4", "book": "Genesis", "book_slug": "genesis",
      "chapter": 27, "verse": 4, "text": "And make me savoury meat…", "score": 1 }
  ]
}
```

`book_slug` is directly usable as a `:book` path segment.

### `GET /compare?ref=John+3:16&translations=kjv,rv1909,bungo`

`translations` is a comma-separated list. One English reference resolves across
every language, and each row reports the reference as that translation names it.

```json
{
  "reference": "John 3:16",
  "results": [
    { "translation": "kjv", "text": "For God so loved the world…",
      "found": true, "reference": "John 3:16" },
    { "translation": "rv1909", "text": "Porque de tal manera amó Dios al mundo…",
      "found": true, "reference": "Juan 3:16" },
    { "translation": "bungo", "text": "それ神はその獨子を賜ふほどに世を愛し給へり…",
      "found": true, "reference": "ヨハネによる福音書 3:16" }
  ]
}
```

`found` distinguishes a verse a translation genuinely omits (critical texts drop
Acts 8:37, for instance) from one that could not be looked up — both would
otherwise be an empty string. A translation that cannot be read at all comes
back as one row with `found: false` and an `error`, rather than failing the
whole request.

### `GET /compare/chapter?book=john&chapter=3&translations=kjv,rv1909`

Side-by-side chapter reading. Verse `number` is preserved on every row so columns
stay aligned even where a translation omits a verse.

```json
{
  "book": "john", "chapter": 3,
  "results": [
    { "translation": "kjv", "book": "John",
      "verses": [{ "translation": "kjv", "number": 1, "text": "There was a man…", "found": true }] },
    { "translation": "rv1909", "book": "Juan",
      "verses": [{ "translation": "rv1909", "number": 1, "text": "Y HABIA un hombre…", "found": true }] }
  ]
}
```

Up to 10 translations per request.

## HTTP behaviour

| | |
|---|---|
| Methods | `GET`, `HEAD`, `OPTIONS`. Anything else returns **405** with an `Allow` header — the API is read-only. |
| CORS | `Access-Control-Allow-Origin: *` on every response, including errors, so a browser can read a 404 body. `OPTIONS` preflight returns **204**. |
| Content-Type | `application/json; charset=utf-8`. The charset matters — the corpus includes Japanese, Spanish and French. |
| Caching | Successful responses are `public, max-age=3600`; errors are `no-store`. Express also emits a weak `ETag` and honours conditional GETs. |

## Types

A TypeScript client should import the response types rather than redeclaring
them — they are exported from `@scriptura/api`:

```typescript
import type {
  TranslationPayload, BookPayload, ChapterPayload, VersePayload,
  CompareVersePayload, CompareChapterPayload, BookIndexEntry,
} from '@scriptura/api';
```

## Errors

All errors are `{ "error": "…" }`, sometimes with extra fields to act on.

| Status | When |
|---|---|
| `400` | Missing or malformed query params; an unparseable `ref` |
| `404` | Unknown translation, book, chapter, verse, or route |
| `405` | A method other than GET/HEAD/OPTIONS |

An unresolvable book tells you what valid slugs look like:

```json
{
  "error": "Book \"songofsolomon\" not found in translation \"kjv\"",
  "hint": "Use the English slug from the book filename; it is the same in every translation.",
  "valid_examples": ["genesis", "esther", "micah", "1-samuel"]
}
```

An out-of-range chapter reports the real range: `{"error": "…", "valid_range": [1, 21]}`.

## Package APIs

```typescript
import { loadTranslation, listTranslations } from '@scriptura/core';

const bible = await loadTranslation('kjv');   // cached after the first call
bible.verse('John', 3, 16);                   // { number, text }
bible.chapter('1-samuel', 1);                 // resolves by slug too
bible.book('43');                             // …or canonical number
bible.slugs();                                // all 66 slugs, canonical order
await listTranslations();                     // TranslationMeta[]
```

Set `SCRIPTURA_DATA_DIR` (or call `setDataDir()`) to read from somewhere other
than the repo's `data/`.

```typescript
import { search, lookup } from '@scriptura/search';

await search('rv1909', 'amor');               // SearchResult[] — every match
await lookup('kjv', 'Romans 8:28-39');        // SearchResult[] — a range
```

```typescript
import { compareVerse, compareChapter } from '@scriptura/compare';

await compareVerse('John 3:16', ['kjv', 'rv1909']);
await compareChapter('john', 3, ['kjv', 'rv1909']);
```

```typescript
import { validate, validateAll } from '@scriptura/validate';

await validate('data/kjv');                   // ValidationError[]
await validateAll('data/');
```
