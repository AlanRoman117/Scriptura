# Brief 05 — Live-region announcer

| | |
|---|---|
| **ID** | `05-announcer` |
| **Size** | S |
| **Depends on** | none |
| **Status** | done (a0dde32) |
| **Criteria** | 4.1.3 Status Messages (AA), 3.3.1 Error Identification, 2.2.4 Interruptions (AAA) |

## Outcome

Everything that changes without moving focus is announced once, politely, to a screen reader: how many matches a search found, that a download is a quarter, half, three-quarters done or has failed, that a panel opened or closed, that the translation changed, that a board could not be saved, that an undo is available. Errors are assertive; everything else is polite; nothing is announced twice in a row.

## Read first

- `apps/reader/src/components/NotesPane.tsx` lines 264–274 — the one live region that exists; it stays.
- `apps/reader/src/App.tsx` lines 216–230 (search effect), 457–460 (board save), 575–594 (translation switch), 596–629 (download progress and errors), 741–755 (early returns — why the announcer cannot live inside App's render).
- `apps/reader/src/components/LibraryPanel.tsx` lines 124–143 — the unnamed progressbar and the silent error.
- `apps/reader/src/main.tsx`.

## Rules that bite here

> "`writeSafely` reports a failure once per store: a quota error repeats on every keystroke, and a toast per keystroke trains people to dismiss the one message that matters." — CLAUDE.md → Apps. Same rule for announcements: de-duplicate, throttle progress.

> "`runQuery` returns every match: the caller slices for display but must report the true count." — CLAUDE.md → Apps. Announce the true total.

## Required behaviour

1. `apps/reader/src/lib/announce.ts` exports `announce(text: string, options?: { assertive?: boolean })` and an `<Announcer/>` component rendering two visually-hidden regions: `<div role="status" aria-live="polite" aria-atomic="true" data-testid="announcer">` and `<div role="alert" aria-live="assertive" aria-atomic="true" data-testid="announcer-alert">`. Consecutive identical messages are suppressed; a repeated message is re-announced by clearing then setting the text on the next frame.
2. `<Announcer/>` is mounted in `main.tsx` beside `<App/>`, so it exists during boot.
3. Wired: search total (debounced 400 ms after `hitsQuery` changes: "17 matches for 'Tito'" / "No matches"); download progress at 25 %, 50 %, 75 % and completion ("KJV downloaded"); download error (assertive, the row's message); panel open/close ("Marks opened", "Settings closed"); translation switch ("Reading Reina Valera 1909"); board save failure (assertive); undo availability (from brief 28).
4. `LibraryPanel`'s progressbar gets `aria-label="Downloading {name}"` and `aria-valuetext="{n}%"`; its error span gets `role="alert"`.

## Files you may touch

- `apps/reader/src/lib/announce.ts` (new), `apps/reader/src/main.tsx`, `apps/reader/src/App.tsx`, `apps/reader/src/components/LibraryPanel.tsx`, `apps/reader/src/styles.css` (only if `.visually-hidden` needs reuse).
- `tests/reader/a11y.spec.ts`.

## Tests to add or change

- `tests/reader/a11y.spec.ts` — after `searchFor('living water')`, `announcer` text matches `/\d+ match/` within 1 s; after opening Marks, it contains "Marks opened"; the library offline test asserts `library-error-kjv` has `role="alert"`.

## Acceptance commands

```bash
mise exec node@24 -- npm run lint
mise exec node@24 -- npx playwright test --project=reader tests/reader/a11y.spec.ts tests/reader/library.spec.ts tests/reader/results.spec.ts
```

## Reviewer checklist

- [ ] Typing a query letter by letter produces one announcement, not one per keystroke.
- [ ] The note-save footer still announces "Saved" (unchanged).
