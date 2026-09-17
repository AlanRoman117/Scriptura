#!/usr/bin/env python3
"""
Scriptura — canon sync checker
==============================

The canon is defined in three places, in two languages:

    packages/validate/src/canon.ts   CANON            (TypeScript)
    scripts/validate.py              CANON            (Python)
    scripts/ingest.py                CANONICAL_BOOKS  (Python)

Keeping them consistent has been a documented manual discipline, and manual
discipline is how `canon.ts` came to carry the wrong abbreviation for 45 of its
66 books without anyone noticing — the field was simply never read.

This script makes that failure mode loud: it parses all three definitions plus
the committed book files under `data/`, and reports any disagreement about book
numbers, names, testaments, chapter counts, or the filename slugs the REST
routes address books by.

Standard library only. Run it directly, or via CI alongside validate.py.

    python scripts/check-canon-sync.py
    python scripts/check-canon-sync.py --data-dir data
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent

TS_CANON = REPO / "packages" / "validate" / "src" / "canon.ts"
PY_VALIDATE = REPO / "scripts" / "validate.py"
PY_INGEST = REPO / "scripts" / "ingest.py"


# =============================================================================
# Parsers — each reads one canon definition into {number: {...}}
# =============================================================================
def parse_ts_canon(path: Path) -> dict:
    """`{ number: 1, name: 'Genesis', testament: 'OT', chapters: 50 },`"""
    text = path.read_text(encoding="utf-8")
    rows = re.findall(
        r"\{\s*number:\s*(\d+),\s*name:\s*'([^']+)',\s*"
        r"testament:\s*'(\w+)',\s*chapters:\s*(\d+)\s*\}",
        text,
    )
    return {
        int(n): {"name": name, "testament": t, "chapters": int(c)}
        for n, name, t, c in rows
    }


def parse_py_validate(path: Path) -> dict:
    """`1: ("Genesis", "OT", 50),` inside the CANON dict."""
    text = path.read_text(encoding="utf-8")
    block = re.search(r"^CANON\s*=\s*\{(.*?)^\}", text, re.S | re.M)
    if not block:
        raise SystemExit(f"could not locate CANON in {path}")
    rows = re.findall(
        r'(\d+):\s*\(\s*"([^"]+)",\s*"(\w+)",\s*(\d+)\s*\)', block.group(1)
    )
    return {
        int(n): {"name": name, "testament": t, "chapters": int(c)}
        for n, name, t, c in rows
    }


def parse_py_ingest(path: Path) -> dict:
    """`(1, "GEN", "Genesis", "genesis", "Gen", "OT"),` in CANONICAL_BOOKS."""
    text = path.read_text(encoding="utf-8")
    block = re.search(r"^CANONICAL_BOOKS\s*=\s*\[(.*?)^\]", text, re.S | re.M)
    if not block:
        raise SystemExit(f"could not locate CANONICAL_BOOKS in {path}")
    rows = re.findall(
        r'\(\s*(\d+),\s*"(\w+)",\s*"([^"]+)",\s*"([^"]+)",\s*"([^"]+)",\s*"(\w+)"\s*\)',
        block.group(1),
    )
    return {
        int(n): {
            "usfm": usfm,
            "name": name,
            "slug": slug,
            "abbreviation": abbrev,
            "testament": t,
        }
        for n, usfm, name, slug, abbrev, t in rows
    }


def parse_data(data_dir: Path) -> dict:
    """
    What the committed files actually say.

    Read from whichever translation carries English book names, since the
    others are localized; the slug, number, testament and chapter count are
    identical across all of them.
    """
    reference = data_dir / "kjv"
    if not reference.is_dir():
        return {}

    books = {}
    for path in sorted((reference / "books").glob("*.json")):
        book = json.loads(path.read_text(encoding="utf-8"))
        books[book["number"]] = {
            "name": book["name"],
            "slug": re.sub(r"^\d+-", "", path.stem),
            "abbreviation": book["abbreviation"],
            "testament": book["testament"],
            "chapters": len(book["chapters"]),
        }
    return books


# =============================================================================
def main() -> int:
    parser = argparse.ArgumentParser(description="Verify the canon definitions agree.")
    parser.add_argument("--data-dir", default="data", help="data directory (default: data)")
    args = parser.parse_args()

    data_dir = Path(args.data_dir)
    if not data_dir.is_absolute():
        data_dir = REPO / data_dir

    sources = {
        "canon.ts": parse_ts_canon(TS_CANON),
        "validate.py": parse_py_validate(PY_VALIDATE),
        "ingest.py": parse_py_ingest(PY_INGEST),
    }
    data = parse_data(data_dir)

    print("Canon sync check\n")
    errors: list[str] = []

    # --- each definition must hold all 66 books, numbered 1..66 ---
    for label, canon in sources.items():
        if len(canon) != 66:
            errors.append(f"{label}: has {len(canon)} books, expected 66")
        missing = sorted(set(range(1, 67)) - set(canon))
        if missing:
            errors.append(f"{label}: missing book number(s) {missing}")
        print(f"  {label:<14} {len(canon)} books")
    print(f"  {'data/kjv':<14} {len(data)} books" if data else "  data/kjv       (absent — skipping data comparison)")

    # --- the three definitions must agree with each other ---
    for number in range(1, 67):
        for field in ("name", "testament"):
            values = {
                label: canon[number][field]
                for label, canon in sources.items()
                if number in canon and field in canon[number]
            }
            if len(set(values.values())) > 1:
                errors.append(f"book {number} {field}: " + ", ".join(f"{k}={v!r}" for k, v in values.items()))

        chapters = {
            label: canon[number]["chapters"]
            for label, canon in sources.items()
            if number in canon and "chapters" in canon[number]
        }
        if len(set(chapters.values())) > 1:
            errors.append(f"book {number} chapters: " + ", ".join(f"{k}={v}" for k, v in chapters.items()))

    # --- and all of them must agree with the committed data ---
    for number, actual in data.items():
        for label, canon in sources.items():
            entry = canon.get(number)
            if not entry:
                continue
            if entry.get("name") != actual["name"]:
                errors.append(
                    f"book {number} name: {label}={entry.get('name')!r} but data={actual['name']!r}"
                )
            if entry.get("testament") != actual["testament"]:
                errors.append(
                    f"book {number} testament: {label}={entry.get('testament')!r} but data={actual['testament']!r}"
                )
            # Chapter counts legitimately vary by versification, so they are
            # compared between definitions above but not against the data here;
            # scripts/validate.py already handles that with its variant table.
            if "abbreviation" in entry and entry["abbreviation"] != actual["abbreviation"]:
                errors.append(
                    f"book {number} abbreviation: {label}={entry['abbreviation']!r} but data={actual['abbreviation']!r}"
                )
            # The slug is what REST routes address books by, so a mismatch here
            # would silently break URLs.
            if "slug" in entry and entry["slug"] != actual["slug"]:
                errors.append(
                    f"book {number} slug: {label}={entry['slug']!r} but data={actual['slug']!r}"
                )

    print()
    print("=" * 60)
    if errors:
        for e in errors:
            print(f"  ERROR  {e}")
        print(f"\n{len(errors)} disagreement(s) between canon definitions.")
        print("✗ canon sync FAILED")
        return 1

    print("All canon definitions agree with each other and with data/.")
    print("✓ canon sync passed")
    return 0


if __name__ == "__main__":
    sys.exit(main())
