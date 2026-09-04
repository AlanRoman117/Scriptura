# Scriptura — Architecture Specification

> Open Bible data ecosystem: multi-translation, multi-language, developer-first.
> **License:** Apache 2.0 · **Stack:** TypeScript (primary), Python (data tooling)

---

## 1. Project goals

- Provide structured, machine-readable Bible data for multiple translations and languages under open licenses
- Expose a consistent TypeScript API developers can use in any runtime (Node, browser, edge)
- Support future study Bible features: side-by-side comparison, cross-reference, and annotation
- Never include a translation that is not verified public domain or an explicit open license

---

## 2. Monorepo layout

```
scriptura/
├── data/                        # Bible text, one directory per translation
│   ├── rv1909/                  # Reina Valera 1909 — Public domain
│   │   ├── metadata.json
│   │   └── books/               # Populated by scripts/ingest.py; committed
│   │       ├── 01-genesis.json
│   │       └── ...
│   ├── kjv/                     # King James Version — Public domain
│   ├── web/                     # World English Bible — Public domain
│   ├── bsb/                     # Berean Standard Bible — Public domain (2023)
│   ├── lsg1910/                 # Louis Segond 1910 (French) — Public domain
│   ├── vbl/                     # Versión Biblia Libre (Spanish) — CC BY-SA 4.0
│   └── bungo/                   # 文語訳 (Japanese Classical) — Public domain
│                                #   (full set of 11 in §6)
├── packages/
│   ├── core/                    # Loader, parser, canonical types
│   ├── search/                  # Full-text + reference search
│   ├── compare/                 # Multi-translation diff engine
│   ├── validate/                # Data integrity checks
│   └── api/                     # REST + GraphQL handlers
│
├── scripts/
│   ├── ingest.py                # Download & normalize source data
│   ├── validate.py              # Run integrity checks on all translations
│   ├── build-static-api.mjs     # Compile data/ → dist/ static JSON API tree
│   └── schema-gen.ts            # Generate TypeScript types from JSON schema
│
├── examples/
│   ├── react-app/               # CRA / Vite SPA using @scriptura/core
│   ├── node-server/             # Express REST server using @scriptura/api
│   ├── python-client/           # Python wrapper calling the REST API
│   └── cli-demo/                # Node CLI using @scriptura/search
│
├── tests/
│   ├── unit/
│   ├── integration/
│   └── fixtures/                # Sample verse data for test assertions
│
├── docs/
│   ├── architecture.md          # This document
│   ├── API.md
│   ├── usage-examples.md
│   ├── contributing.md
│   └── translations-status.md   # Tracks license verification for each version
│
├── .github/
│   └── workflows/
│       ├── ci.yml               # Validate data + type-check + test (push/PR)
│       └── deploy.yml           # Build static API + sync to S3/CloudFront (main)
│
├── dist/                        # Generated static API tree (gitignored)
├── .cache/                      # Ingest download cache (gitignored)
├── CLAUDE.md                    # Guidance for Claude Code
├── package.json                 # Workspace root (npm workspaces)
├── tsconfig.base.json
└── LICENSE                      # Apache 2.0
```

---

## 3. Canonical data schema

Every translation stored in `data/` must conform to this structure.

### `metadata.json`
```json
{
  "id": "rv1909",
  "name": "Reina Valera 1909",
  "language": "es",
  "license": "public-domain",
  "attribution": "Reina Valera 1909 — Public Domain",
  "source_url": "https://ebible.org/find/details.php?id=spaRV1909",
  "year": 1909,
  "testament": "both",
  "book_count": 66
}
```

### `books/NN-bookname.json`
```json
{
  "number": 1,
  "name": "Génesis",
  "abbreviation": "Gén",
  "testament": "OT",
  "chapters": [
    {
      "number": 1,
      "verses": [
        { "number": 1, "text": "En el principio creó Dios los cielos y la tierra." },
        { "number": 2, "text": "..." }
      ]
    }
  ]
}
```

The filename prefix (`43-john.json`) encodes the canonical book number and an English slug (`john`). The slug is language-independent and becomes the `:book` URL segment even for non-English translations; `name` inside the file is localized.

### License values (enum)
| Value | Meaning |
|---|---|
| `public-domain` | No restrictions anywhere |
| `cc-by-sa-4.0` | Attribution + ShareAlike required |
| `cc0` | Explicit public domain dedication |
| `custom-free` | Free with conditions (e.g. RVG — no modification, no sale) |

