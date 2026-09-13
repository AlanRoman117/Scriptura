# WCAG 2.2 conformance matrix — `apps/reader`

Every success criterion in WCAG 2.2 (86: 31 Level A, 24 AA, 31 AAA), with its status for the reader PWA. This file is the record; the tests named in the Evidence column are the proof. Update it in the same commit as the change it describes.

**Legend** — ✅ met · ❌ not met (brief named) · 🔧 partly met / re-verify after the named brief · ➖ not applicable (no such content or feature) · 📄 content exemption (applies to scripture and user notes, documented in the help panel) · 🧪 requires a manual check (brief named).

**Scope note.** Conformance is claimed for the application UI and app-authored text. Scripture and user-written notes are content the app presents, not authors: 3.1.5 and 3.1.6 are exempt for them; 3.1.2 (language), 1.4.3/1.4.6 (contrast), 1.4.8 (presentation) and 1.4.10/1.4.12 (reflow, spacing) are still enforced on them.

## Level A

| SC | Name | Status | Evidence / test | Notes |
|---|---|---|---|---|
| 1.1.1 | Non-text Content | ❌ T4, W1 | `tests/reader/a11y.spec.ts` (axe `button-name`, `svg-img-alt`) | Glyph-only buttons (⇢ ↗ ✕) are named by the glyph; the board thumbnail SVG has no text alternative for cards or edges; the canvas edge layer is `aria-hidden` with no alternative. Fix: names on every control, a "Connections" list as the diagram's alternative. |
| 1.2.1 | Audio-only and Video-only (Prerecorded) | ➖ | — | No audio or video. |
| 1.2.2 | Captions (Prerecorded) | ➖ | — | |
| 1.2.3 | Audio Description or Media Alternative | ➖ | — | |
| 1.3.1 | Info and Relationships | ❌ W1 | axe `heading-order`, `list`, `landmark-*`; `keyboard.spec.ts` | Headings vanish when a panel is open; note headings render raw; Marks groups unnamed; `list-style:none` lists without `role=list`; option checkboxes without a group; clickable `<p>`/`<div>`. |
| 1.3.2 | Meaningful Sequence | ✅ | manual read of DOM order | DOM order matches visual order in every state; the sheet follows the Bible pane. |
| 1.3.3 | Sensory Characteristics | ✅ | — | Instructions name controls ("use **Canvas** beside a verse"), never a shape, position or colour alone. |
| 1.4.1 | Use of Color | ❌ W2 | `a11y.spec.ts`; `notes.spec.ts` marker test | Highlight collection membership is conveyed by hue alone; card colour likewise. Fix: left rule + optional glyph, collection name in the control's accessible name, visually-hidden colour name on cards. |
| 1.4.2 | Audio Control | ➖ | — | |
| 2.1.1 | Keyboard | ❌ T3, T4, T6, T8 | `keyboard.spec.ts` | Preview blocks, canvas (pan, drag, resize, connect target, edge delete), search panel and editor toolbar are pointer-only. |
| 2.1.2 | No Keyboard Trap | ✅ | `keyboard.spec.ts` (Tab from the modal never reaches a page element behind it; Escape closes it) | The proposal is a native `<dialog>` opened with `showModal()`: the page behind it is inert and Escape discards. |
| 2.1.4 | Character Key Shortcuts | ✅ | — | No single-character shortcuts exist. |
| 2.2.1 | Timing Adjustable | ✅ | — | No time limits. The 150 ms blur timers that removed UI are deleted by T3/T8. |
| 2.2.2 | Pause, Stop, Hide | ✅ | — | Nothing moves, blinks or auto-updates for more than 5 s (verse flash 1.6 s). |
| 2.3.1 | Three Flashes or Below Threshold | ✅ | — | One 1.6 s flash on jump. |
| 2.4.1 | Bypass Blocks | ❌ W1 | axe `bypass`, `keyboard.spec.ts` | No skip link; the notes `<aside>` is unnamed. |
| 2.4.2 | Page Titled | ❌ W1 | `reading.spec.ts` title test | `<title>` is static. Fix: `Book Chapter · ID · Scriptura`, panel names when open. |
| 2.4.3 | Focus Order | 🔧 T2, W1 | `keyboard.spec.ts` (Escape returns focus to the opening chip for Marks, Library and Settings; to the verse number for the verse actions; to the previously focused element after the dialog; Escape closes only the newest surface) | Done: `useReturnFocus` and the dismiss stack in `lib/focus.ts`; the dialog takes initial focus itself so its title and lede are read first. Remaining: focus moves *into* the verse actions when opened by keyboard (T2); skip links (W1). |
| 2.4.4 | Link Purpose (In Context) | ❌ W1 | axe `link-name` | Attribution link reads "source"; preview wikilinks are named by the raw target. |
| 2.5.1 | Pointer Gestures | ✅ | — | No path-based or multipoint gesture is required; pinch (T4) is an addition with button equivalents. |
| 2.5.2 | Pointer Cancellation | ✅ | — | Activation is on up-event; down-event starts only drags, which are essential. |
| 2.5.3 | Label in Name | 🔧 W1 | axe `label-content-name-mismatch` | Every accessible name must contain the visible text: the translation chip's name must start with its visible ID ("KJV — King James Version…"). |
| 2.5.4 | Motion Actuation | ➖ | — | No device-motion input. |
| 3.1.1 | Language of Page | ✅ | `index.html` `lang="en"` | |
| 3.2.1 | On Focus | ✅ | — | Focus changes nothing. |
| 3.2.2 | On Input | ✅ | — | Changing book or chapter re-renders the passage in place; no new window, no focus move, no page change. Documented as not a change of context. |
| 3.2.6 | Consistent Help | ❌ W7 | `a11y.spec.ts` help state | No help mechanism exists yet; once it does it is the "?" chip in the reader bar, same position in every state, and an entry in Settings. |
| 3.3.1 | Error Identification | ❌ F5 | `library.spec.ts` offline test | Download errors are visible but not announced; board-save failure is logged only. |
| 3.3.2 | Labels or Instructions | 🔧 W1 | axe `label` | Every field has an accessible name; the option checkboxes need a group label; placeholders remain the only *visible* label on text fields (acceptable, noted). |
| 3.3.7 | Redundant Entry | ➖ | — | No multi-step process re-asks for information. |
| 4.1.2 | Name, Role, Value | ❌ W1, T4 | axe `button-name`, `aria-allowed-attr`, `aria-progressbar-name` | Glyph buttons, unnamed progressbar, disclosures marked `aria-pressed`, `role=toolbar` without arrow-key behaviour. |

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
| 1.4.10 | Reflow | 🔧 T6, T7 | `tests/reader-touch/shell.spec.ts` (no horizontal overflow of the page or the reading pane at 412 px); 320 px added with T6 | Comparison table scrolls inside its own box (permitted) and becomes a stacked list on narrow panes (T7); canvas is two-dimensional (exempt). |
| 1.4.11 | Non-text Contrast | 🔧 W2, T5 | `contrast.test.ts` (`--edge` ≥ 3:1, focus ≥ 3:1, `--hl-*-strong` ≥ 3:1 in every theme) | Done: every control border, the sheet handle, the swatch ring and the card colour borders use `--edge` or a strong hue. Remaining: the divider grip (T5) and the highlight left rule (W2). |
| 1.4.12 | Text Spacing | 🔧 F6 | `tests/reader-touch/shell.spec.ts` injected spacing | `-webkit-line-clamp` and `nowrap` surfaces must not lose content at 1.5× line height and 2× paragraph spacing. |
| 1.4.13 | Content on Hover or Focus | ❌ T6 | `a11y.spec.ts` | `.compare__quote` is revealed on hover only. The editor toolbar appears on focus into a *reserved* slot, so it neither obscures nor replaces content (exempt). Native `title` tooltips are user-agent controlled (exempt) but are being replaced with visible or accessible names anyway. |
| 2.4.5 | Multiple Ways | ✅ | — | Single-page application: passage navigation, search and the marks list all reach any verse. |
| 2.4.6 | Headings and Labels | 🔧 W1 | axe `empty-heading`, review | Marks groups and the canvas have no headings. |
| 2.4.7 | Focus Visible | ✅ | `tests/reader/keyboard.spec.ts` (every Tab stop in the reading state, the note title, the writing surface, the Marks labels); `contrast.test.ts` hygiene test forbids `outline: none` | Was: `input` excluded from the ring rule and five `outline: none` declarations. The ring is now declared with real specificity on every focusable element. |
| 2.4.11 | Focus Not Obscured (Minimum) | 🔧 T1, T6 | `keyboard.spec.ts` obscured test (with T6) | Done: `.pane` has `scroll-padding` from `--bar-h`/`--search-h`/`--sheet-h` and verses carry `scroll-margin`. Remaining: measured bar heights (T6) and the Bible pane `inert` under a full sheet (T1). |
| 2.5.7 | Dragging Movements | ❌ T4, T5 | `keyboard.spec.ts`, `canvas.spec.ts` | Card move and resize, canvas pan and the divider have no single-pointer alternative. Fix: Move/Size popover with arrow and ± buttons, pan buttons, divider Narrower/Wider. The sheet already has a button. |
| 2.5.8 | Target Size (Minimum) | ❌ T6 | `tests/reader/targets.spec.ts` | Swatches, colour dots, resize grip, divider, dismiss and compare controls are under 24 px. Superseded by 2.5.5 below. |
| 3.1.2 | Language of Parts | ❌ W1 | `library.spec.ts` (`lang="es"` after reading rv1909) | No `lang` on any scripture text. Fix: `lang={bible.meta.language}` on every scripture container, per column in comparison. |
| 3.2.3 | Consistent Navigation | ✅ | — | The reading bar is identical in every state. |
| 3.2.4 | Consistent Identification | 🔧 W1 | review | Close controls vary (✕, ×, "Back to reading"). Fix: one close-button component with a consistent name. |
| 3.3.3 | Error Suggestion | ✅ | `library.spec.ts` offline test | "No connection — try again when you are online"; "Could not save — export your notes". |
| 3.3.4 | Error Prevention (Legal, Financial, Data) | ❌ W8 | `notes.spec.ts`, `canvas.spec.ts`, `library.spec.ts` | Removing a card, edge, mark or translation is neither confirmed nor reversible. |
| 3.3.8 | Accessible Authentication (Minimum) | ➖ | — | No authentication. |
| 4.1.3 | Status Messages | ❌ F5 | `a11y.spec.ts` announcer test | Only note saving is announced. |

