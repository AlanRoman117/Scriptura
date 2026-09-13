/**
 * Boards: verses and notes laid out on a plane, with the connections drawn.
 *
 * The spec asks for this for visual learners who otherwise export passages into
 * GoodNotes or Notability to draw on them — which means the value is precisely
 * in *not* leaving the app, so a board is first-class stored content, exported
 * with the notes rather than trapped in a canvas element.
 *
 * A node holds an **anchor**, never rendered text. A verse card records
 * `{book_slug, chapter, verse}` and is read out of whichever translation is
 * open, so a board built in `kjv` reads in `rv1909`; a note card records the
 * note's id, so editing the note updates the board. Copying the text in would
 * make a board a snapshot that silently goes stale.
 */
import type { Bible } from '@scriptura/core/types';
import { BOARDS, del, readSafely, writeSafely } from './db';
import type { HighlightColor, Note } from './notes';

export type NodeKind = 'verse' | 'note' | 'text';

export interface BoardNode {
  id: string;
  kind: NodeKind;
  x: number;
  y: number;
  /** `verse`: the passage, language-independent. */
  book_slug?: string;
  chapter?: number;
  verse?: number;
  /** The translation it was placed from — provenance, as with a link. */
  translation?: string;
  /** `note`: which note this card stands for. */
  noteId?: string;
  /** `text`: the card's own words. */
  text?: string;
  /** `text`: what the reader called it. Other kinds derive their title. */
  title?: string;
  /** Optional per-card size, when the reader has resized it. */
  w?: number;
  h?: number;
  color?: HighlightColor;
}

/** A connection, optionally saying what the connection *is*. */
export interface BoardEdge {
  id: string;
  from: string;
  to: string;
  label?: string;
}

export interface Board {
  id: string;
  name: string;
  nodes: BoardNode[];
  edges: BoardEdge[];
  created: number;
  updated: number;
}

type Reporter = (store: string, error: unknown) => void;

export const listBoards = (onFailure?: Reporter): Promise<Board[]> =>
  readSafely<Board[]>(BOARDS, [], onFailure).then((boards) =>
    [...boards].sort((a, b) => b.updated - a.updated)
  );

export const saveBoard = (board: Board, onFirstFailure?: Reporter): Promise<boolean> =>
  writeSafely(BOARDS, board.id, board, onFirstFailure);

export const deleteBoard = (id: string): Promise<unknown> =>
  del(BOARDS, id).catch(() => undefined);

export function newBoard(name = 'Untitled board'): Board {
  const now = Date.now();
  return { id: crypto.randomUUID(), name, nodes: [], edges: [], created: now, updated: now };
}

/**
 * Card geometry, in board coordinates.
 *
 * Fixed rather than measured: an edge is then drawn centre-to-centre without
 * reading the DOM on every drag frame, and `freeSlot` can reason about overlap
 * without knowing anything about rendering.
 *
 * 280 × 180 since every card control became a 44px target (2.5.5): a verse
 * card's footer holds connect, open, colour, move and remove beside a 44px
 * resize corner, which is 264px before any gap. The floors are what that
 * footer and a 44px header need, so resizing can never push the remove button
 * out of the card. Boards laid out on the old 244px grid overlap by a margin
 * until a card is moved; positions are the reader's, and are not rewritten.
 */
export const CARD_W = 280;
export const CARD_H = 180;
export const CARD_MIN_W = 272;
export const CARD_MIN_H = 136;
const GAP = 24;

/** A card's drawn size: its own if resized, the default otherwise, never below the floors. */
export const cardSize = (node: Pick<BoardNode, 'w' | 'h'>): { w: number; h: number } => ({
  w: Math.max(CARD_MIN_W, node.w ?? CARD_W),
  h: Math.max(CARD_MIN_H, node.h ?? CARD_H),
});

/**
 * Where to drop a new card so it does not land on an existing one.
 *
 * Stacked cards look like one card, and the first thing a reader does after
 * adding three verses is drag two of them apart to discover the third. The
 * test for overlap has to be the **card's own footprint** — an earlier version
 * offset by 30px and called anything more than 20px apart "free", which for a
 * 220×132 card means almost entirely on top of it.
 */
export function freeSlot(nodes: BoardNode[]): { x: number; y: number } {
  const BASE = { x: 40, y: 40 };
  const COLUMNS = 4;

  for (let i = 0; i < 400; i++) {
    const slot = {
      x: BASE.x + (i % COLUMNS) * (CARD_W + GAP),
      y: BASE.y + Math.floor(i / COLUMNS) * (CARD_H + GAP),
    };
    const overlaps = nodes.some(
      (n) => Math.abs(n.x - slot.x) < CARD_W + GAP / 2 && Math.abs(n.y - slot.y) < CARD_H + GAP / 2
    );
    if (!overlaps) return slot;
  }
  return BASE;
}

/**
 * What a card says, resolved from the anchor it holds.
 *
 * One implementation because three places need it — the board, the thumbnail
 * embedded in a note, and the export — and a card that reads differently in the
 * export than on screen is a bug nobody would think to look for.
 */
export function describeNode(
  node: BoardNode,
  ctx: { bible: Bible | null; notes: Note[] }
): { title: string; body: string } {
  if (node.kind === 'verse') {
    const book = ctx.bible?.book(node.book_slug ?? '');
    const verse = book?.chapters
      .find((c) => c.number === node.chapter)
      ?.verses.find((v) => v.number === node.verse);
    return {
      title: `${book?.name ?? node.book_slug} ${node.chapter}:${node.verse}`,
      body: verse?.text ?? 'Not in this translation.',
    };
  }
  if (node.kind === 'note') {
    const note = ctx.notes.find((n) => n.id === node.noteId);
    return {
      title: note?.title || 'Untitled note',
      body: note ? note.body || 'Empty note.' : 'This note has been deleted.',
    };
  }
  return { title: node.title?.trim() || 'Card', body: node.text ?? '' };
}

/** One line naming a card, for the export and for connection lists. */
export function nodeLabel(node: BoardNode, ctx: { bible: Bible | null; notes: Note[] }): string {
  const { title } = describeNode(node, ctx);
  if (node.kind === 'verse' && node.translation) return `${title} (${node.translation.toUpperCase()})`;
  return title;
}

export const verseNodeId = (n: Pick<BoardNode, 'book_slug' | 'chapter' | 'verse'>): string =>
  `verse:${n.book_slug}:${n.chapter}:${n.verse}`;

/**
 * A board as Markdown, for the export zip.
 *
 * Positions are deliberately **not** written out. The export exists so the work
 * is readable and portable without this app, and "x: 412, y: 88" is neither —
 * what carries is which passages are on the board and how they connect. The
 * layout stays in IndexedDB, which is where it is useful.
 */
export function boardToMarkdown(
  board: Board,
  describe: (node: BoardNode) => string
): string {
  const lines = [`# ${board.name}`, ''];

  if (board.nodes.length === 0) lines.push('_Empty board._');
  for (const node of board.nodes) {
    lines.push(`- ${describe(node)}`);
  }

  if (board.edges.length > 0) {
    lines.push('', '## Connections', '');
    const label = (id: string) => {
      const node = board.nodes.find((n) => n.id === id);
      return node ? describe(node) : '(missing card)';
    };
    for (const edge of board.edges) {
      lines.push(`- ${label(edge.from)} → ${label(edge.to)}${edge.label ? ` — ${edge.label}` : ''}`);
    }
  }

  return lines.join('\n') + '\n';
}
