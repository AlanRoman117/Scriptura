#!/usr/bin/env python3
"""
Scriptura — data validation / integrity gate
=============================================

Validates every translation directory in `data/` against the canonical schema
and the project's licensing rules. Designed to run in CI on every push/PR: it
exits non-zero if any ERROR is found, which fails the build.

What it checks
--------------
ERRORS (fail the build — these are unambiguous bugs):
  • metadata.json missing, malformed, or missing a required field
  • license missing or not in the allowed set (the license audit)
  • directory id / metadata id mismatch
  • a forbidden translation (e.g. RV1960) sneaking in
  • malformed book JSON, duplicate book numbers, book number out of range
  • an expected canonical book missing, or an unexpected book present
  • book_count in metadata not matching the number of book files
  • a verse with empty text, a duplicate verse number, or a non-positive number
  • a book's testament tag disagreeing with the canon

WARNINGS (reported, do NOT fail the build — may be legitimate):
  • chapter count differing from the Western-canon reference
  • total verse count outside a rough sanity band
  • a filename's number prefix not matching the book's internal number

Why the ERROR/WARNING split matters
------------------------------------
Translations follow different *versification* traditions. Modern critical-text
Bibles legitimately omit certain verses (e.g. Acts 8:37), and books like Joel
and Malachi have different chapter counts in Hebrew vs. Western numbering. Those
must not fail CI — so they're warnings a human can eyeball, not hard errors.
Structural corruption (empty text, missing books, bad license) IS a hard error.

Usage
-----
    python validate.py                 # validate ./data
    python validate.py --data-dir data # explicit path
    python validate.py --only kjv      # one translation
    python validate.py --strict        # treat warnings as errors too

Requires only the Python standard library (3.9+).
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

# Allowed license identifiers (must match the ingestion registry / schema enum).
LICENSE_ENUM = {"public-domain", "cc-by-sa-4.0", "cc0", "custom-free"}

REQUIRED_META = ["id", "name", "language", "license", "attribution",
                 "source_url", "year", "testament", "book_count"]

# Canonical reference: book number -> (English name, testament, expected chapters).
# Chapter counts are the standard Western/Protestant numbering.
CANON = {
    1: ("Genesis", "OT", 50),        2: ("Exodus", "OT", 40),
    3: ("Leviticus", "OT", 27),      4: ("Numbers", "OT", 36),
    5: ("Deuteronomy", "OT", 34),    6: ("Joshua", "OT", 24),
    7: ("Judges", "OT", 21),         8: ("Ruth", "OT", 4),
    9: ("1 Samuel", "OT", 31),       10: ("2 Samuel", "OT", 24),
    11: ("1 Kings", "OT", 22),       12: ("2 Kings", "OT", 25),
    13: ("1 Chronicles", "OT", 29),  14: ("2 Chronicles", "OT", 36),
    15: ("Ezra", "OT", 10),          16: ("Nehemiah", "OT", 13),
    17: ("Esther", "OT", 10),        18: ("Job", "OT", 42),
    19: ("Psalms", "OT", 150),       20: ("Proverbs", "OT", 31),
    21: ("Ecclesiastes", "OT", 12),  22: ("Song of Solomon", "OT", 8),
    23: ("Isaiah", "OT", 66),        24: ("Jeremiah", "OT", 52),
    25: ("Lamentations", "OT", 5),   26: ("Ezekiel", "OT", 48),
    27: ("Daniel", "OT", 12),        28: ("Hosea", "OT", 14),
    29: ("Joel", "OT", 3),           30: ("Amos", "OT", 9),
    31: ("Obadiah", "OT", 1),        32: ("Jonah", "OT", 4),
    33: ("Micah", "OT", 7),          34: ("Nahum", "OT", 3),
    35: ("Habakkuk", "OT", 3),       36: ("Zephaniah", "OT", 3),
    37: ("Haggai", "OT", 2),         38: ("Zechariah", "OT", 14),
    39: ("Malachi", "OT", 4),        40: ("Matthew", "NT", 28),
    41: ("Mark", "NT", 16),          42: ("Luke", "NT", 24),
    43: ("John", "NT", 21),          44: ("Acts", "NT", 28),
    45: ("Romans", "NT", 16),        46: ("1 Corinthians", "NT", 16),
    47: ("2 Corinthians", "NT", 13), 48: ("Galatians", "NT", 6),
    49: ("Ephesians", "NT", 6),      50: ("Philippians", "NT", 4),
    51: ("Colossians", "NT", 4),     52: ("1 Thessalonians", "NT", 5),
    53: ("2 Thessalonians", "NT", 3),54: ("1 Timothy", "NT", 6),
    55: ("2 Timothy", "NT", 4),      56: ("Titus", "NT", 3),
    57: ("Philemon", "NT", 1),       58: ("Hebrews", "NT", 13),
    59: ("James", "NT", 5),          60: ("1 Peter", "NT", 5),
    61: ("2 Peter", "NT", 3),        62: ("1 John", "NT", 5),
    63: ("2 John", "NT", 1),         64: ("3 John", "NT", 1),
    65: ("Jude", "NT", 1),           66: ("Revelation", "NT", 22),
}

# Books whose chapter count legitimately varies by versification tradition.
CHAPTER_VARIANTS = {29: {3, 4}, 39: {3, 4}}  # Joel, Malachi (Hebrew vs. Western)

# Directories under data/ that are not translations. `schemas/` holds the JSON
# Schemas written by scripts/schema-gen.ts; without this, running `npm run
# schema:gen` makes `npm run validate` fail on a directory that was never a
# translation. Kept in step with the same list in scripts/build-static-api.mjs.
NON_TRANSLATION_DIRS = {"schemas"}

# Rough total-verse sanity bands per testament coverage (gross-corruption catch).
VERSE_BANDS = {"both": (30000, 32000), "OT": (22000, 24000), "NT": (7000, 8500)}

# Forbidden-translation guard: high-precision id substrings and text markers.
DENY_ID_SUBSTRINGS = {"rv1960", "rvr1960", "rvr60", "reinavalera1960", "kougo"}
DENY_TEXT_MARKERS = ["reina valera 1960", "reina-valera 1960", "口語訳"]

_NUM_PREFIX = re.compile(r"^(\d+)-")


def load_json(path: Path):
    """Return (data, None) or (None, error_message)."""
    try:
        return json.loads(path.read_text(encoding="utf-8")), None
    except FileNotFoundError:
        return None, f"{path} not found"
    except json.JSONDecodeError as e:
        return None, f"{path.name} is not valid JSON: {e}"


def validate_translation(tdir: Path, strict: bool):
    """Validate one translation directory. Returns (errors, warnings) lists."""
    errors: list[str] = []
    warnings: list[str] = []
    tid = tdir.name

    # --- Forbidden-translation guard (by directory id) ---
    norm_id = tid.replace("-", "").replace("_", "").lower()
    if any(bad in norm_id for bad in DENY_ID_SUBSTRINGS):
        errors.append(f"FORBIDDEN translation directory '{tid}' — this text is not "
                      f"public domain and must not be in this repo.")
        return errors, warnings  # stop immediately; don't process it further

    # --- metadata.json ---
    meta, err = load_json(tdir / "metadata.json")
    if err:
        errors.append(err)
        return errors, warnings
    if not isinstance(meta, dict):
        errors.append("metadata.json must be a JSON object")
        return errors, warnings

    for field in REQUIRED_META:
        if field not in meta:
            errors.append(f"metadata.json missing required field '{field}'")

    # License audit.
    lic = meta.get("license")
    if lic not in LICENSE_ENUM:
        errors.append(f"license '{lic}' is not one of {sorted(LICENSE_ENUM)}")

    # id must match directory name.
    if meta.get("id") != tid:
        errors.append(f"metadata id '{meta.get('id')}' != directory name '{tid}'")

    # Forbidden-translation guard (by attribution/name text).
    haystack = f"{meta.get('name','')} {meta.get('attribution','')}".lower()
    for marker in DENY_TEXT_MARKERS:
        if marker in haystack:
            errors.append(f"FORBIDDEN marker '{marker}' found in metadata — "
                          f"this text is not open-licensed.")

    # Determine expected canonical books from the declared testament.
    testament = meta.get("testament")
    if testament == "both":
        expected = set(CANON)
    elif testament == "OT":
        expected = {n for n, v in CANON.items() if v[1] == "OT"}
    elif testament == "NT":
        expected = {n for n, v in CANON.items() if v[1] == "NT"}
    else:
        errors.append(f"testament '{testament}' must be one of: both, OT, NT")
        expected = set()

    # --- books/ directory ---
    books_dir = tdir / "books"
    if not books_dir.is_dir():
        errors.append("missing books/ directory")
        return errors, warnings

    book_files = sorted(books_dir.glob("*.json"))
    if not book_files:
        errors.append("books/ contains no .json files")
        return errors, warnings

    seen_numbers: dict[int, str] = {}
    total_verses = 0

    for bf in book_files:
        data, err = load_json(bf)
        if err:
            errors.append(err)
            continue

        number = data.get("number")
        if not isinstance(number, int) or not (1 <= number <= 66):
            errors.append(f"{bf.name}: 'number' must be an int 1–66 (got {number!r})")
            continue
        if number in seen_numbers:
            errors.append(f"{bf.name}: duplicate book number {number} "
                          f"(also in {seen_numbers[number]})")
            continue
        seen_numbers[number] = bf.name

        # Filename prefix should match the internal number (warning only).
        m = _NUM_PREFIX.match(bf.name)
        if m and int(m.group(1)) != number:
            warnings.append(f"{bf.name}: filename prefix {m.group(1)} != "
                            f"book number {number}")

        # Basic field types.
        if not isinstance(data.get("name"), str) or not data.get("name", "").strip():
            errors.append(f"{bf.name}: 'name' must be a non-empty string")
        if not isinstance(data.get("abbreviation"), str) or not data.get("abbreviation", "").strip():
            errors.append(f"{bf.name}: 'abbreviation' must be a non-empty string")

        exp_name, exp_testament, exp_chapters = CANON[number]

        # Book testament must agree with the canon.
        if data.get("testament") != exp_testament:
            errors.append(f"{bf.name}: testament '{data.get('testament')}' should be "
                          f"'{exp_testament}' for {exp_name}")

        chapters = data.get("chapters")
        if not isinstance(chapters, list) or not chapters:
            errors.append(f"{bf.name}: 'chapters' must be a non-empty list")
            continue

        # Chapter count vs. reference (warning; respects known variants).
        accepted = CHAPTER_VARIANTS.get(number, {exp_chapters})
        if len(chapters) not in accepted:
            warnings.append(f"{bf.name}: {len(chapters)} chapters; expected "
                            f"{exp_chapters} for {exp_name} (check versification)")

        empty_reported = 0
        for ch in chapters:
            ch_num = ch.get("number")
            if not isinstance(ch_num, int) or ch_num < 1:
                errors.append(f"{bf.name}: chapter 'number' must be a positive int "
                              f"(got {ch_num!r})")
                continue
            verses = ch.get("verses")
            if not isinstance(verses, list) or not verses:
                errors.append(f"{bf.name} ch {ch_num}: 'verses' must be a non-empty list")
                continue

            seen_v: set[int] = set()
            for v in verses:
                v_num = v.get("number")
                text = v.get("text")
                if not isinstance(v_num, int) or v_num < 1:
                    errors.append(f"{bf.name} {ch_num}: verse 'number' must be a "
                                  f"positive int (got {v_num!r})")
                    continue
                if v_num in seen_v:
                    errors.append(f"{bf.name} {ch_num}:{v_num}: duplicate verse number")
                seen_v.add(v_num)
                if not isinstance(text, str) or not text.strip():
                    empty_reported += 1
                    if empty_reported <= 5:  # cap noise per book
                        errors.append(f"{bf.name} {ch_num}:{v_num}: empty verse text")
                else:
                    total_verses += 1
        if empty_reported > 5:
            errors.append(f"{bf.name}: …and {empty_reported - 5} more empty verse(s)")

    # --- Cross-file checks ---
    present = set(seen_numbers)
    missing = expected - present
    for n in sorted(missing):
        errors.append(f"missing expected book: {n:02d} {CANON[n][0]}")
    unexpected = present - expected
    for n in sorted(unexpected):
        errors.append(f"unexpected book for testament='{testament}': "
                      f"{n:02d} {CANON[n][0]}")

    # book_count must match the number of valid book files.
    if isinstance(meta.get("book_count"), int) and meta["book_count"] != len(present):
        errors.append(f"book_count {meta['book_count']} != {len(present)} book file(s)")

    # Rough verse-count sanity band (warning).
    band = VERSE_BANDS.get(testament)
    if band and not (band[0] <= total_verses <= band[1]):
        warnings.append(f"total verses {total_verses} outside rough {testament} band "
                        f"{band} — sanity-check the ingest")

    return errors, warnings


def main() -> int:
    ap = argparse.ArgumentParser(description="Validate Scriptura translation data.")
    ap.add_argument("--data-dir", default="data", help="path to data/ (default: data)")
    ap.add_argument("--only", nargs="+", metavar="ID", help="validate only these id(s)")
    ap.add_argument("--strict", action="store_true",
                    help="treat warnings as errors (fail on versification diffs too)")
    args = ap.parse_args()

    data_dir = Path(args.data_dir)
    if not data_dir.is_dir():
        print(f"✗ data directory not found: {data_dir}")
        return 1

    dirs = sorted(d for d in data_dir.iterdir()
                  if d.is_dir()
                  and not d.name.startswith(".")
                  and d.name not in NON_TRANSLATION_DIRS)
    if args.only:
        wanted = set(args.only)
        dirs = [d for d in dirs if d.name in wanted]
        missing = wanted - {d.name for d in dirs}
        if missing:
            print(f"✗ no such translation(s): {', '.join(sorted(missing))}")
            return 1
    if not dirs:
        print(f"✗ no translation directories found in {data_dir}/")
        return 1

    print(f"Validating {len(dirs)} translation(s) in {data_dir}/\n")
    total_err = total_warn = 0

    for d in dirs:
        errors, warnings = validate_translation(d, args.strict)
        total_err += len(errors)
        total_warn += len(warnings)

        if not errors and not warnings:
            print(f"  ✓ {d.name}")
        else:
            mark = "✗" if errors else "⚠"
            print(f"  {mark} {d.name}  ({len(errors)} error(s), {len(warnings)} warning(s))")
            for e in errors:
                print(f"      ERROR  {e}")
            for w in warnings:
                print(f"      warn   {w}")

    print("\n" + "=" * 60)
    print(f"{total_err} error(s), {total_warn} warning(s) across {len(dirs)} translation(s).")

    failed = total_err > 0 or (args.strict and total_warn > 0)
    if failed:
        print("✗ validation FAILED")
        return 1
    print("✓ validation passed")
    return 0


if __name__ == "__main__":
    sys.exit(main())