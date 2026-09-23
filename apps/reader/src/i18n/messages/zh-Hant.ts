/**
 * 繁體中文（臺灣用字與用語）.
 *
 * Not a transliteration of zh-Hans: Taiwan writes 搜尋 for 搜索, 設定 for 设置,
 * 儲存 for 保存, 匯出 for 导出, 說明 for 帮助, 資料夾 for 文件夹, and quotes with
 * 「」 rather than “ ”. Full-width punctuation (，。：？！), no space between
 * Chinese and Latin letters or numbers, and no plural — counts take measure
 * words (節, 張, 筆) and every form is `other`.
 *
 * ⚠️ Drafted, not written by a native speaker: a native Chinese reviewer must
 * check it before release (docs/plans/reader-i18n/README.md).
 */
import { numberFor } from '../format';
import type { BookExample, ColourNames, HelpSection, Removed } from '../types';
import type { Messages } from './en-US';

/** Counts, grouped as the language groups thousands. */
const num = numberFor('zh-Hant');

const colours: ColourNames = { amber: '琥珀', rose: '玫瑰', sky: '天藍', mint: '薄荷', violet: '紫羅蘭' };
const colourWords: ColourNames = colours;

/**
 * A collection and its colour. Chinese names a colour the same way in a
 * heading and in a sentence, so an unnamed collection would otherwise read
 * 「琥珀（琥珀）」.
 */
const withColour = (collection: string, colour: string) =>
  collection === colour ? collection : `${collection}（${colour}）`;

