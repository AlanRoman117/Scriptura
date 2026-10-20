/**
 * The guides in docs/human-language-review: one for each interface language,
 * for the person who reads that language and is checking the reader's words.
 *
 * A guide is written from the catalogs themselves, so it cannot say something
 * the app does not: every text the interface shows or speaks is in a table,
 * English beside the translation, under a picture of the screen it belongs to
 * (tests/review/guide.spec.ts takes the pictures). The first pass is short
 * and comes first: the voice, the words used everywhere, numbers and plurals.
 *
 *   npm run review:docs     the guides, from the catalogs as they are now
 *   npm run review:guide    the pictures again, then the guides
 *
 * What a reviewer writes is kept: everything under the line that says it is
 * theirs, and every box they ticked above it. `tests/unit/language-review.test.ts`
 * fails when a catalog has changed and the guides have not been written again.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { CATALOGS } from '../apps/reader/src/i18n/catalogs';
import { formattersFor } from '../apps/reader/src/i18n/format';
import { LOCALES, LOCALE_LABELS, primaryLanguage, type Locale } from '../apps/reader/src/i18n/locales';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const OUT = join(ROOT, 'docs', 'human-language-review');
const SITE = 'https://alanroman117.github.io/Scriptura/';
const FORMS = 'https://github.com/AlanRoman117/Scriptura/issues/new?template=';

/** Everything from this line down belongs to the reviewer and is never rewritten. */
export const YOURS = '<!-- YOURS: everything below this line is kept when the guide is written again. -->';

/* ── Each language ─────────────────────────────────────────────────────── */

interface Language {
  /** Its name in English, for the people who maintain the guides. */
  english: string;
  /** The Bible the pictures are taken with, and whose book names the examples use. */
  bible: string;
  /** The other translation in the comparison picture. */
  other: string;
  /** A word searched for in the pictures. */
  word: string;
  /** The correction form on GitHub. */
  form: string;
  /** What to hold the whole text to, before any screen is looked at. */
  voice: string[];
}

const LANGUAGES: Record<Locale, Language> = {
  'en-US': {
    english: 'English (United States)',
    bible: 'bsb',
    other: 'kjv',
    word: 'light',
    form: 'translation-en.yml',
    voice: [
      'Plain words and short sentences, spoken to the reader as "you". Nothing a reader of the Bible would need a computer manual to understand.',
      'A button says what it does ("Delete note"), in sentence case, without a full stop.',
      'One word for one thing, everywhere: a note is always a note, a board always a board.',
      'American spelling and punctuation.',
    ],
  },
  'es-MX': {
    english: 'Spanish (Mexico)',
    bible: 'rv1909',
    other: 'bsb',
    word: 'luz',
    form: 'translation-es.yml',
    voice: [
      'The reader is addressed as *tú* throughout: never *usted*, never *vosotros*.',
      'Mexican Spanish where it differs from Spain\'s (*computadora*, not *ordenador*).',
      'Opening ¿ and ¡ where they belong, and quotation marks “ ”.',
      'It sounds like someone writing in Spanish, not like a translation from English.',
    ],
  },
  'fr-FR': {
    english: 'French (France)',
    bible: 'lsg1910',
    other: 'bsb',
    word: 'lumière',
    form: 'translation-fr.yml',
    voice: [
      'The reader is addressed as *vous* throughout: never *tu*.',
      'Guillemets « » and a space before `:` `;` `!` `?`. The app adds the no-break spaces itself: check that they fall in the right places.',
      'A French word where one is in use, not an anglicism.',
      'It reads as written French, not as a translation from English.',
    ],
  },
  'ja-JP': {
    english: 'Japanese (Japan)',
    bible: 'bungo',
    other: 'bsb',
    word: '光',
    form: 'translation-ja.yml',
    voice: [
      'The です・ます style throughout.',
      'Corner brackets 「」 and full-width punctuation (、。：？), with no half-width mark straight after Japanese text.',
      'Loanwords in katakana and native words are chosen the same way each time (ノート, ボード, マーク).',
      'It reads as natural Japanese, not as a literal translation from English.',
    ],
  },
  'pt-BR': {
    english: 'Portuguese (Brazil)',
    bible: 'blivre',
    other: 'bsb',
    word: 'luz',
    form: 'translation-pt.yml',
    voice: [
      'The reader is addressed as *você* throughout.',
      'Brazilian Portuguese in vocabulary and spelling, not Portugal\'s (*tela*, not *ecrã*; *arquivo*, not *ficheiro*).',
      'Quotation marks “ ”.',
      'It sounds like someone writing in Portuguese, not like a translation from English.',
    ],
  },
  'zh-Hans': {
    english: 'Chinese (Simplified)',
    bible: 'cuvs',
    other: 'bsb',
    word: '光',
    form: 'translation-zh-hans.yml',
    voice: [
      'The reader is addressed as 你, in a plain, even tone.',
      'The words are the ones readers in mainland China use (搜索, 设置, 保存, 导出, 文件夹, 帮助).',
      'Full-width punctuation (，。：？) and quotation marks “ ”, with no half-width mark straight after Chinese text.',
      'It reads as natural Chinese, not as a literal translation from English.',
    ],
  },
  'zh-Hant': {
    english: 'Chinese (Traditional)',
    bible: 'cuvt',
    other: 'bsb',
    word: '光',
    form: 'translation-zh-hant.yml',
    voice: [
      'The reader is addressed as 你, in a plain, even tone.',
      'The words are the ones readers in Taiwan use (搜尋, 設定, 儲存, 匯出, 資料夾, 說明). This is its own text, not Simplified converted character by character: if a phrase reads like mainland Chinese in traditional characters, say so.',
      'Full-width punctuation (，。：？) and corner brackets 「」, with no half-width mark straight after Chinese text.',
      'It reads as natural Chinese, not as a literal translation from English.',
    ],
  },
};

