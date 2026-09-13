import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { usePointerDrag } from '../lib/viewport';
import { TAP_SLOP, snapSheet, stepSheet, type SheetPosition } from '../lib/geometry';

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
const MIN_PANE = 320;
const MIN_SPLIT = 0.25;
const MAX_SPLIT = 0.75;

/** The usable split range for a given frame width. */
function splitLimits(width: number): [number, number] {
  if (width <= 0) return [MIN_SPLIT, MAX_SPLIT];
  const floor = Math.max(MIN_SPLIT, MIN_PANE / width);
  const ceiling = Math.min(MAX_SPLIT, 1 - MIN_PANE / width);
  // On a frame too small to give both panes the floor, fall back to halves
  // rather than inverting the bounds.
  return floor > ceiling ? [0.5, 0.5] : [floor, ceiling];
}

export type Maximized = 'none' | 'bible' | 'notes';
export type { SheetPosition };

/** The full sheet's share of the visible viewport; mirrored in styles.css. */
const FULL_SHARE = 0.92;

function useIsNarrow(): boolean {
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
export function Layout({ bible, notes, inserted = null, onNotesShown }: LayoutProps) {
  const narrow = useIsNarrow();
  const [split, setSplit] = useState(0.58);
  const [maximized, setMaximized] = useState<Maximized>('none');
  const [sheet, setSheet] = useState<SheetPosition>('peek');
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
    (document.getElementById('notes-surface') ?? document.getElementById('notes'))?.focus();
  }, [maximized]);

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

  const onDrag = useCallback((clientX: number) => {
    const box = frame.current?.getBoundingClientRect();
    if (!box) return;
    const [min, max] = splitLimits(box.width);
    setSplit(Math.min(max, Math.max(min, (clientX - box.left) / box.width)));
  }, []);

  /** Nudge by keyboard, against the same floor a drag respects. */
  const nudge = useCallback((delta: number) => {
    const width = frame.current?.getBoundingClientRect().width ?? 0;
    const [min, max] = splitLimits(width);
    setSplit((s) => Math.min(max, Math.max(min, s + delta)));
  }, []);

  // The app's one drag implementation (lib/viewport.ts): the pointer is
  // captured, and a cancelled touch ends the drag like an up, so the divider
  // is never left half-dragged with `user-select: none` on the document.
  const divider = usePointerDrag<HTMLDivElement>({ onMove: (e) => onDrag(e.clientX) });

  if (narrow) {
    // Only at peek: once the sheet is open the note's own status line says it.
    const onGrip = sheet === 'peek' ? inserted : null;
    return (
      <div className="layout layout--narrow" data-testid="layout" data-mode="narrow">
        {/* Covered by a full sheet, the text is out of reach: inert, so Tab and
            a screen reader do not land on a verse that cannot be seen (2.4.12). */}
        <main className="pane pane--bible" data-testid="pane-bible" aria-label="Scripture" inert={sheet === 'full'}>
          {bible}
        </main>
        <section
          ref={sheetEl}
          className="sheet"
          data-testid="pane-notes"
          data-sheet={sheet}
          data-dragging={dragSize !== null || undefined}
          aria-label="Notes"
          style={{
            ['--sheet-peek' as string]: `${peek}px`,
            ...(dragSize !== null ? { ['--sheet-drag' as string]: `${dragSize}px` } : {}),
          }}
        >
          <button
            ref={gripEl}
            type="button"
            className="sheet__grip"
            // The confirmation is visible text on the button, so it is part of
            // the button's name (2.5.3): "Quoted John 1:2" is what someone
            // using speech input will say to reach it.
            aria-label={`${sheet === 'full' ? 'Collapse notes' : 'Expand notes'}${onGrip ? `, ${onGrip}` : ''}`}
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
              Notes
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
            Drag, or use the up and down arrow keys, to make the notes taller or shorter.
          </span>
          <div
            className="sheet__body"
            // Writing needs the room: at half, with a keyboard up, the note
            // would have no height left at all once the bar and tools are
            // drawn. The reader can pull it down again from the grip.
            onFocus={(e) => {
              if (sheet !== 'full' && (e.target as HTMLElement).matches('textarea, input:not([type]), input[type="text"]')) {
                setSheet('full');
              }
            }}
          >
            {notes}
          </div>
        </section>
      </div>
    );
  }

  // The frame fills the window in this layout, so `innerWidth` is the right
  // stand-in on the first render, before the ref is attached — the alternative
  // is announcing 25/75 once and correcting it a beat later.
  const limits = splitLimits(
    frame.current?.getBoundingClientRect().width ?? window.innerWidth
  );

  return (
    <div
      className="layout"
      data-testid="layout"
      data-mode="split"
      data-maximized={maximized}
      ref={frame}
      style={{ ['--split' as string]: `${split * 100}%` }}
    >
      <main className="pane pane--bible" data-testid="pane-bible" aria-label="Scripture" hidden={maximized === 'notes'}>
        <PaneControl
          label="Bible"
          active={maximized === 'bible'}
          onToggle={() => setMaximized(maximized === 'bible' ? 'none' : 'bible')}
        />
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
              Show notes
            </button>
          </div>
        )}
      </main>

      {maximized === 'none' && (
        <div className="divider-col">
          {/* Resizing without a drag (2.5.7): two buttons beside the grip. */}
          <button
            type="button"
            className="divider__nudge"
            data-testid="divider-narrower"
            aria-label="Give the notes more room"
            onClick={() => nudge(-0.1)}
          >
            ◂
          </button>
          <div
            className="divider"
            data-testid="divider"
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize panes"
            aria-valuenow={Math.round(split * 100)}
            aria-valuemin={Math.round(limits[0] * 100)}
            aria-valuemax={Math.round(limits[1] * 100)}
            aria-valuetext={`${Math.round(split * 100)}% Bible, ${Math.round((1 - split) * 100)}% notes`}
            tabIndex={0}
            {...divider}
            // Keyboard-resizable: a pointer-only divider is unusable without a mouse.
            onKeyDown={(e) => {
              const [min, max] = splitLimits(frame.current?.getBoundingClientRect().width ?? 0);
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
            aria-label="Give the Bible more room"
            onClick={() => nudge(0.1)}
          >
            ▸
          </button>
        </div>
      )}

      <aside className="pane pane--notes" data-testid="pane-notes" aria-label="Notes" hidden={maximized === 'bible'}>
        <PaneControl
          label="Notes"
          active={maximized === 'notes'}
          onToggle={() => setMaximized(maximized === 'notes' ? 'none' : 'notes')}
        />
        {notes}
      </aside>
    </div>
  );
}

function PaneControl({ label, active, onToggle }: { label: string; active: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      className="pane__maximize"
      data-testid={`maximize-${label.toLowerCase()}`}
      aria-pressed={active}
      title={active ? `Restore ${label}` : `Maximize ${label}`}
      onClick={onToggle}
    >
      {active ? '⤡' : '⤢'}
      <span className="visually-hidden">{active ? `Restore ${label}` : `Maximize ${label}`}</span>
    </button>
  );
}
