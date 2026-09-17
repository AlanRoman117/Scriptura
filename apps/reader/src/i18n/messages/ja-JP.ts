/**
 * 日本語（日本）.
 *
 * です・ます調. Japanese punctuation (、。「」) with no spaces between
 * Japanese text and Latin letters or numbers, following the JTF style guide.
 * Japanese has no plural: counts take counters (件, 節, 枚) and every form is
 * `other`. Key names stay as printed on Japanese keyboards (Tab, Shift, Esc).
 *
 * ⚠️ Drafted, not written by a native speaker: a native Japanese reviewer
 * must check it before release (docs/plans/reader-i18n/README.md).
 */
import { numberFor } from '../format';
import type { BookExample, ColourNames, HelpSection, Removed } from '../types';
import type { Messages } from './en-US';

const num = numberFor('ja-JP');

const colours: ColourNames = { amber: '琥珀色', rose: 'ばら色', sky: '空色', mint: 'ミント', violet: 'すみれ色' };
const colourWords: ColourNames = colours;

/**
 * A collection and its colour. Japanese names a colour the same way in a
 * heading and in a sentence, so an unnamed collection would otherwise read
 * "琥珀色（琥珀色）".
 */
const withColour = (collection: string, colour: string) =>
  collection === colour ? collection : `${collection}（${colour}）`;

const helpSections = (book: BookExample): HelpSection[] => [
  {
    id: 'finding',
    heading: '箇所を開く',
    blocks: [
      { p: '検索欄に参照箇所を入力して Enter を押します。次のような書き方ができます。' },
      {
        ul: [
          `\`${book.john} 3:16\`：1節。`,
          `\`${book.john} 3:16-18\`：続いた複数の節。`,
          `\`${book.john} 3\`：1章全体。`,
          '`Juan 3:16`、`Jean 3:16`：読んでいる訳での書名。',
          `\`${book.abbr} 3:16\`：略称。\`43 3:16\`：書の番号。`,
        ],
      },
      { p: 'バーの2つのメニューから書と章を選ぶこともできます。' },
    ],
  },
  {
    id: 'searching',
    heading: '検索',
    blocks: [
      {
        p: '参照箇所として読めない入力は、すべて検索になります。検索は語の一部にも一致するので、`神` は *神々* も見つけます。アクセント記号の有無は区別しません（`amo` で *amó* も見つかります）。',
      },
      {
        ul: [
          '語句をそのまま探すには引用符で囲みます：`"神の子"`。',
          '語の前にマイナス記号を付けると、その語を含む節を除きます：`神 -愛`。',
          '**単語単位で検索**を有効にすると、長い語の一部には一致しなくなります。英語など、単語の区切りがある言語の本文で使います。',
          '**大文字と小文字を区別**を有効にすると、大文字と小文字が別の文字として扱われます。',
        ],
      },
      {
        p: '最初に、検索語が単独で現れる節が並び、区切り線のあとに、長い語の一部として現れる節が続きます。検索中に Enter を押すと、すべての結果を書ごとの件数とともに表示します。',
      },
    ],
  },
  {
    id: 'notes',
    heading: 'ノート',
    blocks: [
      {
        p: 'ノートは Markdown で書くテキストです。ノートの上のツールバーで、見出し、太字、斜体、リスト、引用を付けられます。同じツールをもう一度押すと書式が外れます。**プレビュー**で、仕上がりを確認できます。',
      },
      {
        p: '箇所へのリンクは `[[john 3:16]]` のように書きます。訳を指定するには `@bungo` を付けます：`[[john 3:16@bungo]]`。リンクの中にカーソルを置くと、**移動**ボタンで開けます。節の横の**引用**を押すと、その節が参照箇所とリンク付きでノートに入ります。',
      },
      {
        p: 'ノートは入力するそばからこの端末に保存されます。**エクスポート**を押すと、すべてのノートとボードをテキストファイルにして zip でダウンロードします。',
      },
    ],
  },
  {
    id: 'marks',
    heading: 'マーク',
    blocks: [
      {
        p: '節またはその番号を押すと、5色のいずれかでマークできます。色はそれぞれコレクションです。追っているテーマの名前を付けると、**マーク**パネルにその節が聖書の順に並びます。マークは訳ではなく箇所に付くので、ある訳で付けたマークはすべての訳に表示されます。',
      },
      { p: '設定で、すべてのマークに記号を付けることもできます。色だけに頼らずに区別できます。' },
    ],
  },
  {
    id: 'boards',
    heading: 'ボード',
    blocks: [
      {
        p: 'ボードは、節やノートをカードとして並べ、矢印でつなげる場所です。節の横の**ボードへ**を押すと、その節が今のボードに加わります。カードには本文の写しではなく参照箇所が入っているので、読んでいる訳で表示されます。',
      },
      {
        p: 'ドラッグせずにカードを移動・サイズ変更するには**✥**ボタンを、色を付けるには色のボタンを使います。ズームの横の矢印ボタンで表示位置を動かせます。ボードのバーの**つながり**には、すべての矢印が文章で並び、そこから削除できます。カードの削除は確認してから行われ、カードやつながりの削除は、ほかの変更をするまで元に戻せます。',
      },
    ],
  },
  {
    id: 'translations',
    heading: '翻訳',
    blocks: [
      {
        p: 'ライブラリには、すべての翻訳が言語ごとにサイズとともに並びます。ダウンロードするとオフラインで読めます。**比較**を押すと、読んでいる訳の横に節ごとに並べて表示します。翻訳を削除しても、ノートやマークには影響しません。',
      },
    ],
  },
  {
    id: 'keyboard',
    heading: 'キーボード',
    blocks: [
      {
        ul: [
          '{{Tab}} と {{Shift}}+{{Tab}} でコントロール間を移動します。最初に押すと、本文やノートへ直接移動する案内が出ます。',
          '{{Esc}} は、最後に開いたもの（パネル、節の操作、検索候補）を閉じます。',
          '節の番号で {{Enter}} を押すと操作が開き、矢印キーで操作間を移動します。',
          'パネルの間の仕切りでは、矢印キー、{{Home}}、{{End}} で幅を変えられます。横の2つの小さなボタンでも同じことができます。',
          'ノートでは、{{Shift}}+{{Tab}} で書式ツールに移動し、矢印キーでツール間を移動します。',
          'ボードではカードにフォーカスが移ります。矢印キーでカードを動かし、{{Alt}} と矢印キーでサイズを変え、{{Delete}} で削除の確認が出ます。ボード自体にフォーカスがあるときは、矢印キーで表示位置が動き、{{+}} と {{−}} でズームします。',
        ],
      },
    ],
  },
];

