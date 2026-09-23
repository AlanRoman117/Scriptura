import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { usePointerDrag } from '../lib/viewport';
import { TAP_SLOP, snapSheet, stepSheet, type SheetPosition } from '../lib/geometry';
import { MaximizeButton, PaneControlsContext, type Maximized, type Pane } from './PaneControl';
import { useI18n } from '../i18n';

/** Below this the panes cannot sit side by side; notes become a sheet. */
const NARROW = 850;
/**
 * Neither pane may be squeezed below this, in pixels.
 *
 * A *fraction* was the wrong unit: a quarter of a 1400px window is a workable
 * 350px column, but a quarter of a 900px one is 225px — narrow enough that the
 * reading bar cannot hold its own controls and the text runs about four words
 * to the line. The floor is a width, so it means the same thing at every window
 * size. The share limits remain as an upper bound on a very wide screen.
 */
const MIN_PANE = 320; // mirrored in styles.css (.layout's columns)
const MIN_SPLIT = 0.25;
const MAX_SPLIT = 0.75;

/**
 * The usable split range for a frame `width` px wide, whose divider takes
 * `divider` px of it.
 *
 * The split is the Bible's share of the frame; the notes get what is left
 * after the Bible *and the divider*. The divider was 11px and left out of the
 * sum, which cost the notes 11px of their floor. At 52px, left out, it would
 * cost them 52.
 */
function splitLimits(width: number, divider: number): [number, number] {
  if (width <= 0) return [MIN_SPLIT, MAX_SPLIT];
  const floor = Math.max(MIN_SPLIT, MIN_PANE / width);
  const ceiling = Math.min(MAX_SPLIT, 1 - (MIN_PANE + divider) / width);
  // On a frame too small to give both panes the floor, fall back to halves
  // rather than inverting the bounds.
  return floor > ceiling ? [0.5, 0.5] : [floor, ceiling];
}

const clampTo = ([min, max]: [number, number], value: number) => Math.min(max, Math.max(min, value));

export type { Maximized, SheetPosition };

/** What the side pane beside the Bible holds. */
export type Side = 'notes' | 'board';
const SIDES: readonly Side[] = ['notes', 'board'];

/** The full sheet's share of the visible viewport; mirrored in styles.css. */
const FULL_SHARE = 0.92;

