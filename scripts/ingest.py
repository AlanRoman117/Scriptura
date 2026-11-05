#!/usr/bin/env python3
"""
Scriptura — Bible data ingestion
================================

Downloads PUBLIC-DOMAIN / OPEN-LICENSE Bible translations and normalizes them
into Scriptura's canonical JSON schema:

    data/{id}/
    ├── metadata.json
    └── books/
        ├── 01-genesis.json
        ├── 02-exodus.json
        └── ...  (66 Protestant-canon books, zero-padded for sort order)

It supports four source formats:
  • "sword"    — a CrossWire SWORD zText module (compiled OSIS in a binary
                 block/index format). Used for translations no plain-text
                 source still carries.
  • "usfx"     — a single USFX XML file inside a .zip (eBible.org). One parser
                 handles many translations across many languages.
  • "usfm"     — a .zip of USFM files, one per book, as a publisher releases
                 them (the Berean Standard Bible).
  • "aruljohn" — clean per-book JSON from github.com/aruljohn/Bible-kjv.

Headings are not verse text. Section headings, parallel references, speaker
labels, acrostic letters and chapter labels are left out of every verse, and
a Psalm's title (USFM `\\d`, OSIS `<title type="psalm">`), which stands before
verse 1 unnumbered in English Bibles, is kept as the chapter's
`superscription` rather than folded into verse 1 or dropped. Footnotes and
cross-references are still left out.

------------------------------------------------------------------------------
LICENSE / ETHICS — READ THIS
------------------------------------------------------------------------------
Only translations verified PUBLIC DOMAIN or under an explicit open license
(CC BY-SA 4.0 / CC0) belong in this project. The following are intentionally
EXCLUDED and must never be added:

  • Reina Valera 1960 (RV1960) — © Sociedades Bíblicas Unidas. NOT public domain.
  • 口語訳聖書 (Kougo-yaku, 1954/55) — public domain in Japan, but under US
    copyright until ~2049–2050 (URAA restoration). Unsafe for a US-hosted repo.

------------------------------------------------------------------------------
USAGE
------------------------------------------------------------------------------
    python ingest.py --list                 # show configured translations
    python ingest.py                        # ingest every automated translation
    python ingest.py --only kjv             # ingest just one
    python ingest.py --only rv1909 web      # ingest a specific set
    python ingest.py --output-dir data      # where to write (default: ./data)
    python ingest.py --no-cache             # force re-download

Requires only the Python standard library (3.9+). No pip install needed.

NOTE ON SOURCE IDS: eBible translation IDs are hand-confirmed where possible,
but a few are marked "verify". If a download 404s, the script prints the exact
URL it tried and where to confirm the correct ID — fixing it is a one-line edit
to the TRANSLATIONS table below.
"""

from __future__ import annotations

import argparse
import io
import json
import re
import struct
import sys
import time
import zipfile
import zlib
from collections import Counter
from pathlib import Path
from http.client import IncompleteRead
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

USER_AGENT = "Scriptura-Ingest/1.0 (+https://github.com/AlanRoman117/scriptura)"

# -----------------------------------------------------------------------------
# Canonical 66-book table.
# Columns: (number, USFM code, English name, filename slug, abbreviation, testament)
# The USFM code is how USFX files identify a book (<book id="GEN">). The English
# slug drives the filename; the *localized* name is read from the source when
# available and stored inside each book's JSON.
# -----------------------------------------------------------------------------
CANONICAL_BOOKS = [
    (1,  "GEN", "Genesis",         "genesis",         "Gen", "OT"),
    (2,  "EXO", "Exodus",          "exodus",          "Exo", "OT"),
    (3,  "LEV", "Leviticus",       "leviticus",       "Lev", "OT"),
    (4,  "NUM", "Numbers",         "numbers",         "Num", "OT"),
    (5,  "DEU", "Deuteronomy",     "deuteronomy",     "Deu", "OT"),
    (6,  "JOS", "Joshua",          "joshua",          "Jos", "OT"),
    (7,  "JDG", "Judges",          "judges",          "Jdg", "OT"),
    (8,  "RUT", "Ruth",            "ruth",            "Rut", "OT"),
    (9,  "1SA", "1 Samuel",        "1-samuel",        "1Sa", "OT"),
    (10, "2SA", "2 Samuel",        "2-samuel",        "2Sa", "OT"),
    (11, "1KI", "1 Kings",         "1-kings",         "1Ki", "OT"),
    (12, "2KI", "2 Kings",         "2-kings",         "2Ki", "OT"),
    (13, "1CH", "1 Chronicles",    "1-chronicles",    "1Ch", "OT"),
    (14, "2CH", "2 Chronicles",    "2-chronicles",    "2Ch", "OT"),
    (15, "EZR", "Ezra",            "ezra",            "Ezr", "OT"),
    (16, "NEH", "Nehemiah",        "nehemiah",        "Neh", "OT"),
    (17, "EST", "Esther",          "esther",          "Est", "OT"),
    (18, "JOB", "Job",             "job",             "Job", "OT"),
    (19, "PSA", "Psalms",          "psalms",          "Psa", "OT"),
    (20, "PRO", "Proverbs",        "proverbs",        "Pro", "OT"),
    (21, "ECC", "Ecclesiastes",    "ecclesiastes",    "Ecc", "OT"),
    (22, "SNG", "Song of Solomon", "song-of-solomon", "Sng", "OT"),
    (23, "ISA", "Isaiah",          "isaiah",          "Isa", "OT"),
    (24, "JER", "Jeremiah",        "jeremiah",        "Jer", "OT"),
    (25, "LAM", "Lamentations",    "lamentations",    "Lam", "OT"),
    (26, "EZK", "Ezekiel",         "ezekiel",         "Ezk", "OT"),
    (27, "DAN", "Daniel",          "daniel",          "Dan", "OT"),
    (28, "HOS", "Hosea",           "hosea",           "Hos", "OT"),
    (29, "JOL", "Joel",            "joel",            "Jol", "OT"),
    (30, "AMO", "Amos",            "amos",            "Amo", "OT"),
    (31, "OBA", "Obadiah",         "obadiah",         "Oba", "OT"),
    (32, "JON", "Jonah",           "jonah",           "Jon", "OT"),
    (33, "MIC", "Micah",           "micah",           "Mic", "OT"),
    (34, "NAM", "Nahum",           "nahum",           "Nam", "OT"),
    (35, "HAB", "Habakkuk",        "habakkuk",        "Hab", "OT"),
    (36, "ZEP", "Zephaniah",       "zephaniah",       "Zep", "OT"),
    (37, "HAG", "Haggai",          "haggai",          "Hag", "OT"),
    (38, "ZEC", "Zechariah",       "zechariah",       "Zec", "OT"),
    (39, "MAL", "Malachi",         "malachi",         "Mal", "OT"),
    (40, "MAT", "Matthew",         "matthew",         "Mat", "NT"),
    (41, "MRK", "Mark",            "mark",            "Mrk", "NT"),
    (42, "LUK", "Luke",            "luke",            "Luk", "NT"),
    (43, "JHN", "John",            "john",            "Jhn", "NT"),
    (44, "ACT", "Acts",            "acts",            "Act", "NT"),
    (45, "ROM", "Romans",          "romans",          "Rom", "NT"),
    (46, "1CO", "1 Corinthians",   "1-corinthians",   "1Co", "NT"),
    (47, "2CO", "2 Corinthians",   "2-corinthians",   "2Co", "NT"),
    (48, "GAL", "Galatians",       "galatians",       "Gal", "NT"),
    (49, "EPH", "Ephesians",       "ephesians",       "Eph", "NT"),
    (50, "PHP", "Philippians",     "philippians",     "Php", "NT"),
    (51, "COL", "Colossians",      "colossians",      "Col", "NT"),
    (52, "1TH", "1 Thessalonians", "1-thessalonians", "1Th", "NT"),
    (53, "2TH", "2 Thessalonians", "2-thessalonians", "2Th", "NT"),
    (54, "1TI", "1 Timothy",       "1-timothy",       "1Ti", "NT"),
    (55, "2TI", "2 Timothy",       "2-timothy",       "2Ti", "NT"),
    (56, "TIT", "Titus",           "titus",           "Tit", "NT"),
    (57, "PHM", "Philemon",        "philemon",        "Phm", "NT"),
    (58, "HEB", "Hebrews",         "hebrews",         "Heb", "NT"),
    (59, "JAS", "James",           "james",           "Jas", "NT"),
    (60, "1PE", "1 Peter",         "1-peter",         "1Pe", "NT"),
    (61, "2PE", "2 Peter",         "2-peter",         "2Pe", "NT"),
    (62, "1JN", "1 John",          "1-john",          "1Jn", "NT"),
    (63, "2JN", "2 John",          "2-john",          "2Jn", "NT"),
    (64, "3JN", "3 John",          "3-john",          "3Jn", "NT"),
    (65, "JUD", "Jude",            "jude",            "Jud", "NT"),
    (66, "REV", "Revelation",      "revelation",      "Rev", "NT"),
]

