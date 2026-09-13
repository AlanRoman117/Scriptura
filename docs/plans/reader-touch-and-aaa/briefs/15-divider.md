# Brief 15 — The pane divider: a real target, and a way without dragging

| | |
|---|---|
| **ID** | `15-divider` |
| **Size** | S |
| **Depends on** | `04-viewport` (`usePointerDrag`), `02-tokens` (`--edge`) |
| **Status** | done (dbc11e0) |
| **Criteria** | 2.5.5 / 2.5.8 Target Size, 2.5.7 Dragging Movements, 1.4.11 Non-text Contrast, 4.1.2 (`aria-valuetext`) |

## Outcome

The divider between the panes is a 44 px-wide target with a visible grip, draggable with capture and cancellation, adjustable by Home/End as well as the arrows, described to assistive technology in words ("58 % Bible, 42 % notes"), and — for a pointer that cannot drag — adjustable by tapping "Narrower" and "Wider" controls.

## Read first

- `apps/reader/src/components/Layout.tsx` lines 4–27 (`NARROW`, `MIN_PANE`, `splitLimits`), 71–98 (drag), 153–174 (the divider element).
- `apps/reader/src/styles.css` lines 97–105 — `.divider`.
- `tests/reader/reading.spec.ts` lines 43–54 and `tests/reader/chrome.spec.ts` lines 102–178 — the ArrowLeft/ArrowRight contracts (40 presses reach the floor at 0.02 per step).

## Rules that bite here

> "The pane divider's floor is a width (`MIN_PANE = 320`), not a share… `tests/reader/chrome.spec.ts` asserts the floor." — CLAUDE.md → Apps. Limits are untouched.

> "no `::before` hit areas — real boxes via padding/negative margin so the box is the truth" — plan (targets test measures `getBoundingClientRect`).

## Required behaviour

1. `.divider` keeps its 11 px grid track but its box becomes 44 px wide: `width: 44px; margin-inline: -16.5px; position: relative; z-index: 2` (it overflows the track over both panes' edges, which have no controls there). The 1 px rule stays centred; a grip glyph (three 4 px dots in `--edge`, ≥ 3:1) is drawn at the vertical centre, 44 px tall.
2. Drag goes through `usePointerDrag`; `touch-action: none`.
3. Keyboard: ArrowLeft/ArrowRight ±0.02 (unchanged), Home → minimum, End → maximum, PageUp/PageDown ±0.1.
4. `aria-valuetext="{n}% Bible, {100-n}% notes"` beside the existing `aria-valuenow/min/max`.
5. Single-pointer alternative: two 44 px buttons in the divider's own box at its top (`data-testid="divider-narrower"`, `data-testid="divider-wider"`, `aria-label="Give the notes more room"` / `"Give the Bible more room"`), each nudging 0.1; hidden in narrow mode with the divider.

## Files you may touch

- `apps/reader/src/components/Layout.tsx`, `apps/reader/src/styles.css`.
- `tests/reader/reading.spec.ts` (additions), `tests/reader/targets.spec.ts` (the divider's box is measured like any control).

## Tests to add or change

- `tests/reader/reading.spec.ts` — existing ArrowLeft test green; add Home → `aria-valuenow` equals `aria-valuemin`; End → equals max; `aria-valuetext` matches `/\d+% Bible, \d+% notes/`; clicking `divider-wider` increases the Bible pane width.
- `tests/reader/chrome.spec.ts` — unchanged and green.

## Acceptance commands

```bash
mise exec node@24 -- npm run lint
mise exec node@24 -- npx playwright test --project=reader tests/reader/reading.spec.ts tests/reader/chrome.spec.ts
```

## Reviewer checklist

- [ ] `divider` bounding box width ≥ 44 at 1280 px.
- [ ] The 40-press ArrowLeft test still lands on the 320 px floor.
