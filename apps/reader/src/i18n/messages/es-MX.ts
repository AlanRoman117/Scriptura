/**
 * Español (México).
 *
 * Tuteo, as Mexican apps address their readers. Impersonal "se" forms
 * ("Se citó Juan 1:2") where a past participle would have to agree with a
 * noun the message does not know. Quotation marks are “ ”, the common usage
 * in Mexico. Drafted for review by the owner, a native speaker, before
 * release; the glossary and checklist are in docs/plans/reader-i18n/README.md.
 */
import { numberFor, pluralFor } from '../format';
import type { BookExample, ColourNames, HelpSection, Removed } from '../types';
import type { Messages } from './en-US';

const plural = pluralFor('es-MX');
/** Counts, grouped as the language groups thousands. */
const num = numberFor('es-MX');

const colours: ColourNames = { amber: 'Ámbar', rose: 'Rosa', sky: 'Cielo', mint: 'Menta', violet: 'Violeta' };
const colourWords: ColourNames = { amber: 'ámbar', rose: 'rosa', sky: 'cielo', mint: 'menta', violet: 'violeta' };

const helpSections = (book: BookExample): HelpSection[] => [
  {
    id: 'finding',
    heading: 'Encontrar un pasaje',
    blocks: [
      { p: 'Escribe una referencia en el cuadro de búsqueda y presiona Enter. Todas estas funcionan:' },
      {
        ul: [
          `\`${book.john} 3:16\`: un versículo.`,
          `\`${book.john} 3:16-18\`: varios versículos seguidos.`,
          `\`${book.john} 3\`: un capítulo completo.`,
          '`Juan 3:16` o `Jean 3:16`: el nombre del libro en la traducción que estás leyendo.',
          `\`${book.abbr} 3:16\`: una abreviatura. \`43 3:16\`: el número del libro.`,
        ],
      },
      { p: 'También puedes elegir el libro y el capítulo en los dos menús de la barra.' },
    ],
  },
  {
    id: 'searching',
    heading: 'Buscar',
    blocks: [
      {
        p: 'Todo lo que no es una referencia es una búsqueda. La búsqueda mira dentro de las palabras, así que `amor` también encuentra *amores* y *enamorados*. Los acentos no importan: `amo` encuentra *amó*.',
      },
      {
        ul: [
          'Pon una frase entre comillas para encontrarla tal cual: `"en el principio"`.',
          'Pon un signo de menos antes de una palabra para dejar fuera los versículos que la tienen: `Dios -amor`.',
          '**Solo palabras completas** hace que la búsqueda no mire dentro de palabras más largas.',
          '**Distinguir mayúsculas** hace que las mayúsculas cuenten.',
        ],
      },
      {
        p: 'Primero aparecen los versículos donde tu palabra está sola; después de una línea que lo indica, los versículos donde aparece dentro de una palabra más larga. Presiona Enter en una búsqueda para ver todos los resultados, contados por libro.',
      },
    ],
  },
  {
    id: 'notes',
    heading: 'Notas',
    blocks: [
      {
        p: 'Las notas son texto simple con Markdown. La barra encima de la nota agrega títulos, negritas, cursivas, listas y citas; presiona otra vez una herramienta para quitar el formato. **Vista previa** muestra la nota como se leerá.',
      },
      {
        p: 'Un enlace a un pasaje se ve así: `[[john 3:16]]`. Agrega `@rv1909` para indicar la traducción: `[[john 3:16@rv1909]]`. Pon el cursor dentro de un enlace y un botón **Ir a** lo abre. **Citar**, junto a un versículo, copia el versículo en tu nota con su referencia y un enlace.',
      },
      {
        p: 'Las notas se guardan en este dispositivo mientras escribes. **Exportar** descarga todas las notas y tableros como archivos de texto en un zip.',
      },
    ],
  },
  {
    id: 'marks',
    heading: 'Marcas',
    blocks: [
      {
        p: 'Presiona un versículo, o su número, para marcarlo con uno de cinco colores. Cada color es una colección: ponle el nombre del tema que estás siguiendo, y el panel **Marcas** muestra sus versículos en el orden de la Biblia. Las marcas siguen al pasaje, no a la traducción: una marca hecha en una traducción aparece en todas.',
      },
      { p: 'En Configuración puedes agregar un símbolo a cada marca, para que el color no sea la única señal.' },
    ],
  },
  {
    id: 'boards',
    heading: 'Tableros',
    blocks: [
      {
        p: 'Un tablero acomoda versículos y notas como tarjetas que puedes mover y unir con flechas. **Al tablero**, junto a un versículo, lo pone en el tablero actual. Las tarjetas guardan una referencia, no una copia del texto, así que muestran la traducción que estás leyendo. Ponle nombre a un tablero en el cuadro junto al menú de tableros.',
      },
      {
        p: 'Para mover o cambiar el tamaño de una tarjeta sin arrastrar, usa su botón **✥**; para darle color, su botón de color. Los botones de flecha junto al zoom mueven la vista. **Conexiones**, en la barra del tablero, describe cada flecha con palabras y permite quitarla. Quitar una tarjeta pide confirmación, y puedes deshacer la eliminación de una tarjeta o una conexión hasta que cambies otra cosa.',
      },
    ],
  },
  {
    id: 'translations',
    heading: 'Traducciones',
    blocks: [
      {
        p: 'La biblioteca muestra todas las traducciones, agrupadas por idioma, con su tamaño. Descarga una para leerla sin conexión; **Comparar** la muestra junto a la que estás leyendo, versículo por versículo. Quitar una traducción nunca toca tus notas ni tus marcas.',
      },
    ],
  },
  {
    id: 'keyboard',
    heading: 'Teclado',
    blocks: [
      {
        ul: [
          '{{Tab}} y {{Shift}}+{{Tab}} pasan de un control a otro. La primera vez ofrece saltar al texto o a las notas.',
          '{{Escape}} cierra lo último que se abrió: un panel, las acciones del versículo, las sugerencias de búsqueda.',
          '{{Enter}} sobre el número de un versículo abre sus acciones; las flechas se mueven entre ellas.',
          'En el divisor entre los paneles, las flechas, {{Inicio}} y {{Fin}} cambian el tamaño; los dos botones pequeños hacen lo mismo.',
          'En una nota, {{Shift}}+{{Tab}} llega a las herramientas de formato; las flechas se mueven entre ellas.',
          'En un tablero, las tarjetas reciben el foco: las flechas mueven una tarjeta, {{Alt}} con una flecha cambia su tamaño y {{Supr}} pide quitarla. Con el foco en el tablero, las flechas mueven la vista y {{+}} y {{−}} hacen zoom.',
        ],
      },
    ],
  },
];

