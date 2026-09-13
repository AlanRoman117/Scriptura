# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Scriptura is an open-source monorepo for working with Bible data programmatically. It provides freely-licensed Bible translations in canonical JSON format with TypeScript packages for loading, searching, comparing, validating, and serving scripture data.

**Current state.** **All 11 registered translations are ingested and committed** — 66 books each, `validate.py --strict` clean with zero errors and zero warnings.

The REST API runs (`npm run dev:api`), serves every translation in every language, and its responses are byte-identical to the static build. The reader PWA (`apps/reader`) is **complete through Stage 5**: offline reading, notes, colour collections, export, offline search and linking, a downloadable translation library, side-by-side comparison, canvas boards, and opt-in WebMCP tools. It is usable by touch and keyboard alone and conformant with **WCAG 2.2 Level AAA** for its interface (see Apps → *Touch and WCAG 2.2 AAA*); real-device and screen-reader checks are still open. 344 jest and 320 Playwright tests pass. CI exists. The remaining gaps are GraphQL and the AWS deployment workflow — both still design-only (see Docs → Specified but not built).

Licensed under **Apache 2.0** (chosen over MIT for its explicit patent grant). Individual translations in `data/` carry their own licenses, recorded per-translation in each `metadata.json`.

## Build & Development Commands

```bash
npm install                    # Install all workspace dependencies
npm run build                  # Build all packages (tsc --build)
npm test                       # Run all tests (jest, config in jest.config.ts)
npm run test:contract          # HTTP contract tests (playwright, API mode — no browsers)
npm run test:reader            # Reader PWA in Chromium: desktop, emulated phone, dev server (needs `npx playwright install chromium`)
npm run dev:reader             # Reader app dev server on :5173
npm run build:reader           # Production build of the reader
npm run lint                   # TypeScript type-check (tsc --build; see note below)
npm run dev:api                # Run the REST API with hot reload (tsx watch) on :3000
npm run start:api              # Build, then run the compiled REST API on :3000
npm run validate               # Validate all translation data (python3 scripts/validate.py)
npm run check:canon            # Verify the three canon definitions agree (python3 scripts/check-canon-sync.py)
npm run build:api              # Compile data/ into a static JSON API tree in dist/ (node scripts/build-static-api.mjs)
npm run schema:gen             # Generate JSON schemas from types (ts-node scripts/schema-gen.ts)
npm run start:api              # Start example Express server (examples/node-server)
```

Data tooling (Python, standard library only — no install step):

```bash
python3 scripts/ingest.py --list      # Show configured translations + licenses/sources
python3 scripts/ingest.py             # Download & normalize all automated translations into data/
python3 scripts/ingest.py --only kjv  # Ingest a single translation
python3 scripts/validate.py           # Validate data/ (npm run validate wraps this; add --strict locally)
```

Single-package builds: `cd packages/<name> && npm run build`

**Workspaces** are `packages/*` plus `examples/node-server` and `examples/cli-demo`, listed explicitly rather than as `examples/*` — `examples/react-app` is a package.json with no source files, and a glob would install the whole vite/react tree for it.

**Node version:** `.nvmrc` pins **Node 24** — the current Active LTS (EOL 2028-04-30). It was Node 20 until that line went end-of-life on 2026-04-30. The repo is developed with `mise`, which reads `.nvmrc` directly once `idiomatic_version_file_enable_tools` includes `node` (`mise settings set idiomatic_version_file_enable_tools "node"`); `mise install` then provisions it. Do not add a `mise.toml` — it would duplicate `.nvmrc` and create another file to keep in sync.

⚠️ **A machine's default Node may not be the pinned one**, in which case a bare `npm test` proves nothing about Node 24. Use `mise exec node@24 -- …` when it matters. (`engines` in the root `package.json` states the requirement, but npm only warns.)

**Platforms: Linux and macOS**, both covered by the CI matrix.
- ⚠️ **Invoke Python as `python3`, never `python`.** macOS has shipped no bare `python` since 12.3, and Homebrew does not add one either. The shebangs were always `#!/usr/bin/env python3`; only the npm scripts and the docs were wrong. The scripts are stdlib-only with `from __future__ import annotations` throughout, so macOS's bundled 3.9 is sufficient — the interpreter *name* was the whole problem.
- ⚠️ **`actions/setup-python` puts a `python` shim on PATH on every runner, macOS included**, so a macOS CI job would have passed happily with the broken invocation. CI could not have caught that bug; only a real Mac could. This is why the workflow calls `python3` explicitly.
- ⚠️ **`npx playwright install --with-deps` is Linux-only** — it shells out to `apt-get`. The reader job branches on `runner.os`.
- ⚠️ **Never position a caret with `ControlOrMeta+Home`.** The alias is right for Cmd+A and Cmd+C, but macOS does not bind Home to "start of document" in a text field at all, so the caret silently stays put and the test then asserts against wherever the click happened to land. Two reader tests passed on Ubuntu for a year and failed the first time they ran on macOS. Use the `caretAt` helper in `tests/reader/study.spec.ts`: set the offset with `setSelectionRange`, then press a real `ArrowRight` — React's handler listens for key and click events, and a synthesised `select` does not reach it.
- `examples/node-server` binds **127.0.0.1** by default (`HOST` overrides). Binding every interface makes macOS raise its "accept incoming network connections?" prompt, and a Deny leaves Playwright's `webServer` check waiting out its 120s timeout — the classic "the tests hang on my Mac".
- ⚠️ **Regenerate `package-lock.json` on Linux, never on macOS.** It carries the `darwin-arm64` binaries for esbuild, rollup, rolldown, lightningcss and the rest, plus `fsevents`; regenerating on a Mac drops the Linux-only entries and breaks the Ubuntu runners.
- Already portable, and worth not breaking: no hardcoded `/tmp` (everything uses `os.tmpdir()`), no `/proc` or `XDG_*`, no `process.platform` branching, no GNU-only tool flags (`unzip` is Info-ZIP 6.00 on both), no screenshot baselines, and no filename case collisions. `forceConsistentCasingInFileNames` is on — APFS is case-insensitive, so a casing typo written on a Mac compiles there and breaks Ubuntu.

**Do not upgrade TypeScript past 5.x.** `ts-jest` declares `typescript: ">=4.3 <7"`, so TypeScript 7 (the current `latest`, and the Go rewrite) breaks the test suite. `.github/dependabot.yml` holds it back for the same reason.

**Why `lint` is `tsc --build` and not `tsc --noEmit`:** the packages are composite project references, and TypeScript rejects `--noEmit` on those outright (TS6310). `tsc --build` *is* the type-check; the emitted declarations are a byproduct. Root `tsconfig.json` is a solution file (`files: []` plus `references`) that exists so both `tsc --build` and editors have a single entry point — it holds no compiler options of its own.

## Architecture

**Monorepo** using npm workspaces (`packages/*`). Root `tsconfig.base.json` sets strict mode, `NodeNext` module resolution, ES2022 target, `verbatimModuleSyntax`, and `composite: true` (required of every project that is referenced by another). Each package extends it.

