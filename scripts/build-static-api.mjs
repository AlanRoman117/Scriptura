#!/usr/bin/env node
/**
 * Scriptura — static API builder
 * ==============================
 *
 * Compiles the normalized Bible data in `data/` into a tree of static JSON
 * files under `dist/`, one file per REST endpoint. Sync that tree to S3 and put
 * CloudFront in front of it and you have a globally-cached, serverless read API
 * — no running server required. (Dynamic /search and /compare are handled
 * separately by a Lambda; this builder only produces the static endpoints.)
 *
 * Endpoints produced (every file ends in .json):
 *
 *   /translations.json
 *       → array of all translations' metadata
 *   /translations/<id>.json
 *       → one translation's metadata + a lightweight book index
 *   /translations/<id>/<book>.json
 *       → book-level index (chapter list with verse counts)          [bonus]
 *   /translations/<id>/<book>/<chapter>.json
 *       → a full chapter: every verse with its text
 *   /translations/<id>/<book>/<chapter>/<verse>.json
 *       → a single verse                          (omit with --skip-verses)
 *
 *   <book> is the English slug taken from the source filename (e.g. 43-john.json
 *   → "john", 09-1-samuel.json → "1-samuel"), so routing is language-independent
 *   even for non-English translations.
 *
 * Why .json extensions?
 *   The verse endpoint /<id>/<book>/<chapter>/<verse> forces <chapter> to be a
 *   directory (it contains the verse files). A path segment can't be both a
 *   directory AND a bare file, so the chapter itself is served as
 *   "<chapter>.json" — which coexists with the "<chapter>/" directory cleanly.
 *   (Want extension-less URLs later? Add a CloudFront Function that appends
 *   ".json" to extension-less requests — the file tree here stays the same.)
 *
 * Usage:
 *   node scripts/build-static-api.mjs                 # build ./data → ./dist
 *   node scripts/build-static-api.mjs --data-dir data --out-dir dist
 *   node scripts/build-static-api.mjs --skip-verses   # chapters only (lean)
 *   node scripts/build-static-api.mjs --pretty        # indent output (debug)
 *
 * Zero dependencies — Node built-ins only (Node 18+).
 */

import { readFileSync, writeFileSync, mkdirSync, readdirSync, rmSync, existsSync }
  from "node:fs";
import { join, dirname, resolve, sep } from "node:path";

// --- tiny arg parser ---------------------------------------------------------
const args = process.argv.slice(2);
const getOpt = (name, fallback) => {
  const i = args.indexOf(name);
  return i !== -1 && args[i + 1] ? args[i + 1] : fallback;
};
const DATA_DIR = getOpt("--data-dir", "data");
const OUT_DIR = getOpt("--out-dir", "dist");
const SKIP_VERSES = args.includes("--skip-verses");
const PRETTY = args.includes("--pretty");

const serialize = (obj) => JSON.stringify(obj, null, PRETTY ? 2 : 0);

// A chapter or verse number used as a path segment.
//
// These come out of the book JSON, and JSON happily holds a string where a
// number belongs. `join` then resolves any "../" right out of OUT_DIR, so a
// crafted or corrupted book file could write anywhere the process can reach.
// scripts/validate.py already rejects non-integer numbers, but this script can
// be run on freshly-ingested data before the validator sees it.
function numericSegment(value, what) {
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`${what} must be a positive integer, got ${JSON.stringify(value)}`);
  }
  return String(value);
}

// Write `obj` to <OUT_DIR>/<relPath>.json, creating parent directories.
let filesWritten = 0;
function writeEndpoint(relPath, obj) {
  const full = join(OUT_DIR, `${relPath}.json`);
  // Belt and braces: never write outside the output tree, whatever built relPath.
  const root = resolve(OUT_DIR);
  if (resolve(full) !== root && !resolve(full).startsWith(root + sep)) {
    throw new Error(`refusing to write outside --out-dir: ${relPath}`);
  }
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, serialize(obj), "utf8");
  filesWritten++;
}

// Directories under data/ that are not translations. `schemas/` holds the JSON
// Schemas written by scripts/schema-gen.ts. Kept in step with the same list in
// scripts/validate.py.
const NON_TRANSLATION_DIRS = new Set(["schemas"]);

// Derive the URL slug from a book filename: "43-john.json" → "john".
const slugFromFilename = (name) =>
  name.replace(/\.json$/i, "").replace(/^\d+-/, "");

