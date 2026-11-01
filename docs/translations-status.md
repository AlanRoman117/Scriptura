# Translation Status & License Verification Log

This document tracks license verification and ingestion status for each
translation in Scriptura. **Every row must cite a primary source confirming the
license before its data may be committed.**

## Verified translations

| ID | Name | Language | License | Verified source | Parser | Status |
|---|---|---|---|---|---|---|
| `kjv` | King James Version | en | Public domain, [except in the UK](#the-king-james-version-in-the-united-kingdom) | [aruljohn/Bible-kjv](https://github.com/aruljohn/Bible-kjv) | `aruljohn` | Complete |
| `web` | World English Bible | en | Public domain | [eBible `engwebp`](https://ebible.org/find/details.php?id=engwebp) | `usfx` | Complete |
| `asv` | American Standard Version (1901) | en | Public domain | [eBible `eng-asv`](https://ebible.org/eng-asv/) | `usfx` | Complete |
| `ylt` | Young's Literal Translation | en | Public domain | [eBible `engylt`](https://ebible.org/engylt/) | `usfx` | Complete |
| `bsb` | Berean Standard Bible | en | Public domain (2023) | [eBible `engbsb`](https://ebible.org/engbsb/) | `usfx` | Complete |
| `rv1909` | Reina Valera 1909 | es | Public domain | [eBible `spaRV1909`](https://ebible.org/find/details.php?id=spaRV1909) | `usfx` | Complete |
| `vbl` | Versión Biblia Libre | es | CC BY-SA 4.0 | [eBible `spavbl`](https://ebible.org/find/details.php?id=spavbl) | `usfx` | Complete |
| `lsg1910` | Louis Segond 1910 | fr | Public domain | [eBible `fraLSG`](https://ebible.org/fraLSG/) | `usfx` | Complete |
| `ostervald` | Bible Ostervald (1867) | fr | Public domain | [eBible `fra_fob`](https://ebible.org/fra_fob/) | `usfx` | Complete |
| `bungo` | 文語訳聖書 (Classical) | ja | Public domain | [CrossWire `JapBungo`](https://www.crosswire.org/sword/modules/ModInfo.jsp?modName=JapBungo) | `sword` | Complete |
| `martin1744` | Bible David Martin, revised by Pierre Roques (Basel, 1744) | fr | Public domain | [CrossWire `FreBDM1744`](https://www.crosswire.org/sword/modules/ModInfo.jsp?modName=FreBDM1744); [2 Chronicles and Job from another source](#martin1744--bible-david-martin-1744) | `sword` | Complete |
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
What this is: David Martin's Bible as revised by Pierre Roques (Basel, Im-Hoff,
1744), in modernised spelling. It is not a diplomatic text of the 1744 printing,
which spells *étoit* and *païs*; the spelling was modernised when the text was
digitised.

Published 1744; David Martin died 1721 and Pierre Roques 1748. Public domain
worldwide by age, with no URAA question — the work predates every restoration
cutoff by well over a century.

Sixty-four books come from CrossWire's `FreBDM1744` SWORD module, which declares
`DistributionLicense=Public Domain`. STEPBible serves the same text (it renders
CrossWire modules via JSword), so CrossWire is the upstream and the right place
to cite.

**2 Chronicles and Job do not come from the module, because the module's are not
Martin.** Compared after normalising case, accents and punctuation (2026-11-01):
all 822 verses of its 2 Chronicles match the 1996 Ostervald revision (`fra_fob`)
at the same reference, and so do 979 of Job's 1,070. The other 91 are Ostervald
too, renumbered to fit Job 38-41. Re-ingesting cannot bring them back:
`keep_books` in `scripts/ingest.py` keeps the committed copies and stops if one
is missing.

Source of the two books:
[`Bible-David-Martin-1744.pdf`](http://judeochretien.free.fr/Bible-David-Martin-1744.pdf)
(sha256 `8cd952eb…`, PDF pages 290-313 and 336-356), the Bibliorama edition of
January 2014, which states "Version libre de droits" and describes a digitisation
of Roques's Basel 1744 text made in 2000. The rights rest on the age of the text;
"libre de droits" is the publisher's statement about its digitisation, and its
typesetting is not reproduced here. Checked against the printing itself, the
[1744 facsimile](https://archive.org/details/la-sainte-bible-traduction-par-david-martin-revue-par-pierre-roques-1744)
on the Internet Archive:

| Check | 2 Chronicles | Job |
|---|---|---|
| Verses identical to the 1996 Ostervald at the same reference: module → replacement | 822 → 14 of 822 | 979 → 13 of 1,070 |
| Mean word-pair coverage of the 1744 OCR, spelling folded: module → replacement | 0.71 → 0.87 | 0.58 → 0.85 |
| *Eternel* / *Éternel*; the other 64 books have 6,439 / 31 | 392 / 0 (module 0 / 390) | 31 / 0 (module 0 / 29) |
| *Roi* / *roi*; the other 64 books have 2,237 / 12 | 256 / 2 (module 0 / 279) | 5 / 0 (module 0 / 4) |

The same coverage measure gives 0.78 for the module's own 1 Chronicles, so the
replacement reads at least as close to the printing as the books it joins. Three
facsimile pages read by eye (2 Chronicles 1 and 17-18, Job 13-14) agree apart from
spelling, bar one place: at 2 Chronicles 1:4 the printing has *qu'il **lui** avoit préparé*
and *Kiriath*, the PDF *qu'il avait préparé* and *Kirjath*. That reading stands
as the PDF has it, and other small slips of this kind are likely.

Changes made to the PDF's text, each to match the printing or the other 64 books:
- Chapter summaries, book titles and page numbers are left out.
- Square brackets, which mark words the translator supplied, are removed, as
  `FreBDM1744` does; straight apostrophes become ’; *Éternel* becomes *Eternel*.
- Job 38-41 is renumbered. The PDF uses 41/30/24/34 verses; the printing and the
  module have 38/38/28/25.
- The PDF's 2 Chronicles has lost its hyphens (*dis je*, *ce lieu ci*). 138 are
  restored, only in compounds where the 1744 OCR shows the hyphen (*dis-je*).
- Ten line-end hyphens the text extraction dropped in Job are put back, and three
  more restored the same way as above.

Worth fixing upstream: CrossWire's `FreBDM1744` should replace these two books.

**Still unverified:** the other 64 books were compared with the PDF, which agrees
with them on about 97% of verses after normalisation, but only 1 Chronicles was
scored against the facsimile. The review found no other book matching Ostervald.

⚠️ **CrossWire's licence field is meaningful, not boilerplate.** The sibling
module `frebdm1707` (Martin 1707) declares `Copyrighted; Permission to
distribute granted to CrossWire` — a grant to CrossWire is not a grant to us, so
that module is **not usable here**. Always read the `.conf`.

Note the module carries a malformed chapter sequence in Haggai (an empty `Hag.2`
opens and closes before `Hag.1`). `scripts/ingest.py` handles it; see the
`_osis_marker` notes in CLAUDE.md.


### Not added: `ostervald1867` — fr.wikisource's *Bible Ostervald 1867*
[This transcription](https://fr.wikisource.org/wiki/Bible_Ostervald_1867) was
assessed on 2026-11-01 as a replacement for the mislabelled `ostervald`, and is
not in the library because its text departs from the 1867 printing it transcribes.

What holds up:
- **The edition.** The [scan](https://commons.wikimedia.org/wiki/File:Ostervald_-_La_Sainte_Bible,_1867.djvu)
  has the title page *Bruxelles, Société biblique britannique et étrangère,
  M DCCC LXVII*. (The Internet Archive's catalogue record for the same scan,
  `lasaintebiblequ00unkngoog`, wrongly says Bienne, 1771.) It is not the 1996
  revision: 3,294 of 31,079 shared verses match that after normalising.
- **Completeness and canon.** 66 books, 1,189 chapters, 31,170 verses with no gaps
  in French versification, 1,333 of 1,359 pages marked proofread and the rest
  blank. A parser matched every verse, in order, to the rendered pages, with no
  headings or references in verse text.
- **Rights in the text.** Ostervald died in 1747 and this printing is from 1867:
  public domain in the US (published before 1931), France and Belgium (the EU
  term is 70 years from the author's death, or from publication if anonymous) and
  the UK (the same, and the Crown's rights cover the KJV and Prayer Book, not this).

What fails: two independent OCRs of the scan, the DjVu layer and Tesseract,
agree with each other against Wikisource on a real word at 1,217 places on 709
pages. Of a random 24 read on the scan, 16 are errors in Wikisource, 5 are OCR
noise, and 3 could not be settled. For example:

| Reference | 1867 printing | Wikisource |
|---|---|---|
| 2 Samuel 18:3 | nous serions dix mille hommes | tu nous vaux dix mille hommes |
| Genesis 46:7 | les filles de ses fils | les filles de ses filles |
| Nahum 1:13 | je briserai son joug | je briserai ton joug |
| Matthew 21:44 | elle tombera en sera écrasé | elle tombera sera écrase |
| Luke 10:13 | Corazin | Chorazin |

Those last two came from a separate sample of 30 random verses, read on the scan,
at least 2 of which differ in wording. That sample is small, but it points to errors in a few percent
of verses, beyond what the 1,217 show: a word the printing has and Wikisource
lacks is not among them. Punctuation and capitals are also regularised (*Fils* →
*fils*; *Eternel*, about 99% of the OCR's readings, is *Éternel* in 77% of
Wikisource's). The [talk page](https://fr.wikisource.org/wiki/Discussion_Livre:Ostervald_-_La_Sainte_Bible,_1867.djvu)
says the base text was Google's OCR of this copy, and names 1842, 1864 and 1877
printings as references.

The scan's image for printed page 226 (Deuteronomy 18:3-19:3, 23 verses) is
a failed capture, so that text was entered "sans image", as the page's edit
history puts it, and cannot be checked against this scan at all.

Rights in the transcription, if this is revisited:
[Wikisource's help page](https://fr.wikisource.org/wiki/Aide:Droit_d%E2%80%99auteur)
says republished texts are reusable on the original's terms, "mais leur
transcription est publiée sous CC BY-SA 4.0". A faithful transcription adds no
copyrightable expression under US or EU originality standards, so `public-domain`
is defensible, but it is a legal view and not a statement by Wikisource. The
[Wikimedia terms](https://foundation.wikimedia.org/wiki/Policy:Terms_of_Use) (7.7)
accept credit by a hyperlink or URL to the pages reused, which `source_url` would
carry. If the owner prefers no argument, the alternative is `cc-by-sa-4.0`.

What adding it would take: a scan-checked correction pass over the 1,217 places
and the words either OCR could not confirm (12,865 tokens, 1.5%, including page
226), and a legible copy of page 226. The corrections would be better made on
Wikisource, so that the source itself becomes sound.

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

Still open in this row: it cites `aruljohn/Bible-kjv`, whose README states no
edition, source or rights, so it does not yet meet this log's rule of a primary
source. That repository carries an MIT licence (2019, Arul John), and the edition
behind `year: 1769` is undeclared. `license` stays `public-domain` in
`metadata.json`, whose values have no qualified form.
