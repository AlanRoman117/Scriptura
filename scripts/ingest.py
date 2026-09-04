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

It supports two source formats:
  • "usfx"     — a single USFX XML file inside a .zip (eBible.org). One parser
                 handles many translations across many languages.
  • "aruljohn" — clean per-book JSON from github.com/aruljohn/Bible-kjv.

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
import sys
import zipfile
from pathlib import Path
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
#   "aruljohn" -> per-book JSON from the aruljohn/Bible-kjv repo.
#   "manual"   -> no automated parser yet; the script will skip it and explain.
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
        "attribution": "Versión Biblia Libre (Free Bible Version) — CC BY-SA 4.0",
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
        "source_url": "https://ebible.org/find/details.php?id=engasv",
        "year": 1901,
        "source": "usfx",
        "ebible_id": "engasv",
        "verify": True,
    },
    "ylt": {
        "name": "Young's Literal Translation",
        "language": "en",
        "license": "public-domain",
        "attribution": "Young's Literal Translation — Public Domain",
        "source_url": "https://ebible.org/find/details.php?id=engylt",
        "year": 1898,
        "source": "usfx",
        "ebible_id": "engylt",
        "verify": True,
    },
    # --- Configured but not yet automated (need a dedicated parser/source) ---
    "bsb": {
        "name": "Berean Standard Bible",
        "language": "en",
        "license": "public-domain",
        "attribution": "Berean Standard Bible — Public Domain (2023)",
        "source_url": "https://berean.bible",
        "year": 2023,
        "source": "manual",
        "note": "Download the spreadsheet/CSV from berean.bible (dated AFTER "
                "2023-04-30 — earlier files carry the old restrictive license).",
    },
    "martin1744": {
        "name": "Bible Martin",
        "language": "fr",
        "license": "public-domain",
        "attribution": "Bible Martin 1744 — Domaine public",
        "source_url": "https://github.com/scrollmapper/bible_databases",
        "year": 1744,
        "source": "manual",
        "note": "Available from scrollmapper/bible_databases (SQLite/JSON/CSV).",
    },
    "ostervald": {
        "name": "Bible Ostervald",
        "language": "fr",
        "license": "public-domain",
        "attribution": "Bible Ostervald 1867 — Domaine public",
        "source_url": "https://github.com/seven1m/open-bibles",
        "year": 1867,
        "source": "manual",
        "note": "Available from seven1m/open-bibles as fra-ostervald.osis.xml.",
    },
    "bungo": {
        "name": "文語訳聖書 (Classical)",
        "language": "ja",
        "license": "public-domain",
        "attribution": "文語訳聖書 (Bungo-yaku, 1887/1917) — Public Domain",
        "source_url": "https://bible.salterrae.net",
        "year": 1917,
        "source": "manual",
        "note": "No clean structured download exists; text on bible.salterrae.net "
                "needs a dedicated scraper/converter. Hardest of the set.",
    },
}

# Elements whose inner content is NOT part of the readable verse text
# (footnotes, cross-references, remarks, figure captions). We skip their
# subtrees but keep any tail text that follows them.
NOTE_TAGS = {"f", "fe", "x", "xe", "ef", "ex", "note", "fig", "rem", "periph",
             "fr", "ft", "fk", "fq", "fl", "fv", "xo", "xt", "xk"}


# =============================================================================
# Download helpers (stdlib only, with a simple on-disk cache)
# =============================================================================
def fetch_bytes(url: str, cache_path: Path, use_cache: bool = True) -> bytes:
    """Download `url`, caching the raw bytes at `cache_path` for fast re-runs."""
    if use_cache and cache_path.exists():
        return cache_path.read_bytes()
    req = Request(url, headers={"User-Agent": USER_AGENT})
    with urlopen(req, timeout=60) as resp:
        data = resp.read()
    cache_path.parent.mkdir(parents=True, exist_ok=True)
    cache_path.write_bytes(data)
    return data


# =============================================================================
# USFX parsing
# =============================================================================
def _localname(tag: str) -> str:
    """Return an XML tag name without its namespace, e.g. '{ns}book' -> 'book'."""
    return tag.rsplit("}", 1)[-1] if "}" in tag else tag


def _walk(elem):
    """
    Yield tokens in document order so we can reconstruct verses from USFX's
    "milestone" markers. USFX marks verse/chapter *boundaries* with empty
    elements; the actual text lives in the surrounding `.text`/`.tail`.

    Token types: ('chapter', n), ('verse', n), ('verse_end', None), ('text', s)
    """
    tag = _localname(elem.tag)

    if tag in NOTE_TAGS:                      # skip note bodies, keep trailing text
        if elem.tail:
            yield ("text", elem.tail)
        return

    if tag == "c":                            # chapter milestone
        yield ("chapter", elem.get("id"))
    elif tag == "v":                          # verse-start milestone
        yield ("verse", elem.get("id"))
    elif tag == "ve":                         # verse-end milestone
        yield ("verse_end", None)

    if elem.text:                             # text held by this element
        yield ("text", elem.text)
    for child in elem:                        # then descend into children
        yield from _walk(child)
    if elem.tail:                             # then text that follows this element
        yield ("text", elem.tail)


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
        { usfm_code: {"name": <localized header>, "chapters": {chap: {verse: text}}} }
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
        cur_ch = cur_v = None
        buf: list = []

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
                    chapters.setdefault(cur_ch, {})
            elif kind == "verse":
                flush()
                cur_v = _verse_number(value)
                if cur_ch is not None:
                    chapters.setdefault(cur_ch, {})
            elif kind == "verse_end":
                flush()
                cur_v = None
            elif kind == "text" and cur_v is not None:
                buf.append(value)
        flush()

        books[code] = {
            "name": localized or CODE_TO_BOOK[code][2],
            "chapters": chapters,
        }

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
        chapter_list = []
        for ch_num in sorted(src["chapters"]):
            verse_list = []
            for v_num in sorted(src["chapters"][ch_num]):
                text = src["chapters"][ch_num][v_num]
                if not text:
                    empty_verses += 1
                verse_list.append({"number": v_num, "text": text})
            chapter_list.append({"number": ch_num, "verses": verse_list})

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
        "source_url": entry["source_url"],
        "year": entry["year"],
        "testament": coverage,
        "book_count": len(written),
    }
    (base / "metadata.json").write_text(
        json.dumps(metadata, ensure_ascii=False, indent=2), encoding="utf-8"
    )

    return {"written": len(written), "missing": missing, "empty_verses": empty_verses}


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
    except zipfile.BadZipFile:
        print(f"    ! the downloaded file was not a valid zip (delete the cached "
              f"file and retry, or verify the URL).")
        return False

    stats = write_translation(tid, entry, books, out_dir)
    print(f"    ✓ wrote {stats['written']}/66 books → {out_dir / tid}")
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