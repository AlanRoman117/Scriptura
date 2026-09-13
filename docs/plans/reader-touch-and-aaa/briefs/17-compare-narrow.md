# Brief 17 — Side-by-side comparison on a narrow pane

| | |
|---|---|
| **ID** | `17-compare-narrow` |
| **Size** | S |
| **Depends on** | `02-tokens` |
| **Status** | open |
| **Criteria** | 1.4.10 Reflow, 1.3.1 (structure preserved), 2.5.5 (quote buttons), 3.1.2 (`lang` per translation) |

## Outcome

Below about 40 rem of pane width, a chapter comparison is read as a list of verses, each verse followed by every translation's text under that translation's name, instead of a table scrolled sideways. The data is the same `alignChapters` rows; verse alignment by number is preserved; each translation's text carries its own `lang`; the quote buttons are 44 px.

## Read first

- `apps/reader/src/components/ComparePane.tsx` (whole, 119 lines).
- `apps/reader/src/styles.css` lines 809–851 — `.compare*`.
- `tests/reader/library.spec.ts` lines 110–166 — the table assertions (`thead th` count 3, `tbody tr` first has `data-verse="1"`, `td` count 2) that hold on the desktop project.

## Rules that bite here

> "`alignChapters` keys rows on the verse number, never the array index. Critical-text translations legitimately omit verses (Acts 8:37)…" — CLAUDE.md → Packages → @scriptura/compare. Render from `rows`; never zip arrays.

> "`--measure` is the right width for one column of prose and the wrong one for a table." — `styles.css:811`. The stacked layout returns to the prose measure.

## Required behaviour

1. `ComparePane` measures its own width with a `ResizeObserver` (state `stacked = width < 640`), or reads a `data-mode="narrow"` from the layout — measuring is preferred because the split layout can also produce a narrow pane.
2. When `stacked`: render `<ol className="compare__stack" data-testid="compare-stack" role="list">`, one `<li data-verse={n}>` per row: the verse number (a visually hidden "Verse" before it), then a `<dl>` with, per column, `<dt>` the translation ID (full name visually hidden) and `<dd>` the text in that column's `lang` with its 44px quote button, or "Not in {ID}". No heading per verse: a chapter would otherwise add a hundred headings to the outline. The drop buttons (✕) render once, in a bar of translation chips above the list.
3. When not stacked: the existing table, unchanged, plus `lang` on each `<td>` (brief 21 also touches this; whichever lands first adds it) and `.compare__quote` at 44 px (brief 16).
4. The attribution footer renders in both modes.

## Files you may touch

- `apps/reader/src/components/ComparePane.tsx`, `apps/reader/src/styles.css`.
- `tests/reader-touch/compare.spec.ts` (new).

## Tests to add or change

- `tests/reader-touch/compare.spec.ts` — install rv1909 (reuse the `install` helper pattern from `library.spec.ts`), compare, expect `compare-stack` visible, no horizontal overflow of `.pane--bible`, the first `li` has `data-verse="1"` and contains both "In the beginning was the Word" and "el principio era el Verbo"; the Spanish `dd` has `lang="es"`.
- `tests/reader/library.spec.ts` — unchanged and green on the desktop project.

## Acceptance commands

```bash
mise exec node@24 -- npm run lint
mise exec node@24 -- npx playwright test --project=reader tests/reader/library.spec.ts
mise exec node@24 -- npx playwright test --project=reader-touch tests/reader-touch/compare.spec.ts
```
