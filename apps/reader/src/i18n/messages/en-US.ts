/**
 * English (United States) — the source catalog.
 *
 * Every string the interface shows or speaks lives here or in a sibling file
 * for another language. Plain strings for fixed text; functions for anything
 * that carries a number or a name, so each language chooses its own word
 * order and its own plurals (via `Intl.PluralRules`, never `n === 1`).
 *
 * The other catalogs are checked against `Messages`, the type of this one: a
 * missing or extra key, or a function with different arguments, fails
 * `tsc -b`. Markup inside strings is the small set in `../rich.tsx`.
 *
 * Machine-facing text stays English and is not here: the assistant tools'
 * names and descriptions, console messages, stored ids.
 */
import { numberFor, pluralFor } from '../format';
import type { BookExample, ColourNames, HelpSection, Removed } from '../types';

const plural = pluralFor('en-US');
/** Counts, grouped as the language groups thousands. */
const num = numberFor('en-US');

const colours: ColourNames = { amber: 'Amber', rose: 'Rose', sky: 'Sky', mint: 'Mint', violet: 'Violet' };
/** The colour as a word inside a sentence: "(amber)". */
const colourWords: ColourNames = { amber: 'amber', rose: 'rose', sky: 'sky', mint: 'mint', violet: 'violet' };

const helpSections = (book: BookExample): HelpSection[] => [
  {
    id: 'finding',
    heading: 'Finding a passage',
    blocks: [
      { p: 'Type a reference in the search box and press Enter. All of these work:' },
      {
        ul: [
          `\`${book.john} 3:16\` — one verse.`,
          `\`${book.john} 3:16-18\` — a range of verses.`,
          `\`${book.john} 3\` — a whole chapter.`,
          '`Juan 3:16` or `Jean 3:16` — the book name in the translation you are reading.',
          `\`${book.abbr} 3:16\` — an abbreviation. \`43 3:16\` — the book number.`,
        ],
      },
      { p: 'You can also pick the book and chapter from the two menus in the bar.' },
    ],
  },
  {
    id: 'searching',
    heading: 'Searching',
    blocks: [
      {
        p: 'Anything that is not a reference is a search. Search looks inside words, so `love` also finds *loveth* and *beloved*. Accents do not matter: `amo` finds *amó*.',
      },
      {
        ul: [
          'Put a phrase in quotes to find it exactly: `"in the beginning"`.',
          'Put a minus sign before a word to leave verses with it out: `God -love`.',
          '**Whole words only** stops the search looking inside longer words.',
          '**Match case** makes capital letters matter.',
        ],
      },
      {
        p: 'The first results are verses where your word stands alone; verses where it sits inside a longer word come after a line that says so. Press Enter on a search to see every match, counted by book.',
      },
    ],
  },
  {
    id: 'notes',
    heading: 'Notes',
    blocks: [
      {
        p: 'Notes are plain text with Markdown. The toolbar above the note adds headings, bold, italic, lists and quotes; press a tool again to take the formatting off. **Preview** shows the note as it will read.',
      },
      {
        p: 'A link to a passage looks like `[[john 3:16]]`. Add `@kjv` to say which translation: `[[john 3:16@kjv]]`. Put the cursor inside a link and a **Go to** button opens it. **Quote** beside a verse copies the verse into your note with its reference and a link.',
      },
      {
        p: 'Notes are saved on this device as you type. **Export** downloads every note and board as text files in a zip.',
      },
    ],
  },
  {
    id: 'marks',
    heading: 'Marks',
    blocks: [
      {
        p: 'Press a verse, or its number, to mark it in one of five colours. Each colour is a collection: name it for the subject you are following, and the **Marks** panel lists its verses in Bible order. Marks follow the passage, not the translation, so a mark made in one translation shows in all of them.',
      },
      { p: 'In Settings you can add a symbol to every mark, so colour is not the only sign.' },
    ],
  },
  {
    id: 'boards',
    heading: 'Boards',
    blocks: [
      {
        p: 'A board lays verses and notes out as cards you can move and join with arrows. **Canvas** beside a verse puts it on the current board. Cards hold a reference, not a copy of the text, so they show the translation you are reading.',
      },
      {
        p: "To move or resize a card without dragging, use its **✥** button; to colour it, its colour button. The arrow buttons beside the zoom move the view. **Connections**, in the board's bar, lists every arrow in words and removes one. Removing a card asks first, and removing a card or a connection can be undone until you change something else.",
      },
    ],
  },
  {
    id: 'translations',
    heading: 'Translations',
    blocks: [
      {
        p: 'The library lists every translation, grouped by language, with its size. Download one to read it offline; **Compare** shows it beside the one you are reading, verse by verse. Removing a translation never touches your notes or marks.',
      },
    ],
  },
  {
    id: 'keyboard',
    heading: 'Keyboard',
    blocks: [
      {
        ul: [
          '{{Tab}} and {{Shift}}+{{Tab}} move between controls. The first press offers to skip to the text or the notes.',
          '{{Escape}} closes whatever opened last: a panel, the verse actions, the search suggestions.',
          '{{Enter}} on a verse number opens its actions; the arrow keys move along them.',
          'On the divider between the panes, the arrow keys, {{Home}} and {{End}} resize; the two small buttons do the same.',
          'In a note, {{Shift}}+{{Tab}} reaches the formatting tools; the arrow keys move between them.',
          'On a board, cards take focus: the arrow keys move a card, {{Alt}} with an arrow resizes it, and {{Delete}} asks to remove it. With the board itself focused, the arrow keys move the view and {{+}} and {{−}} zoom.',
        ],
      },
    ],
  },
];