---

## 4. TypeScript package API

All packages are scoped under `@scriptura/*` and published independently.

### `@scriptura/core`

```typescript
// Load a translation
const bible = await loadTranslation('rv1909');

// Access a verse
const verse = bible.verse('John', 3, 16);
// => { number: 16, text: 'Porque de tal manera amó Dios...' }

// Access a chapter
const chapter = bible.chapter('Genesis', 1);

// List all available translations
const translations = await listTranslations();
// => [{ id: 'rv1909', name: 'Reina Valera 1909', language: 'es', ... }]
```

### `@scriptura/search`

```typescript
// Full-text search within one translation
const results = await search('rv1909', 'amor eterno');

// Reference lookup (supports ranges)
const passage = await lookup('kjv', 'Romans 8:28-39');

// Cross-reference lookup (future)
const refs = await crossRefs('John 3:16');
```

### `@scriptura/compare`

```typescript
// Compare a single verse across multiple translations
const diff = await compareVerse('John 3:16', ['rv1909', 'kjv', 'web']);
/*
[
  { translation: 'rv1909', text: 'Porque de tal manera amó Dios...' },
  { translation: 'kjv',    text: 'For God so loved the world...' },
  { translation: 'web',    text: 'For God so loved the world...' }
]
*/

// Compare a chapter across translations (study Bible foundation)
const chapterDiff = await compareChapter('John', 3, ['rv1909', 'kjv']);
```

### `@scriptura/validate`

```typescript
// Validate a single translation directory
await validate('data/rv1909');
// Throws with details if any book/chapter/verse is missing or malformed

// Validate all translations
await validateAll('data/');
```

---

## 5. API layer (`packages/api`)

The API package exposes both REST and GraphQL from the same handlers, making it easy to drop into any Node server or edge runtime.

### REST endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/translations` | List all available translations |
| `GET` | `/translations/:id` | Metadata for one translation |
| `GET` | `/translations/:id/:book/:chapter` | Full chapter as JSON |
| `GET` | `/translations/:id/:book/:chapter/:verse` | Single verse |
| `GET` | `/search?q=&translation=` | Full-text search |
| `GET` | `/compare?ref=&translations=` | Cross-translation verse comparison |

> These routes are served **dynamically** by `createRouter` (Express/Fastify/edge). The metadata/chapter/verse routes are **also** pre-rendered as static `.json` files for CDN hosting — see §8. `/search` and `/compare` are dynamic-only.

### GraphQL schema (excerpt)

```graphql
type Query {
  translations: [Translation!]!
  translation(id: ID!): Translation
  verse(translation: ID!, book: String!, chapter: Int!, verse: Int!): Verse
  search(translation: ID!, query: String!): [SearchResult!]!
  compare(ref: String!, translations: [ID!]!): [TranslationVerse!]!
}

type Translation {
  id: ID!
  name: String!
  language: String!
  license: String!
  books: [Book!]!
}

type Verse {
  number: Int!
  text: String!
  chapter: Chapter!
}
```

---

## 6. Validated open-source translations

