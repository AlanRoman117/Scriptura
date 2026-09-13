import { useCallback, useEffect, useRef, useState } from 'react';
import type { Bible } from '@scriptura/core/types';
import { HIGHLIGHT_COLORS, type HighlightColor, type Note } from '../lib/notes';
import { CARD_H, CARD_W, describeNode, freeSlot, type Board, type BoardNode } from '../lib/canvas';
import { usePointerDrag } from '../lib/viewport';
import { clampZoom, zoomAround, type Point, type View } from '../lib/geometry';
import { useDismissable } from '../lib/focus';
import { ConfirmButton } from './ConfirmButton';

interface CanvasViewProps {
  bible: Bible;
  notes: Note[];
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
 */
export function CanvasView({
  bible,
  notes,
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
  const frame = useRef<HTMLDivElement>(null);
  const drag = useRef<{ id: string; dx: number; dy: number } | null>(null);
  const resize = useRef<{ id: string; x: number; y: number; w: number; h: number } | null>(null);
  const panning = useRef<{ x: number; y: number } | null>(null);

  // Escape cancels a connection in progress. Not on an outside press: pressing
  // the background already cancels through the pan, and pressing a card is
  // how the connection is completed.
  useDismissable(connecting !== null, () => setConnecting(null), frame, { outside: false });

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
    },
    [board, onChange]
  );

  const sizeOf = (node: BoardNode) => ({ w: node.w ?? CARD_W, h: node.h ?? CARD_H });

  /* ── dragging a card, resizing it, and panning the plane ──────────────── */
  //
  // Three gestures, one helper (lib/viewport.ts). The pointer is captured, so
  // the moves keep arriving when the finger leaves the element, and a touch
  // the browser takes over — a pinch, an edge swipe — ends the gesture the
  // way an up does instead of leaving a card stuck to nothing. Every card's
  // grip and resize corner get the same props; which card is held is read
  // from the element's data attribute, because a hook cannot be called per
  // card inside the map.

  const frameBox = () => frame.current?.getBoundingClientRect();

  /** Zoom by a step about the middle of the frame — what the buttons and keys do. */
  const zoomBy = (step: number) => {
    const box = frameBox();
    const centre = box ? { x: box.width / 2, y: box.height / 2 } : { x: 0, y: 0 };
    setView((v) => zoomAround(v, clampZoom(Math.round((v.zoom + step) * 100) / 100), centre));
  };

