# Brief 03 — Focus utilities and the native dialog

| | |
|---|---|
| **ID** | `03-focus` |
| **Size** | M |
| **Depends on** | none |
| **Status** | done (f6e5afb) |
| **Criteria** | 2.4.3 Focus Order, 2.1.2 No Keyboard Trap, 4.1.2, 2.4.11/2.4.12 (with `inert`) |

## Outcome

Focus never falls to `<body>`. Closing a panel, the verse actions, the search suggestions or the assistant's proposal returns focus to the control that opened it. Escape closes only the topmost open surface; a click outside a surface closes it. The proposal preview is a real modal: focus is contained, the page behind it is inert, Escape discards. All of this is one small module every component uses, so a future surface cannot get it wrong by forgetting.

## Read first

- `apps/reader/src/components/ProposalPreview.tsx` lines 37–41 and 50 — the `window` keydown and the `role=dialog` that has no containment.
- `apps/reader/src/components/BiblePane.tsx` lines 61–65; `apps/reader/src/components/CanvasView.tsx` lines 57–61; `apps/reader/src/components/SearchBar.tsx` lines 43–76 — the other three global listeners and the blur timer.
- `apps/reader/src/App.tsx` lines 809–905 — the four panel toggles and how `onClose` is wired.
- `tests/reader/webmcp.spec.ts` lines 195–257 — the proposal tests that must stay green.

## Rules that bite here

> "The one-proposal-at-a-time guard is a ref, not state. React state is only current after a render…" — CLAUDE.md → Apps (WebMCP). The dismiss stack is likewise module state, not React state.

> "Escape and outside-click go through the dismiss stack in `apps/reader/src/lib/focus.ts`, never a new `window.addEventListener('keydown')`." — AGENTS.md rule 9

> "Never remove or rename an existing `data-testid`." — AGENTS.md rule 7 (`proposal`, `proposal-*`, `marks-close`, `library-close`, `settings-close`, `results-close`).

## Current behaviour

Four components each add their own `window` keydown listener; one Escape closes all of them at once. No panel handles Escape. No component records where focus was before it opened, so closing sends focus to `<body>`. `ProposalPreview` is a `<div role="dialog" aria-modal="true">` — assistive technology hides the page behind it while Tab still reaches it.

## Required behaviour

1. `apps/reader/src/lib/focus.ts` exports:
   - `useReturnFocus(open: boolean, fallback?: RefObject<HTMLElement>)` — records `document.activeElement` when `open` turns true, restores it (or the fallback) when it turns false, if the recorded element is still in the document.
   - `useDismissable(open: boolean, close: () => void, ref: RefObject<HTMLElement>)` — pushes an entry onto a module-level stack while open; a single `document` `keydown` listener closes only the top entry on Escape; a single `document` `pointerdown` listener closes the top entry when the event target is outside its `ref`. Entries are popped on unmount.
   - `useRovingTabIndex(ref: RefObject<HTMLElement>, options?: { orientation?: 'horizontal' | 'vertical' | 'both' })` — one tab stop: exactly one child control has `tabIndex=0`, the rest `-1`; Arrow keys move focus; Home/End jump.
2. `ProposalPreview` renders `<dialog>` with `showModal()` in an effect guarded by `if (!el.open)`, `onClose={onDiscard}` as the single close path, `onCancel` allowed to proceed, `aria-labelledby="proposal-title"` kept, `tabIndex={-1}` and initial focus on the dialog element so the title and lede are read first, `useReturnFocus`. The `data-testid="proposal"` stays on the dialog.
3. `BiblePane` (verse actions), `CanvasView` (connecting mode), `SearchBar` (suggestions) replace their `window` listeners with `useDismissable`.
4. `MarksPanel`, `LibraryPanel`, `SettingsPanel`, `SearchResults` accept a `returnTo` ref (the chip that opened them) or `App` calls `useReturnFocus` around each `open` flag; Escape closes them via `useDismissable` with the panel's root as `ref`.
5. No `setTimeout` decides whether a surface stays open.

## Files you may touch

- `apps/reader/src/lib/focus.ts` (new); `ProposalPreview.tsx`, `BiblePane.tsx`, `CanvasView.tsx`, `SearchBar.tsx`, `MarksPanel.tsx`, `LibraryPanel.tsx`, `SettingsPanel.tsx`, `SearchResults.tsx`, `App.tsx` (wiring); `styles.css` (`dialog::backdrop`, `.proposal` no longer `position: fixed`).
- `tests/reader/keyboard.spec.ts` (new or extend).

## Files you must not touch

`apps/reader/src/lib/webmcp.ts`.

## Tests to add or change

- `tests/reader/keyboard.spec.ts` — open Marks with the keyboard, press Escape, expect focus on `marks-open`; same for library, settings, results; open the proposal via the mocked tool (reuse `installMockContext` from `webmcp.spec.ts`), Tab ten times, expect focus still inside `[data-testid=proposal]`; Escape → focus returns to what had it; verse number Enter → Escape → focus back on the number.

## Acceptance commands

```bash
mise exec node@24 -- npm run lint
mise exec node@24 -- npx playwright test --project=reader tests/reader/keyboard.spec.ts tests/reader/webmcp.spec.ts tests/reader/notes.spec.ts tests/reader/study.spec.ts
```

## Reviewer checklist

- [ ] `grep -rn "window.addEventListener('keydown'" apps/reader/src` returns nothing.
- [ ] Two surfaces open at once (verse actions + search suggestions): one Escape closes only the newest.
- [ ] StrictMode double-invocation does not throw from `showModal()`.
