# Brief 28 — Confirm and undo for everything destructive

| | |
|---|---|
| **ID** | `28-confirm-undo` |
| **Size** | M |
| **Depends on** | `05-announcer`, `03-focus` |
| **Status** | open |
| **Criteria** | 3.3.4 Error Prevention (Legal, Financial, Data), 3.3.6 Error Prevention (All), 2.2.3 No Timing, 4.1.2 |

## Outcome

Nothing the reader made can be destroyed by one press. Deleting a note or board, removing a card, cutting a connection, removing a mark, removing a downloaded translation, and discarding an assistant's proposal all use one component: the first press arms it (the button reads "Sure?", the change is announced, Escape or a Cancel button disarms it), the second press acts. Removing a highlight or a card can also be undone afterwards, for as long as the reader likes.

## Read first

- `apps/reader/src/components/NotesPane.tsx` lines 67, 75, 168–177 — the existing two-step pattern.
- `apps/reader/src/components/CanvasView.tsx` lines 50, 56, 270–277 (board delete, same pattern), 165–172 and 497–508 (card removal, unconfirmed), 365–371 (edge removal).
- `apps/reader/src/components/MarksPanel.tsx` lines 130–139; `LibraryPanel.tsx` lines 172–183; `ProposalPreview.tsx` lines 124–132.
- `tests/reader/notes.spec.ts` lines 73–77 and `tests/reader/chrome.spec.ts` lines 176–177 — the `Sure?` assertions that must keep passing.

## Rules that bite here

> "`chrome.spec.ts:176-177`, `notes.spec.ts:74-76` expect `Sure?` → `ConfirmButton` keeps that visible label." — plan

> "Undo never expires — it persists until the next change." — matrix 2.2.3. No timed toasts.

> "There is deliberately no tool that deletes…" — CLAUDE.md → Apps (WebMCP). Nothing here is exposed to the assistant.

## Required behaviour

1. `apps/reader/src/components/ConfirmButton.tsx`: props `label` (idle text), `confirmLabel = 'Sure?'`, `onConfirm`, `announce` (what to say when armed, default "Press again to confirm, or Escape to cancel"), `className`, `data-testid`, `disabled`. First activation arms: text becomes `confirmLabel`, `aria-describedby` points at a visually-hidden "Press again to confirm, Escape cancels", the announcer speaks it, a sibling Cancel button (`{testid}-cancel`, 44 px) appears; Escape (via `useDismissable`) or Cancel disarms; second activation calls `onConfirm` and disarms. Arming resets when the component's `resetKey` prop changes (the note/board id, as today).
2. Adopt it for: note delete (`note-delete`), board delete (`board-delete`), card remove (`card-remove-{id}`), edge remove (the Connections list from brief 14; the SVG `×` also arms — it is the same component rendered in SVG `<foreignObject>` or the click arms a bar-level confirm), mark remove (`marks-remove-*`), translation remove (`library-remove-*`), proposal Discard (`proposal-discard`).
3. Undo: `MarksPanel` removal pushes the removed highlight to an `undo` state in `App`; an "Undo remove" button (`marks-undo`) appears in the Marks bar until the next highlight change. Card removal undo is specified in brief 14. Both are announced ("Mark removed. Undo is available.").
4. `tests/reader/notes.spec.ts:74-76` and `chrome.spec.ts:176-177` keep passing unchanged: the armed label is still "Sure?" and a second click still deletes.

## Files you may touch

- `apps/reader/src/components/ConfirmButton.tsx` (new), `NotesPane.tsx`, `CanvasView.tsx`, `MarksPanel.tsx`, `LibraryPanel.tsx`, `ProposalPreview.tsx`, `App.tsx`, `styles.css`.
- `tests/reader/notes.spec.ts`, `tests/reader/library.spec.ts`, `tests/reader/canvas.spec.ts`, `tests/reader/webmcp.spec.ts` (Discard becomes two presses: update `:210-217`).

## Tests to add or change

- `tests/reader/notes.spec.ts` — remove a mark from the Marks panel → `marks-undo` appears → click → the mark is back; arming delete then Escape leaves the note in place and the button reads "Delete".
- `tests/reader/library.spec.ts:80-90` — remove now takes two presses.
- `tests/reader/webmcp.spec.ts:210-217` — Discard takes two presses; nothing is written either way.

## Acceptance commands

```bash
mise exec node@24 -- npm run lint
mise exec node@24 -- npx playwright test --project=reader tests/reader/notes.spec.ts tests/reader/library.spec.ts tests/reader/canvas.spec.ts tests/reader/webmcp.spec.ts tests/reader/chrome.spec.ts
```