// -----------------------------------------------------------------------------
function build() {
  if (!existsSync(DATA_DIR)) {
    console.error(`✗ data directory not found: ${DATA_DIR}`);
    process.exit(1);
  }

  // Start from a clean output tree so a later `aws s3 sync --delete` is accurate.
  if (existsSync(OUT_DIR)) rmSync(OUT_DIR, { recursive: true, force: true });
  mkdirSync(OUT_DIR, { recursive: true });

  const translationDirs = readdirSync(DATA_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith(".") && !NON_TRANSLATION_DIRS.has(d.name))
    .map((d) => d.name)
    .sort();

  if (translationDirs.length === 0) {
    console.error(`✗ no translation directories in ${DATA_DIR}/`);
    process.exit(1);
  }

  console.log(`Building static API from ${DATA_DIR}/ → ${OUT_DIR}/`);
  if (SKIP_VERSES) console.log("  (--skip-verses: chapters only, no per-verse files)");

  const allTranslations = [];
  const totals = { translations: 0, books: 0, chapters: 0, verses: 0 };

  for (const id of translationDirs) {
    const tdir = join(DATA_DIR, id);

    // metadata.json is required.
    let meta;
    try {
      meta = JSON.parse(readFileSync(join(tdir, "metadata.json"), "utf8"));
    } catch (e) {
      console.error(`  ✗ ${id}: cannot read metadata.json (${e.message}) — skipping`);
      continue;
    }

    const booksDir = join(tdir, "books");
    if (!existsSync(booksDir)) {
      console.error(`  ✗ ${id}: no books/ directory — skipping`);
      continue;
    }

    const bookFiles = readdirSync(booksDir)
      .filter((f) => f.toLowerCase().endsWith(".json"))
      .sort((a, b) => parseInt(a, 10) - parseInt(b, 10)); // numeric prefix order

    const bookIndex = []; // lightweight list for the translation-level endpoint

    for (const file of bookFiles) {
      let book;
      try {
        book = JSON.parse(readFileSync(join(booksDir, file), "utf8"));
      } catch (e) {
        console.error(`  ✗ ${id}/${file}: invalid JSON (${e.message}) — skipping book`);
        continue;
      }

      const slug = slugFromFilename(file);
      const chapters = Array.isArray(book.chapters) ? book.chapters : [];

      // Book-level index endpoint (chapter numbers + verse counts).
      writeEndpoint(join("translations", id, slug), {
        translation: id,
        book: book.name,
        slug,
        number: book.number,
        abbreviation: book.abbreviation,
        testament: book.testament,
        chapters: chapters.map((c) => ({
          number: c.number,
          verses: Array.isArray(c.verses) ? c.verses.length : 0,
        })),
      });

      for (const chapter of chapters) {
        const verses = Array.isArray(chapter.verses) ? chapter.verses : [];

        // Full-chapter endpoint.
        writeEndpoint(join("translations", id, slug, numericSegment(chapter.number, "chapter.number")), {
          translation: id,
          book: book.name,
          book_slug: slug,
          book_number: book.number,
          chapter: chapter.number,
          verses: verses.map((v) => ({ number: v.number, text: v.text })),
        });
        totals.chapters++;

        // Single-verse endpoints.
        if (!SKIP_VERSES) {
          for (const v of verses) {
            writeEndpoint(
              join(
                "translations",
                id,
                slug,
                numericSegment(chapter.number, "chapter.number"),
                numericSegment(v.number, "verse.number")
              ),
              {
                translation: id,
                book: book.name,
                book_slug: slug,
                book_number: book.number,
                chapter: chapter.number,
                verse: v.number,
                reference: `${book.name} ${chapter.number}:${v.number}`,
                text: v.text,
              }
            );
          }
        }
        totals.verses += verses.length;
      }

      bookIndex.push({
        number: book.number,
        name: book.name,
        slug,
        chapters: chapters.length,
      });
      totals.books++;
    }

    // Translation-level endpoint: metadata + navigable book index.
    writeEndpoint(join("translations", id), { ...meta, books: bookIndex });

    // Base metadata (no heavy book index) for the top-level list.
    const { books, ...base } = meta;
    allTranslations.push(base);
    totals.translations++;

    console.log(`  ✓ ${id}: ${bookIndex.length} book(s), ` +
      `${bookIndex.reduce((n, b) => n + b.chapters, 0)} chapter(s)`);
  }

  // Top-level list of all translations.
  writeEndpoint("translations", allTranslations);

  console.log("\n" + "=".repeat(60));
  console.log(
    `Done: ${totals.translations} translation(s), ${totals.books} book(s), ` +
    `${totals.chapters} chapter(s), ${totals.verses} verse(s).`
  );
  console.log(`Wrote ${filesWritten.toLocaleString()} JSON file(s) to ${OUT_DIR}/`);
  if (!SKIP_VERSES && totals.verses > 20000) {
    console.log(
      `Note: per-verse files make this a large object count. That's fine on S3, ` +
      `but the first sync is slower and each PUT has a tiny cost. Use ` +
      `--skip-verses for a leaner build (verses still available via chapters).`
    );
  }
  console.log(`Next: aws s3 sync ${OUT_DIR}/ s3://<bucket>/ --delete ` +
    `--content-type application/json`);
}

build();
