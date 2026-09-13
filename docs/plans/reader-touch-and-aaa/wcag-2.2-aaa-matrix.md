# WCAG 2.2 conformance matrix — `apps/reader`

Every success criterion in WCAG 2.2 (86: 31 Level A, 24 AA, 31 AAA), with its status for the reader PWA. This file is the record; the tests named in the Evidence column are the proof. Update it in the same commit as the change it describes.

**Legend** — ✅ met · ❌ not met (brief named) · 🔧 partly met / re-verify after the named brief · ➖ not applicable (no such content or feature) · 📄 content exemption (applies to scripture and user notes, documented in the help panel) · 🧪 requires a manual check (brief named).

**Scope note.** Conformance is claimed for the application UI and app-authored text. Scripture and user-written notes are content the app presents, not authors: 3.1.5 and 3.1.6 are exempt for them; 3.1.2 (language), 1.4.3/1.4.6 (contrast), 1.4.8 (presentation) and 1.4.10/1.4.12 (reflow, spacing) are still enforced on them.

## Level A

| SC | Name | Status | Evidence / test | Notes |
|---|---|---|---|---|
| 1.1.1 | Non-text Content | 🔧 T4 | `tests/reader/a11y.spec.ts` (axe `button-name` in every state) | Done: every glyph-only button has a name (connect, open passage, remove card, zoom reset, dismiss notice, close panels). Remaining: the "Connections" list as the text alternative for the board's edge layer and thumbnail (T4). |
| 1.2.1 | Audio-only and Video-only (Prerecorded) | ➖ | — | No audio or video. |
| 1.2.2 | Captions (Prerecorded) | ➖ | — | |
| 1.2.3 | Audio Description or Media Alternative | ➖ | — | |
| 1.3.1 | Info and Relationships | ✅ | axe `heading-order`, `list`, `landmark-*` in five states × two schemes; `keyboard.spec.ts` (one `h1` per state); `editor.spec.ts` (note headings offset; a real Edit control per preview block) | One `h1` per view state; Marks groups and the notes pane have headings; note headings are offset under them; lists carry `role="list"`; the option checkboxes are a fieldset; the passage selects are a `<nav>`; both panes are named landmarks; every clickable block in the preview carries a real button, the block's own click being a pointer convenience. |
| 1.3.2 | Meaningful Sequence | ✅ | manual read of DOM order | DOM order matches visual order in every state; the sheet follows the Bible pane. |
| 1.3.3 | Sensory Characteristics | ✅ | — | Instructions name controls ("use **Canvas** beside a verse"), never a shape, position or colour alone. |
| 1.4.1 | Use of Color | 🔧 T4 | `notes.spec.ts` (swatch and verse-number names carry the collection; a marked verse has a strong-hue rule and, with markers on, a shape) | Done: a marked verse's name says its collection in words; every marked verse has a left rule in the collection's strong hue; Settings → "Show a symbol on every highlight" draws ● ▲ ■ ◆ ★ beside marked verses, on the swatches and in the Marks panel. Remaining: a board card's colour named in its text (T4). |
| 1.4.2 | Audio Control | ➖ | — | |
| 2.1.1 | Keyboard | 🔧 T4 | `keyboard.spec.ts`; `editor.spec.ts` (preview Edit by keyboard; Shift+Tab reaches the formatting tools, arrows move, a tool formats and returns focus); `reading.spec.ts` (divider Home/End); `study.spec.ts` (Tab and Down arrow reach the search suggestions) | Done: preview click-to-edit, the divider, the search suggestions, the formatting toolbar (focus-within, no timer). Remaining: canvas pan, drag, resize and edge removal (T4). |
| 2.1.2 | No Keyboard Trap | ✅ | `keyboard.spec.ts` (Tab from the modal never reaches a page element behind it; Escape closes it) | The proposal is a native `<dialog>` opened with `showModal()`: the page behind it is inert and Escape discards. |
| 2.1.4 | Character Key Shortcuts | ✅ | — | No single-character shortcuts exist. |
| 2.2.1 | Timing Adjustable | ✅ | — | No time limits. The 150 ms blur timers that removed UI are deleted by T3/T8. |
| 2.2.2 | Pause, Stop, Hide | ✅ | — | Nothing moves, blinks or auto-updates for more than 5 s (verse flash 1.6 s). |
| 2.3.1 | Three Flashes or Below Threshold | ✅ | — | One 1.6 s flash on jump. |
| 2.4.1 | Bypass Blocks | ✅ | `reading.spec.ts` (first Tab focuses "Skip to scripture"; Enter lands in `main`); axe `bypass`, `landmark-*` | Two skip links first in the document; `main` "Scripture", `aside`/`section` "Notes", `nav` "Passage". |
| 2.4.2 | Page Titled | ✅ | `reading.spec.ts` (`John 1 · BSB · Scriptura`, changes with the passage and with an open panel) | The title names the passage and translation, the open panel, or the board. |
| 2.4.3 | Focus Order | ✅ | `keyboard.spec.ts` (Escape returns focus to the opening chip for every panel; verse actions take focus when opened from the number, are one Tab stop, and return focus to the number; the dialog returns focus; Escape closes only the newest surface); `reading.spec.ts` (skip link) | `useReturnFocus` and the dismiss stack in `lib/focus.ts`; roving tabindex in the verse actions; skip links first in the document. |
| 2.4.4 | Link Purpose (In Context) | ✅ | axe `link-name`; `editor.spec.ts` preview link | The attribution link reads "{Translation} source"; a preview wikilink is named "Go to {Book c:v (ID)}" through `describeLink`. |
| 2.5.1 | Pointer Gestures | ✅ | — | No path-based or multipoint gesture is required; pinch (T4) is an addition with button equivalents. |
| 2.5.2 | Pointer Cancellation | ✅ | — | Activation is on up-event; down-event starts only drags, which are essential. |
| 2.5.3 | Label in Name | ✅ | axe `label-content-name-mismatch` in every state | The translation chip's name starts with its visible ID, then the full name; the Marks chip's name starts with "Marks". |
| 2.5.4 | Motion Actuation | ➖ | — | No device-motion input. |
| 3.1.1 | Language of Page | ✅ | `index.html` `lang="en"` | |
| 3.2.1 | On Focus | ✅ | — | Focus changes nothing. |
| 3.2.2 | On Input | ✅ | — | Changing book or chapter re-renders the passage in place; no new window, no focus move, no page change. Documented as not a change of context. |
| 3.2.6 | Consistent Help | ✅ | `keyboard.spec.ts` (the "?" chip is last in the bar in every reading state; Settings has "Open help"; the board bar has the same chip) | Help is the last chip in the reading bar in every state, an entry in Settings, and a chip in the board bar. |
| 3.3.1 | Error Identification | ✅ | `a11y.spec.ts` (offline download: the row is `role="alert"` and the assertive region names the error); `notes.spec.ts` (save failure in the note footer) | Download errors are shown on the row and announced assertively; a board that fails to save is announced too (it was only logged). |
| 3.3.2 | Labels or Instructions | ✅ | axe `label` in every state | Every field has a name; the matching options are a fieldset with a legend; Settings controls have visible labels. Placeholders remain the only *visible* label on the note title and body (acceptable: both have names, and the placeholder is the instruction). |
| 3.3.7 | Redundant Entry | ➖ | — | No multi-step process re-asks for information. |
| 4.1.2 | Name, Role, Value | 🔧 T4 | axe `button-name`, `aria-allowed-attr`, `aria-allowed-role`, `aria-progressbar-name` in every state; `editor.spec.ts` (the toolbar is one Tab stop with arrow keys) | Done: named glyph buttons, named progressbar, disclosures with `aria-expanded`/`aria-controls`, the durability notice a named landmark, `role="toolbar"` behaving as one, the verse actions a named group with roving focus. Remaining: board cards as focusable named groups (T4). |

