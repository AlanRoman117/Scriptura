import { useEffect, useRef, useState } from 'react';
import type { Bible, LoadedBook } from '@scriptura/core/types';
import { requiresAttribution } from '../lib/translation';
import { prefersReducedMotion } from '../lib/prefs';
import { verseSeparator } from '../lib/verses';
import { useDismissable, useReturnFocus } from '../lib/focus';
import { useRecedingMenus } from '../lib/recede';
import {
  HIGHLIGHT_GLYPHS,
  colorLabel,
  highlightId,
  type ColorLabels,
  type Highlight,
  type HighlightColor,
} from '../lib/notes';
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
  onHighlight: (verse: number, color: HighlightColor) => void;
  onQuote: (verse: number) => void;
  onLink: (verse: number) => void;
  onSendToCanvas?: (verse: number) => void;
  focusVerse?: number | null;
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
  const [openVerse, setOpenVerse] = useState<number | null>(null);
  /** Whether the actions were opened from the verse number, which moves focus into them. */
  const [fromNumber, setFromNumber] = useState(false);
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

  /** The verse whose actions are open — the whole <p>, so a press on it is not "outside". */
  const openVerseEl = useRef<HTMLParagraphElement | null>(null);

  // Swatches left open on a verse you have navigated away from are stale.
  useEffect(() => setOpenVerse(null), [book.slug, chapter]);

  // Escape closes them — only them, if something opened later is on top — and
  // so does a press anywhere outside the verse. Focus goes back to where it
  // was, or, when that was a control inside the row that has just gone, to the
  // verse number the row belonged to (2.4.3).
  useDismissable(openVerse !== null, () => setOpenVerse(null), openVerseEl, { ignore: '.verse' });
  useReturnFocus(openVerse !== null, openVerse !== null ? `[data-testid="verse-${openVerse}"]` : undefined);

  useEffect(() => {
    if (focusVerse == null) return;
    const el = document.querySelector(`.verse[data-verse="${focusVerse}"]`);
    // The stylesheet cannot reach a scroll the script starts, so the motion
    // preference is asked here (2.3.3). The flash class stays: under reduced
    // motion the CSS draws it as a still outline rather than an animation.
    el?.scrollIntoView({ block: 'center', behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
    el?.classList.add('verse--flash');
    const t = window.setTimeout(() => el?.classList.remove('verse--flash'), 1600);
    return () => window.clearTimeout(t);
  }, [focusVerse, book.slug, chapter]);

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

  const current = book.chapters.find((c) => c.number === chapter);
  const meta = bible.meta;
  const separator = verseSeparator(meta.language);

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
              const open = openVerse === v.number;
              return (
                <p
                  className="verse"
                  key={v.number}
                  ref={open ? openVerseEl : undefined}
                  data-verse={v.number}
                  data-highlight={mark?.color ?? undefined}
                  data-open={open || undefined}
                  // The whole verse is the target. Reaching for a control at
                  // the margin and then back out to the far end of the line is
                  // a lot of travel for what should be one quick act.
                  onClick={() => {
                    // …but a drag that selected text is not a click on the
                    // verse. Reading and copying must not trip the swatches.
                    if (!window.getSelection()?.isCollapsed) return;
                    setFromNumber(false);
                    setOpenVerse(open ? null : v.number);
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
                        ? t.reader.markVerseIn(
                            `${book.name} ${chapter}:${v.number}`,
                            colorLabel(mark.color, labels, t.colours),
                            t.colourWords[mark.color]
                          )
                        : t.reader.markVerse(`${book.name} ${chapter}:${v.number}`)
                    }
                    aria-expanded={open}
                    onClick={(e) => {
                      e.stopPropagation();
                      setFromNumber(true);
                      setOpenVerse(open ? null : v.number);
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

                  {open && (
                    <VerseActions
                      reference={`${book.name} ${chapter}:${v.number}`}
                      verse={v.number}
                      current={mark?.color}
                      labels={labels}
                      focusOnOpen={fromNumber}
                      onHighlight={(color) => {
                        onHighlight(v.number, color);
                        setOpenVerse(null);
                      }}
                      onQuote={() => {
                        onQuote(v.number);
                        setOpenVerse(null);
                      }}
                      onLink={() => {
                        onLink(v.number);
                        setOpenVerse(null);
                      }}
                      onSendToCanvas={
                        onSendToCanvas
                          ? () => {
                              onSendToCanvas(v.number);
                              setOpenVerse(null);
                            }
                          : undefined
                      }
                      onClose={() => setOpenVerse(null)}
                    />
                  )}
                </p>
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
