/**
 * Getting the user's work out — as plain files they own.
 *
 * Two independent paths, because they answer different fears:
 *  - **Export** is a one-off `.zip` of `.md` files. It works everywhere and is
 *    the answer to "can I leave".
 *  - **Mirror** writes notes into a real folder on disk via the File System
 *    Access API. It is the answer to "what if the browser evicts my data" —
 *    which `navigator.storage.persist()` only *requests*, never guarantees.
 *    Chromium-only, so it is offered where it exists and never assumed.
 */
import { get, put, SETTINGS } from './db';
import { markExported, type Note } from './notes';
import { boardToMarkdown, type Board, type BoardNode, type CardWords } from './canvas';
import { enUS } from '../i18n/messages/en-US';
import { inlineBoardEmbeds } from './markdown';
import { createZip, safeFilename } from './zip';

const DIR_HANDLE = 'notesDirectory';

/** Markdown, with the metadata a note needs to be worth something on its own. */
function toMarkdown(note: Note, words: CardWords, renderBoard?: (id: string) => string | null): string {
  const stamp = new Date(note.updated).toISOString();
  // An embedded board is a fence holding a UUID. In the app that draws a
  // diagram; in a file it is noise, so it is replaced with what it stood for.
  const body = renderBoard ? inlineBoardEmbeds(note.body, renderBoard) : note.body;
  return `# ${note.title || words.untitledNote}\n\n<!-- scriptura:note ${note.id} updated:${stamp} -->\n\n${body}\n`;
}

/**
 * Everything the reader has written, as files.
 *
 * Boards go in too. The whole reason the canvas exists is that people were
 * exporting passages into GoodNotes to lay them out; a board that could only be
 * read inside this app would recreate the problem it was built to solve.
 */
export function exportNotes(
  notes: Note[],
  boards: Board[] = [],
  describe?: (node: BoardNode) => string,
  renderBoard?: (id: string) => string | null,
  words: CardWords = enUS.cards
): Blob {
  const name = describe ?? ((node: BoardNode) => defaultDescribe(node, words));
  const seen = new Map<string, number>();
  const unique = (folder: string, title: string, id: string) => {
    const base = safeFilename(title, id);
    const n = (seen.get(`${folder}/${base}`) ?? 0) + 1;
    seen.set(`${folder}/${base}`, n);
    return `${folder}/${base}${n > 1 ? ` (${n})` : ''}.md`;
  };

  return createZip([
    ...notes.map((note) => ({
      // Two notes may share a title; a zip with duplicate paths is ambiguous.
      name: unique('notes', note.title || words.untitledNote, note.id),
      content: toMarkdown(note, words, renderBoard),
    })),
    ...boards.map((board) => ({
      name: unique('boards', board.name || words.untitledBoard, board.id),
      content: boardToMarkdown(board, name, words),
    })),
  ]);
}

/** A card, when the caller has no translation loaded to name it from. */
function defaultDescribe(node: BoardNode, words: CardWords): string {
  if (node.kind === 'verse') {
    const span =
      node.endVerse !== undefined && node.endVerse !== node.verse ? `${node.verse}-${node.endVerse}` : `${node.verse}`;
    return `${node.book_slug} ${node.chapter}:${span}`;
  }
  return node.text?.split('\n')[0] || words.card;
}

export async function downloadNotes(
  notes: Note[],
  boards: Board[] = [],
  describe?: (node: BoardNode) => string,
  renderBoard?: (id: string) => string | null,
  words?: CardWords
): Promise<void> {
  const blob = exportNotes(notes, boards, describe, renderBoard, words);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `scriptura-notes-${new Date().toISOString().slice(0, 10)}.zip`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  await markExported();
}

/* ── File System Access mirror (opt-in, Chromium-only) ──────────────────── */

export const fileSystemAccessSupported = (): boolean =>
  typeof (globalThis as { showDirectoryPicker?: unknown }).showDirectoryPicker === 'function';

type DirectoryHandle = FileSystemDirectoryHandle & {
  queryPermission?: (d: { mode: string }) => Promise<PermissionState>;
  requestPermission?: (d: { mode: string }) => Promise<PermissionState>;
};

/** Ask for a folder and remember it. Handles are structured-cloneable. */
export async function chooseNotesFolder(): Promise<boolean> {
  if (!fileSystemAccessSupported()) return false;
  const picker = (globalThis as unknown as {
    showDirectoryPicker: (o: { mode: string }) => Promise<DirectoryHandle>;
  }).showDirectoryPicker;
  try {
    const handle = await picker({ mode: 'readwrite' });
    await put(SETTINGS, DIR_HANDLE, handle);
    // Nothing is known about a folder just chosen, even the same one again, so
    // the write that follows is a full one.
    inFolder = new Map();
    return true;
  } catch {
    // The user dismissing the picker is not an error.
    return false;
  }
}

export const forgetNotesFolder = (): Promise<unknown> =>
  put(SETTINGS, DIR_HANDLE, undefined).catch(() => undefined);

/**
 * The stored folder, if we still hold permission.
 *
 * Permission does not survive indefinitely, and re-prompting requires a user
 * gesture — so a mirror that silently stops working is the expected failure.
 * Callers must treat `null` as "not mirroring" and say so.
 */
