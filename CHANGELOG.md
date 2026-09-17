# Changelog

All notable changes to Scriptura are recorded here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow
[Semantic Versioning](https://semver.org/). A preview carries a `-preview.N`
suffix and is published as a GitHub pre-release.

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

[0.1.0-preview.1]: https://github.com/AlanRoman117/Scriptura/releases/tag/v0.1.0-preview.1
