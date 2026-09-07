/**
 * Emit the one translation the app ships for offline use, plus the catalogue.
 *
 * Reuses scripts/build-static-api.mjs rather than reading data/ again, so the
 * bundled file is byte-identical to what the CDN serves — the reader must not
 * have its own idea of the payload shape.
 *
 * Output is generated, not committed: ~4.4MB raw (1.26MB over the wire gzipped).
 */
import { execFileSync } from "node:child_process";
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const APP = join(HERE, "..");
const REPO = join(APP, "..", "..");

/** The default translation. Modern English, public domain, no attribution owed. */
const DEFAULT_TRANSLATION = "bsb";

const staged = mkdtempSync(join(tmpdir(), "scriptura-bundle-"));
try {
  execFileSync(
    process.execPath,
    [
      join(REPO, "scripts", "build-static-api.mjs"),
      // Absolute: the builder resolves --data-dir against cwd, and this runs
      // from apps/reader.
      "--data-dir", join(REPO, "data"),
      "--only", DEFAULT_TRANSLATION,
      "--skip-verses",
      "--out-dir", staged,
    ],
    { stdio: "pipe" }
  );

  const from = join(staged, "translations", DEFAULT_TRANSLATION, "full.json");
  const to = join(APP, "public", "bible", `${DEFAULT_TRANSLATION}.json`);
  mkdirSync(dirname(to), { recursive: true });
  cpSync(from, to);
  console.log(
    `bundled ${DEFAULT_TRANSLATION}: ${(statSync(to).size / 1048576).toFixed(2)}MB → public/bible/`
  );
} finally {
  rmSync(staged, { recursive: true, force: true });
}

/**
 * The catalogue of every registered translation, bundled with the app.
 *
 * A local-first reader has to be able to show what exists while offline —
 * otherwise the library is blank until the network comes back, including the
 * rows for translations already downloaded. It refreshes from /translations
 * when there *is* a network; this is the floor, not the source of truth.
 *
 * `translations` is exactly the /translations payload: the metadata files, in
 * directory order, which is what listTranslations() and the static builder both
 * produce. `approx_bytes` is a build-time convenience and is named for what it
 * is — the raw size of the book files, which is within a few percent of the
 * full.json a download actually transfers, and enough to answer "is this worth
 * pulling on mobile data?" before committing to it.
 */
// Kept in step with NON_TRANSLATION_DIRS in scripts/build-static-api.mjs and
// scripts/validate.py: data/schemas/ is not a translation.
const NON_TRANSLATION_DIRS = new Set(["schemas"]);

const dataDir = join(REPO, "data");
const ids = readdirSync(dataDir, { withFileTypes: true })
  .filter((d) => d.isDirectory() && !d.name.startsWith(".") && !NON_TRANSLATION_DIRS.has(d.name))
  .map((d) => d.name)
  .sort();

const translations = [];
const approxBytes = {};
for (const id of ids) {
  let meta;
  try {
    meta = JSON.parse(readFileSync(join(dataDir, id, "metadata.json"), "utf8"));
  } catch {
    continue; // A directory with no metadata is not a translation.
  }
  translations.push(meta);

  const booksDir = join(dataDir, id, "books");
  let bytes = 0;
  try {
    for (const f of readdirSync(booksDir)) {
      if (f.toLowerCase().endsWith(".json")) bytes += statSync(join(booksDir, f)).size;
    }
  } catch {
    bytes = 0;
  }
  approxBytes[id] = bytes;
}

const catalogPath = join(APP, "public", "bible", "catalog.json");
mkdirSync(dirname(catalogPath), { recursive: true });
writeFileSync(
  catalogPath,
  JSON.stringify({ translations, approx_bytes: approxBytes }),
  "utf8"
);
console.log(`catalog: ${translations.length} translation(s) → public/bible/`);