# Fast lookup by USFM code -> book row.
CODE_TO_BOOK = {row[1]: row for row in CANONICAL_BOOKS}

# -----------------------------------------------------------------------------
# Translation registry.
#
# Each entry carries the curated metadata (from license research) plus how to
# fetch it. `source` is one of:
#   "usfx"     -> needs `ebible_id`; downloaded from eBible.org as a USFX zip.
#   "usfm"     -> needs `usfm_url`; a zip of one USFM file per book.
#   "aruljohn" -> per-book JSON from the aruljohn/Bible-kjv repo.
#   "sword"    -> needs `sword_url` + `sword_module`; a CrossWire zText module.
#   "manual"   -> no automated parser yet; the script will skip it and explain.
#
# `keep_books` lists USFM codes the source must not supply, because its text of
# them is wrong. Those books stay as committed in the output directory, and the
# ingest stops if one is missing rather than falling back on the source.
#
# `verify: True` just means the eBible id is a best guess — if the download
# fails, the script tells you exactly what to fix.
# -----------------------------------------------------------------------------
TRANSLATIONS = {
    "rv1909": {
        "name": "Reina Valera 1909",
        "language": "es",
        "license": "public-domain",
        "attribution": "Reina Valera 1909 — Public Domain",
        "source_url": "https://ebible.org/find/details.php?id=spaRV1909",
        "year": 1909,
        "source": "usfx",
        "ebible_id": "spaRV1909",
    },
    "kjv": {
        "name": "King James Version",
        "language": "en",
        "license": "public-domain",
        "attribution": "King James Version — Public Domain",
        "rights_notice": "Public domain outside the UK; in the UK, rights are vested in the Crown and administered by Cambridge University Press.",
        "source_url": "https://github.com/aruljohn/Bible-kjv",
        "year": 1769,
        "source": "aruljohn",
    },
    "web": {
        "name": "World English Bible",
        "language": "en",
        "license": "public-domain",
        "attribution": "World English Bible — Public Domain",
        "source_url": "https://worldenglish.bible",
        "year": 2020,
        "source": "usfx",
        "ebible_id": "engwebp",
    },
    "lsg1910": {
        "name": "Louis Segond 1910",
        "language": "fr",
        "license": "public-domain",
        "attribution": "Louis Segond 1910 — Domaine public",
        "source_url": "https://ebible.org/fraLSG/",
        "year": 1910,
        "source": "usfx",
        "ebible_id": "fraLSG",
    },
    "vbl": {
        "name": "Versión Biblia Libre",
        "language": "es",
        "license": "cc-by-sa-4.0",
        "attribution": "Versión Biblia Libre (Free Bible Version) v5.2 (Oct 2025) © Jonathan Gallagher, Shelly Barrios de Avila. CC BY-SA 4.0 https://creativecommons.org/licenses/by-sa/4.0/ . Scriptura omits footnotes, section headings (the speaker labels in Song of Songs, Psalm 119's letter headings) and front matter; not endorsed by the licensor.",
        "attribution_lang": "en",
        "license_url": "https://creativecommons.org/licenses/by-sa/4.0/",
        "source_url": "https://ebible.org/find/details.php?id=spavbl",
        "year": 2025,
        "source": "usfx",
        "ebible_id": "spavbl",
    },
    "asv": {
        "name": "American Standard Version",
        "language": "en",
        "license": "public-domain",
        "attribution": "American Standard Version (1901) — Public Domain",
        "source_url": "https://ebible.org/eng-asv/",
        "year": 1901,
        "source": "usfx",
        "ebible_id": "eng-asv",
    },
    "ylt": {
        "name": "Young's Literal Translation",
        "language": "en",
        "license": "public-domain",
        "attribution": "Young's Literal Translation — Public Domain",
        "source_url": "https://ebible.org/engylt/",
        "year": 1898,
        "source": "usfx",
        "ebible_id": "engylt",
    },
    # The publisher's own USFM, not eBible's copy. The publisher asks that text
    # varying from the official one not carry the Berean name, and eBible's
    # engbsb lagged it by hundreds of verses (Genesis 2:14 still read Hiddekel
    # where the official text has Tigris). docs/translations-status.md has the
    # comparison.
    "bsb": {
        "name": "Berean Standard Bible",
        "language": "en",
        "license": "public-domain",
        "attribution": "Berean Standard Bible — Public Domain (2023)",
        "source_url": "https://bereanbible.com/",
        "year": 2023,
        "source": "usfm",
        "usfm_url": "https://bereanbible.com/bsb_usfm.zip",
    },
    # --- Chinese: none for now ---
    #
    # `cuvs` and `cuvt` were withdrawn on 2026-11-01. eBible's cmn-cu89s and
    # cmn-cu89t were filed here as the Union Version of 1919, public domain, but
    # they carry the 1988/89 New Punctuation revision (新标点和合本), for which the
    # Hong Kong Bible Society acts as copyright agent: its names are the
    # revision's (吕便, not 流便) and eBible's own file calls it "Chinese Union New
    # Punctuation 1989". The real 1919 text would need another source and another
    # id. 和合本修訂版 (RCUV, 2010), 新譯本 (CNV) and 現代中文譯本 are copyrighted too.
    # scripts/validate.py refuses the ids and the markers; docs/translations-status.md
    # has the reasons.
    # --- Brazilian Portuguese ---
    #
    # A modern Brazilian text, updated from Almeida's 1819 translation, so the
    # attribution travels with every quotation — the same duty the Spanish VBL
    # carries.
    #
    # ⚠️ eBible says CC BY 4.0; the authors' licence file, README and site say
    # CC BY 3.0 Brasil. Theirs binds until they say otherwise (see
    # docs/translations-status.md). The text still comes from eBible, by
    # `ebible_id`; `source_url` is the address the authors ask to be credited.
    #
    # ⚠️ The Bibles Brazilian churches read today — ARA, ARC 1995/2009, ACF,
    # NVI, NTLH — are all under copyright and are refused by validate.py. The
    # historic Almeida 1911 is public domain by age, but the CrossWire module
    # of it declares GPL rather than public domain, so it is not a source this
    # repo can cite.
    "blivre": {
        "name": "Bíblia Livre",
        "language": "pt-BR",
        "license": "cc-by-3.0-br",
        "attribution": "Bíblia Livre (BLIVRE), Copyright © Diego Santos, Mario Sérgio, e Marco Teles, https://sites.google.com/site/biblialivre/, fevereiro de 2018. Licença CC BY 3.0 Brasil: https://creativecommons.org/licenses/by/3.0/br/. Modificado pela Scriptura: removidas as notas e a marcação das palavras acrescentadas; 166 citações incorporadas aos versículos.",
        "license_url": "https://creativecommons.org/licenses/by/3.0/br/",
        "source_url": "https://sites.google.com/site/biblialivre/",
        "year": 2018,
        "source": "usfx",
        "ebible_id": "porbr2018",
    },
    # --- Korean: nothing usable yet, and the reason matters ---
    #
    # eBible's `kor` is titled "Korean Bible 1910" and marked public domain, but
    # its text is the 개역한글판 of 1952/1961: Genesis 1:1 reads "태초에 하나님이
    # 천지를 창조하시니라", word for word the 개역, where the real 1911 구역 reads
    # "태초에 하ᄂᆞ님이 텬디를 창조ᄒᆞ시다". CrossWire's `korrv` is the same text,
    # also labelled Public Domain.
    #
    # ⚠️ That text is public domain **in Korea** — its 50-year term ran out at
    # the end of 2011 — and not in the United States: it was still protected in
    # Korea on 1996-01-01, so the URAA restored the US copyright, which runs
    # 95 years from 1961. This is the 口語訳 trap exactly (see `bungo` below and
    # CLAUDE.md). `korhkjv` is copyrighted outright.
    #
    # The 1911 구역 is genuinely public domain and survives on Korean Wikisource
    # in archaic Hangul, which no parser here reads yet. Until that is built,
    # Korean is not in the library.
    # --- Configured but not yet automated (needs a dedicated parser/source) ---
    # David Martin's Bible as revised by Pierre Roques (Basel, 1744), in
    # modernised spelling.
    #
    # ⚠️ FreBDM1744 is not Martin in two books. Its 2 Chronicles and Job are the
    # 1996 Ostervald revision, word for word: all 822 verses of the one and all
    # 1,070 of the other, 91 of them only renumbered to fit Job 38-41. So those
    # two books never come from the module. They are committed in data/ and
    # re-ingesting keeps them (`keep_books`); docs/translations-status.md says
    # where they came from and how they were checked against a 1744 scan.
    "martin1744": {
        "name": "Bible Martin",
        "language": "fr",
        "license": "public-domain",
        "attribution": "Bible David Martin, révisée par Pierre Roques (Bâle, 1744) — Domaine public",
        "source_url": "https://www.crosswire.org/sword/modules/ModInfo.jsp?modName=FreBDM1744",
        "year": 1744,
        "source": "sword",
        "sword_url": "https://www.crosswire.org/ftpmirror/pub/sword/packages/rawzip/FreBDM1744.zip",
        "sword_module": "frebdm1744",
        "book_names": "FR_BOOK_NAMES",
        "keep_books": ["2CH", "JOB"],
    },
    # `ostervald` was withdrawn on 2026-11-01: eBible's fra_fob, filed here as
    # the public-domain text of 1867, is the 1996 revision, listed elsewhere as
    # "Copyright © 1996 Mission Baptiste Maranatha". scripts/validate.py refuses
    # that source, not the name: the 1867 text itself is free.
    "bungo": {
        "name": "文語訳聖書 (Classical)",
        "language": "ja",
        "license": "public-domain",
        "attribution": "文語訳聖書 (Bungo-yaku, 1887/1917) — Public Domain",
        "source_url": "https://www.crosswire.org/sword/modules/ModInfo.jsp?modName=JapBungo",
        "year": 1917,
        "source": "sword",
        "sword_url": "https://www.crosswire.org/ftpmirror/pub/sword/packages/rawzip/JapBungo.zip",
        "sword_module": "japbungo",
        "book_names": "JA_BOOK_NAMES",
    },
}

