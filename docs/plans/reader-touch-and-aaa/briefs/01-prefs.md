# Brief 01 — Display and accessibility preferences

| | |
|---|---|
| **ID** | `01-prefs` |
| **Size** | L |
| **Depends on** | `02-tokens` (the theme token blocks this switches between) |
| **Status** | done (7f61c47) |
| **Criteria** | 1.4.8 Visual Presentation (AAA), 2.3.3 Animation from Interactions (AAA), 1.4.4, 1.4.12; supports 1.4.6 and 1.4.1 |

## Outcome

A reader can choose a colour theme (including two high-contrast ones and sepia), a text size up to 200 %, a line-and-paragraph spacing preset, a column width, whether motion is reduced, and whether highlights carry a non-colour marker — from Settings, on this device, applied before the first paint on every later visit. `system` for theme and motion means "follow the operating system", which stays the default. Nothing here is exported or mirrored: it describes the device, not the user's work.

## Read first

- `apps/reader/src/lib/webmcp.ts` lines 54–62 and 463–486 — the one existing device-scoped preference (`localStorage`, synchronous, try/catch). Copy its shape and its reasoning.
- `apps/reader/src/components/SettingsPanel.tsx` (whole file, 133 lines) — stateless panel; groups are `<section className="settings__group">` with an `<h3>`; the toggle pattern at lines 91–99.
- `apps/reader/src/styles.css` lines 9–40 (tokens), 178–201 (chapter, verse spacing), 963–965 (the reduced-motion rule that only covers `transition`).
- `apps/reader/src/components/BiblePane.tsx` lines 67–74 — `scrollIntoView({ behavior: 'smooth' })` and the 1.6 s flash, both unconditional.
- `apps/reader/index.html` and `apps/reader/src/main.tsx` — where the inline script and the hook mount go.
- `apps/reader/src/App.tsx` lines 875–889 — how `SettingsPanel` is wired today.

## Rules that bite here

> "The enabled flag is in `localStorage`, not the IndexedDB stores: it describes *this device*, not the user's work, so it is neither exported nor mirrored — and reading it synchronously keeps registration from racing a database open." — CLAUDE.md → Architecture → Apps (WebMCP)

> "Imports only the pure subpaths … Importing `@scriptura/core` itself would pull `node:fs` into the bundle." — CLAUDE.md → Architecture → Apps

> "Tests select by `data-testid` and wait on content, not presence. Never remove or rename an existing `data-testid`." — AGENTS.md rule 7

> "No new dependencies." — AGENTS.md rule 4. No preference library, no store; a module and a hook.

## Current behaviour

- Theme is `@media (prefers-color-scheme: dark)` only (`styles.css:30-40`); there is no override and no `data-theme`.
- `--reading-size: 1.125rem`, `--reading-leading: 1.75`, `--measure: 34rem` exist as tokens (`styles.css:21-23`) but nothing changes them.
- Reduced motion disables `transition` (`styles.css:963-965`) but not the `verse-flash` animation (`:335-336`) or the smooth scroll (`BiblePane.tsx:70`).
- Settings has two groups: storage and assistant access. No display settings.

## Required behaviour

