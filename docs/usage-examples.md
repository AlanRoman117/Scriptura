# Usage Examples

## Node.js — Load and read a verse

```typescript
import { loadTranslation } from '@scriptura/core';

const bible = await loadTranslation('kjv');
const verse = bible.verse('John', 3, 16);
console.log(verse?.text);
// "For God so loved the world, that he gave his only begotten Son..."
```

## Search across a translation

```typescript
import { search } from '@scriptura/search';

const results = await search('rv1909', 'amor eterno');
for (const r of results) {
  console.log(`${r.ref}: ${r.text}`);
}
```

## Compare a verse across languages

```typescript
import { compareVerse } from '@scriptura/compare';

const diff = await compareVerse('John 3:16', ['kjv', 'rv1909', 'lsg1910']);
for (const d of diff) {
  console.log(`[${d.translation}] ${d.text}`);
}
// [kjv] For God so loved the world...
// [rv1909] Porque de tal manera amó Dios al mundo...
// [lsg1910] Car Dieu a tant aimé le monde...
```

## REST API with curl

```bash
# List translations
curl http://localhost:3000/translations

# Get a verse
curl http://localhost:3000/translations/kjv/john/3/16

# Search
curl "http://localhost:3000/search?q=love&translation=kjv"
```

## Validate translation data

```bash
# Validate all translations
python scripts/validate.py

# Validate a specific directory
python scripts/validate.py data/kjv
```