export const jaJP = {
  app: {
    name: 'Scriptura Reader',
    downloading: 'オフラインで読むために本文をダウンロードしています…',
    opening: '開いています…',
    bootFailed: '聖書本文を開けませんでした。再読み込みしてもう一度お試しください。',
    skipToScripture: '聖書本文へ移動',
    skipToNotes: 'ノートへ移動',
    title: (where: string) => `${where} · Scriptura`,
    passageTitle: (book: string, chapter: number, id: string) => `${book} ${chapter} · ${id}`,
    boardTitle: (name: string) => `${name} · ボード`,
    opened: (panel: string) => `${panel}を開きました`,
    closed: (panel: string) => `${panel}を閉じました`,
    boardSaveFailed: 'ボードを保存できませんでした。ノートをエクスポートしてください',
    languageChanged: '表示言語を日本語に切り替えました。',
  },

  panels: {
    marks: 'マーク',
    translations: '翻訳',
    settings: '設定',
    help: 'ヘルプ',
    results: '検索結果',
  },

  common: {
    cancel: 'キャンセル',
    untitledNote: '無題',
    untitledBoard: '無題のボード',
    source: (name: string) => `${name}の出典`,
    undoRemove: '元に戻す',
    remove: '削除',
    done: '完了',
  },

  confirm: {
    permanent: 'この操作は元に戻せません。',
    undoable: '次に変更を加えるまでは元に戻せます。',
    note: {
      title: (name: string) => `ノート「${name}」を削除しますか？`,
      gone: 'この端末から削除されます。',
      keepCopy: 'コピーを残すには、先にノートをエクスポートしてください。',
      action: 'ノートを削除',
      done: (name: string) => `ノート「${name}」を削除しました`,
    },
    board: {
      title: (name: string) => `ボード「${name}」を削除しますか？`,
      cards: (cards: number) => `ボードとカード${num(cards)}枚が削除されます。`,
      empty: 'このボードは空です。',
      kept: 'ノートは変更されません。',
      action: 'ボードを削除',
      done: (name: string) => `ボード「${name}」を削除しました`,
    },
    card: {
      title: (card: string) => `${card}をボードから削除しますか？`,
      connections: (count: number) => `つながり${num(count)}件も削除されます。`,
      noteKept: 'ノート自体は変更されません。',
      action: 'カードを削除',
    },
    mark: {
      title: (ref: string) => `${ref}のマークを削除しますか？`,
      leaves: (collection: string) => `この節はコレクション「${collection}」から外れます。`,
      action: 'マークを削除',
    },
    translation: {
      title: (name: string) => `${name}をこの端末から削除しますか？`,
      frees: (size: string) => `約${size}の空き容量が増えます。`,
      kept: 'ノートとマークは変更されません。',
      again: 'オンラインのときに、もう一度ダウンロードできます。',
      action: '翻訳を削除',
      done: (name: string) => `${name}をこの端末から削除しました`,
    },
  },

  colours,
  colourWords,

  layout: {
    scripture: '聖書本文',
    notes: 'ノート',
    expandNotes: 'ノートを広げる',
    collapseNotes: 'ノートを縮める',
    gripWithNews: (action: string, news: string) => `${action}。${news}`,
    sheetHint: 'ドラッグするか、上下の矢印キーで、ノートの高さを変えられます。',
    notesMoreRoom: 'ノートの幅を広げる',
    bibleMoreRoom: '聖書の幅を広げる',
    resize: 'パネルの幅を変える',
    split: (bible: string, notes: string) => `聖書 ${bible}、ノート ${notes}`,
    showNotes: 'ノートを表示',
    paneBible: '聖書',
    paneNotes: 'ノート',
    maximize: (pane: string) => `${pane}を最大化`,
    restore: (pane: string) => `${pane}を元のサイズに戻す`,
  },

  reader: {
    passage: '箇所',
    book: '書',
    chapter: '章',
    translationChip: (id: string, name: string) => `${id}：${name}。訳を選ぶ、または追加する`,
    marks: 'マーク',
    marksChip: (count: number) => `マーク（${num(count)}件）：マークした節を色ごとに表示`,
    settingsChip: '設定：表示、保存、エクスポート、アシスタントのアクセス',
    helpChip: 'ヘルプ：箇所の開き方、検索、ノート、マーク、ボード、キーボード、略語の意味',
    markVerse: (ref: string) => `${ref}をマーク`,
    markVerseIn: (ref: string, collection: string, colour: string) =>
      `${ref}をマーク（${withColour(collection, colour)}にマーク済み）`,
    chapterMissing: (translation: string) => `この章は${translation}にありません。`,
    readingAnnounce: (translation: string) => `${translation}を表示しています`,
  },

  verseActions: {
    group: (ref: string) => `${ref}の操作`,
    mark: (collection: string, colour: string) => `${withColour(collection, colour)}でマーク`,
    quote: '引用',
    link: 'リンク',
    canvas: 'ボードへ',
    canvasName: 'ボードへ：この節をボードに加える',
    close: (ref: string) => `${ref}の操作を閉じる`,
  },

  insert: {
    quoted: (ref: string) => `${ref}を引用しました`,
    quotedFrom: (ref: string, translation: string) => `${ref}（${translation}）を引用しました`,
    linked: (ref: string) => `${ref}へのリンクを追加しました`,
    addedBoard: (board: string) => `ボード「${board}」を追加しました`,
    addedToBoard: (ref: string, board: string) => `${ref}をボード「${board}」に追加しました`,
    alreadyOnBoard: (ref: string, board: string) => `${ref}はすでにボード「${board}」にあります`,
    inNewNote: (done: string) => `新しいノートに：${done}`,
    inNote: (done: string, note: string) => `ノート「${note}」に：${done}`,
    inUntitledNote: (done: string) => `無題のノートに：${done}`,
    studyBoard: '学びのボード',
  },

  search: {
    label: '検索、または参照箇所へ移動',
    placeholder: (example: string) => `検索、または「${example}」へ移動`,
    hint: 'Enter で箇所、またはすべての検索結果を開きます。下矢印キーで候補に移動します。',
    suggestions: '候補',
    goTo: (ref: string) => `${ref}へ移動`,
    close: '候補を閉じる',
    matching: '一致の条件',
    wholeWords: '単語単位で検索',
    wholeWordsHint: '英語などで、love は見つけても loveth は見つけません。日本語の本文では結果は変わりません。',
    matchCase: '大文字と小文字を区別',
    matchCaseHint: '大文字と小文字を区別します。God と god は別の語になります。',
    noMatches: '該当なし',
    matches: (total: number) => `${num(total)}件`,
    showing: (shown: number) => `（${num(shown)}件を表示）`,
    seeAll: (total: number) => `${num(total)}件をすべて表示`,
    insert: (ref: string) => `${ref}を開いているノートに挿入`,
    weakBelow: 'ここから下：長い語の一部として一致',
    announceNone: (query: string) => `「${query}」は見つかりませんでした`,
    announceCount: (total: number, query: string) => `「${query}」の検索結果：${num(total)}件`,
  },

  results: {
    label: '検索結果',
    heading: (_total: number, query: string) => `「${query}」の検索結果：{count}件`,
    close: '検索結果を閉じる',
    filter: '書で絞り込む',
    allBooks: 'すべての書',
    weakBelow: (query: string) => `ここから下：「${query}」が長い語の一部として一致`,
    insert: (ref: string) => `${ref}を開いているノートに引用`,
    insertTitle: '開いているノートに引用',
    showing: (shown: number, total: number) => `${num(total)}件中${num(shown)}件を表示`,
    inBook: (book: string) => `（${book}）`,
    more: (count: number) => `さらに${num(count)}件を表示`,
  },

  marks: {
    label: 'マークした節',
    title: 'マーク',
    close: 'マークを閉じる',
    hint: '色ごとに一覧が増えていきます。追っているテーマの名前を付けてください。',
    nameFor: (colour: string) => `${colour}のコレクションの名前`,
    empty: 'この色でマークした節はまだありません。',
    remove: (ref: string) => `${ref}のマークを削除`,
    removed: 'マークを削除しました。マークのバーで元に戻せます。',
    restored: 'マークを元に戻しました',
  },

  library: {
    title: '翻訳',
    close: '翻訳を閉じる',
    onDevice: (count: number) => `この端末に${num(count)}件`,
    used: (used: string, quota: string) => `${quota}中${used}を使用`,
    about: (size: string) => `約${size}`,
    licences: {
      'public-domain': 'パブリックドメイン',
      'cc-by-sa-4.0': 'CC BY-SA 4.0',
      cc0: 'CC0',
      'custom-free': '自由なライセンス',
    } as Record<string, string>,
    reading: '表示中',
    comparing: '比較中',
    read: '読む',
    compare: '比較',
    compareTitle: '読んでいる訳の横に表示します',
    downloading: (name: string) => `${name}をダウンロード中`,
    download: 'ダウンロード',
    removeActive: (name: string) => `${name}を削除（先にほかの訳に切り替えてください）`,
    removeFromDevice: (name: string) => `${name}をこの端末から削除`,
    note: 'ダウンロードした訳はこの端末に残り、オフラインで読めます。訳を削除しても、ノートやマークは消えません。どちらも訳ではなく箇所に付いているからです。',
    progress: (name: string, percent: string) => `${name}：${percent}をダウンロードしました`,
    downloaded: (name: string) => `${name}のダウンロードが完了しました`,
    failed: (name: string, error: string) => `${name}：${error}`,
    failedOnline: 'ダウンロードを完了できませんでした。しばらくしてからもう一度お試しください。',
    offline: '接続がありません。オンラインになってからもう一度お試しください。',
  },

  compare: {
    label: '訳の並列表示',
    compared: '比較している訳',
    stop: (id: string) => `${id}の比較をやめる`,
    verse: '節',
    verseBefore: '節 ',
    missing: (id: string) => `${id}にはありません`,
    quote: (id: string, verse: number) => `${id}の${verse}節を引用`,
  },

  notes: {
    new: '新規',
    startOne: '作成する',
    heading: 'ノート',
    picker: 'ノート',
    none: 'ノートはまだありません',
    preview: 'プレビュー',
    write: '編集',
    previewTitle: '仕上がりを表示',
    writeTitle: '編集に戻る',
    canvas: 'ボード',
    canvasTitle: '節やノートをボードに並べる',
    export: 'エクスポート',
    exportTitle: 'すべてのノートとボードを Markdown にして .zip でダウンロード',
    delete: '削除',
    title: 'ノートのタイトル',
    body: 'ノートの本文',
    placeholder: 'ここに入力…',
    goTo: (where: string) => `${where}へ移動`,
    noneOpen: '開いているノートはありません。',
    saveFailed: '保存できませんでした。ノートをエクスポートしてください',
    saving: '保存中…',
    saved: '保存しました',
    linkIn: (where: string, id: string) => `${where}（${id}）`,
    linkMissing: (where: string, id: string) => `${where}（${id}、未ダウンロード）`,
  },

  tools: {
    label: '書式',
    heading: (level: number) => `見出し${level}`,
    headingGlyph: (level: number) => `H${level}`,
    bold: '太字',
    boldGlyph: 'B',
    italic: '斜体',
    italicGlyph: 'I',
    code: 'コード',
    bullets: '箇条書き',
    numbers: '番号付きリスト',
    quote: '引用',
    link: '箇所へのリンク',
  },

  preview: {
    empty: 'まだ何も書かれていません。',
    editHere: (block: number) => `ここを編集（ブロック${block}）`,
    goTo: (where: string) => `${where}へ移動`,
  },

  embed: {
    scrolls: (board: string) => `ボード：${board}（横にスクロールできます）`,
    picture: (board: string, cards: number) => `ボード：${board}、カード${num(cards)}枚`,
    empty: 'このボードは空です。',
    missing: 'ここにはボードが埋め込まれていましたが、そのボードはもうありません。',
    open: 'ボードを開く',
  },

  proposal: {
    noteTitle: 'ノートの下書きが作成されました',
    marksTitle: 'マークの候補になった節',
    lede: 'アシスタントからの提案です。まだ何も保存されていません。内容を確認し、自由に変更してください。承認したときにだけ反映されます。',
    titleInput: '提案されたノートのタイトル',
    bodyInput: '提案されたノートの本文',
    into: (colour: string) => `{collection}（${colour}の色）にマーク`,
    missing: 'この訳にはありません。',
    discard: '破棄',
    save: 'このノートを保存',
    mark: (count: number) => `${num(count)}節をマーク`,
  },

  offer: {
    title: (language: string) => `${language}の聖書`,
    intro: 'お使いの言語の訳があります。ダウンロードすると、オフラインでも読めます。',
    downloadAndRead: 'ダウンロードして読む',
    downloadAndReadName: (name: string) => `ダウンロードして読む：${name}`,
    allTranslations: 'すべての訳',
    notNow: '今はしない',
  },

  update: {
    label: '新しいバージョンがあります',
    ready: 'Scriptura の新しいバージョンがあります。',
    readyAnnounce: 'Scriptura の新しいバージョンがあります。都合のよいときに再読み込みしてください。',
    reload: '再読み込み',
    reloading: '再読み込み中…',
    later: '後で',
  },

  durability: {
    label: 'ノートの保存場所',
    denied: 'このブラウザーは、空き容量を確保するためにノートを削除することがあります。コピーを保存してください。',
    stale: 'しばらくノートをエクスポートしていません。',
    local: 'ノートはこのブラウザーの中にだけあります。',
    saveFolder: 'フォルダーに保存',
    saveFolderTitle: '選んだフォルダーに .md ファイルとしてコピーを保存します',
    exportNow: '今すぐエクスポート',
    dismiss: 'このお知らせを閉じる',
  },

  settings: {
    title: '設定',
    close: '設定を閉じる',
    display: '表示と読みやすさ',
    colours: '配色',
    themes: {
      system: '端末の設定に合わせる',
      light: 'ライト',
      dark: 'ダーク',
      'hc-light': 'ハイコントラスト（ライト）',
      'hc-dark': 'ハイコントラスト（ダーク）',
      sepia: 'セピア',
    },
    textSize: '文字の大きさ',
    spacing: '行間',
    spacings: { normal: '標準', relaxed: '広め', loose: 'かなり広め' },
    measure: '1行の長さ',
    measures: { narrow: '短め', normal: '標準', wide: '長め' },
    displayNote:
      '行間の「広め」と「かなり広め」は、行と段落の間隔に関する WCAG の基準を満たします。これらの設定はこの端末にだけ適用されます。',
    accessibility: 'アクセシビリティ',
    motion: '動き',
    motions: { system: '端末の設定に合わせる', reduce: '動きを減らす' },
    markers: '色だけでなく、すべてのマークに記号を表示する',
    storage: 'データの保存場所',
    persistence: {
      persisted: 'このブラウザーはノートを保持することに同意しています。ただし、サイトのデータを消去するとノートも消えます。',
      denied: 'このブラウザーはノートを保持することに同意していません。空き容量を確保するために削除することがあります。',
      unsupported: 'このブラウザーは、ノートを保持するかどうかを示しません。削除されることがあると考えてください。',
      unknown: '確認しています…',
    },
    usedOnDevice: (used: string, quota: string) => `この端末で${quota}中${used}を使用しています。`,
    mirrored: 'ノートは、選んだフォルダーにも保存されています。',
    notMirrored: 'ノートはこのブラウザーの中にだけあります。安全のため、エクスポートするか、フォルダーにコピーを保存してください。',
    exportAll: 'すべてエクスポート',
    anotherFolder: '別のフォルダーを選ぶ',
    mirror: 'フォルダーにコピー',
    assistant: 'アシスタントのアクセス',
    assistantIntro:
      'このブラウザーで動く AI アシスタントは、ライブラリを読み、ノートやマークの下書きを作れます。この機能は、有効にするまで**オフ**です。Scriptura には何も送信されません。アシスタントはブラウザーの中で動き、アプリと同じデータを読みます。',
    assistantToggle: 'Scriptura のツールをアシスタントに提供する',
    assistantSupported: 'このブラウザーはアシスタント用ツールに対応しています。',
    assistantUnsupported:
      'このブラウザーはまだアシスタント用ツールに対応していません。WebMCP は初期の草案で、Chrome では試験運用機能として使えます。このスイッチの状態は、対応したときのために記憶されます。',
    assistantReadOnly:
      '**読むことはできても、書き込むことはできません。**アシスタントはノート、マーク、箇所を読めますが、何も変更できません。追加したい内容は、まず全文が表示され、承認したときにだけ保存されます。',
    assistantTools: (count: number) => `アシスタントができること（ツール${num(count)}個）`,
    toolReads: '読み取り',
    toolNeedsApproval: '承認が必要',
    toolsInEnglish: '説明は、アシスタントが読むとおり英語で表示しています。',
    help: 'ヘルプ',
    helpIntro:
      '箇所の開き方、検索、ノートの書き方、節のマーク、ボードの使い方、略語の意味、そしてこのアプリがアクセシビリティについて約束していること。',
    openHelp: 'ヘルプを開く',
    language: '言語',
    languageLabel: '表示言語',
    languageSystem: 'この端末に合わせる',
    languageNote: '聖書本文は、それぞれの訳の言語のまま表示されます。',
  },

  help: {
    title: 'ヘルプ',
    close: 'ヘルプを閉じる',
    sections: helpSections,
    abbreviations: '略語',
    abbreviationsCaption: '略語の意味',
    short: '略語',
    meaning: '意味',
    terms: [
      ['CC BY-SA 4.0', 'クリエイティブ・コモンズ 表示-継承 4.0：出典を示し、変更を同じ条件で共有することを求める自由なライセンス。'],
      ['CC0', 'クリエイティブ・コモンズ・ゼロ：著作者がすべての権利を放棄しており、自由に使えます。'],
      ['OT', '旧約聖書（英語の Old Testament）。'],
      ['NT', '新約聖書（英語の New Testament）。'],
      ['PWA', 'プログレッシブウェブアプリ：インストールしてオフラインでも使えるウェブサイト。'],
      ['WCAG', 'ウェブコンテンツ・アクセシビリティ・ガイドライン。このアプリが準拠を目指す基準です。'],
    ] as [string, string][],
    glossaryHeading: 'このアプリの用語',
    glossary: [
      ['コレクション', '1つの色でマークしたすべての節。追っているテーマの名前を色に付けると、マークパネルにその節が聖書の順に並びます。'],
      ['ボード', '節やノートをカードとして並べ、矢印でつなぐ場所。ボードはノートと一緒に保存・エクスポートされます。'],
      ['カード', 'ボード上の1つの項目。節、ノート、または入力したテキストです。節のカードは、読んでいる訳でその節を表示します。'],
      ['翻訳', '1つの言語で書かれた聖書の1つの版。ここにある訳はどれも自由に複製できます。'],
      ['単語単位で検索', '検索の設定の一つ。有効にすると、英語の "love" は love に一致し、loveth には一致しません。無効にすると両方に一致します。'],
      ['大文字と小文字を区別', '検索の設定の一つ。有効にすると、"God" と "god" は別の語になります。'],
      ['フォルダーにコピー', 'ノートのコピーを、このコンピューターのフォルダーにテキストファイルとして置き、書くたびに更新します。Chrome と Edge で使えます。'],
      ['アシスタント用ツール', 'ブラウザーで動く AI アシスタントが、ライブラリを読んでノートやマークを提案するための仕組み。有効にしない限りオフで、承認なしには何も保存されません。'],
    ] as [string, string][],
    accessibilityHeading: 'アクセシビリティ',
    accessibility: [
      'このアプリは、アプリ自身が表示するもの（コントロール、文章、色、動作）について、ウェブコンテンツ・アクセシビリティ・ガイドライン（WCAG）2.2 のレベル AAA を満たすことを目指しています。すべてのコントロールはキーボードで操作でき、44×44 ピクセル以上の大きさがあり、フォーカスの位置を示し、名前を持っています。文字と背景のコントラストはどの配色でも 7:1 以上で、文字の大きさ、間隔、配色は設定で変えられます。',
      'この約束の対象外が2つあります。聖書本文は刊行されたとおりに表示されるため、その読みやすさや語の読み方は各訳によるもので、このアプリによるものではありません。ノートに書いた内容も同様です。',
      '機械で確認できることは、変更のたびに確認しています。人の確認が必要なこと（スマートフォンのスクリーンリーダーや、Windows のコントラストテーマでの表示など）は、手作業で、頻度を下げて確認しています。うまく使えない点があれば、GitHub のプロジェクトの Issue（`AlanRoman117/scriptura`）でお知らせください。',
    ],
  },

  canvas: {
    new: '新規',
    startOne: '作成する',
    label: 'ボード',
    heading: (board: string) => `ボード：${board}`,
    noneOpenHeading: '開いているボードはありません',
    picker: 'ボード',
    none: 'ボードはまだありません',
    undo: (what: Removed) =>
      `元に戻す：${what.kind === 'card' ? `カード「${what.label}」` : `つながり「${what.label}」`}を戻す`,
    putBack: (what: Removed) =>
      `${what.kind === 'card' ? `カード「${what.label}」` : `つながり「${what.label}」`}を元に戻しました`,
    removed: (what: Removed) =>
      `${what.kind === 'card' ? `カード「${what.label}」` : `つながり「${what.label}」`}を削除しました。ボードのバーで元に戻せます。`,
    addCard: 'カードを追加',
    addNote: 'ノートを追加',
    addNoteName: 'ノートを追加：いちばん新しいノートをボードに加える',
    addNoteNoNotes: 'ノートを追加：先にノートを書いてください',
    toNote: 'ノートに追加',
    toNoteName: 'ノートに追加：このボードを開いているノートに入れる',
    connections: (count: number) => `つながり（${num(count)}）`,
    connectionsLabel: 'つながり',
    deleteBoard: 'ボードを削除',
    zoom: 'ズーム',
    zoomOut: '縮小',
    zoomIn: '拡大',
    zoomReset: (percent: string) => `ズーム ${percent}。等倍に戻してカードを表示`,
    moveView: '表示位置を動かす',
    viewLeft: '表示位置を左へ',
    viewUp: '表示位置を上へ',
    viewDown: '表示位置を下へ',
    viewRight: '表示位置を右へ',
    back: '読むに戻る',
    help: 'ヘルプ：ボード、キーボード、略語の意味',
    noConnections: 'つながりはまだありません。カードの ⇢ を押してから、つなぐ先のカードを押してください。',
    removeConnection: (edge: string) => `つながり「${edge}」を削除`,
    missingCard: '見つからないカード',
    edge: (from: string, to: string) => `${from} → ${to}`,
    frame: (cards: number) => `ボードの表示領域、カード${num(cards)}枚`,
    frameHint:
      '矢印キーで表示位置を動かし、プラスとマイナスでズームします。カードにはフォーカスが移ります。矢印キーで動かし、Alt と矢印キーでサイズを変えます。',
    verseCard: '節のカード',
    noteCard: 'ノートのカード',
    card: 'カード',
    cardName: (kind: string, label: string, colour: string | null) =>
      `${kind}：${label}${colour ? `、${colour}` : ''}`,
    colourName: withColour,
    cardTitle: 'カードのタイトル',
    cardTitlePlaceholder: 'カード',
    cardText: 'カードの本文',
    cardTextPlaceholder: 'ここに入力…',
    cardBody: (title: string) => `${title}：本文`,
    connect: (card: string) => `${card}をほかのカードとつなぐ`,
    connectPrompt: 'つなぐ先のカードを選んでください。押すか、Enter を押します。Esc でキャンセルします。',
    connected: (from: string, to: string) => `${from}と${to}をつなぎました`,
    open: (card: string) => `${card}を読む画面で開く`,
    colour: (current: string | null, card: string) => `色：${current ?? 'なし'}。${card}の色を変える`,
    adjust: (card: string) => `${card}をドラッグせずに移動・サイズ変更`,
    takeOff: (card: string) => `${card}をボードから削除`,
    empty: 'このボードにはまだ何もありません。ここでカードを追加するか、読んでいるときに節の横の**ボードへ**を使ってください。',
    adjustPanel: (card: string) => `${card}の移動とサイズ変更`,
    colourPanel: (card: string) => `${card}の色`,
    adjustTitle: '移動とサイズ変更',
    colourTitle: '色',
    panelTitle: (mode: string, card: string) => `${mode}：${card}`,
    move: '移動',
    moveLeft: '左へ移動',
    moveUp: '上へ移動',
    moveDown: '下へ移動',
    moveRight: '右へ移動',
    size: 'サイズ',
    narrower: '幅を狭く',
    wider: '幅を広く',
    shorter: '高さを低く',
    taller: '高さを高く',
    colours: '色',
    noColour: '色なし',
    moved: (card: string, x: number, y: number) => `${card}：${x}, ${y} に移動しました`,
    resized: (card: string, w: number, h: number) => `${card}：幅 ${w}、高さ ${h}`,
    coloured: (card: string, colour: string) => `${card}：${colour}`,
    uncoloured: (card: string) => `${card}：色なし`,
    noneOpen: '開いているボードはありません。',
  },

  cards: {
    verseMissing: 'この訳にはありません。',
    untitledNote: '無題のノート',
    untitledBoard: '無題のボード',
    emptyNote: '空のノートです。',
    deletedNote: 'このノートは削除されました。',
    card: 'カード',
    emptyBoard: '_空のボード_',
    connections: 'つながり',
    missingCard: '（見つからないカード）',
  },
} satisfies Messages;
