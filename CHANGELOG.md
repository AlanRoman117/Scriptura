# Changelog

All notable changes to Scriptura are recorded here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow
[Semantic Versioning](https://semver.org/). A preview carries a `-preview.N`
suffix and is published as a GitHub pre-release.

## [Unreleased]

For reviewers, one new text in every language: the fourth column width in
Settings. It is listed in `docs/plans/reader-i18n/README.md`.

For reviewers, more new texts in every language: the three buttons that show
and hide a pane's menus, the switch for them in Settings and one sentence in
Help, under Finding a passage.

### Added

- On a small screen the menus step aside while you read. Scrolling on through
  a chapter sends the reading bar and the search box away and leaves the
  chapter title; scrolling back a little, reaching the top, or the button at
  the end of the title brings them back. A note does the same with its picker
  row and the Notes/Canvas tabs, and a board with its bar and the tabs when
  you start to pan, drag a card or pinch. On an iPhone SE held on its side,
  scripture goes from 164 to 286 px of the screen's 375, a note's text from
  about 30 to 126, and a board from 130 to 240; upright, of 667, from 406 to
  578, about 175 to 346, and 348 to 509. The menus are never removed: they
  stay reachable by keyboard and by a screen reader, and moving focus into
  them shows them.
- **On a small screen, hide the menus while reading** in Settings, on by
  default. Off, the menus move only when their button is pressed.
- A fourth column width in Settings: **Full**. The chapter fills its pane
  instead of keeping to a centred column, which shows most when the Bible is
  maximized on a wide screen. Narrow, Normal and Wide are unchanged, and Normal
  is still the default. Under Full, a verse's actions open at the start of the
  verse rather than in the middle of the pane.

### Changed

- On a phone the storage notice sits at the top of the Bible pane and scrolls
  away with the chapter, instead of staying pinned above it.
- On a phone a board's name and its zoom buttons are in a strip of their own
  under the board's bar, where they stay while the bar is away.

### Fixed

- Pressing Tab along the reading bar moved the text back by most of a screen
  each time, until the chapter was at its top. The text now stays where it is.
- A verse reached with the Tab key could come to rest under the pinned chapter
  title, 37px of it covered. The title's height now counts in where focus
  comes to rest.
- On a short board, a card's Move and Size panel could leave the board's frame
  when its card was reached by keyboard or by a screen reader, which scroll
  the frame. Such a scroll now moves the view instead, and the panel is never
  taller than the board.

## [0.1.0-preview.5] - 2026-09-29

The fifth preview adds two reading switches, so a chapter can be read as
running prose without verse numbers.

For reviewers, three new texts in every language: the two switches in
Settings and one sentence about them in Help, under Marks. They are listed in
`docs/plans/reader-i18n/README.md`.

### Added

- Two reading switches in Settings: **Start each verse on a new line** and
  **Show verse numbers**. Off, a chapter reads as running prose without
  numbers, closer to how it was first written. They change only how the
  chapter looks: pressing a sentence still picks the verse it belongs to, and
  highlighting, quoting, linking and the canvas work as before. Japanese and
  Chinese run their verses together without a space; a comparison keeps its
  rows and numbers.

## [0.1.0-preview.4] - 2026-09-27

The fourth preview. The reader gains eight styles, each light and dark and
chosen from tiles that show them, and a round of fixes found by using it: a
tapped link in a note now opens on a phone or tablet, a long title is shown
whole, and the canvas bar is shorter beside the Bible. It also gets proper
icons for a phone's home screen.

For reviewers, a few new words in every language: Style, Light or dark, and
the canvas bar's More. They are listed in `docs/plans/reader-i18n/README.md`.

**Try it:** <https://alanroman117.github.io/Scriptura/>

### Added

- **App icons for phones.** Adding the reader to an iPhone's home screen shows its icon, and Android gets a maskable icon whose artwork survives any launcher shape.
- **Styles.** Settings → Reading & display now offers a style, chosen from tiles that each show that style, and, separately, light or dark. Five styles are new, each with a light and a dark palette: **Vellum** (an illuminated page, with rubric-red verse numbers and small-capital titles), **Emerald** (deep green on a jade-tinted page), **Slate** (cool, flat and exact), **Nocturne** (ink-blue night with gold; navy by day) and **Ember** (amber on true black for reading in the dark). Sepia gains a dark version. A theme chosen before this carries over.
- **Design tokens.** Every colour, corner, shadow and type size in the reader comes from a token, in three tiers: palettes, fills derived from them, and style (corners, depth, type, the reading face). A style can change all of them.

### Changed

- **A shorter canvas bar beside the Bible.** Add note, Add to note, Delete board and the pan buttons fold behind **More** there, giving the board a row back; maximized, they sit in the bar as before.
- **Classic, refreshed.** Rounder corners, softer and warmer shadows, a slightly tighter chapter title. The colours barely move.
- **High contrast** keeps its colours and gains 2px control edges; it drops shadows and the blur behind the sticky bars.
- The contrast test now measures every fill the reader draws, evaluated from its formula, in every style and polarity: 944 pairs.
- Every style is tested in every appearance: following the device, and pinned light and dark on a device set to the opposite, under axe and on the phone's layout gates.
- `npm run dev:api` runs the packages from their sources, subpaths included, so it needs no build and reloads on any edit.

### Fixed

- **A long note title or board name is shown whole.** Its field wraps and grows, where it used to scroll the title out of sight. And typing a long board name no longer pushes the buttons beside it along the bar.
- **A tapped link in a note now opens its passage** on a phone or tablet. A touch screen has no Ctrl or ⌘, so a tap only put the cursor in the link and raised the keyboard (found on an iPad). A tap on a link the note is showing now opens it; on the line being edited, a tap still places the cursor so the link can be changed.
- The chapter title's book name, and the names in the book picker, now carry their Bible's language: a screen reader speaks them in its voice, and a Japanese or Chinese name no longer takes a style's Latin letter-spacing (Vellum, Nocturne).
- Secondary text on hovered rows, pressed buttons and tags fell just under the 7:1 AAA ratio in the light, dark and sepia themes. It is darker in light and sepia, lighter in dark.
- The number of the verse being acted on fell under 7:1 on its blue wash. It is now drawn in ink, as a highlighted verse's number is.
- In dark, the accent on its own tint (a link in a previewed note) was 6.5:1. The dark accent is lighter, and a hovered link reads in ink.

## [0.1.0-preview.3] - 2026-09-22

The third preview. Notes take shape as they are written, and the canvas moves
beside the Bible, sharing a pane with the notes. The interface gains a few new
words in every language, for the reviewers to check: the note editor setting,
the Notes and Canvas tabs, and the Canvas button on search results.

**Try it:** <https://alanroman117.github.io/Scriptura/>

### Added

- **Notes take shape as they are written.** Markdown is drawn as it is typed, the way Obsidian's live preview works: a `## ` line becomes a heading, `**word**` turns bold, a quote gets its rule and an embedded board is drawn in place. A line's symbols come back while the cursor is on it, for editing. Ctrl or ⌘ + click follows a `[[link]]`. Built without an editor library.
- **Settings → Note editor → Plain text** keeps the Markdown source in a plain text box, for anyone who prefers it or whose keyboard or screen reader copes badly with the live editor. **Preview** now appears only there; in the live editor the note is already drawn.
- **The canvas beside the Bible.** The board now shares the pane beside the text with the notes: two tabs, Notes and Canvas, switch between them, and either can fill the window. Building a diagram no longer means leaving the Bible, and a note and a board are one click apart. Following a card's verse brings the Bible back beside the board. On a phone the tabs sit in the notes sheet.
- **Search results onto the board.** Every search result has a Canvas button beside its `+`, in the suggestions and in the full results, which puts the verse on the open board.
- **Right-to-left lines in notes.** Each line takes its direction from its own text, so a Hebrew or Arabic line (a quoted Hebrew word, say) runs right to left beside English.

### Fixed

- The focus ring around the note and its title no longer covers the cursor at the start of a line: both have room inside their edge.
- With the notes or the board maximized, the page kept no main landmark and no level-1 heading; the maximized pane now carries both.
- Undo after a formatting button now undoes the formatting. The plain text box lost its undo history whenever a button changed the note; the live editor keeps its own.

### Changed

- `@types/node` 24.13.3 → 24.13.4 (Dependabot, #12): type definitions only, still Node 24.

## [0.1.0-preview.2] - 2026-09-17

The second preview. It adds three Bibles and the three interface languages
that go with them, so the reader again speaks every language it holds a Bible
in — and the reviewers for Portuguese and Chinese have something to review.

**Try it:** <https://alanroman117.github.io/Scriptura/>

### Added

- **Three more Bibles, in two new languages.** The Chinese Union Version of 1919 in both scripts (`cuvs` simplified, `cuvt` traditional) and the Brazilian **Bíblia Livre** (`blivre`), all from eBible. Chinese scripture gets its own font stacks, by script, so characters shared with Japanese are drawn the way Chinese readers write them.
- **CC BY 4.0** joins the licences the project accepts. Bíblia Livre is the first text under it, and it shows its attribution beside the text, as the Spanish VBL does.
- **Three more interface languages**, so the reader again speaks every language it holds a Bible in: **Português (Brasil)**, **中文（简体）** and **中文（繁體）**. The browser chooses, or Settings does. Chinese is chosen by script — a browser reporting Taiwan, Hong Kong or Macau gets Traditional — and the two Chinese catalogs are separate texts rather than a character conversion, because Taiwan and the mainland use different words for the same things. A reader in Chinese is offered both Bibles, their own script first.
- **A correction form for each new language** (`.github/ISSUE_TEMPLATE/translation-pt.yml`, `-zh-hans.yml`, `-zh-hant.yml`), written in it, linked from the preview notice and from Help.

### Notes

- **No Korean Bible yet, and the reason is written down.** The texts offered as "Korean Bible 1910" by eBible and CrossWire are the 개역한글판 of 1952/1961: public domain in Korea since 2012, and restored in the United States by the URAA until 2056 — the same trap as the Japanese Kougo text. `docs/translations-status.md` shows the verse-by-verse check, and the validator now refuses it.
- The interface and the library now name the same seven languages again. The test that names any Bible language still waiting for an interface passes with nothing to name, and stays in place for the next one.

## [0.1.0-preview.1] - 2026-09-17

The first release. It is a preview for the people reviewing the reader's
interface in Spanish, French and Japanese.

**Try it:** <https://alanroman117.github.io/Scriptura/>

### Added

- **Eleven Bible translations** in one canonical JSON format, each with a verified licence:
  - English: King James Version, World English Bible, Berean Standard Bible, American Standard Version and Young's Literal Translation.
  - Spanish: Reina Valera 1909 and Versión Biblia Libre.
  - French: Louis Segond 1910, Bible Ostervald and Bible Martin.
  - Japanese: 文語訳聖書 (Classical).

  All are in the public domain except Versión Biblia Libre (CC BY-SA 4.0).
- **TypeScript packages:**
  - `@scriptura/core` loads translations and resolves book names in any of their languages.
  - `@scriptura/search` and `@scriptura/compare` search and compare them.
  - `@scriptura/validate` checks the data.
  - `@scriptura/api` is a REST router with no framework.

  A static build of the same API gives identical JSON.
- **The reader**, a web app that keeps everything on the device and works offline:
  - reading, searching and comparing translations, each downloaded when wanted;
  - notes in Markdown, with quotes of and links to passages;
  - colour collections of marked verses;
  - boards that lay verses and notes out as cards;
  - export to a zip of Markdown files;
  - optional tools for AI assistants (WebMCP), which can only propose changes.
- **Four interface languages:** English (United States), Spanish (Mexico), French (France) and Japanese. The reader follows the browser's language, and Settings can change it.
- **Accessibility.** The reader's interface aims at WCAG 2.2 Level AAA. Automated checks cover it on every change.
- **Asking before deleting.** Deleting a note or board, and removing a card, mark or translation, first asks in a dialog that names what will go.
- **The preview site** on GitHub Pages. It shows a link for reporting a translation correction, and each language has its own issue form.

### Not yet done

- **Native review** of the Spanish, French and Japanese interface text. This preview exists for it.
- **Checks by hand** on real phones, with screen readers, and in Windows high-contrast mode.
- **Planned, not built:** GraphQL, the hosted JSON API and the AWS deployment.

[0.1.0-preview.5]: https://github.com/AlanRoman117/Scriptura/releases/tag/v0.1.0-preview.5
[0.1.0-preview.4]: https://github.com/AlanRoman117/Scriptura/releases/tag/v0.1.0-preview.4
[0.1.0-preview.3]: https://github.com/AlanRoman117/Scriptura/releases/tag/v0.1.0-preview.3
[0.1.0-preview.2]: https://github.com/AlanRoman117/Scriptura/releases/tag/v0.1.0-preview.2
[0.1.0-preview.1]: https://github.com/AlanRoman117/Scriptura/releases/tag/v0.1.0-preview.1