**The packages emit ESM.** Every one declares `"type": "module"`, and `module: NodeNext` emits ES modules accordingly; the sources' `./loader.js` specifiers were always the ESM form. This was CommonJS until the divergence it caused became expensive — see *Tests* below. Consequences worth knowing:
- ⚠️ **`__dirname` does not exist.** `packages/core/src/loader.ts` derives its own location from `import.meta.url`; that is the only place that needed it.
- ⚠️ **Changing `"type"` does not invalidate `tsc --build`'s incremental cache.** After a change like that, run `tsc --build --force`, or the stale CommonJS `dist/` sits there looking like a runtime failure.
- `verbatimModuleSyntax` is now on for the **packages as well as the reader**, so a type imported without the `type` keyword is a build error everywhere. That is the rule that keeps `node:fs` out of the browser bundle, and it could not be enforced under CommonJS.

### Packages (`packages/`)

- **@scriptura/core** (`packages/core/`) — Canonical types and data access layer.
  - `src/types.ts` — All shared types: `Verse`, `Chapter`, `Book`, `Bible`, `TranslationMeta`, `SearchResult`, `TranslationVerse`, `License`, `Testament`
  - `src/loader.ts` — `loadTranslation(id)` reads `data/{id}/` into a `Bible` object with `.verse()`, `.chapter()`, `.book()`, `.slugs()` accessors. `listTranslations()` returns all available translation metadata. Translations are **cached** (keyed by id, holding the in-flight promise) — without it every request re-read and re-parsed all 66 book files. `clearCache()` for tests.
  - `getDataDir()` / `setDataDir()` / `SCRIPTURA_DATA_DIR` — the corpus location, resolved per call rather than frozen at import. Lets tests run against a fixture tree and a deployment relocate `data/`.
  - `src/bible.ts` — the in-memory `Bible` model and its book-resolution index (`buildIndex`, `createBible`). **No I/O, no `process`, no `__dirname`.** Split out of `loader.ts` so a browser can rebuild a `Bible` from IndexedDB and get the server's exact resolution rules.
  - ⚠️ **Browser-safety invariant.** `packages/core`'s barrel re-exports `loader.js`, which imports `node:fs` and reads `process.env`/`__dirname` at module scope — importing it from a browser bundle is a build error, and under esbuild/Vite even `import { Verse } from '@scriptura/core'` (no `type` keyword) drags it in. The pure modules are therefore reachable by **subpath**: `@scriptura/core/books`, `@scriptura/core/bible`, `@scriptura/core/types`, `@scriptura/search/matcher`, `@scriptura/compare/chapters`. `packages/{core,search,compare}/package.json` declare `exports` and `sideEffects: false`.
    - **A new subpath must be added in three places**, or it will pass one gate and fail another: the package's `exports` map, `tsconfig.test.json`'s `paths` plus jest's `moduleNameMapper`, and `tests/unit/browser-safety.test.ts`. There used to be a fourth — `optimizeDeps.include` in `apps/reader/vite.config.ts` — and forgetting it built fine while breaking the dev server alone; `@scriptura/compare/chapters` did exactly that. The ESM migration removed that entry and the failure mode with it.
    - **`packages/search/src/matcher.ts` must never import `@scriptura/core`** — only the subpaths. That file is what the PWA uses to search offline with byte-for-byte the API's semantics.
    - `tests/unit/browser-safety.test.ts` bundles those subpaths for a browser target and fails if `node:fs`, `node:path`, `__dirname` or `process.env` appear. It is 6.7KB of output; one careless barrel import breaks the front-end build weeks later for reasons nobody traces back here.
    - Both jest's `moduleNameMapper` and `tsconfig.test.json`'s `paths` need subpath entries — `node10` resolution predates `exports` maps.
  - `parseReference()` in `books.ts` is the **single** reference grammar. `@scriptura/search` and `@scriptura/compare` each had their own regex and disagreed: ranges parsed in one and 400'd in the other, and chapter-only parsed in neither. Accepts `Book C`, `Book C:V`, `Book C:V-V`.
  - ⚠️ **Security invariant: `id` is validated before it touches the filesystem.** `translationDir()` allowlists `^[a-z0-9][a-z0-9_-]*$` and then re-checks containment under the data root. This is not optional decoration — a path-traversal review found that while route *path* segments were safe (the router allows one segment and Express does not percent-decode `req.path`), **query strings are decoded**, so `/search?translation=../../../x` and `/compare?translations=…` read any directory shaped like a translation and returned its verses in the response body. Validate at the sink, never in the caller: `/search`, `/compare`, the CLI and any future consumer all go through here. `tests/integration/api.test.ts` stands up a real translation outside the data root and asserts it stays unreachable.
  - `src/books.ts` — book addressing. `slugFromFilename()` (**must stay identical to the same-named function in `scripts/build-static-api.mjs`**) and `normalizeBookKey()`.
    - **Books resolve by slug, localized name, abbreviation, or canonical number.** The slug (`43-john.json` → `john`) is the language-independent key and is what URLs use, in every translation.
    - The slug already *is* the English name in kebab-case, so none of this needs a book table — **it adds no fourth canon definition.**
    - ⚠️ `normalizeBookKey` strips only the Latin combining block (`\u0300-\u036f`). A general `\p{M}` strip also eats the Japanese dakuten (U+3099), silently turning ガラテヤ into カラテヤ. There is a regression test; do not "simplify" it.
  - Other packages depend on core for types and data loading.

- **@scriptura/search** (`packages/search/`) — Depends on `@scriptura/core`.
  - `search(translationId, query)` — substring match on case- and **diacritic-folded** text. Folding is normalization, not fuzzy matching: `amo` and `amó` are the same word, and treating them as different was a bug that hid ~a third of Spanish and French matches (`amo` in rv1909: 1,102 → 1,473).
  - The folded index is built **lazily per translation** into a `WeakMap` keyed by the `Bible`, so translations that are only read never pay the ~23ms and roughly-doubled text memory. Folding at query time instead would cost ~25ms on every search; this way search stays at ~4ms.
  - Substring, not whole-word, is the **default**, and deliberately: a stem finds archaic inflections (`love` → `loveth`). Whole-word costs 49% of `love` in the KJV and 55% of `amor` in `rv1909` — measured, not guessed.
  - **The cost of substring matching is answered by ranking, and now is.** `matchScore` returns 3 for a whole word, 2 for a word starting with the query, 1 for a match inside a longer word; `searchBible` sorts by it. The sort is stable and the index is canonical, so equal scores keep canonical order without `SearchResult` carrying a book number. This started with a real report: searching `Tito` in Spanish returned `apetito` and `emprestito` alongside Titus.
  - `mode: 'word'` and `caseSensitive` are **opt-in** (`/search?mode=word&match_case=1`, and two checkboxes in the reader). Diacritic folding is never optional — that is normalization, and `foldText` is now `foldDiacritics().toLowerCase()` so case can be separated from it without touching the dakuten guard.
  - ⚠️ **Word mode must be a no-op for scripts without word separators.** Japanese is written without spaces, so the CJK scripts are excluded from the word-character class *and* `hasWordBoundaries()` decides per **query**, not per occurrence. A per-occurrence rule still quietly dropped 52 of 3,945 matches for `神`; the per-query rule makes `mode=word` return *exactly* the substring results, and a test asserts equality for `神`, `イエス` and `ヨハネ`. Without it the toggle takes `神` from 3,945 verses to 3.
  - ⚠️ **`runQuery` in the reader must score every term through `matchScore`.** Terms 2..n used to re-fold and call `includes` directly, so under `mode: 'word'` the first term matched whole words and the rest matched anywhere. A result keeps its **worst** term's score. Exclusions stay substring even in word mode — asking to drop `love` should drop `loveth` too.
  - **There is no index of biblical people, and none is planned.** Proper nouns are exactly the words that are always whole words (`Abraham` 230/230 and `ヨハネ` 146/146 are unchanged by word mode), so ranking already answers "search for a character" without a fourth canon-shaped table keyed across 11 translations in 4 languages.
  - `lookup(translationId, reference)` — Reference parser supporting "Book Ch:V" and "Book Ch:V-V" ranges

