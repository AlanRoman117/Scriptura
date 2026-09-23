/**
 * 简体中文（中国大陆用字与用语）.
 *
 * Mainland conventions: “ ” for quotation, full-width punctuation (，。：？！),
 * and no space between Chinese and Latin letters or numbers. Chinese has no
 * plural — counts take measure words (节, 张, 条) and every form is `other`.
 * Key names stay as printed on keyboards (Tab, Shift, Esc).
 *
 * Its traditional sibling is zh-Hant.ts, and the two differ in wording as well
 * as in characters: 搜索/搜尋, 设置/設定, 保存/儲存.
 *
 * ⚠️ Drafted, not written by a native speaker: a native Chinese reviewer must
 * check it before release (docs/plans/reader-i18n/README.md).
 */
import { numberFor } from '../format';
import type { BookExample, ColourNames, HelpSection, Removed } from '../types';
import type { Messages } from './en-US';

/** Counts, grouped as the language groups thousands. */
const num = numberFor('zh-Hans');

const colours: ColourNames = { amber: '琥珀', rose: '玫瑰', sky: '天蓝', mint: '薄荷', violet: '紫罗兰' };
const colourWords: ColourNames = colours;

/**
 * A collection and its colour. Chinese names a colour the same way in a
 * heading and in a sentence, so an unnamed collection would otherwise read
 * “琥珀（琥珀）”.
 */
const withColour = (collection: string, colour: string) =>
  collection === colour ? collection : `${collection}（${colour}）`;

