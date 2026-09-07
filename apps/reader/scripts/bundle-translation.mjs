/**
 * Emit the one translation the app ships for offline use.
 *
 * Reuses scripts/build-static-api.mjs rather than reading data/ again, so the
 * bundled file is byte-identical to what the CDN serves — the reader must not
 * have its own idea of the payload shape.
 *
 * Output is generated, not committed: ~4.4MB raw (1.26MB over the wire gzipped).
 */
import { execFileSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, rmSync, statSync } from "node:fs";
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
