# Changelog

All notable changes to Scriptura are recorded here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow
[Semantic Versioning](https://semver.org/). A preview carries a `-preview.N`
suffix and is published as a GitHub pre-release.

## [Unreleased]

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

[0.1.0-preview.2]: https://github.com/AlanRoman117/Scriptura/releases/tag/v0.1.0-preview.2
[0.1.0-preview.1]: https://github.com/AlanRoman117/Scriptura/releases/tag/v0.1.0-preview.1