const helpSections = (book: BookExample): HelpSection[] => [
  {
    id: 'finding',
    heading: '查找经文',
    blocks: [
      { p: '在搜索框中输入经文出处，然后按 Enter。下面这些写法都可以：' },
      {
        ul: [
          `\`${book.john} 3:16\` — 一节经文。`,
          `\`${book.john} 3:16-18\` — 一段经文。`,
          `\`${book.john} 3\` — 整章。`,
          '`Juan 3:16` 或 `Jean 3:16` — 你正在读的译本里的书卷名。',
          `\`${book.abbr} 3:16\` — 简称。\`43 3:16\` — 书卷编号。`,
        ],
      },
      { p: '也可以用工具栏上的两个菜单选择书卷和章。' },
    ],
  },
  {
    id: 'searching',
    heading: '搜索',
    blocks: [
      {
        p: '不是经文出处的内容都会当作搜索。搜索会查找词语内部，所以 `爱` 也会找到*慈爱*。中文不受重音影响；在西文译本里，`amo` 也会找到*amó*。',
      },
      {
        ul: [
          '用引号括起来可以精确查找整句：`"起初"`。',
          '在词前加减号可以排除含该词的经文：`神 -爱`。',
          '**仅整词**让搜索不再查找更长词语的内部。',
          '**区分大小写**让西文的大小写起作用。',
        ],
      },
      {
        p: '先列出该词单独出现的经文；出现在更长词语内部的经文排在一行说明之后。在搜索框按 Enter，可以看到全部结果，并按书卷统计。',
      },
    ],
  },
  {
    id: 'notes',
    heading: '笔记',
    blocks: [
      {
        p: '笔记是带 Markdown 的纯文本。格式会在输入时显示，正在编辑的那一行会重新显示符号；如果只想看 Markdown，请在设置的“笔记编辑器”中选择**纯文本**。笔记上方的工具栏可以添加标题、粗体、斜体、列表和引用；再按一次同一个工具就会取消格式。使用纯文本时，**预览**显示笔记最终的样子。',
      },
      {
        p: '指向经文的链接写作 `[[john 3:16]]`。加上 `@kjv` 可以指明译本：`[[john 3:16@kjv]]`。把光标放在链接里，**前往**按钮就会打开它。经文旁边的**引用**会把该节连同出处和链接一起复制到笔记中。',
      },
      {
        p: '笔记在你输入时就保存在本设备上。**导出**会把所有笔记和看板作为文本文件打包成 .zip 下载。',
      },
    ],
  },
  {
    id: 'marks',
    heading: '标记',
    blocks: [
      {
        p: '按一节经文或它的节号，就可以用五种颜色之一标记它。每种颜色都是一个合集：用你正在研读的主题为它命名，**标记**面板会按圣经顺序列出这些经文。标记跟随经文本身，而不是译本，所以在一个译本里做的标记，在所有译本里都会显示。',
      },
      { p: '在设置里可以为每个标记加上符号，这样颜色就不是唯一的标识。' },
    ],
  },
  {
    id: 'boards',
    heading: '看板',
    blocks: [
      {
        p: '看板把经文和笔记排成可以移动的卡片，并用箭头连接起来。经文旁边的**加入看板**会把它放到当前看板上。卡片保存的是出处，而不是文本的副本，所以显示的是你正在读的译本。在看板菜单旁边的输入框里可以给看板命名。',
      },
      {
        p: '不用拖动也能移动或调整卡片大小：用它的 **✥** 按钮；改颜色用颜色按钮。缩放旁边的箭头按钮可以移动视图。看板工具栏里的**连接**用文字列出每一条箭头，也可以从那里删除。删除卡片会先询问，删除卡片或连接后，在你做出其他更改之前都可以撤销。',
      },
    ],
  },
  {
    id: 'translations',
    heading: '译本',
    blocks: [
      {
        p: '译本库按语言分组列出所有译本，并显示大小。下载之后就可以离线阅读；**对照**会把它与你正在读的译本逐节并排显示。删除译本不会影响你的笔记和标记。',
      },
    ],
  },
  {
    id: 'keyboard',
    heading: '键盘',
    blocks: [
      {
        ul: [
          '{{Tab}} 和 {{Shift}}+{{Tab}} 在控件之间移动。第一次按会提示跳到经文或笔记。',
          '{{Esc}} 关闭最后打开的东西：面板、经文操作或搜索建议。',
          '在节号上按 {{Enter}} 会打开该节的操作；方向键在其中移动。',
          '在两栏之间的分隔条上，方向键、{{Home}} 和 {{End}} 可以调整宽度；旁边的两个小按钮作用相同。',
          '在笔记中，{{Shift}}+{{Tab}} 可以到达格式工具；方向键在工具之间移动。',
          '在看板上，卡片可以获得焦点：方向键移动卡片，{{Alt}} 加方向键调整大小，{{Delete}} 会询问是否删除。焦点在看板本身时，方向键移动视图，{{+}} 和 {{−}} 缩放。',
        ],
      },
    ],
  },
];

