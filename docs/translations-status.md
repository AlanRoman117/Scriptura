# Translation Status & License Verification Log

This document tracks license verification and ingestion status for each
translation in Scriptura. **Every row must cite a primary source confirming the
license before its data may be committed.**

## Verified translations

| ID | Name | Language | License | Verified source | Parser | Status |
|---|---|---|---|---|---|---|
| `kjv` | King James Version | en | Public domain, [except in the UK](#the-king-james-version-in-the-united-kingdom) | [aruljohn/Bible-kjv](https://github.com/aruljohn/Bible-kjv) | `aruljohn` | Complete |
| `web` | World English Bible | en | [Public domain by dedication](#web--world-english-bible) | [eBible `engwebp`](https://ebible.org/find/details.php?id=engwebp) | `usfx` | Complete |
| `asv` | American Standard Version (1901) | en | [Public domain](#asv--american-standard-version) | [eBible `eng-asv`](https://ebible.org/eng-asv/) | `usfx` | Complete |
| `ylt` | Young's Literal Translation | en | [Public domain](#ylt--youngs-literal-translation) | [eBible `engylt`](https://ebible.org/engylt/) | `usfx` | Complete |
| `bsb` | Berean Standard Bible | en | [Public domain (2023)](#bsb--berean-standard-bible) | [Berean terms](https://berean.bible/terms.htm); text from [eBible `engbsb`](https://ebible.org/engbsb/) | `usfx` | Complete |
| `rv1909` | Reina Valera 1909 | es | [Public domain](#rv1909--reina-valera-1909) | [eBible `spaRV1909`](https://ebible.org/find/details.php?id=spaRV1909) | `usfx` | Complete |
| `vbl` | Versión Biblia Libre | es | [CC BY-SA 4.0](#vbl--versión-biblia-libre) | [eBible `spavbl`](https://ebible.org/find/details.php?id=spavbl) | `usfx` | Complete |
| `lsg1910` | Louis Segond 1910 | fr | [Public domain](#lsg1910--louis-segond-1910) | [eBible `fraLSG`](https://ebible.org/fraLSG/) | `usfx` | Complete |
| `ostervald` | Bible Ostervald (1867) | fr | Public domain | [eBible `fra_fob`](https://ebible.org/fra_fob/) | `usfx` | Complete |
| `bungo` | 文語訳聖書 (Classical) | ja | Public domain | [CrossWire `JapBungo`](https://www.crosswire.org/sword/modules/ModInfo.jsp?modName=JapBungo) | `sword` | Complete |
| `martin1744` | Bible Martin 1744 | fr | Public domain | [CrossWire `FreBDM1744`](https://www.crosswire.org/sword/modules/ModInfo.jsp?modName=FreBDM1744) | `sword` | Complete |
| `cuvs` | 新标点和合本 (Union Version, 1919) | zh-Hans | Public domain | [eBible `cmn-cu89s`](https://ebible.org/cmn-cu89s/) | `usfx` | Complete |
| `cuvt` | 新標點和合本 (Union Version, 1919) | zh-Hant | Public domain | [eBible `cmn-cu89t`](https://ebible.org/cmn-cu89t/) | `usfx` | Complete |
| `blivre` | Bíblia Livre | pt-BR | [CC BY 3.0 Brasil](#blivre--bíblia-livre) | [The authors' licence file](https://github.com/blivre/BibliaLivre/blob/master/LICENCA.md); text from [eBible `porbr2018`](https://ebible.org/porbr2018/) | `usfx` | Complete |

**Status key:**
- **Complete** — all 66 books ingested; passes `scripts/validate.py --strict` with zero warnings
- **Partial** — some books ingested, ingestion in progress
- **Not started** — no `data/` directory yet

A translation with no data has **no `data/` directory at all**. An empty
`books/` is a validation error, so the directory is created by the first
successful ingest, not ahead of it. Until then the translation is tracked by its
entry in `scripts/ingest.py`'s `TRANSLATIONS` registry and by its row above.

## Verification notes

An aggregator's "Public Domain" label is a starting point, not proof: each row
below rests on the work's own history or on its rights holder's own statement.

### eBible source IDs
Confirm any eBible id against [eBible's own index](https://ebible.org/Scriptures/translations.csv)
rather than constructing it by hand. Several plausible-looking guesses are
wrong — `engasv` returns 404; the American Standard Version is `eng-asv`.

Three translations originally filed as needing a bespoke source turned out to be
on eBible already: `bsb` (`engbsb`, the post-2023 public-domain release),
`ostervald` (`fra_fob`), and `asv` (`eng-asv`).

### `vbl` — Versión Biblia Libre
CC BY-SA 4.0, version 5.2 of October 2025. Checked 2026-11-01 against
[Free Bible Version](https://www.freebibleversion.org/), eBible's
[copyright page](https://ebible.org/spavbl/copyright.htm) and the front matter in
`spavbl_usfx.zip`; our verses match that file exactly under `parse_usfx`.

Our import drops the 4,499 footnotes, the 118 Psalm superscriptions, the front
matter and the Strong's tags, and the attribution discloses the first three
(§3 asks that changes be indicated, not itemised). ShareAlike applies to any
adaptation: see `docs/API.md`.

Open questions, being put to Free Bible Ministry (info@freebibleministry.org):

- **Who holds the copyright.** eBible and its metadata name Jonathan Gallagher
  and Shelly Barrios de Avila, with © 2018-2020 and a "Nuevo Testamento" title
  that predates the whole Bible. The front matter says "Derechos de autor
  Jonathan Gallagher 2025" and lists both as translators. The project's site
  names no holder. The attribution credits both, which is the safer error.
- **"El texto no debe ser cambiado".** The front matter's foreword sets that
  condition, while its copyright line grants CC BY-SA ("4:0 Unported") and
  speaks of derivatives and "los cambios realizados". The licence is what we
  rely on, but dropping notes and superscriptions may not be what the foreword
  had in mind.
- **The editors.** The front matter also names Gustavo Sanabria and Rebeca
  Põldaas (eBible: "Rebekah"). CC BY-SA credits anyone designated to receive
  attribution; whether they are is part of the question.

### `blivre` — Bíblia Livre
**We record CC BY 3.0 Brasil, not eBible's 4.0.** The authors' own
[`LICENCA.md`](https://github.com/blivre/BibliaLivre/blob/master/LICENCA.md) is
that licence's full text, and their
[README](https://github.com/blivre/BibliaLivre) and
[site](https://sites.google.com/site/biblialivre/perguntas-e-respostas/posso-usar-a-bíblia-livre)
name it. [eBible's page](https://ebible.org/porbr2018/copyright.htm) repeats the
authors' credit with "4.0 Brasil" and `by/4.0/br/`; Creative Commons has no 4.0
national versions, and that address redirects to the international deed. The
authors' words bind until they confirm otherwise, and **the version question is
being put to them.**

The site asks for the translators' names, the source (the site itself) and the
licence, so the attribution holds all three and `source_url` is the site, though
the proposed wording left the address out and the text comes from eBible. The
site also asks to be told of any reproduction, "não para pedir autorização": a
request, not a condition, and answered by the same letter.

Our verses match eBible's file exactly under `parse_usfx`, which changes the text
in these ways, all disclosed in the attribution: 1,290 notes and 115 Psalm titles
dropped; the marking of 6,030 supplied words (`<add>`) dropped, keeping the words;
and **166 citations (`<rq>`) merged into verses**, so Matthew 1:23 ends "Isaías
7:14". That last is a data fault to fix in a later re-import. No brackets were
removed: the file's verse text has none. eBible's copy is dated February 2018 and
the authors have since released 2025.1.0, which we do not carry.

### `asv` — American Standard Version
© 1901 Thomas Nelson & Sons, renewed 1929 by the International Council of
Religious Education. Under the 1909 Act's two 28-year terms the US copyright ended
in 1957. That is the basis, not eBible's label. We use eBible's e-text, without
its 16 footnotes, its Strong's tags or its 116 Psalm titles.

### `ylt` — Young's Literal Translation
The third edition (G. A. Young & Co., Edinburgh, 1898), revised by the publishers
after Young's death in 1888. The reviser is unnamed, and eBible's page credits
Young alone and labels it public domain. The term has expired on any known basis:
even a reviser living to the 1950s would be out of term by now. The reviser's
identity remains unverified.

### `rv1909` — Reina Valera 1909
First published Madrid, British and Foreign Bible Society, 1909; the revisers are
undocumented. The text is public domain by age. A "REINA-VALERA 1909" design mark
is reported registered in the US (Reg. 3390776, United Bible Societies
Association; not checked at the USPTO). We use the name descriptively, with no
logo and no claim of endorsement.

### `lsg1910` — Louis Segond 1910
The British and Foreign Bible Society's 1910 revision of Segond (d. 1885); the
preface does not name the revisers. The basis is age, not eBible's "not
copyrighted" label.

Known data faults, for a later re-import: 15 verses contain section headings or
cross-references (Genesis 29:14 runs on "Léa et Rachel V. 15-30: cf. Os 12:13").
Separately, 465 verses differ from eBible's file of 30 October 2026, all in spacing
alone: it has since separated words run together in our copy ("Maisaprès", Ezra 5:12).

### `web` — World English Bible
Edition `engwebp`. Public domain [by dedication](https://ebible.org/eng-web/webfaq.htm),
which is stronger than a label: the editors dedicate it, CC0 included. The name is
a trademark, limited to faithful copies: anyone who changes the text or
punctuation must stop calling it the World English Bible.

That condition is why this needs fixing: our import drops the Psalm titles and
runs Psalm 119's 21 Hebrew-letter headings into the verses before them (119:8 ends
"BETH"), and 11 verses lag eBible's file of 29 October 2026. All for a later
re-import.

### `bsb` — Berean Standard Bible
[Dedicated to the public domain](https://berean.bible/terms.htm) on 30 April 2023.
The publisher asks that text varying from the official one not use the Berean
name, a request rather than a licence term; US Reg. 7773706 is reported for the
name (not checked at the USPTO). Our import drops the Psalm titles and footnotes
and runs 6 headings into the Song of Songs, to be re-imported later. Our verses
match eBible's file of 29 October 2026 exactly under `parse_usfx`, so any lag would
be eBible's behind the publisher; that is unchecked.

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
that thin layer is an unknown. **That question is open with Japan Bible Society.**
The module's `.conf` gives those printings (OT 1953, NT 1950) and `TextSource`
only; the digitiser is unknown.

Outside the US, the reasoning is the same age with a different rule. In Japan the
1887 and 1917 texts are out of term: an institution's work ran from publication,
and the 2018 extension revived nothing already expired. In the UK a work from
outside the EEA by a non-EEA author lasts no longer than in its country of origin
(CDPA 1988 s.12(6)), so the Japanese answer carries over. This is reasoning, not a
ruling. It would need revisiting if a named reviser's own term turned out to count.

Our import omits the Psalm superscriptions (`<title type="psalm">`) and the
furigana (`gloss`, about 248,000 in the Old Testament alone).

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

## The King James Version in the United Kingdom

The King James Version is public domain in the United States and most of the
world, and Scriptura distributes it on that basis. In the United Kingdom, rights
in the text are vested in the Crown and administered by Cambridge University
Press (England, Wales and Northern Ireland) and the Scottish Bible Board
(Scotland). Scriptura holds no permission from either. If you print, import or
redistribute this text in the UK, check
[Cambridge's terms](https://www.cambridge.org/bibles/about/rights-and-permissions)
first: limited non-commercial quotation is allowed, and larger uses need written
permission.

The reader shows this in one line of plain text, `rights_notice` in
`metadata.json`, beside the text and in a comparison. `license` stays
`public-domain`, whose values have no qualified form.

Still open in this row: it cites `aruljohn/Bible-kjv`, whose README states no
edition, source or rights, so it does not yet meet this log's rule of a primary
source, and the edition behind `year: 1769` is undeclared.

**The repository's MIT licence (© 2019 Arul John) is recorded here and not in
`metadata.json`.** Its grant covers "this software and associated documentation
files". We took only verse text, which is not Arul John's to license, and
re-serialised it into our own schema, keeping none of his files. Showing MIT beside
the text would claim a licence on the King James that nobody can give. `license`
and `attribution` describe the text, so a licence on a packaging we did not keep
does not belong in them. Should the packaging be held to matter, the credit is
this paragraph.
