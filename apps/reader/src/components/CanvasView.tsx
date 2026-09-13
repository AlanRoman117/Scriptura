import { useCallback, useEffect, useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import type { Bible } from '@scriptura/core/types';
import {
  HIGHLIGHT_COLORS,
  HIGHLIGHT_GLYPHS,
  colorLabel,
  type ColorLabels,
  type HighlightColor,
  type Note,
} from '../lib/notes';
import {
  CARD_MIN_H,
  CARD_MIN_W,
  cardSize,
  describeNode,
  freeSlot,
  nodeLabel,
  type Board,
  type BoardEdge,
  type BoardNode,
} from '../lib/canvas';
import { usePointerDrag } from '../lib/viewport';
import { clampZoom, pinchView, zoomAround, type PinchStart, type Point, type View } from '../lib/geometry';
import { useDismissable, useReturnFocus } from '../lib/focus';
import { announce } from '../lib/announce';
import { ConfirmButton } from './ConfirmButton';

interface CanvasViewProps {
  bible: Bible;
  notes: Note[];
  /** What the reader calls each colour, so a card's colour is named for its collection. */
  labels?: ColorLabels;
  boards: Board[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onDelete: (id: string) => void;
  onChange: (board: Board) => void;
  onClose: () => void;
  /** Open a card's passage in the reader. */
  onGo: (bookSlug: string, chapter: number, verse?: number) => void;
  /** Embed this board in the open note, where it renders as a diagram. */
  onAddToNote?: (boardId: string) => void;
  /** Open the help panel (it lives in the reading layout, so this leaves the board). */
  onHelp?: () => void;
}

/** One arrow press moves or resizes a card this far; with Shift, `BIG_STEP`. */
const STEP = 10;
const BIG_STEP = 50;
/** One press of a move or size button. */
const BUTTON_STEP = 20;
/** One arrow press on the board, or one pan button, moves the view this far. */
const PAN_STEP = 40;
const PAN_BUTTON_STEP = 80;

type Panel = { id: string; mode: 'adjust' | 'colour' };

/** What the last removal took, so it can be put back until the next change. */
type Undo = { boardId: string; what: string; nodes: BoardNode[]; edges: BoardEdge[] };

/**
 * The board: verses and notes on a plane, with the connections drawn.
 *
 * Full width rather than a third pane, because a map squeezed into 400px is a
 * list with extra steps — and the readers this is for are the ones who were
 * exporting passages into GoodNotes to lay them out by hand.
 *
 * Cards hold anchors, not text: a verse card is read out of whichever
 * translation is open and a note card follows the note, so a board does not
 * quietly become a stale snapshot of either.
 *
 * Nothing here needs a mouse, and nothing needs a drag (2.1.1, 2.5.7). A card
 * takes focus: the arrow keys move it and Alt with an arrow resizes it. The
 * board takes focus: the arrow keys move the view and + and − zoom. For a
 * pointer that cannot drag — a switch, a head pointer, a shaking hand — each
 * card has Move/Size and Colour buttons that open a panel of plain buttons,
 * and the view has pan buttons beside the zoom.
 */
export function CanvasView({
  bible,
  notes,
  labels = {},
  boards,
  activeId,
  onSelect,
  onCreate,
  onDelete,
  onChange,
  onClose,
  onGo,
  onAddToNote,
  onHelp,
}: CanvasViewProps) {
  const board = boards.find((b) => b.id === activeId) ?? null;
  // Zoom and pan are one state: every zoom moves the pan too (to keep what is
  // under the pointer, the fingers or the centre where it is), and two
  // setStates nested inside each other were how that used to be done.
  const [view, setView] = useState<View>({ zoom: 1, pan: { x: 0, y: 0 } });
  const { zoom, pan } = view;
  const setPan = (next: Point) => setView((v) => ({ ...v, pan: next }));
  const [connecting, setConnecting] = useState<string | null>(null);
  const [panel, setPanel] = useState<Panel | null>(null);
  const [showConnections, setShowConnections] = useState(false);
  const [undo, setUndo] = useState<Undo | null>(null);
  const frame = useRef<HTMLDivElement>(null);
  const panelEl = useRef<HTMLDivElement>(null);
  const drag = useRef<{ id: string; dx: number; dy: number } | null>(null);
  const resize = useRef<{ id: string; x: number; y: number; w: number; h: number } | null>(null);
  const panning = useRef<{ x: number; y: number } | null>(null);

  // Escape cancels a connection in progress. Not on an outside press: pressing
  // the background already cancels through the pan, and pressing a card is
  // how the connection is completed.
  useDismissable(connecting !== null, () => setConnecting(null), frame, { outside: false });

  // The move/size and colour panel closes on Escape or a press outside it, and
  // gives focus back to the card button that opened it.
  useEffect(() => setPanel(null), [activeId]);
  useDismissable(panel !== null, () => setPanel(null), panelEl);
  useReturnFocus(panel !== null, panel ? `[data-testid="card-${panel.mode}-${panel.id}"]` : undefined);
  useEffect(() => {
    if (panel) panelEl.current?.querySelector<HTMLElement>('button')?.focus({ preventScroll: true });
  }, [panel]);

  /**
   * Wheel to move, ctrl/⌘-wheel to zoom — the convention every other canvas
   * uses, and the plane has no scrollbars of its own to fall back on.
   *
   * Bound here rather than with React's `onWheel` because that listener is
   * passive: `preventDefault()` is ignored, and the browser scrolls the page
   * out from under the board instead.
   */
  useEffect(() => {
    const node = frame.current;
    if (!node) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) {
        const box = node.getBoundingClientRect();
        // Anchored on the pointer (lib/geometry.ts): zooming towards the
        // middle of the screen loses whatever you were looking at.
        const anchor = { x: e.clientX - box.left, y: e.clientY - box.top };
        setView((v) => zoomAround(v, v.zoom * (e.deltaY < 0 ? 1.12 : 1 / 1.12), anchor));
        return;
      }
      setView((v) => ({ ...v, pan: { x: v.pan.x - e.deltaX, y: v.pan.y - e.deltaY } }));
    };

    node.addEventListener('wheel', onWheel, { passive: false });
    return () => node.removeEventListener('wheel', onWheel);
  }, [activeId]);

  const patch = useCallback(
    (next: Partial<Pick<Board, 'name' | 'nodes' | 'edges'>>) => {
      if (!board) return;
      onChange({ ...board, ...next, updated: Date.now() });
      // Any other change ends the chance to undo a removal: putting back an
      // old set of cards over newer work would be a second loss (3.3.6).
      setUndo(null);
    },
    [board, onChange]
  );

  /**
   * A removal, remembered. The snapshot is taken before the change, and the
   * offer stands until the next change to the board — not until a timer runs
   * out (2.2.3).
   */
  const removeWithUndo = (what: string, next: Pick<Board, 'nodes' | 'edges'>) => {
    if (!board) return;
    const snapshot: Undo = { boardId: board.id, what, nodes: board.nodes, edges: board.edges };
    onChange({ ...board, ...next, updated: Date.now() });
    setUndo(snapshot);
    announce(`${what} removed. Undo is in the board's bar.`);
  };

  /** What a card says. Verse text comes from the open translation, live. */
  const describe = (node: BoardNode) => describeNode(node, { bible, notes });
  const label = (node: BoardNode) => nodeLabel(node, { bible, notes });
  const colourName = (color: HighlightColor) => `${colorLabel(color, labels)} (${color})`;

  /* ── moving and sizing, by key and by button ─────────────────────────── */

  const moveCard = (id: string, dx: number, dy: number) => {
    const node = board?.nodes.find((n) => n.id === id);
    if (!board || !node) return;
    // Clamped at the origin: a card moved past the top-left is off the plane
    // in the one direction panning back from is least obvious.
    const x = Math.max(0, node.x + dx);
    const y = Math.max(0, node.y + dy);
    patch({ nodes: board.nodes.map((n) => (n.id === id ? { ...n, x, y } : n)) });
    announce(`${label(node)}: moved to ${Math.round(x)}, ${Math.round(y)}`);
  };

  const resizeCard = (id: string, dw: number, dh: number) => {
    const node = board?.nodes.find((n) => n.id === id);
    if (!board || !node) return;
    const size = cardSize(node);
    const w = Math.max(CARD_MIN_W, size.w + dw);
    const h = Math.max(CARD_MIN_H, size.h + dh);
    patch({ nodes: board.nodes.map((n) => (n.id === id ? { ...n, w, h } : n)) });
    announce(`${label(node)}: ${Math.round(w)} wide, ${Math.round(h)} tall`);
  };

  const colourCard = (id: string, color: HighlightColor | undefined) => {
    const node = board?.nodes.find((n) => n.id === id);
    if (!board || !node) return;
    patch({ nodes: board.nodes.map((n) => (n.id === id ? { ...n, color } : n)) });
    announce(color ? `${label(node)}: ${colourName(color)}` : `${label(node)}: no colour`);
  };

  /** Zoom by a step about the middle of the frame — what the buttons and keys do. */
  const frameBox = () => frame.current?.getBoundingClientRect();
  const zoomBy = (step: number) => {
    const box = frameBox();
    const centre = box ? { x: box.width / 2, y: box.height / 2 } : { x: 0, y: 0 };
    setView((v) => zoomAround(v, clampZoom(Math.round((v.zoom + step) * 100) / 100), centre));
  };

  const panBy = (dx: number, dy: number) =>
    setView((v) => ({ ...v, pan: { x: v.pan.x + dx, y: v.pan.y + dy } }));

  const onCardKey = (node: BoardNode) => (e: ReactKeyboardEvent<HTMLDivElement>) => {
    // Keys typed into the card's own fields and buttons are theirs.
    if (e.target !== e.currentTarget) return;
    if (connecting && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      connect(node.id);
      return;
    }
    // Delete asks, it does not act: it moves to the card's remove button and
    // arms it, so Enter confirms and Escape backs out (3.3.6).
    if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      const remove = e.currentTarget.querySelector<HTMLButtonElement>(`[data-testid="card-remove-${node.id}"]`);
      remove?.focus();
      remove?.click();
      return;
    }
    const step = e.shiftKey ? BIG_STEP : STEP;
    const delta: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };
    const d = delta[e.key];
    if (!d) return;
    // preventDefault matters twice: the frame must not scroll, and Alt with an
    // arrow is the browser's back and forward in a page that does not claim it.
    e.preventDefault();
    e.stopPropagation();
    if (e.altKey) resizeCard(node.id, d[0], d[1]);
    else moveCard(node.id, d[0], d[1]);
  };

  const onFrameKey = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return;
    const step = e.shiftKey ? PAN_STEP * 4 : PAN_STEP;
    // The arrow says which way to look, so the plane moves the other way.
    const delta: Record<string, [number, number]> = {
      ArrowLeft: [step, 0],
      ArrowRight: [-step, 0],
      ArrowUp: [0, step],
      ArrowDown: [0, -step],
    };
    const d = delta[e.key];
    if (d) {
      e.preventDefault();
      panBy(d[0], d[1]);
      return;
    }
    // Single keys are safe here: they act only while the board itself has
    // focus, never while typing in a card (2.1.4).
    if (e.key === '+' || e.key === '=') {
      e.preventDefault();
      zoomBy(0.2);
    } else if (e.key === '-') {
      e.preventDefault();
      zoomBy(-0.2);
    }
  };

  /* ── pinch ───────────────────────────────────────────────────────────────
   *
   * Every touch and pen pointer on the frame is tracked in the capture phase,
   * so it is seen wherever it lands — background, card, grip. A second finger
   * turns whatever the first was doing (a pan, a card drag, a resize) into a
   * pinch: the gesture helpers' own state is cleared, so their moves become
   * no-ops, and their onStart refuses while a pinch is live. When either
   * finger lifts the pinch ends, and the one left behind does not resume a
   * pan it never meant. The arithmetic is pinchView in lib/geometry.ts. */
  const pointers = useRef(new Map<number, Point>());
  const pinch = useRef<PinchStart | null>(null);

  const toFrame = (e: React.PointerEvent) => {
    const box = frameBox();
    return box ? { x: e.clientX - box.left, y: e.clientY - box.top } : { x: e.clientX, y: e.clientY };
  };
  const between = (a: Point, b: Point) => ({
    mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
    distance: Math.hypot(a.x - b.x, a.y - b.y),
  });

  const pinchHandlers = {
    onPointerDownCapture: (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.pointerType === 'mouse') return;
      pointers.current.set(e.pointerId, toFrame(e));
      if (pointers.current.size !== 2) return;
      const [a, b] = [...pointers.current.values()];
      const { mid, distance } = between(a, b);
      if (distance < 1) return;
      drag.current = null;
      resize.current = null;
      panning.current = null;
      pinch.current = { view, mid, distance };
    },
    onPointerMoveCapture: (e: React.PointerEvent<HTMLDivElement>) => {
      if (!pointers.current.has(e.pointerId)) return;
      pointers.current.set(e.pointerId, toFrame(e));
      const start = pinch.current;
      if (!start || pointers.current.size < 2) return;
      const [a, b] = [...pointers.current.values()];
      const { mid, distance } = between(a, b);
      setView(pinchView(start, mid, Math.max(1, distance)));
    },
    onPointerUpCapture: (e: React.PointerEvent<HTMLDivElement>) => {
      pointers.current.delete(e.pointerId);
      if (pointers.current.size < 2) pinch.current = null;
    },
    onPointerCancelCapture: (e: React.PointerEvent<HTMLDivElement>) => {
      pointers.current.delete(e.pointerId);
      if (pointers.current.size < 2) pinch.current = null;
    },
  };

  /* ── dragging a card, resizing it, and panning the plane ──────────────── */
  //
  // Three gestures, one helper (lib/viewport.ts). The pointer is captured, so
  // the moves keep arriving when the finger leaves the element, and a touch
  // the browser takes over — a pinch, an edge swipe — ends the gesture the
  // way an up does instead of leaving a card stuck to nothing. Every card's
  // grip and resize corner get the same props; which card is held is read
  // from the element's data attribute, because a hook cannot be called per
  // card inside the map.

  const panDrag = usePointerDrag<HTMLDivElement>({
    onStart: (e) => {
      if (pinch.current) return false;
      // Anywhere that is not a card, a control or the panel pans.
      //
      // This used to compare `e.target` with `e.currentTarget`, which was
      // never equal: `.canvas__plane` is absolutely positioned over the whole
      // frame, so the press always landed on the plane and dragging the
      // background did nothing at all.
      //
      // ⚠️ Controls must be excluded, not only cards. Capturing the pointer on
      // pointerdown makes Chromium deliver the following `click` to the
      // capturing element — so a press on the edge-cut circle that also began
      // a pan never clicked the circle, and the connection could not be cut.
      if (
        (e.target as HTMLElement).closest(
          '.card, .canvas__edge-cut, .canvas__panel, button, a, input, select, textarea'
        )
      ) {
        return false;
      }
      panning.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
      setConnecting(null);
    },
    onMove: (e) => {
      if (panning.current) {
        setPan({ x: e.clientX - panning.current.x, y: e.clientY - panning.current.y });
      }
    },
    onEnd: () => {
      panning.current = null;
    },
  });

  const cardDrag = usePointerDrag<HTMLElement>({
    onStart: (e) => {
      if (pinch.current) return false;
      const box = frameBox();
      const node = board?.nodes.find((n) => n.id === e.currentTarget.dataset.nodeId);
      if (!box || !node) return false;
      drag.current = {
        id: node.id,
        dx: (e.clientX - box.left - pan.x) / zoom - node.x,
        dy: (e.clientY - box.top - pan.y) / zoom - node.y,
      };
    },
    onMove: (e) => {
      const held = drag.current;
      const box = frameBox();
      if (!held || !board || !box) return;
      // Divided by zoom: the pointer moves in screen pixels, the card lives in
      // board coordinates, and at 0.5x every drag would otherwise travel twice
      // as far as the cursor.
      // Clamped at the origin: a card dragged past the top-left is off the
      // plane in the one direction panning back from is least obvious.
      const x = Math.max(0, (e.clientX - box.left - pan.x) / zoom - held.dx);
      const y = Math.max(0, (e.clientY - box.top - pan.y) / zoom - held.dy);
      patch({ nodes: board.nodes.map((n) => (n.id === held.id ? { ...n, x, y } : n)) });
    },
    onEnd: () => {
      drag.current = null;
    },
  });

  const resizeDrag = usePointerDrag<HTMLSpanElement>({
    onStart: (e) => {
      // The corner sits inside the card; the press must not also start a drag.
      e.stopPropagation();
      if (pinch.current) return false;
      const node = board?.nodes.find((n) => n.id === e.currentTarget.dataset.nodeId);
      if (!node) return false;
      const { w, h } = cardSize(node);
      resize.current = { id: node.id, x: e.clientX, y: e.clientY, w, h };
    },
    onMove: (e) => {
      const sizing = resize.current;
      if (!sizing || !board) return;
      // Cards hold whole verses and whole notes, so a fixed size cannot be
      // right for both. The floors keep the header and every action inside.
      const w = Math.max(CARD_MIN_W, sizing.w + (e.clientX - sizing.x) / zoom);
      const h = Math.max(CARD_MIN_H, sizing.h + (e.clientY - sizing.y) / zoom);
      patch({ nodes: board.nodes.map((n) => (n.id === sizing.id ? { ...n, w, h } : n)) });
    },
    onEnd: () => {
      resize.current = null;
    },
  });

  /* ── cards ────────────────────────────────────────────────────────────── */

  const addCard = (node: Omit<BoardNode, 'id' | 'x' | 'y'>) => {
    if (!board) return;
    const slot = freeSlot(board.nodes);
    patch({ nodes: [...board.nodes, { ...node, id: crypto.randomUUID(), ...slot }] });
  };

  const removeCard = (id: string) => {
    const node = board?.nodes.find((n) => n.id === id);
    if (!board || !node) return;
    // Edges to a card that no longer exists would draw to nowhere.
    removeWithUndo(label(node), {
      nodes: board.nodes.filter((n) => n.id !== id),
      edges: board.edges.filter((e) => e.from !== id && e.to !== id),
    });
  };

  const edgeLabel = (edge: BoardEdge) => {
    const from = board?.nodes.find((n) => n.id === edge.from);
    const to = board?.nodes.find((n) => n.id === edge.to);
    return `${from ? label(from) : 'a missing card'} → ${to ? label(to) : 'a missing card'}`;
  };

  const removeEdge = (id: string) => {
    const edge = board?.edges.find((e) => e.id === id);
    if (!board || !edge) return;
    removeWithUndo(`The connection ${edgeLabel(edge)}`, {
      nodes: board.nodes,
      edges: board.edges.filter((e) => e.id !== id),
    });
  };

  function connect(to: string) {
    if (!board || !connecting || connecting === to) return setConnecting(null);
    const exists = board.edges.some(
      (e) => (e.from === connecting && e.to === to) || (e.from === to && e.to === connecting)
    );
    if (!exists) {
      patch({ edges: [...board.edges, { id: crypto.randomUUID(), from: connecting, to }] });
      const from = board.nodes.find((n) => n.id === connecting);
      const target = board.nodes.find((n) => n.id === to);
      if (from && target) announce(`Connected ${label(from)} to ${label(target)}`);
    }
    setConnecting(null);
  }

  const centre = (id: string) => {
    const node = board?.nodes.find((n) => n.id === id);
    if (!node) return null;
    const { w, h } = cardSize(node);
    return { x: node.x + w / 2, y: node.y + h / 2, w, h };
  };

  /**
   * Where a connection meets a card's edge, rather than its centre.
   *
   * Centre-to-centre is the easy version and it hides the line under both
   * cards — which, in the grid new cards land in, leaves a connection almost
   * invisible at exactly the moment it is drawn. Clipping to the boundary
   * costs one intersection and makes the arrow readable.
   */
  const boundary = (
    from: { x: number; y: number; w: number; h: number },
    to: { x: number; y: number }
  ) => {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    if (dx === 0 && dy === 0) return from;
    const scale = Math.min(
      Math.abs(dx) > 0 ? from.w / 2 / Math.abs(dx) : Infinity,
      Math.abs(dy) > 0 ? from.h / 2 / Math.abs(dy) : Infinity
    );
    return { x: from.x + dx * scale, y: from.y + dy * scale };
  };

  const panelNode = panel ? board?.nodes.find((n) => n.id === panel.id) ?? null : null;

  return (
    <main className="canvas" data-testid="canvas" aria-label="Boards">
      {/* This view replaces the whole layout, so it carries the page's level-1
          heading; the board picker is what the reader sees (2.4.10). */}
      <h1 className="visually-hidden" id="canvas-heading">
        Board: {board?.name || 'none open'}
      </h1>
      <header className="canvas__bar">
        <select
          className="canvas__select"
          aria-label="Board"
          data-testid="board-select"
          value={activeId ?? ''}
          onChange={(e) => onSelect(e.target.value)}
        >
          {boards.length === 0 && <option value="">No boards yet</option>}
          {boards.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name || 'Untitled board'}
            </option>
          ))}
        </select>
        <button type="button" className="canvas__action" data-testid="board-new" onClick={onCreate}>
          New
        </button>
        {board && undo && undo.boardId === board.id && (
          <button
            type="button"
            className="canvas__action canvas__action--undo"
            data-testid="board-undo"
            aria-label={`Undo: put back ${undo.what}`}
            onClick={() => {
              onChange({ ...board, nodes: undo.nodes, edges: undo.edges, updated: Date.now() });
              setUndo(null);
              announce(`${undo.what} put back`);
            }}
          >
            Undo remove
          </button>
        )}
        {board && (
          <>
            <button
              type="button"
              className="canvas__action"
              data-testid="board-add-text"
              onClick={() => addCard({ kind: 'text', text: '' })}
            >
              Add card
            </button>
            <button
              type="button"
              className="canvas__action"
              data-testid="board-add-note"
              disabled={notes.length === 0}
              aria-label={notes.length === 0 ? 'Add note — write a note first' : 'Add note — put the newest note on the board'}
              onClick={() => addCard({ kind: 'note', noteId: notes[0].id })}
            >
              Add note
            </button>
            {onAddToNote && (
              <button
                type="button"
                className="canvas__action"
                data-testid="board-to-note"
                aria-label="Add to note — put this board into the note you have open"
                onClick={() => onAddToNote(board.id)}
              >
                Add to note
              </button>
            )}
            {/* The connections in words: the text alternative to the arrows,
                which are drawn as a picture (1.1.1), and the keyboard's way to
                remove one (2.1.1). */}
            <button
              type="button"
              className="canvas__action"
              data-testid="board-connections"
              aria-expanded={showConnections}
              aria-controls="board-connections-list"
              onClick={() => setShowConnections((open) => !open)}
            >
              Connections ({board.edges.length})
            </button>
            <ConfirmButton
              label="Delete board"
              className="canvas__action canvas__action--danger"
              data-testid="board-delete"
              resetKey={board.id}
              onConfirm={() => onDelete(board.id)}
            />
          </>
        )}

        <span className="canvas__spacer" />
        <div className="canvas__zoom" role="group" aria-label="Zoom">
          <button type="button" data-testid="zoom-out" aria-label="Zoom out" onClick={() => zoomBy(-0.2)}>
            −
          </button>
          <button
            type="button"
            data-testid="zoom-reset"
            aria-label={`Zoom ${Math.round(zoom * 100)}%. Reset to full size, showing your cards`}
            onClick={() => {
              // Panned to the content, not to the origin: a board whose cards
              // all sit at x=2000 would otherwise "reset" to empty space.
              const nodes = board?.nodes ?? [];
              if (nodes.length === 0) return setView({ zoom: 1, pan: { x: 0, y: 0 } });
              const left = Math.min(...nodes.map((n) => n.x));
              const top = Math.min(...nodes.map((n) => n.y));
              setView({ zoom: 1, pan: { x: 40 - left, y: 40 - top } });
            }}
          >
            {Math.round(zoom * 100)}%
          </button>
          <button type="button" data-testid="zoom-in" aria-label="Zoom in" onClick={() => zoomBy(0.2)}>
            +
          </button>
        </div>
        {/* Moving the view without dragging it (2.5.7). Each says which way
            the view goes, so the plane moves the other way. */}
        <div className="canvas__zoom canvas__pan" role="group" aria-label="Move the view">
          <button type="button" data-testid="pan-left" aria-label="Move the view left" onClick={() => panBy(PAN_BUTTON_STEP, 0)}>
            ←
          </button>
          <button type="button" data-testid="pan-up" aria-label="Move the view up" onClick={() => panBy(0, PAN_BUTTON_STEP)}>
            ↑
          </button>
          <button type="button" data-testid="pan-down" aria-label="Move the view down" onClick={() => panBy(0, -PAN_BUTTON_STEP)}>
            ↓
          </button>
          <button type="button" data-testid="pan-right" aria-label="Move the view right" onClick={() => panBy(-PAN_BUTTON_STEP, 0)}>
            →
          </button>
        </div>
        <button type="button" className="canvas__action" data-testid="canvas-close" onClick={onClose}>
          Back to reading
        </button>
        {onHelp && (
          <button
            type="button"
            className="canvas__action canvas__action--icon"
            data-testid="canvas-help"
            aria-label="Help — boards, keyboard, and what the abbreviations mean"
            onClick={onHelp}
          >
            ?
          </button>
        )}
      </header>

      {board && showConnections && (
        <section className="canvas__connections" id="board-connections-list" aria-label="Connections">
          {board.edges.length === 0 ? (
            <p className="canvas__connections-empty">
              No connections yet. Press ⇢ on a card, then the card it leads to.
            </p>
          ) : (
            <ul className="canvas__connections-list" role="list">
              {board.edges.map((edge) => (
                <li key={edge.id} className="canvas__connection">
                  <span className="canvas__connection-text">{edgeLabel(edge)}</span>
                  <button
                    type="button"
                    className="canvas__action"
                    data-testid={`edge-remove-${edge.id}`}
                    aria-label={`Remove the connection ${edgeLabel(edge)}`}
                    onClick={() => removeEdge(edge.id)}
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {board ? (
        <div
          className="canvas__frame"
          ref={frame}
          tabIndex={0}
          role="region"
          aria-label={`Board canvas, ${board.nodes.length} ${board.nodes.length === 1 ? 'card' : 'cards'}`}
          aria-describedby="canvas-hint"
          data-connecting={connecting ? 'true' : undefined}
          onKeyDown={onFrameKey}
          {...panDrag}
          {...pinchHandlers}
        >
          <span id="canvas-hint" className="visually-hidden">
            Arrow keys move the view; plus and minus zoom. Each card takes focus: arrow keys move it, and Alt with
            an arrow resizes it.
          </span>
          <div
            className="canvas__plane"
            style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}
          >
            <svg className="canvas__edges" aria-hidden="true">
              <defs>
                {/* A flowchart, not a graph: the direction is part of what the
                    reader is recording. */}
                <marker
                  id="canvas-arrow"
                  viewBox="0 0 10 10"
                  refX="9"
                  refY="5"
                  markerWidth="6"
                  markerHeight="6"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 0 L 10 5 L 0 10 z" />
                </marker>
              </defs>
              {board.edges.map((edge) => {
                const a = centre(edge.from);
                const b = centre(edge.to);
                if (!a || !b) return null;
                const start = boundary(a, b);
                const end = boundary(b, a);
                const mx = (start.x + end.x) / 2;
                const my = (start.y + end.y) / 2;
                return (
                  <g key={edge.id}>
                    <line
                      x1={start.x}
                      y1={start.y}
                      x2={end.x}
                      y2={end.y}
                      markerEnd="url(#canvas-arrow)"
                    />
                    {/* Always drawn, not only on hover: an invisible control is
                        undiscoverable by touch and a trap for a stray tap. A
                        44px hit circle around a 22px chip; the Connections
                        list is the equivalent control for the keyboard and for
                        assistive technology, which does not see this picture. */}
                    <g className="canvas__edge-cut" onClick={() => removeEdge(edge.id)}>
                      <circle className="canvas__edge-hit" cx={mx} cy={my} r={22} />
                      <circle className="canvas__edge-chip" cx={mx} cy={my} r={11} />
                      <path className="canvas__edge-x" d={`M ${mx - 4} ${my - 4} L ${mx + 4} ${my + 4} M ${mx + 4} ${my - 4} L ${mx - 4} ${my + 4}`} />
                    </g>
                  </g>
                );
              })}
            </svg>

            {board.nodes.map((node) => {
              const { title, body } = describe(node);
              const size = cardSize(node);
              const kind = node.kind === 'verse' ? 'Verse card' : node.kind === 'note' ? 'Note card' : 'Card';
              return (
                <div
                  className="card"
                  key={node.id}
                  role="group"
                  tabIndex={0}
                  // What the card is, what it holds, and its colour in words —
                  // so the colour is never the only way to know it (1.4.1).
                  aria-label={`${kind}: ${label(node)}${node.color ? `, ${colourName(node.color)}` : ''}`}
                  aria-describedby="canvas-hint"
                  data-testid={`card-${node.id}`}
                  data-kind={node.kind}
                  data-color={node.color}
                  style={{ left: node.x, top: node.y, width: size.w, height: size.h }}
                  onClick={() => connecting && connect(node.id)}
                  onKeyDown={onCardKey(node)}
                >
                  <header className="card__grip" data-node-id={node.id} {...cardDrag}>
                    {node.color && (
                      <span className="swatch__glyph card__glyph" aria-hidden="true">
                        {HIGHLIGHT_GLYPHS[node.color]}
                      </span>
                    )}
                    {node.kind === 'text' ? (
                      // A card the reader wrote is a card the reader names. The
                      // other kinds derive their title from what they point at,
                      // so an editable one there would only drift.
                      <input
                        className="card__title-input"
                        data-testid={`card-title-${node.id}`}
                        aria-label="Card title"
                        placeholder="Card"
                        value={node.title ?? ''}
                        onPointerDown={(e) => e.stopPropagation()}
                        onChange={(e) =>
                          patch({
                            nodes: board.nodes.map((n) =>
                              n.id === node.id ? { ...n, title: e.target.value } : n
                            ),
                          })
                        }
                      />
                    ) : (
                      <span className="card__title">{title}</span>
                    )}
                  </header>

                  {node.kind === 'text' ? (
                    <textarea
                      className="card__editor"
                      data-testid={`card-text-${node.id}`}
                      aria-label="Card text"
                      placeholder="Write here…"
                      value={node.text ?? ''}
                      onChange={(e) =>
                        patch({
                          nodes: board.nodes.map((n) =>
                            n.id === node.id ? { ...n, text: e.target.value } : n
                          ),
                        })
                      }
                    />
                  ) : (
                    // Scrollable, not clipped: a card can hold a whole note or
                    // a long verse, and neither fits in any fixed height. A
                    // region that scrolls must take focus, or the keyboard
                    // cannot scroll it.
                    <div
                      className="card__body"
                      tabIndex={0}
                      role="group"
                      aria-label={`${title} — text`}
                      lang={node.kind === 'verse' ? bible.meta.language : undefined}
                    >
                      {body}
                    </div>
                  )}

                  <footer className="card__actions">
                    <button
                      type="button"
                      className="card__action"
                      data-testid={`card-connect-${node.id}`}
                      aria-pressed={connecting === node.id}
                      aria-label={`Connect ${label(node)} to another card`}
                      onClick={(e) => {
                        e.stopPropagation();
                        const next = connecting === node.id ? null : node.id;
                        setConnecting(next);
                        if (next) announce('Choose the card to connect to: press it, or Enter on it. Escape cancels.');
                      }}
                    >
                      ⇢
                    </button>
                    {node.kind === 'verse' && (
                      <button
                        type="button"
                        className="card__action"
                        data-testid={`card-open-${node.id}`}
                        aria-label={`Open ${label(node)} in the reader`}
                        onClick={(e) => {
                          e.stopPropagation();
                          onGo(node.book_slug ?? '', node.chapter ?? 1, node.verse);
                        }}
                      >
                        ↗
                      </button>
                    )}
                    <button
                      type="button"
                      className="card__action"
                      data-testid={`card-colour-${node.id}`}
                      aria-label={`Colour: ${node.color ? colourName(node.color) : 'none'}. Change the colour of ${label(node)}`}
                      aria-expanded={panel?.id === node.id && panel.mode === 'colour'}
                      onClick={(e) => {
                        e.stopPropagation();
                        setPanel({ id: node.id, mode: 'colour' });
                      }}
                    >
                      <span className="swatch__disc card__colour" data-color={node.color} aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      className="card__action"
                      data-testid={`card-adjust-${node.id}`}
                      aria-label={`Move or resize ${label(node)} without dragging`}
                      aria-expanded={panel?.id === node.id && panel.mode === 'adjust'}
                      onClick={(e) => {
                        e.stopPropagation();
                        setPanel({ id: node.id, mode: 'adjust' });
                      }}
                    >
                      ✥
                    </button>
                    {/* Two presses, announced, with Cancel — and Undo after (3.3.6). */}
                    <ConfirmButton
                      label="✕"
                      className="card__action card__action--danger"
                      data-testid={`card-remove-${node.id}`}
                      aria-label={`Take ${label(node)} off the board`}
                      onConfirm={() => removeCard(node.id)}
                    />
                  </footer>

                  <span
                    className="card__resize"
                    data-testid={`card-resize-${node.id}`}
                    data-node-id={node.id}
                    aria-hidden="true"
                    {...resizeDrag}
                  />
                </div>
              );
            })}
          </div>

          {board.nodes.length === 0 && (
            <p className="canvas__empty">
              Nothing on this board yet. Add a card here, or use <strong>Canvas</strong> beside a
              verse while reading.
            </p>
          )}

          {panel && panelNode && (
            <div
              className="canvas__panel"
              ref={panelEl}
              role="group"
              aria-label={panel.mode === 'adjust' ? `Move and resize ${label(panelNode)}` : `Colour of ${label(panelNode)}`}
              data-testid="card-panel"
            >
              <p className="canvas__panel-title" aria-hidden="true">
                {panel.mode === 'adjust' ? 'Move and resize' : 'Colour'}: {label(panelNode)}
              </p>
              {panel.mode === 'adjust' ? (
                <>
                  <div className="canvas__panel-row" role="group" aria-label="Move">
                    <button type="button" className="canvas__action" data-testid="adjust-left" aria-label="Move left" onClick={() => moveCard(panelNode.id, -BUTTON_STEP, 0)}>
                      ←
                    </button>
                    <button type="button" className="canvas__action" data-testid="adjust-up" aria-label="Move up" onClick={() => moveCard(panelNode.id, 0, -BUTTON_STEP)}>
                      ↑
                    </button>
                    <button type="button" className="canvas__action" data-testid="adjust-down" aria-label="Move down" onClick={() => moveCard(panelNode.id, 0, BUTTON_STEP)}>
                      ↓
                    </button>
                    <button type="button" className="canvas__action" data-testid="adjust-right" aria-label="Move right" onClick={() => moveCard(panelNode.id, BUTTON_STEP, 0)}>
                      →
                    </button>
                  </div>
                  <div className="canvas__panel-row" role="group" aria-label="Size">
                    <button type="button" className="canvas__action" data-testid="adjust-narrower" onClick={() => resizeCard(panelNode.id, -BUTTON_STEP, 0)}>
                      Narrower
                    </button>
                    <button type="button" className="canvas__action" data-testid="adjust-wider" onClick={() => resizeCard(panelNode.id, BUTTON_STEP, 0)}>
                      Wider
                    </button>
                    <button type="button" className="canvas__action" data-testid="adjust-shorter" onClick={() => resizeCard(panelNode.id, 0, -BUTTON_STEP)}>
                      Shorter
                    </button>
                    <button type="button" className="canvas__action" data-testid="adjust-taller" onClick={() => resizeCard(panelNode.id, 0, BUTTON_STEP)}>
                      Taller
                    </button>
                  </div>
                </>
              ) : (
                <div className="canvas__panel-row" role="group" aria-label="Colours">
                  {HIGHLIGHT_COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      className="swatch"
                      data-testid={`card-swatch-${color}`}
                      aria-label={colourName(color)}
                      aria-pressed={panelNode.color === color}
                      onClick={() => colourCard(panelNode.id, color)}
                    >
                      <span className="swatch__disc" data-color={color} aria-hidden="true">
                        <span className="swatch__glyph">{HIGHLIGHT_GLYPHS[color]}</span>
                      </span>
                    </button>
                  ))}
                  <button
                    type="button"
                    className="canvas__action"
                    data-testid="card-swatch-none"
                    aria-pressed={!panelNode.color}
                    onClick={() => colourCard(panelNode.id, undefined)}
                  >
                    No colour
                  </button>
                </div>
              )}
              <button type="button" className="canvas__action canvas__panel-done" data-testid="card-panel-close" onClick={() => setPanel(null)}>
                Done
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="canvas__empty">
          <p>No board open.</p>
          <button type="button" className="canvas__action" onClick={onCreate}>
            Start one
          </button>
        </div>
      )}
    </main>
  );
}