/* ── Each part of the app, in the order a reader meets it ──────────────── */

interface Section {
  title: string;
  /** What this part of the app is, in a sentence, for someone who has not used it. */
  about: string;
  /** Pictures: file name without its extension, and what it shows. */
  pictures: [string, string][];
  /** What to look at in the pictures, beyond the words being right. */
  look: string[];
  /** For the English guide, where English is shown something else: captions by picture, and its own checklist. */
  english?: { captions?: Record<string, string>; look?: string[] };
  /** The top-level sections of the catalog whose texts belong here. */
  keys: string[];
}

const TIERS: { title: string; note: string; sections: Section[] }[] = [
  {
    title: 'What every reader sees',
    note: 'If time is short, these four screens matter most: they are the app on an ordinary day.',
    sections: [
      {
        title: 'The first visit, and reading a chapter',
        about:
          'The bar across the top chooses the book, the chapter and the translation, and opens Marks, Settings and Help. A reader whose language is not English is first offered a Bible in it.',
        pictures: [
          ['01-first-visit', 'What a new reader sees: the offer of a Bible in this language, over the English one the app arrives with.'],
          ['14-phone-reading', 'The same, on a phone, once a Bible in this language is open.'],
        ],
        look: [
          'The offer reads as an invitation, and its buttons are clear about what they will do.',
          'Nothing in the bar is cut short or squeezed, on the phone above all.',
        ],
        english: {
          captions: { '01-first-visit': 'What a new reader sees: the English Bible the app arrives with. A reader of English is offered nothing first.' },
          look: ['Nothing in the bar is cut short or squeezed, on the phone above all.'],
        },
        keys: ['app', 'reader', 'panels', 'common', 'offer'],
      },
      {
        title: 'Selecting verses and acting on them',
        about:
          'Pressing a verse selects it and opens a row of actions: five colours to mark it with, then Quote, Link and Canvas. Pressing more verses adds them, and the row says how many it holds.',
        pictures: [
          ['02-one-verse', 'One verse selected.'],
          ['03-several-verses', 'Three verses selected, two of them together and one apart: the row says so, and offers to take in the verses between.'],
          ['15-phone-several-verses', 'On a phone the row sits at the bottom of the screen.'],
        ],
        look: [
          'The summary ("3 verses · …") and the button beside it fit on one line.',
          'The three words for the actions are short enough to sit side by side on a phone.',
        ],
        keys: ['verseActions', 'colours', 'colourWords'],
      },
      {
        title: 'Notes',
        about:
          'The pane beside the Bible, where a reader writes. A quoted passage arrives with its reference, and a line under the note says what was just done and whether it is saved.',
        pictures: [
          ['04-note', 'A new note with three verses quoted into it.'],
          ['16-phone-note', 'On a phone the notes are a sheet that slides up over the text.'],
        ],
        look: [
          'The formatting buttons carry one or two letters each (bold, italic, headings): they should be the letters a writer in this language expects.',
          'The line under the note ("Quoted …", "Saved") reads as a short report, not a sentence cut in two.',
        ],
        keys: ['notes', 'tools', 'insert', 'preview'],
      },
      {
        title: 'Search',
        about:
          'One box does two things: a reference goes straight to the passage, anything else searches the open Bible. The short list under the box is for jumping; the full list counts every match, book by book.',
        pictures: [
          ['05-search-suggestions', 'The suggestions under the box.'],
          ['06-search-results', 'Every match, with the count for each book.'],
        ],
        look: [
          'The counts read naturally with a small number and with a large one.',
          'The two options ("Whole words only", "Match case") are understood without explanation.',
        ],
        keys: ['search', 'results'],
      },
    ],
  },
  {
    title: 'The panels',
    note: 'Opened from the bar. They take the place of the chapter while they are open.',
    sections: [
      {
        title: 'Marks',
        about: 'Each of the five colours is a collection of the verses marked with it, and can be given a name of the reader’s own.',
        pictures: [['07-marks', 'Three marked verses in two collections.']],
        look: ['The colour names are the everyday words for those colours.'],
        keys: ['marks'],
      },
      {
        title: 'Translations, and reading two side by side',
        about: 'Where a Bible is downloaded, read, compared with the one being read, or removed. Each shows its size before it is downloaded.',
        pictures: [
          ['08-translations', 'The list of translations, by language.'],
          ['09-comparison', 'Two translations, verse by verse.'],
        ],
        look: ['The language headings are how this language names those languages.', 'The note about what removing a translation does and does not touch is plain.'],
        keys: ['library', 'compare'],
      },
      {
        title: 'Settings',
        about: 'How the text looks, the interface language, where the reader’s work is kept, and whether an assistant may help.',
        pictures: [
          ['10-settings', 'The top of Settings.'],
          ['10-settings-middle', 'Further down.'],
          ['10-settings-end', 'The end.'],
        ],
        look: [
          'Each label and the choices under it read as one thought.',
          'The style names are evocative, not literal (Vellum, Emerald, Nocturne): they should sound like names, not descriptions.',
          'The explanations in smaller type are complete sentences and easy to follow.',
        ],
        keys: ['settings'],
      },
      {
        title: 'Help',
        about: 'The longest text in the app, and the one a reader turns to when stuck. It includes a list of terms and abbreviations, and a statement about accessibility.',
        pictures: [['11-help', 'The top of Help.']],
        look: [
          'It reads well from start to finish as an explanation, not as a list of translated sentences.',
          'The examples of references are ones that work in a Bible in this language.',
          'The names of keys (Enter, Shift, Escape) are how this language’s keyboards and manuals name them.',
        ],
        keys: ['help'],
      },
    ],
  },
  {
    title: 'Met less often',
    note: 'Boards, the questions asked before something is deleted, and the notices. Many of these texts are spoken by a screen reader and never shown.',
    sections: [
      {
        title: 'Boards (the canvas)',
        about: 'A surface where verses and notes are laid out as cards and joined with arrows. Most of its texts are the names of buttons, heard by a screen reader.',
        pictures: [['12-board', 'Two verses on a board, with the list of connections open.']],
        look: ['The words for a board, a card and a connection are used the same way here as everywhere else.'],
        keys: ['canvas', 'cards', 'embed'],
      },
      {
        title: 'Questions before something is deleted',
        about: 'Deleting a note or a board, or removing a card, a mark or a translation, asks first. The question names what will go, and says whether it can come back.',
        pictures: [['13-delete-confirm', 'The question before a note is deleted.']],
        look: ['It is unmistakable what will be deleted and that it cannot be undone.', 'The button that deletes says what it deletes.'],
        keys: ['confirm'],
      },
      {
        title: 'Notices',
        about: 'A line about where the reader’s work is kept, the offer of a newer version, and the notice on this preview.',
        pictures: [],
        look: ['The notice about storage is honest without being alarming.'],
        keys: ['durability', 'update', 'previewBuild'],
      },
      {
        title: 'Panes, tabs and the sheet',
        about: 'The names of the two panes, the tabs that choose between notes and a board, and the buttons that resize them. Mostly heard, not seen.',
        pictures: [],
        look: [],
        keys: ['layout'],
      },
      {
        title: 'What an assistant proposes',
        about: 'When the reader has allowed an assistant to help, what it wants to add is shown first and waits for a yes.',
        pictures: [],
        look: [],
        keys: ['proposal'],
      },
    ],
  },
];

