# Reader: the interface in every language the Bibles are in

The reader's interface speaks the four languages of the Bibles it offers:

| Tag | Picker label | Register | Quotes | Copy |
|---|---|---|---|---|
| `en-US` | English (United States) | plain, second person | “ ” | source |
| `es-MX` | Español (México) | tú | “ ” | drafted; **owner review pending** |
| `fr-FR` | Français (France) | vous | « » with no-break spaces | drafted; **native review pending** |
| `ja-JP` | 日本語 (日本) | です・ます | 「」 | drafted; **native review pending** |

Each tag is built from subtags in the [IANA Language Subtag Registry](https://www.iana.org/assignments/language-subtag-registry), written in canonical case. The page's `lang` is always one of them, so a screen reader picks the right voice.

**Release waits on the three reviews** in [Review](#review).

## Decided with the owner

- **No new package.** Typed message catalogs plus the browser's `Intl`.
- **Interface languages are the Bible languages.** The regions for French and Japanese are assumptions: the French Bibles are European, and Bungo is Japanese.
- **Detect, then offer.** The first of the browser's languages the app has sets the interface. None of them means English. A setting overrides it. A non-English interface with no Bible in its language installed is offered every Bible in that language.
- **Review.** The owner reviews English and Spanish. A native speaker reviews French and another reviews Japanese.

## How it works

| Piece | Where | What it does |
|---|---|---|
| Tags and matching | `apps/reader/src/i18n/locales.ts` | The four tags, their labels, and `matchLocale`, which walks the browser's languages in order and matches on the primary subtag, so `fr-CA` gets French. |
| Catalogs | `apps/reader/src/i18n/messages/*.ts` | Every string the interface shows or speaks. English is the source; the other three `satisfies Messages`, so a missing key fails the build. Numbers and names go in through functions, so each language keeps its own word order. |
| Formatting | `apps/reader/src/i18n/format.ts` | Plurals, numbers, percentages, sizes, lists and language names, through `Intl` and bound to the locale. |
| Markup | `apps/reader/src/i18n/rich.tsx` | `` `code` ``, `**bold**`, `*italic*` and `{{Key}}` inside catalog text, turned into elements, never HTML. `withSlots` places an element, such as a count, where each language wants it. |
| French spacing | `apps/reader/src/i18n/typography.ts` | The French catalog is written with ordinary spaces. This step adds the no-break space before `:` and inside « », and the narrow one before `; ! ?`. It leaves alone what a message quotes: a note or board name keeps the spacing its author typed. |
| Preference | `apps/reader/src/lib/prefs.ts`, `index.html` | `language` is `system` or a tag. The inline script sets `lang` before first paint; `I18nRoot` keeps it current and announces a change in the new language. |
| The offer | `apps/reader/src/lib/offer.ts`, `components/BibleOffer.tsx` | Bibles in the interface language, with size, "Download and read", "All translations" and "Not now". "Not now" is remembered per language in `localStorage`. |
| Type | `apps/reader/src/styles.css` | `:lang(ja)` switches to the system's Japanese faces; text in another language inside it goes back to the Latin stacks. |

**Language of parts (3.1.2).** A Bible's `lang` goes on its text: the verse text, a comparison column's text, a card's body, a result's text. It never goes on a container that also holds an interface control, because the control's name would then be spoken in the Bible's voice. Book and translation names are proper names and carry no `lang`.

**Stored names.** A new note or board stores an empty name, and every screen shows "Untitled" in the current language. A stored English word would stay English. Exports write the placeholder in the interface language. The folder mirror names untitled notes by id, so a language switch never leaves a second copy behind.

**What stays English.** The assistant tools' names and descriptions, which Settings marks `lang="en"`. Console messages and stored ids also stay English.

## Adding a string

1. Add the key to `messages/en-US.ts`. Use a function for anything that carries a number or a name, and `plural()` for counts, never `n === 1`.
2. `tsc -b` now fails until the key is in `es-MX.ts`, `fr-FR.ts` and `ja-JP.ts`. Add it to all three.
3. Read it in the component with `const { t } = useI18n()`. `tests/unit/i18n-strings.test.ts` fails on English written straight into a component.
4. If a noun's gender changes the words, give each noun its own key, as `notes.new` and `canvas.new` do.
5. Run `npm test` and `npm run test:reader`. Then run `npm run review:screens` and check the new text in all four languages.

## Tests

- **`tests/unit/i18n.test.ts`:**
  - tags against the registry records;
  - matching;
  - plurals and grouping per language;
  - catalog parity and no empty strings;
  - French spacing, checked on everything the catalog can produce, with planted slips, and shown to leave quoted names as they were;
  - Japanese punctuation;
  - help examples.
- **`tests/unit/i18n-strings.test.ts`:** no English written into a component, with planted slips.
- **`tests/unit/prefs.test.ts`:** the inline script and the module agree on how the language is resolved.
- **`tests/unit/offer.test.ts`:** which Bibles are offered.
- **`tests/reader/i18n.spec.ts`:**
  - `lang` with the app's script blocked, from the device and from a stored choice;
  - detection for eight browser languages;
  - the picker;
  - switching and its announcement;
  - Spanish, French and Japanese text;
  - Japanese type;
  - grouped counts.
- **`tests/reader/language-of-parts.spec.ts`:** both sides of the language boundary in seven states, with planted slips.
- **`tests/reader/bible-offer.spec.ts`:** the offer, download-and-read, "Not now", offline failure, and none in English.
- **`tests/reader/confirm.spec.ts`:** the delete confirmation asks, names its buttons and reports the deletion in each language.
- **In the other three languages:** axe in twelve desktop states (`a11y.spec.ts`), and the phone's target, reflow and text-spacing gates in nine states (`gates.spec.ts`), the delete confirmation among them.

## Review

Generate the screenshots, then send each reviewer their folder and their catalog file:

```bash
npm run review:screens     # writes review-screenshots/<language>/<device>-<screen>.png
```

| Language | Reviewer | Status |
|---|---|---|
| English (United States) | owner | source text |
| Español (México) | owner | open |
| Français (France) | to be found | open |
| 日本語 (日本) | to be found | open |

**Checklist for a reviewer.**

- [ ] Every word is correct and sounds natural, not translated.
- [ ] Bible terms are the ones readers in that language expect (see the glossary).
- [ ] The register is consistent: *tú* in Spanish, *vous* in French, です・ます in Japanese.
- [ ] Sentences are short and plain (3.1.5 for interface text).
- [ ] Nothing is cut off, overlaps or wraps badly in the screenshots.
- [ ] Punctuation, numbers and plurals follow the language.
- [ ] The Help screen reads well, glossary and accessibility statement included.
- [ ] The delete confirmation (`delete-confirm` screenshots) says plainly what will go and whether it can come back. The other confirmations (board, card, mark, translation) are the `confirm` section of the catalog.
- [ ] With a screen reader: the interface is spoken in the language, and a Bible in another language switches voice (brief 92).

Corrections come back as notes, a marked-up copy or edits to the catalog file. Apply them, rerun the tests, regenerate the screenshots, and mark the row above.

## Glossary

| English | Español (México) | Français (France) | 日本語 |
|---|---|---|---|
| Notes / note | Notas / nota | Notes / note | ノート |
| Marks / mark (verb) | Marcas / marcar | Marques / marquer | マーク / マークする |
| Collection | Colección | Collection | コレクション |
| Board | Tablero | Tableau | ボード |
| Card | Tarjeta | Fiche | カード |
| Connection | Conexión | Connexion | つながり |
| Quote | Citar | Citer | 引用 |
| Link | Enlazar | Lier | リンク |
| Canvas (put on a board) | Al tablero | Au tableau | ボードへ |
| Translation | Traducción | Traduction | 翻訳・訳 |
| Scripture | Escrituras | Texte biblique | 聖書本文 |
| Passage | Pasaje | Passage | 箇所 |
| Book / chapter / verse | Libro / capítulo / versículo | Livre / chapitre / verset | 書 / 章 / 節 |
| Search | Buscar | Rechercher | 検索 |
| Whole words only | Solo palabras completas | Mots entiers uniquement | 単語単位で検索 |
| Match case | Distinguir mayúsculas | Respecter la casse | 大文字と小文字を区別 |
| Settings | Configuración | Paramètres | 設定 |
| Help | Ayuda | Aide | ヘルプ |
| Export | Exportar | Exporter | エクスポート |
| Preview / Write | Vista previa / Escribir | Aperçu / Écrire | プレビュー / 編集 |
| Delete / Remove | Eliminar / Quitar | Supprimer / Retirer | 削除 |
| Delete the note “…”? (the confirmation) | ¿Eliminar la nota “…”? | Supprimer la note « … » ? | ノート「…」を削除しますか？ |
| You cannot undo this. | No se puede deshacer. | Vous ne pourrez pas annuler. | この操作は元に戻せません。 |
| Untitled | Sin título | Sans titre | 無題 |
| Bold / Italic glyphs | N / K | G / I | B / I |

## Known limits

- **Typing a reference in the interface language** works only when the open Bible uses those book names. "Jean 3:16" resolves in LSG 1910, not in BSB. The search placeholder and the help examples therefore use the open Bible's own name for John. Resolving names across installed Bibles is a follow-up.
- **A live language switch and screen readers.** Some readers may keep the previous voice until the page reloads. The change is announced after `lang` updates, and brief 92 checks it.
- **Metadata stays as published.** Translation names and attributions come from `data/*/metadata.json`: "文語訳聖書 (Classical)" carries English, and the VBL attribution mixes Spanish and English.
- **OT and NT** are English abbreviations; the help table explains them in each language.
- **The web app manifest** names the app "Scriptura Reader" in every language.
