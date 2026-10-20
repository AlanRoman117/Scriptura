# Language review: a guide for each reviewer

One guide for each language the reader's interface speaks. Each is for the person who reads that language and is checking the words: what to look at first, a picture of every screen with every text that belongs to it, what to try in the app itself, and room for their notes.

| Language | Guide | Register | Correction form |
|---|---|---|---|
| English (United States) | [en-US.md](en-US.md) | plain, second person | [form](https://github.com/AlanRoman117/Scriptura/issues/new?template=translation-en.yml) |
| Español (México) | [es-MX.md](es-MX.md) | tú | [form](https://github.com/AlanRoman117/Scriptura/issues/new?template=translation-es.yml) |
| Français (France) | [fr-FR.md](fr-FR.md) | vous | [form](https://github.com/AlanRoman117/Scriptura/issues/new?template=translation-fr.yml) |
| 日本語 (日本) | [ja-JP.md](ja-JP.md) | です・ます | [form](https://github.com/AlanRoman117/Scriptura/issues/new?template=translation-ja.yml) |
| Português (Brasil) | [pt-BR.md](pt-BR.md) | você | [form](https://github.com/AlanRoman117/Scriptura/issues/new?template=translation-pt.yml) |
| 中文（简体） | [zh-Hans.md](zh-Hans.md) | plain, second person | [form](https://github.com/AlanRoman117/Scriptura/issues/new?template=translation-zh-hans.yml) |
| 中文（繁體） | [zh-Hant.md](zh-Hant.md) | plain, second person | [form](https://github.com/AlanRoman117/Scriptura/issues/new?template=translation-zh-hant.yml) |

The app itself: <https://alanroman117.github.io/Scriptura/>. Who reviews what, and how far each has got, is in [the interface-language plan](../plans/reader-i18n/README.md#review).

## For a reviewer

Open your language's guide and start at the top. It is in three parts, and the first takes a quarter of an hour. Write what should change in **Your notes** at the end of the file and send it back, or use the correction form.

## For whoever maintains these

The guides are written by `scripts/language-review.ts` from the catalogs in `apps/reader/src/i18n/messages/`, so they say what the app says. Do not edit a guide above its line marked `YOURS`: the next writing would undo it.

```bash
npm run review:docs     # write the guides again from the catalogs
npm run review:guide    # take the pictures again, then write the guides
```

- **When a text changes**, run `npm run review:docs`. `npm test` fails until you do, so a guide is never behind the app.
- **When a screen changes**, run `npm run review:guide`. It needs Chromium (`npx playwright install chromium`), and makes the pictures smaller with ImageMagick if `magick` is installed.
- **What a reviewer wrote is kept**: everything under `YOURS`, and every box they ticked whose words have not changed.
- **When corrections come back**, apply them to the catalog file, run both commands, and mark the row in the plan.

The pictures are cropped to the part of the page a section is about, so the words are their real size where GitHub shows the guide. They are taken with a Bible in the reviewer's language open, the one the app offers a new reader first.
