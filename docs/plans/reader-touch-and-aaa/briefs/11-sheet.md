# Brief 11 — The notes sheet: draggable, keyboard-aware, safe

| | |
|---|---|
| **ID** | `11-sheet` |
| **Size** | L |
| **Depends on** | `04-viewport` (`--vvh`, `usePointerDrag`), `02-tokens` (`--edge` for the handle) |
| **Status** | done (3234e70) |
| **Criteria** | 2.4.11/2.4.12 Focus Not Obscured, 2.5.7 (button alternative exists), 2.5.5; touch usability |

## Outcome

On a phone the notes sheet can be dragged up and down with a finger and snaps to peek, half or full; the grip button still cycles the same three positions and answers ArrowUp/ArrowDown. When the note body takes focus the sheet expands to full and is sized from the visual viewport, so the software keyboard never covers the caret. The grip clears the home indicator. While the sheet is full, the Bible pane behind it is inert, so Tab cannot land on a covered verse.

## Read first

- `apps/reader/src/components/Layout.tsx` lines 29–45 and 100–126 — `SheetPosition`, `useIsNarrow`, the narrow branch and the grip button.
- `apps/reader/src/styles.css` lines 928–953 — `.layout--narrow`, `.sheet*`; and 855 (`.notes` padding reserved for a control narrow mode never shows), 116 (`.reader__bar` right padding, same reason).
- `apps/reader/src/lib/viewport.ts` — `usePointerDrag`, `--vvh`, `--vv-top` (brief 04).
- `tests/reader/responsive.spec.ts` — the two tests that must keep passing; note the grip is found by name `/expand notes/i`.
- `docs/plans/reader-touch-and-aaa/README.md` → Architecture decision D — the sheet recipe.

## Rules that bite here

> "Tabs were the alternative and were rejected: switching away from the text to write about it loses exactly the context the layout exists to preserve." — `Layout.tsx` doc comment. The text stays visible at `half`.

> "`responsive.spec.ts:25` finds the sheet grip by `/expand notes/i` — the draggable grip must stay a `<button>` with that name." — plan

> "Escape and outside-click go through the dismiss stack." — AGENTS.md rule 9 (the sheet is not dismissable by Escape — it is a layout region, not a popup; do not add it to the stack).

## Current behaviour

The sheet is `position: fixed; bottom: 0` with heights `3.25rem / 50dvh / 92dvh` (`styles.css:940-944`). Only a click on the grip changes position (`Layout.tsx:117`). `dvh` ignores the keyboard on iOS, so at `half` with the keyboard up the textarea is behind the keyboard. No safe-area padding. `.notes` reserves 2.6 rem at the top for the maximize button that only exists in the split layout.

## Required behaviour

1. The grip uses `usePointerDrag`: dragging moves the sheet's top edge live (`--sheet-h` written on the sheet element as an inline style during the drag, transition disabled while dragging); on release it snaps to the nearest of peek/half/full, biased by release velocity (> 0.5 px/ms towards the direction of travel). A drag shorter than 8 px counts as a tap and does not change position; a real drag suppresses the following `click`.
2. The grip stays `<button className="sheet__grip">` with `aria-label` "Expand notes" / "Collapse notes" and `aria-expanded`; ArrowUp raises one step, ArrowDown lowers one step, Enter/Space cycles as today.
3. Heights come from the visual viewport: `.sheet` is positioned with `top: calc(var(--vv-top, 0px) + var(--vvh, 100dvh) - var(--sheet-h))` and `height: var(--sheet-h)`; `--sheet-h` is `3.25rem` at peek, `50%` of `--vvh` at half, `calc(var(--vvh) - env(safe-area-inset-top))` at full. `Layout` writes `--sheet-h` on `document.documentElement` too, so `.pane` scroll padding (brief 02, item 8) can use it.
4. When the note body (`notes-surface`) or title receives focus while narrow and the sheet is not full, the sheet goes to full. It does not shrink again on blur (the reader decides).
5. The Bible pane gets `inert` while the sheet is `full` (React 19 boolean attribute) and loses it otherwise. Assistive technology and Tab then skip the covered text.
6. `.sheet__grip { padding-bottom: calc(.5rem + env(safe-area-inset-bottom)) }`; `.sheet__handle` uses `--edge` (≥ 3:1) and is at least 44 px wide × 6 px tall inside a 44 px-tall grip.
7. `.layout--narrow .notes { padding-top: .75rem }` and `.layout--narrow .reader__bar { padding-right: 1rem }` — the reservations for the maximize button go away in narrow mode.
8. `body { overscroll-behavior: none }` in narrow mode so a sheet drag never becomes a page bounce.

## Files you may touch

- `apps/reader/src/components/Layout.tsx`, `apps/reader/src/components/NotesPane.tsx` (only to report focus on the surface/title via an `onFocusSurface` prop), `apps/reader/src/styles.css`.
- `tests/reader-touch/sheet.spec.ts` (new), `tests/reader/responsive.spec.ts` (only if the cycling assertions need the new snap names; they should not).

## Files you must not touch

`apps/reader/src/lib/viewport.ts` (ask the lead if the helper lacks something).

## Tests to add or change

- `tests/reader-touch/sheet.spec.ts` — (a) a CDP touch drag (`Input.dispatchTouchEvent` via `page.context().newCDPSession(page)`: touchStart on the grip, several touchMove steps upward by 300 px, touchEnd) moves the sheet to `half`; a second drag to the top moves it to `full`; (b) with `page.addStyleTag({ content: ':root{--vvh:420px}' })` the sheet at `full` has `boundingBox().height <= 420`; (c) focusing `notes-surface` at peek moves the sheet to `full` and `pane-bible` has the `inert` attribute; (d) the grip's bottom edge is ≥ the viewport bottom minus 1 px (no clipping) and the grip is ≥ 44 px tall.
- `tests/reader/responsive.spec.ts` — unchanged and green.

## Acceptance commands

```bash
mise exec node@24 -- npm run lint
mise exec node@24 -- npx playwright test --project=reader tests/reader/responsive.spec.ts
mise exec node@24 -- npx playwright test --project=reader-touch tests/reader-touch/sheet.spec.ts tests/reader-touch/shell.spec.ts
```

## Reviewer checklist

- [ ] A tap on the grip still cycles; a drag never also fires the tap.
- [ ] At `full` with `--vvh` reduced, the textarea's bounding box bottom ≤ `--vvh`.
- [ ] `inert` is removed when the sheet leaves `full`.
- [ ] Manual iOS check recorded in brief 91 (this environment cannot do it).