## Level AA

| SC | Name | Status | Evidence / test | Notes |
|---|---|---|---|---|
| 1.2.4 | Captions (Live) | ➖ | — | |
| 1.2.5 | Audio Description (Prerecorded) | ➖ | — | |
| 1.3.4 | Orientation | ✅ | `apps/reader/vite.config.ts` manifest `orientation: 'any'` | No orientation lock, stated rather than assumed. |
| 1.3.5 | Identify Input Purpose | ➖ | — | No field collects information about the user. |
| 1.4.3 | Contrast (Minimum) | ✅ | `tests/unit/contrast.test.ts` (139 pairs, five themes); `chrome.spec.ts` dropdowns at 7:1 | Was: verse numbers over highlight tints 3.56–4.0:1; `#b3261e` on dark 2.77:1. Fixed by the token rework: highlighted verse numbers read in `--ink`; `--danger` is a token per theme. |
| 1.4.4 | Resize Text | ✅ | manual 200 % zoom | Browser zoom to 200 % reflows into narrow mode; no horizontal scroll. Board-thumbnail labels are SVG text and scale with zoom. |
| 1.4.5 | Images of Text | ✅ | — | No raster text; SVG labels are real text. |
| 1.4.10 | Reflow | 🔧 X-touch | `tests/reader-touch/shell.spec.ts` (no horizontal overflow at 412 px); `tests/reader-touch/compare.spec.ts` (a comparison is a stacked list, nothing scrolls sideways) | A comparison on a narrow pane is a list of verses rather than a sideways-scrolling table; the canvas is two-dimensional (exempt). Remaining: the 320 px check across states. |
| 1.4.11 | Non-text Contrast | ✅ | `contrast.test.ts` (`--edge`, `--focus`, `--hl-*-strong` ≥ 3:1 in every theme) | Every control border, the divider grip, the sheet handle, the swatch ring, card colour borders and the marked-verse rule use `--edge` or a strong hue. |
| 1.4.12 | Text Spacing | 🔧 F6 | `tests/reader-touch/shell.spec.ts` injected spacing | `-webkit-line-clamp` and `nowrap` surfaces must not lose content at 1.5× line height and 2× paragraph spacing. |
| 1.4.13 | Content on Hover or Focus | ✅ | `a11y.spec.ts`; review | Nothing appears on hover alone: the comparison's quote button is always visible at reduced emphasis; the Marks label border is always drawn; the preview's Edit control is reachable by focus and always shown on touch. The editor toolbar appears on focus into a *reserved* slot, so it neither obscures nor replaces content (the criterion's exemption). Native `title` tooltips have been replaced by names. |
| 2.4.5 | Multiple Ways | ✅ | — | Single-page application: passage navigation, search and the marks list all reach any verse. |
| 2.4.6 | Headings and Labels | 🔧 W1 | axe `empty-heading`, review | Marks groups and the canvas have no headings. |
| 2.4.7 | Focus Visible | ✅ | `tests/reader/keyboard.spec.ts` (every Tab stop in the reading state, the note title, the writing surface, the Marks labels); `contrast.test.ts` hygiene test forbids `outline: none` | Was: `input` excluded from the ring rule and five `outline: none` declarations. The ring is now declared with real specificity on every focusable element. |
| 2.4.11 | Focus Not Obscured (Minimum) | ✅ | `chrome.spec.ts` (the sticky title parks exactly under the measured bar and search heights); `tests/reader-touch/sheet.spec.ts` (the Bible pane is `inert` under a full sheet; the chapter scrolls clear of the sheet at any height) | `--bar-h`, `--search-h` and `--sheet-h` are measured and drive the sticky offsets and the panes' scroll padding; text covered by a full notes sheet is inert, so focus cannot land there. |
| 2.5.7 | Dragging Movements | 🔧 T4 | `reading.spec.ts` (divider Narrower/Wider buttons, Home/End) | Done: the divider has two buttons and keyboard steps. Remaining: card move and resize, canvas pan (T4). The sheet already has its button. |
| 2.5.8 | Target Size (Minimum) | 🔧 T4, T7 | `tests/reader/targets.spec.ts` | Superseded by 2.5.5, met in the same states. |
| 3.1.2 | Language of Parts | ✅ | `library.spec.ts` (`.chapter__text` is `lang="es"` after reading rv1909; comparison columns carry `en` and `es`) | `lang` from `TranslationMeta.language` on the chapter text, each comparison column, marks, search suggestions and results. |
| 3.2.3 | Consistent Navigation | ✅ | — | The reading bar is identical in every state. |
| 3.2.4 | Consistent Identification | ✅ | review | Every panel closes with a ✕ named "Close {panel}"; the canvas leaves with a text button "Back to reading", consistent with itself. |
| 3.3.3 | Error Suggestion | ✅ | `library.spec.ts` offline test | "No connection — try again when you are online"; "Could not save — export your notes". |
| 3.3.4 | Error Prevention (Legal, Financial, Data) | 🔧 T4 | `notes.spec.ts` (Delete arms, announces, cancels by Escape or Cancel; a removed mark is undone), `library.spec.ts` (removing a translation takes two presses) | Done: note delete, board delete, mark removal and translation removal go through `ConfirmButton`; mark removal is also reversible. Remaining: removing a card or a connection on the board (T4). |
| 3.3.8 | Accessible Authentication (Minimum) | ➖ | — | No authentication. |
| 4.1.3 | Status Messages | ✅ | `a11y.spec.ts` (search total once typing pauses, panel opened/closed, download progress by quarters and completion, download error as an alert, named progressbar) | One polite and one assertive live region in `lib/announce.tsx`, mounted beside the app; duplicates are dropped so a query typed letter by letter is announced once. The note footer keeps its own region. |

## Level AAA

| SC | Name | Status | Evidence / test | Notes |
|---|---|---|---|---|
| 1.2.6 | Sign Language (Prerecorded) | ➖ | — | |
| 1.2.7 | Extended Audio Description | ➖ | — | |
| 1.2.8 | Media Alternative (Prerecorded) | ➖ | — | |
| 1.2.9 | Audio-only (Live) | ➖ | — | |
| 1.3.6 | Identify Purpose | ✅ | axe `landmark-*`, `region` in every state | Regions are named landmarks (Scripture, Notes, Passage, Marked verses, Translations, Settings, Search results, Where your notes are kept); controls carry roles and names. No field collects personal data, so `autocomplete` does not apply. |
| 1.4.6 | Contrast (Enhanced) | ✅ | `tests/unit/contrast.test.ts` — `--ink`, `--ink-soft`, `--accent`, `--danger` ≥ 7:1 on both papers and `--ink` ≥ 7:1 over every highlight tint, in light, dark, hc-light, hc-dark and sepia; axe `color-contrast-enhanced` as backstop | Was: `--accent` 4.65:1, dark `--ink-soft` 6.59:1, `#b3261e` 6.21:1. New values: light accent `#5f4a0e` (8.07), dark `--ink-soft` `#b3ada5` (7.49), danger `#9a1f18`/`#f2b8b5`. |
| 1.4.7 | Low or No Background Audio | ➖ | — | |
| 1.4.8 | Visual Presentation | ✅ | `tests/reader/settings.spec.ts` (text size ×1.5 measured on the text, relaxed spacing ≥ 1.5 leading and ≥ 1.5 × line between verses, pinned themes and `system`); `tests/unit/prefs.test.ts` | Settings → Reading & display: six colour themes (light, dark, high-contrast light and dark, sepia, or the device's), text size 100–200 %, three spacing presets (relaxed and loose meet the 1.5×/1.5× rule), column width 56/64/70 ch; text is never justified. Preferences are device-scoped and applied before first paint. |
| 1.4.9 | Images of Text (No Exception) | ✅ | — | No images of text anywhere. |
| 2.1.3 | Keyboard (No Exception) | 🔧 T4 | `keyboard.spec.ts`, `study.spec.ts`, `editor.spec.ts` | Same state as 2.1.1; no exception is claimed. |
| 2.2.3 | No Timing | ✅ | `notes.spec.ts` (an armed Delete stays armed until Escape or Cancel; Undo stays offered until the next change) | No time limits anywhere; nothing is dismissed by a timer. |
| 2.2.4 | Interruptions | 🔧 W11 | `a11y.spec.ts` | Every announcement is polite except a failed download; the durability banner is dismissible. Remaining: the service worker's silent take-over becomes a "Reload / Later" prompt (W11). |
| 2.2.5 | Re-authenticating | ➖ | — | |
| 2.2.6 | Timeouts | ➖ | — | No inactivity timeout; nothing is lost while idle. |
| 2.3.2 | Three Flashes | ✅ | — | |
| 2.3.3 | Animation from Interactions | ✅ | `tests/reader/motion.spec.ts` (flash animation is `none` under the OS preference and under the Settings switch; a still outline marks the verse instead) | Both `prefers-reduced-motion` and `data-motion="reduce"` disable every transition and animation and force `scroll-behavior: auto`; scripted scrolls ask `prefersReducedMotion()`. |
| 2.4.8 | Location | ✅ | `reading.spec.ts` title test | The title says the passage and translation or the open panel; the passage `<nav>` is always in the bar; the sticky chapter heading stays in view. |
| 2.4.9 | Link Purpose (Link Only) | ✅ | axe `link-name`, `identical-links-same-purpose` | "{Translation} source"; wikilinks named "Go to …" from their resolved passage. |
| 2.4.10 | Section Headings | ✅ | `keyboard.spec.ts` (exactly one `h1` in reading, Marks, Translations, Settings, and the board); axe `page-has-heading-one`, `heading-order` | The chapter title, the open panel's title, or the board name is the `h1`; Marks collections and the notes pane are `h2`; note headings start at `h3`. |
| 2.4.12 | Focus Not Obscured (Enhanced) | ✅ | as 2.4.11 | No part of a focused control is hidden by the sticky bars or the sheet: scroll padding keeps focus clear of the bars, and whatever the sheet covers entirely is inert. |
| 2.4.13 | Focus Appearance | ✅ | `contrast.test.ts` (`--focus` ≥ 3:1 on both papers in every theme); `keyboard.spec.ts` (2 px solid ring on every stop) | The ring is `2px solid var(--focus)`, offset 2 px outside controls and 2 px inside flush text fields, so the whole perimeter is at least 2 px and the change of contrast clears 3:1. |
| 2.5.5 | Target Size (Enhanced) | 🔧 T4, T7 | `tests/reader/targets.spec.ts`: reading, verse actions, note open, preview, Marks, Translations, Settings, help, results; `tests/reader-touch/verse-actions.spec.ts` (docked row) | `--control-h: 44px` on every control class; swatches are 44px buttons around a 26px disc. Exceptions claimed: the verse number (inline in the text; the whole verse is the equivalent target) and text links inside prose. Remaining states: canvas (T4), narrow comparison (T7). |
| 2.5.6 | Concurrent Input Mechanisms | ✅ | — | Nothing restricts input modality; touch, mouse and keyboard coexist. |
| 3.1.3 | Unusual Words | ✅ | `a11y.spec.ts` help state; `keyboard.spec.ts` | The help panel's "Words used here" defines collection, board, card, translation, whole words only, match case, mirror to a folder and assistant tools; the search options carry one-sentence descriptions read with the checkbox. |
| 3.1.4 | Abbreviations | ✅ | `keyboard.spec.ts` (every catalogue ID appears in the abbreviations table) | The translation chip's name expands its ID; the help panel's table expands every translation ID plus CC BY-SA 4.0, CC0, OT, NT, PWA and WCAG. |
| 3.1.5 | Reading Level | 📄 content; ✅ UI text | review of app copy | Scripture and notes are content, stated in the help panel's accessibility section. App-authored text was rewritten in short sentences with common words (Settings, the durability notice, the library note, help); the glossary supplements the terms that remain. |
| 3.1.6 | Pronunciation | 📄 content | — | Kanji readings in the Japanese translation are content. No UI text has meaning that depends on pronunciation. |
| 3.2.5 | Change on Request | ✅ (W11 hardens) | `apps/reader/dist/registerSW.js` | No automatic context changes; the service worker registration does not reload the page. W11 replaces the silent worker take-over with a user-triggered reload. |
| 3.3.5 | Help | ✅ | `a11y.spec.ts` help state; `keyboard.spec.ts` (opens from the bar, from Settings, and from the board; Escape returns focus) | Context-sensitive help covers finding a passage, searching, notes, marks, boards, translations, the keyboard, abbreviations, a glossary and the accessibility statement. |
| 3.3.6 | Error Prevention (All) | 🔧 T4 | as 3.3.4 | Every destructive action on the reader's own work is confirmed and announced, and mark removal is reversible. Discarding an assistant's proposal stays one press: the draft is the assistant's, not the reader's, and can be asked for again. Remaining: card and connection removal (T4). |
| 3.3.9 | Accessible Authentication (Enhanced) | ➖ | — | |

## Manual checks (cannot be automated here)

| Check | Brief | Status |
|---|---|---|
| iOS Safari: keyboard over the notes sheet; sheet drag; safe-area insets in standalone mode | `briefs/91-device-ios.md` | 🧪 open |
| Android Chrome: `interactive-widget=resizes-content` with the keyboard; pinch on the canvas | `briefs/91-device-ios.md` (same brief, Android section) | 🧪 open |
| VoiceOver (iOS, macOS), TalkBack, NVDA: every state reachable and announced; names read as written here | `briefs/92-screen-readers.md` | 🧪 open |
| Windows High Contrast / `forced-colors`: highlights, swatches, focus, edges | `briefs/93-forced-colors.md` | 🧪 open |