# Elements whose inner content is NOT part of the readable verse text
# (footnotes, cross-references, remarks, figure captions). We skip their
# subtrees but keep any tail text that follows them.
NOTE_TAGS = {"f", "fe", "x", "xe", "ef", "ex", "note", "fig", "rem", "periph",
             "fr", "ft", "fk", "fq", "fl", "fv", "xo", "xt", "xk"}

# Paragraph-level markers whose content is a heading, never verse text: section
# headings (s, s1…), parallel-passage references (r, sr, mr), major sections and
# book titles (ms, mt, mte), speaker labels (sp: "Friends", "Mujer:"), acrostic
# letters (qa), chapter labels (cl, cd), semantic divisions (sd) and the
# descriptive title (d), which is a Psalm's superscription. A trailing digit is a
# level (s1, mt2) and is ignored when matching.
#
# Sources put headings *inside* a verse's span more often than one would hope:
# Segond's eBible file runs "Léa et Rachel V. 15-30: cf. Os 12:13" into Genesis
# 29:14, the World English Bible's Psalm 119 puts BETH..TAV inside the verse
# before each stanza, the Berean's Song of Songs has "The Friends" inside
# verses. Each used to be captured as verse text. USFX writes some headings as
# their own element (<s>, <d>) and others as <p sfm="r">; both forms count.
HEADING_SFMS = {"s", "r", "sr", "mr", "ms", "mt", "mte", "d", "sp", "qa", "cl", "cd", "sd"}

_LEVEL_SUFFIX = re.compile(r"\d+$")


def _heading_base(marker: str) -> str | None:
    """'s1' -> 's', 'mt2' -> 'mt'; None when the marker is not a heading."""
    base = _LEVEL_SUFFIX.sub("", marker)
    return base if base in HEADING_SFMS else None


class _Headings:
    """
    What a book's headings become: a Psalm title kept per chapter, and a count
    of everything else left out, so a re-import can say what it dropped.

    A `d` (descriptive title) is the chapter's superscription when it is the
    last heading before the chapter's first verse: the run of `d` nearest verse
    1, with nothing but verse text after it. Two cases from real files decide
    the rest:

    - A `d` after a verse has begun, with more verses to follow, is a section
      heading in a title's clothing: the World English Bible marks the Hebrew
      letters of Psalm 119 that way, ALEPH before verse 1 included. A chapter
      with one of those gets no superscription at all, or Psalm 119 would carry
      "ALEPH" alone while BETH to TAV are left out. A `d` after the *last* verse
      (the colophon at the end of Habakkuk 3 in the ASV) is simply left out.
    - A `d` with other headings between it and verse 1 labels something larger
      than the chapter: the Berean's "\\ms BOOK II" / "\\d Psalms 42–72" /
      "\\s1 …" before Psalm 42's own "\\d \\v 1 For the choirmaster…". Taken as a
      title, it would have made Psalm 1's superscription "Psalms 1–41".
    """

    def __init__(self):
        self.before: dict = {}          # chapter -> [(base, text)] before its first verse
        self.acrostic: set = set()      # chapters whose `d` are section headings
        self.dropped = Counter()        # heading marker base -> count left out
        self._late_d: int | None = None  # chapter with a `d` after verses began

    def heading(self, base: str, text: str, chapter, verse_begun: bool):
        """
        A heading has ended. `verse_begun` is whether a verse of `chapter` had
        begun when the heading *started*: the Berean writes `\\d \\v 1 A Psalm of
        David…`, so by the end of the title verse 1 is open.
        """
        if not text:
            return
        if chapter is not None and not verse_begun:
            self.before.setdefault(chapter, []).append((base, text))
            return
        if base == "d" and chapter is not None:
            self._late_d = chapter
        self.dropped[base] += 1

    def verse_begins(self, chapter):
        """Called at each verse start: a `d` before it, after verses began, was a section heading."""
        if self._late_d == chapter:
            self.acrostic.add(chapter)
        self._late_d = None

    def chapter_begins(self):
        self._late_d = None

    def superscriptions(self, chapters: dict) -> dict:
        """Chapter -> title, for chapters that have verses and are not acrostic."""
        out = {}
        for ch, sequence in self.before.items():
            run = []
            while sequence and sequence[-1][0] == "d":
                run.insert(0, sequence.pop()[1])
            for base, _ in sequence:
                self.dropped[base] += 1
            if not run:
                continue
            if ch in self.acrostic or not chapters.get(ch):
                self.dropped["d"] += len(run)
                continue
            text = _clean(" ".join(run))
            if text:
                out[ch] = text
        return out


