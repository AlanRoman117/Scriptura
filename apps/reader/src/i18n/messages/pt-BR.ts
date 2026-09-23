/**
 * Português (Brasil).
 *
 * Você, as Brazilian software addresses its readers, and Brazilian spelling
 * throughout (arquivo, tela, configurações). Quotation marks are “ ”, as in
 * Spanish. Portuguese counts 0 and 1 as singular and has a `many` form for
 * millions, so every count goes through `plural`.
 *
 * ⚠️ Drafted, not written by a native speaker: a native Brazilian reviewer
 * must check it before release (docs/plans/reader-i18n/README.md).
 */
import { numberFor, pluralFor } from '../format';
import type { BookExample, ColourNames, HelpSection, Removed } from '../types';
import type { Messages } from './en-US';

const plural = pluralFor('pt-BR');
/** Counts, grouped as the language groups thousands. */
const num = numberFor('pt-BR');

const colours: ColourNames = { amber: 'Âmbar', rose: 'Rosa', sky: 'Céu', mint: 'Menta', violet: 'Violeta' };
const colourWords: ColourNames = { amber: 'âmbar', rose: 'rosa', sky: 'céu', mint: 'menta', violet: 'violeta' };

const helpSections = (book: BookExample): HelpSection[] => [
  {
    id: 'finding',
    heading: 'Encontrar uma passagem',
    blocks: [
      { p: 'Digite uma referência no campo de pesquisa e pressione Enter. Todas estas formas funcionam:' },
      {
        ul: [
          `\`${book.john} 3:16\` — um versículo.`,
          `\`${book.john} 3:16-18\` — um intervalo de versículos.`,
          `\`${book.john} 3\` — um capítulo inteiro.`,
          '`Juan 3:16` ou `Jean 3:16` — o nome do livro na tradução que você está lendo.',
          `\`${book.abbr} 3:16\` — uma abreviação. \`43 3:16\` — o número do livro.`,
        ],
      },
      { p: 'Você também pode escolher o livro e o capítulo nos dois menus da barra.' },
    ],
  },
  {
    id: 'searching',
    heading: 'Pesquisar',
    blocks: [
      {
        p: 'Tudo que não for uma referência é uma pesquisa. A pesquisa olha dentro das palavras, então `amor` também encontra *amoroso*. Os acentos não importam: `amo` encontra *amô*.',
      },
      {
        ul: [
          'Coloque uma frase entre aspas para encontrá-la exatamente: `"no princípio"`.',
          'Coloque um sinal de menos antes de uma palavra para deixar de fora os versículos que a contêm: `Deus -amor`.',
          '**Apenas palavras inteiras** impede que a pesquisa olhe dentro de palavras maiores.',
          '**Diferenciar maiúsculas** faz as letras maiúsculas contarem.',
        ],
      },
      {
        p: 'Primeiro vêm os versículos em que a palavra aparece sozinha; os versículos em que ela está dentro de uma palavra maior vêm depois de uma linha que avisa. Pressione Enter na pesquisa para ver todos os resultados, contados por livro.',
      },
    ],
  },
  {
    id: 'notes',
    heading: 'Notas',
    blocks: [
      {
        p: 'As notas são texto simples com Markdown. A barra acima da nota adiciona títulos, negrito, itálico, listas e citações; pressione a mesma ferramenta de novo para tirar a formatação. **Visualizar** mostra a nota como ela vai ficar.',
      },
      {
        p: 'Um link para uma passagem se escreve `[[john 3:16]]`. Acrescente `@kjv` para dizer a tradução: `[[john 3:16@kjv]]`. Coloque o cursor dentro de um link e o botão **Ir para** o abre. **Citar**, ao lado de um versículo, copia o versículo para a sua nota com a referência e um link.',
      },
      {
        p: 'As notas são salvas neste dispositivo enquanto você escreve. **Exportar** baixa todas as notas e quadros como arquivos de texto em um .zip.',
      },
    ],
  },
  {
    id: 'marks',
    heading: 'Marcas',
    blocks: [
      {
        p: 'Pressione um versículo, ou o número dele, para marcá-lo em uma de cinco cores. Cada cor é uma coleção: dê a ela o nome do assunto que você acompanha, e o painel **Marcas** lista os versículos na ordem da Bíblia. As marcas acompanham a passagem, não a tradução, então uma marca feita em uma tradução aparece em todas.',
      },
      { p: 'Nas configurações você pode acrescentar um símbolo a cada marca, para que a cor não seja o único sinal.' },
    ],
  },
  {
    id: 'boards',
    heading: 'Quadros',
    blocks: [
      {
        p: 'Um quadro dispõe versículos e notas como cartões que você pode mover e ligar com setas. **Ao quadro**, ao lado de um versículo, o coloca no quadro atual. Os cartões guardam uma referência, não uma cópia do texto, então mostram a tradução que você está lendo. Dê um nome ao quadro no campo ao lado do menu de quadros.',
      },
      {
        p: 'Para mover ou redimensionar um cartão sem arrastar, use o botão **✥**; para colori-lo, o botão de cor. Os botões de seta ao lado do zoom movem a vista. **Conexões**, na barra do quadro, descreve cada seta em palavras e permite remover uma. Remover um cartão pede confirmação, e remover um cartão ou uma conexão pode ser desfeito até você mudar outra coisa.',
      },
    ],
  },
  {
    id: 'translations',
    heading: 'Traduções',
    blocks: [
      {
        p: 'A biblioteca lista todas as traduções, agrupadas por idioma, com o tamanho de cada uma. Baixe uma para lê-la offline; **Comparar** a mostra ao lado da que você está lendo, versículo por versículo. Remover uma tradução nunca mexe nas suas notas nem nas suas marcas.',
      },
    ],
  },
  {
    id: 'keyboard',
    heading: 'Teclado',
    blocks: [
      {
        ul: [
          '{{Tab}} e {{Shift}}+{{Tab}} movem entre os controles. O primeiro toque oferece pular para o texto ou para as notas.',
          '{{Esc}} fecha o que abriu por último: um painel, as ações do versículo, as sugestões da pesquisa.',
          '{{Enter}} no número de um versículo abre as ações dele; as setas movem entre elas.',
          'Na divisória entre os painéis, as setas, {{Home}} e {{End}} redimensionam; os dois botões pequenos fazem o mesmo.',
          'Em uma nota, {{Shift}}+{{Tab}} chega às ferramentas de formatação; as setas movem entre elas.',
          'Em um quadro, os cartões recebem o foco: as setas movem um cartão, {{Alt}} com uma seta muda o tamanho e {{Delete}} pede para removê-lo. Com o quadro em foco, as setas movem a vista e {{+}} e {{−}} dão zoom.',
        ],
      },
    ],
  },
];