## Level AAA

| SC | Name | Status | Evidence / test | Notes |
|---|---|---|---|---|
| 1.2.6 | Sign Language (Prerecorded) | ➖ | — | |
| 1.2.7 | Extended Audio Description | ➖ | — | |
| 1.2.8 | Media Alternative (Prerecorded) | ➖ | — | |
| 1.2.9 | Audio-only (Live) | ➖ | — | |
| 1.3.6 | Identify Purpose | 🔧 W1 | axe `landmark-*`, `region` | Purpose of regions and controls is exposed through named landmarks and roles; no field collects personal data, so `autocomplete` tokens do not apply. |
| 1.4.6 | Contrast (Enhanced) | ✅ | `tests/unit/contrast.test.ts` — `--ink`, `--ink-soft`, `--accent`, `--danger` ≥ 7:1 on both papers and `--ink` ≥ 7:1 over every highlight tint, in light, dark, hc-light, hc-dark and sepia; axe `color-contrast-enhanced` as backstop | Was: `--accent` 4.65:1, dark `--ink-soft` 6.59:1, `#b3261e` 6.21:1. New values: light accent `#5f4a0e` (8.07), dark `--ink-soft` `#b3ada5` (7.49), danger `#9a1f18`/`#f2b8b5`. |
| 1.4.7 | Low or No Background Audio | ➖ | — | |
| 1.4.8 | Visual Presentation | ✅ | `tests/reader/settings.spec.ts` (text size ×1.5 measured on the text, relaxed spacing ≥ 1.5 leading and ≥ 1.5 × line between verses, pinned themes and `system`); `tests/unit/prefs.test.ts` | Settings → Reading & display: six colour themes (light, dark, high-contrast light and dark, sepia, or the device's), text size 100–200 %, three spacing presets (relaxed and loose meet the 1.5×/1.5× rule), column width 56/64/70 ch; text is never justified. Preferences are device-scoped and applied before first paint. |
| 1.4.9 | Images of Text (No Exception) | ✅ | — | No images of text anywhere. |
| 2.1.3 | Keyboard (No Exception) | ❌ T4, T6, T8 | `keyboard.spec.ts` | Same gaps as 2.1.1; no exception is claimed. |
| 2.2.3 | No Timing | ✅ W8 | — | No time limits. Undo never expires — it persists until the next change. |
| 2.2.4 | Interruptions | 🔧 W9, W11 | — | All announcements polite except download errors; the durability banner is dismissible; the service worker's silent take-over becomes a "Reload / Later" prompt. |
| 2.2.5 | Re-authenticating | ➖ | — | |
| 2.2.6 | Timeouts | ➖ | — | No inactivity timeout; nothing is lost while idle. |
| 2.3.2 | Three Flashes | ✅ | — | |
| 2.3.3 | Animation from Interactions | ✅ | `tests/reader/motion.spec.ts` (flash animation is `none` under the OS preference and under the Settings switch; a still outline marks the verse instead) | Both `prefers-reduced-motion` and `data-motion="reduce"` disable every transition and animation and force `scroll-behavior: auto`; scripted scrolls ask `prefersReducedMotion()`. |
| 2.4.8 | Location | ❌ W1 | `reading.spec.ts` title test | Page title reflects book, chapter, translation and open panel; the passage `<nav>` is always present. |
| 2.4.9 | Link Purpose (Link Only) | ❌ W1 | axe `link-name`, `identical-links-same-purpose` | "source" → "KJV source"; wikilink buttons named by their resolved description. |
| 2.4.10 | Section Headings | ❌ W1 | axe `page-has-heading-one`, `heading-order` | One `h1` per view state; Marks groups get headings; notes pane gets a heading; canvas gets one. |
| 2.4.12 | Focus Not Obscured (Enhanced) | 🔧 T1, T6 | `keyboard.spec.ts` | Scroll padding in place (see 2.4.11); the sheet's `inert` and the measured bar heights complete it. |
| 2.4.13 | Focus Appearance | ✅ | `contrast.test.ts` (`--focus` ≥ 3:1 on both papers in every theme); `keyboard.spec.ts` (2 px solid ring on every stop) | The ring is `2px solid var(--focus)`, offset 2 px outside controls and 2 px inside flush text fields, so the whole perimeter is at least 2 px and the change of contrast clears 3:1. |
| 2.5.5 | Target Size (Enhanced) | ❌ T6, T2, T4, T5 | `tests/reader/targets.spec.ts`, `tests/reader-touch/*` | 44 × 44 CSS px for every pointer target. Exceptions claimed: the verse number is **inline** in the text and the whole verse is an **equivalent** target; text links inside prose are inline. |
| 2.5.6 | Concurrent Input Mechanisms | ✅ | — | Nothing restricts input modality; touch, mouse and keyboard coexist. |
| 3.1.3 | Unusual Words | ❌ W7 | help panel glossary | "Whole words only", "Mirror to a folder", "collection", "board", "WebMCP" get definitions. |
| 3.1.4 | Abbreviations | ❌ W7, W1 | help panel; `a11y.spec.ts` | Translation IDs (KJV, BSB, VBL…) expand to names; CC BY-SA, OT/NT are expanded. |
| 3.1.5 | Reading Level | 📄 content; 🔧 W7 for UI text | plain-language pass on app copy | Scripture and notes are content. App-authored text is written to lower-secondary level or supplemented by the help panel. |
| 3.1.6 | Pronunciation | 📄 content | — | Kanji readings in the Japanese translation are content. No UI text has meaning that depends on pronunciation. |
| 3.2.5 | Change on Request | ✅ (W11 hardens) | `apps/reader/dist/registerSW.js` | No automatic context changes; the service worker registration does not reload the page. W11 replaces the silent worker take-over with a user-triggered reload. |
| 3.3.5 | Help | ❌ W7 | `a11y.spec.ts` help state | Context-sensitive help: search grammar, reference formats, Markdown, links, shortcuts, glossary, accessibility statement. |
| 3.3.6 | Error Prevention (All) | ❌ W8 | `notes.spec.ts`, `canvas.spec.ts`, `library.spec.ts` | Every destructive action is confirmed or reversible: note, board, card, edge, mark and translation removal; proposal discard. |
| 3.3.9 | Accessible Authentication (Enhanced) | ➖ | — | |

## Manual checks (cannot be automated here)

| Check | Brief | Status |
|---|---|---|
| iOS Safari: keyboard over the notes sheet; sheet drag; safe-area insets in standalone mode | `briefs/91-device-ios.md` | 🧪 open |
| Android Chrome: `interactive-widget=resizes-content` with the keyboard; pinch on the canvas | `briefs/91-device-ios.md` (same brief, Android section) | 🧪 open |
| VoiceOver (iOS, macOS), TalkBack, NVDA: every state reachable and announced; names read as written here | `briefs/92-screen-readers.md` | 🧪 open |
| Windows High Contrast / `forced-colors`: highlights, swatches, focus, edges | `briefs/93-forced-colors.md` | 🧪 open |