# =============================================================================
# Download helpers (stdlib only, with a simple on-disk cache)
# =============================================================================
def fetch_bytes(url: str, cache_path: Path, use_cache: bool = True,
                attempts: int = 3) -> bytes:
    """
    Download `url`, caching the raw bytes at `cache_path` for fast re-runs.

    eBible.org occasionally cuts a response short mid-body, so we compare the
    payload against Content-Length and retry rather than caching a truncated
    zip (which would fail later as a confusing "bad zip file").
    """
    if use_cache and cache_path.exists():
        return cache_path.read_bytes()

    last_err = None
    for attempt in range(1, attempts + 1):
        try:
            req = Request(url, headers={"User-Agent": USER_AGENT})
            with urlopen(req, timeout=120) as resp:
                expected = resp.headers.get("Content-Length")
                data = resp.read()
            if expected is not None and len(data) != int(expected):
                raise IncompleteRead(data, int(expected) - len(data))
            break
        except (IncompleteRead, URLError, TimeoutError) as e:
            last_err = e
            if isinstance(e, HTTPError):     # a 404 won't fix itself — give up
                raise
            if attempt == attempts:
                raise
            print(f"      retry {attempt}/{attempts - 1} after {type(e).__name__}")
            time.sleep(2 * attempt)
    else:                                     # pragma: no cover - loop always breaks/raises
        raise last_err

    cache_path.parent.mkdir(parents=True, exist_ok=True)
    cache_path.write_bytes(data)
    return data


# =============================================================================
# USFX parsing
# =============================================================================
def _localname(tag: str) -> str:
    """Return an XML tag name without its namespace, e.g. '{ns}book' -> 'book'."""
    return tag.rsplit("}", 1)[-1] if "}" in tag else tag


def _usfx_heading(elem) -> str | None:
    """The heading marker an element stands for ('s', 'r', 'd'…), or None."""
    tag = _localname(elem.tag)
    marker = elem.get("sfm") if tag in ("p", "q") else tag
    return _heading_base(marker) if marker else None


def _walk(elem, in_heading: bool = False):
    """
    Yield tokens in document order so we can reconstruct verses from USFX's
    "milestone" markers. USFX marks verse/chapter *boundaries* with empty
    elements; the actual text lives in the surrounding `.text`/`.tail`.

    Token types: ('chapter', n), ('verse', n), ('verse_end', None), ('text', s),
    and for headings ('heading', base) … ('htext', s) … ('heading_end', base).
    A heading is walked, not skipped, because a verse milestone can sit inside
    one (the Berean's Zechariah 12 opens `<d><v id="1"/>This is the burden…`);
    only its text is kept apart, as 'htext'.
    """
    tag = _localname(elem.tag)
    outer = "htext" if in_heading else "text"

    if tag in NOTE_TAGS:                      # skip note bodies, keep trailing text
        if elem.tail:
            yield (outer, elem.tail)
        return

    heading = _usfx_heading(elem)
    if heading:
        yield ("heading", heading)
    inside = in_heading or heading is not None
    inner = "htext" if inside else "text"

    if tag == "c":                            # chapter milestone
        yield ("chapter", elem.get("id"))
    elif tag == "v":                          # verse-start milestone
        yield ("verse", elem.get("id"))
    elif tag == "ve":                         # verse-end milestone
        yield ("verse_end", None)

    if elem.text:                             # text held by this element
        yield (inner, elem.text)
    for child in elem:                        # then descend into children
        yield from _walk(child, inside)
    if heading:
        yield ("heading_end", heading)
    if elem.tail:                             # then text that follows this element
        yield (outer, elem.tail)


_WS = re.compile(r"\s+")


def _clean(text: str) -> str:
    """Collapse whitespace and trim."""
    return _WS.sub(" ", text).strip()


def _verse_number(raw: str) -> int | None:
    """Parse a verse id like '1', '1-2', or '1a' down to its leading integer."""
    if not raw:
        return None
    m = re.match(r"\d+", raw.strip())
    return int(m.group()) if m else None


def parse_usfx(xml_bytes: bytes) -> dict:
    """
    Parse a USFX document into:
        { usfm_code: {"name": <localized header>,
                      "chapters": {chap: {verse: text}},
                      "superscriptions": {chap: title},
                      "dropped": Counter of heading markers left out} }
    """
    import xml.etree.ElementTree as ET

    root = ET.fromstring(xml_bytes)
    books: dict = {}

    for book_el in (e for e in root.iter() if _localname(e.tag) == "book"):
        code = (book_el.get("id") or "").upper()
        if code not in CODE_TO_BOOK:
            continue  # skip apocrypha / non-canonical books, front matter, etc.

        # Localized running header (<h>), if present; else canonical English name.
        localized = None
        for child in book_el:
            if _localname(child.tag) == "h" and (child.text or "").strip():
                localized = child.text.strip()
                break

        chapters: dict = {}
        headings = _Headings()
        cur_ch = cur_v = None
        verse_begun = False
        buf: list = []
        hbuf: list = []
        # The heading being walked, and whether a verse had begun when it started.
        heading: str | None = None
        heading_verse_begun = False

        def flush():
            nonlocal buf
            if cur_ch is not None and cur_v is not None and buf:
                text = _clean("".join(buf))
                if text:
                    existing = chapters[cur_ch].get(cur_v, "")
                    chapters[cur_ch][cur_v] = (existing + " " + text).strip() if existing else text
            buf = []

        for kind, value in _walk(book_el):
            if kind == "chapter":
                flush()
                n = _verse_number(value)
                if n is not None:
                    cur_ch, cur_v = n, None
                    verse_begun = False
                    chapters.setdefault(cur_ch, {})
                    headings.chapter_begins()
            elif kind == "verse":
                flush()
                cur_v = _verse_number(value)
                if cur_ch is not None:
                    chapters.setdefault(cur_ch, {})
                    headings.verse_begins(cur_ch)
                    verse_begun = True
            elif kind == "verse_end":
                flush()
                cur_v = None
            elif kind == "text" and cur_v is not None:
                buf.append(value)
            elif kind == "heading":
                heading, heading_verse_begun = value, verse_begun
                hbuf = []
            elif kind == "htext":
                hbuf.append(value)
            elif kind == "heading_end":
                headings.heading(value, _clean("".join(hbuf)), cur_ch, heading_verse_begun)
                heading, hbuf = None, []
        flush()

        books[code] = {
            "name": localized or CODE_TO_BOOK[code][2],
            "chapters": chapters,
            "superscriptions": headings.superscriptions(chapters),
            "dropped": headings.dropped,
        }

    return books


# =============================================================================
# USFM parsing (a publisher's own files)
# =============================================================================
# USFM is the format USFX is made from: one file per book, one marker per
# paragraph, with verse markers and character styles inline. The Berean
# Standard Bible is published this way; its verse text differs from eBible's
# conversion by hundreds of verses, so it is read at the source.
#
# Notes are removed whole first, then the character styles are unwrapped, and
# what is left is a stream of paragraph markers and the text under each. A
# heading marker's text is a heading (see HEADING_SFMS); any other marker's
# text belongs to the open verse. A heading does not end the verse: the
# Berean's Song of Songs puts "The Friends" between two lines of one verse.
_USFM_NOTE = re.compile(r"\\(f|fe|x|ef|ex|fig)\b.*?\\\1\*", re.S)
# Attribute-bearing styles keep the text before the bar: \w word|strong\w*,
# \ref Matthew 5:3|MAT 5:3\ref*.
_USFM_BARRED = re.compile(r"\\(\+?(?:w|ref|rb|xt|jmp))\s+([^\\|]*)\|[^\\]*\\\1\*")
# Styles whose content is not readable text: alternate verse and chapter numbers.
_USFM_SILENT = re.compile(r"\\(va|vp|ca|cp)\s[^\\]*\\\1\*")
_USFM_CLOSE = re.compile(r"\\\+?[a-z]+\d*\*")
_USFM_MARKER = re.compile(r"\\(\+?[a-z]+\d*)\s*")
# Character styles: the marker is dropped and the words stay. Everything else
# that is not a heading or a structural marker is a paragraph.
_USFM_CHAR = {"w", "wj", "nd", "add", "qs", "qac", "sc", "it", "bd", "bdit", "em", "no",
              "tl", "pn", "png", "k", "qt", "sls", "bk", "dc", "ord", "wh", "wg", "wa",
              "ndx", "rb", "pro", "ref", "jmp", "sup", "rq", "ior", "iqt", "xt"}


