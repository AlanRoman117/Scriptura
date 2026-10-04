import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import type { Bible, LoadedBook } from '@scriptura/core/types';
import { requiresAttribution } from '../lib/translation';
import { prefersReducedMotion } from '../lib/prefs';
import { verseSeparator } from '../lib/verses';
import { settleFocus, useDismissable, useReturnFocus } from '../lib/focus';
import { announce } from '../lib/announce';
import { useRecedingMenus } from '../lib/recede';
import {
  HIGHLIGHT_COLORS,
  HIGHLIGHT_GLYPHS,
  colorLabel,
  highlightId,
  type ColorLabels,
  type Highlight,
  type HighlightColor,
} from '../lib/notes';
import {
  extendTo,
  fillSpan,
  formatRuns,
  formatVerses,
  swatchState,
  toRuns,
  toggleVerse,
  type SwatchState,
  type VerseSelection,
} from '../lib/selection';
import { VerseActions } from './VerseActions';
import { MaximizeButton } from './PaneControl';
import { useI18n } from '../i18n';

interface BiblePaneProps {
  bible: Bible;
  book: LoadedBook;
  chapter: number;
  highlights: Highlight[];
  /** What the reader calls each colour; a mark's name says its collection. */
  labels?: ColorLabels;
  onNavigate: (bookSlug: string, chapter: number) => void;
  /**
   * Each acts on every selected verse, given in the chapter's order: one
   * verse, a range, or verses apart.
   */
  /**
   * `group` is which selection the verses are: the same number for as long as
   * the same verses stay selected, so the colour just pressed, pressed again,
   * can be told from a first press on verses selected afresh.
   */
  onHighlight: (verses: number[], color: HighlightColor, group: number) => void;
  onQuote: (verses: number[]) => void;
  onLink: (verses: number[]) => void;
  onSendToCanvas?: (verses: number[]) => void;
  focusVerse?: number | null;
  /** The last verse of a range that was jumped to: the whole range is pointed out. */
  focusThrough?: number | null;
  search?: React.ReactNode;
  /**
   * The phone layout: the bar and the search box may recede, and the title
   * strip carries the button that brings them back.
   */
  narrow?: boolean;
  /** The reader's preference: recede while scrolling, or only from the button. */
  recede?: boolean;
  /** The storage notice, on a phone: in the pane, so it scrolls off with the chapter. */
  notice?: React.ReactNode;
  /** Bibles in the interface's language, offered above the chapter while reading. */
  offer?: React.ReactNode;
  /** Marks or the library, rendered over the text while open. */
  overlay?: React.ReactNode;
  /** Side-by-side reading, rendered *instead of* the single-column chapter. */
  compare?: React.ReactNode;
  marksOpen?: boolean;
  markCount?: number;
  onToggleMarks?: () => void;
  libraryOpen?: boolean;
  onToggleLibrary?: () => void;
  settingsOpen?: boolean;
  onToggleSettings?: () => void;
  helpOpen?: boolean;
  onToggleHelp?: () => void;
}

