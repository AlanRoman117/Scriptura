# Brief 27 — Help: grammar, glossary, abbreviations, accessibility statement

| | |
|---|---|
| **ID** | `27-help` |
| **Size** | M (content-heavy; a good delegate brief once the panel shell exists) |
| **Depends on** | `03-focus`, `21-semantics` (heading policy, disclosure chips) |
| **Status** | open |
| **Criteria** | 3.3.5 Help (AAA), 3.2.6 Consistent Help, 3.1.3 Unusual Words, 3.1.4 Abbreviations, 3.1.5 Reading Level (UI text), 2.4.10 |

## Outcome

A "?" chip in the reading bar — the same position in every state — opens a Help panel that explains, in plain language, how to search and jump to a reference, how notes and links work, what the colours and boards are, what every abbreviation means, what the keyboard does, and what the app can and cannot promise about accessibility. Settings links to it too. Help text is written at a lower-secondary reading level; the reader's own words and the scripture are not.

## Read first

- `apps/reader/src/components/SettingsPanel.tsx` — the panel shape to copy (section, `h1`/`h2` after brief 21, close button).
- `apps/reader/src/lib/search.ts` — the query grammar (`"phrases"`, `-exclusions`) and `resolveReference` inputs; `apps/reader/src/lib/references.ts` — `[[book c:v@id]]`.
- `apps/reader/src/components/BiblePane.tsx` lines 130–168 — where the chip goes and how the other panels toggle.
- `docs/plans/reader-touch-and-aaa/README.md` → "Known limitations to state in the accessibility statement".
- `apps/reader/src/lib/library.ts` `CatalogEntry` — names and IDs for the abbreviations table.

## Rules that bite here

> "Kept out of the grammar on purpose: `-word` and `"phrase"` are things you type, but a reader who does not know what 'whole word' means will never discover a syntax for it." — `SearchBar.tsx` comment. Help is where that reader learns it.

> "Scripture and user-written notes are content: 3.1.5 and 3.1.6 are exempt for them, and nothing else is." — README. Say so in the statement, plainly.

## Required behaviour

1. `apps/reader/src/components/HelpPanel.tsx`: `<section className="help" data-testid="help-panel" aria-label="Help">` with `<h1>Help</h1>`, a close button (`help-close`), and these `h2` sections: **Finding a passage** (reference forms with examples: `John 3:16`, `Juan 3:16`, `jn 3`, `43 3:16`, ranges; what Enter does), **Searching** (substring by default and why; `"exact phrase"`; `-word` to leave out; Whole words only; Match case), **Notes** (Markdown basics with the toolbar names; `[[john 3:16@kjv]]` links and what the `@kjv` means; Quote and Link), **Marks** (a colour is a collection; naming one; markers setting), **Boards** (cards hold the passage, not a copy; connections; how to move a card without dragging), **Translations** (download, read, compare, remove; the bundled one cannot be removed), **Keyboard** (Tab/Shift+Tab, Escape closes the topmost thing, arrows in toolbars and swatch rows, the divider's arrows/Home/End, card arrows), **Abbreviations** (a table: every translation ID → full name from the catalog, plus CC BY-SA, CC0, OT, NT, PWA), **Words used here** (glossary: collection, board, card, translation, whole word, mirror to a folder, assistant tools), **Accessibility** (the statement: target AAA for the interface; scripture and notes are content; known limitations from the README; how to report a problem — the repository issues URL).
2. The chip: `<button className="reader__chip reader__chip--icon" data-testid="help-open" aria-label="Help" aria-expanded aria-controls="help-panel">?</button>` after the Settings chip in every state, including the canvas bar (`canvas-help`). Opening it closes other panels like the others do; Escape and the close button return focus to the chip (brief 03).
3. Settings gains a "Help" button (`settings-help`) that opens the same panel.
4. The option checkboxes in `SearchBar`/`SearchResults` get `aria-describedby` pointing at visually-hidden one-sentence explanations ("Matches only whole words: love, not loveth.").
5. Plain-language pass over app copy: `SettingsPanel` body text, `DurabilityBanner` messages, `LibraryPanel` note, `ProposalPreview` lede, error strings in `App.tsx`. Target: no sentence over 20 words where a shorter one says the same; no jargon without the glossary term.

## Files you may touch

- `apps/reader/src/components/HelpPanel.tsx` (new), `BiblePane.tsx` (chip), `CanvasView.tsx` (chip), `SettingsPanel.tsx` (button), `SearchBar.tsx`/`SearchResults.tsx` (`aria-describedby`), `App.tsx` (state and wiring), `styles.css`, copy in the components listed in item 5.
- `tests/reader/a11y.spec.ts` (help state), `tests/reader/chrome.spec.ts` (help chip stays in the bar at the narrow floor), `tests/reader/keyboard.spec.ts` (open/close with focus return).

## Acceptance commands

```bash
mise exec node@24 -- npm run lint
mise exec node@24 -- npx playwright test --project=reader tests/reader/a11y.spec.ts tests/reader/chrome.spec.ts tests/reader/keyboard.spec.ts
```

## Reviewer checklist

- [ ] The chip is in the same position in reading, panel and canvas states.
- [ ] Every translation in the catalog appears in the abbreviations table.
- [ ] The accessibility statement names the two content exemptions and the manual-check limitation.
