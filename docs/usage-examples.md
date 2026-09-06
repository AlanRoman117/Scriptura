# Usage Examples

## Node.js — Load and read a verse

```typescript
import { loadTranslation } from '@scriptura/core';

const bible = await loadTranslation('kjv');
const verse = bible.verse('John', 3, 16);
console.log(verse?.text);
// "For God so loved the world, that he gave his only begotten Son..."
```

The book can be given four ways — slug, localized name, abbreviation, or
canonical number — so the same code works against any translation:

```typescript
const rv = await loadTranslation('rv1909');
rv.verse('john', 3, 16);   // slug
rv.verse('Juan', 3, 16);   // localized name
rv.verse('Jhn', 3, 16);    // abbreviation
rv.verse('43', 3, 16);     // canonical number
```

Translations are cached after the first load, so repeated calls are free.

## Search across a translation

```typescript
import { search } from '@scriptura/search';

const results = await search('rv1909', 'amor eterno');
for (const r of results) {
  console.log(`${r.ref}: ${r.text}`);       // r.book_slug is URL-ready
}
```

The library returns every match. Over HTTP, `/search` paginates — see below.

## Compare a verse across languages

```typescript
import { compareVerse } from '@scriptura/compare';

const diff = await compareVerse('John 3:16', ['kjv', 'rv1909', 'lsg1910', 'bungo']);
for (const d of diff) {
  console.log(`[${d.translation}] ${d.reference} — ${d.text}`);
}
// [kjv]     John 3:16 — For God so loved the world...
// [rv1909]  Juan 3:16 — Porque de tal manera amó Dios al mundo...
// [lsg1910] JEAN 3:16 — Car Dieu a tant aimé le monde...
// [bungo]   ヨハネによる福音書 3:16 — それ神はその獨子を賜ふほどに世を愛し給へり...
```

One English reference resolves across every language, and each row reports the
reference as that translation names it. Check `d.found` to tell a verse a
translation genuinely omits (critical texts drop Acts 8:37) from one that could
not be resolved — both have empty `text`.

## REST API with curl

Start it with `npm run dev:api` (hot reload) or `npm run start:api` (compiled).

```bash
# List translations
curl http://localhost:3000/translations

# A verse — the same URL shape in every language
curl http://localhost:3000/translations/kjv/john/3/16
curl http://localhost:3000/translations/bungo/john/3/16

# A chapter, and a book's chapter index
curl http://localhost:3000/translations/lsg1910/song-of-solomon/1
curl http://localhost:3000/translations/kjv/john

# Search — paginated, so ask for what you need
curl "http://localhost:3000/search?q=love&translation=kjv&limit=5"

# Compare
curl "http://localhost:3000/compare?ref=John+3:16&translations=kjv,rv1909,bungo"
```

Full request/response shapes are in [API.md](API.md).

## Validate translation data

```bash
# Validate all translations
python scripts/validate.py

# Validate a specific directory
python scripts/validate.py data/kjv
```