1. `apps/reader/src/lib/prefs.ts` exports `DisplayPrefs` with exactly these fields and unions: `theme: 'system' | 'light' | 'dark' | 'hc-light' | 'hc-dark' | 'sepia'`; `textSize: 100 | 112 | 125 | 150 | 175 | 200`; `spacing: 'normal' | 'relaxed' | 'loose'`; `measure: 'narrow' | 'normal' | 'wide'`; `motion: 'system' | 'reduce'`; `markers: boolean`. `DEFAULT_PREFS` is `system / 100 / normal / normal / system / false`.
2. `loadPrefs()` reads `localStorage['scriptura-display']` synchronously, validates every field against the unions (an unknown value falls back to the default for that field, never throws), and returns a complete object. `savePrefs(p)` writes it in a try/catch. `usePrefs(): [DisplayPrefs, (patch: Partial<DisplayPrefs>) => void]` keeps React state in step and calls `applyPrefs` on every change.
3. `applyPrefs(p)` sets on `document.documentElement`: `data-theme` (removed when `system`), `data-motion` (removed when `system`), `data-markers` (`"true"` or removed), and the custom properties `--reading-size` (`calc(1.125rem * size/100)`), `--reading-leading` and `--verse-gap` from the spacing preset (normal 1.75 / 0.85rem; relaxed 1.9 / 2.85em; loose 2.1 / 3.15em — 1.4.8 wants paragraph spacing of 1.5 × the *line spacing*, so the gap is 1.5 × the leading in em, not 1.5em), `--measure` from the measure preset (`56ch` / `64ch` / `70ch`; never above 70). It also sets both `<meta name="theme-color">` values for the effective theme.
4. A classic (non-module) inline `<script>` in `apps/reader/index.html`'s `<head>`, at most 15 lines, reads the same key and applies the same three attributes and the two metas before first paint, in a try/catch. Vite leaves non-module inline scripts verbatim.
5. `prefersReducedMotion(): boolean` returns true when `data-motion="reduce"` or `matchMedia('(prefers-reduced-motion: reduce)')` matches. `BiblePane` uses it to choose `behavior: 'auto'` and to skip the flash class.
6. `styles.css`: `[data-theme="…"]` blocks for each theme (see `02-tokens`); `[data-motion="reduce"]` and `(prefers-reduced-motion: reduce)` both disable `animation` and `transition` (`animation: none !important`, `transition: none !important`) and set `scroll-behavior: auto`; `.verse { margin-bottom: var(--verse-gap) }`; `.chapter { max-width: var(--measure) }` with `--measure` now in `ch`.
7. `SettingsPanel` gains two groups: **Reading & display** (theme `<select data-testid="pref-theme">`, text size stepper or select `pref-text-size`, spacing `pref-spacing`, width `pref-measure`) and **Accessibility** (motion `pref-motion`, markers checkbox `pref-markers`). Each control has a visible `<label>`. The panel stays stateless: values and `onChange` arrive as props from `App`, which owns `usePrefs()`.
8. `system` must never be written as an attribute value; the media queries remain the defaults.

## Files you may touch

- `apps/reader/src/lib/prefs.ts` (new), `apps/reader/index.html`, `apps/reader/src/main.tsx`, `apps/reader/src/App.tsx` (wiring only), `apps/reader/src/components/SettingsPanel.tsx`, `apps/reader/src/components/BiblePane.tsx` (lines 67–74 only), `apps/reader/src/styles.css`.
- `tests/unit/prefs.test.ts`, `tests/reader/settings.spec.ts`, `tests/reader/motion.spec.ts` (new).

## Files you must not touch

`apps/reader/src/lib/db.ts` (preferences are not IndexedDB), `apps/reader/src/lib/webmcp.ts`, anything under `packages/`.

## Tests to add or change

- `tests/unit/prefs.test.ts` — `loadPrefs` returns defaults for missing, malformed and partially-invalid JSON; round-trips a valid object; the inline script in `index.html` mentions the same storage key and attribute names the module exports (read the file and assert the strings appear — two sources of truth must not drift).
- `tests/reader/settings.spec.ts` — choosing text size 150 sets `--reading-size` on `<html>` to `calc(1.125rem * 1.5)` (compare computed font-size of `.chapter__text` before/after: ×1.5 within 1 px); reload → still applied; theme `dark` under an emulated light scheme sets `data-theme="dark"`; theme `system` removes the attribute.
- `tests/reader/motion.spec.ts` — with `page.emulateMedia({ reducedMotion: 'reduce' })`, jumping to a verse leaves no `.verse--flash` class and the pane's `scroll-behavior` computes to `auto`; the same with `pref-motion` set to `reduce` without emulation.

## Acceptance commands

```bash
mise exec node@24 -- npm run lint
mise exec node@24 -- npm test
mise exec node@24 -- npx playwright test --project=reader tests/reader/settings.spec.ts tests/reader/motion.spec.ts tests/reader/chrome.spec.ts
```

## Hand-back format

As in `00-template.md`. Include screenshots of Settings and of the chapter in `hc-dark` and `sepia`.

## Reviewer checklist

- [ ] No flash of the wrong theme on a hard reload with a stored non-system theme (inline script present and correct).
- [ ] `system` is absent from the DOM, never `data-theme="system"`.
- [ ] `--measure` never exceeds `70ch`.
- [ ] Spacing presets meet 1.4.8: line ≥ 1.5, paragraph ≥ 1.5 × line, at *relaxed* and *loose*.