const helpSections = (book: BookExample): HelpSection[] => [
  {
    id: 'finding',
    heading: '尋找經文',
    blocks: [
      { p: '在搜尋框中輸入經文出處，然後按 Enter。下面這些寫法都可以：' },
      {
        ul: [
          `\`${book.john} 3:16\` — 一節經文。`,
          `\`${book.john} 3:16-18\` — 一段經文。`,
          `\`${book.john} 3\` — 整章。`,
          '`Juan 3:16` 或 `Jean 3:16` — 你正在讀的譯本裡的書卷名。',
          `\`${book.abbr} 3:16\` — 簡稱。\`43 3:16\` — 書卷編號。`,
        ],
      },
      { p: '也可以用工具列上的兩個選單挑選書卷和章。' },
    ],
  },
  {
    id: 'searching',
    heading: '搜尋',
    blocks: [
      {
        p: '不是經文出處的內容都會當成搜尋。搜尋會找到詞語內部，所以 `愛` 也會找到*慈愛*。中文不受重音影響；在西文譯本裡，`amo` 也會找到*amó*。',
      },
      {
        ul: [
          '用引號括起來可以精確尋找整句：`"起初"`。',
          '在詞前加減號可以排除含該詞的經文：`神 -愛`。',
          '**僅完整字詞**讓搜尋不再找詞語內部。',
          '**區分大小寫**讓西文的大小寫產生作用。',
        ],
      },
      {
        p: '先列出該詞單獨出現的經文；出現在較長詞語內部的經文排在一行說明之後。在搜尋框按 Enter，可以看到全部結果，並按書卷統計。',
      },
    ],
  },
  {
    id: 'notes',
    heading: '筆記',
    blocks: [
      {
        p: '筆記是帶 Markdown 的純文字。格式會在輸入時顯示，正在編輯的那一行會重新顯示符號；如果只想看 Markdown，請在設定的「筆記編輯器」中選擇**純文字**。筆記上方的工具列可以加入標題、粗體、斜體、清單和引用；再按一次同一個工具就會取消格式。使用純文字時，**預覽**會顯示筆記最後的樣子。',
      },
      {
        p: '指向經文的連結寫作 `[[john 3:16]]`。加上 `@kjv` 可以指明譯本：`[[john 3:16@kjv]]`。把游標放在連結裡，**前往**按鈕就會開啟它。經文旁邊的**引用**會把該節連同出處和連結一起複製到筆記中。',
      },
      {
        p: '筆記在你輸入時就儲存在本裝置上。**匯出**會把所有筆記和看板做成文字檔，打包成 .zip 下載。',
      },
    ],
  },
  {
    id: 'marks',
    heading: '標記',
    blocks: [
      {
        p: '按一節經文或它的節號，就可以用五種顏色之一標記它。每種顏色都是一個合集：用你正在研讀的主題為它命名，**標記**面板會按聖經順序列出這些經文。標記跟著經文本身，而不是譯本，所以在一個譯本裡做的標記，在所有譯本裡都會顯示。',
      },
      { p: '在設定裡可以為每個標記加上符號，這樣顏色就不是唯一的標示。' },
    ],
  },
  {
    id: 'boards',
    heading: '看板',
    blocks: [
      {
        p: '看板把經文和筆記排成可以移動的卡片，並用箭頭連起來。經文旁邊的**加入看板**會把它放到目前的看板上。卡片儲存的是出處，而不是文字的副本，所以顯示的是你正在讀的譯本。在看板選單旁邊的輸入框裡可以為看板命名。',
      },
      {
        p: '不用拖曳也能移動或調整卡片大小：用它的 **✥** 按鈕；改顏色用顏色按鈕。縮放旁邊的箭頭按鈕可以移動檢視。看板工具列裡的**連接**用文字列出每一條箭頭，也可以從那裡移除。刪除卡片會先詢問，移除卡片或連接後，在你做出其他變更之前都可以復原。',
      },
    ],
  },
  {
    id: 'translations',
    heading: '譯本',
    blocks: [
      {
        p: '譯本庫按語言分組列出所有譯本，並顯示大小。下載之後就可以離線閱讀；**對照**會把它與你正在讀的譯本逐節並排顯示。移除譯本不會影響你的筆記和標記。',
      },
    ],
  },
  {
    id: 'keyboard',
    heading: '鍵盤',
    blocks: [
      {
        ul: [
          '{{Tab}} 和 {{Shift}}+{{Tab}} 在控制項之間移動。第一次按會提示跳到經文或筆記。',
          '{{Esc}} 關閉最後開啟的東西：面板、經文操作或搜尋建議。',
          '在節號上按 {{Enter}} 會開啟該節的操作；方向鍵在其中移動。',
          '在兩欄之間的分隔列上，方向鍵、{{Home}} 和 {{End}} 可以調整寬度；旁邊的兩個小按鈕作用相同。',
          '在筆記中，{{Shift}}+{{Tab}} 可以到達格式工具；方向鍵在工具之間移動。',
          '在看板上，卡片可以取得焦點：方向鍵移動卡片，{{Alt}} 加方向鍵調整大小，{{Delete}} 會詢問是否移除。焦點在看板本身時，方向鍵移動檢視，{{+}} 和 {{−}} 縮放。',
        ],
      },
    ],
  },
];