def parse_usfm(text: str) -> tuple:
    """
    Parse one USFM book into (code, book), `book` shaped as parse_usfx's.
    Returns (None, None) for a file without a canonical `\\id`.
    """
    text = _USFM_NOTE.sub(" ", text)
    text = _USFM_BARRED.sub(r"\2", text)
    text = _USFM_SILENT.sub("", text)
    text = _USFM_CLOSE.sub("", text)
    text = text.replace("~", " ").replace("//", " ")

    code = None
    header = toc2 = None
    chapters: dict = {}
    headings = _Headings()
    cur_ch = cur_v = None
    verse_begun = False
    buf: list = []
    hbuf: list = []
    heading: str | None = None
    heading_verse_begun = False

    def flush():
        nonlocal buf
        if cur_ch is not None and cur_v is not None and buf:
            t = _clean("".join(buf))
            if t:
                existing = chapters[cur_ch].get(cur_v, "")
                chapters[cur_ch][cur_v] = (existing + " " + t).strip() if existing else t
        buf = []

    def end_heading():
        nonlocal heading, hbuf
        if heading is not None:
            headings.heading(heading, _clean("".join(hbuf)), cur_ch, heading_verse_begun)
        heading, hbuf = None, []

    markers = list(_USFM_MARKER.finditer(text))
    for i, m in enumerate(markers):
        marker = m.group(1).lstrip("+")
        content = text[m.end():markers[i + 1].start() if i + 1 < len(markers) else len(text)]
        base = _heading_base(marker)

        if marker == "id":
            code = content.split()[0].upper() if content.split() else None
            continue
        if marker == "h":
            header = _clean(content)
            continue
        if marker == "toc2":
            toc2 = _clean(content)
            continue
        if marker == "c":
            flush()
            end_heading()
            n = _verse_number(content)
            if n is not None:
                cur_ch, cur_v = n, None
                verse_begun = False
                chapters.setdefault(cur_ch, {})
                headings.chapter_begins()
            continue
        if marker == "v":
            flush()
            number, _, rest = content.lstrip().partition(" ")
            cur_v = _verse_number(number)
            if cur_ch is not None:
                chapters.setdefault(cur_ch, {})
                headings.verse_begins(cur_ch)
                verse_begun = True
            (hbuf if heading is not None else buf).append(rest)
            continue
        if marker in _USFM_CHAR:
            (hbuf if heading is not None else buf).append(content)
            continue

        # A paragraph or heading marker ends any heading in progress.
        end_heading()
        if base:
            heading, heading_verse_begun = base, verse_begun
            hbuf.append(content)
        elif cur_v is not None:
            buf.append(content)
    flush()
    end_heading()

    if code not in CODE_TO_BOOK:
        return None, None
    return code, {
        "name": toc2 or header or CODE_TO_BOOK[code][2],
        "chapters": chapters,
        "superscriptions": headings.superscriptions(chapters),
        "dropped": headings.dropped,
    }


def parse_usfm_zip(zip_bytes: bytes) -> dict:
    """Parse every USFM file in a zip into the shape parse_usfx returns."""
    books: dict = {}
    with zipfile.ZipFile(io.BytesIO(zip_bytes)) as zf:
        for name in sorted(zf.namelist()):
            if not name.lower().endswith((".usfm", ".sfm")):
                continue
            code, book = parse_usfm(zf.read(name).decode("utf-8-sig"))
            if code:
                books[code] = book
    return books


# =============================================================================
# aruljohn KJV JSON parsing
# =============================================================================
def fetch_aruljohn(cache_dir: Path, use_cache: bool) -> dict:
    """Fetch all 66 KJV books from aruljohn/Bible-kjv and normalize them."""
    base = "https://raw.githubusercontent.com/aruljohn/Bible-kjv/master"
    books: dict = {}

    for number, code, english, slug, abbrev, testament in CANONICAL_BOOKS:
        filename = english.replace(" ", "") + ".json"        # "1 Samuel" -> "1Samuel.json"
        url = f"{base}/{filename}"
        cache_path = cache_dir / "aruljohn" / filename
        try:
            raw = fetch_bytes(url, cache_path, use_cache)
        except HTTPError as e:
            print(f"    ! {english}: HTTP {e.code} for {url} — skipping this book")
            continue

        data = json.loads(raw.decode("utf-8"))
        chapters: dict = {}
        for ch in data.get("chapters", []):
            ch_num = int(str(ch.get("chapter")))
            verses = {}
            for v in ch.get("verses", []):
                v_num = int(str(v.get("verse")))
                verses[v_num] = _clean(str(v.get("text", "")))
            chapters[ch_num] = verses

        books[code] = {"name": english, "chapters": chapters}

    return books


# =============================================================================
# Writing canonical output
# =============================================================================
# =============================================================================
# SWORD zText parsing (CrossWire modules)
# =============================================================================
# CrossWire ships its Bibles as a compiled binary format rather than as plain
# XML, so this parser is a little more involved than the USFX one. Three files
# per testament:
#
#   {ot,nt}.bzs   block index  — 12 bytes per block: offset, compressed size,
#                                uncompressed size. BlockType=BOOK, so block N
#                                holds book N (block 0 is the module header).
#   {ot,nt}.bzz   the zlib-compressed blocks themselves.
#   {ot,nt}.bzv   verse index  — 10 bytes per entry: block, start, size. Entries
#                                run in versification order and address a BYTE
#                                slice of the *uncompressed* block.
#
# osis2mod strips <verse> milestones when it compiles a module, so verse
# boundaries exist only in the .bzv index. What survives inside the block text
# are the <div type="book"> and <chapter osisID="Book.N"> markers, which get
# their own index entries — that is how we recover book/chapter structure
# without needing a versification table: walk the entries in order, treat the
# marker entries as structure, and number everything else sequentially within
# the current chapter.
#
# Entries of size 0 are verses this translation does not contain. They still
# advance the verse counter, so surrounding verses keep their canonical
# numbers (the Bungo module has two such gaps, both Hebrew/English
# versification offsets).

# OSIS book identifiers -> our USFM codes. OSIS and USFM disagree on many
# abbreviations (Deut/DEU, Song/SNG, Phil/PHP, Nah/NAM …), so this is spelled
# out rather than inferred.
OSIS_TO_USFM = {
    "Gen": "GEN", "Exod": "EXO", "Lev": "LEV", "Num": "NUM", "Deut": "DEU",
    "Josh": "JOS", "Judg": "JDG", "Ruth": "RUT", "1Sam": "1SA", "2Sam": "2SA",
    "1Kgs": "1KI", "2Kgs": "2KI", "1Chr": "1CH", "2Chr": "2CH", "Ezra": "EZR",
    "Neh": "NEH", "Esth": "EST", "Job": "JOB", "Ps": "PSA", "Prov": "PRO",
    "Eccl": "ECC", "Song": "SNG", "Isa": "ISA", "Jer": "JER", "Lam": "LAM",
    "Ezek": "EZK", "Dan": "DAN", "Hos": "HOS", "Joel": "JOL", "Amos": "AMO",
    "Obad": "OBA", "Jonah": "JON", "Mic": "MIC", "Nah": "NAM", "Hab": "HAB",
    "Zeph": "ZEP", "Hag": "HAG", "Zech": "ZEC", "Mal": "MAL",
    "Matt": "MAT", "Mark": "MRK", "Luke": "LUK", "John": "JHN", "Acts": "ACT",
    "Rom": "ROM", "1Cor": "1CO", "2Cor": "2CO", "Gal": "GAL", "Eph": "EPH",
    "Phil": "PHP", "Col": "COL", "1Thess": "1TH", "2Thess": "2TH",
    "1Tim": "1TI", "2Tim": "2TI", "Titus": "TIT", "Phlm": "PHM", "Heb": "HEB",
    "Jas": "JAS", "1Pet": "1PE", "2Pet": "2PE", "1John": "1JN", "2John": "2JN",
    "3John": "3JN", "Jude": "JUD", "Rev": "REV",
}