- **@scriptura/compare** (`packages/compare/`) — Depends on `@scriptura/core`.
  - `compareVerse(reference, translationIds)` — Side-by-side verse across translations
  - `compareChapter(book, chapter, translationIds)` — Full chapter comparison. **Loading is all it does**; the comparison itself lives in the I/O-free `src/chapters.ts` (`compareChapterOf`, `alignChapters`), reachable as `@scriptura/compare/chapters`, so the reader PWA runs the server's own implementation against IndexedDB rather than a second one that drifts.
  - ⚠️ **`alignChapters` keys rows on the verse *number*, never the array index.** Critical-text translations legitimately omit verses (Acts 8:37 is the standard case), so index alignment silently shows different verses beside each other from the omission onward — the exact failure a comparison exists to prevent. There is a regression test.

- **@scriptura/validate** (`packages/validate/`) — Data integrity engine.
  - `src/canon.ts` — Complete 66-book Protestant canon with expected chapter counts. One of THREE canon definitions that must stay in sync (see Critical Rules → Canon sync).
  - `validate(dir)` / `validateAll(dir)` — Checks: metadata exists, license is valid, all 66 books present, chapter counts match canon, no empty verse text

- **@scriptura/api** (`packages/api/`) — Depends on core + search.
  - `src/router.ts` — Framework-agnostic `createRouter(req)` matching REST routes. Returns `{ status, body }` — integrate with Express, Fastify, etc.
  - Routes: `/` (a browsable index of endpoints and working examples — without it opening the server in a browser answers "Route not found"), `/translations`, `/translations/:id`, `/translations/:id/full`, `/translations/:id/:book`, `/translations/:id/:book/:chapter`, `/translations/:id/:book/:chapter/:verse`, `/search?q=&translation=&limit=&offset=`, `/compare?ref=&translations=`, `/compare/chapter?book=&chapter=&translations=`
  - ⚠️ **`/translations/:id/full` must precede the book route**, which would otherwise read `full.json` as a book name and 404 with a list of valid slugs. It is also the **only** route that accepts a `.json` suffix, and that is deliberate: the static tree appends `.json` to every endpoint, and this is the single URL a browser client fetches directly, so the same string has to resolve against a live server and against the CDN. The reader would otherwise install translations from one origin and 404 against the other.
  - The `/` index advertises example URLs, and a test asserts every one of them still returns 200.
  - Chapter and verse payloads carry `license` and `attribution`. They did not, which meant an offline client caching chapters had no copy of a notice CC BY-SA 4.0 requires it to display (`vbl` is the one non-public-domain translation). Derive `requiresAttribution = license !== 'public-domain' && license !== 'cc0'`.
  - `formatSearch()` echoes `mode` and `match_case` in the envelope, because they change what `total` counts — a client showing "1,382 matches" has to be able to say what was counted. `tests/contract/routes.spec.ts` asserts the exact key set, so adding a field there is a deliberate act.
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
  - `sword` — a CrossWire SWORD zText module (used for `bungo` and `martin1744`). Compiled OSIS in a binary block/index format: `.bzs` block index, `.bzz` zlib blocks, `.bzv` verse index. `osis2mod` strips `<verse>` milestones, so verse boundaries live only in `.bzv`; book/chapter structure is recovered from the `<div type="book">` and `<chapter osisID>` markers that get their own index entries, which avoids needing a versification table. Note `.bzv` offsets are **byte** offsets into the decompressed block — slice bytes and decode after, or every multi-byte verse is corrupted.
    - ⚠️ **`_osis_marker` encodes three rules that modules disagree on. Do not "simplify" any of them.** Attribute order is not fixed (`JapBungo` writes `<div osisID=… type="book"/>`, `FreBDM1744` writes `<div canonical="true" osisID=… type="book"/>`), so matching must be order-independent. A marker only counts if **no real text precedes it** in the entry — `FreBDM1744` puts paragraph divs before it, while `JapBungo` puts the *next* chapter's opening marker after a verse's text. And when an entry holds several markers the **last** one wins: `FreBDM1744`'s Haggai opens and closes an empty `Hag.2` before opening `Hag.1`, so taking the first filed all of Haggai 1 under chapter 2. Each rule has a translation that breaks without it.
  - **All 11 are automated.** eBible IDs are confirmed against <https://ebible.org/Scriptures/translations.csv> (the authoritative index — check it there before guessing an id); CrossWire module ids and licences against <https://www.crosswire.org/ftpmirror/pub/sword/raw/mods.d/>. There is no `manual` translation left.
  - `FR_BOOK_NAMES` supplies French book names for `martin1744`, taken from the committed `data/ostervald/` corpus, because FreBDM1744 embeds only the long `x-usfm-toc1` form ("Le Saint Evangile de Notre Seigneur Jésus-Christ selon Saint Matthieu") and leaves the short `toc2` empty. Same role as `JA_BOOK_NAMES` — display metadata, **not** a canon definition.
  - ⚠️ **CrossWire `DistributionLicense` is meaningful, not boilerplate.** `frebdm1744` declares `Public Domain`; its sibling `frebdm1707` declares `Copyrighted; Permission to distribute granted to CrossWire` and is therefore **not usable here**. Read the `.conf` before adding any module.
  - `JA_BOOK_NAMES` supplies Japanese book names for `bungo`, since zText modules carry no per-book localized headers. It is display metadata keyed off `CANONICAL_BOOKS`' USFM codes — **not** a fourth canon definition, and it carries no canon-sync burden.
  - Downloads cache under `.cache/` (gitignored). Flags: `--list`, `--only <id...>`, `--output-dir`, `--no-cache`. Embeds a `CANONICAL_BOOKS` table (USFM codes, slugs, abbreviations) — a canon definition that must stay in sync (see Critical Rules).
- **`validate.py`** — Data integrity gate run by CI (see below).
- **`check-canon-sync.py`** — Cross-checks the three canon definitions against each other and against `data/`. Stdlib-only; parses the TypeScript table with a regex rather than building it. See Critical Rules → Canon sync.
- **`build-static-api.mjs`** also emits **`/translations/:id/full.json`** — the whole translation in one file (~1.26 MB gzipped) with `license`, `attribution`, and `books[]` carrying `slug`/`name`/`abbreviation`/`testament`. This is what an offline PWA fetches; precaching a translation chapter-by-chapter would be ~1,189 requests and ~1,189 Cache entries.
- **`build-static-api.mjs`** — chapter and verse numbers are coerced through `numericSegment()` before becoming path segments, and `writeEndpoint` refuses to write outside `--out-dir`. JSON permits a string where a number belongs, and `join` resolves `../` straight out of the output tree. Node (ESM, zero-dependency) builder that compiles `data/` into a tree of static JSON files under `dist/`, one per REST endpoint, for S3/CloudFront hosting. Endpoints carry a `.json` extension (`/translations/kjv/john/3/16.json`) because the nested verse path forces the chapter segment to be a directory. Emits `/translations.json`, `/translations/:id.json`, `/translations/:id/:book.json`, `/translations/:id/:book/:chapter.json`, and `/translations/:id/:book/:chapter/:verse.json`. Flags: `--data-dir`, `--out-dir`, `--skip-verses` (chapters only — leaner; per-verse files produce a very large object count), `--pretty`. Wire it up as `npm run build:api`.
- **`schema-gen.ts`** — Generates `data/schemas/metadata.schema.json` and `data/schemas/book.schema.json` from the canonical format. Runs via `tsx` (`npm run schema:gen`). Its output is **not** committed today.
  - `data/schemas/` is not a translation, so `validate.py` and `build-static-api.mjs` both skip it via a `NON_TRANSLATION_DIRS` list. **That list exists in both files and must stay in step** — before it did, running `schema:gen` made `npm run validate` fail on a directory that was never a translation.

