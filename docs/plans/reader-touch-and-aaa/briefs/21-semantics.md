# Brief 21 — Landmarks, headings, names, language and the page title

| | |
|---|---|
| **ID** | `21-semantics` |
| **Size** | L (mechanical once the heading policy is understood; a good delegate brief in two halves: structure, then names) |
| **Depends on** | `03-focus` (panels already own Escape/return), `05-announcer` |
| **Status** | done (a50eb26) |
| **Criteria** | 1.3.1, 2.4.1 Bypass Blocks, 2.4.2 Page Titled, 2.4.4/2.4.9 Link Purpose, 2.4.6, 2.4.8 Location, 2.4.10 Section Headings, 3.1.2 Language of Parts, 3.1.4 Abbreviations, 3.2.4, 4.1.2, 1.3.6 |

## Outcome

A screen-reader user can skip to the scripture or the notes, always finds exactly one level-1 heading that says where they are, hears Spanish, French and Japanese scripture in the right voice, hears what every control does (not what glyph it shows), and reads a page title that names the passage and translation. Lists are lists, option groups are groups, disclosures say whether they are open.

## Read first

- `apps/reader/src/components/BiblePane.tsx` lines 101–180 (bar, chips, the `<h1>` and the `hidden` article) and 225 (verse text — no `lang`).
- `apps/reader/src/components/Layout.tsx` lines 100–184 — landmarks (`<main>`, unnamed `<aside>`, narrow `<section aria-label="Notes">`).
- `apps/reader/src/components/MarkdownPreview.tsx` lines 76–81 (raw heading levels) and 131–142 (wikilink named by raw target); `apps/reader/src/App.tsx` lines 686–704 (`describeLink`, the human-readable form that already exists).
- `apps/reader/src/components/MarksPanel.tsx` lines 75–147; `LibraryPanel.tsx` lines 75–103 and 130–137; `SettingsPanel.tsx` lines 43–58; `SearchResults.tsx` lines 71–108; `ComparePane.tsx` lines 36–100; `CanvasView.tsx` lines 219–310 and 448–508; `DurabilityBanner.tsx` lines 42–74.
- `tests/reader/reading.spec.ts` lines 16–19 and 56–63; `tests/reader/chrome.spec.ts` line 145; `tests/reader/editor.spec.ts` line 84 — heading assertions that constrain the policy.

## Rules that bite here

> "`reading.spec.ts:17,58,62`, `chrome.spec.ts:145`: `getByRole('heading', { level: 1 })` is the chapter title while reading" — plan. The chapter title stays `h1` in the reading state.

> "`editor.spec.ts:84` asserts `preview.locator('h1')` for `# Opening` → becomes `h3` under the +2 offset; update it in the same commit." — plan

> "`title` does not override name-from-content" — audit. Glyph buttons need `aria-label` or visually-hidden text.

> "2.5.3 Label in Name: the accessible name must contain the visible text" — matrix. The translation chip shows "KJV"; its name must start with "KJV".

## Current behaviour

See the audit in `README.md` → "WCAG, worst first", items 3, 5 and 10.

## Required behaviour

**Structure**
1. Skip links, first in the DOM inside `#root`: `<a className="skip" href="#scripture">Skip to scripture</a>` and `<a className="skip" href="#notes">Skip to notes</a>`, visually hidden until focused (then a 44 px pill at the top-left). `<main>` gets `id="scripture"`; the notes `<aside>`/sheet gets `id="notes"`.
2. Heading policy — exactly one `h1` per view state: the chapter title while reading (unchanged); when an overlay panel replaces the chapter, that panel's title is the `h1` (`MarksPanel`, `LibraryPanel`, `SettingsPanel`, `SearchResults`, and the help panel from brief 27 render `<h1>`; their `h3` groups become `h2`: `LibraryPanel.tsx:103`, `SettingsPanel.tsx:58,83`); the canvas view renders `<main><h1 className="visually-hidden">Board: {name}</h1>` (brief 14 may land this first). The notes pane gets `<h2 className="visually-hidden">Notes</h2>`; each Marks colour group gets `<h2 className="visually-hidden">{colorLabel}</h2>` next to its editable label.
3. `MarkdownPreview` offsets note heading levels by +2 (`#` → `h3`, capped at `h6`) and sets `data-level={original}` so `styles.css` can keep the visual sizes (`.preview__heading[data-level="1"]` etc. replace `h1.preview__heading …`). Update `tests/reader/editor.spec.ts:84` to `h3`.
4. `<nav aria-label="Passage">` wraps the book and chapter selects; `<aside aria-label="Notes">` in the split layout; every `<ul>` with `list-style: none` gets `role="list"` (`.search__results`, `.marks__list`, `.proposal__list`, `.results__list`, `.library__list`, `.settings__tools ul`); the two option-checkbox pairs (`SearchBar`, `SearchResults`) are wrapped in `<fieldset><legend className="visually-hidden">Matching</legend>`.
5. The three bar chips (translation, Marks, Settings) and the help chip become disclosures: `aria-expanded={open}` and `aria-controls={panelId}` replace `aria-pressed`; the CSS `[aria-pressed='true']` styling for `.reader__chip` moves to `[aria-expanded='true']`.