export const ptBR = {
  app: {
    name: 'Scriptura Reader',
    downloading: 'Baixando o texto para uso offline…',
    opening: 'Abrindo…',
    bootFailed: 'Não foi possível abrir o texto bíblico. Recarregue para tentar de novo.',
    skipToScripture: 'Pular para o texto bíblico',
    skipToNotes: 'Pular para as notas',
    title: (where: string) => `${where} · Scriptura`,
    passageTitle: (book: string, chapter: number, id: string) => `${book} ${chapter} · ${id}`,
    boardTitle: (name: string) => `${name} · Quadros`,
    opened: (panel: string) => `Painel ${panel} aberto`,
    closed: (panel: string) => `Painel ${panel} fechado`,
    boardSaveFailed: 'Não foi possível salvar o quadro — exporte suas notas',
    languageChanged: 'A interface agora está em português.',
  },

  panels: {
    marks: 'Marcas',
    translations: 'Traduções',
    settings: 'Configurações',
    help: 'Ajuda',
    results: 'Resultados da pesquisa',
  },

  common: {
    cancel: 'Cancelar',
    untitledNote: 'Sem título',
    untitledBoard: 'Quadro sem título',
    source: (name: string) => `Fonte de ${name}`,
    undoRemove: 'Desfazer',
    remove: 'Remover',
    done: 'Pronto',
  },

  confirm: {
    permanent: 'Isso não pode ser desfeito.',
    undoable: 'Você pode desfazer isso até a próxima mudança.',
    note: {
      title: (name: string) => `Excluir a nota “${name}”?`,
      gone: 'Ela será excluída deste dispositivo.',
      keepCopy: 'Para guardar uma cópia, exporte suas notas antes.',
      action: 'Excluir nota',
      done: (name: string) => `A nota “${name}” foi excluída`,
    },
    board: {
      title: (name: string) => `Excluir o quadro “${name}”?`,
      cards: (cards: number) =>
        plural(cards, {
          one: 'O quadro e o cartão dele serão excluídos.',
          many: `O quadro e seus ${num(cards)} cartões serão excluídos.`,
          other: `O quadro e seus ${num(cards)} cartões serão excluídos.`,
        }),
      empty: 'O quadro está vazio.',
      kept: 'Suas notas não mudam.',
      action: 'Excluir quadro',
      done: (name: string) => `O quadro “${name}” foi excluído`,
    },
    card: {
      title: (card: string) => `Remover ${card} do quadro?`,
      connections: (count: number) =>
        plural(count, {
          one: 'A conexão dele também será removida.',
          many: `Suas ${num(count)} conexões também serão removidas.`,
          other: `Suas ${num(count)} conexões também serão removidas.`,
        }),
      noteKept: 'A nota em si não muda.',
      action: 'Remover cartão',
    },
    mark: {
      title: (ref: string) => `Remover a marca em ${ref}?`,
      leaves: (collection: string) => `O versículo sai da coleção “${collection}”.`,
      action: 'Remover marca',
    },
    translation: {
      title: (name: string) => `Remover ${name} deste dispositivo?`,
      frees: (size: string) => `Isso libera cerca de ${size}.`,
      kept: 'Suas notas e marcas não mudam.',
      again: 'Você pode baixá-la de novo quando estiver online.',
      action: 'Remover tradução',
      done: (name: string) => `${name} foi removida deste dispositivo`,
    },
  },

  colours,
  colourWords,

  layout: {
    scripture: 'Texto bíblico',
    notes: 'Notas',
    expandNotes: 'Abrir as notas',
    collapseNotes: 'Fechar as notas',
    gripWithNews: (action: string, news: string) => `${action}, ${news}`,
    sheetHint: 'Arraste, ou use as setas para cima e para baixo, para deixar as notas maiores ou menores.',
    notesMoreRoom: 'Dar mais espaço às notas',
    bibleMoreRoom: 'Dar mais espaço à Bíblia',
    resize: 'Redimensionar os painéis',
    split: (bible: string, notes: string) => `${bible} Bíblia, ${notes} notas`,
    showNotes: 'Mostrar as notas',
    paneBible: 'Bíblia',
    paneNotes: 'Notas',
    maximize: (pane: string) => `Maximizar ${pane}`,
    restore: (pane: string) => `Restaurar ${pane}`,
  },

  reader: {
    passage: 'Passagem',
    book: 'Livro',
    chapter: 'Capítulo',
    translationChip: (id: string, name: string) => `${id} — ${name}. Escolher ou adicionar uma tradução`,
    marks: 'Marcas',
    marksChip: (count: number) => `Marcas (${num(count)}) — versículos que você marcou, por cor`,
    settingsChip: 'Configurações — exibição, armazenamento, exportação e acesso do assistente',
    helpChip:
      'Ajuda — encontrar passagens, pesquisar, notas, marcas, quadros, teclado e o que significam as abreviações',
    markVerse: (ref: string) => `Marcar ${ref}`,
    markVerseIn: (ref: string, collection: string, colour: string) => `Marcar ${ref} — em ${collection} (${colour})`,
    chapterMissing: (translation: string) => `Este capítulo não está em ${translation}.`,
    readingAnnounce: (translation: string) => `Lendo ${translation}`,
  },

  verseActions: {
    group: (ref: string) => `Ações para ${ref}`,
    mark: (collection: string, colour: string) => `Marcar como ${collection} (${colour})`,
    quote: 'Citar',
    link: 'Vincular',
    canvas: 'Ao quadro',
    canvasName: 'Ao quadro — colocar este versículo no quadro',
    close: (ref: string) => `Fechar as ações de ${ref}`,
  },

  insert: {
    quoted: (ref: string) => `${ref} foi citado`,
    quotedFrom: (ref: string, translation: string) => `${ref} (${translation}) foi citado`,
    linked: (ref: string) => `${ref} foi vinculado`,
    addedBoard: (board: string) => `O quadro “${board}” foi adicionado`,
    addedToBoard: (ref: string, board: string) => `${ref} foi adicionado ao quadro “${board}”`,
    alreadyOnBoard: (ref: string, board: string) => `${ref} já está em “${board}”`,
    inNewNote: (done: string) => `${done} em uma nota nova`,
    inNote: (done: string, note: string) => `${done} em “${note}”`,
    inUntitledNote: (done: string) => `${done} em uma nota sem título`,
    studyBoard: 'Quadro de estudo',
  },

  search: {
    label: 'Pesquisar ou ir para uma referência',
    placeholder: (example: string) => `Pesquise, ou vá para “${example}”`,
    hint: 'Enter abre a passagem, ou todos os resultados. A seta para baixo entra nas sugestões.',
    suggestions: 'Sugestões',
    goTo: (ref: string) => `Ir para ${ref}`,
    close: 'Fechar as sugestões',
    matching: 'Correspondência',
    wholeWords: 'Apenas palavras inteiras',
    wholeWordsHint: 'Encontra amor, mas não amoroso. Desligado, a pesquisa também olha dentro de palavras maiores.',
    matchCase: 'Diferenciar maiúsculas',
    matchCaseHint: 'As maiúsculas contam: Deus e deus são diferentes.',
    noMatches: 'Nenhum resultado',
    matches: (total: number) =>
      plural(total, {
        one: `${num(total)} resultado`,
        many: `${num(total)} de resultados`,
        other: `${num(total)} resultados`,
      }),
    showing: (shown: number) => ` — mostrando ${num(shown)}`,
    seeAll: (total: number) => `Ver todos os ${num(total)}`,
    insert: (ref: string) => `Inserir ${ref} na nota aberta`,
    weakBelow: 'Abaixo: dentro de uma palavra maior',
    announceNone: (query: string) => `Nenhum resultado para “${query}”`,
    announceCount: (total: number, query: string) =>
      plural(total, {
        one: `${num(total)} resultado para “${query}”`,
        many: `${num(total)} de resultados para “${query}”`,
        other: `${num(total)} resultados para “${query}”`,
      }),
  },

  results: {
    label: 'Resultados da pesquisa',
    heading: (total: number, query: string) =>
      plural(total, {
        one: `{count} resultado para “${query}”`,
        many: `{count} de resultados para “${query}”`,
        other: `{count} resultados para “${query}”`,
      }),
    close: 'Fechar os resultados',
    filter: 'Filtrar por livro',
    allBooks: 'Todos os livros',
    weakBelow: (query: string) => `Abaixo: “${query}” dentro de uma palavra maior`,
    insert: (ref: string) => `Citar ${ref} na nota aberta`,
    insertTitle: 'Citar na nota aberta',
    showing: (shown: number, total: number) => `Mostrando ${num(shown)} de ${num(total)}`,
    inBook: (book: string) => ` em ${book}`,
    more: (count: number) => `Mostrar mais ${num(count)}`,
  },

  marks: {
    label: 'Versículos marcados',
    title: 'Marcas',
    close: 'Fechar as marcas',
    hint: 'Cada cor é uma lista contínua. Dê a uma delas o nome do assunto que você acompanha.',
    nameFor: (colour: string) => `Nome da coleção ${colour}`,
    empty: 'Ainda não há nada marcado nesta cor.',
    remove: (ref: string) => `Remover a marca em ${ref}`,
    removed: 'A marca foi removida. Você pode desfazer na barra de Marcas.',
    restored: 'A marca foi restaurada',
  },

  library: {
    title: 'Traduções',
    close: 'Fechar as traduções',
    onDevice: (count: number) => `${num(count)} neste dispositivo`,
    used: (used: string, quota: string) => `${used} de ${quota} em uso`,
    about: (size: string) => `cerca de ${size}`,
    licences: {
      'public-domain': 'Domínio público',
      'cc-by-4.0': 'CC BY 4.0',
      'cc-by-sa-4.0': 'CC BY-SA 4.0',
      cc0: 'CC0',
      'custom-free': 'Licença livre',
    } as Record<string, string>,
    reading: 'Lendo',
    comparing: 'Comparando',
    read: 'Ler',
    compare: 'Comparar',
    compareTitle: 'Mostrar ao lado da tradução que você está lendo',
    downloading: (name: string) => `Baixando ${name}`,
    download: 'Baixar',
    removeActive: (name: string) => `Remover ${name} — mude para outra tradução antes`,
    removeFromDevice: (name: string) => `Remover ${name} deste dispositivo`,
    note: 'Uma tradução baixada fica neste dispositivo e pode ser lida offline. Removê-la nunca mexe nas suas notas nem nas suas marcas: as duas pertencem à passagem, não a uma tradução.',
    progress: (name: string, percent: string) => `${name}: ${percent} baixado`,
    downloaded: (name: string) => `${name} foi baixada`,
    failed: (name: string, error: string) => `${name}: ${error}`,
    failedOnline: 'O download não terminou. Tente de novo mais tarde.',
    offline: 'Sem conexão — tente de novo quando estiver online.',
  },

  compare: {
    label: 'Traduções lado a lado',
    compared: 'Traduções comparadas',
    stop: (id: string) => `Parar de comparar ${id}`,
    verse: 'Versículo',
    verseBefore: 'Versículo ',
    missing: (id: string) => `Não está em ${id}`,
    quote: (id: string, verse: number) => `Citar o versículo ${verse} de ${id}`,
  },

  notes: {
    /** Uma nota nova: feminino. */
    new: 'Nova',
    startOne: 'Criar uma',
    heading: 'Notas',
    picker: 'Nota',
    none: 'Ainda não há notas',
    preview: 'Visualizar',
    write: 'Escrever',
    previewTitle: 'Ver como fica',
    writeTitle: 'Voltar a escrever',
    canvas: 'Quadros',
    canvasTitle: 'Dispor versículos e notas em um quadro',
    export: 'Exportar',
    exportTitle: 'Baixar todas as notas e quadros em Markdown, em um .zip',
    delete: 'Excluir',
    title: 'Título da nota',
    body: 'Corpo da nota',
    placeholder: 'Escreva aqui…',
    goTo: (where: string) => `Ir para ${where}`,
    noneOpen: 'Nenhuma nota aberta.',
    saveFailed: 'Não foi possível salvar — exporte suas notas',
    saving: 'Salvando…',
    saved: 'Salvo',
    linkIn: (where: string, id: string) => `${where} (${id})`,
    linkMissing: (where: string, id: string) => `${where} (${id} — não baixada)`,
  },

  tools: {
    label: 'Formatação',
    heading: (level: number) => `Título ${level}`,
    headingGlyph: (level: number) => `T${level}`,
    bold: 'Negrito',
    boldGlyph: 'N',
    italic: 'Itálico',
    italicGlyph: 'I',
    code: 'Código',
    bullets: 'Lista com marcadores',
    numbers: 'Lista numerada',
    quote: 'Citação',
    link: 'Link para uma passagem',
  },

  preview: {
    empty: 'Ainda não há nada escrito.',
    editHere: (block: number) => `Editar aqui (bloco ${block})`,
    goTo: (where: string) => `Ir para ${where}`,
  },

  embed: {
    scrolls: (board: string) => `Quadro: ${board}, rola para os lados`,
    picture: (board: string, cards: number) => `Quadro: ${board}, ${num(cards)} cartões`,
    empty: 'Este quadro está vazio.',
    missing: 'Um quadro foi inserido aqui, mas ele não existe mais.',
    open: 'Abrir o quadro',
  },

  proposal: {
    noteTitle: 'Uma nota foi rascunhada para você',
    marksTitle: 'Versículos sugeridos para marcar',
    lede: 'Um assistente propôs isto. Nada foi salvo — revise, mude o que quiser, e só vale quando você aceitar.',
    titleInput: 'Título proposto para a nota',
    bodyInput: 'Corpo proposto para a nota',
    into: (colour: string) => `Em {collection} (${colour})`,
    missing: 'Não está nesta tradução.',
    discard: 'Descartar',
    save: 'Salvar esta nota',
    mark: (count: number) =>
      plural(count, {
        one: `Marcar ${num(count)} versículo`,
        many: `Marcar ${num(count)} de versículos`,
        other: `Marcar ${num(count)} versículos`,
      }),
  },

  offer: {
    title: (language: string) => `Bíblias em ${language}`,
    intro: 'Estas traduções estão no seu idioma. Baixe uma para lê-la, com ou sem conexão.',
    downloadAndRead: 'Baixar e ler',
    downloadAndReadName: (name: string) => `Baixar e ler ${name}`,
    allTranslations: 'Todas as traduções',
    notNow: 'Agora não',
  },

  update: {
    label: 'Uma nova versão está pronta',
    ready: 'Uma nova versão do Scriptura está pronta.',
    readyAnnounce: 'Uma nova versão do Scriptura está pronta. Recarregue quando quiser.',
    reload: 'Recarregar',
    reloading: 'Recarregando…',
    later: 'Depois',
  },

  previewBuild: {
    label: 'Versão prévia',
    intro: '**Versão prévia.** Uma versão inicial para quem revisa as traduções.',
    report: 'Relatar uma correção de tradução no GitHub (abre em uma nova aba)',
    reportShort: 'Relatar uma correção',
    newTab: '(no GitHub, abre em uma nova aba)',
    hide: 'Ocultar',
    heading: 'Sobre esta versão prévia',
    about:
      'Esta versão é para quem revisa a interface em espanhol, francês, japonês, chinês e português. Nada do que você faz aqui é enviado a lugar nenhum: suas notas e marcas ficam neste navegador. Para relatar uma palavra errada ou pouco clara, use o link abaixo. Ele abre um formulário curto no GitHub, que pede uma conta gratuita.',
    version: (version: string) => `Versão: ${version}`,
  },

  durability: {
    label: 'Onde suas notas ficam',
    denied: 'Este navegador pode apagar suas notas para liberar espaço. Guarde uma cópia.',
    stale: 'Faz um tempo que você não exporta suas notas.',
    local: 'Suas notas ficam só neste navegador.',
    saveFolder: 'Salvar em uma pasta',
    saveFolderTitle: 'Guardar uma cópia em arquivos .md numa pasta que você escolher',
    exportNow: 'Exportar agora',
    dismiss: 'Dispensar este aviso',
  },

  settings: {
    title: 'Configurações',
    close: 'Fechar as configurações',
    display: 'Leitura e exibição',
    colours: 'Cores',
    themes: {
      system: 'Seguir o dispositivo',
      light: 'Claro',
      dark: 'Escuro',
      'hc-light': 'Alto contraste, claro',
      'hc-dark': 'Alto contraste, escuro',
      sepia: 'Sépia',
    },
    textSize: 'Tamanho do texto',
    spacing: 'Espaçamento entre linhas',
    spacings: { normal: 'Normal', relaxed: 'Folgado', loose: 'Amplo' },
    measure: 'Largura da coluna',
    measures: { narrow: 'Estreita', normal: 'Normal', wide: 'Larga' },
    editor: 'Editor de notas',
    editors: { live: 'Mostrar a formatação ao escrever', plain: 'Texto simples' },
    displayNote:
      'Os espaçamentos Folgado e Amplo atendem à orientação da WCAG para espaçamento de linhas e parágrafos. Estas opções valem só para este dispositivo.',
    accessibility: 'Acessibilidade',
    motion: 'Movimento',
    motions: { system: 'Seguir o dispositivo', reduce: 'Reduzir o movimento' },
    markers: 'Mostrar um símbolo em cada marca, não só uma cor',
    storage: 'Onde seu trabalho fica',
    persistence: {
      persisted: 'Este navegador concordou em guardar suas notas. Limpar os dados do site ainda as apaga.',
      denied: 'Este navegador não concordou em guardar suas notas. Ele pode apagá-las para liberar espaço.',
      unsupported: 'Este navegador não diz se guarda suas notas. Considere que ele pode apagá-las.',
      unknown: 'Verificando…',
    },
    usedOnDevice: (used: string, quota: string) => `${used} de ${quota} em uso neste dispositivo.`,
    mirrored: 'Suas notas também são salvas na pasta que você escolheu.',
    notMirrored:
      'Suas notas ficam só neste navegador. Exporte-as, ou salve uma cópia numa pasta, para mantê-las seguras.',
    exportAll: 'Exportar tudo',
    anotherFolder: 'Escolher outra pasta',
    mirror: 'Espelhar em uma pasta',
    assistant: 'Acesso do assistente',
    assistantIntro:
      'Um assistente de IA rodando neste navegador pode ler sua biblioteca e rascunhar notas ou marcas para você. Isso fica **desligado** até você ligar. Nada é enviado ao Scriptura: o assistente roda no seu navegador e lê os mesmos dados que o app.',
    assistantToggle: 'Oferecer as ferramentas do Scriptura a um assistente',
    assistantSupported: 'Este navegador é compatível com as ferramentas de assistente.',
    assistantUnsupported:
      'Este navegador ainda não é compatível com as ferramentas de assistente — o WebMCP é um rascunho inicial, disponível no Chrome atrás de uma flag. A opção fica guardada para quando for.',
    assistantReadOnly:
      '**Ele lê, não escreve.** Um assistente pode ler suas notas, marcas e passagens, mas não pode mudar nada. Tudo o que ele quiser acrescentar é mostrado a você por inteiro antes, e só é salvo quando você aceita.',
    assistantTools: (count: number) => `O que um assistente poderia fazer (${num(count)} ferramentas)`,
    toolReads: 'lê',
    toolNeedsApproval: 'precisa da sua aprovação',
    toolsInEnglish: 'As descrições estão em inglês, como o assistente as lê.',
    help: 'Ajuda',
    helpIntro:
      'Como encontrar uma passagem, pesquisar, escrever notas, marcar versículos e usar quadros; o que significam as abreviações; e o que este app promete sobre acessibilidade.',
    openHelp: 'Abrir a ajuda',
    language: 'Idioma',
    languageLabel: 'Idioma da interface',
    languageSystem: 'Seguir este dispositivo',
    languageNote: 'O texto bíblico continua no idioma de cada tradução.',
  },

  help: {
    title: 'Ajuda',
    close: 'Fechar a ajuda',
    sections: helpSections,
    abbreviations: 'Abreviações',
    abbreviationsCaption: 'O que significa cada abreviação',
    short: 'Abreviação',
    meaning: 'Significado',
    terms: [
      [
        'CC BY-SA 4.0',
        'Creative Commons Atribuição–CompartilhaIgual 4.0: uma licença livre que pede que você credite a fonte e compartilhe as mudanças nos mesmos termos.',
      ],
      ['CC0', 'Creative Commons Zero: o autor abriu mão de todos os direitos; o texto é livre para usar.'],
      ['OT', 'Antigo Testamento (em inglês, Old Testament).'],
      ['NT', 'Novo Testamento.'],
      ['PWA', 'Progressive web app: um site que você pode instalar e usar offline.'],
      ['WCAG', 'Web Content Accessibility Guidelines, o padrão pelo qual este app é medido.'],
    ] as [string, string][],
    glossaryHeading: 'Palavras usadas aqui',
    glossary: [
      [
        'Coleção',
        'Todos os versículos que você marca em uma cor. Dê a uma cor o nome do assunto que você acompanha, e o painel Marcas lista esses versículos na ordem da Bíblia.',
      ],
      [
        'Quadro',
        'Um espaço onde versículos e notas ficam dispostos como cartões e ligados por setas. Os quadros são salvos e exportados junto com suas notas.',
      ],
      [
        'Cartão',
        'Um item de um quadro: um versículo, uma nota ou um texto que você escreveu. Um cartão de versículo mostra o versículo da tradução que você estiver lendo.',
      ],
      ['Tradução', 'Uma versão da Bíblia, em um idioma. Todas as traduções daqui são livres para copiar.'],
      [
        'Apenas palavras inteiras',
        'Uma opção da pesquisa. Ligada, “amor” encontra amor, mas não amoroso. Desligada, encontra os dois.',
      ],
      ['Diferenciar maiúsculas', 'Uma opção da pesquisa. Ligada, “Deus” e “deus” são diferentes.'],
      [
        'Espelhar em uma pasta',
        'Guardar uma cópia das suas notas como arquivos de texto numa pasta deste computador, atualizada enquanto você escreve. Funciona no Chrome e no Edge.',
      ],
      [
        'Ferramentas de assistente',
        'Um jeito de um assistente de IA rodando no seu navegador ler sua biblioteca e sugerir notas ou marcas. Fica desligado até você ligar; nada é salvo sem a sua aprovação.',
      ],
    ] as [string, string][],
    accessibilityHeading: 'Acessibilidade',
    accessibility: [
      'Este app busca atender às Diretrizes de Acessibilidade para Conteúdo Web 2.2 no nível AAA em tudo o que o próprio app mostra: seus controles, seu texto, suas cores e seu comportamento. Todo controle pode ser alcançado pelo teclado, tem pelo menos 44 por 44 pixels, mostra onde está o foco e tem um nome. O texto fica em pelo menos 7:1 contra o fundo em todos os temas de cor, e você pode mudar o tamanho, o espaçamento e as cores nas configurações.',
      'Duas coisas ficam fora dessa promessa. O texto bíblico é mostrado como foi publicado: a dificuldade de leitura e a pronúncia das palavras pertencem a cada tradução, não a este app. O mesmo vale para o que você escreve nas suas notas.',
      'O que é verificado por máquina é verificado a cada mudança. O que precisa de uma pessoa — um leitor de tela no celular, o app sob um tema de contraste do Windows — é verificado à mão, com menos frequência. Se alguma coisa não funcionar para você, relate no rastreador de problemas do projeto no GitHub (`AlanRoman117/scriptura`).',
    ],
  },

  canvas: {
    /** Um quadro novo: masculino. */
    new: 'Novo',
    startOne: 'Criar um',
    label: 'Quadros',
    heading: (board: string) => `Quadro: ${board}`,
    noneOpenHeading: 'nenhum aberto',
    picker: 'Quadro',
    name: 'Nome do quadro',
    none: 'Ainda não há quadros',
    undo: (what: Removed) =>
      `Desfazer: recolocar ${what.kind === 'card' ? what.label : `a conexão ${what.label}`}`,
    putBack: (what: Removed) =>
      `${what.kind === 'card' ? `${what.label} foi recolocado` : `A conexão ${what.label} foi recolocada`}`,
    removed: (what: Removed) =>
      `${what.kind === 'card' ? `Cartão removido: ${what.label}` : `Conexão removida: ${what.label}`}. Você pode desfazer na barra do quadro.`,
    addCard: 'Adicionar cartão',
    addNote: 'Adicionar nota',
    addNoteName: 'Adicionar nota — colocar a nota mais recente no quadro',
    addNoteNoNotes: 'Adicionar nota — escreva uma nota antes',
    toNote: 'Adicionar à nota',
    toNoteName: 'Adicionar à nota — colocar este quadro na nota que você tem aberta',
    connections: (count: number) => `Conexões (${num(count)})`,
    connectionsLabel: 'Conexões',
    deleteBoard: 'Excluir quadro',
    zoom: 'Zoom',
    zoomOut: 'Diminuir o zoom',
    zoomIn: 'Aumentar o zoom',
    zoomReset: (percent: string) => `Zoom ${percent}. Voltar ao tamanho normal, mostrando seus cartões`,
    moveView: 'Mover a vista',
    viewLeft: 'Mover a vista para a esquerda',
    viewUp: 'Mover a vista para cima',
    viewDown: 'Mover a vista para baixo',
    viewRight: 'Mover a vista para a direita',
    back: 'Voltar à leitura',
    help: 'Ajuda — quadros, teclado e o que significam as abreviações',
    noConnections: 'Ainda não há conexões. Pressione ⇢ em um cartão e depois o cartão aonde ele leva.',
    removeConnection: (edge: string) => `Remover a conexão ${edge}`,
    missingCard: 'um cartão que não existe',
    edge: (from: string, to: string) => `${from} → ${to}`,
    frame: (cards: number) =>
      plural(cards, {
        one: `Área do quadro, ${num(cards)} cartão`,
        many: `Área do quadro, ${num(cards)} de cartões`,
        other: `Área do quadro, ${num(cards)} cartões`,
      }),
    frameHint:
      'As setas movem a vista; mais e menos dão zoom. Cada cartão recebe o foco: as setas o movem, e Alt com uma seta muda o tamanho.',
    verseCard: 'Cartão de versículo',
    noteCard: 'Cartão de nota',
    card: 'Cartão',
    cardName: (kind: string, label: string, colour: string | null) =>
      `${kind}: ${label}${colour ? `, ${colour}` : ''}`,
    colourName: (collection: string, colour: string) => `${collection} (${colour})`,
    cardTitle: 'Título do cartão',
    cardTitlePlaceholder: 'Cartão',
    cardText: 'Texto do cartão',
    cardTextPlaceholder: 'Escreva aqui…',
    cardBody: (title: string) => `${title} — texto`,
    connect: (card: string) => `Conectar ${card} a outro cartão`,
    connectPrompt: 'Escolha o cartão a conectar: pressione nele, ou Enter sobre ele. Esc cancela.',
    connected: (from: string, to: string) => `${from} foi conectado a ${to}`,
    open: (card: string) => `Abrir ${card} na leitura`,
    colour: (current: string | null, card: string) =>
      `Cor: ${current ?? 'nenhuma'}. Mudar a cor de ${card}`,
    adjust: (card: string) => `Mover ou redimensionar ${card} sem arrastar`,
    takeOff: (card: string) => `Tirar ${card} do quadro`,
    empty:
      'Ainda não há nada neste quadro. Adicione um cartão aqui, ou use **Ao quadro** ao lado de um versículo enquanto lê.',
    adjustPanel: (card: string) => `Mover e redimensionar ${card}`,
    colourPanel: (card: string) => `Cor de ${card}`,
    adjustTitle: 'Mover e redimensionar',
    colourTitle: 'Cor',
    panelTitle: (mode: string, card: string) => `${mode}: ${card}`,
    move: 'Mover',
    moveLeft: 'Mover para a esquerda',
    moveUp: 'Mover para cima',
    moveDown: 'Mover para baixo',
    moveRight: 'Mover para a direita',
    size: 'Tamanho',
    narrower: 'Mais estreito',
    wider: 'Mais largo',
    shorter: 'Mais baixo',
    taller: 'Mais alto',
    colours: 'Cores',
    noColour: 'Sem cor',
    moved: (card: string, x: number, y: number) => `${card}: movido para ${x}, ${y}`,
    resized: (card: string, w: number, h: number) => `${card}: ${w} de largura, ${h} de altura`,
    coloured: (card: string, colour: string) => `${card}: ${colour}`,
    uncoloured: (card: string) => `${card}: sem cor`,
    noneOpen: 'Nenhum quadro aberto.',
  },

  cards: {
    verseMissing: 'Não está nesta tradução.',
    untitledNote: 'Nota sem título',
    untitledBoard: 'Quadro sem título',
    emptyNote: 'Nota vazia.',
    deletedNote: 'Esta nota foi excluída.',
    card: 'Cartão',
    emptyBoard: '_Quadro vazio._',
    connections: 'Conexões',
    missingCard: '(cartão que não existe)',
  },
} satisfies Messages;
