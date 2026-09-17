#!/usr/bin/env node
/**
 * Scriptura — site builder
 * ========================
 *
 * Assembles the reader and the files it downloads into one static folder, in
 * the shape GitHub Pages (or any static host) serves:
 *
 *   site/
 *     index.html  assets/  sw.js  manifest.webmanifest  icons/  bible/
 *                                          ← the reader, with its bundled Bible
 *     api/translations.json                ← the list the library refreshes from
 *     api/translations/<id>/full.json      ← each translation it can download
 *
 * Usage:
 *   node scripts/build-site.mjs                          # served at /, into site/
 *   node scripts/build-site.mjs --base /Scriptura/       # as GitHub Pages serves it
 *   node scripts/build-site.mjs --preview                # a review build
 *   node scripts/build-site.mjs --out-dir other/place
 *
 * `--preview` marks the build for the translation reviewers: kept out of
 * search results, with a notice that says where corrections go
 * (apps/reader/src/lib/preview.ts). The version shown is the root
 * package.json's, with the commit it was built from.
 *
 * The packages must be built first (`npm run build`), as for build:reader.
 * Zero dependencies — Node built-ins only.
 */
import { execFileSync } from "node:child_process";
import { existsSync, lstatSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REPO = join(dirname(fileURLToPath(import.meta.url)), "..");

const args = process.argv.slice(2);
const getOpt = (name, fallback) => {
  const i = args.indexOf(name);
  return i !== -1 && args[i + 1] ? args[i + 1] : fallback;
};
const trimmed = getOpt("--base", "/").replace(/^\/+|\/+$/g, "");
const BASE = trimmed ? `/${trimmed}/` : "/";
const OUT = resolve(REPO, getOpt("--out-dir", "site"));
const PREVIEW = args.includes("--preview");

/** Stop with a message, not a stack trace. */
function fail(message) {
  console.error(`✗ ${message}`);
  process.exit(1);
}

if (OUT === REPO || !OUT.startsWith(REPO)) fail(`--out-dir must be inside the repository: ${OUT}`);

const { version } = JSON.parse(readFileSync(join(REPO, "package.json"), "utf8"));
let commit = "";
try {
  commit = execFileSync("git", ["rev-parse", "--short", "HEAD"], { cwd: REPO, encoding: "utf8" }).trim();
} catch {
  // Not a checkout (a source archive): the version alone still says which build.
}
const VERSION = commit ? `${version} (${commit})` : version;

console.log(`Building the site into ${relative(REPO, OUT)}/ — base ${BASE}, ${PREVIEW ? "preview" : "release"} ${VERSION}`);
rmSync(OUT, { recursive: true, force: true });

// 1. The reader, built for the base. The workspace's own build script, so the
//    bundled Bible and the type-check run exactly as in build:reader; npm adds
//    the trailing arguments to its last command, `vite build`.
execFileSync(
  "npm",
  ["run", "build", "--workspace", "@scriptura/reader", "--", "--outDir", OUT, "--emptyOutDir"],
  {
    cwd: REPO,
    stdio: "inherit",
    env: {
      ...process.env,
      SCRIPTURA_BASE: BASE,
      VITE_SCRIPTURA_VERSION: VERSION,
      VITE_SCRIPTURA_PREVIEW: PREVIEW ? "1" : "",
    },
  }
);

// 2. What it downloads, beside it — from the same builder the API uses, so the
//    files are the ones a live server returns.
execFileSync(
  process.execPath,
  [
    join(REPO, "scripts", "build-static-api.mjs"),
    "--data-dir", join(REPO, "data"),
    "--out-dir", join(OUT, "api"),
    "--full-only",
  ],
  { stdio: "inherit" }
);

// 3. The shape a host will serve, checked rather than assumed.
const catalog = JSON.parse(readFileSync(join(OUT, "bible", "catalog.json"), "utf8"));
const listed = JSON.parse(readFileSync(join(OUT, "api", "translations.json"), "utf8"));
const required = [
  "index.html",
  "sw.js",
  "manifest.webmanifest",
  "bible/catalog.json",
  "api/translations.json",
  ...catalog.translations.map((t) => `api/translations/${t.id}/full.json`),
];
const missing = required.filter((file) => !existsSync(join(OUT, file)));
if (missing.length) fail(`missing from the site: ${missing.join(", ")}`);
if (listed.length !== catalog.translations.length) {
  fail(`the list has ${listed.length} translations and the bundled catalog ${catalog.translations.length}`);
}

const manifest = JSON.parse(readFileSync(join(OUT, "manifest.webmanifest"), "utf8"));
if (manifest.start_url !== BASE || manifest.scope !== BASE) {
  fail(`the manifest opens ${manifest.start_url} in scope ${manifest.scope}, not ${BASE}`);
}
const html = readFileSync(join(OUT, "index.html"), "utf8");
if (PREVIEW !== html.includes('name="robots"')) {
  fail(PREVIEW ? "a preview build must ask search engines not to index it" : "a release build must not carry noindex");
}

// GitHub Pages refuses links, and a site over 1 GB.
let bytes = 0;
let files = 0;
const walk = (dir) => {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    const info = lstatSync(path);
    if (info.isSymbolicLink()) fail(`a link cannot be published: ${relative(REPO, path)}`);
    if (info.isDirectory()) walk(path);
    else {
      bytes += info.size;
      files += 1;
    }
  }
};
walk(OUT);
if (bytes > 1024 ** 3) fail(`the site is ${(bytes / 1024 ** 3).toFixed(2)} GB; GitHub Pages allows 1 GB`);

console.log(`✓ ${files} files, ${(bytes / 1024 ** 2).toFixed(1)} MB, ${catalog.translations.length} translations to download`);
