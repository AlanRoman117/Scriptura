# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Scriptura is an open-source monorepo for working with Bible data programmatically. It provides freely-licensed Bible translations in canonical JSON format with TypeScript packages for loading, searching, comparing, validating, and serving scripture data. The project scaffolding is in place; the next major step is ingesting actual Bible text data into the `data/{id}/books/` directories using `scripts/ingest.py`.

Licensed under **Apache 2.0** (chosen over MIT for its explicit patent grant). Individual translations in `data/` carry their own licenses, recorded per-translation in each `metadata.json`.

## Build & Development Commands

```bash
npm install                    # Install all workspace dependencies
npm run build                  # Build all packages (tsc --build)
npm test                       # Run all tests (jest, config in jest.config.ts)
npm run lint                   # TypeScript type-check (tsc --noEmit)
npm run validate               # Validate all translation data (python scripts/validate.py)
npm run build:api              # Compile data/ into a static JSON API tree in dist/ (node scripts/build-static-api.mjs)
npm run schema:gen             # Generate JSON schemas from types (ts-node scripts/schema-gen.ts)
npm run start:api              # Start example Express server (examples/node-server)
```

Data tooling (Python, standard library only — no install step):

```bash
python scripts/ingest.py --list      # Show configured translations + licenses/sources
python scripts/ingest.py             # Download & normalize all automated translations into data/
python scripts/ingest.py --only kjv  # Ingest a single translation
python scripts/validate.py           # Validate data/ (npm run validate wraps this; add --strict locally)
```

Single-package builds: `cd packages/<name> && npm run build`

## Architecture

**Monorepo** using npm workspaces (`packages/*`). Root `tsconfig.base.json` sets strict mode, `NodeNext` module resolution, ES2022 target. Each package extends it.

### Packages (`packages/`)

- **@scriptura/core** (`packages/core/`) — Canonical types and data access layer.
  - `src/types.ts` — All shared types: `Verse`, `Chapter`, `Book`, `Bible`, `TranslationMeta`, `SearchResult`, `TranslationVerse`, `License`, `Testament`
  - `src/loader.ts` — `loadTranslation(id)` reads `data/{id}/` into a `Bible` object with `.verse()`, `.chapter()`, `.book()` accessors. `listTranslations()` returns all available translation metadata.
  - Other packages depend on core for types and data loading.

- **@scriptura/search** (`packages/search/`) — Depends on `@scriptura/core`.
  - `search(translationId, query)` — Case-insensitive full-text search across all verses
  - `lookup(translationId, reference)` — Reference parser supporting "Book Ch:V" and "Book Ch:V-V" ranges

- **@scriptura/compare** (`packages/compare/`) — Depends on `@scriptura/core`.
  - `compareVerse(reference, translationIds)` — Side-by-side verse across translations
  - `compareChapter(book, chapter, translationIds)` — Full chapter comparison

- **@scriptura/validate** (`packages/validate/`) — Data integrity engine.
  - `src/canon.ts` — Complete 66-book Protestant canon with expected chapter counts. One of THREE canon definitions that must stay in sync (see Critical Rules → Canon sync).
  - `validate(dir)` / `validateAll(dir)` — Checks: metadata exists, license is valid, all 66 books present, chapter counts match canon, no empty verse text

- **@scriptura/api** (`packages/api/`) — Depends on core + search.
  - `src/router.ts` — Framework-agnostic `createRouter(req)` matching REST routes. Returns `{ status, body }` — integrate with Express, Fastify, etc.
  - Routes: `/translations`, `/translations/:id`, `/translations/:id/:book/:chapter`, `/translations/:id/:book/:chapter/:verse`, `/search?q=&translation=`
  - This is the **dynamic** serving path. There is also a **static** serving path (see Deployment) that pre-renders the same data to files for S3/CloudFront.

### Data Layer (`data/`)

