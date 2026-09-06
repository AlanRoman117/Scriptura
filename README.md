# 📖 Scriptura

> **Open Bible data ecosystem — multi-translation, multi-language, developer-first.**

[![License: Apache 2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)
[![Translations](https://img.shields.io/badge/translations-10%20ingested%20%C2%B7%2011%20verified-green.svg)](#verified-translations)
[![Languages](https://img.shields.io/badge/languages-4-orange.svg)](#verified-translations)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](docs/contributing.md)
[![Data: Open License Only](https://img.shields.io/badge/data-open--license--only-important.svg)](#verified-translations)

Scriptura is a free, open-source monorepo for working with Bible data programmatically. It provides structured, machine-readable scripture across multiple translations and languages — all under verified public-domain or open-source licenses — alongside TypeScript tooling for search, comparison, validation, and API generation.

**The mission is simple: no developer should hit a paywall, a DMCA notice, or a legal grey area when building with the Bible.**

---

## ✨ Features

- 📚 **Multi-translation** — 11 verified translations, 10 fully ingested
- 🌍 **Multi-language** — English, Spanish, French, and Japanese
- 🔍 **Search** — full-text and reference-based lookup via `@scriptura/search`
- ⚖️ **Compare** — side-by-side multi-translation diff via `@scriptura/compare`
- 🛡️ **Validated** — every translation carries verified license metadata, checked by `scripts/validate.py`
- 🔌 **API-ready** — framework-agnostic REST handlers in `@scriptura/api` (GraphQL is planned — see [Project status](#-project-status))
- 🧩 **Modular** — install only what you need (`@scriptura/core`, `/search`, `/api`, etc.)
- 📖 **Study Bible foundation** — comparison engine built to support future annotation and cross-reference layers

---

## 📦 Packages

| Package | Description |
|---|---|
| `@scriptura/core` | Loader, parser, canonical TypeScript types |
| `@scriptura/search` | Full-text search + reference lookup (e.g. `"John 3:16"`) |
| `@scriptura/compare` | Multi-translation verse/chapter diff engine |
| `@scriptura/validate` | Data integrity checker for translation directories |
| `@scriptura/api` | REST handlers (drop into any Node server or edge runtime); GraphQL planned |

---

## 🚀 Quick start

**Prerequisites:** Node 20 (pinned in [`.nvmrc`](.nvmrc)) and Python 3.9+ for the
data tooling. Any `.nvmrc`-aware version manager works — `nvm use`, `fnm use`, or
`mise install` (mise reads `.nvmrc` once `idiomatic_version_file_enable_tools`
includes `node`).

```bash
# Clone the repo
git clone https://github.com/AlanRoman117/scriptura.git
cd scriptura

# Install all workspace dependencies
npm install

# Validate all translation data
npm run validate

# Run the tests
npm test
```

### Load a verse in Node

```typescript
import { loadTranslation } from '@scriptura/core';

const bible = await loadTranslation('kjv');
const verse = bible.verse('John', 3, 16);

console.log(verse.text);
// "For God so loved the world, that he gave his only begotten Son..."
```

### Search across a translation

```typescript
import { search } from '@scriptura/search';

const results = await search('rv1909', 'amor eterno');
results.forEach(r => console.log(`${r.ref}: ${r.text}`));
```

### Compare a verse across translations

```typescript
import { compareVerse } from '@scriptura/compare';

const diff = await compareVerse('John 3:16', ['rv1909', 'kjv', 'web']);
diff.forEach(d => console.log(`[${d.translation}] ${d.text}`));
```

### REST API

```bash
# Start the API server (from examples/node-server)
npm run start:api

# Fetch a verse
curl http://localhost:3000/translations/kjv/john/3/16

# Search
curl "http://localhost:3000/search?q=love&translation=kjv"
```

> Comparison is available as a library (`@scriptura/compare`, shown above) but is
> not yet exposed as a `/compare` HTTP route — that is planned alongside the
> hosted API. See [Project status](#-project-status).

---

## 🗄️ Populating the data

The `data/` directory is generated from verified open-license sources by
[`scripts/ingest.py`](scripts/ingest.py) — a dependency-free Python script
(standard library only, 3.9+) that downloads each translation and normalizes it
into the canonical JSON schema below.

```bash
# List every configured translation with its license and source
python scripts/ingest.py --list

# Ingest all automated translations
python scripts/ingest.py

# Ingest a single translation (a good first run)
python scripts/ingest.py --only kjv
```

Raw downloads are cached under `.cache/` (git-ignored) so re-runs are instant.
The normalized output in `data/` **is** committed to the repo — that structured
data is the product.

**Ten of the eleven translations ingest cleanly today** — `kjv`, `web`, `asv`,
`ylt`, `bsb`, `rv1909`, `vbl`, `lsg1910`, `ostervald`, and `bungo` — covering
English, Spanish, French, and Japanese. Each is 66 books and passes
`python scripts/validate.py --strict` with zero warnings. Only `martin1744`
(Bible Martin 1744, French) still needs a source; it is registered with a note
and the script skips it. Run `--list` for current status.

Three parsers sit behind the `TRANSLATIONS` registry:

| Parser | Source shape | Used by |
|---|---|---|
| `usfx` | USFX XML in an eBible.org `_usfx.zip` | most translations |
| `aruljohn` | per-book JSON from aruljohn/Bible-kjv | `kjv` |
| `sword` | a CrossWire SWORD zText module (compiled OSIS) | `bungo` |

eBible translation IDs are easy to guess wrong. Confirm them against
[eBible's own index](https://ebible.org/Scriptures/translations.csv) rather than
constructing them by hand.

> **Adding a translation?** Add an entry to the `TRANSLATIONS` table in
> `scripts/ingest.py` with a verified `license` and a `source_url` confirming
> it, then run the validator before committing. See [Contributing](#-contributing).

---

## 📂 Repository structure

```
scriptura/
├── data/                        # Bible text — one directory per translation
│   ├── rv1909/                  # Reina Valera 1909 (Spanish, public domain)
│   ├── kjv/                     # King James Version (English, public domain)
│   ├── web/                     # World English Bible (English, public domain)
│   ├── bsb/                     # Berean Standard Bible (English, public domain)
│   ├── asv/                     # American Standard Version (English, public domain)
│   ├── ylt/                     # Young's Literal Translation (English, public domain)
│   ├── lsg1910/                 # Louis Segond 1910 (French, public domain)
│   ├── martin1744/              # Bible Martin 1744 (French, public domain)
│   ├── ostervald/               # Bible Ostervald (French, public domain)
│   ├── vbl/                     # Versión Biblia Libre (Spanish, CC BY-SA 4.0)
│   └── bungo/                   # 文語訳聖書 Classical Japanese (public domain)
│
├── packages/
│   ├── core/                    # Canonical types, loader, parser
│   ├── search/                  # Full-text + reference search
│   ├── compare/                 # Multi-translation diff engine
│   ├── validate/                # Schema & integrity checks
│   └── api/                     # REST + GraphQL handlers
│
├── scripts/
│   ├── ingest.py                # Download & normalize source data
│   ├── validate.py              # Run integrity checks on all translations
│   ├── build-static-api.mjs     # Compile data/ → dist/ static JSON API tree
│   └── schema-gen.ts            # Generate TypeScript types from JSON schema
│
├── examples/
│   ├── react-app/               # Vite SPA using @scriptura/core
│   ├── node-server/             # Express API using @scriptura/api
│   ├── python-client/           # Python wrapper around the REST API
│   └── cli-demo/                # Node CLI using @scriptura/search
│
├── tests/
├── docs/
│   ├── API.md
│   ├── usage-examples.md
│   ├── contributing.md
│   └── translations-status.md   # License verification log
│
└── package.json                 # npm workspaces root
```

---

## ✅ Verified translations

All translations in this repository are independently verified to be public domain or explicitly open-licensed. **No copyrighted text is included or will be accepted via PR.**

| ID | Name | Language | License | Primary source | Ingested |
|---|---|---|---|---|---|
| `kjv` | King James Version | English 🇬🇧 | Public domain | [aruljohn/Bible-kjv](https://github.com/aruljohn/Bible-kjv) | ✅ |
| `web` | World English Bible | English 🇺🇸 | Public domain | [eBible.org `engwebp`](https://ebible.org/find/details.php?id=engwebp) | ✅ |
| `asv` | American Standard Version (1901) | English 🇺🇸 | Public domain | [eBible.org `eng-asv`](https://ebible.org/eng-asv/) | ✅ |
| `ylt` | Young's Literal Translation | English 🇬🇧 | Public domain | [eBible.org `engylt`](https://ebible.org/engylt/) | ✅ |
| `bsb` | Berean Standard Bible | English 🇺🇸 | Public domain (2023) | [eBible.org `engbsb`](https://ebible.org/engbsb/) | ✅ |
| `rv1909` | Reina Valera 1909 | Spanish 🇪🇸 | Public domain | [eBible.org `spaRV1909`](https://ebible.org/find/details.php?id=spaRV1909) | ✅ |
| `vbl` | Versión Biblia Libre | Spanish 🇪🇸 | CC BY-SA 4.0 | [eBible.org `spavbl`](https://ebible.org/find/details.php?id=spavbl) | ✅ |
| `lsg1910` | Louis Segond 1910 | French 🇫🇷 | Public domain | [eBible.org `fraLSG`](https://ebible.org/fraLSG/) | ✅ |
| `ostervald` | Bible Ostervald (1867) | French 🇫🇷 | Public domain | [eBible.org `fra_fob`](https://ebible.org/fra_fob/) | ✅ |
| `bungo` | 文語訳聖書 (Classical) | Japanese 🇯🇵 | Public domain | [CrossWire `JapBungo`](https://www.crosswire.org/sword/modules/ModInfo.jsp?modName=JapBungo) | ✅ |
| `martin1744` | Bible Martin 1744 | French 🇫🇷 | Public domain | *source still needed* | ⏳ |

> **⚠️ Hard rules on what will never be added:**
> - **Reina Valera 1960 (RV1960)** — copyrighted © Sociedades Bíblicas Unidas, renewed 1988. "Reina-Valera 1960®" is a registered trademark. Not public domain despite the common misconception.
> - **口語訳聖書 / Kougo (1954/55)** — the one people get wrong. Japan Bible Society now states its copyright has expired, and that is true **in Japan** (50-year term, lapsed ~2004/2005). But because it was still protected there on 1996-01-01, the URAA **restored its US copyright until 2049–2050**. Japan-PD does not imply US-PD. Off-limits for any US-hosted project, and `validate.py` blocks it by id and by metadata marker.
>   - By contrast, the 文語訳 (Bungo) text we *do* ship is 明治元訳 OT (1887) and 大正改訳 NT (1917) — public domain in the US, since even a URAA-restored term caps at 95 years from publication (1982 and 2012).
> - Any translation without a `license` field in its `metadata.json` will be rejected by CI.

---

## 📐 Data schema

Each translation directory follows this structure:

```
data/{translation-id}/
├── metadata.json       # Translation metadata and license
└── books/
    ├── 01-genesis.json
    ├── 02-exodus.json
    └── ...             # 66 books, zero-padded numeric prefix for sort order
```

**`metadata.json`**
```json
{
  "id": "kjv",
  "name": "King James Version",
  "language": "en",
  "license": "public-domain",
  "attribution": "King James Version — Public Domain",
  "source_url": "https://github.com/aruljohn/Bible-kjv",
  "year": 1769,
  "testament": "both",
  "book_count": 66
}
```

**`books/01-genesis.json`**
```json
{
  "number": 1,
  "name": "Genesis",
  "abbreviation": "Gen",
  "testament": "OT",
  "chapters": [
    {
      "number": 1,
      "verses": [
        { "number": 1, "text": "In the beginning God created the heaven and the earth." }
      ]
    }
  ]
}
```

---

## 📊 Project status

| Area | State |
|---|---|
| Translation data | 10 of 11 ingested, 66 books each, clean under `validate.py --strict` |
| TypeScript packages | Build, type-check, and pass unit tests on Node 20 |
| Static API build | Working — `npm run build:api` emits ~12.5k JSON files |
| Tests | Thin: 6 unit tests; `tests/integration/` is still a placeholder |
| GraphQL | Not built (planned v1.1) |
| `GET /compare` route | Not built — `@scriptura/compare` is library-only for now |
| CI / deployment | **Not built** — no `.github/` workflows exist; validation is manual |

The AWS hosting design (S3 + CloudFront with OAC, GitHub OIDC auth, Lambda for
the dynamic `/search` and `/compare` paths) is specified in
[`docs/Architecture.md`](docs/Architecture.md) but not yet provisioned.

---

## 🗺️ Roadmap

| Version | Focus |
|---|---|
| **v1.0** | Core loader + search + REST API + initial translation data |
| **v1.1** | GraphQL layer + additional translations |
| **v2.0** | `@scriptura/compare` — multi-translation diff (study Bible foundation) |
| **v2.1** | Cross-reference data (via Open Scriptures) |
| **v3.0** | Annotation layer — personal notes and highlights per verse |
| **v3.1** | Public domain commentary integration (via CCEL) |
| **v4.0** | Study Bible UI — React app consuming all packages |

---

## 🤝 Contributing

Contributions are welcome and encouraged. Please read [`docs/contributing.md`](docs/contributing.md) before opening a PR.

**The most important rule:** every translation addition must include a `metadata.json` with a verified `license` field and a link to the primary source confirming it. PRs that add translation data without this will not be merged.

Run the validator before you open a PR — there is no CI workflow yet, so this check is currently manual:

```bash
python scripts/validate.py --strict
```

Other ways to contribute:
- Port a new verified public-domain translation into the canonical JSON schema
- Improve the TypeScript package API or add tests
- Add an example app in a new language or framework
- Improve documentation

---

## 📄 License

This repository is licensed under the **Apache License 2.0** — see [`LICENSE`](LICENSE) for details.

Apache 2.0 was chosen over MIT for one specific reason: it includes an explicit **patent grant**. Any contributor who holds a patent covering code they contribute cannot later sue users of this project for infringement. For an open project intended to serve developers everywhere with no strings attached, that protection matters.

Individual Bible translations in `data/` carry their own licenses as documented in each `metadata.json`. All are either public domain or an explicitly open license (CC BY-SA 4.0 or CC0). No translation under a restrictive or proprietary license is included.

---

## 🙏 Acknowledgments

Key upstream sources that made this possible:

- [eBible.org](https://ebible.org) — the most comprehensive source of freely licensed scripture in structured formats, and the origin of eight of our eleven translations
- [CrossWire Bible Society](https://www.crosswire.org) — the SWORD project, whose `JapBungo` module preserves the classical Japanese text after its original host (`bible.salterrae.net`) went offline
- [aruljohn/Bible-kjv](https://github.com/aruljohn/Bible-kjv) — clean KJV JSON
- [worldenglish.bible](https://worldenglish.bible) — the World English Bible project
- [berean.bible](https://berean.bible) — the Berean Standard Bible project
- [scrollmapper/bible_databases](https://github.com/scrollmapper/bible_databases) and [seven1m/open-bibles](https://github.com/seven1m/open-bibles) — multi-format Bible databases, still the leading candidates for `martin1744`

---

## 👥 About this project

Scriptura was conceived and built by **[Alan Roman](https://github.com/AlanRoman117)**, with architecture, research, and documentation developed in collaboration with **[Claude](https://claude.ai)** (Anthropic).

The belief behind it is simple: the Bible has no copyright. The Word of God belongs to everyone. This project exists so that developers everywhere — regardless of resources, language, or background — can build with scripture freely, correctly, and confidently.

> *"For God so loved the world..."* — and the world should be able to read it in any language, in any app, without a licensing agreement.

---

<p align="center">
  Built with ❤️ and conviction &nbsp;·&nbsp; Open source forever
</p>