# Brief 93 — Windows High Contrast (forced colours)

| | |
|---|---|
| **ID** | `93-forced-colors` |
| **Size** | S |
| **Depends on** | `02-tokens`, `22-colour-meaning` |
| **Status** | assigned (owner) |
| **Criteria** | 1.4.1, 1.4.3, 1.4.11, 2.4.7 under forced colours |

## Outcome

With a Windows High Contrast theme on, every control has a visible boundary, every highlighted verse is still identifiable (rule and glyph), swatches keep their colours, the focus ring is visible, and nothing disappears.

## First pass without Windows

In Chromium DevTools → Rendering → "Emulate CSS media feature forced-colors: active", or in a Playwright spec with `page.emulateMedia({ forcedColors: 'active' })`. Check: inputs and buttons have borders; `.verse[data-highlight]` shows its left rule; `.swatch` and `.card__dot` keep colour (`forced-color-adjust: none`); the focus ring is visible on the note body; the canvas dotted grid is gone but cards have borders; in the delete confirmation (press a note's Delete) the action button is drawn inverted, so it stands apart from Cancel, and the focus ring shows around either. The emulated check passed in Chromium on 2026-09-17.

## On Windows

Settings → Accessibility → Contrast themes → Aquatic, then Desert. Walk: reading, verse actions, marks, library, settings, results, canvas, proposal, the delete confirmation. Screenshot each.

## Hand-back

Screenshots per theme per state; failures filed against brief 02 or 22. Update the matrix's manual-check row.