export const enUS = {
  app: {
    name: 'Scriptura Reader',
    downloading: 'Downloading the text for offline use…',
    opening: 'Opening…',
    bootFailed: 'The Bible text could not be opened. Reload to try again.',
    skipToScripture: 'Skip to scripture',
    skipToNotes: 'Skip to notes',
    title: (where: string) => `${where} · Scriptura`,
    passageTitle: (book: string, chapter: number, id: string) => `${book} ${chapter} · ${id}`,
    boardTitle: (name: string) => `${name} · Boards`,
    opened: (panel: string) => `${panel} opened`,
    closed: (panel: string) => `${panel} closed`,
    boardSaveFailed: 'Could not save the board — export your notes',
    languageChanged: 'The interface is now in English.',
  },

  panels: {
    marks: 'Marks',
    translations: 'Translations',
    settings: 'Settings',
    help: 'Help',
    results: 'Search results',
  },

  common: {
    cancel: 'Cancel',
    untitledNote: 'Untitled',
    untitledBoard: 'Untitled board',
    source: (name: string) => `${name} source`,
    undoRemove: 'Undo remove',
    remove: 'Remove',
    done: 'Done',
  },

  /**
   * The question asked before anything is deleted (3.3.4, 3.3.6). A title
   * names what goes; a body is short sentences, one per paragraph, saying what
   * happens and whether it can be undone; an action is a verb and its object,
   * so the button makes sense on its own.
   */
  confirm: {
    permanent: 'You cannot undo this.',
    undoable: 'You can undo this until your next change.',
    note: {
      title: (name: string) => `Delete the note “${name}”?`,
      gone: 'It will be deleted from this device.',
      keepCopy: 'To keep a copy, export your notes first.',
      action: 'Delete note',
      done: (name: string) => `Deleted the note “${name}”`,
    },
    board: {
      title: (name: string) => `Delete the board “${name}”?`,
      cards: (cards: number) =>
        plural(cards, {
          one: 'The board and its card will be deleted.',
          other: `The board and its ${num(cards)} cards will be deleted.`,
        }),
      empty: 'The board is empty.',
      kept: 'Your notes are not changed.',
      action: 'Delete board',
      done: (name: string) => `Deleted the board “${name}”`,
    },
    card: {
      title: (card: string) => `Remove ${card} from the board?`,
      connections: (count: number) =>
        plural(count, {
          one: 'Its connection is removed too.',
          other: `Its ${num(count)} connections are removed too.`,
        }),
      noteKept: 'The note itself is not changed.',
      action: 'Remove card',
    },
    mark: {
      title: (ref: string) => `Remove the mark on ${ref}?`,
      leaves: (collection: string) => `The verse leaves the collection “${collection}”.`,
      action: 'Remove mark',
    },
    translation: {
      title: (name: string) => `Remove ${name} from this device?`,
      frees: (size: string) => `This frees about ${size}.`,
      kept: 'Your notes and marks are not changed.',
      again: 'You can download it again when you are online.',
      action: 'Remove translation',
      done: (name: string) => `Removed ${name} from this device`,
    },
  },

  colours,
  colourWords,

  layout: {
    scripture: 'Scripture',
    notes: 'Notes',
    expandNotes: 'Expand notes',
    collapseNotes: 'Collapse notes',
    gripWithNews: (action: string, news: string) => `${action}, ${news}`,
    sheetHint: 'Drag, or use the up and down arrow keys, to make the notes taller or shorter.',
    notesMoreRoom: 'Give the notes more room',
    bibleMoreRoom: 'Give the Bible more room',
    resize: 'Resize panes',
    /** Both shares arrive formatted as percentages. */
    split: (bible: string, notes: string) => `${bible} Bible, ${notes} notes`,
    showNotes: 'Show notes',
    paneBible: 'Bible',
    paneNotes: 'Notes',
    maximize: (pane: string) => `Maximize ${pane}`,
    restore: (pane: string) => `Restore ${pane}`,
  },

  reader: {
    passage: 'Passage',
    book: 'Book',
    chapter: 'Chapter',
    translationChip: (id: string, name: string) => `${id} — ${name}. Choose or add a translation`,
    marks: 'Marks',
    marksChip: (count: number) => `Marks (${num(count)}) — verses you have marked, by colour`,
    settingsChip: 'Settings — display, storage, export, and assistant access',
    helpChip:
      'Help — finding passages, searching, notes, marks, boards, keyboard, and what the abbreviations mean',
    markVerse: (ref: string) => `Mark ${ref}`,
    markVerseIn: (ref: string, collection: string, colour: string) => `Mark ${ref} — in ${collection} (${colour})`,
    chapterMissing: (translation: string) => `This chapter is not in ${translation}.`,
    readingAnnounce: (translation: string) => `Reading ${translation}`,
  },

  verseActions: {
    group: (ref: string) => `Actions for ${ref}`,
    mark: (collection: string, colour: string) => `Mark as ${collection} (${colour})`,
    quote: 'Quote',
    link: 'Link',
    canvas: 'Canvas',
    canvasName: 'Canvas — put this verse on the board',
    close: (ref: string) => `Close actions for ${ref}`,
  },

  insert: {
    quoted: (ref: string) => `Quoted ${ref}`,
    quotedFrom: (ref: string, translation: string) => `Quoted ${ref} (${translation})`,
    linked: (ref: string) => `Linked ${ref}`,
    addedBoard: (board: string) => `Added the board “${board}”`,
    addedToBoard: (ref: string, board: string) => `Added ${ref} to “${board}”`,
    alreadyOnBoard: (ref: string, board: string) => `${ref} is already on “${board}”`,
    inNewNote: (done: string) => `${done} in a new note`,
    inNote: (done: string, note: string) => `${done} in “${note}”`,
    inUntitledNote: (done: string) => `${done} in an untitled note`,
    studyBoard: 'Study board',
  },

  search: {
    label: 'Search or go to a reference',
    placeholder: (example: string) => `Search, or go to "${example}"`,
    hint: 'Enter opens the passage, or every match. Down arrow moves into the suggestions.',
    suggestions: 'Suggestions',
    goTo: (ref: string) => `Go to ${ref}`,
    close: 'Close suggestions',
    matching: 'Matching',
    wholeWords: 'Whole words only',
    wholeWordsHint: 'Finds love but not loveth. Off, the search also looks inside longer words.',
    matchCase: 'Match case',
    matchCaseHint: 'Capital letters matter: God and god are different.',
    noMatches: 'No matches',
    matches: (total: number) => plural(total, { one: `${num(total)} match`, other: `${num(total)} matches` }),
    showing: (shown: number) => ` — showing ${num(shown)}`,
    seeAll: (total: number) => `See all ${num(total)}`,
    insert: (ref: string) => `Insert ${ref} into the open note`,
    weakBelow: 'Below: inside a longer word',
    announceNone: (query: string) => `No matches for “${query}”`,
    announceCount: (total: number, query: string) =>
      plural(total, { one: `${num(total)} match for “${query}”`, other: `${num(total)} matches for “${query}”` }),
  },

  results: {
    label: 'Search results',
    /** `{count}` is replaced by the total, in its own element. */
    heading: (total: number, query: string) =>
      plural(total, { one: `{count} match for “${query}”`, other: `{count} matches for “${query}”` }),
    close: 'Close search results',
    filter: 'Filter by book',
    allBooks: 'All books',
    weakBelow: (query: string) => `Below: “${query}” inside a longer word`,
    insert: (ref: string) => `Quote ${ref} into the open note`,
    insertTitle: 'Quote into the open note',
    showing: (shown: number, total: number) => `Showing ${num(shown)} of ${num(total)}`,
    inBook: (book: string) => ` in ${book}`,
    more: (count: number) => `Show ${num(count)} more`,
  },

  marks: {
    label: 'Marked verses',
    title: 'Marks',
    close: 'Close marks',
    hint: 'Each colour is a running list. Name one for the subject you are tracking.',
    nameFor: (colour: string) => `Name for the ${colour} collection`,
    empty: 'Nothing marked in this colour yet.',
    remove: (ref: string) => `Remove the mark on ${ref}`,
    removed: 'Mark removed. Undo is available in the Marks bar.',
    restored: 'Mark restored',
  },

  library: {
    title: 'Translations',
    close: 'Close translations',
    onDevice: (count: number) => `${num(count)} on this device`,
    used: (used: string, quota: string) => `${used} of ${quota} used`,
    about: (size: string) => `about ${size}`,
    licences: {
      'public-domain': 'Public domain',
      'cc-by-sa-4.0': 'CC BY-SA 4.0',
      cc0: 'CC0',
      'custom-free': 'Free licence',
    } as Record<string, string>,
    reading: 'Reading',
    comparing: 'Comparing',
    read: 'Read',
    compare: 'Compare',
    compareTitle: 'Show beside the translation you are reading',
    downloading: (name: string) => `Downloading ${name}`,
    download: 'Download',
    removeActive: (name: string) => `Remove ${name} — switch to another translation first`,
    removeFromDevice: (name: string) => `Remove ${name} from this device`,
    note: 'A downloaded translation stays on this device and can be read offline. Removing one never touches your notes or marks: both belong to the passage, not to a translation.',
    progress: (name: string, percent: string) => `${name}: ${percent} downloaded`,
    downloaded: (name: string) => `${name} downloaded`,
    failed: (name: string, error: string) => `${name}: ${error}`,
    failedOnline: 'The download did not finish. Try again later.',
    offline: 'No connection — try again when you are online.',
  },

  compare: {
    label: 'Translations side by side',
    compared: 'Translations compared',
    stop: (id: string) => `Stop comparing ${id}`,
    verse: 'Verse',
    verseBefore: 'Verse ',
    missing: (id: string) => `Not in ${id}`,
    quote: (id: string, verse: number) => `Quote ${id} verse ${verse}`,
  },

  notes: {
    /** A new note. Nouns have gender in other languages, so notes and boards each say it. */
    new: 'New',
    startOne: 'Start one',
    heading: 'Notes',
    picker: 'Note',
    none: 'No notes yet',
    preview: 'Preview',
    write: 'Write',
    previewTitle: 'See it rendered',
    writeTitle: 'Back to writing',
    canvas: 'Canvas',
    canvasTitle: 'Lay verses and notes out on a board',
    export: 'Export',
    exportTitle: 'Download every note and board as Markdown in a .zip',
    delete: 'Delete',
    title: 'Note title',
    body: 'Note body',
    placeholder: 'Write here…',
    goTo: (where: string) => `Go to ${where}`,
    noneOpen: 'No note open.',
    saveFailed: 'Could not save — export your notes',
    saving: 'Saving…',
    saved: 'Saved',
    linkIn: (where: string, id: string) => `${where} (${id})`,
    linkMissing: (where: string, id: string) => `${where} (${id} — not downloaded)`,
  },

  tools: {
    label: 'Formatting',
    heading: (level: number) => `Heading ${level}`,
    headingGlyph: (level: number) => `H${level}`,
    bold: 'Bold',
    boldGlyph: 'B',
    italic: 'Italic',
    italicGlyph: 'I',
    code: 'Code',
    bullets: 'Bulleted list',
    numbers: 'Numbered list',
    quote: 'Quote',
    link: 'Link to a passage',
  },

  preview: {
    empty: 'Nothing written yet.',
    editHere: (block: number) => `Edit here (block ${block})`,
    goTo: (where: string) => `Go to ${where}`,
  },

  embed: {
    scrolls: (board: string) => `Board: ${board}, scrolls sideways`,
    picture: (board: string, cards: number) => `Board: ${board}, ${num(cards)} cards`,
    empty: 'This board is empty.',
    missing: 'A board was embedded here, but it no longer exists.',
    open: 'Open board',
  },

  proposal: {
    noteTitle: 'A note has been drafted for you',
    marksTitle: 'Verses suggested for marking',
    lede: 'An assistant proposed this. Nothing has been saved — review it, change anything you like, and it only takes effect when you accept.',
    titleInput: 'Proposed note title',
    bodyInput: 'Proposed note body',
    /** `{collection}` is replaced by the collection's name, in bold. */
    into: (colour: string) => `Into {collection} (${colour})`,
    missing: 'Not in this translation.',
    discard: 'Discard',
    save: 'Save this note',
    mark: (count: number) => plural(count, { one: `Mark ${num(count)} verse`, other: `Mark ${num(count)} verses` }),
  },

  offer: {
    title: (language: string) => `Bibles in ${language}`,
    intro: 'These translations are in your language. Download one to read it, online or offline.',
    downloadAndRead: 'Download and read',
    downloadAndReadName: (name: string) => `Download and read ${name}`,
    allTranslations: 'All translations',
    notNow: 'Not now',
  },

  update: {
    label: 'A new version is ready',
    ready: 'A new version of Scriptura is ready.',
    readyAnnounce: 'A new version of Scriptura is ready. Reload when it suits you.',
    reload: 'Reload',
    reloading: 'Reloading…',
    later: 'Later',
  },

  durability: {
    label: 'Where your notes are kept',
    denied: 'This browser may delete your notes to free up space. Save a copy.',
    stale: 'You have not exported your notes for a while.',
    local: 'Your notes live in this browser only.',
    saveFolder: 'Save to a folder',
    saveFolderTitle: 'Keep a copy as .md files in a folder you choose',
    exportNow: 'Export now',
    dismiss: 'Dismiss this notice',
  },

  settings: {
    title: 'Settings',
    close: 'Close settings',
    display: 'Reading & display',
    colours: 'Colours',
    themes: {
      system: 'Follow the device',
      light: 'Light',
      dark: 'Dark',
      'hc-light': 'High contrast, light',
      'hc-dark': 'High contrast, dark',
      sepia: 'Sepia',
    },
    textSize: 'Text size',
    spacing: 'Line spacing',
    spacings: { normal: 'Normal', relaxed: 'Relaxed', loose: 'Loose' },
    measure: 'Column width',
    measures: { narrow: 'Narrow', normal: 'Normal', wide: 'Wide' },
    displayNote:
      'Relaxed and Loose spacing meet the WCAG guidance for line and paragraph spacing. These settings apply to this device only.',
    accessibility: 'Accessibility',
    motion: 'Motion',
    motions: { system: 'Follow the device', reduce: 'Reduce motion' },
    markers: 'Show a symbol on every highlight, not only a colour',
    storage: 'Where your work lives',
    persistence: {
      persisted: 'This browser has agreed to keep your notes. Clearing site data still removes them.',
      denied: 'This browser has not agreed to keep your notes. It may delete them to free up space.',
      unsupported: 'This browser will not say whether it keeps your notes. Assume it may delete them.',
      unknown: 'Checking…',
    },
    usedOnDevice: (used: string, quota: string) => `${used} of ${quota} used on this device.`,
    mirrored: 'Your notes are also saved to a folder you chose.',
    notMirrored: 'Your notes live only in this browser. Export them, or save a copy to a folder, to keep them safe.',
    exportAll: 'Export everything',
    anotherFolder: 'Choose another folder',
    mirror: 'Mirror to a folder',
    assistant: 'Assistant access',
    assistantIntro:
      'An AI assistant running in this browser can read your library and draft notes or marks for you. This is **off** until you turn it on. Nothing is sent to Scriptura: the assistant runs in your browser and reads the same data the app does.',
    assistantToggle: 'Offer Scriptura’s tools to an assistant',
    assistantSupported: 'This browser supports assistant tools.',
    assistantUnsupported:
      'This browser does not support assistant tools yet — WebMCP is an early draft, available in Chrome behind a flag. The switch is remembered for when it does.',
    assistantReadOnly:
      '**It can read, not write.** An assistant can read your notes, marks and passages, but it cannot change anything. Anything it wants to add is shown to you in full first, and is saved only when you accept it.',
    assistantTools: (count: number) => `What an assistant would be able to do (${num(count)} tools)`,
    toolReads: 'reads',
    toolNeedsApproval: 'needs your approval',
    /** Shown only in the other languages, beside the tool descriptions, which stay English. */
    toolsInEnglish: 'The descriptions are in English, as the assistant reads them.',
    help: 'Help',
    helpIntro:
      'How to find a passage, search, write notes, mark verses and use boards; what the abbreviations mean; and what this app promises about accessibility.',
    openHelp: 'Open help',
    language: 'Language',
    languageLabel: 'Interface language',
    languageSystem: 'Match this device',
    languageNote: 'Bible text stays in the language of each translation.',
  },

  help: {
    title: 'Help',
    close: 'Close help',
    sections: helpSections,
    abbreviations: 'Abbreviations',
    abbreviationsCaption: 'What each abbreviation means',
    short: 'Short',
    meaning: 'Meaning',
    terms: [
      ['CC BY-SA 4.0', 'Creative Commons Attribution–ShareAlike 4.0: a free licence that asks you to credit the source and share changes under the same terms.'],
      ['CC0', 'Creative Commons Zero: the author has waived all rights; the text is free to use.'],
      ['OT', 'Old Testament.'],
      ['NT', 'New Testament.'],
      ['PWA', 'Progressive web app: a website you can install and use offline.'],
      ['WCAG', 'Web Content Accessibility Guidelines, the standard this app is measured against.'],
    ] as [string, string][],
    glossaryHeading: 'Words used here',
    glossary: [
      ['Collection', 'Every verse you mark in one colour. Name a colour for the subject you are following, and the Marks panel lists those verses in Bible order.'],
      ['Board', 'A space where verses and notes are laid out as cards and joined with arrows. Boards are saved and exported with your notes.'],
      ['Card', 'One item on a board: a verse, a note, or text you typed. A verse card shows the verse from whichever translation you are reading.'],
      ['Translation', 'One version of the Bible, in one language. Every translation here is free to copy.'],
      ['Whole words only', 'A search option. With it on, "love" finds love but not loveth. With it off, it finds both.'],
      ['Match case', 'A search option. With it on, "God" and "god" are different.'],
      ['Mirror to a folder', 'Keep a copy of your notes as text files in a folder on this computer, updated as you write. Works in Chrome and Edge.'],
      ['Assistant tools', 'A way for an AI assistant running in your browser to read your library and suggest notes or marks. Off unless you turn it on; nothing is saved without your approval.'],
    ] as [string, string][],
    accessibilityHeading: 'Accessibility',
    accessibility: [
      'This app aims to meet the Web Content Accessibility Guidelines 2.2 at Level AAA for everything the app itself shows: its controls, its text, its colours and its behaviour. Every control can be reached by keyboard, is at least 44 by 44 pixels, shows where focus is, and has a name. Text is at least 7:1 against its background in every colour theme, and you can change the size, spacing and colours in Settings.',
      'Two things are outside that promise. The Bible text is shown as it was published: how hard it is to read, and how its words are said, belong to each translation, not to this app. The same is true of what you write in your notes.',
      "What is checked by machine is checked on every change. What needs a person — a screen reader on a phone, the app under a Windows contrast theme — is checked by hand, less often. If something does not work for you, please report it at the project's issue tracker on GitHub (`AlanRoman117/scriptura`).",
    ],
  },

  canvas: {
    /** A new board. */
    new: 'New',
    startOne: 'Start one',
    label: 'Boards',
    heading: (board: string) => `Board: ${board}`,
    noneOpenHeading: 'none open',
    picker: 'Board',
    none: 'No boards yet',
    undo: (what: Removed) => `Undo: put back ${what.kind === 'card' ? what.label : `the connection ${what.label}`}`,
    putBack: (what: Removed) => `${what.kind === 'card' ? what.label : `The connection ${what.label}`} put back`,
    removed: (what: Removed) =>
      `${what.kind === 'card' ? what.label : `The connection ${what.label}`} removed. Undo is in the board's bar.`,
    addCard: 'Add card',
    addNote: 'Add note',
    addNoteName: 'Add note — put the newest note on the board',
    addNoteNoNotes: 'Add note — write a note first',
    toNote: 'Add to note',
    toNoteName: 'Add to note — put this board into the note you have open',
    connections: (count: number) => `Connections (${num(count)})`,
    connectionsLabel: 'Connections',
    deleteBoard: 'Delete board',
    zoom: 'Zoom',
    zoomOut: 'Zoom out',
    zoomIn: 'Zoom in',
    zoomReset: (percent: string) => `Zoom ${percent}. Reset to full size, showing your cards`,
    moveView: 'Move the view',
    viewLeft: 'Move the view left',
    viewUp: 'Move the view up',
    viewDown: 'Move the view down',
    viewRight: 'Move the view right',
    back: 'Back to reading',
    help: 'Help — boards, keyboard, and what the abbreviations mean',
    noConnections: 'No connections yet. Press ⇢ on a card, then the card it leads to.',
    removeConnection: (edge: string) => `Remove the connection ${edge}`,
    missingCard: 'a missing card',
    edge: (from: string, to: string) => `${from} → ${to}`,
    frame: (cards: number) =>
      plural(cards, { one: `Board canvas, ${num(cards)} card`, other: `Board canvas, ${num(cards)} cards` }),
    frameHint:
      'Arrow keys move the view; plus and minus zoom. Each card takes focus: arrow keys move it, and Alt with an arrow resizes it.',
    verseCard: 'Verse card',
    noteCard: 'Note card',
    card: 'Card',
    cardName: (kind: string, label: string, colour: string | null) =>
      `${kind}: ${label}${colour ? `, ${colour}` : ''}`,
    colourName: (collection: string, colour: string) => `${collection} (${colour})`,
    cardTitle: 'Card title',
    cardTitlePlaceholder: 'Card',
    cardText: 'Card text',
    cardTextPlaceholder: 'Write here…',
    cardBody: (title: string) => `${title} — text`,
    connect: (card: string) => `Connect ${card} to another card`,
    connectPrompt: 'Choose the card to connect to: press it, or Enter on it. Escape cancels.',
    connected: (from: string, to: string) => `Connected ${from} to ${to}`,
    open: (card: string) => `Open ${card} in the reader`,
    colour: (current: string | null, card: string) =>
      `Colour: ${current ?? 'none'}. Change the colour of ${card}`,
    adjust: (card: string) => `Move or resize ${card} without dragging`,
    takeOff: (card: string) => `Take ${card} off the board`,
    empty: 'Nothing on this board yet. Add a card here, or use **Canvas** beside a verse while reading.',
    adjustPanel: (card: string) => `Move and resize ${card}`,
    colourPanel: (card: string) => `Colour of ${card}`,
    adjustTitle: 'Move and resize',
    colourTitle: 'Colour',
    panelTitle: (mode: string, card: string) => `${mode}: ${card}`,
    move: 'Move',
    moveLeft: 'Move left',
    moveUp: 'Move up',
    moveDown: 'Move down',
    moveRight: 'Move right',
    size: 'Size',
    narrower: 'Narrower',
    wider: 'Wider',
    shorter: 'Shorter',
    taller: 'Taller',
    colours: 'Colours',
    noColour: 'No colour',
    moved: (card: string, x: number, y: number) => `${card}: moved to ${x}, ${y}`,
    resized: (card: string, w: number, h: number) => `${card}: ${w} wide, ${h} tall`,
    coloured: (card: string, colour: string) => `${card}: ${colour}`,
    uncoloured: (card: string) => `${card}: no colour`,
    noneOpen: 'No board open.',
  },

  /** What cards and board exports say when there is nothing to show. */
  cards: {
    verseMissing: 'Not in this translation.',
    untitledNote: 'Untitled note',
    untitledBoard: 'Untitled board',
    emptyNote: 'Empty note.',
    deletedNote: 'This note has been deleted.',
    card: 'Card',
    emptyBoard: '_Empty board._',
    connections: 'Connections',
    missingCard: '(missing card)',
  },
};

export type Messages = typeof enUS;
