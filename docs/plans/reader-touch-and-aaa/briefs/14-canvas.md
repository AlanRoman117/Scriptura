# Brief 14 — Canvas: touch, pinch, keyboard, connections, undo

| | |
|---|---|
| **ID** | `14-canvas` |
| **Size** | L (split into four commits in the plan: capture and cancel; pinch; keyboard and single-pointer controls; edges, undo and heading) |
| **Depends on** | `04-viewport` (`usePointerDrag`), `03-focus`, `02-tokens`, `28-confirm-undo` (`ConfirmButton`), `01-prefs` (markers) |
| **Status** | open |
| **Criteria** | 2.1.1/2.1.3 Keyboard, 2.5.7 Dragging Movements, 2.5.5 Target Size, 1.1.1 (text alternative), 4.1.2, 2.4.10 (heading), 3.3.6 (undo), 1.4.1 |

## Outcome

A board works with a finger: one finger pans the background or moves a card, two fingers zoom about their midpoint, a browser-interrupted gesture never leaves the board stuck. It works from the keyboard: cards take focus, arrow keys move them, Alt+arrows resize them, the frame pans with arrows, a connection is removed from a list. It works with a single pointer and no drag: a Move/Size popover with arrow and ± buttons, pan buttons beside the zoom buttons. Every control is 44 px. The connections have a text alternative. Removing a card can be undone. The view has a heading and a `<main>`.

## Read first

- `apps/reader/src/components/CanvasView.tsx` (whole, 544 lines) — everything here changes; read the comments, they carry the reasons.
- `apps/reader/src/lib/canvas.ts` lines 79–114 (`CARD_W`, `CARD_H`, `freeSlot`) and 147–188 (`nodeLabel`, `boardToMarkdown` — the shape of the text alternative).
- `apps/reader/src/styles.css` lines 488–604 — `.canvas*`, `.card*`.
- `apps/reader/src/components/BoardThumbnail.tsx` lines 64–78 — it reads `CARD_W/CARD_H`, so a size change reaches it.
- `tests/reader/canvas.spec.ts` (whole) — every existing assertion stays byte-for-byte green: exact −200/−120 pan, wheel and ctrl-wheel, resize from `+4,+4`, `.canvas__edge-cut` click.

## Rules that bite here

> "`freeSlot` must test the card's own footprint…" — CLAUDE.md → Apps (canvas). Changing `CARD_W/H` changes the grid pitch; the footprint test still has to hold.

> "The wheel pans and ctrl/⌘-wheel zooms at the pointer, bound with `{ passive: false }` because React's `onWheel` is passive." — CLAUDE.md → Apps. Keep the native listener.

> "Edges are clipped to the card boundary, not drawn from centres." — CLAUDE.md → Apps. Keep `boundary()`.

> "There is deliberately no tool that deletes a note, removes a mark, or clears a board." — CLAUDE.md → Apps (WebMCP). Undo is UI, not a tool; do not add a tool.

## Current behaviour

Pan/drag/resize use `pointerdown` on elements plus `window` `pointermove`/`pointerup` (`CanvasView.tsx:111-155`); no capture, no cancel. Zoom is wheel-only (`:71-99`); the zoom buttons step ±0.2 with a floor of 0.4 while the wheel path floors at 0.3. The resize grip is 14 px and `aria-hidden` (`:511-521`). Colour dots are 9.6 px (`styles.css:598`). Edge removal is a transparent 18 px circle shown on hover (`:365-371`, `styles.css:531-532`) inside an `aria-hidden` SVG. Cards are not focusable; the connect target is a click on the `<article>` (`:387`). Removing a card or edge is unconfirmed and irreversible. No heading, no `<main>`.

## Required behaviour

**Commit A — capture and cancellation.**
1. Pan, card drag and resize use `usePointerDrag` (brief 04). `pointercancel` and `lostpointercapture` end the gesture exactly like `pointerup`. `.canvas__frame { touch-action: none }`.
2. `apps/reader/src/lib/geometry.ts` (new, no imports) exports `zoomAround(state: {zoom, pan}, factorOrNext, anchor) → {zoom, pan}` and `clampZoom(z)` (0.3–2). The wheel handler and the buttons both use it; the button floor becomes 0.3 to match.

**Commit B — pinch.**
3. A `pointers: Map<pointerId, {x, y}>` on the frame (React `onPointerDown/Move/Up/Cancel`). When a second pointer arrives, any drag/resize/pan in progress is cancelled and a pinch begins: `{dist0, mid0, zoom0, pan0}`. On move with two pointers: `zoom = clampZoom(zoom0 * dist/dist0)`, `pan` such that the board point under `mid0` stays under the current midpoint. When either pointer lifts, the pinch ends without resuming a pan. `tests/unit/geometry.test.ts` covers the maths.