  const panDrag = usePointerDrag<HTMLDivElement>({
    onStart: (e) => {
      // Anywhere that is not a card or a control pans.
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
      if ((e.target as HTMLElement).closest('.card, .canvas__edge-cut, button, a, input, select, textarea')) {
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
      const node = board?.nodes.find((n) => n.id === e.currentTarget.dataset.nodeId);
      if (!node) return false;
      const { w, h } = sizeOf(node);
      resize.current = { id: node.id, x: e.clientX, y: e.clientY, w, h };
    },
    onMove: (e) => {
      const sizing = resize.current;
      if (!sizing || !board) return;
      // Cards hold whole verses and whole notes, so a fixed size cannot be
      // right for both. Floors keep the grip and the title reachable.
      const w = Math.max(160, sizing.w + (e.clientX - sizing.x) / zoom);
      const h = Math.max(96, sizing.h + (e.clientY - sizing.y) / zoom);
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
    if (!board) return;
    // Edges to a card that no longer exists would draw to nowhere.
    patch({
      nodes: board.nodes.filter((n) => n.id !== id),
      edges: board.edges.filter((e) => e.from !== id && e.to !== id),
    });
  };

  const connect = (to: string) => {
    if (!board || !connecting || connecting === to) return setConnecting(null);
    const exists = board.edges.some(
      (e) => (e.from === connecting && e.to === to) || (e.from === to && e.to === connecting)
    );
    if (!exists) {
      patch({ edges: [...board.edges, { id: crypto.randomUUID(), from: connecting, to }] });
    }
    setConnecting(null);
  };

  /** What a card says. Verse text comes from the open translation, live. */
  const describe = (node: BoardNode) => describeNode(node, { bible, notes });

  const centre = (id: string) => {
    const node = board?.nodes.find((n) => n.id === id);
    if (!node) return null;
    const { w, h } = sizeOf(node);
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
              title={notes.length === 0 ? 'Write a note first' : 'Put a note on the board'}
              onClick={() => addCard({ kind: 'note', noteId: notes[0].id })}
            >
              Add note
            </button>
            {onAddToNote && (
              <button
                type="button"
                className="canvas__action"
                data-testid="board-to-note"
                title="Put this board into the note you have open"
                onClick={() => onAddToNote(board.id)}
              >
                Add to note
              </button>
            )}
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

      {board ? (
        <div
          className="canvas__frame"
          ref={frame}
          data-connecting={connecting ? 'true' : undefined}
          {...panDrag}
        >
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
                return (
                  <g key={edge.id}>
                    <line
                      x1={start.x}
                      y1={start.y}
                      x2={end.x}
                      y2={end.y}
                      markerEnd="url(#canvas-arrow)"
                    />
                    <circle
                      className="canvas__edge-cut"
                      cx={(start.x + end.x) / 2}
                      cy={(start.y + end.y) / 2}
                      r={9}
                      onClick={() => patch({ edges: board.edges.filter((e) => e.id !== edge.id) })}
                    />
                  </g>
                );
              })}
            </svg>

            {board.nodes.map((node) => {
              const { title, body } = describe(node);
              return (
                <article
                  className="card"
                  key={node.id}
                  data-testid={`card-${node.id}`}
                  data-kind={node.kind}
                  data-color={node.color}
                  style={{ left: node.x, top: node.y, width: node.w ?? CARD_W, height: node.h ?? CARD_H }}
                  onClick={() => connecting && connect(node.id)}
                >
                  <header className="card__grip" data-node-id={node.id} {...cardDrag}>
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
                    // a long verse, and neither fits in any fixed height.
                    <p className="card__body">{body}</p>
                  )}

                  <footer className="card__actions">
                    <button
                      type="button"
                      className="card__action"
                      data-testid={`card-connect-${node.id}`}
                      aria-pressed={connecting === node.id}
                      aria-label="Connect this card to another"
                      onClick={(e) => {
                        e.stopPropagation();
                        setConnecting(connecting === node.id ? null : node.id);
                      }}
                    >
                      ⇢
                    </button>
                    {node.kind === 'verse' && (
                      <button
                        type="button"
                        className="card__action"
                        data-testid={`card-open-${node.id}`}
                        aria-label="Open this passage in the reader"
                        onClick={(e) => {
                          e.stopPropagation();
                          onGo(node.book_slug ?? '', node.chapter ?? 1, node.verse);
                        }}
                      >
                        ↗
                      </button>
                    )}
                    <span className="card__swatches">
                      {HIGHLIGHT_COLORS.map((color) => (
                        <button
                          key={color}
                          type="button"
                          className="card__dot"
                          data-color={color}
                          aria-label={`Colour ${color}`}
                          aria-pressed={node.color === color}
                          onClick={(e) => {
                            e.stopPropagation();
                            patch({
                              nodes: board.nodes.map((n) =>
                                n.id === node.id
                                  ? { ...n, color: n.color === color ? undefined : (color as HighlightColor) }
                                  : n
                              ),
                            });
                          }}
                        />
                      ))}
                    </span>
                    <button
                      type="button"
                      className="card__action card__action--danger"
                      data-testid={`card-remove-${node.id}`}
                      aria-label="Take this card off the board"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeCard(node.id);
                      }}
                    >
                      ✕
                    </button>
                  </footer>

                  <span
                    className="card__resize"
                    data-testid={`card-resize-${node.id}`}
                    data-node-id={node.id}
                    aria-hidden="true"
                    {...resizeDrag}
                  />
                </article>
              );
            })}
          </div>

          {board.nodes.length === 0 && (
            <p className="canvas__empty">
              Nothing on this board yet. Add a card here, or use <strong>Canvas</strong> beside a
              verse while reading.
            </p>
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