async function notesFolder(): Promise<DirectoryHandle | null> {
  const handle = await get<DirectoryHandle>(SETTINGS, DIR_HANDLE).catch(() => undefined);
  if (!handle) return null;
  const state = (await handle.queryPermission?.({ mode: 'readwrite' })) ?? 'granted';
  return state === 'granted' ? handle : null;
}

export const mirroring = (): Promise<boolean> => notesFolder().then((h) => h !== null);

/** One note's place in the folder: the file it belongs in, and what fills it. */
export interface MirrorFile {
  name: string;
  note: Note;
  /** Read apart from the note because it alone follows the interface language. */
  heading: string;
}

/**
 * Which note belongs in which file, as of this list.
 *
 * Always over the whole list, however few notes are about to be written:
 * "Title (2).md" means "the second note with this title in list order", so one
 * note's file can only be known by walking the notes before it. Keyed by file
 * because a note titled "Title (2)" can land on another note's "Title (2).md";
 * the later one then holds the file, as it did when every note was rewritten.
 */
export function mirrorFiles(notes: Note[], words: CardWords = enUS.cards): Map<string, MirrorFile> {
  const files = new Map<string, MirrorFile>();
  const seen = new Map<string, number>();
  for (const note of notes) {
    // An untitled note is named by its id here, not by the word "Untitled":
    // the folder outlives a change of language, and a new name would leave a
    // second copy of the same note behind.
    const base = safeFilename(note.title, note.id);
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    const name = `${base}${n > 1 ? ` (${n})` : ''}.md`;
    files.set(name, { name, note, heading: note.title || words.untitledNote });
  }
  return files;
}

/**
 * The files whose text differs from what this page last put there.
 *
 * Compared by note object, without rendering anything: a note is replaced, never
 * changed in place, whenever it is edited (React state), so the same object
 * means the same text and this costs a pointer check per note on every autosave.
 *
 * This one comparison is what brings the rest back without any caller asking:
 * - A failed write records nothing, nor does a lapsed permission, so the note
 *   still differs at the next autosave and is written then.
 * - A rename, a deletion or a new note can move other notes along "Title (2)",
 *   so those notes differ from what their new file holds and follow.
 * - A change of language differs only for untitled notes, the only text it
 *   alters, so those are all it rewrites. The rest would be identical bytes.
 * - A file left behind by a rename or a deletion is never in this list, so it
 *   stays on disk. Nothing here has ever removed a file.
 */
export function filesToWrite(files: Map<string, MirrorFile>, inFolder: Map<string, MirrorFile>): MirrorFile[] {
  return [...files.values()].filter((file) => {
    const had = inFolder.get(file.name);
    return had?.note !== file.note || had.heading !== file.heading;
  });
}

/**
 * Write what changed, and record each file once its write has really finished.
 * Returns the files written, which is not the number of notes.
 */
export async function writeMirror(
  folder: Pick<FileSystemDirectoryHandle, 'getFileHandle'>,
  notes: Note[],
  inFolder: Map<string, MirrorFile>,
  words: CardWords = enUS.cards
): Promise<number> {
  let written = 0;
  for (const file of filesToWrite(mirrorFiles(notes, words), inFolder)) {
    try {
      const handle = await folder.getFileHandle(file.name, { create: true });
      const stream = await handle.createWritable();
      await stream.write(toMarkdown(file.note, words));
      await stream.close();
      inFolder.set(file.name, file);
      written++;
    } catch {
      // One unwritable note must not abort the rest of the mirror. It is not
      // recorded, so the next autosave tries it again.
    }
  }
  return written;
}

/**
 * What this page knows it put in the folder.
 *
 * In memory on purpose. Recording it in IndexedDB would add a write per autosave
 * to a fix that removes writes, and a record that outlived the page would claim
 * to know a folder another tab or an earlier failure has since left behind. So
 * the first autosave after a page load still writes every note, once. The price
 * is that a file deleted or edited on disk comes back only at that next load,
 * at the note's next edit, or when a folder is chosen.
 */
let inFolder = new Map<string, MirrorFile>();

/**
 * One mirror at a time. Nothing waits for `mirrorNotes`, so two autosaves can
 * overlap when the disk is slow: an older write closing last would leave old
 * text in a file recorded as holding the new, and no later autosave would look.
 */
let mirrorQueue: Promise<unknown> = Promise.resolve();

/**
 * Bring the chosen folder up to date with `notes`. Best-effort by design.
 *
 * Takes the whole list, and writes only what changed. It used to rewrite every
 * note on every autosave: 3 keystrokes in 1 of 100 notes were 1 IndexedDB put
 * (5 KB) and 100 files (508 KB), every 600 ms pause, on the reader's disk and
 * battery. That is now 1 file.
 *
 * Returns the files this call wrote: 0 when none had changed, or when there is
 * no folder or no permission. It does not say the folder is up to date.
 */
export function mirrorNotes(notes: Note[], words: CardWords = enUS.cards): Promise<number> {
  const turn = mirrorQueue.then(async () => {
    // Taken before the folder is read. A folder chosen in between replaces the
    // record, so this turn's writes cannot be credited to the new folder.
    const record = inFolder;
    const folder = await notesFolder();
    return folder ? writeMirror(folder, notes, record, words) : 0;
  });
  // A rejected turn must not stop the turns after it.
  mirrorQueue = turn.catch(() => 0);
  return turn;
}