**Names**
6. Translation chip: `aria-label={`${meta.id.toUpperCase()} — ${meta.name}. Choose or add a translation`}` (visible "KJV" comes first). `<abbr>` is not needed on the chip because the name expands it; in the library list the ID stays beside the full name.
7. Attribution links: text `{meta.name} source` (visually the word "source" may stay with the name in visually-hidden text).
8. Preview wikilinks: `aria-label={describeLink(target) ?? target}` — pass `describeLink` down from `App` through `NotesPane` to `MarkdownPreview`.
9. Glyph buttons get `aria-label`: canvas ⇢ "Connect this card", ↗ "Open this passage", ✕ "Remove this card", zoom-reset "Reset zoom to 100 %" (value stays visible), `DurabilityBanner` × "Dismiss this notice". All close buttons are `✕` with `aria-label="Close {panel}"` (rename the canvas "Back to reading" text button to keep its text — text is fine; consistency is about identification, and a text button named "Back to reading" is consistent with itself).
10. `LibraryPanel` progressbar: `aria-label={`Downloading ${t.name}`}`, `aria-valuetext={`${n}%`}` (brief 05 may land this).
11. `ComparePane` absent cell: `<span className="compare__absent">Not in {ID}</span>` visible text (short) instead of an em-dash with a `title`.

**Language and title**
12. `lang={bible.meta.language}` on: `.chapter__text` (BiblePane), each `<td>`/`<dd>` per column in `ComparePane` (that column's language), `.marks__ref-text`, `.search__result-text`, `.results__ref-text`, `.proposal__verse`, `.card__body` for verse cards. English translations also get `lang="en"` for symmetry (the attribute is cheap and a future UI language switch would need it).
13. `document.title`: `{book.name} {chapter} · {ID} · Scriptura` while reading; `{Panel} · Scriptura` when a panel is open; `{board name} · Boards · Scriptura` in canvas view. One `useEffect` in `App`.

## Files you may touch

- Every component under `apps/reader/src/components/`, `apps/reader/src/App.tsx`, `apps/reader/src/styles.css`.
- `tests/reader/a11y.spec.ts` (add states), `tests/reader/editor.spec.ts:84`, `tests/reader/library.spec.ts` (add the `lang` assertion), `tests/reader/reading.spec.ts` (add the title assertion), `tests/helpers/axe.ts` (empty `RULES_PENDING_SEMANTICS`).

## Tests to add or change

- `tests/reader/a11y.spec.ts` — states: reading; marks open; library open; settings open; results open; each asserts zero violations from `axeFor(page)` and prints `describeViolations` on failure; light and dark (`emulateMedia`).
- `tests/reader/library.spec.ts` — after reading rv1909, `.chapter__text` has `lang="es"`; after comparing, the rv1909 column's cells have `lang="es"` and the bsb column `lang="en"`.
- `tests/reader/reading.spec.ts` — `await expect(page).toHaveTitle(/Genesis 3 · BSB · Scriptura/)` after navigating; skip link: Tab once from load → focus on "Skip to scripture", Enter → focus/scroll lands in `main`.
- `tests/reader/keyboard.spec.ts` — `getByRole('heading', { level: 1 })` has count 1 in every state (reading, marks, library, settings, results, canvas).

## Acceptance commands

```bash
mise exec node@24 -- npm run lint
mise exec node@24 -- npx playwright test --project=reader tests/reader/a11y.spec.ts tests/reader/reading.spec.ts tests/reader/library.spec.ts tests/reader/editor.spec.ts tests/reader/keyboard.spec.ts tests/reader/chrome.spec.ts
```

## Reviewer checklist

- [ ] Exactly one `h1` in each state; `heading-order` passes.
- [ ] No `aria-pressed` left on a disclosure; no `aria-expanded` on an `<input>`.
- [ ] `RULES_PENDING_SEMANTICS` is empty after this brief.