export const zhHant = {
  app: {
    name: 'Scriptura Reader',
    downloading: '正在下載經文，以便離線使用…',
    opening: '正在開啟…',
    bootFailed: '無法開啟經文。請重新載入後再試。',
    skipToScripture: '跳到經文',
    skipToNotes: '跳到筆記',
    title: (where: string) => `${where} · Scriptura`,
    passageTitle: (book: string, chapter: number, id: string) => `${book}${chapter} · ${id}`,
    boardTitle: (name: string) => `${name} · 看板`,
    opened: (panel: string) => `已開啟${panel}面板`,
    closed: (panel: string) => `已關閉${panel}面板`,
    boardSaveFailed: '無法儲存看板 — 請匯出你的筆記',
    languageChanged: '介面現在是繁體中文。',
  },

  panels: {
    marks: '標記',
    translations: '譯本',
    settings: '設定',
    help: '說明',
    results: '搜尋結果',
  },

  common: {
    cancel: '取消',
    untitledNote: '無標題',
    untitledBoard: '無標題看板',
    source: (name: string) => `${name}的來源`,
    undoRemove: '復原',
    remove: '移除',
    done: '完成',
  },

  confirm: {
    permanent: '此動作無法復原。',
    undoable: '在你做出下一次變更之前都可以復原。',
    note: {
      title: (name: string) => `要刪除筆記「${name}」嗎？`,
      gone: '它將從本裝置上刪除。',
      keepCopy: '想保留副本的話，請先匯出筆記。',
      action: '刪除筆記',
      done: (name: string) => `已刪除筆記「${name}」`,
    },
    board: {
      title: (name: string) => `要刪除看板「${name}」嗎？`,
      cards: (cards: number) => `看板及其${num(cards)}張卡片都會被刪除。`,
      empty: '這個看板是空的。',
      kept: '你的筆記不會改變。',
      action: '刪除看板',
      done: (name: string) => `已刪除看板「${name}」`,
    },
    card: {
      title: (card: string) => `要把${card}從看板上移除嗎？`,
      connections: (count: number) => `它的${num(count)}條連接也會一併移除。`,
      noteKept: '筆記本身不會改變。',
      action: '移除卡片',
    },
    mark: {
      title: (ref: string) => `要移除${ref}上的標記嗎？`,
      leaves: (collection: string) => `這節經文將離開合集「${collection}」。`,
      action: '移除標記',
    },
    translation: {
      title: (name: string) => `要從本裝置上移除${name}嗎？`,
      frees: (size: string) => `這會釋出大約${size}的空間。`,
      kept: '你的筆記和標記不會改變。',
      again: '連上網路時可以再次下載。',
      action: '移除譯本',
      done: (name: string) => `已從本裝置上移除${name}`,
    },
  },

  colours,
  colourWords,

  layout: {
    scripture: '經文',
    notes: '筆記',
    expandNotes: '展開筆記',
    collapseNotes: '收合筆記',
    gripWithNews: (action: string, news: string) => `${action}，${news}`,
    sheetHint: '拖曳，或用上下方向鍵，可以讓筆記區更高或更矮。',
    notesMoreRoom: '給筆記更多空間',
    bibleMoreRoom: '給聖經更多空間',
    resize: '調整兩欄寬度',
    split: (bible: string, notes: string) => `聖經${bible}，筆記${notes}`,
    showNotes: '顯示筆記',
    paneBible: '聖經',
    paneNotes: '筆記',
    maximize: (pane: string) => `最大化${pane}`,
    restore: (pane: string) => `還原${pane}`,
  },

  reader: {
    passage: '經文',
    book: '書卷',
    chapter: '章',
    translationChip: (id: string, name: string) => `${id} — ${name}。選擇或加入譯本`,
    marks: '標記',
    marksChip: (count: number) => `標記（${num(count)}）— 你標記過的經文，按顏色分組`,
    settingsChip: '設定 — 顯示、儲存空間、匯出與助理權限',
    helpChip: '說明 — 尋找經文、搜尋、筆記、標記、看板、鍵盤，以及各種縮寫的意思',
    markVerse: (ref: string) => `標記${ref}`,
    markVerseIn: (ref: string, collection: string, colour: string) =>
      `標記${ref} — 在${withColour(collection, colour)}中`,
    chapterMissing: (translation: string) => `${translation}中沒有這一章。`,
    readingAnnounce: (translation: string) => `正在閱讀${translation}`,
  },

  verseActions: {
    group: (ref: string) => `${ref}的操作`,
    mark: (collection: string, colour: string) => `標記為${withColour(collection, colour)}`,
    quote: '引用',
    link: '連結',
    canvas: '加入看板',
    canvasName: '加入看板 — 把這節經文放到看板上',
    close: (ref: string) => `關閉${ref}的操作`,
  },

  insert: {
    quoted: (ref: string) => `已引用${ref}`,
    quotedFrom: (ref: string, translation: string) => `已引用${ref}（${translation}）`,
    linked: (ref: string) => `已連結${ref}`,
    addedBoard: (board: string) => `已加入看板「${board}」`,
    addedToBoard: (ref: string, board: string) => `已把${ref}加入看板「${board}」`,
    alreadyOnBoard: (ref: string, board: string) => `${ref}已經在「${board}」上了`,
    inNewNote: (done: string) => `${done}，在新筆記中`,
    inNote: (done: string, note: string) => `${done}，在「${note}」中`,
    inUntitledNote: (done: string) => `${done}，在無標題筆記中`,
    studyBoard: '研讀看板',
  },

  search: {
    label: '搜尋或前往某處經文',
    placeholder: (example: string) => `搜尋，或前往「${example}」`,
    hint: 'Enter 開啟該處經文，或顯示全部結果。下方向鍵進入建議清單。',
    suggestions: '建議',
    goTo: (ref: string) => `前往${ref}`,
    close: '關閉建議',
    matching: '比對方式',
    wholeWords: '僅完整字詞',
    wholeWordsHint: '只找 love，不找 loveth。關閉時，搜尋也會找到較長詞語的內部。',
    matchCase: '區分大小寫',
    matchCaseHint: '大小寫會產生作用：God 和 god 不同。',
    noMatches: '沒有結果',
    matches: (total: number) => `${num(total)}筆結果`,
    showing: (shown: number) => `（顯示${num(shown)}筆）`,
    seeAll: (total: number) => `檢視全部${num(total)}筆`,
    insert: (ref: string) => `把${ref}插入開啟中的筆記`,
    weakBelow: '以下：出現在較長的詞語中',
    announceNone: (query: string) => `沒有「${query}」的結果`,
    announceCount: (total: number, query: string) => `「${query}」有${num(total)}筆結果`,
  },

  results: {
    label: '搜尋結果',
    /** `{count}` 會被換成總數，放在它自己的元素裡。 */
    heading: (_total: number, query: string) => `「${query}」有{count}筆結果`,
    close: '關閉搜尋結果',
    filter: '按書卷篩選',
    allBooks: '全部書卷',
    weakBelow: (query: string) => `以下：「${query}」出現在較長的詞語中`,
    insert: (ref: string) => `把${ref}引用到開啟中的筆記`,
    insertTitle: '引用到開啟中的筆記',
    showing: (shown: number, total: number) => `顯示${num(total)}筆中的${num(shown)}筆`,
    inBook: (book: string) => `，在${book}中`,
    more: (count: number) => `再顯示${num(count)}筆`,
  },

  marks: {
    label: '標記過的經文',
    title: '標記',
    close: '關閉標記',
    hint: '每種顏色都是一份持續的清單。用你正在研讀的主題為它命名。',
    nameFor: (colour: string) => `${colour}合集的名稱`,
    empty: '這種顏色下還沒有標記。',
    remove: (ref: string) => `移除${ref}上的標記`,
    removed: '標記已移除。可以在標記列中復原。',
    restored: '標記已還原',
  },

  library: {
    title: '譯本',
    close: '關閉譯本',
    onDevice: (count: number) => `本裝置上有${num(count)}個`,
    used: (used: string, quota: string) => `已用${used}，共${quota}`,
    about: (size: string) => `約${size}`,
    licences: {
      'public-domain': '公共領域',
      'cc-by-4.0': 'CC BY 4.0',
      'cc-by-sa-4.0': 'CC BY-SA 4.0',
      cc0: 'CC0',
      'custom-free': '自由授權',
    } as Record<string, string>,
    reading: '正在閱讀',
    comparing: '正在對照',
    read: '閱讀',
    compare: '對照',
    compareTitle: '與你正在讀的譯本並排顯示',
    downloading: (name: string) => `正在下載${name}`,
    download: '下載',
    removeActive: (name: string) => `移除${name} — 請先切換到其他譯本`,
    removeFromDevice: (name: string) => `從本裝置上移除${name}`,
    note: '下載後的譯本會存在本裝置上，可以離線閱讀。移除譯本不會影響你的筆記和標記：兩者都屬於經文本身，而不屬於某個譯本。',
    progress: (name: string, percent: string) => `${name}：已下載${percent}`,
    downloaded: (name: string) => `${name}已下載`,
    failed: (name: string, error: string) => `${name}：${error}`,
    failedOnline: '下載沒有完成。請稍後再試。',
    offline: '沒有網路連線 — 連上網路後再試。',
  },

  compare: {
    label: '譯本並排對照',
    compared: '對照中的譯本',
    stop: (id: string) => `停止對照${id}`,
    verse: '節',
    verseBefore: '節 ',
    missing: (id: string) => `${id}中沒有`,
    quote: (id: string, verse: number) => `引用${id}第${verse}節`,
  },

  notes: {
    new: '新增',
    startOne: '新增一則',
    heading: '筆記',
    picker: '筆記',
    none: '還沒有筆記',
    preview: '預覽',
    write: '編輯',
    previewTitle: '檢視排版後的樣子',
    writeTitle: '回到編輯',
    canvas: '看板',
    canvasTitle: '把經文和筆記排在看板上',
    export: '匯出',
    exportTitle: '把所有筆記和看板以 Markdown 打包成 .zip 下載',
    delete: '刪除',
    title: '筆記標題',
    body: '筆記內文',
    placeholder: '在這裡寫…',
    goTo: (where: string) => `前往${where}`,
    noneOpen: '沒有開啟中的筆記。',
    saveFailed: '無法儲存 — 請匯出你的筆記',
    saving: '正在儲存…',
    saved: '已儲存',
    linkIn: (where: string, id: string) => `${where}（${id}）`,
    linkMissing: (where: string, id: string) => `${where}（${id} — 尚未下載）`,
  },

  tools: {
    label: '格式',
    heading: (level: number) => `${level}級標題`,
    headingGlyph: (level: number) => `H${level}`,
    bold: '粗體',
    boldGlyph: 'B',
    italic: '斜體',
    italicGlyph: 'I',
    code: '程式碼',
    bullets: '項目符號清單',
    numbers: '編號清單',
    quote: '引用',
    link: '經文連結',
  },

  preview: {
    empty: '還沒有寫任何內容。',
    editHere: (block: number) => `在此編輯（第${block}段）`,
    goTo: (where: string) => `前往${where}`,
  },

  embed: {
    scrolls: (board: string) => `看板：${board}，可左右捲動`,
    picture: (board: string, cards: number) => `看板：${board}，${num(cards)}張卡片`,
    empty: '這個看板是空的。',
    missing: '這裡曾嵌入一個看板，但它已經不存在了。',
    open: '開啟看板',
  },

  proposal: {
    noteTitle: '已為你草擬了一則筆記',
    marksTitle: '建議標記的經文',
    lede: '這是助理提出的。什麼都還沒有儲存 — 請先檢視，隨意修改，只有你接受後才會生效。',
    titleInput: '建議的筆記標題',
    bodyInput: '建議的筆記內文',
    into: (colour: string) => `加入{collection}（${colour}）`,
    missing: '這個譯本中沒有。',
    discard: '捨棄',
    save: '儲存這則筆記',
    mark: (count: number) => `標記${num(count)}節經文`,
  },

  offer: {
    title: (language: string) => `${language}聖經`,
    intro: '這些譯本是你所用語言的譯本。下載一個就可以閱讀，連上網路或離線都可以。',
    downloadAndRead: '下載並閱讀',
    downloadAndReadName: (name: string) => `下載並閱讀${name}`,
    allTranslations: '全部譯本',
    notNow: '暫時不用',
  },

  update: {
    label: '新版本已就緒',
    ready: 'Scriptura 的新版本已就緒。',
    readyAnnounce: 'Scriptura 的新版本已就緒。方便時重新載入即可。',
    reload: '重新載入',
    reloading: '正在重新載入…',
    later: '稍後',
  },

  previewBuild: {
    label: '預覽版',
    intro: '**預覽版。**這是給翻譯審閱者使用的早期版本。',
    report: '在 GitHub 上回報翻譯問題（會在新分頁中開啟）',
    reportShort: '回報翻譯問題',
    newTab: '（在 GitHub 上，會在新分頁中開啟）',
    hide: '隱藏',
    heading: '關於這個預覽版',
    about:
      '這個版本是給審閱西班牙文、法文、日文、中文和葡萄牙文介面的人使用的。你在這裡做的一切都不會被傳送到任何地方：筆記和標記都留在這個瀏覽器裡。發現用詞錯誤或不清楚的地方，請用下面的連結回報。它會開啟 GitHub 上的一份簡短表單，需要一個免費帳號。',
    version: (version: string) => `版本：${version}`,
  },

  durability: {
    label: '你的筆記存在哪裡',
    denied: '這個瀏覽器可能會刪除你的筆記以釋出空間。請留一份副本。',
    stale: '你已經有一段時間沒有匯出筆記了。',
    local: '你的筆記只存在這個瀏覽器裡。',
    saveFolder: '儲存到資料夾',
    saveFolderTitle: '在你選擇的資料夾中保留一份 .md 副本',
    exportNow: '立即匯出',
    dismiss: '關閉這個提示',
  },

  settings: {
    title: '設定',
    close: '關閉設定',
    display: '閱讀與顯示',
    colours: '顏色',
    themes: {
      system: '跟隨裝置',
      light: '淺色',
      dark: '深色',
      'hc-light': '高對比（淺色）',
      'hc-dark': '高對比（深色）',
      sepia: '棕褐色',
    },
    textSize: '文字大小',
    spacing: '行距',
    spacings: { normal: '標準', relaxed: '寬鬆', loose: '更寬鬆' },
    measure: '欄寬',
    measures: { narrow: '窄', normal: '標準', wide: '寬' },
    editor: '筆記編輯器',
    editors: { live: '輸入時顯示格式', plain: '純文字' },
    displayNote: '「寬鬆」和「更寬鬆」的行距符合 WCAG 對行距和段距的建議。這些設定只對本裝置生效。',
    accessibility: '無障礙',
    motion: '動態效果',
    motions: { system: '跟隨裝置', reduce: '減少動態效果' },
    markers: '為每個標記顯示符號，而不只用顏色',
    storage: '你的內容存在哪裡',
    persistence: {
      persisted: '這個瀏覽器已同意保留你的筆記。清除網站資料仍會刪除它們。',
      denied: '這個瀏覽器沒有同意保留你的筆記。它可能會刪除筆記以釋出空間。',
      unsupported: '這個瀏覽器不會說明是否保留你的筆記。請當作它可能會刪除。',
      unknown: '正在檢查…',
    },
    usedOnDevice: (used: string, quota: string) => `本裝置已用${used}，共${quota}。`,
    mirrored: '你的筆記也會存到你選擇的資料夾中。',
    notMirrored: '你的筆記只存在這個瀏覽器裡。請匯出，或存一份副本到資料夾，以免遺失。',
    exportAll: '全部匯出',
    anotherFolder: '選擇其他資料夾',
    mirror: '同步到資料夾',
    assistant: '助理權限',
    assistantIntro:
      '在這個瀏覽器裡執行的 AI 助理可以讀取你的資料庫，並為你草擬筆記或標記。這項功能預設**關閉**，除非你把它開啟。沒有任何內容會傳送給 Scriptura：助理在你的瀏覽器裡執行，讀取的資料和應用程式本身一樣。',
    assistantToggle: '向助理開放 Scriptura 的工具',
    assistantSupported: '這個瀏覽器支援助理工具。',
    assistantUnsupported:
      '這個瀏覽器還不支援助理工具 — WebMCP 仍是早期草案，目前在 Chrome 中需要手動開啟實驗旗標。這個開關會記住，等到支援時生效。',
    assistantReadOnly:
      '**它只能讀取，不能寫入。**助理可以讀取你的筆記、標記和經文，但不能變更任何內容。它想加入的內容都會先完整地顯示給你，只有你接受後才會儲存。',
    assistantTools: (count: number) => `助理可以做的事（${num(count)}個工具）`,
    toolReads: '讀取',
    toolNeedsApproval: '需要你的同意',
    toolsInEnglish: '工具說明是英文的，因為助理就是這樣讀取它們的。',
    help: '說明',
    helpIntro: '如何尋找經文、搜尋、寫筆記、標記經文和使用看板；各種縮寫的意思；以及這個應用程式在無障礙方面的承諾。',
    openHelp: '開啟說明',
    language: '語言',
    languageLabel: '介面語言',
    languageSystem: '跟隨本裝置',
    languageNote: '經文仍然使用各譯本自己的語言。',
  },

  help: {
    title: '說明',
    close: '關閉說明',
    sections: helpSections,
    abbreviations: '縮寫',
    abbreviationsCaption: '每個縮寫的意思',
    short: '縮寫',
    meaning: '意思',
    terms: [
      ['CC BY-SA 4.0', '創用 CC 姓名標示-相同方式分享 4.0：一種自由授權條款，要求標示來源，並以相同方式分享修改。'],
      ['CC0', '創用 CC 零：作者放棄了全部權利，文字可以自由使用。'],
      ['OT', '舊約（英文 Old Testament）。'],
      ['NT', '新約（英文 New Testament）。'],
      ['PWA', '漸進式網頁應用程式：可以安裝並離線使用的網站。'],
      ['WCAG', '《網頁內容無障礙指引》，本應用程式依此衡量自己。'],
    ] as [string, string][],
    glossaryHeading: '這裡用到的詞',
    glossary: [
      ['合集', '你用同一種顏色標記的所有經文。用你正在研讀的主題為一種顏色命名，標記面板就會按聖經順序列出這些經文。'],
      ['看板', '把經文和筆記排成卡片、並用箭頭連起來的地方。看板會隨筆記一起儲存和匯出。'],
      ['卡片', '看板上的一項：一節經文、一則筆記，或者你輸入的文字。經文卡片顯示的是你目前所讀譯本中的經文。'],
      ['譯本', '聖經的一個版本，用一種語言。這裡的每個譯本都可以自由重製。'],
      ['僅完整字詞', '搜尋選項。開啟時，「love」只找 love，不找 loveth；關閉時兩者都找。'],
      ['區分大小寫', '搜尋選項。開啟時，「God」和「god」不同。'],
      ['同步到資料夾', '在本電腦的某個資料夾中保留一份筆記的文字副本，並在你書寫時更新。支援 Chrome 和 Edge。'],
      ['助理工具', '讓在你瀏覽器中執行的 AI 助理讀取資料庫並建議筆記或標記的方式。預設關閉；未經你同意不會儲存任何內容。'],
    ] as [string, string][],
    accessibilityHeading: '無障礙',
    accessibility: [
      '本應用程式力求在它自己顯示的一切內容上達到《網頁內容無障礙指引》2.2 的 AAA 級：控制項、文字、顏色和行為。每個控制項都可以用鍵盤到達，尺寸至少為 44×44 像素，會顯示焦點位置，並且有名稱。在所有配色主題下，文字與背景的對比至少為 7:1，你也可以在設定中變更字級、行距和顏色。',
      '有兩件事不在這個承諾之內。經文按出版時的樣子顯示：它的閱讀難度和讀音屬於各個譯本，而不屬於本應用程式。你寫在筆記裡的內容也一樣。',
      '可以由機器檢查的部分，每次變更都會檢查。需要人來檢查的部分 — 手機上的螢幕閱讀器、Windows 高對比主題下的應用程式 — 由人工檢查，頻率較低。如果有什麼地方對你不管用，請在專案的 GitHub 問題區回報（`AlanRoman117/scriptura`）。',
    ],
  },

  canvas: {
    new: '新增',
    startOne: '新增一個',
    label: '看板',
    heading: (board: string) => `看板：${board}`,
    noneOpenHeading: '未開啟任何看板',
    picker: '看板',
    name: '看板名稱',
    none: '還沒有看板',
    undo: (what: Removed) =>
      `復原：還原${what.kind === 'card' ? what.label : `連接${what.label}`}`,
    putBack: (what: Removed) =>
      `${what.kind === 'card' ? `已還原${what.label}` : `已還原連接${what.label}`}`,
    removed: (what: Removed) =>
      `${what.kind === 'card' ? `已移除卡片：${what.label}` : `已移除連接：${what.label}`}。可以在看板工具列中復原。`,
    addCard: '加入卡片',
    addNote: '加入筆記',
    addNoteName: '加入筆記 — 把最新的一則筆記放到看板上',
    addNoteNoNotes: '加入筆記 — 請先寫一則筆記',
    toNote: '加入筆記中',
    toNoteName: '加入筆記中 — 把這個看板放進你開啟中的筆記裡',
    connections: (count: number) => `連接（${num(count)}）`,
    connectionsLabel: '連接',
    deleteBoard: '刪除看板',
    zoom: '縮放',
    zoomOut: '縮小',
    zoomIn: '放大',
    zoomReset: (percent: string) => `縮放${percent}。回到原始大小並顯示你的卡片`,
    moveView: '移動檢視',
    viewLeft: '檢視左移',
    viewUp: '檢視上移',
    viewDown: '檢視下移',
    viewRight: '檢視右移',
    back: '返回閱讀',
    help: '說明 — 看板、鍵盤，以及各種縮寫的意思',
    noConnections: '還沒有連接。先在一張卡片上按 ⇢，再按它指向的卡片。',
    removeConnection: (edge: string) => `移除連接${edge}`,
    missingCard: '一張已不存在的卡片',
    edge: (from: string, to: string) => `${from} → ${to}`,
    frame: (cards: number) => `看板畫布，${num(cards)}張卡片`,
    frameHint: '方向鍵移動檢視，加號和減號縮放。每張卡片都可以取得焦點：方向鍵移動卡片，Alt 加方向鍵調整大小。',
    verseCard: '經文卡片',
    noteCard: '筆記卡片',
    card: '卡片',
    cardName: (kind: string, label: string, colour: string | null) =>
      `${kind}：${label}${colour ? `，${colour}` : ''}`,
    colourName: (collection: string, colour: string) => withColour(collection, colour),
    cardTitle: '卡片標題',
    cardTitlePlaceholder: '卡片',
    cardText: '卡片文字',
    cardTextPlaceholder: '在這裡寫…',
    cardBody: (title: string) => `${title} — 文字`,
    connect: (card: string) => `把${card}連到另一張卡片`,
    connectPrompt: '選擇要連到的卡片：按一下它，或在它上面按 Enter。Esc 取消。',
    connected: (from: string, to: string) => `已把${from}連到${to}`,
    open: (card: string) => `在閱讀中開啟${card}`,
    colour: (current: string | null, card: string) => `顏色：${current ?? '無'}。變更${card}的顏色`,
    adjust: (card: string) => `不用拖曳也能移動或調整${card}`,
    takeOff: (card: string) => `把${card}從看板上移除`,
    empty: '這個看板上還什麼都沒有。可以在這裡加入卡片，或在閱讀時用經文旁邊的**加入看板**。',
    adjustPanel: (card: string) => `移動並調整${card}`,
    colourPanel: (card: string) => `${card}的顏色`,
    adjustTitle: '移動與調整',
    colourTitle: '顏色',
    panelTitle: (mode: string, card: string) => `${mode}：${card}`,
    move: '移動',
    moveLeft: '左移',
    moveUp: '上移',
    moveDown: '下移',
    moveRight: '右移',
    size: '大小',
    narrower: '更窄',
    wider: '更寬',
    shorter: '更矮',
    taller: '更高',
    colours: '顏色',
    noColour: '無顏色',
    moved: (card: string, x: number, y: number) => `${card}：已移動到 ${x}，${y}`,
    resized: (card: string, w: number, h: number) => `${card}：寬 ${w}，高 ${h}`,
    coloured: (card: string, colour: string) => `${card}：${colour}`,
    uncoloured: (card: string) => `${card}：無顏色`,
    noneOpen: '沒有開啟中的看板。',
  },

  cards: {
    verseMissing: '這個譯本中沒有。',
    untitledNote: '無標題筆記',
    untitledBoard: '無標題看板',
    emptyNote: '空筆記。',
    deletedNote: '這則筆記已被刪除。',
    card: '卡片',
    emptyBoard: '_空看板_',
    connections: '連接',
    missingCard: '（已不存在的卡片）',
  },
} satisfies Messages;
