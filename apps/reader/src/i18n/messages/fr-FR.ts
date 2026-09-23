/**
 * Français (France).
 *
 * Vouvoiement, as French software addresses its readers. Guillemets « » for
 * quotation. Written here with ordinary spaces; `withFrenchSpacing` puts the
 * no-break spaces French typography requires before : ; ! ? and inside « ».
 * Messages lead with a fixed noun ("Citation de Jean 1:2 ajoutée") so a
 * participle agrees with a word the message knows.
 *
 * ⚠️ Drafted, not written by a native speaker: a native French reviewer must
 * check it before release (docs/plans/reader-i18n/README.md).
 */
import { numberFor, pluralFor } from '../format';
import { withFrenchSpacing } from '../typography';
import type { BookExample, ColourNames, HelpSection, Removed } from '../types';
import type { Messages } from './en-US';

const plural = pluralFor('fr-FR');
/** Counts, grouped as the language groups thousands. */
const num = numberFor('fr-FR');

const colours: ColourNames = { amber: 'Ambre', rose: 'Rose', sky: 'Ciel', mint: 'Menthe', violet: 'Violet' };
const colourWords: ColourNames = { amber: 'ambre', rose: 'rose', sky: 'ciel', mint: 'menthe', violet: 'violet' };

const helpSections = (book: BookExample): HelpSection[] => [
  {
    id: 'finding',
    heading: 'Trouver un passage',
    blocks: [
      { p: 'Tapez une référence dans le champ de recherche et appuyez sur Entrée. Toutes ces formes fonctionnent :' },
      {
        ul: [
          `\`${book.john} 3:16\` : un verset.`,
          `\`${book.john} 3:16-18\` : plusieurs versets qui se suivent.`,
          `\`${book.john} 3\` : un chapitre entier.`,
          '`Juan 3:16` ou `Jean 3:16` : le nom du livre dans la traduction que vous lisez.',
          `\`${book.abbr} 3:16\` : une abréviation. \`43 3:16\` : le numéro du livre.`,
        ],
      },
      { p: 'Vous pouvez aussi choisir le livre et le chapitre dans les deux menus de la barre.' },
    ],
  },
  {
    id: 'searching',
    heading: 'Rechercher',
    blocks: [
      {
        p: 'Tout ce qui n’est pas une référence est une recherche. La recherche regarde à l’intérieur des mots : `aime` trouve aussi *aimeras* et *bien-aimé*. Les accents ne comptent pas : `aime` trouve *aimé*.',
      },
      {
        ul: [
          'Mettez une expression entre guillemets pour la trouver telle quelle : `"au commencement"`.',
          'Mettez un signe moins devant un mot pour écarter les versets qui le contiennent : `Dieu -amour`.',
          '**Mots entiers uniquement** empêche la recherche de regarder à l’intérieur de mots plus longs.',
          '**Respecter la casse** tient compte des majuscules.',
        ],
      },
      {
        p: 'Les premiers résultats sont les versets où votre mot est seul ; ceux où il se trouve à l’intérieur d’un mot plus long viennent après une ligne qui l’indique. Appuyez sur Entrée dans une recherche pour voir tous les résultats, comptés par livre.',
      },
    ],
  },
  {
    id: 'notes',
    heading: 'Notes',
    blocks: [
      {
        p: 'Les notes sont du texte simple en Markdown. La mise en forme apparaît pendant la saisie, et ses symboles reviennent sur la ligne en cours de modification ; pour ne voir que le Markdown, choisissez **Texte brut** dans Éditeur de notes, dans les Paramètres. La barre au-dessus de la note ajoute des titres, du gras, de l’italique, des listes et des citations ; appuyez de nouveau sur un outil pour retirer la mise en forme. En Texte brut, **Aperçu** montre la note telle qu’elle se lira.',
      },
      {
        p: 'Un lien vers un passage s’écrit `[[john 3:16]]`. Ajoutez `@lsg1910` pour préciser la traduction : `[[john 3:16@lsg1910]]`. Placez le curseur dans un lien et un bouton **Aller à** l’ouvre. **Citer**, à côté d’un verset, copie le verset dans votre note avec sa référence et un lien.',
      },
      {
        p: 'Les notes sont enregistrées sur cet appareil pendant que vous écrivez. **Exporter** télécharge toutes les notes et tous les tableaux sous forme de fichiers texte dans une archive zip.',
      },
    ],
  },
  {
    id: 'marks',
    heading: 'Marques',
    blocks: [
      {
        p: 'Appuyez sur un verset, ou sur son numéro, pour le marquer d’une des cinq couleurs. Chaque couleur est une collection : donnez-lui le nom du sujet que vous suivez, et le panneau **Marques** en liste les versets dans l’ordre de la Bible. Les marques suivent le passage, pas la traduction : une marque faite dans une traduction apparaît dans toutes.',
      },
      { p: 'Dans les Paramètres, vous pouvez ajouter un symbole à chaque marque, pour que la couleur ne soit pas le seul signe.' },
    ],
  },
  {
    id: 'boards',
    heading: 'Tableaux',
    blocks: [
      {
        p: 'Un tableau dispose des versets et des notes sous forme de fiches que vous pouvez déplacer et relier par des flèches. **Au tableau**, à côté d’un verset, le place sur le tableau en cours. Les fiches gardent une référence, pas une copie du texte : elles affichent la traduction que vous lisez. Donnez un nom au tableau dans le champ à côté du menu des tableaux.',
      },
      {
        p: 'Pour déplacer ou redimensionner une fiche sans la faire glisser, utilisez son bouton **✥** ; pour la colorer, son bouton de couleur. Les boutons fléchés à côté du zoom déplacent la vue. **Connexions**, dans la barre du tableau, décrit chaque flèche en toutes lettres et permet d’en retirer une. Retirer une fiche demande confirmation, et le retrait d’une fiche ou d’une connexion peut être annulé tant que vous ne modifiez rien d’autre.',
      },
    ],
  },
  {
    id: 'translations',
    heading: 'Traductions',
    blocks: [
      {
        p: 'La bibliothèque présente toutes les traductions, regroupées par langue, avec leur taille. Téléchargez-en une pour la lire hors ligne ; **Comparer** l’affiche à côté de celle que vous lisez, verset par verset. Retirer une traduction ne touche jamais à vos notes ni à vos marques.',
      },
    ],
  },
  {
    id: 'keyboard',
    heading: 'Clavier',
    blocks: [
      {
        ul: [
          '{{Tab}} et {{Maj}}+{{Tab}} passent d’une commande à l’autre. La première pression propose d’aller directement au texte ou aux notes.',
          '{{Échap}} ferme ce qui a été ouvert en dernier : un panneau, les actions d’un verset, les suggestions de recherche.',
          '{{Entrée}} sur le numéro d’un verset ouvre ses actions ; les flèches passent de l’une à l’autre.',
          'Sur le séparateur entre les panneaux, les flèches, {{Début}} et {{Fin}} changent la largeur ; les deux petits boutons font de même.',
          'Dans une note, {{Maj}}+{{Tab}} atteint les outils de mise en forme ; les flèches passent de l’un à l’autre.',
          'Sur un tableau, les fiches prennent le focus : les flèches déplacent une fiche, {{Alt}} avec une flèche la redimensionne, et {{Suppr}} propose de la retirer. Quand le tableau lui-même a le focus, les flèches déplacent la vue et {{+}} et {{−}} zooment.',
        ],
      },
    ],
  },
];