/* ── Reading the repository ────────────────────────────────────────────── */

const read = (...path: string[]) => readFileSync(join(ROOT, ...path), 'utf8');

/** A Bible's own name for John, and for itself. */
function bibleOf(id: string) {
  const meta = JSON.parse(read('data', id, 'metadata.json')) as { name: string };
  const john = JSON.parse(read('data', id, 'books', '43-john.json')) as { name: string; abbreviation: string };
  return { id: id.toUpperCase(), name: meta.name, john: john.name, abbr: john.abbreviation };
}

/** The glossary and the register of each language, from the interface-language plan. */
function plan() {
  const text = read('docs', 'plans', 'reader-i18n', 'README.md');
  const rows = (line: string) => line.split('|').slice(1, -1).map((cell) => cell.trim());
  const tables: string[][][] = [];
  let table: string[][] | null = null;
  for (const line of text.split('\n')) {
    if (line.startsWith('|')) (table ??= (tables.push([]), tables[tables.length - 1])).push(rows(line));
    else table = null;
  }
  const glossary: Record<string, Record<string, string>> = {};
  const register: Record<string, { register: string; quotes: string }> = {};
  for (const [head, , ...body] of tables) {
    if (head[0] === 'Tag') {
      for (const [tag, , reg, quotes] of body) register[tag.replace(/`/g, '')] = { register: reg, quotes };
    }
    if (head[0] === 'English') {
      const columns = head.slice(1).map((label) => (Object.entries(LOCALE_LABELS).find(([, l]) => label.startsWith(l.split(' ')[0])) ?? [])[0]);
      for (const [english, ...cells] of body) {
        columns.forEach((locale, i) => {
          if (locale) (glossary[locale] ??= {})[english] = cells[i];
        });
      }
    }
  }
  return { glossary, register };
}

/**
 * The note a developer left above each text in the English catalog: what it
 * is for, and whether it is shown or only said. The best context a reviewer
 * can have, and it is already written.
 */
function notes(): Map<string, string> {
  const path = join(ROOT, 'apps', 'reader', 'src', 'i18n', 'messages', 'en-US.ts');
  const source = ts.createSourceFile(path, readFileSync(path, 'utf8'), ts.ScriptTarget.Latest, true);
  const found = new Map<string, string>();
  const comment = (node: ts.Node) =>
    (ts.getLeadingCommentRanges(source.text, node.getFullStart()) ?? [])
      .map((r) => source.text.slice(r.pos, r.end))
      .map((c) => c.replace(/^\/\*+|\*+\/$/g, '').replace(/^\s*(\*|\/\/)\s?/gm, '').replace(/\s+/g, ' ').trim())
      .filter(Boolean)
      .join(' ');
  const walk = (object: ts.ObjectLiteralExpression, path: string) => {
    for (const property of object.properties) {
      if (!property.name || !ts.isIdentifier(property.name)) continue;
      const key = path ? `${path}.${property.name.text}` : property.name.text;
      const said = comment(property);
      if (said) found.set(key, said);
      if (ts.isPropertyAssignment(property) && ts.isObjectLiteralExpression(property.initializer)) walk(property.initializer, key);
    }
  };
  ts.forEachChild(source, (node) => {
    if (!ts.isVariableStatement(node)) return;
    for (const declaration of node.declarationList.declarations) {
      const value = declaration.initializer && ts.isSatisfiesExpression(declaration.initializer) ? declaration.initializer.expression : declaration.initializer;
      if (ts.isIdentifier(declaration.name) && declaration.name.text === 'enUS' && value && ts.isObjectLiteralExpression(value)) walk(value, '');
    }
  });
  return found;
}

/* ── Examples for the texts that carry a name or a number ──────────────── */

// The catalogs are read here by name, as data: their own type would make every example a cast.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Words = Record<string, any>;

/** What the examples are about, in one language: its Bible's names, its own words and number forms. */
function world(locale: Locale) {
  const t = CATALOGS[locale] as unknown as Words;
  const fmt = formattersFor(locale);
  const bible = bibleOf(LANGUAGES[locale].bible);
  const other = bibleOf(LANGUAGES[locale].other);
  const verse = `${bible.john} 1:2`;
  const passage = `${bible.john} 1:3-5`;
  const [first, second] = [`${bible.john} 1:1`, `${bible.john} 1:14`];
  const colourName = t.canvas.colourName(t.colours.amber, t.colourWords.amber) as string;
  const edge = t.canvas.edge(first, second) as string;
  return { locale, t, fmt, bible, other, verse, passage, first, second, colourName, edge, title: `${bible.john} 1`, word: LANGUAGES[locale].word };
}
type World = ReturnType<typeof world>;

/** One value for a parameter, by its name: the names in the catalog are consistent enough to go by. */
function value(name: string, w: World): unknown {
  const { t, fmt } = w;
  const values: Record<string, unknown> = {
    ref: w.verse,
    where: w.passage,
    span: '3-18',
    example: `${w.bible.john} 3:16`,
    book: w.bible.john,
    chapter: 1,
    verse: 16,
    id: w.bible.id,
    translation: w.bible.name,
    name: w.title,
    note: w.title,
    board: w.title,
    title: w.first,
    card: w.first,
    label: w.first,
    from: w.first,
    to: w.second,
    edge: w.edge,
    kind: t.canvas.verseCard,
    mode: t.canvas.adjustTitle,
    collection: t.colours.amber,
    colour: t.colourWords.amber,
    pane: t.layout.paneBible,
    panel: t.panels.settings,
    action: t.layout.expandNotes,
    news: t.insert.quoted(w.passage),
    done: t.insert.quoted(w.passage),
    bible: fmt.percent(56),
    notes: fmt.percent(44),
    percent: fmt.percent(50),
    used: fmt.bytes(12_400_000),
    quota: fmt.bytes(2_000_000_000),
    size: fmt.bytes(5_700_000),
    query: w.word,
    error: t.library.offline,
    language: fmt.languageWord(primaryLanguage(w.locale)), // as BibleOffer names it
    version: '0.1.0',
    level: 2,
    block: 3,
    shown: 40,
    x: 320,
    y: 180,
    w: 280,
    h: 180,
  };
  if (!(name in values)) throw new Error(`No example for a parameter called "${name}". Add one to value() in scripts/language-review.ts.`);
  return values[name];
}

/** Where a parameter's name is not enough: the same name means a note here and a translation there. */
const SPECIAL: Record<string, (w: World) => unknown[][]> = {
  'app.title': (w) => [[w.t.app.passageTitle(w.bible.john, 1, w.bible.id)]],
  'common.source': (w) => [[w.bible.name]],
  'reader.translationChip': (w) => [[w.bible.id, w.bible.name]],
  'reader.marksChip': () => [[7]],
  'reader.selection': (w) => [[1, `${w.bible.john} 1:3`], [3, w.passage]],
  'verseActions.groupMany': (w) => [[1, `${w.bible.john} 1:3`], [3, w.passage]],
  'verseActions.summary': (w) => [[1, `${w.bible.john} 1:3`], [3, w.passage]],
  'insert.quoted': (w) => [[w.passage]],
  'insert.quotedFrom': (w) => [[w.passage, w.bible.id]],
  'insert.linked': (w) => [[w.passage]],
  'insert.addedToBoard': (w) => [[w.passage, w.title]],
  'insert.alreadyOnBoard': (w) => [[w.passage, w.title]],
  'search.seeAll': () => [[1382]],
  'results.showing': () => [[100, 1382]],
  'results.more': () => [[100]],
  'library.onDevice': () => [[2]],
  'library.downloading': (w) => [[w.bible.name]],
  'library.removeActive': (w) => [[w.bible.name]],
  'library.removeFromDevice': (w) => [[w.bible.name]],
  'library.progress': (w) => [[w.bible.name, w.fmt.percent(50)]],
  'library.downloaded': (w) => [[w.bible.name]],
  'library.failed': (w) => [[w.bible.name, w.t.library.offline]],
  'offer.downloadAndReadName': (w) => [[w.bible.name]],
  'confirm.translation.title': (w) => [[w.bible.name]],
  'confirm.translation.done': (w) => [[w.bible.name]],
  'compare.stop': (w) => [[w.other.id]],
  'compare.missing': (w) => [[w.other.id]],
  'compare.quote': (w) => [[w.other.id, 16]],
  'notes.linkIn': (w) => [[w.passage, w.other.id]],
  'notes.linkMissing': (w) => [[w.passage, w.other.id]],
  'settings.assistantTools': () => [[9]],
  'canvas.connections': () => [[2]],
  'canvas.zoomReset': (w) => [[w.fmt.percent(120)]],
  'canvas.undo': (w) => [[{ kind: 'card', label: w.first }], [{ kind: 'connection', label: w.edge }]],
  'canvas.putBack': (w) => [[{ kind: 'card', label: w.first }], [{ kind: 'connection', label: w.edge }]],
  'canvas.removed': (w) => [[{ kind: 'card', label: w.first }], [{ kind: 'connection', label: w.edge }]],
  'canvas.cardName': (w) => [[w.t.canvas.verseCard, w.first, w.colourName], [w.t.canvas.verseCard, w.first, null]],
  'canvas.colour': (w) => [[w.colourName, w.first], [null, w.first]],
  'canvas.coloured': (w) => [[w.first, w.colourName]],
};

/** The names of a function's parameters, read from the function itself. */
function parameters(fn: (...args: never[]) => unknown): string[] {
  const head = String(fn).match(/^\s*(?:function\s*\w*\s*)?\(?([^)=]*?)\)?\s*(?:=>|\{)/)?.[1] ?? '';
  return head.split(',').map((name) => name.trim()).filter(Boolean);
}

/** Every set of arguments worth showing a text with: one for most, one for each form where it counts. */
function examples(key: string, fn: (...args: never[]) => unknown, w: World): unknown[][] {
  if (SPECIAL[key]) return SPECIAL[key](w);
  const names = parameters(fn);
  // A count is shown at one and at several, and a total at one and at a number that needs grouping.
  const counted = names.find((name) => ['count', 'cards', 'total'].includes(name));
  const amounts = counted === 'total' ? [1, 1382] : counted === 'cards' ? [1, 4] : [1, 3];
  try {
    return (counted ? amounts : [null]).map((amount) => names.map((name) => (name === counted ? amount : value(name, w))));
  } catch (error) {
    throw new Error(`${key}: ${(error as Error).message}`);
  }
}

/* ── The texts of one language, each beside its English ────────────────── */

interface Row {
  key: string;
  english: string[];
  theirs: string[];
}

function rows(prefix: string, english: unknown, theirs: unknown, en: World, them: World, out: Row[] = []): Row[] {
  if (typeof english === 'string') {
    out.push({ key: prefix, english: [english], theirs: [String(theirs)] });
  } else if (typeof english === 'function') {
    if (prefix === 'help.sections') {
      const call = (fn: unknown, w: World) => (fn as (book: { john: string; abbr: string }) => unknown)({ john: w.bible.john, abbr: w.bible.abbr });
      rows(prefix, call(english, en), call(theirs, them), en, them, out);
    } else {
      // The parameters' names are read from the English function: the French
      // catalog wraps each of its own to space its punctuation, and a wrapper
      // has none. The catalogs are held to the same signatures by the compiler.
      const say = (fn: unknown, w: World) =>
        examples(prefix, english as never, w).map((args) => String((fn as (...a: unknown[]) => unknown)(...args)));
      out.push({ key: prefix, english: say(english, en), theirs: say(theirs, them) });
    }
  } else if (Array.isArray(english)) {
    english.forEach((item, i) => {
      const id = item && typeof item === 'object' && 'id' in item ? String((item as { id: string }).id) : String(i + 1);
      rows(prefix ? `${prefix}.${id}` : id, item, (theirs as unknown[])?.[i], en, them, out);
    });
  } else if (english && typeof english === 'object') {
    for (const [name, item] of Object.entries(english)) {
      if (name === 'id') continue;
      rows(prefix ? `${prefix}.${name}` : name, item, (theirs as Record<string, unknown>)?.[name], en, them, out);
    }
  }
  return out;
}

/** A text as a table shows it: the catalog's own bold and code kept, a key drawn as a key. */
function cell(texts: string[]): string {
  return texts
    .map((text) =>
      text
        .replace(/^[ \u00a0\u202f]+|[ \u00a0\u202f]+$/g, (spaces) => '␣'.repeat(spaces.length))
        // A backslash first, so the ones written below for Markdown are the only ones it reads.
        .replace(/\\/g, '\\\\')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/\{\{(.+?)\}\}/g, '<kbd>$1</kbd>')
        .replace(/\|/g, '\\|')
        .replace(/\n/g, '<br>')
    )
    .join('<br>');
}

const BAD = /undefined|\[object|NaN|\bnull\b/;

/* ── A guide ───────────────────────────────────────────────────────────── */

export function guide(locale: Locale): string {
  const language = LANGUAGES[locale];
  const label = LOCALE_LABELS[locale];
  const source = locale === 'en-US';
  const [en, them] = [world('en-US'), world(locale)];
  const { glossary, register } = plan();
  const said = notes();
  const all = rows('', CATALOGS['en-US'], CATALOGS[locale], en, them);
  const broken = all.filter((row) => [...row.english, ...row.theirs].some((text) => BAD.test(text)));
  if (broken.length > 0) throw new Error(`${locale}: an example did not fit its text: ${broken.map((row) => row.key).join(', ')}`);

  const taken = new Set<string>();
  const table = (keys: string[]) => {
    const mine = keys.flatMap((key) => all.filter((row) => row.key.split('.')[0] === key));
    for (const row of mine) taken.add(row.key);
    const head = source ? '| Key | Text |\n|---|---|' : `| Key | English | ${label} |\n|---|---|---|`;
    const body = mine.map((row) => {
      const note = said.get(row.key);
      const key = `\`${row.key}\`${note ? `<br><sub>${cell([note])}</sub>` : ''}`;
      return source ? `| ${key} | ${cell(row.english)} |` : `| ${key} | ${cell(row.english)} | ${cell(row.theirs)} |`;
    });
    return { count: mine.length, text: [head, ...body].join('\n') };
  };

  const fmt = them.fmt;
  const t = them.t;
  const lines: string[] = [];
  const say = (...text: string[]) => lines.push(...text);
  const picture = (file: string, caption: string) => {
    say(`![${caption}](img/${locale}/${file}.png)`, '', `*${caption}*`, '');
  };

  say(
    `# The Scriptura reader in ${label}: a guide for its reviewer`,
    '',
    source
      ? 'English is the language the reader was written in, and every other language is translated from it. You are checking that the English itself is clear, consistent and well made.'
      : `The reader's interface has been drafted in ${language.english} and has not yet been read by someone whose language it is. You are that reader. Nothing here is final until you say so.`,
    '',
    'This guide puts every word in front of you without your having to hunt for it, in three parts:',
    '',
    '| Part | What you do | About |',
    '|---|---|---|',
    '| [1. First pass](#part-1-first-pass) | Read the voice, the words used everywhere, and how numbers are written. | 15 minutes |',
    '| [2. Screen by screen](#part-2-screen-by-screen) | Look at each picture, then read every text that belongs to it. | 60 to 90 minutes |',
    '| [3. Try it yourself](#part-3-try-it-yourself) | Use the app in your language and look for what a picture cannot show. | 30 minutes |',
    '',
    'Part 1 alone already tells us a great deal. If you can give only a quarter of an hour, give it to Part 1.',
    '',
    '## How to send corrections',
    '',
    `- **In this file:** write them in [Your notes](#your-notes) at the end and send the file back. A ticked box anywhere above means "I checked this and it is right."`,
    `- **Or on the web:** [the correction form for ${label}](${FORMS}${language.form}).`,
    '- Either way, give the **key** from the first column of a table (for example `verseActions.quote`) so we can find the text, and what it should say instead.',
    '',
    '## How to read the tables',
    '',
    source
      ? '- Each row is one text. **Key** is its name in the program; **Text** is what a reader sees or hears.'
      : `- Each row is one text. **Key** is its name in the program, **English** is the original, and **${label}** is what is being reviewed.`,
    '- The small print under a key, where there is some, is the programmer\'s own note on that text. It often says whether the text is shown on the screen or only spoken by a screen reader, which a blind reader uses.',
    `- Names and numbers inside a text are examples: "${them.passage}", "${them.bible.name}", "${fmt.number(1382)}". The app puts the real ones there. Where a text changes with a number, it is shown with one and with several.`,
    '- A word in braces, such as `{count}`, is a place where the app puts a number or a name. Leave it as it is; it may move within the sentence.',
    '- `␣` marks a space at the start or end of a text that has to stay, and <kbd>Enter</kbd> is a key on the keyboard.',
    `- The pictures were taken with ${source ? 'the Berean Standard Bible' : `the Bible "${them.bible.name}"`} open, so the names of books are that Bible's own.`,
    '',
    '---',
    '',
    '## Part 1: First pass',
    '',
    '### 1.1 The voice',
    '',
    ...(register[locale] ? [`The text is meant to be written in this register: **${register[locale].register}**, with quotation marks ${register[locale].quotes}.`, ''] : []),
    ...language.voice.map((item) => `- [ ] ${item}`),
    ''
  );

  if (source) {
    const BRITISH = /\b\w*(?:colour|behaviour|favour|honour|centre|organis|recognis|licence)\w*/gi;
    const british = all.filter((row) => row.english.some((text) => text.match(BRITISH)));
    if (british.length > 0) {
      const words = [...new Set(british.flatMap((row) => row.english.flatMap((text) => text.match(BRITISH) ?? [])).map((word) => word.toLowerCase()))];
      say(
        `- [ ] **A decision for you:** ${british.length} texts use British spelling (${words.join(', ')}) in an interface labelled English (United States). Either they change, or the label does. They are: ${british
          .map((row) => `\`${row.key}\``)
          .join(', ')}.`,
        ''
      );
    }
  }

  say('### 1.2 The words used everywhere', '');
  const terms = glossary[locale];
  if (terms) {
    say(
      'These are the names of the app\'s own things. Each is used the same way on every screen, so one that is wrong is wrong everywhere.',
      '',
      `| In English | In ${label} | Right? |`,
      '|---|---|---|',
      ...Object.entries(terms).map(([english, theirs]) => `| ${english} | ${theirs} | |`),
      '',
      `- [ ] Each is the word a reader of the Bible in ${language.english} would expect.`,
      '- [ ] None of them is used for two different things.',
      ''
    );
  } else {
    say(
      'These are the names of the app\'s own things. Each should be used the same way on every screen.',
      '',
      '| Thing | Called | Right? |',
      '|---|---|---|',
      ...[
        ['What a reader writes', t.layout.notes],
        ['A verse marked with a colour', t.panels.marks],
        ['A surface for laying out verses as cards', t.layout.paneBoard],
        ['One Bible among several', t.panels.translations],
        ['Putting a passage into a note with its reference', t.verseActions.quote],
        ['Putting a reference into a note without the text', t.verseActions.link],
      ].map(([thing, called]) => `| ${thing} | ${called} | |`),
      '',
      '- [ ] None of them is used for two different things. (A board is called both "Board" and "Canvas" in places: is that clear, or confusing?)',
      ''
    );
  }

  const count = (key: 'matches', n: number) => t.search[key](n) as string;
  say(
    '### 1.3 Numbers and counts',
    '',
    'How the app writes a number, a percentage and a size in this language, and how one text changes with the number in it.',
    '',
    '| | Written as |',
    '|---|---|',
    `| One thousand three hundred and eighty-two | ${fmt.number(1382)} |`,
    `| Fifty-eight per cent | ${fmt.percent(58)} |`,
    `| The size of a download | ${fmt.bytes(5_700_000)} |`,
    ...[0, 1, 2, 5, 1382].map((n) => `| ${n} search ${n === 1 ? 'result' : 'results'} | ${count('matches', n)} |`),
    ...[1, 2, 5].map((n) => `| ${n} ${n === 1 ? 'verse' : 'verses'} selected | ${t.verseActions.summary(n, n === 1 ? `${them.bible.john} 1:3` : `${them.bible.john} 1:3-${n + 2}`)} |`),
    '',
    '- [ ] Thousands are grouped, and the percentage is written, the way this language does it.',
    '- [ ] Every count above is grammatical, zero and one included.',
    '',
    '---',
    '',
    '## Part 2: Screen by screen',
    '',
    'For each screen: look at the picture first, then tick what you have checked, then read the table. The order is the order in which a reader meets things.',
    ''
  );

  let n = 0;
  for (const tier of TIERS) {
    say(`### ${tier.title}`, '', tier.note, '');
    for (const section of tier.sections) {
      n += 1;
      const texts = table(section.keys);
      say(`#### 2.${n} ${section.title}`, '', section.about, '');
      const english = locale === 'en-US' ? section.english : undefined;
      for (const [file, caption] of section.pictures) picture(file, english?.captions?.[file] ?? caption);
      say(
        ...(english?.look ?? section.look).map((item) => `- [ ] ${item}`),
        '- [ ] Every text in the table below is correct and sounds natural.',
        ...(section.pictures.length > 0 ? ['- [ ] Nothing in the pictures is cut off, overlapping or badly broken across lines.'] : []),
        '',
        `**The ${texts.count} texts of this part**`,
        '',
        texts.text,
        ''
      );
    }
  }

  const rest = all.filter((row) => !taken.has(row.key));
  if (rest.length > 0) {
    const texts = table([...new Set(rest.map((row) => row.key.split('.')[0]))]);
    say('#### Everything else', '', 'Texts that belong to no screen above.', '', '- [ ] Every text in the table below is correct and sounds natural.', '', texts.text, '');
  }

  say(
    '---',
    '',
    '## Part 3: Try it yourself',
    '',
    `Open **<${SITE}>** on a computer, and then on a phone if you can.`,
    '',
    source
      ? 'The app follows your browser\'s language. If it opens in another language, choose **Settings** (the gear), then **Language**, then **English (United States)**.'
      : `The app follows your browser's language. If it does not open in ${label}, choose the gear in the bar at the top, then the first choice in the panel, and pick **${label}**.`,
    '',
    'A picture shows words standing still. What you are looking for here is what only use can show: a word that does not fit its button, a message that arrives at the wrong moment, a sentence that is right alone and wrong after the one before it.',
    '',
    ...(source ? [] : [`- [ ] Accept the Bible the app offers in your language, and read the first chapter of John.`]),
    '- [ ] Press a verse, then two more. Read what the row says, then press **' + t.verseActions.quote + '**.',
    '- [ ] Read the note that was made, and the line beneath it.',
    '- [ ] Type a word into the search box and read the count. Open the full list of results.',
    '- [ ] Type a reference, such as "' + `${them.bible.john} 3:16` + '", and press <kbd>Enter</kbd>.',
    '- [ ] Mark a verse with a colour, then open **' + t.panels.marks + '** and give that colour a name.',
    '- [ ] Open **' + t.panels.translations + '**: download another Bible, compare it with yours, then remove it and read the question it asks.',
    '- [ ] Open **' + t.panels.settings + '** and read it from top to bottom, changing each choice once.',
    '- [ ] Open **' + t.panels.help + '** and read it as a newcomer would.',
    '- [ ] Put two verses on a board (**' + t.verseActions.canvas + '**), open the board, and join them.',
    '- [ ] Delete the note and read the question it asks.',
    '- [ ] On a phone: do the first three steps again, upright and on its side.',
    '- [ ] If you use a screen reader: listen to the bar at the top, to a verse being selected, and to a quote being made. The interface should be spoken in your language, and the Bible in its own.',
    '',
    'While you do this:',
    '',
    '- [ ] No text is cut off, runs out of its button, or sits on top of another.',
    '- [ ] No English appears where your language should be. (The names of Bibles are as their publishers wrote them, and what an assistant may do, in Settings, is in English on purpose.)',
    '- [ ] Numbers, sizes and counts look right as they change.',
    '- [ ] Nothing reads as rude, childish, or stiffer than the rest.',
    '',
    '---',
    '',
    '## Your notes',
    ''
  );

  return lines.join('\n');
}

/** What a reviewer fills in. Written once; after that the file's own copy is kept. */
const NOTES = [
  YOURS,
  '',
  '### What should change',
  '',
  'One row for each correction. Add as many rows as you need.',
  '',
  '| Where (the key, or the screen) | What is wrong | What it should say |',
  '|---|---|---|',
  '| | | |',
  '| | | |',
  '| | | |',
  '| | | |',
  '| | | |',
  '| | | |',
  '',
  '### Anything else',
  '',
  'What a table cannot hold: the tone as a whole, a word you would change everywhere, something that confused you.',
  '',
  '> ',
  '',
  '### Your verdict',
  '',
  '- [ ] It can be published as it is.',
  '- [ ] It can be published once the corrections above are made.',
  '- [ ] It needs another reading after the corrections.',
  '',
  '| | |',
  '|---|---|',
  '| Reviewed by | |',
  '| Date | |',
  '| Version tested (Help, "About this preview") | |',
  '| Device and browser | |',
  '| Parts done (1, 2, 3) | |',
  '',
].join('\n');

/** A box a reviewer ticked stays ticked when the text beside it has not changed. */
const tick = (fresh: string, old: string) => {
  const ticked = new Set(old.split('\n').filter((line) => /^- \[[xX]\] /.test(line)).map((line) => line.slice(6)));
  return fresh
    .split('\n')
    .map((line) => (line.startsWith('- [ ] ') && ticked.has(line.slice(6)) ? `- [x] ${line.slice(6)}` : line))
    .join('\n');
};

/** The guide with what its reviewer has already written into the file kept. */
export function withTheirs(fresh: string, existing: string | null): string {
  if (existing === null || !existing.includes(YOURS)) return `${fresh}\n${NOTES}`;
  const at = existing.indexOf(YOURS);
  return `${tick(fresh, existing.slice(0, at))}\n${existing.slice(at)}`;
}

/** The part of a file that this script writes, with every box as it was first written. */
export const written = (file: string) => file.slice(0, file.indexOf(YOURS)).replace(/^- \[[xX]\] /gm, '- [ ] ');

export function index(): string {
  const { register } = plan();
  return [
    '# Language review: a guide for each reviewer',
    '',
    'One guide for each language the reader\'s interface speaks. Each is for the person who reads that language and is checking the words: what to look at first, a picture of every screen with every text that belongs to it, what to try in the app itself, and room for their notes.',
    '',
    '| Language | Guide | Register | Correction form |',
    '|---|---|---|---|',
    ...LOCALES.map(
      (locale) =>
        `| ${LOCALE_LABELS[locale]} | [${locale}.md](${locale}.md) | ${register[locale]?.register ?? ''} | [form](${FORMS}${LANGUAGES[locale].form}) |`
    ),
    '',
    `The app itself: <${SITE}>. Who reviews what, and how far each has got, is in [the interface-language plan](../plans/reader-i18n/README.md#review).`,
    '',
    '## For a reviewer',
    '',
    'Open your language\'s guide and start at the top. It is in three parts, and the first takes a quarter of an hour. Write what should change in **Your notes** at the end of the file and send it back, or use the correction form.',
    '',
    '## For whoever maintains these',
    '',
    'The guides are written by `scripts/language-review.ts` from the catalogs in `apps/reader/src/i18n/messages/`, so they say what the app says. Do not edit a guide above its line marked `YOURS`: the next writing would undo it.',
    '',
    '```bash',
    'npm run review:docs     # write the guides again from the catalogs',
    'npm run review:guide    # take the pictures again, then write the guides',
    '```',
    '',
    '- **When a text changes**, run `npm run review:docs`. `npm test` fails until you do, so a guide is never behind the app.',
    '- **When a screen changes**, run `npm run review:guide`. It needs Chromium (`npx playwright install chromium`), and makes the pictures smaller with ImageMagick if `magick` is installed.',
    '- **What a reviewer wrote is kept**: everything under `YOURS`, and every box they ticked whose words have not changed.',
    '- **When corrections come back**, apply them to the catalog file, run both commands, and mark the row in the plan.',
    '',
    'The pictures are cropped to the part of the page a section is about, so the words are their real size where GitHub shows the guide. They are taken with a Bible in the reviewer\'s language open, the one the app offers a new reader first.',
    '',
  ].join('\n');
}

/* ── Writing ───────────────────────────────────────────────────────────── */

/** Pictures with fewer colours are a third of the size and look the same. Skipped where ImageMagick is not installed. */
function shrink() {
  if (spawnSync('magick', ['-version']).status !== 0) {
    console.log('ImageMagick is not installed: the pictures are left at their full size.');
    return;
  }
  for (const locale of LOCALES) {
    const folder = join(OUT, 'img', locale);
    if (!existsSync(folder)) continue;
    for (const file of readdirSync(folder).filter((name) => name.endsWith('.png'))) {
      const path = join(folder, file);
      spawnSync('magick', [path, '-strip', '-colors', '128', '-define', 'png:compression-level=9', path]);
    }
  }
}

/** A file's text, or null when there is none yet: read once, rather than checked for and then read. */
function readIfThere(path: string): string | null {
  try {
    return readFileSync(path, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  }
}

function main() {
  if (process.argv.includes('--shrink')) shrink();
  mkdirSync(OUT, { recursive: true });
  for (const locale of LOCALES) {
    const path = join(OUT, `${locale}.md`);
    const fresh = guide(locale);
    const missing = [...fresh.matchAll(/\]\((img\/[^)]+)\)/g)].map((match) => match[1]).filter((file) => !existsSync(join(OUT, file)));
    if (missing.length > 0) console.log(`${locale}: no picture yet for ${missing.join(', ')}. Run npm run review:guide.`);
    writeFileSync(path, withTheirs(fresh, readIfThere(path)));
  }
  writeFileSync(join(OUT, 'README.md'), index());
  console.log(`Wrote ${LOCALES.length} guides to ${OUT}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