### Tests (`tests/`)

**Two test runners, with a deliberate split.** The rule is *does the assertion need a real socket?*

| Runner | Command | Owns |
|---|---|---|
| jest | `npm test` | Anything provable in-process: book resolution, canon, parsers, `createRouter` logic, static/dynamic parity |
| Playwright `contract` | `npm run test:contract` | Anything needing a real socket: status lines, headers, CORS, HTTP methods, actual JSON serialisation. **No browser** — the `request` fixture needs none. |
| Playwright `reader` | `npm run test:reader` | The PWA in Chromium, against a **production build** — the service worker and precache manifest do not exist in dev, and offline reading is the promise being tested. Needs `npx playwright install chromium`. Downloads run against the compiled API the contract suite already starts, proxied at `/api`, so the library tests exercise the real `full.json`. |
| Playwright `reader-touch` | (same command) | The same production build under Chromium's **Pixel 7** descriptor — touch events, a coarse pointer, no hover. Every `(hover: none)` and `(pointer: coarse)` rule is only reachable here, and it runs the phone gates: axe, 44px targets, reflow at 320px, text spacing. No extra browser download. |
| Playwright `reader-dev` | (same command) | The PWA against the **dev server**, which resolves modules completely differently. Small on purpose: it asserts the app boots clean. |

⚠️ **Dev and production used to resolve modules differently, and only production was tested.** `vite build` ran the `@scriptura/*` CommonJS output through Rollup's commonjs plugin; the dev server did **not** pre-bundle *linked* workspace dependencies, so it served `dist/bible.js` raw and the browser rejected it — *"does not provide an export named 'createBible'"*. The app was broken in the mode a developer uses all day while every test passed. `optimizeDeps.include` papered over it, but had to be remembered for every new subpath, and `@scriptura/compare/chapters` was duly forgotten.

**The packages emit ESM now, so both modes read the same files and the workaround is gone.** `tests/reader-dev/` remains the guard and still has teeth: replacing an emitted `dist/*.js` with CommonJS content reproduces the original error and fails the job. ⚠️ Note it keys on the emitted **content**, not on the `"type"` field — Vite parses the file rather than trusting the manifest, so reverting `"type"` alone does *not* reproduce it.

Playwright runs in **API mode** — the `request` fixture needs no browser, so `npx playwright install` is never run and CI installs none. `tests/contract/` is in `testPathIgnorePatterns` so jest never tries to run those specs.

The path-traversal regression lives in **both** suites on purpose: it is a security invariant, and the bug it guards was an *adapter*-layer bug (query strings are percent-decoded, path segments are not), so it has to be proven where that difference exists.

⚠️ **`examples/node-server/src/app.ts` must keep exporting `createApp()` without binding a port.** `index.ts` is the only place that calls `listen`. When the app was built at module scope the server could not be tested over HTTP at all — which is how the traversal bug stayed hidden.

⚠️ **A raw socket is required to test encoded paths.** Every HTTP client normalises a URL before sending, so `/translations/%2e%2e` is collapsed to `/` client-side and never reaches the server. `tests/contract/errors.spec.ts` has a `rawGet()` helper that writes the request line verbatim.

Jest with ts-jest. Config in root `jest.config.ts`. **344 jest tests, plus 320 Playwright** (47 contract, 207 reader, 64 reader-touch, 2 reader-dev).
- `tests/unit/` — canon completeness (`validate`), type conformance (`core`), and book-key normalization (`books.test.ts`, including the Japanese-dakuten regression).
- `tests/integration/api.test.ts` — drives `createRouter` directly. It is framework-agnostic, so there is no HTTP server, no supertest, no port. Covers every route, book resolution in five languages, error bodies, and pagination.
- `tests/integration/static-parity.test.ts` — runs `build-static-api.mjs` over a two-book slice and asserts each emitted file deep-equals the router's body for the same path. **This is the anti-drift mechanism between the two serving paths.**
- `tests/fixtures/` — `sample-metadata.json` and `sample-verse.json` (John 3:16-17 KJV).

Config details that are load-bearing:
- **Jest runs as ESM**, matching what the packages ship: `extensionsToTreatAsEsm: ['.ts']`, ts-jest with `useESM: true`, and `NODE_OPTIONS=--experimental-vm-modules` in the `test` script (without which jest cannot load an ES module at all). Compiling the specs as CommonJS would have reintroduced the very split the migration removed — shipping ESM while testing something else — and TypeScript rejects `import.meta` under CommonJS outright (TS1343), which is exactly what `loader.ts` needs.
- ⚠️ **`__dirname` is unavailable in the specs too.** `tests/unit/core.test.ts`, `tests/unit/browser-safety.test.ts` and `tests/integration/static-parity.test.ts` derive their paths from `import.meta.url`.
- `tsconfig.test.json` uses `moduleResolution: Bundler`, not `NodeNext`, so the specs can keep importing `../../apps/reader/src/lib/references` without an extension while the sources' `./loader.js` specifiers still map onto the `.ts` files.
- `moduleNameMapper` needs `'^(\.{1,2}/.*)\.js$': '$1'`. The sources use NodeNext-style `./loader.js` specifiers, which Jest will not resolve to `.ts`. Without it **no test can import any runtime code** — which is why the original 6 tests passed while exercising almost nothing.
- ts-jest points at `tsconfig.test.json`, not `tsconfig.json`. The root config is a solution file with no `compilerOptions`, so ts-jest pointed there silently falls back to defaults and drops `strict`/`esModuleInterop` from every test.

### Apps (`apps/`)