const catalog = {
  app: {
    name: 'Scriptura Reader',
    downloading: 'Téléchargement du texte pour une lecture hors ligne…',
    opening: 'Ouverture…',
    bootFailed: 'Le texte biblique n’a pas pu être ouvert. Rechargez pour réessayer.',
    skipToScripture: 'Aller au texte biblique',
    skipToNotes: 'Aller aux notes',
    skipToBoard: 'Aller aux tableaux',
    title: (where: string) => `${where} · Scriptura`,
    passageTitle: (book: string, chapter: number, id: string) => `${book} ${chapter} · ${id}`,
    boardTitle: (name: string) => `${name} · Tableaux`,
    opened: (panel: string) => `Panneau ${panel} ouvert`,
    closed: (panel: string) => `Panneau ${panel} fermé`,
    boardSaveFailed: 'Impossible d’enregistrer le tableau : exportez vos notes',
    languageChanged: 'L’interface est maintenant en français.',
  },

  panels: {
    marks: 'Marques',
    translations: 'Traductions',
    settings: 'Paramètres',
    help: 'Aide',
    results: 'Résultats de recherche',
  },

  common: {
    cancel: 'Annuler',
    untitledNote: 'Sans titre',
    untitledBoard: 'Tableau sans titre',
    source: (name: string) => `Source de ${name}`,
    undoRemove: 'Annuler le retrait',
    remove: 'Retirer',
    done: 'Terminé',
  },

  confirm: {
    permanent: 'Vous ne pourrez pas annuler.',
    undoable: 'Vous pourrez annuler jusqu’à votre prochaine modification.',
    note: {
      title: (name: string) => `Supprimer la note « ${name} » ?`,
      gone: 'Elle sera supprimée de cet appareil.',
      keepCopy: 'Pour en garder une copie, exportez d’abord vos notes.',
      action: 'Supprimer la note',
      done: (name: string) => `Note « ${name} » supprimée`,
    },
    board: {
      title: (name: string) => `Supprimer le tableau « ${name} » ?`,
      cards: (cards: number) =>
        plural(cards, {
          one: 'Le tableau et sa fiche seront supprimés.',
          other: `Le tableau et ses ${num(cards)} fiches seront supprimés.`,
        }),
      empty: 'Le tableau est vide.',
      kept: 'Vos notes ne sont pas modifiées.',
      action: 'Supprimer le tableau',
      done: (name: string) => `Tableau « ${name} » supprimé`,
    },
    card: {
      title: (card: string) => `Retirer ${card} du tableau ?`,
      connections: (count: number) =>
        plural(count, {
          one: 'Sa connexion sera aussi retirée.',
          other: `Ses ${num(count)} connexions seront aussi retirées.`,
        }),
      noteKept: 'La note elle-même n’est pas modifiée.',
      action: 'Retirer la fiche',
    },
    mark: {
      title: (ref: string) => `Retirer la marque de ${ref} ?`,
      leaves: (collection: string) => `Le verset quittera la collection « ${collection} ».`,
      action: 'Retirer la marque',
    },
    translation: {
      title: (name: string) => `Retirer ${name} de cet appareil ?`,
      frees: (size: string) => `Environ ${size} seront libérés.`,
      kept: 'Vos notes et vos marques ne sont pas modifiées.',
      again: 'Vous pourrez la télécharger de nouveau une fois en ligne.',
      action: 'Retirer la traduction',
      done: (name: string) => `Traduction ${name} retirée de cet appareil`,
    },
  },

  colours,
  colourWords,

  layout: {
    scripture: 'Texte biblique',
    notes: 'Notes',
    expandNotes: 'Agrandir les notes',
    collapseNotes: 'Réduire les notes',
    gripWithNews: (action: string, news: string) => `${action}. ${news}`,
    sheetHint: 'Faites glisser, ou utilisez les flèches haut et bas, pour agrandir ou réduire les notes.',
    notesMoreRoom: 'Donner plus de place aux notes',
    bibleMoreRoom: 'Donner plus de place à la Bible',
    resize: 'Redimensionner les panneaux',
    split: (bible: string, notes: string) => `Bible ${bible}, notes ${notes}`,
    showNotes: 'Afficher les notes',
    paneBible: 'la Bible',
    paneNotes: 'les notes',
    /** The side pane holds the notes or the canvas; these name the switch and the canvas side. */
    sides: 'Notes ou tableaux',
    paneBoard: 'les tableaux',
    expandBoard: 'Agrandir les tableaux',
    collapseBoard: 'Réduire les tableaux',
    showBoard: 'Afficher les tableaux',
    maximize: (pane: string) => `Agrandir ${pane}`,
    restore: (pane: string) => `Rétablir ${pane}`,
  },

  reader: {
    passage: 'Passage',
    book: 'Livre',
    chapter: 'Chapitre',
    translationChip: (id: string, name: string) => `${id} : ${name}. Choisir ou ajouter une traduction`,
    marks: 'Marques',
    marksChip: (count: number) => `Marques (${num(count)}) : les versets que vous avez marqués, par couleur`,
    settingsChip: 'Paramètres : affichage, stockage, exportation et accès des assistants',
    helpChip:
      'Aide : trouver un passage, rechercher, notes, marques, tableaux, clavier et sens des abréviations',
    markVerse: (ref: string) => `Marquer ${ref}`,
    markVerseIn: (ref: string, collection: string, colour: string) =>
      `Marquer ${ref} : dans ${collection} (${colour})`,
    chapterMissing: (translation: string) => `Ce chapitre ne figure pas dans ${translation}.`,
    readingAnnounce: (translation: string) => `Lecture de ${translation}`,
  },

  verseActions: {
    group: (ref: string) => `Actions pour ${ref}`,
    mark: (collection: string, colour: string) => `Marquer dans ${collection} (${colour})`,
    quote: 'Citer',
    link: 'Lier',
    canvas: 'Au tableau',
    canvasName: 'Au tableau : placer ce verset sur le tableau',
    close: (ref: string) => `Fermer les actions de ${ref}`,
  },

  insert: {
    quoted: (ref: string) => `Citation de ${ref} ajoutée`,
    quotedFrom: (ref: string, translation: string) => `Citation de ${ref} (${translation}) ajoutée`,
    linked: (ref: string) => `Lien vers ${ref} ajouté`,
    addedBoard: (board: string) => `Tableau « ${board} » ajouté`,
    addedToBoard: (ref: string, board: string) => `${ref} ajouté au tableau « ${board} »`,
    alreadyOnBoard: (ref: string, board: string) => `${ref} est déjà sur le tableau « ${board} »`,
    inNewNote: (done: string) => `${done} dans une nouvelle note`,
    inNote: (done: string, note: string) => `${done} dans « ${note} »`,
    inUntitledNote: (done: string) => `${done} dans une note sans titre`,
    studyBoard: 'Tableau d’étude',
  },

  search: {
    label: 'Rechercher ou aller à une référence',
    placeholder: (example: string) => `Rechercher, ou aller à « ${example} »`,
    hint: 'Entrée ouvre le passage, ou tous les résultats. La flèche vers le bas entre dans les suggestions.',
    suggestions: 'Suggestions',
    goTo: (ref: string) => `Aller à ${ref}`,
    close: 'Fermer les suggestions',
    matching: 'Correspondance',
    wholeWords: 'Mots entiers uniquement',
    wholeWordsHint: 'Trouve amour mais pas amours. Sans cette option, la recherche regarde aussi à l’intérieur des mots plus longs.',
    matchCase: 'Respecter la casse',
    matchCaseHint: 'Les majuscules comptent : Dieu et dieu sont différents.',
    noMatches: 'Aucun résultat',
    matches: (total: number) => plural(total, { one: `${num(total)} résultat`, other: `${num(total)} résultats` }),
    showing: (shown: number) => ` ; ${num(shown)} affichés`,
    seeAll: (total: number) => `Voir les ${num(total)}`,
    insert: (ref: string) => `Insérer ${ref} dans la note ouverte`,
    /** The name of a result's Canvas button: its visible word first (2.5.3). */
    toCanvas: (ref: string) => `Au tableau : placer ${ref} sur le tableau`,
    weakBelow: 'Ci-dessous : à l’intérieur d’un mot plus long',
    announceNone: (query: string) => `Aucun résultat pour « ${query} »`,
    announceCount: (total: number, query: string) =>
      plural(total, { one: `${num(total)} résultat pour « ${query} »`, other: `${num(total)} résultats pour « ${query} »` }),
  },

  results: {
    label: 'Résultats de recherche',
    heading: (total: number, query: string) =>
      plural(total, { one: `{count} résultat pour « ${query} »`, other: `{count} résultats pour « ${query} »` }),
    close: 'Fermer les résultats de recherche',
    filter: 'Filtrer par livre',
    allBooks: 'Tous les livres',
    weakBelow: (query: string) => `Ci-dessous : « ${query} » à l’intérieur d’un mot plus long`,
    insert: (ref: string) => `Citer ${ref} dans la note ouverte`,
    insertTitle: 'Citer dans la note ouverte',
    showing: (shown: number, total: number) => `${num(shown)} affichés sur ${num(total)}`,
    inBook: (book: string) => ` dans ${book}`,
    more: (count: number) => `Afficher ${num(count)} de plus`,
  },

  marks: {
    label: 'Versets marqués',
    title: 'Marques',
    close: 'Fermer les marques',
    hint: 'Chaque couleur est une liste qui s’allonge. Donnez à l’une le nom du sujet que vous suivez.',
    nameFor: (colour: string) => `Nom de la collection ${colour}`,
    empty: 'Rien n’est encore marqué de cette couleur.',
    remove: (ref: string) => `Retirer la marque de ${ref}`,
    removed: 'Marque retirée. Vous pouvez annuler depuis la barre des Marques.',
    restored: 'Marque rétablie',
  },

  library: {
    title: 'Traductions',
    close: 'Fermer les traductions',
    onDevice: (count: number) => `${num(count)} sur cet appareil`,
    used: (used: string, quota: string) => `${used} utilisés sur ${quota}`,
    about: (size: string) => `environ ${size}`,
    licences: {
      'public-domain': 'Domaine public',
      'cc-by-4.0': 'CC BY 4.0',
      'cc-by-sa-4.0': 'CC BY-SA 4.0',
      cc0: 'CC0',
      'custom-free': 'Licence libre',
    } as Record<string, string>,
    reading: 'En lecture',
    comparing: 'En comparaison',
    read: 'Lire',
    compare: 'Comparer',
    compareTitle: 'Afficher à côté de la traduction que vous lisez',
    downloading: (name: string) => `Téléchargement de ${name}`,
    download: 'Télécharger',
    removeActive: (name: string) => `Retirer ${name} : passez d’abord à une autre traduction`,
    removeFromDevice: (name: string) => `Retirer ${name} de cet appareil`,
    note: 'Une traduction téléchargée reste sur cet appareil et peut être lue hors ligne. En retirer une ne touche jamais à vos notes ni à vos marques : elles appartiennent au passage, pas à une traduction.',
    progress: (name: string, percent: string) => `${name} : ${percent} téléchargés`,
    downloaded: (name: string) => `${name} téléchargée`,
    failed: (name: string, error: string) => `${name} : ${error}`,
    failedOnline: 'Le téléchargement n’a pas abouti. Réessayez plus tard.',
    offline: 'Pas de connexion. Réessayez quand vous serez en ligne.',
  },

  compare: {
    label: 'Traductions côte à côte',
    compared: 'Traductions comparées',
    stop: (id: string) => `Arrêter de comparer ${id}`,
    verse: 'Verset',
    verseBefore: 'Verset ',
    missing: (id: string) => `Absent de ${id}`,
    quote: (id: string, verse: number) => `Citer le verset ${verse} de ${id}`,
  },

  notes: {
    new: 'Nouvelle',
    startOne: 'En créer une',
    heading: 'Notes',
    picker: 'Note',
    none: 'Aucune note pour l’instant',
    preview: 'Aperçu',
    write: 'Écrire',
    previewTitle: 'Voir la mise en forme',
    writeTitle: 'Revenir à l’écriture',
    canvas: 'Tableaux',
    canvasTitle: 'Disposer des versets et des notes sur un tableau',
    export: 'Exporter',
    exportTitle: 'Télécharger toutes les notes et tous les tableaux en Markdown dans un .zip',
    delete: 'Supprimer',
    title: 'Titre de la note',
    body: 'Texte de la note',
    placeholder: 'Écrivez ici…',
    goTo: (where: string) => `Aller à ${where}`,
    noneOpen: 'Aucune note ouverte.',
    saveFailed: 'Impossible d’enregistrer : exportez vos notes',
    saving: 'Enregistrement…',
    saved: 'Enregistré',
    linkIn: (where: string, id: string) => `${where} (${id})`,
    linkMissing: (where: string, id: string) => `${where} (${id}, non téléchargée)`,
  },

  tools: {
    label: 'Mise en forme',
    heading: (level: number) => `Titre ${level}`,
    headingGlyph: (level: number) => `T${level}`,
    bold: 'Gras',
    boldGlyph: 'G',
    italic: 'Italique',
    italicGlyph: 'I',
    code: 'Code',
    bullets: 'Liste à puces',
    numbers: 'Liste numérotée',
    quote: 'Citation',
    link: 'Lien vers un passage',
  },

  preview: {
    empty: 'Rien n’est encore écrit.',
    editHere: (block: number) => `Modifier ici (bloc ${block})`,
    goTo: (where: string) => `Aller à ${where}`,
  },

  embed: {
    scrolls: (board: string) => `Tableau : ${board}, défile horizontalement`,
    picture: (board: string, cards: number) =>
      plural(cards, { one: `Tableau : ${board}, ${num(cards)} fiche`, other: `Tableau : ${board}, ${num(cards)} fiches` }),
    empty: 'Ce tableau est vide.',
    missing: 'Un tableau était intégré ici, mais il n’existe plus.',
    open: 'Ouvrir le tableau',
  },

  proposal: {
    noteTitle: 'Une note a été rédigée pour vous',
    marksTitle: 'Versets proposés à marquer',
    lede: 'Un assistant a proposé ceci. Rien n’a été enregistré : relisez, modifiez ce que vous voulez, et rien ne s’applique avant que vous acceptiez.',
    titleInput: 'Titre proposé pour la note',
    bodyInput: 'Texte proposé pour la note',
    into: (colour: string) => `Dans {collection} (${colour})`,
    missing: 'Absent de cette traduction.',
    discard: 'Écarter',
    save: 'Enregistrer cette note',
    mark: (count: number) => plural(count, { one: `Marquer ${num(count)} verset`, other: `Marquer ${num(count)} versets` }),
  },

  offer: {
    title: (language: string) => `Bibles en ${language}`,
    intro: 'Ces traductions sont dans votre langue. Téléchargez-en une pour la lire, en ligne ou hors ligne.',
    downloadAndRead: 'Télécharger et lire',
    downloadAndReadName: (name: string) => `Télécharger et lire ${name}`,
    allTranslations: 'Toutes les traductions',
    notNow: 'Pas maintenant',
  },

  update: {
    label: 'Une nouvelle version est prête',
    ready: 'Une nouvelle version de Scriptura est prête.',
    readyAnnounce: 'Une nouvelle version de Scriptura est prête. Rechargez quand cela vous convient.',
    reload: 'Recharger',
    reloading: 'Rechargement…',
    later: 'Plus tard',
  },

  previewBuild: {
    label: 'Préversion',
    intro: '**Préversion.** Une version anticipée pour les personnes qui relisent ses traductions.',
    report: 'Signaler une correction de traduction sur GitHub (s’ouvre dans un nouvel onglet)',
    reportShort: 'Signaler une correction',
    newTab: '(sur GitHub, s’ouvre dans un nouvel onglet)',
    hide: 'Masquer',
    heading: 'À propos de cette préversion',
    about:
      'Cette version est destinée aux personnes qui relisent l’interface en espagnol, en français, en japonais, en chinois et en portugais. Rien de ce que vous faites ici n’est envoyé : vos notes et vos marques restent dans ce navigateur. Pour signaler un mot incorrect ou peu clair, utilisez le lien ci-dessous. Il ouvre un court formulaire sur GitHub, qui demande un compte gratuit.',
    version: (version: string) => `Version : ${version}`,
  },

  durability: {
    label: 'Où vos notes sont conservées',
    denied: 'Ce navigateur peut supprimer vos notes pour libérer de l’espace. Enregistrez une copie.',
    stale: 'Vous n’avez pas exporté vos notes depuis un moment.',
    local: 'Vos notes ne sont que dans ce navigateur.',
    saveFolder: 'Enregistrer dans un dossier',
    saveFolderTitle: 'Garder une copie en fichiers .md dans un dossier de votre choix',
    exportNow: 'Exporter maintenant',
    dismiss: 'Fermer cet avis',
  },

  settings: {
    title: 'Paramètres',
    close: 'Fermer les paramètres',
    display: 'Lecture et affichage',
    colours: 'Couleurs',
    themes: {
      system: 'Comme l’appareil',
      light: 'Clair',
      dark: 'Sombre',
      'hc-light': 'Contraste élevé, clair',
      'hc-dark': 'Contraste élevé, sombre',
      sepia: 'Sépia',
    },
    textSize: 'Taille du texte',
    spacing: 'Interligne',
    spacings: { normal: 'Normal', relaxed: 'Aéré', loose: 'Très aéré' },
    measure: 'Largeur de colonne',
    measures: { narrow: 'Étroite', normal: 'Normale', wide: 'Large' },
    editor: 'Éditeur de notes',
    editors: { live: 'Afficher la mise en forme pendant la saisie', plain: 'Texte brut' },
    displayNote:
      'Les interlignes Aéré et Très aéré respectent les recommandations WCAG sur l’espacement des lignes et des paragraphes. Ces réglages ne s’appliquent qu’à cet appareil.',
    accessibility: 'Accessibilité',
    motion: 'Animations',
    motions: { system: 'Comme l’appareil', reduce: 'Réduire les animations' },
    markers: 'Afficher un symbole sur chaque surlignage, pas seulement une couleur',
    storage: 'Où se trouve votre travail',
    persistence: {
      persisted: 'Ce navigateur a accepté de conserver vos notes. Effacer les données du site les supprime tout de même.',
      denied: 'Ce navigateur n’a pas accepté de conserver vos notes. Il peut les supprimer pour libérer de l’espace.',
      unsupported: 'Ce navigateur n’indique pas s’il conserve vos notes. Partez du principe qu’il peut les supprimer.',
      unknown: 'Vérification…',
    },
    usedOnDevice: (used: string, quota: string) => `${used} utilisés sur ${quota} sur cet appareil.`,
    mirrored: 'Vos notes sont aussi enregistrées dans un dossier que vous avez choisi.',
    notMirrored: 'Vos notes ne sont que dans ce navigateur. Exportez-les, ou enregistrez-en une copie dans un dossier, pour les protéger.',
    exportAll: 'Tout exporter',
    anotherFolder: 'Choisir un autre dossier',
    mirror: 'Copier dans un dossier',
    assistant: 'Accès des assistants',
    assistantIntro:
      'Un assistant d’IA qui fonctionne dans ce navigateur peut lire votre bibliothèque et rédiger des notes ou des marques pour vous. C’est **désactivé** tant que vous ne l’activez pas. Rien n’est envoyé à Scriptura : l’assistant fonctionne dans votre navigateur et lit les mêmes données que l’application.',
    assistantToggle: 'Proposer les outils de Scriptura à un assistant',
    assistantSupported: 'Ce navigateur prend en charge les outils pour assistants.',
    assistantUnsupported:
      'Ce navigateur ne prend pas encore en charge les outils pour assistants : WebMCP est un premier brouillon, disponible dans Chrome derrière une option expérimentale. Le réglage est mémorisé pour le jour où il le fera.',
    assistantReadOnly:
      '**Il peut lire, pas écrire.** Un assistant peut lire vos notes, vos marques et les passages, mais il ne peut rien modifier. Tout ce qu’il veut ajouter vous est d’abord montré en entier, et n’est enregistré que si vous l’acceptez.',
    assistantTools: (count: number) => `Ce qu’un assistant pourrait faire (${num(count)} outils)`,
    toolReads: 'lecture',
    toolNeedsApproval: 'votre accord est nécessaire',
    toolsInEnglish: 'Les descriptions sont en anglais, telles que l’assistant les lit.',
    help: 'Aide',
    helpIntro:
      'Comment trouver un passage, rechercher, écrire des notes, marquer des versets et utiliser les tableaux ; le sens des abréviations ; et ce que cette application promet en matière d’accessibilité.',
    openHelp: 'Ouvrir l’aide',
    language: 'Langue',
    languageLabel: 'Langue de l’interface',
    languageSystem: 'Comme cet appareil',
    languageNote: 'Le texte biblique reste dans la langue de chaque traduction.',
  },

  help: {
    title: 'Aide',
    close: 'Fermer l’aide',
    sections: helpSections,
    abbreviations: 'Abréviations',
    abbreviationsCaption: 'Ce que signifie chaque abréviation',
    short: 'Abréviation',
    meaning: 'Signification',
    terms: [
      ['CC BY-SA 4.0', 'Creative Commons Attribution – Partage dans les mêmes conditions 4.0 : une licence libre qui demande de citer la source et de partager les modifications aux mêmes conditions.'],
      ['CC0', 'Creative Commons Zéro : l’auteur a renoncé à tous ses droits ; le texte est libre d’utilisation.'],
      ['OT', 'Ancien Testament (en anglais, Old Testament).'],
      ['NT', 'Nouveau Testament.'],
      ['PWA', 'Application web progressive : un site web que l’on peut installer et utiliser hors ligne.'],
      ['WCAG', 'Règles pour l’accessibilité des contenus web, la norme selon laquelle cette application est évaluée.'],
    ] as [string, string][],
    glossaryHeading: 'Mots employés ici',
    glossary: [
      ['Collection', 'Tous les versets que vous marquez d’une couleur. Donnez à une couleur le nom du sujet que vous suivez, et le panneau Marques liste ces versets dans l’ordre de la Bible.'],
      ['Tableau', 'Un espace où versets et notes sont disposés en fiches reliées par des flèches. Les tableaux sont enregistrés et exportés avec vos notes.'],
      ['Fiche', 'Un élément d’un tableau : un verset, une note ou un texte que vous avez tapé. Une fiche de verset affiche le verset dans la traduction que vous lisez.'],
      ['Traduction', 'Une version de la Bible, dans une langue. Toutes les traductions proposées ici peuvent être copiées librement.'],
      ['Mots entiers uniquement', 'Une option de recherche. Activée, « amour » trouve amour mais pas amours. Désactivée, elle trouve les deux.'],
      ['Respecter la casse', 'Une option de recherche. Activée, « Dieu » et « dieu » sont différents.'],
      ['Copier dans un dossier', 'Garder une copie de vos notes en fichiers texte dans un dossier de cet ordinateur, mise à jour pendant que vous écrivez. Fonctionne dans Chrome et Edge.'],
      ['Outils pour assistants', 'Un moyen pour un assistant d’IA fonctionnant dans votre navigateur de lire votre bibliothèque et de proposer des notes ou des marques. Désactivé sauf si vous l’activez ; rien n’est enregistré sans votre accord.'],
    ] as [string, string][],
    accessibilityHeading: 'Accessibilité',
    accessibility: [
      'Cette application vise le niveau AAA des Règles pour l’accessibilité des contenus web (WCAG) 2.2 pour tout ce qu’elle affiche elle-même : ses commandes, son texte, ses couleurs et son comportement. Chaque commande est accessible au clavier, mesure au moins 44 pixels sur 44, montre où se trouve le focus et porte un nom. Le texte a un contraste d’au moins 7:1 avec son fond dans tous les thèmes de couleur, et vous pouvez changer la taille, l’espacement et les couleurs dans les Paramètres.',
      'Deux choses échappent à cette promesse. Le texte biblique est affiché tel qu’il a été publié : sa difficulté de lecture et la prononciation de ses mots relèvent de chaque traduction, pas de cette application. Il en va de même pour ce que vous écrivez dans vos notes.',
      'Ce qu’une machine peut vérifier est vérifié à chaque modification. Ce qui demande une personne, comme un lecteur d’écran sur un téléphone ou l’application sous un thème de contraste Windows, est vérifié à la main, moins souvent. Si quelque chose ne fonctionne pas pour vous, signalez-le dans le suivi des problèmes du projet sur GitHub (`AlanRoman117/scriptura`).',
    ],
  },

  canvas: {
    new: 'Nouveau',
    startOne: 'En créer un',
    label: 'Tableaux',
    heading: (board: string) => `Tableau : ${board}`,
    noneOpenHeading: 'aucun ouvert',
    picker: 'Tableau',
    name: 'Nom du tableau',
    none: 'Aucun tableau pour l’instant',
    undo: (what: Removed) =>
      `Annuler : remettre ${what.kind === 'card' ? `la fiche ${what.label}` : `la connexion ${what.label}`}`,
    putBack: (what: Removed) =>
      what.kind === 'card' ? `Fiche remise : ${what.label}` : `Connexion remise : ${what.label}`,
    removed: (what: Removed) =>
      `${what.kind === 'card' ? `Fiche retirée : ${what.label}` : `Connexion retirée : ${what.label}`}. Vous pouvez annuler depuis la barre du tableau.`,
    addCard: 'Ajouter une fiche',
    addNote: 'Ajouter une note',
    addNoteName: 'Ajouter une note : placer la note la plus récente sur le tableau',
    addNoteNoNotes: 'Ajouter une note : écrivez d’abord une note',
    toNote: 'Ajouter à la note',
    toNoteName: 'Ajouter à la note : placer ce tableau dans la note ouverte',
    connections: (count: number) => `Connexions (${num(count)})`,
    connectionsLabel: 'Connexions',
    deleteBoard: 'Supprimer le tableau',
    zoom: 'Zoom',
    zoomOut: 'Zoom arrière',
    zoomIn: 'Zoom avant',
    zoomReset: (percent: string) => `Zoom ${percent}. Revenir à la taille réelle, en montrant vos fiches`,
    moveView: 'Déplacer la vue',
    viewLeft: 'Déplacer la vue vers la gauche',
    viewUp: 'Déplacer la vue vers le haut',
    viewDown: 'Déplacer la vue vers le bas',
    viewRight: 'Déplacer la vue vers la droite',
    help: 'Aide : tableaux, clavier et sens des abréviations',
    noConnections: 'Aucune connexion pour l’instant. Appuyez sur ⇢ sur une fiche, puis sur la fiche vers laquelle elle mène.',
    removeConnection: (edge: string) => `Retirer la connexion ${edge}`,
    missingCard: 'une fiche disparue',
    edge: (from: string, to: string) => `${from} → ${to}`,
    frame: (cards: number) =>
      plural(cards, { one: `Surface du tableau, ${num(cards)} fiche`, other: `Surface du tableau, ${num(cards)} fiches` }),
    frameHint:
      'Les flèches déplacent la vue ; plus et moins zooment. Chaque fiche prend le focus : les flèches la déplacent, et Alt avec une flèche la redimensionne.',
    verseCard: 'Fiche de verset',
    noteCard: 'Fiche de note',
    card: 'Fiche',
    cardName: (kind: string, label: string, colour: string | null) =>
      `${kind} : ${label}${colour ? `, ${colour}` : ''}`,
    colourName: (collection: string, colour: string) => `${collection} (${colour})`,
    cardTitle: 'Titre de la fiche',
    cardTitlePlaceholder: 'Fiche',
    cardText: 'Texte de la fiche',
    cardTextPlaceholder: 'Écrivez ici…',
    cardBody: (title: string) => `${title} : texte`,
    connect: (card: string) => `Relier ${card} à une autre fiche`,
    connectPrompt: 'Choisissez la fiche à relier : appuyez dessus, ou sur Entrée. Échap annule.',
    connected: (from: string, to: string) => `Connexion créée : ${from} → ${to}`,
    open: (card: string) => `Ouvrir ${card} dans le lecteur`,
    colour: (current: string | null, card: string) =>
      `Couleur : ${current ?? 'aucune'}. Changer la couleur de ${card}`,
    adjust: (card: string) => `Déplacer ou redimensionner ${card} sans glisser`,
    takeOff: (card: string) => `Retirer ${card} du tableau`,
    empty: 'Ce tableau est encore vide. Ajoutez une fiche ici, ou utilisez **Au tableau** à côté d’un verset pendant la lecture.',
    adjustPanel: (card: string) => `Déplacer et redimensionner ${card}`,
    colourPanel: (card: string) => `Couleur de ${card}`,
    adjustTitle: 'Déplacer et redimensionner',
    colourTitle: 'Couleur',
    panelTitle: (mode: string, card: string) => `${mode} : ${card}`,
    move: 'Déplacer',
    moveLeft: 'Déplacer vers la gauche',
    moveUp: 'Déplacer vers le haut',
    moveDown: 'Déplacer vers le bas',
    moveRight: 'Déplacer vers la droite',
    size: 'Taille',
    narrower: 'Plus étroite',
    wider: 'Plus large',
    shorter: 'Moins haute',
    taller: 'Plus haute',
    colours: 'Couleurs',
    noColour: 'Sans couleur',
    moved: (card: string, x: number, y: number) => `${card} : déplacée en ${x}, ${y}`,
    resized: (card: string, w: number, h: number) => `${card} : ${w} de large, ${h} de haut`,
    coloured: (card: string, colour: string) => `${card} : ${colour}`,
    uncoloured: (card: string) => `${card} : sans couleur`,
    noneOpen: 'Aucun tableau ouvert.',
  },

  cards: {
    verseMissing: 'Absent de cette traduction.',
    untitledNote: 'Note sans titre',
    untitledBoard: 'Tableau sans titre',
    emptyNote: 'Note vide.',
    deletedNote: 'Cette note a été supprimée.',
    card: 'Fiche',
    emptyBoard: '_Tableau vide._',
    connections: 'Connexions',
    missingCard: '(fiche disparue)',
  },
} satisfies Messages;

export const frFR: Messages = withFrenchSpacing(catalog);