**Commit C — keyboard and single-pointer controls.**
4. Each `.card` is focusable: `tabIndex={0}`, `role="group"`, `aria-label={nodeLabel(node)}`. Arrow keys move the focused card 10 px (Shift: 50 px); Alt+Arrow resizes by the same steps (floors 160 × 96 kept); Delete/Backspace removes it through `ConfirmButton` semantics (an "Are you sure?" state announced, Enter confirms, Escape cancels). Typing inside a card's inputs does not trigger these (check `e.target` is the card itself).
5. The frame is focusable (`tabIndex={0}`, `aria-label="Board canvas"`); with focus on it, arrows pan by 40 px.
6. Single-pointer alternatives (2.5.7): each card's footer gains a "Move/Size" button (`data-testid="card-adjust-{id}"`) opening a panel with four arrow buttons (move 20 px), Narrower/Wider/Shorter/Taller (± 20 px) and Done (`card-panel-close`), all 44 px, dismissed through the stack; a pan group beside the zoom gains four buttons (`data-testid="pan-left|right|up|down"`, 80 px each). *As built:* the panel sits at the bottom of the board rather than beside the card — a card has `overflow: hidden` and moves under pan and zoom, so a popover anchored to it would be clipped or carried off screen.
7. The five colour dots are replaced by one 44 px "Colour" button (`data-testid="card-colour-{id}"`, `aria-label="Colour: {label or none}"`) that opens the same bottom panel with the collection swatches (`card-swatch-{color}`, `card-swatch-none`), sharing the `.swatch`/`.swatch__disc` styling of brief 12; the card keeps `data-color` and gains a visually-hidden colour name in its title. `CARD_W = 280`, `CARD_H = 180` (five 44 px actions and the 44 px resize corner need 264 px), floors `CARD_MIN_W = 272`, `CARD_MIN_H = 136`; `.card__resize` is 24 px visible with a 44 px hit box; `.card__actions` buttons are ≥ 44 px (the footer becomes two rows on narrow cards).
8. `.card__body` and `.embed__scroll` get `tabIndex={0}` and an `aria-label` (axe `scrollable-region-focusable`).

**Commit D — edges, undo, heading.**
9. The edge midpoint control stays `<circle className="canvas__edge-cut">` for the pointer path (the existing test clicks it) but becomes always visible (fill `--paper-raised`, stroke `--edge`, r = 12, a 22 px "×" glyph drawn as `<text>`), and the SVG is no longer the only path: a "Connections" disclosure in the bar (`data-testid="board-connections"`) lists every edge as `{from} → {to}` with a 44 px Remove button (`data-testid="edge-remove-{id}"`) — this list is the diagram's text alternative and the keyboard path. The SVG stays `aria-hidden`.
10. Removing a card (any path) pushes `{nodes, edges}` onto a one-level undo held in `CanvasView` state; an "Undo remove" button (`data-testid="board-undo"`) appears in the bar until the next change to the board. It does not expire.
11. Canvas view renders `<main>` with `<h1 className="visually-hidden">Board: {name}</h1>`; the board `<select>` is `aria-labelledby` that heading. `document.title` becomes `{board name} · Boards · Scriptura`.

## Files you may touch

- `apps/reader/src/components/CanvasView.tsx`, `apps/reader/src/lib/canvas.ts` (constants only), `apps/reader/src/lib/geometry.ts` (new), `apps/reader/src/styles.css`, `apps/reader/src/App.tsx` (title only).
- `tests/unit/geometry.test.ts` (new), `tests/reader/canvas.spec.ts` (additions only), `tests/reader/keyboard.spec.ts`, `tests/reader-touch/canvas.spec.ts` (new).

## Tests to add or change

- `tests/unit/geometry.test.ts` — `zoomAround` keeps the anchor point fixed; `clampZoom` bounds; pinch: doubling the distance doubles zoom and keeps the midpoint fixed.
- `tests/reader/canvas.spec.ts` — every existing test unchanged and green; add: focus a card, ArrowRight ×3 moves it 30 px; Alt+ArrowRight widens it; Connections list shows one entry after connecting and `edge-remove-*` removes it; removing a card then `board-undo` restores it and its edges.
- `tests/reader-touch/canvas.spec.ts` — CDP touch drag on a card grip moves it; a two-finger CDP pinch (two touch points moving apart) changes the zoom label from 100 %; `pan-right` moves the board; every control in the bar and a card footer ≥ 44 × 44.

## Acceptance commands

```bash
mise exec node@24 -- npm run lint && mise exec node@24 -- npm test
mise exec node@24 -- npx playwright test --project=reader tests/reader/canvas.spec.ts tests/reader/editor.spec.ts tests/reader/keyboard.spec.ts
mise exec node@24 -- npx playwright test --project=reader-touch tests/reader-touch/canvas.spec.ts
```

## Reviewer checklist

- [ ] `canvas.spec.ts` lines 158–176 still measure exactly −200 / −120.
- [ ] A `pointercancel` mid-drag leaves no `body.dragging` and no stuck card.
- [ ] Keyboard handlers ignore keys typed inside card inputs and textareas.
- [ ] `boardToMarkdown` output unchanged (export parity).