/** Whether the panes are too narrow to sit side by side, so the side pane is a sheet. */
export function useIsNarrow(): boolean {
  const [narrow, setNarrow] = useState(
    () => typeof window !== 'undefined' && window.innerWidth < NARROW
  );
  useEffect(() => {
    const query = window.matchMedia(`(max-width: ${NARROW - 1}px)`);
    const onChange = (e: MediaQueryListEvent) => setNarrow(e.matches);
    setNarrow(query.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);
  return narrow;
}

interface LayoutProps {
  bible: ReactNode;
  notes: ReactNode;
  /** The canvas, the side pane's other half. */
  board: ReactNode;
  side: Side;
  onSide: (side: Side) => void;
  /**
   * Which pane fills the window, and where the phone's sheet rests. Held by
   * the app, which needs them too: following a card's verse brings the Bible
   * back, and the page title names the board when it fills the window.
   */
  maximized: Maximized;
  onMaximized: (maximized: Maximized) => void;
  sheet: SheetPosition;
  onSheet: (sheet: SheetPosition) => void;
  /**
   * The last thing put into a note, in words ("Quoted John 1:2"), or null.
   *
   * The notes pane shows it in its status line. While the notes are out of
   * sight it is shown where they are reached from instead: on the sheet's grip
   * at peek, or in a bar when the Bible is maximized.
   */
  inserted?: string | null;
  /** The reader brought the notes into view: the confirmation has done its job. */
  onNotesShown?: () => void;
}

/**
 * The reading surface: scripture left, notes right.
 *
 * Both are visible by default because the pairing is the point — you write
 * about the verse you can see. Either can be maximized when it is not.
 *
 * On a phone that split is unusable, so the Bible takes the screen and notes
 * become a bottom sheet at peek / half / full. Tabs were the alternative and
 * were rejected: switching away from the text to write about it loses exactly
 * the context the layout exists to preserve.
 */
export function Layout({
  bible,
  notes,
  board,
  side,
  onSide,
  maximized,
  onMaximized: setMaximized,
  sheet,
  onSheet: setSheet,
  inserted = null,
  onNotesShown,
}: LayoutProps) {
  const { t, fmt } = useI18n();
  const narrow = useIsNarrow();
  // 56%, not the 58% it was while the divider was an 11px line: the 52px bar
  // takes its width from both panes, rather than all of it from the notes,
  // whose bar then no longer fits one row at 1280px.
  const [split, setSplit] = useState(0.56);
  const frame = useRef<HTMLDivElement>(null);

  // Opening the sheet, or restoring the notes beside the Bible, is looking at
  // the note — which is what the confirmation was standing in for.
  const notesInView = narrow ? sheet !== 'peek' : maximized !== 'bible';
  const notesWereInView = useRef(notesInView);
  useEffect(() => {
    if (notesInView && !notesWereInView.current) onNotesShown?.();
    notesWereInView.current = notesInView;
  }, [notesInView, onNotesShown]);

  /**
   * Set by "Show notes". The button goes away as the notes come back, so
   * focus is handed to the note — where the passage just went, and where the
   * caret is waiting after it — rather than dropping to <body> (2.4.3).
   */
  const focusNotesNext = useRef(false);
  useEffect(() => {
    if (!focusNotesNext.current || maximized === 'bible') return;
    focusNotesNext.current = false;
    const target =
      side === 'notes'
        ? (document.getElementById('notes-surface') ?? document.getElementById('notes'))
        : document.getElementById('canvas');
    target?.focus();
  }, [maximized, side]);

  const sideName = side === 'notes' ? t.layout.notes : t.notes.canvas;

  /**
   * Notes or canvas: two tabs over one pane, so a reader building a diagram
   * swaps to the note and back without leaving the Bible or a maximized pane.
   * Both halves stay mounted, so the caret, the undo history, the board's zoom
   * and its scroll survive a switch.
   */
  const tabs = useRef<Partial<Record<Side, HTMLButtonElement | null>>>({});
  const choose = (next: Side) => {
    onSide(next);
    // A board needs the room: on a phone it opens at full height.
    if (narrow && next === 'board' && sheet !== 'full') setSheet('full');
  };
  const sidePane = (
    <>
      <div className="side-switch" data-testid="side-switch">
        <div className="side-switch__tabs" role="tablist" aria-label={t.layout.sides}>
          {SIDES.map((s, i) => (
            <button
              key={s}
              ref={(el) => {
                tabs.current[s] = el;
              }}
              type="button"
              role="tab"
              id={`side-tab-${s}`}
              className="side-switch__tab"
              data-testid={`side-${s}`}
              aria-selected={side === s}
              aria-controls={`side-panel-${s}`}
              // The selected tab is the one Tab stop; arrows move between them.
              tabIndex={side === s ? 0 : -1}
              onClick={() => choose(s)}
              onKeyDown={(e) => {
                const next =
                  e.key === 'ArrowRight' || e.key === 'ArrowDown'
                    ? SIDES[(i + 1) % SIDES.length]
                    : e.key === 'ArrowLeft' || e.key === 'ArrowUp'
                      ? SIDES[(i + SIDES.length - 1) % SIDES.length]
                      : e.key === 'Home'
                        ? SIDES[0]
                        : e.key === 'End'
                          ? SIDES[SIDES.length - 1]
                          : null;
                if (!next) return;
                e.preventDefault();
                choose(next);
                tabs.current[next]?.focus();
              }}
            >
              {s === 'notes' ? t.layout.notes : t.notes.canvas}
            </button>
          ))}
        </div>
        <MaximizeButton
          pane="notes"
          name={side === 'notes' ? t.layout.paneNotes : t.layout.paneBoard}
          className="side-switch__maximize"
        />
      </div>
      {/* <section>, not <div>: sectioning content keeps the note's and the
          board's own <header> and <footer> from reading as the page's banner
          and contentinfo, now that the pane itself is a plain element. */}
      {SIDES.map((s) => (
        <section
          key={s}
          role="tabpanel"
          id={`side-panel-${s}`}
          className="side-panel"
          aria-labelledby={`side-tab-${s}`}
          hidden={side !== s}
        >
          {s === 'notes' ? notes : board}
        </section>
      ))}
    </>
  );

  /* ── The notes sheet (narrow only) ──────────────────────────────────────
   *
   * The sheet is sized and anchored from the *visual* viewport (--vvh and
   * --vv-top, published by lib/viewport.ts), so when a phone's keyboard opens
   * the sheet rises with the visible area instead of staying behind the keys.
   * Its grip is dragged with the finger and snaps to peek, half or full; a
   * short press still cycles, and Up and Down step through the positions.
   * Its real height is published as --sheet-h so the chapter can always be
   * scrolled clear of it, and so the docked verse actions sit above it. */
  const sheetEl = useRef<HTMLElement>(null);
  const gripEl = useRef<HTMLButtonElement>(null);
  const [peek, setPeek] = useState(52);
  const [dragSize, setDragSize] = useState<number | null>(null);
  const gesture = useRef<{
    startY: number;
    startH: number;
    moved: number;
    samples: { y: number; t: number }[];
  } | null>(null);
  /** A drag ends in a click on the grip in some browsers; that click must not also cycle. */
  const suppressClick = useRef(false);

  /** The resting sizes, in px, for snapping. Read from the same --vvh the stylesheet uses. */
  const sheetSizes = useCallback(() => {
    const vvh =
      parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--vvh')) || window.innerHeight;
    return { peek, half: Math.max(peek, vvh * 0.5), full: Math.max(peek, vvh * FULL_SHARE) };
  }, [peek]);

  const gripDrag = usePointerDrag<HTMLButtonElement>({
    onStart: (e) => {
      suppressClick.current = false;
      const startH = sheetEl.current?.getBoundingClientRect().height ?? peek;
      gesture.current = { startY: e.clientY, startH, moved: 0, samples: [{ y: e.clientY, t: e.timeStamp }] };
    },
    onMove: (e) => {
      const g = gesture.current;
      if (!g) return;
      g.moved = Math.max(g.moved, Math.abs(e.clientY - g.startY));
      g.samples.push({ y: e.clientY, t: e.timeStamp });
      if (g.moved < TAP_SLOP) return;
      const { full } = sheetSizes();
      setDragSize(Math.min(full, Math.max(peek, g.startH + (g.startY - e.clientY))));
    },
    onEnd: (e) => {
      const g = gesture.current;
      gesture.current = null;
      if (!g || g.moved < TAP_SLOP) {
        setDragSize(null);
        return;
      }
      // A cancelled pointer reports no position; the last move is where it was.
      if (e.type === 'pointerup') g.samples.push({ y: e.clientY, t: e.timeStamp });
      const last = g.samples[g.samples.length - 1];
      const sizes = sheetSizes();
      const height = Math.min(sizes.full, Math.max(sizes.peek, g.startH + (g.startY - last.y)));
      // Speed over the last 80ms only: how the finger left, not how it began.
      const recent = g.samples.filter((s) => last.t - s.t <= 80);
      const from = recent[0] ?? last;
      const velocity = (from.y - last.y) / Math.max(1, last.t - from.t);
      suppressClick.current = true;
      setSheet(snapSheet(height, velocity, sizes));
      setDragSize(null);
    },
  });

  // The grip's own height is the peek size, so a larger text size never
  // clips the word "Notes".
  useLayoutEffect(() => {
    const grip = gripEl.current;
    if (!narrow || !grip) return;
    const measure = () => setPeek(grip.offsetHeight);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(grip);
    return () => observer.disconnect();
  }, [narrow]);

  useLayoutEffect(() => {
    const el = sheetEl.current;
    const root = document.documentElement;
    if (!narrow || !el) return;
    const write = () => root.style.setProperty('--sheet-h', `${Math.round(el.getBoundingClientRect().height)}px`);
    write();
    const observer = new ResizeObserver(write);
    observer.observe(el);
    return () => {
      observer.disconnect();
      root.style.removeProperty('--sheet-h');
    };
  }, [narrow]);

  const dividerCol = useRef<HTMLDivElement>(null);
  /** The limits for the frame as it is now, divider included. */
  const currentLimits = useCallback(
    () => splitLimits(frame.current?.getBoundingClientRect().width ?? 0, dividerCol.current?.offsetWidth ?? 0),
    []
  );
  /**
   * How far into the divider the pointer took hold. The bar is 52px wide, so
   * placing its left edge at the pointer made it jump half its width on the
   * first move; keeping the offset keeps it under the finger.
   */
  const grab = useRef(0);

  const onDrag = useCallback(
    (clientX: number) => {
      const box = frame.current?.getBoundingClientRect();
      if (!box || box.width <= 0) return;
      setSplit(clampTo(currentLimits(), (clientX - grab.current - box.left) / box.width));
    },
    [currentLimits]
  );

  /** Nudge by keyboard, against the same floor a drag respects. */
  const nudge = useCallback(
    (delta: number) => {
      const limits = currentLimits();
      // From where the divider is drawn, which a narrow window may have
      // clamped, not from a stored split it cannot reach.
      setSplit((s) => clampTo(limits, clampTo(limits, s) + delta));
    },
    [currentLimits]
  );

  // The app's one drag implementation (lib/viewport.ts): the pointer is
  // captured, and a cancelled touch ends the drag like an up, so the divider
  // is never left half-dragged with `user-select: none` on the document.
  const divider = usePointerDrag<HTMLDivElement>({
    onStart: (e) => {
      grab.current = e.clientX - (dividerCol.current?.getBoundingClientRect().left ?? e.clientX);
    },
    onMove: (e) => onDrag(e.clientX),
  });

  const paneControls = useMemo(
    () => ({
      maximized,
      toggle: (pane: Pane) => setMaximized(maximized === pane ? 'none' : pane),
    }),
    [maximized, setMaximized]
  );

  if (narrow) {
    // Only at peek: once the sheet is open the note's own status line says it.
    const onGrip = sheet === 'peek' ? inserted : null;
    const expand = side === 'notes' ? t.layout.expandNotes : t.layout.expandBoard;
    const collapse = side === 'notes' ? t.layout.collapseNotes : t.layout.collapseBoard;
    return (
      <div className="layout layout--narrow" data-testid="layout" data-mode="narrow">
        {/* Covered by a full sheet, the text is out of reach: inert, so Tab and
            a screen reader do not land on a verse that cannot be seen (2.4.12). */}
        <main className="pane pane--bible" data-testid="pane-bible" aria-label={t.layout.scripture} inert={sheet === 'full'}>
          {bible}
        </main>
        <section
          ref={sheetEl}
          className="sheet"
          data-testid="pane-notes"
          data-sheet={sheet}
          data-dragging={dragSize !== null || undefined}
          aria-label={sideName}
          style={{
            ['--sheet-peek' as string]: `${peek}px`,
            ...(dragSize !== null ? { ['--sheet-drag' as string]: `${dragSize}px` } : {}),
          }}
        >
          <button
            ref={gripEl}
            type="button"
            className="sheet__grip"
            data-testid="sheet-grip"
            // The confirmation is visible text on the button, so it is part of
            // the button's name (2.5.3): "Quoted John 1:2" is what someone
            // using speech input will say to reach it.
            aria-label={
              onGrip
                ? t.layout.gripWithNews(sheet === 'full' ? collapse : expand, onGrip)
                : sheet === 'full'
                  ? collapse
                  : expand
            }
            aria-expanded={sheet !== 'peek'}
            aria-describedby="sheet-hint"
            {...gripDrag}
            onClick={() => {
              if (suppressClick.current) {
                suppressClick.current = false;
                return;
              }
              setSheet(sheet === 'peek' ? 'half' : sheet === 'half' ? 'full' : 'peek');
            }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowUp') setSheet(stepSheet(sheet, 1));
              else if (e.key === 'ArrowDown') setSheet(stepSheet(sheet, -1));
              else return;
              e.preventDefault();
            }}
          >
            <span className="sheet__handle" aria-hidden="true" />
            <span className="sheet__label">
              {sideName}
              {onGrip && (
                <span className="done sheet__done" data-testid="sheet-done">
                  <span className="done__check" aria-hidden="true">
                    ✓
                  </span>{' '}
                  {onGrip}
                </span>
              )}
            </span>
          </button>
          <span id="sheet-hint" className="visually-hidden">
            {t.layout.sheetHint}
          </span>
          <div
            className="sheet__body"
            // Writing needs the room: at half, with a keyboard up, the note
            // would have no height left at all once the bar and tools are
            // drawn. The reader can pull it down again from the grip.
            onFocus={(e) => {
              // ⚠️ The live note editor is a contenteditable, not a textarea.
              const target = e.target as HTMLElement;
              if (sheet !== 'full' && (target.isContentEditable || target.matches('textarea, input:not([type]), input[type="text"]'))) {
                setSheet('full');
              }
            }}
          >
            {sidePane}
          </div>
        </section>
      </div>
    );
  }

  // The frame fills the window in this layout, so `innerWidth` is the right
  // stand-in on the first render, before the ref is attached — the alternative
  // is announcing 25/75 once and correcting it a beat later. The divider's
  // width is the stylesheet's `--divider-w` until the column exists to measure.
  const limits = splitLimits(
    frame.current?.getBoundingClientRect().width ?? window.innerWidth,
    dividerCol.current?.offsetWidth ?? 52
  );
  // What is drawn, and so what is announced. The stylesheet holds the same
  // floor, for a window narrowed after the split was set.
  const shown = clampTo(limits, split);

  return (
    <PaneControlsContext.Provider value={paneControls}>
    <div
      className="layout"
      data-testid="layout"
      data-mode="split"
      data-maximized={maximized}
      ref={frame}
      style={{ ['--split' as string]: `${shown * 100}%` }}
    >
      <main className="pane pane--bible" data-testid="pane-bible" aria-label={t.layout.scripture} hidden={maximized === 'notes'}>
        {bible}
        {/* The notes are maximized away, so the confirmation waits where they
            come back from, with the way back beside it. It takes no focus and
            blocks nothing. Inside the Scripture landmark, like the verse
            actions that led here, and a direct child of the pane: `.reader`
            is a size container, and a fixed box inside one is positioned
            against it rather than against the window. */}
        {maximized === 'bible' && inserted && (
          <div className="done layout__done" data-testid="layout-done">
            <span>
              <span className="done__check" aria-hidden="true">
                ✓
              </span>{' '}
              {inserted}
            </span>
            <button
              type="button"
              className="layout__done-show"
              data-testid="layout-done-show"
              onClick={() => {
                focusNotesNext.current = true;
                setMaximized('none');
              }}
            >
              {side === 'notes' ? t.layout.showNotes : t.layout.showBoard}
            </button>
          </div>
        )}
      </main>

      {maximized === 'none' && (
        <div className="divider-col" data-testid="divider-col" ref={dividerCol}>
          {/* Resizing without a drag (2.5.7): two buttons beside the grip. */}
          <button
            type="button"
            className="divider__nudge"
            data-testid="divider-narrower"
            aria-label={t.layout.notesMoreRoom}
            onClick={() => nudge(-0.1)}
          >
            ◂
          </button>
          <div
            className="divider"
            data-testid="divider"
            role="separator"
            aria-orientation="vertical"
            aria-label={t.layout.resize}
            aria-valuenow={Math.round(shown * 100)}
            aria-valuemin={Math.round(limits[0] * 100)}
            aria-valuemax={Math.round(limits[1] * 100)}
            aria-valuetext={t.layout.split(fmt.percent(Math.round(shown * 100)), fmt.percent(Math.round((1 - shown) * 100)))}
            tabIndex={0}
            {...divider}
            // Keyboard-resizable: a pointer-only divider is unusable without a mouse.
            onKeyDown={(e) => {
              const [min, max] = currentLimits();
              if (e.key === 'ArrowLeft') nudge(-0.02);
              else if (e.key === 'ArrowRight') nudge(0.02);
              else if (e.key === 'PageDown') nudge(-0.1);
              else if (e.key === 'PageUp') nudge(0.1);
              else if (e.key === 'Home') setSplit(min);
              else if (e.key === 'End') setSplit(max);
              else return;
              e.preventDefault();
            }}
          />
          <button
            type="button"
            className="divider__nudge"
            data-testid="divider-wider"
            aria-label={t.layout.bibleMoreRoom}
            onClick={() => nudge(0.1)}
          >
            ▸
          </button>
        </div>
      )}

      {/* Complementary beside the Bible; the page's main landmark when it
          fills the window, since the Bible's is hidden then. A div, not an
          <aside>, because <aside> may not take the main role, and changing
          the element would remount the note and the board and lose their
          state. */}
      <div
        className="pane pane--notes"
        data-testid="pane-notes"
        role={maximized === 'notes' ? 'main' : 'complementary'}
        aria-label={sideName}
        hidden={maximized === 'bible'}
      >
        {/* Maximized, this pane is the page, and the chapter title — the h1 —
            is hidden with the Bible. It carries the page's h1 instead, above
            the pane's own h2, so there is always exactly one (2.4.10). */}
        {maximized === 'notes' && <h1 className="visually-hidden">{sideName}</h1>}
        {sidePane}
      </div>
    </div>
    </PaneControlsContext.Provider>
  );
}