# Japanese book names for the Bungo module.
#
# zText modules carry no per-book localized headers (only a testament-level
# <title>), so without this the Japanese Bible would land with English book
# names. Taken from SWORD's own locales.d/ja-utf8.conf (sword-1.9.0), with four
# upstream kana typos corrected: テモテヘ/テトスヘ/ピレモンヘ use the katakana ヘ
# where the particle へ is meant, and Zephaniah is ゼバニヤ for ゼパニヤ.
#
# Caveat: these are the modern (口語訳-era) names. The 1887/1917 text itself
# would write several of them in classical forms (出埃及記, 使徒行傳,
# ヨハネ傳福音書 …). They identify each book correctly, which is the job of this
# field; swap the table if you'd rather ship period-accurate spellings.
#
# This is display metadata keyed off CANONICAL_BOOKS' USFM codes — it defines
# no book numbers, order, or chapter counts, so it is NOT a fourth canon
# definition and carries no canon-sync burden.
JA_BOOK_NAMES = {
    "GEN": "創世記", "EXO": "出エジプト記", "LEV": "レビ記", "NUM": "民数記",
    "DEU": "申命記", "JOS": "ヨシュア記", "JDG": "士師記", "RUT": "ルツ記",
    "1SA": "サムエル記上", "2SA": "サムエル記下", "1KI": "列王紀上",
    "2KI": "列王紀下", "1CH": "歴代志上", "2CH": "歴代志下", "EZR": "エズラ記",
    "NEH": "ネヘミヤ記", "EST": "エステル記", "JOB": "ヨブ記", "PSA": "詩篇",
    "PRO": "箴言", "ECC": "伝道の書", "SNG": "雅歌", "ISA": "イザヤ書",
    "JER": "エレミヤ書", "LAM": "哀歌", "EZK": "エゼキエル書", "DAN": "ダニエル書",
    "HOS": "ホセア書", "JOL": "ヨエル書", "AMO": "アモス書", "OBA": "オバデヤ書",
    "JON": "ヨナ書", "MIC": "ミカ書", "NAM": "ナホム書", "HAB": "ハバクク書",
    "ZEP": "ゼパニヤ書", "HAG": "ハガイ書", "ZEC": "ゼカリヤ書", "MAL": "マラキ書",
    "MAT": "マタイによる福音書", "MRK": "マルコによる福音書",
    "LUK": "ルカによる福音書", "JHN": "ヨハネによる福音書", "ACT": "使徒行伝",
    "ROM": "ローマ人への手紙", "1CO": "コリント人への第一の手紙",
    "2CO": "コリント人への第二の手紙", "GAL": "ガラテヤ人への手紙",
    "EPH": "エペソ人への手紙", "PHP": "ピリピ人への手紙",
    "COL": "コロサイ人への手紙", "1TH": "テサロニケ人への第一の手紙",
    "2TH": "テサロニケ人への第二の手紙", "1TI": "テモテへの第一の手紙",
    "2TI": "テモテへの第二の手紙", "TIT": "テトスへの手紙",
    "PHM": "ピレモンへの手紙", "HEB": "ヘブル人への手紙", "JAS": "ヤコブの手紙",
    "1PE": "ペテロの第一の手紙", "2PE": "ペテロの第二の手紙",
    "1JN": "ヨハネの第一の手紙", "2JN": "ヨハネの第二の手紙",
    "3JN": "ヨハネの第三の手紙", "JUD": "ユダの手紙", "REV": "ヨハネの黙示録",
}


# Marker tags, matched WITHOUT assuming attribute order. XML attribute order is
# not meaningful, and modules differ: JapBungo writes
#   <div osisID="Gen" sID="gen2" type="book"/>
# while FreBDM1744 writes
#   <div canonical="true" osisID="Gen" sID="gen2" type="book"/>
#   <chapter n="1" osisID="Gen.1" sID="Gen.1"/>
# An `osisID`-must-come-first regex silently parses zero books from the latter.
# French book names for Bible Martin.
#
# FreBDM1744 embeds only x-usfm-toc1, the long form — "Le Saint Evangile de
# Notre Seigneur Jésus-Christ selon Saint Matthieu" — and leaves the short
# toc2/toc3 empty. Those titles are authentic but unusable as picker labels, and
# they would read oddly beside the other French translations in a
# side-by-side view. (The source also carries a typo, "Le Livre deJosué".)
#
# These are the standard short French names of the books, a list of titles that
# carries none of any translation's text, so that the French translations agree.
# (They were copied from `ostervald` before its withdrawal, and martin1744's
# committed books still carry them.) Same role as JA_BOOK_NAMES: display metadata
# keyed off CANONICAL_BOOKS' USFM codes, defining no numbering — not a canon
# definition.
FR_BOOK_NAMES = {
    "GEN": "Genèse", "EXO": "Exode", "LEV": "Lévitique", "NUM": "Nombres",
    "DEU": "Deutéronome", "JOS": "Josué", "JDG": "Juges", "RUT": "Ruth",
    "1SA": "1 Samuel", "2SA": "2 Samuel", "1KI": "1 Rois", "2KI": "2 Rois",
    "1CH": "1 Chroniques", "2CH": "2 Chroniques", "EZR": "Esdras",
    "NEH": "Néhémie", "EST": "Esther", "JOB": "Job", "PSA": "Psaumes",
    "PRO": "Proverbes", "ECC": "Ecclésiaste", "SNG": "Cantique",
    "ISA": "Esaïe", "JER": "Jérémie", "LAM": "Lamentations",
    "EZK": "Ezéchiel", "DAN": "Daniel", "HOS": "Osée", "JOL": "Joël",
    "AMO": "Amos", "OBA": "Abdias", "JON": "Jonas", "MIC": "Michée",
    "NAM": "Nahum", "HAB": "Habacuc", "ZEP": "Sophonie", "HAG": "Aggée",
    "ZEC": "Zacharie", "MAL": "Malachie", "MAT": "Matthieu", "MRK": "Marc",
    "LUK": "Luc", "JHN": "Jean", "ACT": "Actes", "ROM": "Romains",
    "1CO": "1 Corinthiens", "2CO": "2 Corinthiens", "GAL": "Galates",
    "EPH": "Ephésiens", "PHP": "Philippiens", "COL": "Colossiens",
    "1TH": "1 Thessalonicien", "2TH": "2 Thessalonicien",
    "1TI": "1 Timothée", "2TI": "2 Timothée", "TIT": "Tite",
    "PHM": "Philemon", "HEB": "Hébreux", "JAS": "Jacques", "1PE": "1 Pierre",
    "2PE": "2 Pierre", "1JN": "1 Jean", "2JN": "2 Jean", "3JN": "3 Jean",
    "JUD": "Jude", "REV": "Apocalypse",
}

_OSIS_MARKER_TAG_RE = re.compile(r"<(div|chapter)\b([^>]*?)/?>")
_OSIS_ATTR_RE = re.compile(r'(\w+)="([^"]*)"')


def _osis_marker(fragment: str):
    """
    Classify an index entry's leading tag.

    Returns ("book", code) | ("chapter", (code, number)) | None.
    """
    # A marker counts only if no real text precedes it in the same entry. Other
    # markup may — paragraph divs, milestones, section titles.
    #
    # Both simpler rules are wrong, in opposite directions:
    #  - "first tag only" missed FreBDM1744, where a paragraph div precedes the
    #    marker: <div sID="gen1423" type="x-p"/><chapter osisID="Mark.3" .../>
    #    Job came out as 1 chapter instead of 42.
    #  - "any tag anywhere" broke JapBungo, where a chapter's last verse is
    #    followed in its own entry by the next chapter's opening marker. That
    #    silently dropped the closing verse of all 1,189 chapters.
    #
    # FreBDM1744 also puts a chapter summary in <transChange> right after the
    # marker, so "the entry has no text at all" fails too — hence *preceding*
    # text specifically. Closing markers carry no osisID and are skipped.
    # The LAST marker in the entry wins, not the first. An entry can hold a run
    # of markers, and what governs the verses that follow is whatever is still
    # open at the end of it. FreBDM1744's Haggai is the case that proves it:
    #
    #   <chapter osisID="Hag.2" sID/> <chapter eID="Hag.2"/> ... <chapter osisID="Hag.1" sID/>
    #
    # a stray empty Hag.2 opens and closes before Hag.1 opens. Taking the first
    # marker filed all of Haggai 1's verses under chapter 2 and left chapter 1
    # missing entirely.
    found = None
    pos = 0
    for match in _OSIS_MARKER_TAG_RE.finditer(fragment):
        if _clean_osis(fragment[pos:match.start()]):
            break
        pos = match.end()

        tag, attr_text = match.group(1), match.group(2)
        attrs = dict(_OSIS_ATTR_RE.findall(attr_text))
        osis_id = attrs.get("osisID")
        if not osis_id:
            continue

        if tag == "div" and attrs.get("type") == "book":
            found = ("book", osis_id)
        elif tag == "chapter":
            book, _, chapter = osis_id.rpartition(".")
            if book and chapter.isdigit():
                found = ("chapter", (book, int(chapter)))
    return found
