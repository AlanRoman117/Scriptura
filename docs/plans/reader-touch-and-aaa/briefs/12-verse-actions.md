# Brief 12 — Verse actions at 44 px, docked on a phone

| | |
|---|---|
| **ID** | `12-verse-actions` |
| **Size** | M |
| **Depends on** | `03-focus` (dismiss stack, roving, return focus), `02-tokens` (`--control-h`, swatch ring) |
| **Status** | done (8ad97e8) |
| **Criteria** | 2.5.5 Target Size (Enhanced), 2.4.3 Focus Order, 4.1.2, 1.4.1 (names carry the collection), 2.5.8 |

## Outcome

Tapping a verse (or pressing Enter on its number) opens a row of actions whose every control is at least 44 × 44 px: five colour swatches named for the collection they add to ("Mark as Covenant promises (amber)"), Quote, Link, Canvas and Close. On a wide layout the row sits centred beneath the verse, as today; on a phone it docks as a bar above the notes sheet so the thumb reaches it. Opened from the keyboard, focus moves into the row and arrow keys walk it; closing returns focus to the verse number. A tap outside or Escape closes it.

## Read first

- `apps/reader/src/components/BiblePane.tsx` lines 53–65 and 186–292 — the verse `<p>`, the number button, the inline swatches.
- `apps/reader/src/styles.css` lines 267–336 — `.verse*`, `.swatches`, `.swatch`, `.swatches__action`.
- `apps/reader/src/lib/notes.ts` lines 36–37 and 70–86 — `HIGHLIGHT_COLORS`, `ColorLabels`, `colorLabel()`.
- `apps/reader/src/lib/focus.ts` — `useDismissable`, `useRovingTabIndex`, `useReturnFocus`.
- `tests/reader/notes.spec.ts` lines 81–128 — the geometry test (row centred below the verse within 24 px) and the keyboard test that must stay green.

## Rules that bite here

> "The click is ignored when `window.getSelection()` is not collapsed, so a drag that selects text to read or copy does not trip the swatches; `tests/reader/notes.spec.ts` drags with real mouse events and fails without the guard." — CLAUDE.md → Apps. Keep the guard.

> "The verse number is a `<button>`, and cannot use `vertical-align: super`… It is raised with `position: relative; top: -.35em` instead." — CLAUDE.md → Apps. Do not enlarge the number: 2.5.5's *inline* exception applies and the whole verse is the equivalent target. Document that in the matrix row.

> "`notes.spec.ts:82-100` — verse actions open below the verse, centred within 24 px on wide → keep `.swatches`/`.swatch` classes and that geometry on wide." — plan

## Current behaviour

Swatches are 16.8 px circles (`styles.css:318`) with 17 px-tall text actions; no Close; closable only by Escape (global listener) or re-tapping the verse; focus is not moved in or returned. Names are "Highlight amber" — the colour, not the collection. Colour labels (`colorLabels`) are not passed to `BiblePane`.

## Required behaviour

1. Extract `apps/reader/src/components/VerseActions.tsx` rendering `<span className="swatches" role="group" aria-label="Actions for verse N">` with: five `<button className="swatch" data-color=… data-testid="swatch-{color}">` whose `aria-label` is `Mark as {colorLabel(color, labels)} ({color})` and `aria-pressed` reflects the current mark; the `.swatches__rule` separator; Quote / Link / Canvas text buttons (`quote-N`, `link-N`, `canvas-N` testids kept); a Close button (`aria-label="Close verse actions"`, `data-testid="verse-actions-close"`).
2. Every control is ≥ 44 × 44 px: swatches get `min-width/min-height: var(--control-h)` with the coloured disc drawn as a 24 px inner element and a `--edge` ring; text buttons get `min-height: var(--control-h)`.
3. `BiblePane` receives `labels: ColorLabels` from `App` and passes it down.
4. `useDismissable` replaces the global Escape listener; a `pointerdown` outside the row (and outside the verse) closes it.
5. Opened via the verse-number button (keyboard or pointer on the button), focus moves to the first swatch; `useRovingTabIndex` makes the row one tab stop with Left/Right arrows; on close, focus returns to the verse number (`useReturnFocus`). Opened by tapping the prose, focus is not moved (a pointer user did not ask for it).
6. When `data-markers` is on (`prefs.markers`), each swatch shows its glyph (● ▲ ■ ◆ ★ for amber/rose/sky/mint/violet) inside the disc; see brief 22 for the same glyphs on verses.
7. Layout: in the split layout the row renders inline after the verse text, centred (`margin: .5rem auto 0`) — the existing geometry test passes. In the narrow layout (`Layout` exposes `data-mode="narrow"` on `.layout`; read it with a `useIsNarrow`-style hook or a prop), the row renders in a `position: fixed` bar with `bottom: calc(var(--sheet-h, 3.25rem) + env(safe-area-inset-bottom))`, full width, two rows on 360 px, and the open verse is scrolled into view above it (`scroll-padding-bottom` from brief 02).
8. The verse `<p>` keeps its click handler and the selection guard; it gains nothing else (the number is the accessible path; documented).

## Files you may touch

- `apps/reader/src/components/VerseActions.tsx` (new), `apps/reader/src/components/BiblePane.tsx`, `apps/reader/src/App.tsx` (pass `labels`), `apps/reader/src/styles.css`.
- `tests/reader/notes.spec.ts` (only to add the Close and name assertions), `tests/reader/keyboard.spec.ts`, `tests/reader-touch/verse-actions.spec.ts` (new).

## Tests to add or change

- `tests/reader/notes.spec.ts` — existing tests green; add: the swatch for amber has accessible name matching `/Mark as .*\(amber\)/`; after naming the amber collection "Covenant promises" in Marks, the name contains "Covenant promises".
- `tests/reader/keyboard.spec.ts` — focus `verse-1`, Enter → focus is on `swatch-amber`; ArrowRight → `swatch-rose`; Escape → focus on `verse-1`.
- `tests/reader-touch/verse-actions.spec.ts` — tap verse 2 → the row is visible, its bounding box bottom ≤ the sheet's top, every button ≥ 44 × 44; tap outside → closed.

## Acceptance commands

```bash
mise exec node@24 -- npm run lint
mise exec node@24 -- npx playwright test --project=reader tests/reader/notes.spec.ts tests/reader/study.spec.ts tests/reader/keyboard.spec.ts
mise exec node@24 -- npx playwright test --project=reader-touch tests/reader-touch/verse-actions.spec.ts
```

## Reviewer checklist

- [ ] `swatch-*`, `quote-N`, `link-N`, `canvas-N` testids unchanged.
- [ ] Selecting text with a drag still does not open the row.
- [ ] Every control in the row measures ≥ 44 × 44 in both layouts.
