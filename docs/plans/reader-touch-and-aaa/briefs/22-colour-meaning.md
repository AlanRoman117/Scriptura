# Brief 22 — Highlights that mean something without colour

| | |
|---|---|
| **ID** | `22-colour-meaning` |
| **Size** | S |
| **Depends on** | `02-tokens`, `01-prefs` (`data-markers`), `12-verse-actions` (names) |
| **Status** | open |
| **Criteria** | 1.4.1 Use of Color, 1.4.11 Non-text Contrast, 1.4.6 |

## Outcome

Which collection a highlighted verse belongs to can be told without seeing colour: every highlighted verse has a left rule and, when the reader turns markers on, a glyph before its number; the verse number's accessible name says the collection; a card on a board says its colour name; a swatch has a 3:1 ring so the control is visible whatever its hue.

## Read first

- `apps/reader/src/styles.css` lines 267–325 (highlight tints, swatches), 540–549 and 597–604 (card colours and dots), 680–685 (embed cards).
- `apps/reader/src/components/BiblePane.tsx` lines 186–225 — where the verse's `data-highlight` and the number's `aria-label` are set.
- `apps/reader/src/lib/notes.ts` lines 36–37 and 84–86 — colours and `colorLabel`.

## Rules that bite here

> "Highlights are anchored to `{book_slug, chapter, verse}` — the passage, not the translation." — CLAUDE.md → Apps. Nothing here changes storage; markers are presentation.

> "The swatch hues amber/sky/mint are 1.86/2.93/2.48:1 against white — colour alone cannot identify them." — README. The glyph and the ring are the fix, not a brighter hue.

## Required behaviour

1. Glyph map, one place: `export const HIGHLIGHT_GLYPHS: Record<HighlightColor, string> = { amber: '●', rose: '▲', sky: '■', mint: '◆', violet: '★' }` in `lib/notes.ts`.
2. `.verse[data-highlight]` gets `border-left: 3px solid var(--hl-{color}-strong)` (a new set of five *saturated* tokens ≥ 3:1 against paper — the tint tokens are too pale for a rule) and `padding-left: .45rem`.
3. `:root[data-markers="true"] .verse[data-highlight]::before` draws the glyph before the number in `--ink` at `.75em`; the glyph is also in the verse number's name: `aria-label={`Mark ${book} ${ch}:${v}${mark ? ` — in ${colorLabel(mark.color, labels)} (${mark.color})` : ''}`}`.
4. Swatches (brief 12) and card dots/Colour button (brief 14) show the glyph when markers are on, always in their names.
5. Cards: `<span className="visually-hidden">Colour: {label}</span>` inside `.card__title`; `.card[data-color]` keeps its border (≥ 3:1 via the strong tokens) and gains a 6 px top rule in the same colour so it is not only a thin outline.
6. Marks panel group headers show the glyph before the label when markers are on.

## Files you may touch

- `apps/reader/src/lib/notes.ts` (the glyph map only), `apps/reader/src/components/BiblePane.tsx`, `MarksPanel.tsx`, `CanvasView.tsx` (title span only), `apps/reader/src/styles.css`.
- `tests/reader/notes.spec.ts`, `tests/unit/contrast.test.ts` (add the strong tokens to the 3:1 set).

## Tests to add or change

- `tests/reader/notes.spec.ts` — mark verse 1 amber, turn `pref-markers` on, the verse's `::before` content is "●" (`getComputedStyle(el, '::before').content`) and `verse-1`'s accessible name contains "(amber)"; with markers off, no `::before` content but the name still contains "(amber)".
- `tests/unit/contrast.test.ts` — `--hl-*-strong` ≥ 3:1 on `--paper` and `--paper-raised` per theme.

## Acceptance commands

```bash
mise exec node@24 -- npm test
mise exec node@24 -- npx playwright test --project=reader tests/reader/notes.spec.ts tests/reader/a11y.spec.ts
```
