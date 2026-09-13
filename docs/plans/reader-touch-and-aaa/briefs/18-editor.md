# Brief 18 — The editor toolbar, reachable by keyboard and touch

| | |
|---|---|
| **ID** | `18-editor` |
| **Size** | S |
| **Depends on** | `03-focus` (roving), `02-tokens` |
| **Status** | open |
| **Criteria** | 2.1.1 Keyboard, 4.1.2 (`role=toolbar` behaves like one), 2.5.5, 2.4.7 (visible focus on the writing surface) |

## Outcome

The formatting toolbar appears when the note body takes focus and stays while focus is anywhere in the editing group (toolbar or textarea), so Shift+Tab from the textarea reaches it and a tap on a tool does not make it vanish first. It is one tab stop with arrow keys, as `role="toolbar"` promises. Its buttons are 44 px and wrap onto a second reserved row on a narrow pane. The title and the writing surface show a focus ring. It still withdraws when the title, or anything outside the group, takes focus.

## Read first

- `apps/reader/src/components/NotesPane.tsx` lines 64–116 and 180–253 — `focused`, the 150 ms blur timer, the tools slot, the textarea handlers.
- `apps/reader/src/components/EditorToolbar.tsx` (whole, 67 lines) — the `onMouseDown` hold and the eleven tab stops.
- `apps/reader/src/styles.css` lines 606–628 (`.tools*`), 889–901 (`.notes__title`, `.notes__surface` with `outline: none`).
- `tests/reader/editor.spec.ts` lines 20–73 — "appear with focus and withdraw when it leaves" (clicking the title must hide the tools) and the formatting tests.

## Rules that bite here

> "`EditorToolbar` rides in with focus and leaves with it, above the writing… Every control `preventDefault`s `mousedown` — a button that takes focus collapses the selection it was about to format." — CLAUDE.md → Apps. Keep the selection intact: with roving focus the tool *does* take focus now, so the selection must be re-applied from the saved `selectionStart/End` before the edit (the `apply()` helper already reads them — read them on `pointerdown`/`focus` of the toolbar instead of at click time).

> "`editor.spec.ts:21-31`: toolbar absent before focus and withdraws when the note title takes focus" — plan. Scope the group to toolbar + textarea only.

## Required behaviour

1. `NotesPane` wraps the tools slot and the textarea in `<div className="notes__editor" onFocus onBlur>`; `focused` is true while `document.activeElement` is inside that wrapper (`onBlur` checks `e.relatedTarget` against `e.currentTarget.contains`). The `setTimeout` goes.
2. `EditorToolbar` uses `useRovingTabIndex` (horizontal): one tab stop, arrows move between tools, Home/End. Shift+Tab from the textarea lands on the toolbar's current tool; Tab from the toolbar goes to the textarea.
3. ~~Tools remember the textarea selection… `onMouseDown={hold}` is removed.~~ **Superseded in implementation (lead's decision, with evidence):** a textarea keeps `selectionStart/End` while blurred, so `apply()` needs no stored range for the keyboard path. One `mousedown` guard stays, on the toolbar element rather than on each button: Safari does not focus a button on click, so without it a pointer press blurs the note and withdraws the tools before the click lands. The guard has no effect on keyboard use.
4. `.tools__button { min-height: var(--control-h); min-width: var(--control-h) }`; `.tools__slot { min-height: calc(var(--control-h) + .35rem) }`, and under `@container (max-width: 34rem)` `min-height: calc(2 * var(--control-h) + .55rem)` so wrapping onto two rows does not shove the text.
5. `.notes__title:focus-visible` and `.notes__surface:focus-visible` show the ring with `outline-offset: -2px`; the `outline: none` declarations are gone (brief 02 may already have removed them).
6. The "Go to link" button (`notes-follow-link`) is ≥ 44 px tall.

## Files you may touch

- `apps/reader/src/components/NotesPane.tsx`, `apps/reader/src/components/EditorToolbar.tsx`, `apps/reader/src/styles.css`.
- `tests/reader/editor.spec.ts` (additions).

## Tests to add or change

- `tests/reader/editor.spec.ts` — existing tests green (including "withdraw when it leaves"); add: focus the textarea, Shift+Tab → focus is inside `editor-tools`; ArrowRight moves to the next tool; Enter on `tool-bold` with "Word" selected wraps it and returns focus to the textarea with "Word" still selected; tapping (on the touch project, in `tests/reader-touch/editor.spec.ts`) `tool-h2` after selecting text applies the heading.

## Acceptance commands

```bash
mise exec node@24 -- npm run lint
mise exec node@24 -- npx playwright test --project=reader tests/reader/editor.spec.ts tests/reader/study.spec.ts tests/reader/notes.spec.ts
mise exec node@24 -- npx playwright test --project=reader-touch tests/reader-touch/editor.spec.ts
```

## Reviewer checklist

- [ ] `grep -n "setTimeout" apps/reader/src/components/NotesPane.tsx` returns nothing.
- [ ] Clicking the note title still hides the tools.
- [ ] Bold with a selection still leaves the word (not its markers) selected.