| ID | Name | Language | License | Source |
|---|---|---|---|---|
| `rv1909` | Reina Valera 1909 | Spanish | Public domain | [eBible.org](https://ebible.org/find/details.php?id=spaRV1909) |
| `kjv` | King James Version | English | Public domain | [aruljohn/Bible-kjv](https://github.com/aruljohn/Bible-kjv) |
| `web` | World English Bible | English | Public domain | [worldenglish.bible](https://worldenglish.bible) |
| `bsb` | Berean Standard Bible | English | Public domain (2023) | [berean.bible](https://berean.bible) |
| `asv` | American Standard Version | English | Public domain | [scrollmapper/bible_databases](https://github.com/scrollmapper/bible_databases) |
| `ylt` | Young's Literal Translation | English | Public domain | [scrollmapper/bible_databases](https://github.com/scrollmapper/bible_databases) |
| `lsg1910` | Louis Segond 1910 | French | Public domain | [eBible.org](https://ebible.org/fraLSG/) |
| `martin1744` | Bible Martin | French | Public domain | [scrollmapper/bible_databases](https://github.com/scrollmapper/bible_databases) |
| `ostervald` | Bible Ostervald | French | Public domain | [seven1m/open-bibles](https://github.com/seven1m/open-bibles) |
| `vbl` | Versión Biblia Libre | Spanish | CC BY-SA 4.0 | [eBible.org](https://ebible.org/find/details.php?id=spavbl) |
| `bungo` | 文語訳聖書 (Classical) | Japanese | Public domain | [bible.salterrae.net](https://bible.salterrae.net) |

> ⚠️ **Never add RV1960** — copyrighted by Sociedades Bíblicas Unidas.
> ⚠️ **Never add 口語訳** — under US copyright until 2049–2050 (URAA restoration).
>
> `scripts/validate.py` enforces both: it fails the build if a data directory matches a forbidden id or if metadata contains a forbidden marker.

---

## 7. CI / validation pipeline

```
on: push / pull_request  (.github/workflows/ci.yml)
├── validate all translations (scripts/validate.py)
│     ├── check every expected book is present (testament-aware)
│     ├── check chapter counts against canon (warning; versification-aware)
│     ├── flag any verse with empty text
│     └── license audit (metadata.json license field per data/ dir)
├── TypeScript type-check (tsc --noEmit)   ┐ self-skips until the npm
├── Unit tests (jest)                      ┘ workspace is scaffolded
└── Integration tests (API endpoint smoke tests)
```

In practice: **errors** fail the build (missing books, empty text, bad/missing license, a forbidden translation), while **warnings** do not (chapter-count differences from versification, verse-number gaps in critical-text translations). Deployment runs in a separate workflow — see §8.

The canon is defined in three places that must stay in sync: `packages/validate/src/canon.ts`, `scripts/validate.py`, and `scripts/ingest.py`.

---

## 8. Deployment & hosting

Scriptura serves the same data two ways.

- **Dynamic** — `@scriptura/api`'s `createRouter` runs inside any Node server or edge runtime (see `examples/node-server`). Best when the host can run code.
- **Static** — `scripts/build-static-api.mjs` pre-renders `data/` into a tree of JSON files under `dist/`, one per endpoint, for hosting on object storage + CDN with no running server. This is the primary hosting path.

### Static build (`npm run build:api`)

Writes an endpoint file per route; every file carries a `.json` extension:

```
/translations.json
/translations/:id.json
/translations/:id/:book.json
/translations/:id/:book/:chapter.json
/translations/:id/:book/:chapter/:verse.json     (omit with --skip-verses)
```

The `.json` extension is required because the verse path forces `:chapter` to be a **directory** (it holds the verse files); the chapter itself is served as `:chapter.json`, which coexists with the `:chapter/` directory with no conflict. (An optional CloudFront Function can later strip the extension for cleaner URLs without changing the file tree.)

Per-verse files produce a very large object count (~31k per full translation); `--skip-verses` yields a leaner build where verses remain reachable via the chapter endpoint.

### AWS target (S3 + CloudFront)

- Private S3 bucket, served only through CloudFront via **Origin Access Control (OAC)** — not the S3 website endpoint.
- **CORS** added through a CloudFront response-headers policy (not the bucket).
- Objects synced with `Cache-Control: max-age=31536000, immutable` — Bible text never changes, so it caches indefinitely; each deploy invalidates `/*`.
- Custom-domain TLS certificate must live in **`us-east-1`** (CloudFront requirement), regardless of the bucket's region.
- GitHub Actions (`deploy.yml`) authenticates via **GitHub OIDC** (no static keys) and runs on push to `main`: build → `aws s3 sync` → CloudFront invalidation.

### Dynamic endpoints (Phase 2)

`/search` and `/compare` can't be pre-rendered. They run as an AWS Lambda (Function URL) added as a **second CloudFront origin** with `/search*` and `/compare*` path behaviors, sharing the same domain as the static tree.

---

## 9. Study Bible roadmap (future phases)

| Phase | Feature |
|---|---|
| v1 | Core loader + search + REST API + 5 translations |
| v1.1 | GraphQL layer + additional translations |
| v2 | `compare` package — side-by-side diff for study Bible UI |
| v2.1 | Cross-reference data (Open Scriptures) |
| v3 | Annotation layer — personal notes, highlights per verse |
| v3.1 | Commentary integration (public domain commentaries via CCEL) |
| v4 | Study Bible UI (React) consuming all packages |

---

## 10. Contributing guidelines (summary)

- All Bible data additions **must** include a verified `license` field in `metadata.json`
- PRs adding a new translation must link to the primary source confirming the license
- No translation may be added without independent copyright verification
- The `scripts/validate.py` check must pass on any new data directory before merge
- All TypeScript packages must maintain 100% type coverage (no implicit `any`)