export function BiblePane({
  bible,
  book,
  chapter,
  highlights,
  labels = {},
  onNavigate,
  onHighlight,
  onQuote,
  onLink,
  onSendToCanvas,
  focusVerse,
  focusThrough,
  search,
  narrow = false,
  recede = true,
  notice,
  offer,
  overlay,
  compare,
  marksOpen = false,
  markCount = 0,
  onToggleMarks,
  libraryOpen = false,
  onToggleLibrary,
  settingsOpen = false,
  onToggleSettings,
  helpOpen = false,
  onToggleHelp,
}: BiblePaneProps) {
  const { t, fmt } = useI18n();
  /**
   * The verses the row of actions will act on (lib/selection.ts). A press adds
   * a verse and pressing it again takes it out, so a passage is quoted as one
   * block under one reference instead of a verse and a reference at a time.
   */
  const [selection, setSelection] = useState<VerseSelection | null>(null);
  /** Whether the last verse was added from its number, which moves focus into the row. */
  const [fromNumber, setFromNumber] = useState(false);
  const current = book.chapters.find((c) => c.number === chapter);
  /** The chapter's verses in order: what "between" and "adjacent" mean here. */
  const order = useMemo(() => current?.verses.map((v) => v.number) ?? [], [current]);
  // For effects that read the order without answering to it: another
  // translation gives a new list of the same verses.
  const orderNow = useRef(order);
  orderNow.current = order;
  const selected = selection?.verses ?? [];
  const many = selected.length > 1;
  /** Which selection this is: a new number whenever the selection changes. */
  const group = useRef(0);
  useEffect(() => {
    group.current += 1;
  }, [selection]);
  const head = useRef<HTMLDivElement>(null);
  const reader = useRef<HTMLDivElement>(null);
  const bar = useRef<HTMLElement>(null);
  const [stuck, setStuck] = useState(false);

  // On a phone the bar and the search box step aside as the reader scrolls
  // on, and the title strip is what stays (lib/recede.ts). They are unpinned,
  // not hidden: still in the page, still in the Tab order, and focus arriving
  // in them pins them again. Not while a panel is open — the chapter, and the
  // button that brings them back, are hidden then.
  const MENUS = '.reader__bar, .search';
  const receding = useRecedingMenus({ enabled: narrow && !overlay, auto: recede, menus: MENUS });
  const { watch: watchScroll } = receding;
  useEffect(() => {
    watchScroll(reader.current?.closest<HTMLElement>('.pane') ?? null);
  }, [watchScroll]);
  const menusShown = receding.menus === 'shown';
  /** Whether the chapter is long enough to scroll past its menus. */
  const [canRecede, setCanRecede] = useState(true);

  // The sticky offsets used to be constants (3.1rem for the bar, 2.9rem for
  // the search box). 44px controls and a text-size preference make both
  // wrong, so the heights are measured and written onto the scrolling pane,
  // where the stylesheet reads them for the sticky title, the search box and
  // the scroll padding that keeps a focused verse clear of them (2.4.11).
  //
  // `--pane-top` is where the pane starts in the viewport. Anything above it —
  // the storage notice beside the notes, the preview notice — pushes the search suggestions down, and the
  // room they have above the software keyboard is measured from the top of
  // the screen, not from the top of the pane. The pane's own size changes when
  // that notice comes or goes, so observing the pane catches it.
  useEffect(() => {
    const node = reader.current;
    const barEl = bar.current;
    if (!node || !barEl) return;
    const target = node.closest<HTMLElement>('.pane') ?? node;
    const searchEl = node.querySelector<HTMLElement>('.search');
    const headEl = head.current;
    const write = () => {
      target.style.setProperty('--bar-h', `${barEl.offsetHeight}px`);
      target.style.setProperty('--search-h', `${searchEl?.offsetHeight ?? 0}px`);
      // The pinned title covers text too: a verse focused from the keyboard
      // has to come to rest below it, not below the search box (2.4.12). Zero
      // while a panel hides the chapter.
      target.style.setProperty('--head-h', `${headEl?.offsetHeight ?? 0}px`);
      target.style.setProperty('--pane-top', `${Math.max(0, Math.round(target.getBoundingClientRect().top))}px`);
      // A chapter too short to scroll past its own menus has nowhere to put them.
      setCanRecede(target.scrollHeight - target.clientHeight >= barEl.offsetHeight + (searchEl?.offsetHeight ?? 0));
    };
    write();
    const observer = new ResizeObserver(write);
    observer.observe(barEl);
    observer.observe(target);
    if (searchEl) observer.observe(searchEl);
    // ⚠️ Its border box: receded, the strip gains padding for an installed
    // app's status area (`env(safe-area-inset-top)`), which leaves its content
    // box as it was. Watching the content box, the height stayed stale by the
    // inset — 47px and more on a notched phone — and focus came to rest that
    // far under the title. The effect also runs again when the menus change.
    if (headEl) observer.observe(headEl, { box: 'border-box' });
    const chapterEl = node.querySelector<HTMLElement>('.chapter');
    if (chapterEl) observer.observe(chapterEl);
    window.addEventListener('resize', write);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', write);
    };
  }, [search, receding.menus]);

  // ⚠️ Focus arriving in the pinned bars must not move the text. The pane's
  // scroll padding is for what scrolls under them, and a control in them is
  // inside it — so the browser "brought it into view", the bar stayed pinned,
  // and the text went back 360px for every Tab along the bar, to the top of
  // the chapter. Receded on a phone, the bar is parked above the pane and the
  // browser went to the top at once to look for it. The stylesheet tells
  // buttons and selects they are already in view (`scroll-margin-top`); a
  // text field scrolls for its caret and does not listen, so its place is put
  // back here. The pane has moved by the time `focusin` is heard but its
  // scroll event has not arrived, so the last position heard is where the
  // reader was. Never under a finger: this answers a move of focus.
  useEffect(() => {
    const pane = reader.current?.closest<HTMLElement>('.pane');
    if (!pane) return;
    let last = pane.scrollTop;
    const onScroll = () => {
      last = pane.scrollTop;
    };
    const onFocus = (e: FocusEvent) => {
      const target = e.target as Element;
      if (!target.closest(MENUS) || target.closest('.search__panel')) return;
      if (pane.scrollTop !== last) pane.scrollTop = last;
    };
    pane.addEventListener('scroll', onScroll, { passive: true });
    pane.addEventListener('focusin', onFocus, true);
    return () => {
      pane.removeEventListener('scroll', onScroll);
      pane.removeEventListener('focusin', onFocus, true);
    };
  }, []);

  /** The row of actions. A press on a verse is that verse's to handle, not "outside". */
  const rowEl = useRef<HTMLDivElement | null>(null);

  // A selection left on verses you have navigated away from is stale: another
  // chapter or translation, a panel over the text, a comparison in its place.
  const translation = bible.meta.id;
  const covered = !!overlay;
  const comparing = !!compare;
  useEffect(() => setSelection(null), [book.slug, chapter, translation, covered, comparing]);

  /** "John 1:3-5", "John 1:1, 14": the selection as it is cited. */
  const refOf = (verses: readonly number[]) => `${book.name} ${chapter}:${formatVerses(verses, order)}`;

  /** Clear the selection. A group going is said; one verse closing is not, as it never was. */
  const clear = (said = true) => {
    // Said every time: the same words answer a new group being cleared.
    if (said && many) announce(t.reader.selectionCleared, { force: true });
    setSelection(null);
  };

  /**
   * A press on a verse, or on its number (`viaNumber`): it joins the
   * selection, or leaves it. With Shift, everything between joins too.
   */
  const press = (verse: number, viaNumber: boolean, extend: boolean) => {
    const next = extend ? extendTo(selection, verse, order, viaNumber) : toggleVerse(selection, verse, order, viaNumber);
    const added = (next?.verses.length ?? 0) > selected.length;
    // Added from its number, the verse brings the row and focus goes into it;
    // removed from its number, focus stays on the number.
    setFromNumber(viaNumber && added);
    setSelection(next);
    if (!next) {
      if (many) announce(t.reader.selectionCleared, { force: true });
      return;
    }
    // Said when focus does not carry the news. Focus moving into the row
    // reads the row's name, which says the same, and a message as well would
    // be cut off by it (4.1.3). One verse opening its actions stays quiet.
    //
    // ⚠️ Focus moves only when the row comes to a new verse. Shift+Enter on
    // the number the row already hangs under takes in the verses between and
    // leaves both the row and focus where they were: that was said by nothing.
    const focusMoves = viaNumber && added && next.host !== selection?.host;
    const isGroup = next.verses.length > 1 || many;
    if (isGroup && !focusMoves) {
      announce(t.reader.selection(next.verses.length, refOf(next.verses)), { force: true });
    }
  };

  /** Every verse between the first and the last selected (the row's button). */
  const fill = () => {
    if (!selection) return;
    const next = fillSpan(selection, order);
    const said = () => announce(t.reader.selection(next.verses.length, refOf(next.verses)), { force: true });
    // The button goes with the gaps it filled. If it had focus, focus moves on
    // to Quote, the act a filled range is most often for, rather than falling
    // to the top of the page; the news is said once it has landed.
    const button = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setSelection(next);
    if (button?.matches('[data-testid="verse-fill"]')) {
      settleFocus(button, { to: [`[data-testid="quote-${next.host}"]`] }, said);
    } else said();
  };

  // Escape clears the selection — only it, if something opened later is on
  // top. A press anywhere outside closes one verse, as it always has; a group
  // is left alone, so a stray press or the start of a scroll does not throw
  // away ten verses chosen one by one. Focus goes back to where it was, or to
  // the number of the verse the row hung under (2.4.3).
  useDismissable(selection !== null, () => clear(), rowEl, { ignore: '.verse', outside: !many });
  useReturnFocus(selection !== null, selection ? `[data-testid="verse-${selection.host}"]` : undefined);

  useEffect(() => {
    if (focusVerse == null) return;
    // A range that was jumped to is pointed out whole, not by its first verse.
    // ⚠️ The order is read, not answered to: as a dependency, another
    // translation — a new list of the same verses — sent the pane back to a
    // verse jumped to long before, and flashed it again.
    const order = orderNow.current;
    const from = order.indexOf(focusVerse);
    const to = focusThrough != null && order.indexOf(focusThrough) > from ? order.indexOf(focusThrough) : from;
    const numbers = from === -1 ? [focusVerse] : order.slice(from, to + 1);
    const els = numbers
      .map((n) => document.querySelector(`.verse[data-verse="${n}"]`))
      .filter((el): el is Element => !!el);
    // The stylesheet cannot reach a scroll the script starts, so the motion
    // preference is asked here (2.3.3). The flash class stays: under reduced
    // motion the CSS draws it as a still outline rather than an animation.
    els[0]?.scrollIntoView({
      block: els.length > 1 ? 'start' : 'center',
      behavior: prefersReducedMotion() ? 'auto' : 'smooth',
    });
    for (const el of els) el.classList.add('verse--flash');
    const t = window.setTimeout(() => {
      for (const el of els) el.classList.remove('verse--flash');
    }, 1600);
    return () => window.clearTimeout(t);
  }, [focusVerse, focusThrough, book.slug, chapter]);

  // A sticky element gives no signal that it is pinned, so detect it by
  // comparing the heading's position against where it parks. Only then does it
  // draw its rule — a permanent divider under an unpinned heading is noise.
  //
  // Deliberately not IntersectionObserver: `rootMargin` accepts px and % only,
  // so the `rem` offset this needs is not expressible there. (It throws on
  // construction, which takes the whole pane down with it.)
  useEffect(() => {
    const node = head.current;
    const scroller = node?.closest('.pane');
    if (!node || !scroller) return;

    const check = () => {
      const barHeight = parseFloat(getComputedStyle(node).top) || 0;
      const top = node.getBoundingClientRect().top - scroller.getBoundingClientRect().top;
      setStuck(top <= barHeight + 1);
    };

    check();
    scroller.addEventListener('scroll', check, { passive: true });
    return () => scroller.removeEventListener('scroll', check);
  }, [book.slug, chapter]);

  const toggleMenus = () => {
    if (!menusShown) {
      receding.show();
      return;
    }
    receding.hide();
    // At the top of a chapter the menus are simply the first thing on the
    // page, and unpinning them there would change nothing the reader can
    // see. Putting them away means scrolling past them, to where the title
    // sits at the top of the pane.
    const node = head.current;
    const scroller = node?.closest('.pane');
    if (!node || !scroller || stuck) return;
    const top = scroller.scrollTop + node.getBoundingClientRect().top - scroller.getBoundingClientRect().top;
    scroller.scrollTo({ top, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
  };

  const meta = bible.meta;
  const separator = verseSeparator(meta.language);

  // For each collection: all of the selected verses, some, or none.
  const marks = new Map(highlights.map((h) => [h.id, h.color]));
  const colours = selected.map((n) => marks.get(highlightId({ book_slug: book.slug, chapter, verse: n })));
  const states = Object.fromEntries(HIGHLIGHT_COLORS.map((c) => [c, swatchState(colours, c)])) as Record<
    HighlightColor,
    SwatchState
  >;
  // "Select 3-18": shown while the selection skips verses.
  const runs = toRuns(selected, order);
  const span = runs.length > 1 ? formatRuns([[runs[0][0], runs[runs.length - 1][1]]]) : null;

  return (
    <div className="reader" ref={reader} data-menus={narrow ? receding.menus : undefined}>
      <header className="reader__bar" ref={bar}>
        {/* A landmark of its own: "where am I, and how do I move" is the first
            thing a screen reader user looks for (2.4.8). */}
        <nav className="reader__nav" aria-label={t.reader.passage}>
          <select
            className="reader__select"
            aria-label={t.reader.book}
            data-testid="book-select"
            value={book.slug}
            onChange={(e) => onNavigate(e.target.value, 1)}
          >
            {/* Book names are the Bible's words, in its language (3.1.2);
                the select around them, its name and its chapters are the
                interface's. */}
            {bible.books.map((b) => (
              <option key={b.slug} value={b.slug} lang={bible.meta.language}>
                {b.name}
              </option>
            ))}
          </select>
          <select
            className="reader__select reader__select--chapter"
            aria-label={t.reader.chapter}
            data-testid="chapter-select"
            value={chapter}
            onChange={(e) => onNavigate(book.slug, Number(e.target.value))}
          >
            {book.chapters.map((c) => (
              <option key={c.number} value={c.number}>
                {c.number}
              </option>
            ))}
          </select>
        </nav>
        {/* The translation badge used to be decoration, and was the first thing
            dropped when the bar ran out of room. It is a control now — the way
            in to the library — so nothing here is dropped; only the Marks label
            is, and its count stands in for it. */}
        {/* Disclosures, not toggles: each opens a panel, so aria-expanded and
            aria-controls say so (4.1.2). The name starts with the visible text
            (2.5.3) and then says what the abbreviation stands for (3.1.4). */}
        <button
          type="button"
          className="reader__chip reader__chip--translation"
          data-testid="library-open"
          aria-expanded={libraryOpen}
          aria-controls="library-panel"
          aria-label={t.reader.translationChip(meta.id.toUpperCase(), meta.name)}
          onClick={onToggleLibrary}
        >
          {meta.id.toUpperCase()}
        </button>
        <button
          type="button"
          className="reader__chip"
          data-testid="marks-open"
          aria-expanded={marksOpen}
          aria-controls="marks-panel"
          aria-label={t.reader.marksChip(markCount)}
          onClick={onToggleMarks}
        >
          <span className="reader__chip-label">{t.reader.marks}</span>
          <span className="reader__chip-count" data-empty={markCount === 0 || undefined}>
            {fmt.number(markCount)}
          </span>
        </button>
        <button
          type="button"
          className="reader__chip reader__chip--icon"
          data-testid="settings-open"
          aria-expanded={settingsOpen}
          aria-controls="settings-panel"
          aria-label={t.reader.settingsChip}
          onClick={onToggleSettings}
        >
          ⚙
        </button>
        {/* Help lives here in every state (3.2.6), after the other chips. */}
        <button
          type="button"
          className="reader__chip reader__chip--icon"
          data-testid="help-open"
          aria-expanded={helpOpen}
          aria-controls="help-panel"
          aria-label={t.reader.helpChip}
          onClick={onToggleHelp}
        >
          ?
        </button>
        {/* Last, where it is drawn: the pane's own maximize, beside the pane's
            other controls. Renders nothing on a phone. */}
        <MaximizeButton pane="bible" className="reader__chip reader__chip--icon" />
      </header>

      {search}

      {notice}

      {!overlay && offer}

      {overlay}

      <article
        className={compare ? 'chapter chapter--compare' : 'chapter'}
        id="scripture"
        tabIndex={-1}
        data-testid="chapter"
        hidden={!!overlay}
      >
        {/* The book's name is the Bible's, in its language (3.1.2): spoken in
            its voice, and set the way that language is set — a style's
            Latin tracking and small capitals stay off Japanese and Chinese. */}
        {/* The strip that stays pinned: where the reader is, and on a phone
            the button for the menus above it. */}
        <div className="chapter__head" ref={head} data-stuck={stuck}>
          <h1 className="chapter__title" data-stuck={stuck} data-testid="chapter-title">
            <span className="chapter__book" lang={bible.meta.language}>
              {book.name}
            </span>{' '}
            {chapter}
          </h1>
          {/* A press for what a scroll does (2.5.1), named for what it will
              do. The menus are never removed from the page, so this says
              nothing of expanding or collapsing: it only pins and unpins. */}
          {narrow && (
            <button
              type="button"
              className="reader__chip reader__chip--icon chapter__menus"
              data-testid="chapter-menus-toggle"
              aria-label={menusShown ? t.reader.hideMenus : t.reader.showMenus}
              // A chapter that fits with its menus has nowhere to put them:
              // the button would change its name and nothing else.
              disabled={menusShown && !canRecede}
              onClick={toggleMenus}
            >
              <span className="menus__glyph" aria-hidden="true">{menusShown ? '▴' : '▾'}</span>
            </button>
          )}
        </div>
        {compare ? (
          compare
        ) : current ? (
          // The chapter holds interface controls as well as scripture — the
          // verse numbers and the verse actions — so the translation's
          // language goes on each verse's text, not here. On the container,
          // a Spanish Bible read with an English interface had every "Mark
          // John 1:2" and "Quote" spoken with Spanish phonemes (3.1.2).
          <div className="chapter__text">
            {current.verses.map((v) => {
              const id = highlightId({ book_slug: book.slug, chapter, verse: v.number });
              const mark = highlights.find((h) => h.id === id);
              const open = selected.includes(v.number);
              return (
                <Fragment key={v.number}>
                <p
                  className="verse"
                  data-verse={v.number}
                  data-highlight={mark?.color ?? undefined}
                  data-open={open || undefined}
                  // Shift and a press is the browser's way to stretch a text
                  // selection, which the guard below would then take for a
                  // drag. While verses are selected and no text is, it is
                  // ours: everything between joins the selection.
                  onMouseDown={(e) => {
                    if (e.shiftKey && selection && window.getSelection()?.isCollapsed) e.preventDefault();
                  }}
                  // The whole verse is the target. Reaching for a control at
                  // the margin and then back out to the far end of the line is
                  // a lot of travel for what should be one quick act.
                  onClick={(e) => {
                    // …but a drag that selected text is not a click on the
                    // verse. Reading and copying must not trip the swatches.
                    if (!window.getSelection()?.isCollapsed) return;
                    press(v.number, false, e.shiftKey && !!selection);
                  }}
                >
                  {/* A shape as well as a colour, when the reader asks for it
                      (1.4.1). Hidden from assistive technology: the number's
                      name already says the collection in words. */}
                  {mark && (
                    <span className="verse__marker" data-color={mark.color} aria-hidden="true">
                      {HIGHLIGHT_GLYPHS[mark.color]}
                    </span>
                  )}
                  {/* The verse number is the keyboard path to the same action.
                      Tabbing 176 verses of Psalm 119 is no worse than before —
                      but it is now a control that was already on the page,
                      rather than an invisible one hiding in the margin. */}
                  <button
                    type="button"
                    className="verse__num"
                    data-testid={`verse-${v.number}`}
                    // The collection is in the name, so which colour a verse
                    // is in does not depend on seeing the colour (1.4.1).
                    aria-label={
                      mark
                        ? t.reader.selectVerseIn(
                            `${book.name} ${chapter}:${v.number}`,
                            colorLabel(mark.color, labels, t.colours),
                            t.colourWords[mark.color]
                          )
                        : t.reader.selectVerse(`${book.name} ${chapter}:${v.number}`)
                    }
                    // A toggle: pressed while its verse is in the selection.
                    // It was a disclosure (`aria-expanded`), but with several
                    // verses selected the one row belongs to no single number.
                    aria-pressed={open}
                    onClick={(e) => {
                      e.stopPropagation();
                      press(v.number, true, e.shiftKey && !!selection);
                    }}
                  >
                    {v.number}
                  </button>
                  <span className="verse__text" lang={meta.language}>
                    {v.text}
                  </span>
                  {/* Read as running text, the verses need a space between
                      them — except in Japanese and Chinese (lib/verses.ts). */}
                  {separator}
                </p>
                {/* One row for the whole selection, after the verse it hangs
                    under: its next sibling, not inside it, so it can stay on
                    screen as the chapter scrolls. Keyed by that verse, so a
                    verse added from its number brings a new row and focus. */}
                {selection?.host === v.number && (
                  <VerseActions
                    key={`actions-${v.number}`}
                    rowRef={rowEl}
                    reference={refOf(selected)}
                    book={{ name: book.name, lang: meta.language }}
                    count={selected.length}
                    verse={v.number}
                    states={states}
                    labels={labels}
                    focusOnOpen={fromNumber}
                    fill={span ? { label: t.verseActions.fill(span), onFill: fill } : undefined}
                    onHighlight={(color) => {
                      onHighlight(selected, color, group.current);
                      // One verse closes, as it always has. A group stays
                      // selected: the colour can be seen on it, and the same
                      // press takes it off again.
                      if (!many) clear(false);
                    }}
                    onQuote={() => {
                      onQuote(selected);
                      clear(false);
                    }}
                    onLink={() => {
                      onLink(selected);
                      clear(false);
                    }}
                    onSendToCanvas={
                      onSendToCanvas
                        ? () => {
                            onSendToCanvas(selected);
                            clear(false);
                          }
                        : undefined
                    }
                    onClose={() => clear()}
                  />
                )}
                </Fragment>
              );
            })}
          </div>
        ) : (
          <p className="empty">{t.reader.chapterMissing(meta.name)}</p>
        )}
      </article>

      {/* CC BY-SA obliges the notice where the material appears, so it sits with
          the text rather than in an About page. Public-domain texts show nothing. */}
      {requiresAttribution(meta) && (
        <footer className="attribution" data-testid="attribution">
          {meta.attribution} ·{' '}
          {/* The link's own text says whose source (2.4.9). */}
          <a href={meta.source_url} target="_blank" rel="noreferrer noopener">
            {t.common.source(meta.name)}
          </a>
        </footer>
      )}
    </div>
  );
}
