# Translation Status & License Verification Log

This document tracks license verification and ingestion status for each
translation in Scriptura. **Every row must cite a primary source confirming the
license before its data may be committed.**

## Verified translations

| ID | Name | Language | License | Verified source | Parser | Status |
|---|---|---|---|---|---|---|
| `kjv` | King James Version | en | Public domain | [aruljohn/Bible-kjv](https://github.com/aruljohn/Bible-kjv) | `aruljohn` | Complete |
| `web` | World English Bible | en | Public domain | [eBible `engwebp`](https://ebible.org/find/details.php?id=engwebp) | `usfx` | Complete |
| `asv` | American Standard Version (1901) | en | Public domain | [eBible `eng-asv`](https://ebible.org/eng-asv/) | `usfx` | Complete |
| `ylt` | Young's Literal Translation | en | Public domain | [eBible `engylt`](https://ebible.org/engylt/) | `usfx` | Complete |
| `bsb` | Berean Standard Bible | en | Public domain (2023) | [eBible `engbsb`](https://ebible.org/engbsb/) | `usfx` | Complete |
| `rv1909` | Reina Valera 1909 | es | Public domain | [eBible `spaRV1909`](https://ebible.org/find/details.php?id=spaRV1909) | `usfx` | Complete |
| `vbl` | Versión Biblia Libre | es | CC BY-SA 4.0 | [eBible `spavbl`](https://ebible.org/find/details.php?id=spavbl) | `usfx` | Complete |
| `lsg1910` | Louis Segond 1910 | fr | Public domain | [eBible `fraLSG`](https://ebible.org/fraLSG/) | `usfx` | Complete |
| `ostervald` | Bible Ostervald (1867) | fr | Public domain | [eBible `fra_fob`](https://ebible.org/fra_fob/) | `usfx` | Complete |
| `bungo` | 文語訳聖書 (Classical) | ja | Public domain | [CrossWire `JapBungo`](https://www.crosswire.org/sword/modules/ModInfo.jsp?modName=JapBungo) | `sword` | Complete |
| `martin1744` | Bible Martin 1744 | fr | Public domain | [CrossWire `FreBDM1744`](https://www.crosswire.org/sword/modules/ModInfo.jsp?modName=FreBDM1744) | `sword` | Complete |
| `cuvs` | 新标点和合本 (Union Version, 1919) | zh-Hans | Public domain | [eBible `cmn-cu89s`](https://ebible.org/cmn-cu89s/) | `usfx` | Complete |
| `cuvt` | 新標點和合本 (Union Version, 1919) | zh-Hant | Public domain | [eBible `cmn-cu89t`](https://ebible.org/cmn-cu89t/) | `usfx` | Complete |
| `blivre` | Bíblia Livre | pt-BR | CC BY 4.0 | [eBible `porbr2018`](https://ebible.org/porbr2018/) | `usfx` | Complete |

**Status key:**
- **Complete** — all 66 books ingested; passes `scripts/validate.py --strict` with zero warnings
- **Partial** — some books ingested, ingestion in progress
- **Not started** — no `data/` directory yet

A translation with no data has **no `data/` directory at all**. An empty
`books/` is a validation error, so the directory is created by the first
successful ingest, not ahead of it. Until then the translation is tracked by its
entry in `scripts/ingest.py`'s `TRANSLATIONS` registry and by its row above.

## Verification notes

### eBible source IDs
Confirm any eBible id against [eBible's own index](https://ebible.org/Scriptures/translations.csv)
rather than constructing it by hand. Several plausible-looking guesses are
wrong — `engasv` returns 404; the American Standard Version is `eng-asv`.

Three translations originally filed as needing a bespoke source turned out to be
on eBible already: `bsb` (`engbsb`, the post-2023 public-domain release),
`ostervald` (`fra_fob`), and `asv` (`eng-asv`).

### `bungo` — 文語訳聖書
The originally planned source, `bible.salterrae.net`, **no longer resolves in
DNS**. CrossWire's `JapBungo` SWORD module preserves that text and declares
`DistributionLicense=Public Domain`.

Rights basis: the underlying translations are 明治元訳 OT (1887) and 大正改訳 NT
(1917). Both are public domain in the US — even a URAA-restored term caps at 95
years from publication, i.e. 1982 and 2012.

Known caveat, accepted: the module is set from the 1950 (NT) and 1953 (OT)
printings, and Japan Bible Society prints a `©1887, 1917, 1982` notice on its
own 文語訳 edition. Reprints do not restart a copyright term and typographic
arrangement is not protectable in either the US or Japan, so the risk is low —
but if those mid-century printings introduced substantive editorial revisions,
that thin layer is an unknown.

### `martin1744` — Bible David Martin 1744
Published 1744; David Martin died 1721. Public domain worldwide by age, with no
URAA question — the work predates every restoration cutoff by well over a
century.

Sourced from CrossWire's `FreBDM1744` SWORD module, which declares
`DistributionLicense=Public Domain`. STEPBible serves the same text (it renders
CrossWire modules via JSword), so CrossWire is the upstream and the right place
to cite.

⚠️ **CrossWire's licence field is meaningful, not boilerplate.** The sibling
module `frebdm1707` (Martin 1707) declares `Copyrighted; Permission to
distribute granted to CrossWire` — a grant to CrossWire is not a grant to us, so
that module is **not usable here**. Always read the `.conf`.

Note the module carries a malformed chapter sequence in Haggai (an empty `Hag.2`
opens and closes before `Hag.1`). `scripts/ingest.py` handles it; see the
`_osis_marker` notes in CLAUDE.md.


## Forbidden translations

`scripts/validate.py` actively blocks these — by directory id and by metadata
marker — and fails the build if either appears.

| Translation | Why |
|---|---|
| **Reina Valera 1960 (RV1960)** | Copyrighted © Sociedades Bíblicas Unidas, renewed 1988. "Reina-Valera 1960®" is a registered trademark. Not public domain, despite the common misconception. |
| **口語訳聖書 / Kougo (1954/55)** | US copyright until 2049–2050 via URAA restoration. |
| **개역한글판 / Korean Revised Version (1952/1961)** | Public domain in Korea since 2012; US copyright restored by the URAA until 2056. The same trap as Kougo — see below. |
| **개역개정판 / NKRV (1998)** | Under copyright, Korean Bible Society. |
| **和合本修訂版 / RCUV (2010), 新譯本 / CNV** | Revisions still under copyright. The 1919 和合本 itself is in the library as `cuvs`/`cuvt`. |
| **ARA, ARC 1995/2009, ACF, NVI, NTLH (Brazilian Portuguese)** | All under copyright — Sociedade Bíblica do Brasil and Sociedade Bíblica Trinitária. The library carries Bíblia Livre instead. |

### The Korean trap: the same shape, a different label
eBible publishes [`kor`](https://ebible.org/kor/) as "The Holy Bible in Korean,
1910 translation", marked **Public Domain**, and CrossWire's `korrv` carries the
same text with the same label. Neither is the 1910/11 구역.

Checked against Korean Wikisource on 2026-09-17:

| | Genesis 1:1 |
|---|---|
| eBible `kor` | 태초에 하나님이 천지를 창조하시니라 |
| [개역한글판 (1961)](https://ko.wikisource.org/wiki/개역한글판/창세기) | 태초에 하나님이 천지를 창조하시니라 |
| [셩경젼셔 (1911)](https://ko.wikisource.org/wiki/셩경젼셔/창셰긔) | 태초에 하ᄂᆞ님이 텬디를 창조ᄒᆞ시다 |

It is the 개역한글판, word for word, and the 1911 text it claims to be reads
quite differently in archaic Hangul. The 개역's Korean term (50 years from 1961)
ran out at the end of 2011, so it was still protected on 1996-01-01 — and the
URAA therefore restored its **US** copyright, 95 years from publication: **2056**.
Korea-PD does not imply US-PD, exactly as with Kougo.

So there is no Korean Bible in the library yet. `korhkjv` is copyrighted
outright. The genuinely public-domain 1911 구역 survives on Korean Wikisource in
archaic Hangul (arae-a ㆍ, no word spacing), which no parser here reads; adding
it is a piece of work, not a download.

### The Kougo trap
Japan Bible Society [now states](https://www.bible.or.jp/read/bible_copyright.html)
that Kougo's copyright has expired, and that is true **in Japan** — the 50-year
term lapsed around 2004/2005. It does not make the text usable here.

Because Kougo was still protected in Japan on 1996-01-01, the URAA **restored**
its US copyright for 95 years from publication: **2049 for the NT, 2050 for the
OT**. Japan-PD does not imply US-PD. Do not let a Japanese-language "it's public
domain now" citation reopen this; the ban stands.

Note also that scanned collections circulating online (for example on the
Internet Archive) frequently bundle Kougo *together with* Bungo in a single
item. The Bungo half being usable does not make such a bundle safe to ingest.
