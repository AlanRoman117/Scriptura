# Scriptura API Reference

## REST Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/translations` | List all available translations |
| `GET` | `/translations/:id` | Metadata for one translation |
| `GET` | `/translations/:id/:book/:chapter` | Full chapter as JSON |
| `GET` | `/translations/:id/:book/:chapter/:verse` | Single verse |
| `GET` | `/search?q=&translation=` | Full-text search |
| `GET` | `/compare?ref=&translations=` | Cross-translation verse comparison |

## Package APIs

### @scriptura/core

```typescript
import { loadTranslation, listTranslations } from '@scriptura/core';

const bible = await loadTranslation('kjv');
const verse = bible.verse('John', 3, 16);
const chapter = bible.chapter('Genesis', 1);
const book = bible.book('Psalms');
const translations = await listTranslations();
```

### @scriptura/search

```typescript
import { search, lookup } from '@scriptura/search';

const results = await search('kjv', 'love');
const passage = await lookup('kjv', 'Romans 8:28-39');
```

### @scriptura/compare

```typescript
import { compareVerse, compareChapter } from '@scriptura/compare';

const diff = await compareVerse('John 3:16', ['kjv', 'rv1909', 'web']);
const chapterDiff = await compareChapter('John', 3, ['kjv', 'rv1909']);
```

### @scriptura/validate

```typescript
import { validate, validateAll } from '@scriptura/validate';

const errors = await validate('data/kjv');
const allErrors = await validateAll('data/');
```