- **`apps/reader`** — the local-first reading and note-taking PWA. Vite + React 19 + TypeScript. `npm run dev:reader` / `npm run build:reader`.
  - **Imports only the pure subpaths** — `@scriptura/core/bible`, `@scriptura/core/types`, `@scriptura/search/matcher`. Importing `@scriptura/core` itself would pull `node:fs` into the bundle. `verbatimModuleSyntax` makes a missing `type` keyword a build error — here, and now in the packages too.
  - The `Bible` is rebuilt in the browser with the server's own `createBible`, so book resolution and search folding are identical online and off rather than a second implementation that drifts.
  - **The bundled translation is not precached.** `apps/reader/scripts/bundle-translation.mjs` emits `public/bible/bsb.json` (~4.4MB) by calling the real static builder, so it is byte-identical to what the CDN serves. It also emits `public/bible/catalog.json` — every translation's metadata plus an `approx_bytes` map — so the library renders and stays browsable **offline**; a live `/translations` is merged over it when one is reachable. `vite.config.ts` sets `globIgnores: ['**/bible/**']` — putting 4.4MB in the Workbox precache manifest would block service-worker install on a large download and re-download the lot whenever its hash changed. The app fetches it once into IndexedDB instead. The precache is 9 entries / 200KB.
  - Generated output (`public/bible/`, `dev-dist/`) is gitignored.
  - Fonts are **system stacks, not webfonts**. A local-first reader should not need a font download to render scripture, and self-hosting a face would put binary assets in a repository whose product is text.
  - **`src/lib/db.ts` is the durability layer.** Stores are separate on purpose (`translations`, `settings`, `notes`, `highlights`) so a damaged one cannot take the others down — `readSafely` returns a fallback and reports rather than throwing, because rendering what survived beats rendering nothing. `writeSafely` reports a failure **once per store**: a quota error repeats on every keystroke, and a toast per keystroke trains people to dismiss the one message that matters. Shape borrowed from PrepWise's `tests/storage-resilience.spec.js`.
  - `navigator.storage.persist()` is a **request the browser may refuse**, and "clear site data" wipes everything regardless. `DurabilityBanner` states the real answer instead of assuming success, and always offers an action: export now, or mirror to a folder via the File System Access API (Chromium-only, opt-in, `src/lib/export.ts`).
  - **`src/lib/zip.ts` is a hand-written store-only ZIP.** Export is the promise that the data is genuinely the user's, so it does not rest on a third-party archiver; notes are small markdown, so skipping deflate removes a whole implementation and leaves a format short enough to audit. `tests/unit/zip.test.ts` verifies it against the **system `unzip`**, including a non-ASCII round-trip — an archive only our own reader can open would defeat the point.
  - **Highlights are anchored to `{book_slug, chapter, verse}` — the passage, not the translation.** The translation is stored as provenance but is deliberately *not* part of the key. It was, until the five colours became five collections; keyed as `bsb:john:1:1` every collection would empty itself the moment Stage 4 lets you switch translation, which is not a collection. `listHighlights` re-keys legacy 4-segment ids on read and merges duplicates to the older mark.
  - **A colour is a collection, not just a shade.** `MarksPanel` reads the highlights back as five running lists — highlighting yellow for one study subject and red for another was otherwise write-only, since finding them again meant going back through chapters by hand. Nothing new is stored to support it: a highlight already carries its colour and its address. Each colour takes an optional user label (`colorLabels` in `SETTINGS`) because "Amber" is a shade and "Covenant promises" is a subject. Lists are ordered **canonically**, not by when each verse was marked — a subject is walked in order.
  - **The whole verse is the click target**, with the swatches centred beneath it (`VerseActions`; on a phone the row docks above the notes sheet instead). A control in the left margin meant reaching out to the margin and then travelling back across the line to reach the swatches at the far end — a lot of mouse for one quick act. ⚠️ The click is ignored when `window.getSelection()` is **not collapsed**, so a drag that selects text to read or copy does not trip the swatches; `tests/reader/notes.spec.ts` drags with real mouse events and fails without the guard.
  - ⚠️ **The verse number is a `<button>`, and cannot use `vertical-align: super`.** That needs `line-height: 0` to keep the superscript from stretching the line box — and a zero line height collapses a button to zero height, which Playwright correctly reports as "element is not visible" and a user cannot click either. It is raised with `position: relative; top: -.35em` instead. It is also the keyboard path to the swatches, since a clickable `<p>` has none.
  - **An insertion always leaves a blank line after it, and parks the cursor there** (`insertIntoNote`). Quoting is nearly always followed by writing about what was quoted. Focus follows a quote from the Bible but *not* an insert from the search panel — that panel stays open on purpose so several results can be added in a row.
  - **Every insertion says so, in words, where it went, until the next action** (`confirmInsert` in `App.tsx`). Quote, Link, the search and results `+`, a comparison's `+`, a board's "Add to note" and the verse actions' Canvas each leave behind a control that has gone, and on a phone at peek there was no sign at all that a quote had landed. "✓ Quoted John 1:2" shows in the notes' status line, on the sheet's grip at peek, or in a bar when the Bible is maximized, and is announced with the note's name. Starting a note with a quote now reports its save like any other write.
    - ⚠️ **Clear it where the next action happens** — an edit, another note, a new chapter, bringing the notes into view — **never from an effect on the active note.** That effect also fires for the quote that creates a note, and wipes its confirmation in the same render.
    - ⚠️ **No timer** (2.2.3). `tests/reader/study.spec.ts` installs Playwright's clock and fast-forwards two minutes to prove nothing dismisses it.
    - ⚠️ The grip's `aria-label` carries the confirmation: visible words on a button are part of its name (2.5.3). And only the save state in the status line is a live region — the confirmation beside it is plain text, or a screen reader would hear it twice.
  - ⚠️ **Do not assert on the "Saved" label in tests.** Creating a note also reports Saved, so an edit's assertion can match the earlier message and the test then reloads before the autosave debounce flushes. `tests/reader/notes.spec.ts` has a `persisted()` helper that reads IndexedDB directly.
  - **Search runs offline through the server's own matcher** (`@scriptura/search/matcher`), so results are identical online and off, folding included. `src/lib/search.ts` adds only the *grammar* — quoted phrases and `-exclusions` — and `runQuery` returns **every** match: the caller slices for display but must report the true count, or `God` and `God -love` both read "200 matches".
  - One search box replaces a verse dropdown: a reference jumps (`John 3:16`, `Juan 3:16`, `jn 3`, `43 3:16`, ranges), anything else searches. Reuses `parseReference` and the book index, so anything the API accepts works here.
  - ⚠️ **The suggestions reopen on typing.** They are open while the query is non-empty until the reader dismisses them (`dismissed` in `SearchBar`, cleared on every keystroke). Enter closes them to clear the way for the passage it jumped to, but the input keeps DOM focus — so without the reset a reader typing a second reference gets no panel and no feedback at all. They no longer depend on focus: a 150ms blur timer used to close them, which made them unreachable by Tab.
  - ⚠️ **A search surface lags the query it is drawn from by one render**, and that is the shape of every flake this suite has had on a slow runner. The reference and the hits are recomputed in an effect, so between a keystroke and that effect the panel shows the **new query with the previous answer** — and because the element was on screen the whole time, `toBeVisible()` succeeds instantly and Playwright never retries. Waiting on *content* is the fix, not waiting on presence:
    - `jumpTo` in `tests/reader/study.spec.ts` waits for `search-jump` to name the **destination** before pressing Enter. Waiting only for the button to appear jumped to the previous reference.
    - `search-count` carries `data-query`, the query its total actually answers (`hitsQuery` in App). Tests wait for that attribute rather than for visibility.
    - And never assert `John 1` in a jump test — the reader opens on it, so the assertion passes without anything having happened, which is how this stayed invisible for a year.
  - **The dropdown is for jumping; `SearchResults` is for counting.** The dropdown showed the first 40 of a total it gave no way to walk — "1,382 matches" was a number you could read and not act on. The full view holds every hit, and its **per-book breakdown** is the better answer to a counting question anyway ("Matthew 237, Mark 249, …") as well as being the filter. ⚠️ The list grows in pages of 100 on request: `the` matches ~28,000 verses in KJV, and rendering that many rows is a hung tab. A test asserts the per-book counts **sum to the total**, so the breakdown cannot quietly describe a subset.
  - **Links persist as the slug, with an optional translation qualifier**: `[[john 3:16@kjv]]`. `src/lib/references.ts`. Two things are recorded and they are not the same: *which passage* (the slug, never a display name — `[[Juan 3:16]]` would not resolve after switching to `kjv`) and *which translation it was taken from*. Without the second, quoting Genesis 1:4 from KJV and from VBL produced two identical `[[genesis 1:4]]` links: the note said which version each quote was in its citation line and then discarded that in the link beneath it. The qualifier is **optional on both sides**, so notes written before it keep working. `@` is safe as the separator — slugs are `[a-z0-9-]` and no localized book name contains one.
  - **A link is followable from the cursor.** The note surface is a plain textarea, so there is nothing to click: `linkAt(text, offset)` finds the `[[…]]` the cursor sits in, and the notes pane offers "Go to Genesis 1:4 (KJV)". Following one switches translation when the link names an installed one, and says "(KJV — not downloaded)" when it does not, rather than silently landing in a different version. Before this, `WIKILINK` and `resolveLink` were written but wired to nothing — links were inert text.
  - Quoted passages carry the citation *and* the attribution line when the licence requires it: a note holding `vbl` text inherits CC BY-SA when exported.
  - The notes editor pins the heading the cursor sits under, and the chapter title is sticky beneath the reading bar — both the sticky-scroll idea, because a long chapter or note gives no clue where you are from inside it. Both describe the *caret*, so both are hidden in preview.
  - **`EditorToolbar` rides in with focus and leaves with it, above the writing.** "Collapsed by default" cannot mean absent: nobody discovers that `##` makes a heading by staring at a textarea. It sat *below* the surface at first, which in a long note puts the heading button a scroll away from the text it applies to. Its row height is reserved whether or not the tools are showing, so appearing does not shove the text you just clicked on down the pane. The tools show while focus is anywhere in the editing group (`.notes__editor`), decided by `relatedTarget` rather than a timer; the toolbar is one Tab stop with arrow keys. ⚠️ One `mousedown` guard stays, on the toolbar element: Safari does not focus a button on click, so without it a pointer press blurs the note and unmounts the tools before the click lands. The keyboard path needs no stored selection — a textarea keeps its selection range while blurred.
  - **`src/lib/mdedit.ts` — formatting as pure text operations**, so the selection arithmetic is testable without a browser. Every operation **toggles**; a toolbar that can only add syntax strands the reader it exists for. ⚠️ `toggleWrap` compares the **whole run** of marker characters, not the marker's length: a word inside `**` has a single `*` on each side, so asking for italic there would read as "already italic" and silently un-bold it.
  - **`src/lib/markdown.ts` + `MarkdownPreview` — reading a note back.** ⚠️ It parses to a **tree, never to an HTML string**, and nothing reaches `innerHTML`: a note is arbitrary text and may have been drafted by an assistant. Preview shares the pane rather than taking a second column, and **clicking a block returns to the editor with the caret in that block** — blocks carry their source offset for exactly this — so reading and fixing are one gesture instead of a mode to leave first. Each block also carries a real "Edit here" button, because a clickable `<div>` is not reachable by keyboard; note headings render two levels down (`#` is an `h3`) under the page's `h1` and the pane's `h2`.
  - **A board embeds in a note as a fence** (` ```scriptura-board `) holding its id, and renders as a diagram, the role a mermaid fence plays. On **export the fence is replaced with the board's Markdown** (`inlineBoardEmbeds`): in the app it draws, but a `.md` opened anywhere else would show a code block containing a UUID. ⚠️ The embed's SVG `marker` and `clipPath` ids are scoped to the board and node — two embeds in one note would otherwise collide.
    - ⚠️ **Embed labels are cut to the drawn width, not to a character count**, and the width is **measured, never estimated**. `title.slice(0, 25)` spilled out of the box at any real scale; a proportional estimate then passed locally and overflowed by 2px on CI, because the same system font stack resolves to different faces on different machines. Canvas `measureText` parses the stack correctly but disagrees with SVG by about a pixel — another margin to guess at — so `measure()` uses an offscreen `<text class="embed__label">`: same engine, same font, same metrics, nothing left to estimate. The clip stays as a last guarantee. A board too wide to shrink past `MIN_SCALE` scrolls sideways instead — a genealogy squeezed into 560px is illegible boxes, not a diagram.
    - The overflow test measures `getComputedTextLength()`, not a bounding box: clipping is a paint operation, so the box still reports the full untruncated width and a bounding-box test would pass on the clip alone while the label was really being cut off.
  - ⚠️ **An `@container` block adds no specificity.** The narrow-notes rules must come *after* the base ones or `.notes__select { flex: 1 }` wins and the note picker collapses to a bare chevron. The bar is not sticky, so it simply wraps rather than squeezing six controls until Delete is a sliver.
  - ⚠️ `IntersectionObserver`'s `rootMargin` takes px and % only. A `rem` value throws on construction and takes the whole pane down; the sticky-title detection compares offsets instead.
  - **`src/lib/canvas.ts` + `CanvasView` — boards.** The spec asks for this for visual learners who otherwise export passages into GoodNotes or Notability to lay them out, so the value is in *not* leaving the app: boards are stored content and go into the export zip as Markdown alongside the notes. **A card holds an anchor, never rendered text** — a verse card records `{book_slug, chapter, verse}` and is read out of whichever translation is open, a note card records the note id — so a board does not quietly become a stale snapshot. Full-width rather than a third pane: a map squeezed into 400px is a list with extra steps.
    - Cards start at `CARD_W × CARD_H` (in `canvas.ts`, not the component; 280 × 180 since every card control became 44px, with `cardSize()` applying floors so the footer always fits) and carry an optional `w`/`h` once resized, so an edge is drawn without measuring the DOM every drag frame and `freeSlot` can reason about overlap. ⚠️ `freeSlot` must test the **card's own footprint**: an earlier version offset by 30px and called anything over 20px apart "free", which for a 220×132 card is almost entirely on top of it.
    - Card bodies **scroll**; they were line-clamped, which put the rest of a whole note or a long verse permanently out of reach. ⚠️ `.card__actions` reserves right padding for the 44px resize corner, which otherwise sits on top of the last action and swallows every press aimed at it.
    - ⚠️ **Dragging the background pans, and the check cannot be `e.target !== e.currentTarget`** — `.canvas__plane` is absolutely positioned over the whole frame, so the press always lands on the plane and panning did nothing at all. It tests `closest(...)` instead — and ⚠️ the selector lists every control, not only `.card`: capturing the pointer makes Chromium deliver the following click to the capturing element, so a press on the connection chip that also began a pan never clicked the chip. The wheel pans and ctrl/⌘-wheel zooms at the pointer, bound with `{ passive: false }` because React's `onWheel` is passive and `preventDefault()` there is ignored — the page scrolls out from under the board instead.
    - A `text` card's title is editable; `verse` and `note` cards derive theirs from what they point at, so there is nothing to drift. `describeNode`/`nodeLabel` in `canvas.ts` are the single implementation, used by the board, the embed and the export alike.
    - Edges are clipped to the card boundary, not drawn from centres — centre-to-centre hides the line under both cards, which in the grid new cards land in leaves a connection invisible at the moment it is drawn. Drags clamp at the origin and the zoom-reset pans to the content, so a card cannot be lost off the plane.
  - **`src/lib/webmcp.ts` — WebMCP, off by default.** Follows PrepWise's model directly (`assets/js/webmcp.js`, `docs/webmcp-plan.md`): **reads are answered, writes are staged, never applied.** Nine tools; the two `propose_*` ones stage a preview and report that they are *awaiting confirmation*, never that they succeeded. There is deliberately **no tool that deletes a note, removes a mark, or clears a board** — a test asserts no tool name contains delete/remove/clear/reset.
    - `resolveModelContext()` is the whole blast radius for spec churn: WebMCP is a W3C Community Group draft, not on the Standards Track, and both `document.modelContext` and `navigator.modelContext` are checked because being wrong costs a feature detect while guessing wrong costs the feature.
    - ⚠️ **The one-proposal-at-a-time guard is a ref, not state.** React state is only current after a render, so two tool calls in the same tick both saw "nothing pending" and the second replaced the first — the reader would have been looking at one draft and confirming another. `tests/reader/webmcp.spec.ts` calls twice back-to-back with no wait.
    - `ProposalPreview` shows **contents, not counts**: the whole note body, every verse with its text, all editable. "Add 12 highlights" is not something anyone can meaningfully consent to. What is applied is what comes back from the preview, so an edit or an unticked verse is honoured rather than the staged original.
    - The enabled flag is in `localStorage`, not the IndexedDB stores: it describes *this device*, not the user's work, so it is neither exported nor mirrored — and reading it synchronously keeps registration from racing a database open.
  - Attribution renders beside the text whenever `requiresAttribution(meta)` — derived from the licence, not hardcoded to `vbl` — because CC BY-SA requires the notice where the material appears. In a comparison the material can be in any column, so `ComparePane` renders a notice per obliged column.
  - **`src/lib/` is layered to avoid a cycle**: `api.ts` holds only what both sides need (`API_BASE`, `DEFAULT_TRANSLATION`, `FullTranslation`), `library.ts` downloads and installs, `translation.ts` reads. `library.ts` importing `translation.ts` and back again was briefly papered over with a dynamic import, which Rollup rightly reported bought nothing since both land in the same chunk.
  - **The library (`src/lib/library.ts`, `LibraryPanel`).** Eleven translations is ~65MB of JSON, so nothing is fetched in bulk: each is downloaded, read offline, and deleted individually, with its approximate size shown *before* committing to it. The bundled default has no Remove — deleting it leaves nothing to read the moment the network goes, which is the one state the app exists to survive.
    - ⚠️ **`Content-Length` is the *compressed* length on a gzipped response while `response.body` yields decompressed bytes**, so using it as the progress denominator sails past 100%. `downloadPercent` (in `src/lib/units.ts`, kept free of `import.meta` so jest can reach it) clamps, and the build-time `approx_bytes` is preferred as the denominator because it is the right scale for decompressed bytes.
    - Language headings come from `Intl.DisplayNames`: `metadata.json` stores an ISO code, and "en / es / fr / ja" is correct data but a useless heading.
  - **`/api` is proxied** to `SCRIPTURA_API_ORIGIN` (default `http://127.0.0.1:3000`) in both `server` and `preview` config, so downloads work in dev and in the Playwright reader project — which points it at the compiled server the contract suite already starts. `VITE_SCRIPTURA_API` overrides the base for a real deployment.
  - ⚠️ **The pane divider's floor is a width (`MIN_PANE = 320`), not a share.** A quarter of a 1400px window is a workable 350px column; a quarter of a 900px one is 225px, too narrow for the reading bar's own controls and about four words to the line. `tests/reader/chrome.spec.ts` asserts the floor.
    - **The divider is a bar, `--divider-w` (52px) wide, that holds its two nudge buttons** — it was an 11px line with 44px buttons hanging over both panes. ⚠️ Its width is part of the split sum: `splitLimits` subtracts the measured column from the notes' share, and `.layout`'s `grid-template-columns` clamps the Bible column to the same floors so a window narrowed afterwards keeps them too. ⚠️ A drag keeps the offset at which the pointer took hold; setting the bar's edge to the pointer jumps a 52px bar. The default split is 56%, so the bar's width comes out of both panes. ⚠️ On the bar's rule colour `--edge` is only 2.6:1 in the light theme, so the grip and the buttons' borders there are `--ink-soft`; `tests/unit/contrast.test.ts` measures those pairs on `--rule`.
    - **Each pane's maximize button is the last control in that pane's own bar** (`MaximizeButton` in `components/PaneControl.tsx`, fed by a context Layout provides only side by side). It was absolutely positioned in the pane's corner: first in Tab order while drawn last, jammed against the divider, and the notes pane kept an empty row for it. ⚠️ The notes bar's buttons are `flex: none` and the bar wraps at 29rem, just above what one row measures, so a button is never squeezed across its label; Delete and Maximize wrap as one group, or arming Delete strands Maximize alone on a line.
    - ⚠️ A 44px `inline-flex` button packs its content to the start: the reader chips need `justify-content: center`, or a one-glyph chip draws its icon off centre (the gear was 5px out, the "?" 10px).
  - **Touch and WCAG 2.2 AAA.** The programme that made the reader usable by a finger and conformant at AAA lives in `docs/plans/reader-touch-and-aaa/`: the plan, a matrix of all 86 success criteria with the evidence for each, the delegation protocol and the briefs. The claim covers the app's own interface; scripture and notes are content, so 3.1.5 and 3.1.6 are exempt for them and nothing else is. A change to the reader keeps these:
    - **The floor.** Every pointer target is 44 × 44 CSS px (`--control-h`); text is 7:1 on its background; every focusable element shows the 2px ring; every control's name contains its visible text; scripture carries `lang`; no meaning is colour alone; motion respects `prefers-reduced-motion` *and* `data-motion`. `/AGENTS.md` rule 9 is the same list.
    - **Preferences** are `src/lib/prefs.ts` plus a short inline script in `index.html` that applies them before first paint; `tests/unit/prefs.test.ts` reads both and fails if they disagree. `system` is an *absent* attribute, never a value, so `prefers-*` stay the defaults. ⚠️ 1.4.8's paragraph spacing is 1.5 × the **line spacing**, not the font size — the relaxed gap is 2.85em at a 1.9 leading, not 1.5em.
    - **Tokens** are `light-dark()` pairs between `/* @tokens … */` markers in `styles.css`, five themes; `tests/unit/contrast.test.ts` parses them and checks 135 pairs. `--edge` is a control boundary (3:1) and `--rule` is decoration — they were one token, which is how every border came to be 1.24:1. ⚠️ A highlighted verse's number is `--ink`: the accent is 8:1 on paper but 6.9:1 over the amber tint. ⚠️ A JSDoc comment cannot quote a `*/` marker — it ends the comment, and jest reports "Invalid left-hand side expression in postfix operation". jest's `expect` takes one argument; put the pair in the test name.
    - ⚠️ **The 44px block comes first in the stylesheet**, so any later component rule with its own `min-width`/`min-height` wins at equal specificity — the formatting tools kept `min-width: 1.9rem` and measured 30px on a phone. `tests/helpers/targets.ts` is the measurer for both browser projects; its allowlist carries a reason per entry and nothing is added to make a run green.
    - **Focus and Escape go through `src/lib/focus.ts`.** Never add a `window` keydown listener: `useDismissable` is one stack and closes only the newest surface. ⚠️ `useReturnFocus` restores focus only if it was actually lost — Quote closes the verse actions *and* moves focus into the note on purpose. ⚠️ Closing on `pointerdown` reflowed the inline swatches out from under the pointer, so the verse actions leave presses on another `.verse` to that verse (`ignore`). The proposal is a native `<dialog>`; guard `showModal()` with `if (!el.open)` for StrictMode.
    - **The visual viewport** is published as `--vvh`/`--vv-top` (`src/lib/viewport.ts`) — iOS does not move `position: fixed` for the keyboard. The notes sheet is anchored from it; `--bar-h`, `--search-h`, `--pane-top` and `--sheet-h` are *measured*, never assumed. ⚠️ On a first visit the storage notice sits above the pane, so room above the keyboard is measured from the top of the screen, not the pane. Every drag goes through `usePointerDrag` (pointer capture; `pointercancel` = up). `html, body` do not scroll.
    - ⚠️ **The sheet's note had 40px** with a half-screen keyboard until `@container sheet-body (max-height: 28rem)` hid the note bar while the note is edited. Snapping and zoom/pinch arithmetic are pure functions in `src/lib/geometry.ts` with jest tests.
    - ⚠️ **The docked verse actions are `position: fixed` inside `.reader`, a size container.** Chromium 153 keeps that viewport-relative (checked); Safari is on brief 91's device list.
    - ⚠️ **No popup ARIA on the search input.** `aria-expanded` and `aria-haspopup` are not allowed on a searchbox; the suggestions are an in-flow region inside `<form role="search">`, reached by Tab or Down arrow.
    - **The board** is operable without a drag: cards and the frame take focus (arrows move, Alt+arrows resize, Delete arms removal), Move/Size and Colour panels sit at the bottom of the frame (a card clips its contents and moves under zoom, so an anchored popover would be cut off), pan buttons sit beside the zoom, and the Connections list is the arrows' text alternative. Removing a card is confirmed; card and connection removals can be undone until the next change.
    - **Updates wait for the reader** (`registerType: 'prompt'`, `clientsClaim: true`; `UpdateNotice` is mounted beside `<App/>` with the announcer). ⚠️ The plugin reloads only if a worker controlled the page when the app registered, so on a first visit Reload did nothing; the notice reloads on `controllerchange` itself. ⚠️ Autosave pending edits are keyed **per note** (`src/lib/pending.ts`, `flushSaves` in App): the old single debounce let an edit to a second note cancel the first note's save. They flush on the timer, on Reload, and when the page is hidden.
    - **Testing it.** `reader-touch` sends drags and pinches through the DevTools protocol (`Input.dispatchTouchEvent`) — `page.touchscreen` can only tap — and simulates the software keyboard by injecting `--vvh` with `!important`. The reflow and text-spacing gates each plant a failure first to prove they can fail. ⚠️ `@axe-core/playwright`'s `resultTypes: ['violations']` silently drops the two AAA rules on 4.13.0 (92 rules reported without it, 88 with); `tests/reader/a11y.spec.ts` asserts they ran. ⚠️ **Never scope axe to an element** (`.include('#root')`): its page-level rules then report *inapplicable* and say nothing. That hid ten rules in every state, six of them WCAG A/AA (`bypass`, `document-title`, `html-has-lang`, `html-lang-valid`, `meta-viewport`, `aria-hidden-body`), plus `region`; the self-check asserts those ran too. Two consequences of the whole-page run: the pane divider is exempt from `region` the way axe already exempts the buttons beside it, and the phone's "writing a note" state waits for the full sheet to stop growing, since axe counts it as a modal over the inert Bible only at full size. ⚠️ Playwright's request routing never sees the browser's check for a newer service worker, so the update tests serve the built app from their own server on their own origin. ⚠️ Playwright specs compile as CommonJS here: no `import.meta` — resolve paths from `testInfo.project.testDir`.

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
- `docs/plans/` — work programmes, each with a plan, its evidence and self-contained briefs. `reader-touch-and-aaa/` holds the WCAG 2.2 matrix; update its rows in the same commit as the change they describe.
- `AGENTS.md` (repo root) — the short rules for any automated contributor (Grok, Antigravity, Codex, …). It points here rather than copying: **CLAUDE.md is the authority**, and where the two differ this file wins.
- `.claude/agents/reader-a11y-lead.md` — the Opus subagent that owns the reader plan: picks and sharpens briefs, hands them out, reviews what comes back against `docs/plans/reader-touch-and-aaa/DELEGATION.md`.

**Search is documented in three places, at three depths.** `README.md` has the
short version with one diagram, `docs/Architecture.md` (and its root duplicate)
carries the full pipeline, the scoring rule and the CJK case, and `docs/API.md`
covers the HTTP surface. All three carry the measured numbers rather than
adjectives — change the behaviour and the tables need re-measuring, not just
rewording. The mermaid diagrams were validated against the real mermaid parser;
GitHub renders them, so a syntax error is visible to everyone.

**Specified but not built.** These appear in the docs but do not exist in the repo. Keep them labelled *planned* until the code lands:
- **Deployment workflow and AWS infrastructure** — `deploy.yml` is unwritten and nothing is provisioned. (CI *does* exist now.)
- **GraphQL** — `packages/api` is REST only. There is no schema, resolver, or dependency. Roadmap slots it at v1.1.
- **`crossRefs()`** — appears in usage docs as a future API.

### CI & security (`.github/workflows/`)

Runs on push/PR to `main` and `develop`. Two jobs, deliberately separate so a data problem and a code problem are visibly different failures:
- **`validate-data`** — `python3 scripts/validate.py` then `python3 scripts/check-canon-sync.py`, on Python 3.12. No pip install (both are stdlib-only) and no `--strict`, so versification warnings don't fail the build.
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

## Supported Translations (11 — all ingested)

| ID | Language | License |
|---|---|---|
| `kjv`, `web`, `bsb`, `asv`, `ylt` | English | Public domain |
| `rv1909` | Spanish | Public domain |
| `vbl` | Spanish | CC BY-SA 4.0 |
| `lsg1910`, `ostervald`, `martin1744` | French | Public domain |
| `bungo` | Japanese | Public domain |

Ingestion status (see `scripts/ingest.py`): **all 11 ingest cleanly** and pass `validate.py --strict` with zero errors and zero warnings.

**Japanese sources — read before touching `bungo`.** The old planned source, `bible.salterrae.net`, no longer resolves in DNS; CrossWire's `JapBungo` module preserves that text and is what `ingest.py` now uses (`DistributionLicense=Public Domain`, KJV versification, all 66 books). The underlying translations are 明治元訳 OT (1887) and 大正改訳 NT (1917) — public domain in the US, since even a URAA-restored term caps at 95 years from publication (1982 and 2012). **Do not be talked into un-banning 口語訳 (Kougo).** Japan Bible Society now states its copyright has expired, and that is true *in Japan* (50-year term, lapsed ~2004/2005) — but because it was still protected there on 1996-01-01, the URAA restored its **US** copyright until 2049/2050. Japan-PD does not imply US-PD; the forbidden-translation rule stands.