export const zhHans = {
  app: {
    name: 'Scriptura Reader',
    downloading: '正在下载经文，以便离线使用…',
    opening: '正在打开…',
    bootFailed: '无法打开经文。请重新加载后再试。',
    skipToScripture: '跳到经文',
    skipToNotes: '跳到笔记',
    skipToBoard: '跳到看板',
    title: (where: string) => `${where} · Scriptura`,
    passageTitle: (book: string, chapter: number, id: string) => `${book}${chapter} · ${id}`,
    boardTitle: (name: string) => `${name} · 看板`,
    opened: (panel: string) => `已打开${panel}面板`,
    closed: (panel: string) => `已关闭${panel}面板`,
    boardSaveFailed: '无法保存看板 — 请导出你的笔记',
    languageChanged: '界面现在是简体中文。',
  },

  panels: {
    marks: '标记',
    translations: '译本',
    settings: '设置',
    help: '帮助',
    results: '搜索结果',
  },

  common: {
    cancel: '取消',
    untitledNote: '无标题',
    untitledBoard: '无标题看板',
    source: (name: string) => `${name}的来源`,
    undoRemove: '撤销',
    remove: '移除',
    done: '完成',
  },

  confirm: {
    permanent: '此操作无法撤销。',
    undoable: '在你做出下一次更改之前都可以撤销。',
    note: {
      title: (name: string) => `删除笔记“${name}”吗？`,
      gone: '它将从本设备上删除。',
      keepCopy: '想保留副本的话，请先导出笔记。',
      action: '删除笔记',
      done: (name: string) => `已删除笔记“${name}”`,
    },
    board: {
      title: (name: string) => `删除看板“${name}”吗？`,
      cards: (cards: number) => `看板及其${num(cards)}张卡片都会被删除。`,
      empty: '这个看板是空的。',
      kept: '你的笔记不会改变。',
      action: '删除看板',
      done: (name: string) => `已删除看板“${name}”`,
    },
    card: {
      title: (card: string) => `把${card}从看板上移除吗？`,
      connections: (count: number) => `它的${num(count)}条连接也会一并移除。`,
      noteKept: '笔记本身不会改变。',
      action: '移除卡片',
    },
    mark: {
      title: (ref: string) => `移除${ref}上的标记吗？`,
      leaves: (collection: string) => `这节经文将离开合集“${collection}”。`,
      action: '移除标记',
    },
    translation: {
      title: (name: string) => `从本设备上移除${name}吗？`,
      frees: (size: string) => `这会释放约${size}的空间。`,
      kept: '你的笔记和标记不会改变。',
      again: '联网时可以再次下载。',
      action: '移除译本',
      done: (name: string) => `已从本设备上移除${name}`,
    },
  },

  colours,
  colourWords,

  layout: {
    scripture: '经文',
    notes: '笔记',
    expandNotes: '展开笔记',
    collapseNotes: '收起笔记',
    gripWithNews: (action: string, news: string) => `${action}，${news}`,
    sheetHint: '拖动，或用上下方向键，可以让笔记区更高或更矮。',
    notesMoreRoom: '给笔记更多空间',
    bibleMoreRoom: '给圣经更多空间',
    resize: '调整两栏宽度',
    split: (bible: string, notes: string) => `圣经${bible}，笔记${notes}`,
    showNotes: '显示笔记',
    paneBible: '圣经',
    paneNotes: '笔记',
    /** The side pane holds the notes or the canvas; these name the switch and the canvas side. */
    sides: '笔记或看板',
    paneBoard: '看板',
    expandBoard: '展开看板',
    collapseBoard: '收起看板',
    showBoard: '显示看板',
    maximize: (pane: string) => `最大化${pane}`,
    restore: (pane: string) => `还原${pane}`,
  },

  reader: {
    passage: '经文',
    book: '书卷',
    chapter: '章',
    translationChip: (id: string, name: string) => `${id} — ${name}。选择或添加译本`,
    marks: '标记',
    marksChip: (count: number) => `标记（${num(count)}）— 你标记过的经文，按颜色分组`,
    settingsChip: '设置 — 显示、存储、导出与助手权限',
    helpChip: '帮助 — 查找经文、搜索、笔记、标记、看板、键盘，以及各种缩写的含义',
    markVerse: (ref: string) => `标记${ref}`,
    markVerseIn: (ref: string, collection: string, colour: string) =>
      `标记${ref} — 在${withColour(collection, colour)}中`,
    chapterMissing: (translation: string) => `${translation}中没有这一章。`,
    readingAnnounce: (translation: string) => `正在阅读${translation}`,
  },

  verseActions: {
    group: (ref: string) => `${ref}的操作`,
    mark: (collection: string, colour: string) => `标记为${withColour(collection, colour)}`,
    quote: '引用',
    link: '链接',
    canvas: '加入看板',
    canvasName: '加入看板 — 把这节经文放到看板上',
    close: (ref: string) => `关闭${ref}的操作`,
  },

  insert: {
    quoted: (ref: string) => `已引用${ref}`,
    quotedFrom: (ref: string, translation: string) => `已引用${ref}（${translation}）`,
    linked: (ref: string) => `已链接${ref}`,
    addedBoard: (board: string) => `已添加看板“${board}”`,
    addedToBoard: (ref: string, board: string) => `已把${ref}加入看板“${board}”`,
    alreadyOnBoard: (ref: string, board: string) => `${ref}已经在“${board}”上了`,
    inNewNote: (done: string) => `${done}，在新笔记中`,
    inNote: (done: string, note: string) => `${done}，在“${note}”中`,
    inUntitledNote: (done: string) => `${done}，在无标题笔记中`,
    studyBoard: '研读看板',
  },

  search: {
    label: '搜索或前往某处经文',
    placeholder: (example: string) => `搜索，或前往“${example}”`,
    hint: 'Enter 打开该处经文，或显示全部结果。下方向键进入建议列表。',
    suggestions: '建议',
    goTo: (ref: string) => `前往${ref}`,
    close: '关闭建议',
    matching: '匹配方式',
    wholeWords: '仅整词',
    wholeWordsHint: '只找 love，不找 loveth。关闭时，搜索也会查找更长词语的内部。',
    matchCase: '区分大小写',
    matchCaseHint: '大小写起作用：God 和 god 不同。',
    noMatches: '没有结果',
    matches: (total: number) => `${num(total)}条结果`,
    showing: (shown: number) => `（显示${num(shown)}条）`,
    seeAll: (total: number) => `查看全部${num(total)}条`,
    insert: (ref: string) => `把${ref}插入打开的笔记`,
    /** The name of a result's Canvas button: its visible word first (2.5.3). */
    toCanvas: (ref: string) => `加入看板 — 把${ref}放到看板上`,
    weakBelow: '以下：出现在更长的词语中',
    announceNone: (query: string) => `没有“${query}”的结果`,
    announceCount: (total: number, query: string) => `“${query}”有${num(total)}条结果`,
  },

  results: {
    label: '搜索结果',
    /** `{count}` 会被替换成总数，放在它自己的元素里。 */
    heading: (_total: number, query: string) => `“${query}”有{count}条结果`,
    close: '关闭搜索结果',
    filter: '按书卷筛选',
    allBooks: '全部书卷',
    weakBelow: (query: string) => `以下：“${query}”出现在更长的词语中`,
    insert: (ref: string) => `把${ref}引用到打开的笔记`,
    insertTitle: '引用到打开的笔记',
    showing: (shown: number, total: number) => `显示${num(total)}条中的${num(shown)}条`,
    inBook: (book: string) => `，在${book}中`,
    more: (count: number) => `再显示${num(count)}条`,
  },

  marks: {
    label: '标记过的经文',
    title: '标记',
    close: '关闭标记',
    hint: '每种颜色都是一份持续的清单。用你正在研读的主题为它命名。',
    nameFor: (colour: string) => `${colour}合集的名称`,
    empty: '这种颜色下还没有标记。',
    remove: (ref: string) => `移除${ref}上的标记`,
    removed: '标记已移除。可以在标记栏中撤销。',
    restored: '标记已恢复',
  },

  library: {
    title: '译本',
    close: '关闭译本',
    onDevice: (count: number) => `本设备上有${num(count)}个`,
    used: (used: string, quota: string) => `已用${used}，共${quota}`,
    about: (size: string) => `约${size}`,
    licences: {
      'public-domain': '公有领域',
      'cc-by-4.0': 'CC BY 4.0',
      'cc-by-sa-4.0': 'CC BY-SA 4.0',
      cc0: 'CC0',
      'custom-free': '自由许可',
    } as Record<string, string>,
    reading: '正在阅读',
    comparing: '正在对照',
    read: '阅读',
    compare: '对照',
    compareTitle: '与你正在读的译本并排显示',
    downloading: (name: string) => `正在下载${name}`,
    download: '下载',
    removeActive: (name: string) => `移除${name} — 请先切换到其他译本`,
    removeFromDevice: (name: string) => `从本设备上移除${name}`,
    note: '下载后的译本保存在本设备上，可以离线阅读。移除译本不会影响你的笔记和标记：两者都属于经文本身，而不属于某个译本。',
    progress: (name: string, percent: string) => `${name}：已下载${percent}`,
    downloaded: (name: string) => `${name}已下载`,
    failed: (name: string, error: string) => `${name}：${error}`,
    failedOnline: '下载没有完成。请稍后再试。',
    offline: '没有网络连接 — 联网后再试。',
  },

  compare: {
    label: '译本并排对照',
    compared: '对照中的译本',
    stop: (id: string) => `停止对照${id}`,
    verse: '节',
    verseBefore: '节 ',
    missing: (id: string) => `${id}中没有`,
    quote: (id: string, verse: number) => `引用${id}第${verse}节`,
  },

  notes: {
    new: '新建',
    startOne: '新建一条',
    heading: '笔记',
    picker: '笔记',
    none: '还没有笔记',
    preview: '预览',
    write: '编辑',
    previewTitle: '查看排版后的样子',
    writeTitle: '回到编辑',
    canvas: '看板',
    canvasTitle: '把经文和笔记排在看板上',
    export: '导出',
    exportTitle: '把所有笔记和看板以 Markdown 打包成 .zip 下载',
    delete: '删除',
    title: '笔记标题',
    body: '笔记正文',
    placeholder: '在这里写…',
    goTo: (where: string) => `前往${where}`,
    noneOpen: '没有打开的笔记。',
    saveFailed: '无法保存 — 请导出你的笔记',
    saving: '正在保存…',
    saved: '已保存',
    linkIn: (where: string, id: string) => `${where}（${id}）`,
    linkMissing: (where: string, id: string) => `${where}（${id} — 尚未下载）`,
  },

  tools: {
    label: '格式',
    heading: (level: number) => `${level}级标题`,
    headingGlyph: (level: number) => `H${level}`,
    bold: '粗体',
    boldGlyph: 'B',
    italic: '斜体',
    italicGlyph: 'I',
    code: '代码',
    bullets: '项目符号列表',
    numbers: '编号列表',
    quote: '引用',
    link: '经文链接',
  },

  preview: {
    empty: '还没有写任何内容。',
    editHere: (block: number) => `在此编辑（第${block}段）`,
    goTo: (where: string) => `前往${where}`,
  },

  embed: {
    scrolls: (board: string) => `看板：${board}，可左右滚动`,
    picture: (board: string, cards: number) => `看板：${board}，${num(cards)}张卡片`,
    empty: '这个看板是空的。',
    missing: '这里曾嵌入一个看板，但它已经不存在了。',
    open: '打开看板',
  },

  proposal: {
    noteTitle: '已为你草拟了一条笔记',
    marksTitle: '建议标记的经文',
    lede: '这是助手提出的。什么都还没有保存 — 请先查看，随意修改，只有你接受后才会生效。',
    titleInput: '建议的笔记标题',
    bodyInput: '建议的笔记正文',
    into: (colour: string) => `加入{collection}（${colour}）`,
    missing: '这个译本中没有。',
    discard: '放弃',
    save: '保存这条笔记',
    mark: (count: number) => `标记${num(count)}节经文`,
  },

  offer: {
    title: (language: string) => `${language}圣经`,
    intro: '这些译本是你所用语言的译本。下载一个就可以阅读，联网或离线都可以。',
    downloadAndRead: '下载并阅读',
    downloadAndReadName: (name: string) => `下载并阅读${name}`,
    allTranslations: '全部译本',
    notNow: '暂时不用',
  },

  update: {
    label: '新版本已就绪',
    ready: 'Scriptura 的新版本已就绪。',
    readyAnnounce: 'Scriptura 的新版本已就绪。方便时重新加载即可。',
    reload: '重新加载',
    reloading: '正在重新加载…',
    later: '稍后',
  },

  previewBuild: {
    label: '预览版',
    intro: '**预览版。**这是给翻译审校者使用的早期版本。',
    report: '在 GitHub 上报告翻译问题（在新标签页中打开）',
    reportShort: '报告翻译问题',
    newTab: '（在 GitHub 上，会在新标签页中打开）',
    hide: '隐藏',
    heading: '关于这个预览版',
    about:
      '这个版本是给审校西班牙语、法语、日语、中文和葡萄牙语界面的人使用的。你在这里做的一切都不会被发送到任何地方：笔记和标记都留在这个浏览器里。发现用词错误或不清楚的地方，请用下面的链接报告。它会打开 GitHub 上的一个简短表单，需要一个免费账号。',
    version: (version: string) => `版本：${version}`,
  },

  durability: {
    label: '你的笔记保存在哪里',
    denied: '这个浏览器可能会删除你的笔记以释放空间。请保存一份副本。',
    stale: '你已经有一段时间没有导出笔记了。',
    local: '你的笔记只保存在这个浏览器里。',
    saveFolder: '保存到文件夹',
    saveFolderTitle: '在你选择的文件夹中保留一份 .md 副本',
    exportNow: '立即导出',
    dismiss: '关闭此提示',
  },

  settings: {
    title: '设置',
    close: '关闭设置',
    display: '阅读与显示',
    colours: '颜色',
    themes: {
      system: '跟随设备',
      light: '浅色',
      dark: '深色',
      'hc-light': '高对比度（浅色）',
      'hc-dark': '高对比度（深色）',
      sepia: '棕褐色',
    },
    textSize: '文字大小',
    spacing: '行距',
    spacings: { normal: '标准', relaxed: '宽松', loose: '更宽松' },
    measure: '栏宽',
    measures: { narrow: '窄', normal: '标准', wide: '宽' },
    editor: '笔记编辑器',
    editors: { live: '输入时显示格式', plain: '纯文本' },
    displayNote: '“宽松”和“更宽松”的行距符合 WCAG 对行距和段距的建议。这些设置只对本设备生效。',
    accessibility: '无障碍',
    motion: '动效',
    motions: { system: '跟随设备', reduce: '减少动效' },
    markers: '为每个标记显示符号，而不只用颜色',
    storage: '你的内容保存在哪里',
    persistence: {
      persisted: '这个浏览器已同意保留你的笔记。清除网站数据仍会删除它们。',
      denied: '这个浏览器没有同意保留你的笔记。它可能会删除笔记以释放空间。',
      unsupported: '这个浏览器不会说明是否保留你的笔记。请当作它可能会删除。',
      unknown: '正在检查…',
    },
    usedOnDevice: (used: string, quota: string) => `本设备已用${used}，共${quota}。`,
    mirrored: '你的笔记也会保存到你选择的文件夹中。',
    notMirrored: '你的笔记只保存在这个浏览器里。请导出，或保存一份副本到文件夹，以免丢失。',
    exportAll: '导出全部',
    anotherFolder: '选择其他文件夹',
    mirror: '同步到文件夹',
    assistant: '助手权限',
    assistantIntro:
      '在这个浏览器里运行的 AI 助手可以读取你的资料库，并为你草拟笔记或标记。此功能默认**关闭**，除非你打开它。没有任何内容会发送给 Scriptura：助手在你的浏览器里运行，读取的数据和应用本身一样。',
    assistantToggle: '向助手开放 Scriptura 的工具',
    assistantSupported: '这个浏览器支持助手工具。',
    assistantUnsupported:
      '这个浏览器还不支持助手工具 — WebMCP 仍是早期草案，目前在 Chrome 中需要手动开启实验标志。这个开关会记住，等到支持时生效。',
    assistantReadOnly:
      '**它只能读取，不能写入。**助手可以读取你的笔记、标记和经文，但不能更改任何内容。它想添加的内容都会先完整地显示给你，只有你接受后才会保存。',
    assistantTools: (count: number) => `助手可以做的事（${num(count)}个工具）`,
    toolReads: '读取',
    toolNeedsApproval: '需要你的同意',
    toolsInEnglish: '工具说明是英文的，因为助手就是这样读取它们的。',
    help: '帮助',
    helpIntro: '如何查找经文、搜索、写笔记、标记经文和使用看板；各种缩写的含义；以及这个应用在无障碍方面的承诺。',
    openHelp: '打开帮助',
    language: '语言',
    languageLabel: '界面语言',
    languageSystem: '跟随本设备',
    languageNote: '经文仍然使用各译本自己的语言。',
  },

  help: {
    title: '帮助',
    close: '关闭帮助',
    sections: helpSections,
    abbreviations: '缩写',
    abbreviationsCaption: '每个缩写的含义',
    short: '缩写',
    meaning: '含义',
    terms: [
      ['CC BY-SA 4.0', '知识共享 署名-相同方式共享 4.0：一种自由许可协议，要求注明来源，并以相同方式共享修改。'],
      ['CC0', '知识共享 零：作者放弃了全部权利，文本可以自由使用。'],
      ['OT', '旧约（英文 Old Testament）。'],
      ['NT', '新约（英文 New Testament）。'],
      ['PWA', '渐进式网页应用：可以安装并离线使用的网站。'],
      ['WCAG', '《网页内容无障碍指南》，本应用据此衡量自己。'],
    ] as [string, string][],
    glossaryHeading: '这里用到的词',
    glossary: [
      ['合集', '你用同一种颜色标记的所有经文。用你正在研读的主题为一种颜色命名，标记面板就会按圣经顺序列出这些经文。'],
      ['看板', '把经文和笔记排成卡片、并用箭头连接起来的地方。看板会随笔记一起保存和导出。'],
      ['卡片', '看板上的一项：一节经文、一条笔记，或者你输入的文字。经文卡片显示的是你当前所读译本中的经文。'],
      ['译本', '圣经的一个版本，用一种语言。这里的每个译本都可以自由复制。'],
      ['仅整词', '搜索选项。打开时，“love”只找 love，不找 loveth；关闭时两者都找。'],
      ['区分大小写', '搜索选项。打开时，“God”和“god”不同。'],
      ['同步到文件夹', '在本电脑的某个文件夹中保留一份笔记的文本副本，并在你书写时更新。支持 Chrome 和 Edge。'],
      ['助手工具', '让在你浏览器中运行的 AI 助手读取资料库并建议笔记或标记的方式。默认关闭；未经你同意不会保存任何内容。'],
    ] as [string, string][],
    accessibilityHeading: '无障碍',
    accessibility: [
      '本应用力求在应用自身显示的一切内容上达到《网页内容无障碍指南》2.2 的 AAA 级：控件、文字、颜色和行为。每个控件都可以用键盘到达，尺寸至少为 44×44 像素，会显示焦点位置，并且有名称。在所有配色主题下，文字与背景的对比度至少为 7:1，你也可以在设置中更改字号、行距和颜色。',
      '有两件事不在这个承诺之内。经文按出版时的样子显示：它的阅读难度和读音属于各个译本，而不属于本应用。你写在笔记里的内容同样如此。',
      '可以由机器检查的部分，每次更改都会检查。需要人来检查的部分 — 手机上的屏幕阅读器、Windows 高对比度主题下的应用 — 由人工检查，频率较低。如果有什么地方对你不管用，请在项目的 GitHub 问题区报告（`AlanRoman117/scriptura`）。',
    ],
  },

  canvas: {
    new: '新建',
    startOne: '新建一个',
    label: '看板',
    heading: (board: string) => `看板：${board}`,
    noneOpenHeading: '未打开任何看板',
    picker: '看板',
    name: '看板名称',
    none: '还没有看板',
    undo: (what: Removed) =>
      `撤销：恢复${what.kind === 'card' ? what.label : `连接${what.label}`}`,
    putBack: (what: Removed) =>
      `${what.kind === 'card' ? `已恢复${what.label}` : `已恢复连接${what.label}`}`,
    removed: (what: Removed) =>
      `${what.kind === 'card' ? `已移除卡片：${what.label}` : `已移除连接：${what.label}`}。可以在看板工具栏中撤销。`,
    addCard: '添加卡片',
    addNote: '添加笔记',
    addNoteName: '添加笔记 — 把最新的一条笔记放到看板上',
    addNoteNoNotes: '添加笔记 — 请先写一条笔记',
    toNote: '加入笔记',
    toNoteName: '加入笔记 — 把这个看板放进你打开的笔记里',
    connections: (count: number) => `连接（${num(count)}）`,
    connectionsLabel: '连接',
    deleteBoard: '删除看板',
    zoom: '缩放',
    zoomOut: '缩小',
    zoomIn: '放大',
    zoomReset: (percent: string) => `缩放${percent}。恢复原始大小并显示你的卡片`,
    moveView: '移动视图',
    viewLeft: '视图左移',
    viewUp: '视图上移',
    viewDown: '视图下移',
    viewRight: '视图右移',
    help: '帮助 — 看板、键盘，以及各种缩写的含义',
    noConnections: '还没有连接。先在一张卡片上按 ⇢，再按它指向的卡片。',
    removeConnection: (edge: string) => `移除连接${edge}`,
    missingCard: '一张已不存在的卡片',
    edge: (from: string, to: string) => `${from} → ${to}`,
    frame: (cards: number) => `看板画布，${num(cards)}张卡片`,
    frameHint: '方向键移动视图，加号和减号缩放。每张卡片都可以获得焦点：方向键移动卡片，Alt 加方向键调整大小。',
    verseCard: '经文卡片',
    noteCard: '笔记卡片',
    card: '卡片',
    cardName: (kind: string, label: string, colour: string | null) =>
      `${kind}：${label}${colour ? `，${colour}` : ''}`,
    colourName: (collection: string, colour: string) => withColour(collection, colour),
    cardTitle: '卡片标题',
    cardTitlePlaceholder: '卡片',
    cardText: '卡片文字',
    cardTextPlaceholder: '在这里写…',
    cardBody: (title: string) => `${title} — 文字`,
    connect: (card: string) => `把${card}连接到另一张卡片`,
    connectPrompt: '选择要连接到的卡片：按一下它，或在它上面按 Enter。Esc 取消。',
    connected: (from: string, to: string) => `已把${from}连接到${to}`,
    open: (card: string) => `在阅读中打开${card}`,
    colour: (current: string | null, card: string) => `颜色：${current ?? '无'}。更改${card}的颜色`,
    adjust: (card: string) => `不用拖动也能移动或调整${card}`,
    takeOff: (card: string) => `把${card}从看板上移除`,
    empty: '这个看板上还什么都没有。可以在这里添加卡片，或在阅读时用经文旁边的**加入看板**。',
    adjustPanel: (card: string) => `移动并调整${card}`,
    colourPanel: (card: string) => `${card}的颜色`,
    adjustTitle: '移动与调整',
    colourTitle: '颜色',
    panelTitle: (mode: string, card: string) => `${mode}：${card}`,
    move: '移动',
    moveLeft: '左移',
    moveUp: '上移',
    moveDown: '下移',
    moveRight: '右移',
    size: '大小',
    narrower: '更窄',
    wider: '更宽',
    shorter: '更矮',
    taller: '更高',
    colours: '颜色',
    noColour: '无颜色',
    moved: (card: string, x: number, y: number) => `${card}：已移动到 ${x}，${y}`,
    resized: (card: string, w: number, h: number) => `${card}：宽 ${w}，高 ${h}`,
    coloured: (card: string, colour: string) => `${card}：${colour}`,
    uncoloured: (card: string) => `${card}：无颜色`,
    noneOpen: '没有打开的看板。',
  },

  cards: {
    verseMissing: '这个译本中没有。',
    untitledNote: '无标题笔记',
    untitledBoard: '无标题看板',
    emptyNote: '空笔记。',
    deletedNote: '这条笔记已被删除。',
    card: '卡片',
    emptyBoard: '_空看板_',
    connections: '连接',
    missingCard: '（已不存在的卡片）',
  },
} satisfies Messages;