_OSIS_NOTE_RE = re.compile(r"<note\b.*?</note>", re.S)
_OSIS_TITLE_RE = re.compile(r"<title\b.*?</title>", re.S)
# A Psalm's superscription, as OSIS marks it. Attribute order is not fixed, so
# the type is looked for anywhere in the tag.
_OSIS_PSALM_TITLE_RE = re.compile(r"<title\b[^>]*\btype=\"psalm\"[^>]*>(.*?)</title>", re.S)
_OSIS_TAG_RE = re.compile(r"<[^>]*>")


def _clean_osis(fragment: str) -> str:
    """
    Strip OSIS markup down to running text.

    Drops footnotes and headings outright — section headings, FreBDM1744's
    chapter summaries (`type="x-s"`) and acrostic letters, and Psalm titles,
    which parse_sword_ztext has already taken for the chapter's superscription.
    Everything else is unwrapped rather than removed, which matters for
    <w gloss="…">漢字</w>: that is furigana (a reading gloss on the kanji), so we
    keep the kanji and discard the gloss. Translator additions (<transChange>)
    are kept, matching what the USFX parser does.
    """
    fragment = _OSIS_NOTE_RE.sub("", fragment)
    fragment = _OSIS_TITLE_RE.sub("", fragment)
    fragment = _OSIS_TAG_RE.sub("", fragment)
    return re.sub(r"\s+", " ", fragment).strip()