export const esMX = {
  app: {
    name: 'Scriptura Reader',
    downloading: 'Descargando el texto para usarlo sin conexión…',
    opening: 'Abriendo…',
    bootFailed: 'No se pudo abrir el texto bíblico. Recarga para intentarlo de nuevo.',
    skipToScripture: 'Saltar a las Escrituras',
    skipToNotes: 'Saltar a las notas',
    title: (where: string) => `${where} · Scriptura`,
    passageTitle: (book: string, chapter: number, id: string) => `${book} ${chapter} · ${id}`,
    boardTitle: (name: string) => `${name} · Tableros`,
    opened: (panel: string) => `Se abrió ${panel}`,
    closed: (panel: string) => `Se cerró ${panel}`,
    boardSaveFailed: 'No se pudo guardar el tablero; exporta tus notas',
    languageChanged: 'La interfaz ahora está en español.',
  },

  panels: {
    marks: 'Marcas',
    translations: 'Traducciones',
    settings: 'Configuración',
    help: 'Ayuda',
    results: 'Resultados de búsqueda',
  },

  common: {
    cancel: 'Cancelar',
    untitledNote: 'Sin título',
    untitledBoard: 'Tablero sin título',
    source: (name: string) => `Fuente de ${name}`,
    undoRemove: 'Deshacer',
    remove: 'Quitar',
    done: 'Listo',
  },

  confirm: {
    permanent: 'No se puede deshacer.',
    undoable: 'Puedes deshacerlo hasta tu próximo cambio.',
    note: {
      title: (name: string) => `¿Eliminar la nota “${name}”?`,
      gone: 'Se eliminará de este dispositivo.',
      keepCopy: 'Para conservar una copia, exporta tus notas antes.',
      action: 'Eliminar nota',
      done: (name: string) => `Se eliminó la nota “${name}”`,
    },
    board: {
      title: (name: string) => `¿Eliminar el tablero “${name}”?`,
      cards: (cards: number) =>
        plural(cards, {
          one: 'Se eliminarán el tablero y su tarjeta.',
          other: `Se eliminarán el tablero y sus ${num(cards)} tarjetas.`,
        }),
      empty: 'El tablero está vacío.',
      kept: 'Tus notas no cambian.',
      action: 'Eliminar tablero',
      done: (name: string) => `Se eliminó el tablero “${name}”`,
    },
    card: {
      title: (card: string) => `¿Quitar ${card} del tablero?`,
      connections: (count: number) =>
        plural(count, {
          one: 'También se quita su conexión.',
          other: `También se quitan sus ${num(count)} conexiones.`,
        }),
      noteKept: 'La nota en sí no cambia.',
      action: 'Quitar tarjeta',
    },
    mark: {
      title: (ref: string) => `¿Quitar la marca de ${ref}?`,
      leaves: (collection: string) => `El versículo sale de la colección “${collection}”.`,
      action: 'Quitar marca',
    },
    translation: {
      title: (name: string) => `¿Quitar ${name} de este dispositivo?`,
      frees: (size: string) => `Se liberarán unos ${size}.`,
      kept: 'Tus notas y marcas no cambian.',
      again: 'Puedes volver a descargarla cuando tengas conexión.',
      action: 'Quitar traducción',
      done: (name: string) => `Se quitó ${name} de este dispositivo`,
    },
  },

  colours,
  colourWords,

  layout: {
    scripture: 'Escrituras',
    notes: 'Notas',
    expandNotes: 'Expandir notas',
    collapseNotes: 'Contraer notas',
    gripWithNews: (action: string, news: string) => `${action}. ${news}`,
    sheetHint: 'Arrastra, o usa las flechas arriba y abajo, para hacer las notas más altas o más bajas.',
    notesMoreRoom: 'Dar más espacio a las notas',
    bibleMoreRoom: 'Dar más espacio a la Biblia',
    resize: 'Cambiar el tamaño de los paneles',
    split: (bible: string, notes: string) => `${bible} Biblia, ${notes} notas`,
    showNotes: 'Mostrar notas',
    paneBible: 'la Biblia',
    paneNotes: 'las notas',
    maximize: (pane: string) => `Maximizar ${pane}`,
    restore: (pane: string) => `Restaurar ${pane}`,
  },

  reader: {
    passage: 'Pasaje',
    book: 'Libro',
    chapter: 'Capítulo',
    translationChip: (id: string, name: string) => `${id}: ${name}. Elige o agrega una traducción`,
    marks: 'Marcas',
    marksChip: (count: number) => `Marcas (${num(count)}): los versículos que marcaste, por color`,
    settingsChip: 'Configuración: pantalla, almacenamiento, exportación y acceso de asistentes',
    helpChip:
      'Ayuda: encontrar pasajes, buscar, notas, marcas, tableros, teclado y el significado de las abreviaturas',
    markVerse: (ref: string) => `Marcar ${ref}`,
    markVerseIn: (ref: string, collection: string, colour: string) => `Marcar ${ref}: está en ${collection} (${colour})`,
    chapterMissing: (translation: string) => `Este capítulo no está en ${translation}.`,
    readingAnnounce: (translation: string) => `Leyendo ${translation}`,
  },

  verseActions: {
    group: (ref: string) => `Acciones para ${ref}`,
    mark: (collection: string, colour: string) => `Marcar en ${collection} (${colour})`,
    quote: 'Citar',
    link: 'Enlazar',
    canvas: 'Al tablero',
    canvasName: 'Al tablero: pon este versículo en el tablero',
    close: (ref: string) => `Cerrar las acciones de ${ref}`,
  },

  insert: {
    quoted: (ref: string) => `Se citó ${ref}`,
    quotedFrom: (ref: string, translation: string) => `Se citó ${ref} (${translation})`,
    linked: (ref: string) => `Se enlazó ${ref}`,
    addedBoard: (board: string) => `Se agregó el tablero “${board}”`,
    addedToBoard: (ref: string, board: string) => `Se agregó ${ref} al tablero “${board}”`,
    alreadyOnBoard: (ref: string, board: string) => `${ref} ya está en el tablero “${board}”`,
    inNewNote: (done: string) => `${done} en una nota nueva`,
    inNote: (done: string, note: string) => `${done} en “${note}”`,
    inUntitledNote: (done: string) => `${done} en una nota sin título`,
    studyBoard: 'Tablero de estudio',
  },

  search: {
    label: 'Buscar o ir a una referencia',
    placeholder: (example: string) => `Busca, o ve a “${example}”`,
    hint: 'Enter abre el pasaje o todos los resultados. La flecha hacia abajo entra en las sugerencias.',
    suggestions: 'Sugerencias',
    goTo: (ref: string) => `Ir a ${ref}`,
    close: 'Cerrar las sugerencias',
    matching: 'Coincidencia',
    wholeWords: 'Solo palabras completas',
    wholeWordsHint: 'Encuentra amor pero no amores. Sin esta opción, la búsqueda también mira dentro de palabras más largas.',
    matchCase: 'Distinguir mayúsculas',
    matchCaseHint: 'Las mayúsculas cuentan: Dios y dios son distintos.',
    noMatches: 'Sin resultados',
    matches: (total: number) => plural(total, { one: `${num(total)} resultado`, other: `${num(total)} resultados` }),
    showing: (shown: number) => `; se muestran ${num(shown)}`,
    seeAll: (total: number) => `Ver los ${num(total)}`,
    insert: (ref: string) => `Insertar ${ref} en la nota abierta`,
    weakBelow: 'Abajo: dentro de una palabra más larga',
    announceNone: (query: string) => `Sin resultados para “${query}”`,
    announceCount: (total: number, query: string) =>
      plural(total, { one: `${num(total)} resultado para “${query}”`, other: `${num(total)} resultados para “${query}”` }),
  },

  results: {
    label: 'Resultados de búsqueda',
    heading: (total: number, query: string) =>
      plural(total, { one: `{count} resultado para “${query}”`, other: `{count} resultados para “${query}”` }),
    close: 'Cerrar los resultados de búsqueda',
    filter: 'Filtrar por libro',
    allBooks: 'Todos los libros',
    weakBelow: (query: string) => `Abajo: “${query}” dentro de una palabra más larga`,
    insert: (ref: string) => `Citar ${ref} en la nota abierta`,
    insertTitle: 'Citar en la nota abierta',
    showing: (shown: number, total: number) => `Se muestran ${num(shown)} de ${num(total)}`,
    inBook: (book: string) => ` en ${book}`,
    more: (count: number) => `Mostrar ${num(count)} más`,
  },

  marks: {
    label: 'Versículos marcados',
    title: 'Marcas',
    close: 'Cerrar las marcas',
    hint: 'Cada color es una lista que crece. Ponle a uno el nombre del tema que estás siguiendo.',
    nameFor: (colour: string) => `Nombre de la colección ${colour}`,
    empty: 'Todavía no hay nada marcado con este color.',
    remove: (ref: string) => `Quitar la marca de ${ref}`,
    removed: 'Se quitó la marca. Puedes deshacerlo en la barra de Marcas.',
    restored: 'Se restauró la marca',
  },

  library: {
    title: 'Traducciones',
    close: 'Cerrar las traducciones',
    onDevice: (count: number) => `${num(count)} en este dispositivo`,
    used: (used: string, quota: string) => `${used} de ${quota} en uso`,
    about: (size: string) => `unos ${size}`,
    licences: {
      'public-domain': 'Dominio público',
      'cc-by-sa-4.0': 'CC BY-SA 4.0',
      cc0: 'CC0',
      'custom-free': 'Licencia libre',
    } as Record<string, string>,
    reading: 'Leyendo',
    comparing: 'Comparando',
    read: 'Leer',
    compare: 'Comparar',
    compareTitle: 'Mostrar junto a la traducción que estás leyendo',
    downloading: (name: string) => `Descargando ${name}`,
    download: 'Descargar',
    removeActive: (name: string) => `Quitar ${name}: primero cambia a otra traducción`,
    removeFromDevice: (name: string) => `Quitar ${name} de este dispositivo`,
    note: 'Una traducción descargada se queda en este dispositivo y se puede leer sin conexión. Quitar una nunca toca tus notas ni tus marcas: ambas pertenecen al pasaje, no a una traducción.',
    progress: (name: string, percent: string) => `${name}: ${percent} descargado`,
    downloaded: (name: string) => `Se descargó ${name}`,
    failed: (name: string, error: string) => `${name}: ${error}`,
    failedOnline: 'La descarga no terminó. Inténtalo de nuevo más tarde.',
    offline: 'Sin conexión. Inténtalo de nuevo cuando tengas internet.',
  },

  compare: {
    label: 'Traducciones lado a lado',
    compared: 'Traducciones comparadas',
    stop: (id: string) => `Dejar de comparar ${id}`,
    verse: 'Versículo',
    verseBefore: 'Versículo ',
    missing: (id: string) => `No está en ${id}`,
    quote: (id: string, verse: number) => `Citar el versículo ${verse} de ${id}`,
  },

  notes: {
    new: 'Nueva',
    startOne: 'Empieza una',
    heading: 'Notas',
    picker: 'Nota',
    none: 'Todavía no hay notas',
    preview: 'Vista previa',
    write: 'Escribir',
    previewTitle: 'Verla con formato',
    writeTitle: 'Volver a escribir',
    canvas: 'Tableros',
    canvasTitle: 'Acomodar versículos y notas en un tablero',
    export: 'Exportar',
    exportTitle: 'Descargar todas las notas y tableros como Markdown en un .zip',
    delete: 'Eliminar',
    title: 'Título de la nota',
    body: 'Texto de la nota',
    placeholder: 'Escribe aquí…',
    goTo: (where: string) => `Ir a ${where}`,
    noneOpen: 'No hay ninguna nota abierta.',
    saveFailed: 'No se pudo guardar; exporta tus notas',
    saving: 'Guardando…',
    saved: 'Guardado',
    linkIn: (where: string, id: string) => `${where} (${id})`,
    linkMissing: (where: string, id: string) => `${where} (${id}, sin descargar)`,
  },

  tools: {
    label: 'Formato',
    heading: (level: number) => `Título ${level}`,
    headingGlyph: (level: number) => `T${level}`,
    bold: 'Negrita',
    boldGlyph: 'N',
    italic: 'Cursiva',
    italicGlyph: 'K',
    code: 'Código',
    bullets: 'Lista con viñetas',
    numbers: 'Lista numerada',
    quote: 'Cita',
    link: 'Enlazar a un pasaje',
  },

  preview: {
    empty: 'Todavía no hay nada escrito.',
    editHere: (block: number) => `Editar aquí (bloque ${block})`,
    goTo: (where: string) => `Ir a ${where}`,
  },

  embed: {
    scrolls: (board: string) => `Tablero: ${board}; se desplaza hacia los lados`,
    picture: (board: string, cards: number) =>
      plural(cards, { one: `Tablero: ${board}, ${num(cards)} tarjeta`, other: `Tablero: ${board}, ${num(cards)} tarjetas` }),
    empty: 'Este tablero está vacío.',
    missing: 'Aquí había un tablero, pero ya no existe.',
    open: 'Abrir el tablero',
  },

  proposal: {
    noteTitle: 'Se redactó una nota para ti',
    marksTitle: 'Versículos sugeridos para marcar',
    lede: 'Un asistente propuso esto. No se ha guardado nada: revísalo, cambia lo que quieras, y solo se aplica cuando lo aceptas.',
    titleInput: 'Título propuesto para la nota',
    bodyInput: 'Texto propuesto para la nota',
    into: (colour: string) => `En {collection} (${colour})`,
    missing: 'No está en esta traducción.',
    discard: 'Descartar',
    save: 'Guardar esta nota',
    mark: (count: number) =>
      plural(count, { one: `Marcar ${num(count)} versículo`, other: `Marcar ${num(count)} versículos` }),
  },

  offer: {
    title: (language: string) => `Biblias en ${language}`,
    intro: 'Estas traducciones están en tu idioma. Descarga una para leerla, con o sin conexión.',
    downloadAndRead: 'Descargar y leer',
    downloadAndReadName: (name: string) => `Descargar y leer ${name}`,
    allTranslations: 'Todas las traducciones',
    notNow: 'Ahora no',
  },

  update: {
    label: 'Hay una versión nueva',
    ready: 'Hay una versión nueva de Scriptura.',
    readyAnnounce: 'Hay una versión nueva de Scriptura. Recarga cuando te convenga.',
    reload: 'Recargar',
    reloading: 'Recargando…',
    later: 'Más tarde',
  },

  durability: {
    label: 'Dónde se guardan tus notas',
    denied: 'Este navegador podría borrar tus notas para liberar espacio. Guarda una copia.',
    stale: 'Hace tiempo que no exportas tus notas.',
    local: 'Tus notas solo están en este navegador.',
    saveFolder: 'Guardar en una carpeta',
    saveFolderTitle: 'Guardar una copia como archivos .md en una carpeta que elijas',
    exportNow: 'Exportar ahora',
    dismiss: 'Cerrar este aviso',
  },

  settings: {
    title: 'Configuración',
    close: 'Cerrar la configuración',
    display: 'Lectura y pantalla',
    colours: 'Colores',
    themes: {
      system: 'Igual que el dispositivo',
      light: 'Claro',
      dark: 'Oscuro',
      'hc-light': 'Alto contraste, claro',
      'hc-dark': 'Alto contraste, oscuro',
      sepia: 'Sepia',
    },
    textSize: 'Tamaño del texto',
    spacing: 'Interlineado',
    spacings: { normal: 'Normal', relaxed: 'Amplio', loose: 'Muy amplio' },
    measure: 'Ancho de columna',
    measures: { narrow: 'Angosto', normal: 'Normal', wide: 'Ancho' },
    displayNote:
      'El interlineado Amplio y Muy amplio cumple la guía WCAG sobre espacio entre líneas y párrafos. Esta configuración solo se aplica a este dispositivo.',
    accessibility: 'Accesibilidad',
    motion: 'Movimiento',
    motions: { system: 'Igual que el dispositivo', reduce: 'Reducir el movimiento' },
    markers: 'Mostrar un símbolo en cada resaltado, no solo un color',
    storage: 'Dónde está tu trabajo',
    persistence: {
      persisted: 'Este navegador aceptó conservar tus notas. Borrar los datos del sitio todavía las elimina.',
      denied: 'Este navegador no aceptó conservar tus notas. Podría borrarlas para liberar espacio.',
      unsupported: 'Este navegador no dice si conserva tus notas. Supón que podría borrarlas.',
      unknown: 'Comprobando…',
    },
    usedOnDevice: (used: string, quota: string) => `${used} de ${quota} en uso en este dispositivo.`,
    mirrored: 'Tus notas también se guardan en una carpeta que elegiste.',
    notMirrored: 'Tus notas solo están en este navegador. Expórtalas, o guarda una copia en una carpeta, para protegerlas.',
    exportAll: 'Exportar todo',
    anotherFolder: 'Elegir otra carpeta',
    mirror: 'Copiar a una carpeta',
    assistant: 'Acceso de asistentes',
    assistantIntro:
      'Un asistente de IA que funcione en este navegador puede leer tu biblioteca y redactar notas o marcas para ti. Esto está **desactivado** hasta que lo actives. No se envía nada a Scriptura: el asistente funciona en tu navegador y lee los mismos datos que la aplicación.',
    assistantToggle: 'Ofrecer las herramientas de Scriptura a un asistente',
    assistantSupported: 'Este navegador admite herramientas para asistentes.',
    assistantUnsupported:
      'Este navegador todavía no admite herramientas para asistentes: WebMCP es un borrador inicial, disponible en Chrome detrás de una opción experimental. El interruptor se recuerda para cuando lo admita.',
    assistantReadOnly:
      '**Puede leer, no escribir.** Un asistente puede leer tus notas, marcas y pasajes, pero no puede cambiar nada. Todo lo que quiera agregar se te muestra completo primero, y solo se guarda cuando lo aceptas.',
    assistantTools: (count: number) => `Lo que podría hacer un asistente (${num(count)} herramientas)`,
    toolReads: 'lee',
    toolNeedsApproval: 'necesita tu aprobación',
    toolsInEnglish: 'Las descripciones están en inglés, tal como las lee el asistente.',
    help: 'Ayuda',
    helpIntro:
      'Cómo encontrar un pasaje, buscar, escribir notas, marcar versículos y usar tableros; qué significan las abreviaturas; y lo que esta aplicación promete sobre accesibilidad.',
    openHelp: 'Abrir la ayuda',
    language: 'Idioma',
    languageLabel: 'Idioma de la interfaz',
    languageSystem: 'Igual que este dispositivo',
    languageNote: 'El texto bíblico se queda en el idioma de cada traducción.',
  },

  help: {
    title: 'Ayuda',
    close: 'Cerrar la ayuda',
    sections: helpSections,
    abbreviations: 'Abreviaturas',
    abbreviationsCaption: 'Qué significa cada abreviatura',
    short: 'Abreviatura',
    meaning: 'Significado',
    terms: [
      ['CC BY-SA 4.0', 'Creative Commons Atribución-CompartirIgual 4.0: una licencia libre que pide citar la fuente y compartir los cambios con las mismas condiciones.'],
      ['CC0', 'Creative Commons Cero: el autor renunció a todos sus derechos; el texto es de uso libre.'],
      ['OT', 'Antiguo Testamento (en inglés, Old Testament).'],
      ['NT', 'Nuevo Testamento.'],
      ['PWA', 'Aplicación web progresiva: un sitio web que puedes instalar y usar sin conexión.'],
      ['WCAG', 'Pautas de Accesibilidad para el Contenido Web, el estándar con el que se mide esta aplicación.'],
    ] as [string, string][],
    glossaryHeading: 'Palabras que se usan aquí',
    glossary: [
      ['Colección', 'Todos los versículos que marcas con un color. Ponle a un color el nombre del tema que sigues, y el panel Marcas muestra esos versículos en el orden de la Biblia.'],
      ['Tablero', 'Un espacio donde los versículos y las notas se acomodan como tarjetas unidas con flechas. Los tableros se guardan y se exportan con tus notas.'],
      ['Tarjeta', 'Un elemento de un tablero: un versículo, una nota o un texto que escribiste. Una tarjeta de versículo muestra el versículo en la traducción que estás leyendo.'],
      ['Traducción', 'Una versión de la Biblia, en un idioma. Todas las traducciones de aquí se pueden copiar libremente.'],
      ['Solo palabras completas', 'Una opción de búsqueda. Activada, "amor" encuentra amor pero no amores. Desactivada, encuentra las dos.'],
      ['Distinguir mayúsculas', 'Una opción de búsqueda. Activada, "Dios" y "dios" son distintos.'],
      ['Copiar a una carpeta', 'Guardar una copia de tus notas como archivos de texto en una carpeta de esta computadora, actualizada mientras escribes. Funciona en Chrome y Edge.'],
      ['Herramientas para asistentes', 'Una forma de que un asistente de IA que funcione en tu navegador lea tu biblioteca y sugiera notas o marcas. Está desactivada salvo que la actives; no se guarda nada sin tu aprobación.'],
    ] as [string, string][],
    accessibilityHeading: 'Accesibilidad',
    accessibility: [
      'Esta aplicación busca cumplir las Pautas de Accesibilidad para el Contenido Web 2.2 en el nivel AAA en todo lo que la propia aplicación muestra: sus controles, su texto, sus colores y su comportamiento. Cada control se puede alcanzar con el teclado, mide al menos 44 por 44 píxeles, muestra dónde está el foco y tiene un nombre. El texto tiene un contraste de al menos 7:1 con su fondo en todos los temas de color, y en Configuración puedes cambiar el tamaño, el espaciado y los colores.',
      'Dos cosas quedan fuera de esa promesa. El texto bíblico se muestra tal como se publicó: qué tan difícil es de leer, y cómo se pronuncian sus palabras, dependen de cada traducción, no de esta aplicación. Lo mismo vale para lo que escribes en tus notas.',
      'Lo que revisa una máquina se revisa en cada cambio. Lo que necesita a una persona, como un lector de pantalla en un celular o la aplicación con un tema de contraste de Windows, se revisa a mano, con menos frecuencia. Si algo no te funciona, repórtalo en el registro de problemas del proyecto en GitHub (`AlanRoman117/scriptura`).',
    ],
  },

  canvas: {
    new: 'Nuevo',
    startOne: 'Empieza uno',
    label: 'Tableros',
    heading: (board: string) => `Tablero: ${board}`,
    noneOpenHeading: 'ninguno abierto',
    picker: 'Tablero',
    name: 'Nombre del tablero',
    none: 'Todavía no hay tableros',
    undo: (what: Removed) =>
      `Deshacer: volver a poner ${what.kind === 'card' ? what.label : `la conexión ${what.label}`}`,
    putBack: (what: Removed) =>
      `Se volvió a poner ${what.kind === 'card' ? what.label : `la conexión ${what.label}`}`,
    removed: (what: Removed) =>
      `Se quitó ${what.kind === 'card' ? what.label : `la conexión ${what.label}`}. Puedes deshacerlo en la barra del tablero.`,
    addCard: 'Agregar tarjeta',
    addNote: 'Agregar nota',
    addNoteName: 'Agregar nota: pon la nota más reciente en el tablero',
    addNoteNoNotes: 'Agregar nota: primero escribe una nota',
    toNote: 'Agregar a la nota',
    toNoteName: 'Agregar a la nota: pon este tablero en la nota que tienes abierta',
    connections: (count: number) => `Conexiones (${num(count)})`,
    connectionsLabel: 'Conexiones',
    deleteBoard: 'Eliminar tablero',
    zoom: 'Zoom',
    zoomOut: 'Alejar',
    zoomIn: 'Acercar',
    zoomReset: (percent: string) => `Zoom ${percent}. Volver al tamaño completo, mostrando tus tarjetas`,
    moveView: 'Mover la vista',
    viewLeft: 'Mover la vista a la izquierda',
    viewUp: 'Mover la vista hacia arriba',
    viewDown: 'Mover la vista hacia abajo',
    viewRight: 'Mover la vista a la derecha',
    back: 'Volver a la lectura',
    help: 'Ayuda: tableros, teclado y el significado de las abreviaturas',
    noConnections: 'Todavía no hay conexiones. Presiona ⇢ en una tarjeta y luego la tarjeta a la que lleva.',
    removeConnection: (edge: string) => `Quitar la conexión ${edge}`,
    missingCard: 'una tarjeta que ya no está',
    edge: (from: string, to: string) => `${from} → ${to}`,
    frame: (cards: number) =>
      plural(cards, { one: `Área del tablero, ${num(cards)} tarjeta`, other: `Área del tablero, ${num(cards)} tarjetas` }),
    frameHint:
      'Las flechas mueven la vista; más y menos hacen zoom. Cada tarjeta recibe el foco: las flechas la mueven, y Alt con una flecha cambia su tamaño.',
    verseCard: 'Tarjeta de versículo',
    noteCard: 'Tarjeta de nota',
    card: 'Tarjeta',
    cardName: (kind: string, label: string, colour: string | null) =>
      `${kind}: ${label}${colour ? `, ${colour}` : ''}`,
    colourName: (collection: string, colour: string) => `${collection} (${colour})`,
    cardTitle: 'Título de la tarjeta',
    cardTitlePlaceholder: 'Tarjeta',
    cardText: 'Texto de la tarjeta',
    cardTextPlaceholder: 'Escribe aquí…',
    cardBody: (title: string) => `${title}: texto`,
    connect: (card: string) => `Conectar ${card} con otra tarjeta`,
    connectPrompt: 'Elige la tarjeta a la que quieres conectar: presiónala, o presiona Enter sobre ella. Escape cancela.',
    connected: (from: string, to: string) => `Se conectó ${from} con ${to}`,
    open: (card: string) => `Abrir ${card} en el lector`,
    colour: (current: string | null, card: string) =>
      `Color: ${current ?? 'ninguno'}. Cambiar el color de ${card}`,
    adjust: (card: string) => `Mover o cambiar el tamaño de ${card} sin arrastrar`,
    takeOff: (card: string) => `Quitar ${card} del tablero`,
    empty: 'Este tablero todavía está vacío. Agrega una tarjeta aquí, o usa **Al tablero** junto a un versículo mientras lees.',
    adjustPanel: (card: string) => `Mover y cambiar el tamaño de ${card}`,
    colourPanel: (card: string) => `Color de ${card}`,
    adjustTitle: 'Mover y cambiar tamaño',
    colourTitle: 'Color',
    panelTitle: (mode: string, card: string) => `${mode}: ${card}`,
    move: 'Mover',
    moveLeft: 'Mover a la izquierda',
    moveUp: 'Mover hacia arriba',
    moveDown: 'Mover hacia abajo',
    moveRight: 'Mover a la derecha',
    size: 'Tamaño',
    narrower: 'Más angosta',
    wider: 'Más ancha',
    shorter: 'Más baja',
    taller: 'Más alta',
    colours: 'Colores',
    noColour: 'Sin color',
    moved: (card: string, x: number, y: number) => `${card}: se movió a ${x}, ${y}`,
    resized: (card: string, w: number, h: number) => `${card}: ${w} de ancho, ${h} de alto`,
    coloured: (card: string, colour: string) => `${card}: ${colour}`,
    uncoloured: (card: string) => `${card}: sin color`,
    noneOpen: 'No hay ningún tablero abierto.',
  },

  cards: {
    verseMissing: 'No está en esta traducción.',
    untitledNote: 'Nota sin título',
    untitledBoard: 'Tablero sin título',
    emptyNote: 'Nota vacía.',
    deletedNote: 'Esta nota se eliminó.',
    card: 'Tarjeta',
    emptyBoard: '_Tablero vacío._',
    connections: 'Conexiones',
    missingCard: '(tarjeta que ya no está)',
  },
} satisfies Messages;
