# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Scriptura is an open-source monorepo for working with Bible data programmatically. It provides freely-licensed Bible translations in canonical JSON format with TypeScript packages for loading, searching, comparing, validating, and serving scripture data.

**Current state.** 10 of the 11 registered translations are ingested and committed (66 books each; `validate.py --strict` reports zero errors and zero warnings). Only `martin1744` is outstanding, and **`data/martin1744/` is deliberately absent** — an empty `books/` dir is a validation error, and CI is worthless if it starts red. Its `TRANSLATIONS` entry in `ingest.py` and its docs rows remain as planned work.

The REST API runs (`npm run dev:api`), serves every translation in every language, and its responses are byte-identical to the static build. 49 tests pass. CI exists. The remaining gaps are GraphQL and the AWS deployment workflow — both still design-only (see Docs → Specified but not built).

Licensed under **Apache 2.0** (chosen over MIT for its explicit patent grant). Individual translations in `data/` carry their own licenses, recorded per-translation in each `metadata.json`.

## Build & Development Commands

```bash
npm install                    # Install all workspace dependencies
npm run build                  # Build all packages (tsc --build)
npm test                       # Run all tests (jest, config in jest.config.ts)
npm run test:contract          # HTTP contract tests (playwright, API mode — no browsers)
npm run lint                   # TypeScript type-check (tsc --build; see note below)
npm run dev:api                # Run the REST API with hot reload (tsx watch) on :3000
npm run start:api              # Build, then run the compiled REST API on :3000
npm run validate               # Validate all translation data (python scripts/validate.py)
npm run check:canon            # Verify the three canon definitions agree (python scripts/check-canon-sync.py)
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

**Workspaces** are `packages/*` plus `examples/node-server` and `examples/cli-demo`, listed explicitly rather than as `examples/*` — `examples/react-app` is a package.json with no source files, and a glob would install the whole vite/react tree for it.

**Node version:** `.nvmrc` pins **Node 24** — the current Active LTS (EOL 2028-04-30). It was Node 20 until that line went end-of-life on 2026-04-30. The repo is developed with `mise`, which reads `.nvmrc` directly once `idiomatic_version_file_enable_tools` includes `node` (`mise settings set idiomatic_version_file_enable_tools "node"`); `mise install` then provisions it. Do not add a `mise.toml` — it would duplicate `.nvmrc` and create another file to keep in sync.

⚠️ **This machine's default Node is newer than `.nvmrc`**, so a bare `npm test` does not prove anything about the pinned version. Use `mise exec node@24 -- …` when it matters.

**Do not upgrade TypeScript past 5.x.** `ts-jest` declares `typescript: ">=4.3 <7"`, so TypeScript 7 (the current `latest`, and the Go rewrite) breaks the test suite. `.github/dependabot.yml` holds it back for the same reason.

**Why `lint` is `tsc --build` and not `tsc --noEmit`:** the packages are composite project references, and TypeScript rejects `--noEmit` on those outright (TS6310). `tsc --build` *is* the type-check; the emitted declarations are a byproduct. Root `tsconfig.json` is a solution file (`files: []` plus `references`) that exists so both `tsc --build` and editors have a single entry point — it holds no compiler options of its own.

## Architecture

**Monorepo** using npm workspaces (`packages/*`). Root `tsconfig.base.json` sets strict mode, `NodeNext` module resolution, ES2022 target, and `composite: true` (required of every project that is referenced by another). Each package extends it.

### Packages (`packages/`)

- **@scriptura/core** (`packages/core/`) — Canonical types and data access layer.
  - `src/types.ts` — All shared types: `Verse`, `Chapter`, `Book`, `Bible`, `TranslationMeta`, `SearchResult`, `TranslationVerse`, `License`, `Testament`
  - `src/loader.ts` — `loadTranslation(id)` reads `data/{id}/` into a `Bible` object with `.verse()`, `.chapter()`, `.book()`, `.slugs()` accessors. `listTranslations()` returns all available translation metadata. Translations are **cached** (keyed by id, holding the in-flight promise) — without it every request re-read and re-parsed all 66 book files. `clearCache()` for tests.
  - `getDataDir()` / `setDataDir()` / `SCRIPTURA_DATA_DIR` — the corpus location, resolved per call rather than frozen at import. Lets tests run against a fixture tree and a deployment relocate `data/`.
  - ⚠️ **Security invariant: `id` is validated before it touches the filesystem.** `translationDir()` allowlists `^[a-z0-9][a-z0-9_-]*$` and then re-checks containment under the data root. This is not optional decoration — a path-traversal review found that while route *path* segments were safe (the router allows one segment and Express does not percent-decode `req.path`), **query strings are decoded**, so `/search?translation=../../../x` and `/compare?translations=…` read any directory shaped like a translation and returned its verses in the response body. Validate at the sink, never in the caller: `/search`, `/compare`, the CLI and any future consumer all go through here. `tests/integration/api.test.ts` stands up a real translation outside the data root and asserts it stays unreachable.
  - `src/books.ts` — book addressing. `slugFromFilename()` (**must stay identical to the same-named function in `scripts/build-static-api.mjs`**) and `normalizeBookKey()`.
    - **Books resolve by slug, localized name, abbreviation, or canonical number.** The slug (`43-john.json` → `john`) is the language-independent key and is what URLs use, in every translation.
    - The slug already *is* the English name in kebab-case, so none of this needs a book table — **it adds no fourth canon definition.**
    - ⚠️ `normalizeBookKey` strips only the Latin combining block (`\u0300-\u036f`). A general `\p{M}` strip also eats the Japanese dakuten (U+3099), silently turning ガラテヤ into カラテヤ. There is a regression test; do not "simplify" it.
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
  - Routes: `/` (a browsable index of endpoints and working examples — without it opening the server in a browser answers "Route not found"), `/translations`, `/translations/:id`, `/translations/:id/:book`, `/translations/:id/:book/:chapter`, `/translations/:id/:book/:chapter/:verse`, `/search?q=&translation=&limit=&offset=`, `/compare?ref=&translations=`
  - The `/` index advertises example URLs, and a test asserts every one of them still returns 200.
  - `src/format.ts` — response formatters. **These shapes are the contract and are deliberately identical to what `scripts/build-static-api.mjs` writes.** A client must be able to point at a local server or at the CDN and get the same JSON. The static builder is zero-dependency `.mjs` that runs without a TS build, so it cannot import these; `tests/integration/static-parity.test.ts` diffs the two implementations instead. **Change a shape in one place and you must change it in the other.**
  - `/search` is paginated (`limit` default 100, max 500). It has to be: `q=the` matches ~28,000 KJV verses.
  - This is the **dynamic** serving path. There is also a **static** serving path (see Deployment) that pre-renders the same data to files for S3/CloudFront.

### Data Layer (`data/`)

One directory per **ingested** translation (10 today). A registered translation with no data yet has no directory at all — an empty `books/` is a validation error. Each contains:
- `metadata.json` — Schema: `{ id, name, language, license, attribution, source_url, year, testament, book_count }`
- `books/` — `01-genesis.json` through `66-revelation.json`, populated by `scripts/ingest.py`. The normalized JSON here **is committed** to the repo (it's the product). The raw upstream downloads used to build it live in `.cache/` and are gitignored.

Book JSON schema: `{ number, name, abbreviation, testament, chapters: [{ number, verses: [{ number, text }] }] }`

The filename prefix (`43-john.json`) encodes the canonical book number and an English slug (`john`). The slug is language-independent and becomes the `:book` URL segment even for non-English translations (`name` inside the file is localized, e.g. "Génesis"). **The slug exists only in the filename, never in the JSON body** — `packages/core` attaches it at load time as `LoadedBook.slug`, which is why the on-disk `Book` type has no `slug` field.

### Scripts (`scripts/`)

- **`ingest.py`** — Downloads open-license source data and normalizes it into the canonical schema. Implemented with three parsers behind a `TRANSLATIONS` registry:
  - `usfx` — parses a USFX XML file from an eBible.org `_usfx.zip` (handles the milestone verse/chapter model, strips footnotes/cross-refs, keeps translator additions). Covers most translations from one consistent source.
  - `aruljohn` — per-book JSON from the aruljohn/Bible-kjv repo (used for `kjv`).
  - `sword` — a CrossWire SWORD zText module (used for `bungo`). Compiled OSIS in a binary block/index format: `.bzs` block index, `.bzz` zlib blocks, `.bzv` verse index. `osis2mod` strips `<verse>` milestones, so verse boundaries live only in `.bzv`; book/chapter structure is recovered from the `<div type="book">` and `<chapter osisID>` markers that get their own index entries, which avoids needing a versification table. Note `.bzv` offsets are **byte** offsets into the decompressed block — slice bytes and decode after, or every multi-byte verse is corrupted.
  - Automated and clean today (10): `rv1909`, `kjv`, `web`, `lsg1910`, `vbl`, `asv`, `ylt`, `bsb`, `ostervald`, `bungo`. All eBible IDs are confirmed against <https://ebible.org/Scriptures/translations.csv> (the authoritative index — check it there before guessing an id). Still registered as `manual`, needing a dedicated source/parser (script skips with a note): `martin1744`.
  - `JA_BOOK_NAMES` supplies Japanese book names for `bungo`, since zText modules carry no per-book localized headers. It is display metadata keyed off `CANONICAL_BOOKS`' USFM codes — **not** a fourth canon definition, and it carries no canon-sync burden.
  - Downloads cache under `.cache/` (gitignored). Flags: `--list`, `--only <id...>`, `--output-dir`, `--no-cache`. Embeds a `CANONICAL_BOOKS` table (USFM codes, slugs, abbreviations) — a canon definition that must stay in sync (see Critical Rules).
- **`validate.py`** — Data integrity gate run by CI (see below).
- **`check-canon-sync.py`** — Cross-checks the three canon definitions against each other and against `data/`. Stdlib-only; parses the TypeScript table with a regex rather than building it. See Critical Rules → Canon sync.
- **`build-static-api.mjs`** — chapter and verse numbers are coerced through `numericSegment()` before becoming path segments, and `writeEndpoint` refuses to write outside `--out-dir`. JSON permits a string where a number belongs, and `join` resolves `../` straight out of the output tree. Node (ESM, zero-dependency) builder that compiles `data/` into a tree of static JSON files under `dist/`, one per REST endpoint, for S3/CloudFront hosting. Endpoints carry a `.json` extension (`/translations/kjv/john/3/16.json`) because the nested verse path forces the chapter segment to be a directory. Emits `/translations.json`, `/translations/:id.json`, `/translations/:id/:book.json`, `/translations/:id/:book/:chapter.json`, and `/translations/:id/:book/:chapter/:verse.json`. Flags: `--data-dir`, `--out-dir`, `--skip-verses` (chapters only — leaner; per-verse files produce a very large object count), `--pretty`. Wire it up as `npm run build:api`.
- **`schema-gen.ts`** — Generates `data/schemas/metadata.schema.json` and `data/schemas/book.schema.json` from the canonical format. Runs via `tsx` (`npm run schema:gen`). Its output is **not** committed today.
  - `data/schemas/` is not a translation, so `validate.py` and `build-static-api.mjs` both skip it via a `NON_TRANSLATION_DIRS` list. **That list exists in both files and must stay in step** — before it did, running `schema:gen` made `npm run validate` fail on a directory that was never a translation.

### Tests (`tests/`)

**Two test runners, with a deliberate split.** The rule is *does the assertion need a real socket?*

| Runner | Command | Owns |
|---|---|---|
| jest | `npm test` | Anything provable in-process: book resolution, canon, parsers, `createRouter` logic, static/dynamic parity |
| Playwright | `npm run test:contract` | Anything needing a real socket: status lines, headers, CORS, HTTP methods, actual JSON serialisation |

Playwright runs in **API mode** — the `request` fixture needs no browser, so `npx playwright install` is never run and CI installs none. `tests/contract/` is in `testPathIgnorePatterns` so jest never tries to run those specs.

The path-traversal regression lives in **both** suites on purpose: it is a security invariant, and the bug it guards was an *adapter*-layer bug (query strings are percent-decoded, path segments are not), so it has to be proven where that difference exists.

⚠️ **`examples/node-server/src/app.ts` must keep exporting `createApp()` without binding a port.** `index.ts` is the only place that calls `listen`. When the app was built at module scope the server could not be tested over HTTP at all — which is how the traversal bug stayed hidden.

⚠️ **A raw socket is required to test encoded paths.** Every HTTP client normalises a URL before sending, so `/translations/%2e%2e` is collapsed to `/` client-side and never reaches the server. `tests/contract/errors.spec.ts` has a `rawGet()` helper that writes the request line verbatim.

Jest with ts-jest. Config in root `jest.config.ts`. 70 tests, plus 33 Playwright contract tests.
- `tests/unit/` — canon completeness (`validate`), type conformance (`core`), and book-key normalization (`books.test.ts`, including the Japanese-dakuten regression).
- `tests/integration/api.test.ts` — drives `createRouter` directly. It is framework-agnostic, so there is no HTTP server, no supertest, no port. Covers every route, book resolution in five languages, error bodies, and pagination.
- `tests/integration/static-parity.test.ts` — runs `build-static-api.mjs` over a two-book slice and asserts each emitted file deep-equals the router's body for the same path. **This is the anti-drift mechanism between the two serving paths.**
- `tests/fixtures/` — `sample-metadata.json` and `sample-verse.json` (John 3:16-17 KJV).

Two config details that are load-bearing:
- `moduleNameMapper` needs `'^(\.{1,2}/.*)\.js$': '$1'`. The sources use NodeNext-style `./loader.js` specifiers, which Jest will not resolve to `.ts`. Without it **no test can import any runtime code** — which is why the original 6 tests passed while exercising almost nothing.
- ts-jest points at `tsconfig.test.json`, not `tsconfig.json`. The root config is a solution file with no `compilerOptions`, so ts-jest pointed there silently falls back to defaults and drops `strict`/`esModuleInterop` from every test.

### Examples (`examples/`)

- `node-server/` — Express server wrapping `@scriptura/api`'s `createRouter`. Run it with `npm run dev:api` (hot reload) or `npm run start:api` (compiled). Uses `app.use`, not `app.get('*')`, which throws on express 5.
- `cli-demo/` — CLI tool using `@scriptura/search` (search, lookup, list commands)
- `react-app/` — Vite + React SPA (package.json only, app code not yet built)
- `python-client/` — Python `requests`-based client for the REST API

### Docs (`docs/`, plus root files)

- `README.md` — public front door.
- `docs/Architecture.md` — the **maintained** architecture spec.
- `scriptura-architecture-spec.md` (repo root) — an **older duplicate** of the same document, kept in sync by hand. Two copies of one spec is a standing drift hazard; the intent is to consolidate on `docs/Architecture.md` and delete the root copy. Until that happens, any architectural change must be written to **both**.
- `docs/translations-status.md` — the per-translation license verification log; update it whenever a translation's source, license, or ingestion state changes.
- `docs/API.md`, `docs/usage-examples.md`, `docs/contributing.md`.

**Specified but not built.** These appear in the docs but do not exist in the repo. Keep them labelled *planned* until the code lands:
- **Deployment workflow and AWS infrastructure** — `deploy.yml` is unwritten and nothing is provisioned. (CI *does* exist now.)
- **GraphQL** — `packages/api` is REST only. There is no schema, resolver, or dependency. Roadmap slots it at v1.1.
- **`crossRefs()`** — appears in usage docs as a future API.

### CI & security (`.github/workflows/`)

Runs on push/PR to `main` and `develop`. Two jobs, deliberately separate so a data problem and a code problem are visibly different failures:
- **`validate-data`** — `python scripts/validate.py` then `python scripts/check-canon-sync.py`, on Python 3.12. No pip install (both are stdlib-only) and no `--strict`, so versification warnings don't fail the build.
- **`build-and-test`** — `npm ci`, `npm run lint`, `npm test`, then `npm run build:api -- --skip-verses` to smoke the static builder. Node comes from `node-version-file: .nvmrc` so the version lives in exactly one place.

`npm ci` requires `package-lock.json` to be committed and current — that is the most likely way to break this workflow.

**`codeql.yml`** runs CodeQL (`javascript-typescript`, `security-and-quality`) on push/PR and weekly. Free and unlimited because the repo is public. It catches what `npm audit` structurally cannot — injection, traversal, unsafe regex — as opposed to known-bad dependency versions.

**`.github/dependabot.yml`** configures weekly *version* updates for the `npm` and `github-actions` ecosystems. The `github-actions` entry exists because this repo's actions went stale onto a deprecated runtime once already. It pins TypeScript below 6 (see the Node version note above).

⚠️ **Dependabot *security* alerts are a repository setting, not a file.** They must be enabled under Settings → Code security; `dependabot.yml` does not turn them on. They were off, which is precisely why the express 4 / `qs` advisories went unnoticed until someone ran `npm audit` by hand. Secret scanning and push protection are already on.

### Deployment (`.github/workflows/deploy.yml`) — ⚠️ NOT YET CREATED

Unwritten, and no AWS infrastructure is provisioned. `npm run build:api` (the static tree itself) does work. The intended design — static, serverless hosting on AWS, on push to `main`:
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
- **Forbidden:** RV1960 (copyrighted by Sociedades Bíblicas Unidas), 口語訳 1954/55 Japanese (US copyright until 2049-2050 via URAA restoration — note that Japan Bible Society now calls its *Japanese* copyright expired, which is true and irrelevant; see the Japanese-sources note under Supported Translations). `scripts/validate.py` actively guards against these — it fails the build if a data directory matches a forbidden id (e.g. `rv1960`, `kougo`) or if metadata contains a forbidden marker (e.g. "reina valera 1960", "口語訳").

### Data validation
- `scripts/validate.py` is the data integrity gate. It runs on every push/PR via CI and must pass. Run it locally before committing data.
- **Errors fail the build** (unambiguous corruption): malformed/missing metadata, missing or invalid license, missing expected book, unexpected book for the declared testament, `book_count` mismatch, duplicate book number, empty verse text, duplicate/invalid verse number, book testament disagreeing with canon, forbidden translation.
- **Warnings do NOT fail the build** (may be legitimate versification differences): chapter count differing from canon (Joel and Malachi have accepted alternates), total verse count outside a rough sanity band, filename prefix not matching internal book number. Verse-number gaps are intentionally NOT flagged, since critical-text translations legitimately omit verses (e.g. Acts 8:37).
- Expected books are **testament-aware**: `testament: "both"` expects all 66, `"OT"` expects 39, `"NT"` expects 27.
- Use `--strict` locally to treat warnings as errors; CI deliberately does not. All ingested translations currently pass `--strict` with **zero warnings** — keep it that way.

### Canon sync
There are now **three** canon definitions that must be kept consistent when any changes:
1. `packages/validate/src/canon.ts` (TypeScript — 66 books + chapter counts)
2. `scripts/validate.py` (`CANON` — 66 books + chapter counts + `CHAPTER_VARIANTS`)
3. `scripts/ingest.py` (`CANONICAL_BOOKS` — 66 books + USFM codes, slugs, abbreviations)

Book numbers, names, and chapter counts must match across all three.

**`scripts/check-canon-sync.py` enforces this** — run by CI, and by `npm run check:canon`. It parses all three definitions plus the committed data and fails on any disagreement about book numbers, names, testaments, chapter counts, abbreviations, or filename slugs. Keeping the three in step used to be a manual discipline, which is exactly how the bug below survived.

**`canon.ts` no longer has an `abbreviation` field, and must not regain one.** It carried OSIS-style values (`Exod`, `1Sam`, `1Kgs`) where the data has `Exo`, `1Sa`, `1Ki` — wrong for 45 of 66 books, undetected because `packages/validate/src/index.ts` reads only `number` and `chapters`. Abbreviations belong to `ingest.py`, which writes them, and to each book's JSON, which carries them; the sync checker verifies those two agree.

Book *addressing* (slug/name/abbreviation/number resolution in `packages/core/src/books.ts`) is deliberately **not** a canon definition: it derives everything from the book filenames, so it needs no table.

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
| `lsg1910`, `ostervald` | French | Public domain |
| `martin1744` | French | Public domain — *not yet ingested, no `data/` dir* |
| `bungo` | Japanese | Public domain |

Ingestion status (see `scripts/ingest.py`): 10 of 11 ingest cleanly and pass `validate.py --strict` with **zero errors and zero warnings** — `rv1909`, `kjv`, `web`, `lsg1910`, `vbl`, `asv`, `ylt`, `bsb`, `ostervald`, `bungo`. Only `martin1744` (Bible Martin 1744) still needs a dedicated source; it is not on eBible.org. **`data/martin1744/` does not exist** and should not be recreated until there is data to put in it — its registry entry in `ingest.py` is where it is tracked.

**Japanese sources — read before touching `bungo`.** The old planned source, `bible.salterrae.net`, no longer resolves in DNS; CrossWire's `JapBungo` module preserves that text and is what `ingest.py` now uses (`DistributionLicense=Public Domain`, KJV versification, all 66 books). The underlying translations are 明治元訳 OT (1887) and 大正改訳 NT (1917) — public domain in the US, since even a URAA-restored term caps at 95 years from publication (1982 and 2012). **Do not be talked into un-banning 口語訳 (Kougo).** Japan Bible Society now states its copyright has expired, and that is true *in Japan* (50-year term, lapsed ~2004/2005) — but because it was still protected there on 1996-01-01, the URAA restored its **US** copyright until 2049/2050. Japan-PD does not imply US-PD; the forbidden-translation rule stands.