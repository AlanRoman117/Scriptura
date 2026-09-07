/**
 * Notes and highlights — the user's own work.
 *
 * This is the data the product exists to protect, so every operation here is
 * written to survive the browser being unhelpful: a store that fails to read
 * must not take the others with it, and a write that fails must say so once
 * rather than silently or endlessly.
 */
import {
  HIGHLIGHTS,
  NOTES,
  SETTINGS,
  del,
  get,
  put,
  readSafely,
  writeSafely,
} from './db';

export interface Note {
  id: string;
  title: string;
  body: string;
  created: number;
  updated: number;
}

/** Colour-coded, so themes can be grouped visually. */
export const HIGHLIGHT_COLORS = ['amber', 'rose', 'sky', 'mint', 'violet'] as const;
export type HighlightColor = (typeof HIGHLIGHT_COLORS)[number];

/**
 * A highlight, anchored to the canonical address rather than a display name.
 *
 * `book_slug` is language-independent, so a highlight made while reading
 * `rv1909` still resolves after switching to `kjv`. Storing "Juan" would not.
 */
export interface Highlight {
  id: string;
  translation: string;
  book_slug: string;
  chapter: number;
  verse: number;
  color: HighlightColor;
  created: number;
}

export const highlightId = (h: Omit<Highlight, 'id' | 'color' | 'created'>) =>
  `${h.translation}:${h.book_slug}:${h.chapter}:${h.verse}`;

type Reporter = (store: string, error: unknown) => void;

/* ── Notes ──────────────────────────────────────────────────────────────── */

export const listNotes = (onFailure?: Reporter): Promise<Note[]> =>
  readSafely<Note[]>(NOTES, [], onFailure).then((notes) =>
    [...notes].sort((a, b) => b.updated - a.updated)
  );

export const saveNote = (note: Note, onFirstFailure?: Reporter): Promise<boolean> =>
  writeSafely(NOTES, note.id, note, onFirstFailure);

export const deleteNote = (id: string): Promise<unknown> => del(NOTES, id).catch(() => undefined);

export function newNote(title = 'Untitled'): Note {
  const now = Date.now();
  return { id: crypto.randomUUID(), title, body: '', created: now, updated: now };
}

/* ── Highlights ─────────────────────────────────────────────────────────── */

export const listHighlights = (onFailure?: Reporter): Promise<Highlight[]> =>
  readSafely<Highlight[]>(HIGHLIGHTS, [], onFailure);

export function toggleHighlight(
  anchor: Omit<Highlight, 'id' | 'color' | 'created'>,
  color: HighlightColor,
  existing: Highlight[],
  onFirstFailure?: Reporter
): Promise<Highlight[]> {
  const id = highlightId(anchor);
  const current = existing.find((h) => h.id === id);

  // Same colour again clears it; a different colour recolours in place.
  if (current && current.color === color) {
    return deleteHighlight(id).then(() => existing.filter((h) => h.id !== id));
  }

  const next: Highlight = { ...anchor, id, color, created: current?.created ?? Date.now() };
  return writeSafely(HIGHLIGHTS, id, next, onFirstFailure).then((ok) =>
    ok ? [...existing.filter((h) => h.id !== id), next] : existing
  );
}

export const deleteHighlight = (id: string): Promise<unknown> =>
  del(HIGHLIGHTS, id).catch(() => undefined);

/* ── Export bookkeeping ─────────────────────────────────────────────────── */

const LAST_EXPORT = 'lastExport';
/** Long enough not to nag, short enough that a loss is not months of work. */
const STALE_AFTER_MS = 14 * 24 * 60 * 60 * 1000;

export const markExported = (): Promise<unknown> =>
  put(SETTINGS, LAST_EXPORT, Date.now()).catch(() => undefined);

export async function exportIsStale(hasNotes: boolean): Promise<boolean> {
  if (!hasNotes) return false;
  const last = await get<number>(SETTINGS, LAST_EXPORT).catch(() => undefined);
  return last === undefined || Date.now() - last > STALE_AFTER_MS;
}