def parse_sword_ztext(zip_bytes: bytes, module: str,
                      book_names: dict | None = None) -> dict:
    """
    Parse a CrossWire zText module into:
        { usfm_code: {"name": <english name>, "chapters": {chap: {verse: text}}} }

    The module carries no per-book localized headers (only a testament-level
    title), so book names come from `book_names` (USFM code -> localized name)
    when given, and fall back to the canonical English ones otherwise.

    A `<title type="psalm">` in the first verse's entry is the chapter's
    superscription. In one after it (JapBungo's Psalm 119 marks the Hebrew
    letters that way) they are section headings, and the chapter gets none.
    """
    books: dict = {}
    titles: dict = {}        # (code, chapter) -> [title, ...]
    acrostic: set = set()    # (code, chapter) with a psalm title after verse 1

    def book_entry(code):
        return books.setdefault(code, {"name": None, "chapters": {}, "superscriptions": {},
                                       "dropped": Counter()})

    with zipfile.ZipFile(io.BytesIO(zip_bytes)) as zf:
        names = {n.rsplit("/", 1)[-1]: n for n in zf.namelist()
                 if f"/{module}/" in n or n.startswith(f"{module}/")}

        for testament in ("ot", "nt"):
            try:
                bzs = zf.read(names[f"{testament}.bzs"])
                bzz = zf.read(names[f"{testament}.bzz"])
                bzv = zf.read(names[f"{testament}.bzv"])
            except KeyError:
                continue  # NT-only or OT-only module

            blocks: dict = {}
            for i in range(len(bzs) // 12):
                offset, csize, _usize = struct.unpack("<III", bzs[i * 12:(i + 1) * 12])
                blocks[i] = zlib.decompress(bzz[offset:offset + csize]) if csize else b""

            code = None
            chapter = None
            verse_no = 0
            previous = None

            for i in range(len(bzv) // 10):
                block, start, size = struct.unpack("<IIH", bzv[i * 10:(i + 1) * 10])
                # .bzv offsets are byte offsets into the decompressed block, so
                # slice the bytes and decode after — slicing decoded text would
                # corrupt every multi-byte (i.e. every Japanese) verse.
                raw = (blocks.get(block, b"")[start:start + size]
                       .decode("utf-8", "replace") if size else "")

                marker = _osis_marker(raw)
                if marker:
                    kind, value = marker
                    if kind == "book":
                        code = OSIS_TO_USFM.get(value)
                        chapter, verse_no = None, 0
                    else:
                        book_id, chapter_no = value
                        code = OSIS_TO_USFM.get(book_id)
                        chapter, verse_no = chapter_no, 0
                    previous = None
                    continue

                if code is None or chapter is None:
                    continue

                verse_no += 1                      # empty slices still count

                # Two consecutive entries addressing one slice are a verse the
                # translation runs together with the one before it (osis2mod
                # "links" them; JapBungo's Psalm 49 has 1-2 as one verse). The
                # text stands under the first number; repeating it under the
                # second would show one verse twice.
                entry = book_entry(code)
                if size and (block, start, size) == previous:
                    entry["dropped"]["verse linked to the one before"] += 1
                    continue
                previous = (block, start, size)

                psalm_titles = _OSIS_PSALM_TITLE_RE.findall(raw)
                for found in psalm_titles:
                    title = _clean_osis(found)
                    if not title:
                        continue
                    if verse_no == 1:
                        titles.setdefault((code, chapter), []).append(title)
                    else:
                        acrostic.add((code, chapter))
                        entry["dropped"]["d"] += 1
                entry["dropped"]["s"] += len(_OSIS_TITLE_RE.findall(raw)) - len(psalm_titles)

                text = _clean_osis(raw)
                if not text:
                    continue
                entry["chapters"].setdefault(chapter, {})[verse_no] = text

    for (code, chapter), parts in titles.items():
        entry = books.get(code)
        if entry is None or not entry["chapters"].get(chapter):
            continue
        if (code, chapter) in acrostic:
            entry["dropped"]["d"] += len(parts)
            continue
        entry["superscriptions"][chapter] = " ".join(parts)

    for code, entry in books.items():
        if not entry["name"]:
            entry["name"] = (book_names or {}).get(code) or CODE_TO_BOOK[code][2]
    return books


def load_kept_book(tid: str, code: str, out_dir: Path) -> dict:
    """
    Read a committed book back into the shape the parsers return.

    Raises FileNotFoundError when it is not there: a fresh output directory has
    to fail, because carrying on would either write 65 books or tempt someone
    into taking the book from the source that got it wrong.
    """
    number, _, _, slug, _, _ = CODE_TO_BOOK[code]
    book = json.loads((out_dir / tid / "books" / f"{number:02d}-{slug}.json")
                      .read_text(encoding="utf-8"))
    return {
        "name": book["name"],
        "chapters": {ch["number"]: {v["number"]: v["text"] for v in ch["verses"]}
                     for ch in book["chapters"]},
        "superscriptions": {ch["number"]: ch["superscription"]
                            for ch in book["chapters"] if ch.get("superscription")},
    }


def write_translation(tid: str, entry: dict, books: dict, out_dir: Path) -> dict:
    """Write metadata.json + books/NN-slug.json. Returns a small stats dict."""
    base = out_dir / tid
    books_dir = base / "books"
    books_dir.mkdir(parents=True, exist_ok=True)

    written, missing, empty_verses = [], [], 0

    for number, code, english, slug, abbrev, testament in CANONICAL_BOOKS:
        if code not in books or not books[code]["chapters"]:
            missing.append(english)
            continue

        src = books[code]
        superscriptions = src.get("superscriptions", {})
        chapter_list = []
        for ch_num in sorted(src["chapters"]):
            verse_list = []
            for v_num in sorted(src["chapters"][ch_num]):
                text = src["chapters"][ch_num][v_num]
                if not text:
                    empty_verses += 1
                verse_list.append({"number": v_num, "text": text})
            chapter = {"number": ch_num}
            # Optional, and absent rather than empty: a Psalm's title stands
            # before verse 1 unnumbered, so it is the chapter's, not verse 1's.
            if superscriptions.get(ch_num):
                chapter["superscription"] = superscriptions[ch_num]
            chapter["verses"] = verse_list
            chapter_list.append(chapter)

        book_json = {
            "number": number,
            "name": src["name"],
            "abbreviation": abbrev,
            "testament": testament,
            "chapters": chapter_list,
        }
        path = books_dir / f"{number:02d}-{slug}.json"
        path.write_text(json.dumps(book_json, ensure_ascii=False, indent=2), encoding="utf-8")
        written.append((number, code))

    # Determine testament coverage from what was actually written.
    testaments = {CODE_TO_BOOK[c][5] for _, c in written}
    coverage = "both" if {"OT", "NT"} <= testaments else (testaments.pop() if testaments else "none")

    metadata = {
        "id": tid,
        "name": entry["name"],
        "language": entry["language"],
        "license": entry["license"],
        "attribution": entry["attribution"],
        # Optional, and absent rather than empty: most translations have none.
        **{key: entry[key] for key in ("attribution_lang", "license_url", "rights_notice") if key in entry},
        "source_url": entry["source_url"],
        "year": entry["year"],
        "testament": coverage,
        "book_count": len(written),
    }
    (base / "metadata.json").write_text(
        json.dumps(metadata, ensure_ascii=False, indent=2), encoding="utf-8"
    )

    # What the headings became, for the status log: titles kept, the rest left out.
    kept = sum(len(books[c].get("superscriptions", {})) for _, c in written)
    dropped = Counter()
    for _, c in written:
        dropped.update(books[c].get("dropped", {}))
    return {"written": len(written), "missing": missing, "empty_verses": empty_verses,
            "superscriptions": kept, "dropped": dropped}


# =============================================================================
# Orchestration
# =============================================================================
def ingest_one(tid: str, entry: dict, out_dir: Path, cache_dir: Path, use_cache: bool) -> bool:
    source = entry["source"]
    print(f"\n→ {tid}  ({entry['name']}, {entry['language']}, {entry['license']})")

    if source == "manual":
        print(f"    · skipped — no automated parser configured.")
        if entry.get("note"):
            print(f"      {entry['note']}")
        return False

    try:
        if source == "usfx":
            if entry.get("verify"):
                print(f"    · note: eBible id '{entry['ebible_id']}' is unverified; "
                      f"if this fails, confirm it at https://ebible.org/find/")
            url = f"https://ebible.org/Scriptures/{entry['ebible_id']}_usfx.zip"
            cache_path = cache_dir / f"{entry['ebible_id']}_usfx.zip"
            print(f"    · downloading {url}")
            zip_bytes = fetch_bytes(url, cache_path, use_cache)
            with zipfile.ZipFile(io.BytesIO(zip_bytes)) as zf:
                xml_name = next((n for n in zf.namelist() if n.lower().endswith("usfx.xml")), None)
                if xml_name is None:
                    xml_name = next((n for n in zf.namelist() if n.lower().endswith(".xml")), None)
                if xml_name is None:
                    print("    ! no XML found inside the zip — skipping")
                    return False
                xml_bytes = zf.read(xml_name)
            books = parse_usfx(xml_bytes)

        elif source == "usfm":
            url = entry["usfm_url"]
            cache_path = cache_dir / url.rsplit("/", 1)[-1]
            print(f"    · downloading {url}")
            books = parse_usfm_zip(fetch_bytes(url, cache_path, use_cache))

        elif source == "sword":
            url = entry["sword_url"]
            cache_path = cache_dir / url.rsplit("/", 1)[-1]
            print(f"    · downloading {url}")
            zip_bytes = fetch_bytes(url, cache_path, use_cache)
            names = globals().get(entry.get("book_names", ""), None)
            books = parse_sword_ztext(zip_bytes, entry["sword_module"], names)

            for code in entry.get("keep_books", ()):
                try:
                    books[code] = load_kept_book(tid, code, out_dir)
                except FileNotFoundError as e:
                    print(f"    ! {code} must not come from this source, and the committed "
                          f"copy is missing: {e.filename}")
                    print(f"      Restore it from git, then re-run. Nothing was written.")
                    return False
                print(f"    · kept {code} as committed; the module's text of it is wrong")

        elif source == "aruljohn":
            print(f"    · downloading 66 book files from aruljohn/Bible-kjv")
            books = fetch_aruljohn(cache_dir, use_cache)

        else:
            print(f"    ! unknown source type '{source}' — skipping")
            return False

    except HTTPError as e:
        print(f"    ! download failed: HTTP {e.code} for {e.url}")
        print(f"      Verify the source id/URL, then re-run.")
        return False
    except URLError as e:
        print(f"    ! network error: {e.reason}")
        return False
    except (IncompleteRead, TimeoutError) as e:
        print(f"    ! download truncated after retries ({type(e).__name__}) — re-run to resume.")
        return False
    except zipfile.BadZipFile:
        print(f"    ! the downloaded file was not a valid zip (delete the cached "
              f"file and retry, or verify the URL).")
        return False

    stats = write_translation(tid, entry, books, out_dir)
    print(f"    ✓ wrote {stats['written']}/66 books → {out_dir / tid}")
    if stats["superscriptions"]:
        print(f"    · {stats['superscriptions']} chapter titles kept as superscriptions")
    if stats["dropped"]:
        left = ", ".join(f"{k} {n}" for k, n in sorted(stats["dropped"].items()))
        print(f"    · headings left out of verses: {left}")
    if stats["missing"]:
        preview = ", ".join(stats["missing"][:5]) + ("…" if len(stats["missing"]) > 5 else "")
        print(f"    ⚠ {len(stats['missing'])} book(s) missing: {preview}")
    if stats["empty_verses"]:
        print(f"    ⚠ {stats['empty_verses']} empty verse(s) — spot-check the source")
    return stats["written"] == 66 and not stats["empty_verses"]


def main() -> int:
    parser = argparse.ArgumentParser(description="Download & normalize open Bible translations.")
    parser.add_argument("--only", nargs="+", metavar="ID",
                        help="ingest only these translation id(s)")
    parser.add_argument("--output-dir", default="data", help="output directory (default: data)")
    parser.add_argument("--cache-dir", default=".cache", help="download cache (default: .cache)")
    parser.add_argument("--no-cache", action="store_true", help="force re-download")
    parser.add_argument("--list", action="store_true", help="list configured translations and exit")
    args = parser.parse_args()

    if args.list:
        print(f"{'ID':<12}{'LANGUAGE':<10}{'LICENSE':<16}{'SOURCE':<10}NAME")
        print("-" * 78)
        for tid, e in TRANSLATIONS.items():
            print(f"{tid:<12}{e['language']:<10}{e['license']:<16}{e['source']:<10}{e['name']}")
        return 0

    targets = args.only or list(TRANSLATIONS.keys())
    unknown = [t for t in targets if t not in TRANSLATIONS]
    if unknown:
        print(f"Unknown translation id(s): {', '.join(unknown)}")
        print(f"Known: {', '.join(TRANSLATIONS)}")
        return 1

    out_dir = Path(args.output_dir)
    cache_dir = Path(args.cache_dir)
    use_cache = not args.no_cache

    print(f"Scriptura ingestion — {len(targets)} translation(s) → {out_dir}/")
    succeeded, attempted = [], []
    for tid in targets:
        entry = TRANSLATIONS[tid]
        if entry["source"] != "manual":
            attempted.append(tid)
        if ingest_one(tid, entry, out_dir, cache_dir, use_cache):
            succeeded.append(tid)

    print("\n" + "=" * 60)
    print(f"Done. {len(succeeded)}/{len(attempted)} automated translation(s) ingested cleanly.")
    if succeeded:
        print(f"  ✓ {', '.join(succeeded)}")
    manual = [t for t in targets if TRANSLATIONS[t]["source"] == "manual"]
    if manual:
        print(f"  · manual (need a dedicated step): {', '.join(manual)}")
    print("Next: run your validator over data/, then commit.")
    return 0


if __name__ == "__main__":
    sys.exit(main())