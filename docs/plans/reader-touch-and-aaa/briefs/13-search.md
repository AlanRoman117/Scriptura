# Brief 13 — Search as a form; results reachable under a keyboard

| | |
|---|---|
| **ID** | `13-search` |
| **Size** | M |
| **Depends on** | `03-focus` (dismiss stack), `04-viewport` (`--vvh`), `02-tokens` |
| **Status** | open |
| **Criteria** | 2.1.1 Keyboard, 2.4.3 Focus Order, 4.1.2 (valid ARIA), 2.5.5; touch usability |

## Outcome

The search box is a search form. Enter jumps when the text is a reference and opens the full results view when it is a query — which is also how a phone user gets the results out from under the keyboard. The suggestions panel stays open while the query is non-empty, until the reader dismisses it (Escape, a tap outside, choosing a result, the Close button) — never because focus moved. Tab reaches the panel; ArrowDown from the input jumps into it; Escape inside it returns to the input. Every row is at least 44 px tall. The input carries no ARIA it is not allowed to carry.

## Read first

- `apps/reader/src/components/SearchBar.tsx` (whole, 189 lines) — `open = focused && query`, the 150 ms blur timer, the `onMouseDown` guards.
- `apps/reader/src/App.tsx` lines 216–230 and 917–936 — the search effect and how `SearchBar` is wired (`onSeeAll`).
- `apps/reader/src/styles.css` lines 212–265 — `.search*`.
- `tests/reader/study.spec.ts` lines 40–142 and `tests/reader/results.spec.ts` lines 16–21 — `jumpTo`, `searchFor`, and the "panel comes back when a second reference is typed" contract.

## Rules that bite here

> "The panel reopens on typing, not only on focus. Enter closes it to clear the way for the passage it jumped to, but the input keeps DOM focus…" — CLAUDE.md → Apps. Preserve: Enter dismisses; typing reopens.

> "`search-count` carries `data-query`, the query its total actually answers… Tests wait for that attribute rather than for visibility." — CLAUDE.md → Apps. Keep `data-query`, `search-panel`, `search-jump`, `search-count`, `search-see-all`, `search-result-*`, `search-insert-*`.

> "`aria-expanded` is not permitted on `searchbox`; axe `aria-allowed-attr` fails." — plan review. No popup ARIA on the `<input>`.

## Current behaviour

`open` is derived from focus (`SearchBar.tsx:44`); a 150 ms blur timer closes the panel (`:65`); five controls call `preventDefault` on `mousedown` to keep focus in the input (`:85,99,135,162,177`); Enter does nothing unless a reference resolved (`:71-74`); the panel is `max-height: 60vh` of the large viewport (`styles.css:222`); result rows are ~40 px.

## Required behaviour

1. `SearchBar` renders `<form role="search" className="search" onSubmit>`. Submit (Enter) with a resolved `reference` calls `onGo` and sets `dismissed`; submit with a non-empty text query calls `onSeeAll` (the full results view) and sets `dismissed`; empty submit does nothing.
2. `open = query.trim().length > 0 && !dismissed`. `dismissed` becomes false on every `onChange`. It becomes true on submit, on Escape (via `useDismissable`, with the form as `ref`), on a pointerdown outside the form, on choosing a result or "See all", and on the new Close button (`data-testid="search-close"`, `aria-label="Close suggestions"`, ≥ 44 px).
3. The blur timer and every `onMouseDown={preventDefault}` are removed. The panel is `<section className="search__panel" aria-label="Suggestions" data-testid="search-panel">`, in flow after the input in the DOM so Tab reaches it.
4. On the input, ArrowDown moves focus to the first control in the panel (the jump button when present, else the first result). Inside the panel, Escape returns focus to the input and dismisses; the input has `aria-describedby` pointing at a visually-hidden hint: "Enter opens the passage or all results. Arrow down for suggestions."
5. `.search__panel { max-height: min(60vh, calc(var(--vvh, 100vh) - var(--bar-h) - var(--search-h, 3rem) - 1rem)) }`; `.search__ref`, `.search__insert`, `.search__jump`, `.search__see-all` are ≥ 44 px tall (`min-height: var(--control-h)`); `.search__insert` is ≥ 44 px wide.
6. The count line keeps `data-testid="search-count"` and `data-query`; the announcer (brief 05) speaks the total.

## Files you may touch

- `apps/reader/src/components/SearchBar.tsx`, `apps/reader/src/App.tsx` (wiring only), `apps/reader/src/styles.css`.
- `tests/reader/study.spec.ts` (additions only), `tests/reader-touch/search.spec.ts` (new).

## Tests to add or change

- `tests/reader/study.spec.ts` — all existing tests green; add: typing `living water` then Enter opens `search-results` with `results-total` > 0; ArrowDown from the input moves focus into `search-panel`; Tab from the input reaches `search-jump` without the panel closing; clicking `search-close` hides the panel and typing reopens it.
- `tests/reader-touch/search.spec.ts` — with `--vvh: 420px` injected, the panel's bounding box bottom ≤ 420; tapping a result row (≥ 44 px tall) navigates; Enter on a text query opens the results view.

## Acceptance commands

```bash
mise exec node@24 -- npm run lint
mise exec node@24 -- npx playwright test --project=reader tests/reader/study.spec.ts tests/reader/results.spec.ts tests/reader/a11y.spec.ts
mise exec node@24 -- npx playwright test --project=reader-touch tests/reader-touch/search.spec.ts
```

## Reviewer checklist

- [ ] `grep -n "setTimeout" apps/reader/src/components/SearchBar.tsx` returns nothing.
- [ ] `grep -n "aria-expanded\|aria-haspopup\|aria-controls" apps/reader/src/components/SearchBar.tsx` returns nothing (none are valid on the input).
- [ ] `jumpTo` and `searchFor` in the existing specs are untouched.
