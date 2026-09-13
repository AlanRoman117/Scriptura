# Brief 94 — PNG icons for iOS and maskable Android icons

| | |
|---|---|
| **ID** | `94-icons` |
| **Size** | S |
| **Depends on** | none |
| **Status** | open |
| **Criteria** | none (install experience); noted by the audit |

## Outcome

Adding the reader to an iPhone home screen shows the app's icon; Android shows a maskable icon with the correct safe zone; the manifest lists separate `any` and `maskable` entries rather than one icon claiming both.

## Read first

- `apps/reader/public/icons/icon-192.svg`, `icon-512.svg` — the only icons (424 bytes each).
- `apps/reader/vite.config.ts` lines 56–59 — the manifest icons; `index.html` — no `apple-touch-icon`.

## Rules that bite here

> "Self-hosting a face would put binary assets in a repository whose product is text." — CLAUDE.md → Apps (fonts). Icons are the exception the product needs; keep them small (≤ 20 KB each) and generated from the SVG by a script, not hand-drawn.

## Required behaviour

1. `apps/reader/scripts/render-icons.mjs` rasterises the SVG with Playwright's Chromium (`page.setContent` + `screenshot`, already a devDependency — no new dependency) into `public/icons/icon-180.png` (apple-touch-icon), `icon-192.png`, `icon-512.png`, and `icon-512-maskable.png` (the artwork inset to 80 % on a solid background).
2. `index.html`: `<link rel="apple-touch-icon" href="/icons/icon-180.png">`.
3. Manifest: PNG entries for 192 and 512 with `purpose: 'any'`, the maskable 512 with `purpose: 'maskable'`; the SVGs stay as additional entries.
4. `npm run build --workspace @scriptura/reader` runs the render step (add to `bundle:text` or a new `icons` script chained in `build`); the PNGs are committed, like the SVGs, so a checkout without a browser still builds — the script is for regeneration.

## Acceptance commands

```bash
mise exec node@24 -- npm run build:reader
ls -la apps/reader/public/icons/
```