One directory per translation (11 total). Each contains:
- `metadata.json` — Schema: `{ id, name, language, license, attribution, source_url, year, testament, book_count }`
- `books/` — `01-genesis.json` through `66-revelation.json`, populated by `scripts/ingest.py`. The normalized JSON here **is committed** to the repo (it's the product). The raw upstream downloads used to build it live in `.cache/` and are gitignored.

Book JSON schema: `{ number, name, abbreviation, testament, chapters: [{ number, verses: [{ number, text }] }] }`

The filename prefix (`43-john.json`) encodes the canonical book number and an English slug (`john`). The slug is language-independent and becomes the `:book` URL segment even for non-English translations (`name` inside the file is localized, e.g. "Génesis").

### Scripts (`scripts/`)

- **`ingest.py`** — Downloads open-license source data and normalizes it into the canonical schema. Implemented with three parsers behind a `TRANSLATIONS` registry:
  - `usfx` — parses a USFX XML file from an eBible.org `_usfx.zip` (handles the milestone verse/chapter model, strips footnotes/cross-refs, keeps translator additions). Covers most translations from one consistent source.
  - `aruljohn` — per-book JSON from the aruljohn/Bible-kjv repo (used for `kjv`).
  - `sword` — a CrossWire SWORD zText module (used for `bungo`). Compiled OSIS in a binary block/index format: `.bzs` block index, `.bzz` zlib blocks, `.bzv` verse index. `osis2mod` strips `<verse>` milestones, so verse boundaries live only in `.bzv`; book/chapter structure is recovered from the `<div type="book">` and `<chapter osisID>` markers that get their own index entries, which avoids needing a versification table. Note `.bzv` offsets are **byte** offsets into the decompressed block — slice bytes and decode after, or every multi-byte verse is corrupted.
  - Automated and clean today (10): `rv1909`, `kjv`, `web`, `lsg1910`, `vbl`, `asv`, `ylt`, `bsb`, `ostervald`, `bungo`. All eBible IDs are confirmed against <https://ebible.org/Scriptures/translations.csv> (the authoritative index — check it there before guessing an id). Still registered as `manual`, needing a dedicated source/parser (script skips with a note): `martin1744`.
  - `JA_BOOK_NAMES` supplies Japanese book names for `bungo`, since zText modules carry no per-book localized headers. It is display metadata keyed off `CANONICAL_BOOKS`' USFM codes — **not** a fourth canon definition, and it carries no canon-sync burden.
  - Downloads cache under `.cache/` (gitignored). Flags: `--list`, `--only <id...>`, `--output-dir`, `--no-cache`. Embeds a `CANONICAL_BOOKS` table (USFM codes, slugs, abbreviations) — a canon definition that must stay in sync (see Critical Rules).
- **`validate.py`** — Data integrity gate run by CI (see below).
- **`build-static-api.mjs`** — Node (ESM, zero-dependency) builder that compiles `data/` into a tree of static JSON files under `dist/`, one per REST endpoint, for S3/CloudFront hosting. Endpoints carry a `.json` extension (`/translations/kjv/john/3/16.json`) because the nested verse path forces the chapter segment to be a directory. Emits `/translations.json`, `/translations/:id.json`, `/translations/:id/:book.json`, `/translations/:id/:book/:chapter.json`, and `/translations/:id/:book/:chapter/:verse.json`. Flags: `--data-dir`, `--out-dir`, `--skip-verses` (chapters only — leaner; per-verse files produce a very large object count), `--pretty`. Wire it up as `npm run build:api`.
- **`schema-gen.ts`** — Generates `data/schemas/metadata.schema.json` and `data/schemas/book.schema.json` from the canonical format.

### Tests (`tests/`)

Jest with ts-jest preset. Config in root `jest.config.ts`. Module alias `@scriptura/*` maps to `packages/*/src`.
- `tests/unit/` — Type conformance tests for core, canon completeness tests for validate
- `tests/integration/` — Placeholder for API endpoint smoke tests
- `tests/fixtures/` — Sample `sample-metadata.json` and `sample-verse.json` (John 3:16-17 KJV)

### Examples (`examples/`)

- `node-server/` — Express server wrapping `@scriptura/api`'s `createRouter`
- `cli-demo/` — CLI tool using `@scriptura/search` (search, lookup, list commands)
- `react-app/` — Vite + React SPA (package.json only, app code not yet built)
- `python-client/` — Python `requests`-based client for the REST API

### CI (`.github/workflows/ci.yml`)

Runs on push/PR to `main` and `develop`:
- **`validate-data`** — runs `python scripts/validate.py` (no `--strict`, so versification warnings don't fail the build). This is the gate that works today.
- **`build-and-test`** — TypeScript type-check + Jest. **Self-skips** until the npm workspace is scaffolded (it checks for `"workspaces"` in `package.json`), keeping CI green while packages are still being built out.

### Deployment (`.github/workflows/deploy.yml`)

Static, serverless hosting on AWS. On push to `main`:
1. `npm run build:api` compiles `data/` → `dist/` (static JSON tree).
2. `aws s3 sync dist/ s3://<bucket>/ --delete --content-type application/json --cache-control "public, max-age=31536000, immutable"` (Bible text never changes → cache aggressively).
3. CloudFront `/*` invalidation so updates go live immediately.

Infrastructure notes for anyone wiring this up:
- **S3 bucket is private**; served only through **CloudFront with Origin Access Control (OAC)** (not the S3 website endpoint).
- **CORS** is added via a CloudFront **Response Headers Policy** (`Access-Control-Allow-Origin: *`, methods `GET, HEAD, OPTIONS`), not on the bucket.
- Custom-domain TLS cert must live in **`us-east-1`** (CloudFront requirement) regardless of the bucket's region.
- Auth uses **GitHub OIDC** (a scoped IAM role assumed keylessly) rather than long-lived access keys.
- **Static vs dynamic:** verse/chapter/metadata/list endpoints are static files (above). `/search` and `/compare` are dynamic and are the Phase-2 job — a Lambda Function URL added as a second CloudFront origin with `/search*` and `/compare*` path behaviors. Not built yet.

Generated/ignored artifacts: `node_modules/`, `dist/` (static build output), and `.cache/` (ingest downloads) are gitignored. `data/` is committed.

## Critical Rules

### License enforcement
- All translations MUST have a verified `license` field in `metadata.json`
- Accepted values: `public-domain`, `cc-by-sa-4.0`, `cc0`, `custom-free`
- Every translation PR must link to primary source confirming license status
- **Forbidden:** RV1960 (copyrighted by Sociedades Bíblicas Unidas), 口語訳 1954/55 Japanese (US copyright until 2049-2050 via URAA restoration). `scripts/validate.py` actively guards against these — it fails the build if a data directory matches a forbidden id (e.g. `rv1960`, `kougo`) or if metadata contains a forbidden marker (e.g. "reina valera 1960", "口語訳").

### Data validation
- `scripts/validate.py` runs on every push/PR via CI and must pass.
- **Errors fail the build** (unambiguous corruption): malformed/missing metadata, missing or invalid license, missing expected book, unexpected book for the declared testament, `book_count` mismatch, duplicate book number, empty verse text, duplicate/invalid verse number, book testament disagreeing with canon, forbidden translation.
- **Warnings do NOT fail the build** (may be legitimate versification differences): chapter count differing from canon (Joel and Malachi have accepted alternates), total verse count outside a rough sanity band, filename prefix not matching internal book number. Verse-number gaps are intentionally NOT flagged, since critical-text translations legitimately omit verses (e.g. Acts 8:37).
- Expected books are **testament-aware**: `testament: "both"` expects all 66, `"OT"` expects 39, `"NT"` expects 27.
- Use `--strict` locally to treat warnings as errors; CI deliberately does not.

### Canon sync
There are now **three** canon definitions that must be kept consistent when any changes:
1. `packages/validate/src/canon.ts` (TypeScript — 66 books + chapter counts)
2. `scripts/validate.py` (`CANON` — 66 books + chapter counts + `CHAPTER_VARIANTS`)
3. `scripts/ingest.py` (`CANONICAL_BOOKS` — 66 books + USFM codes, slugs, abbreviations)

Book numbers, names, and chapter counts must match across all three.

### TypeScript standards
- Strict mode, no implicit `any`, 100% type coverage required for packages
- Use scoped imports: `@scriptura/core`, `@scriptura/search`, etc.
- Packages use project references (`tsconfig.json` `references` field) for build ordering

## Supported Translations (11)

| ID | Language | License |
|---|---|---|
| `kjv`, `web`, `bsb`, `asv`, `ylt` | English | Public domain |
| `rv1909` | Spanish | Public domain |
| `vbl` | Spanish | CC BY-SA 4.0 |
| `lsg1910`, `martin1744`, `ostervald` | French | Public domain |
| `bungo` | Japanese | Public domain |

Ingestion status (see `scripts/ingest.py`): 10 of 11 ingest cleanly and pass `validate.py --strict` with zero warnings — `rv1909`, `kjv`, `web`, `lsg1910`, `vbl`, `asv`, `ylt`, `bsb`, `ostervald`, `bungo`. Only `martin1744` (Bible Martin 1744) still needs a dedicated source; it is not on eBible.org, so `data/martin1744/books/` is empty and `validate.py` reports 1 error.

**Japanese sources — read before touching `bungo`.** The old planned source, `bible.salterrae.net`, no longer resolves in DNS; CrossWire's `JapBungo` module preserves that text and is what `ingest.py` now uses (`DistributionLicense=Public Domain`, KJV versification, all 66 books). The underlying translations are 明治元訳 OT (1887) and 大正改訳 NT (1917) — public domain in the US, since even a URAA-restored term caps at 95 years from publication (1982 and 2012). **Do not be talked into un-banning 口語訳 (Kougo).** Japan Bible Society now states its copyright has expired, and that is true *in Japan* (50-year term, lapsed ~2004/2005) — but because it was still protected there on 1996-01-01, the URAA restored its **US** copyright until 2049/2050. Japan-PD does not imply US-PD; the forbidden-translation rule stands.