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
/** Which file each note was last written to, and in which folder (`NameRecord`). */
const FILE_NAMES = 'notesDirectoryFiles';

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
    // the write that follows is a full one. The record of file names needs no
    // clearing here: it carries its folder, and `recordedNames` refuses any other.
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
 * What a file name is once a disk has had its say.
 *
 * Windows and macOS keep "Psalm.md" and "psalm.md" as one file, and macOS also
 * one file for the two Unicode spellings of "é", so comparing the strings as
 * they are lets two notes overwrite each other there and nowhere else. Upper
 * then lower is the nearest JavaScript has to case folding: lower alone leaves
 * "ß" apart from "SS" and a Greek word's final "ς" apart from "σ". It treats a
 * few pairs as one that a given disk would keep apart, and the price of that is
 * a " (2)"; the price of the reverse is a lost note.
 */
export const fileKey = (name: string): string =>
  name.normalize('NFD').toUpperCase().toLowerCase().normalize('NFC');

/** Oldest first, by what never changes: not the list's order, and not `updated`. */
function byAge(a: Note, b: Note): number {
  // A note from before `created` was stored still needs a place, and NaN would
  // make the sort's order depend on the order it was handed.
  const age = (Number(a.created) || 0) - (Number(b.created) || 0);
  if (age) return age;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/**
 * Which note belongs in which file, as of this list.
 *
 * Always over the whole list, however few notes are about to be written: a
 * note's number depends on who else wants its name. In list order if it could
 * be, but the list is sorted by `updated` when it loads and a new note goes on
 * top, so counting down it moved " (2)" from one note to the other whenever
 * either was edited and the page reloaded. The oldest note of a name keeps it,
 * and no edit can change who that is.
 *
 * Two passes, so that a note titled "T (2)" holds that name against the second
 * of two notes titled "T". The dedupe once appended " (2)" without looking, and
 * those two shared a file: whichever was written last silently replaced the
 * other. A note nobody collides with has exactly the name it has always had.
 *
 * Returned in list order, the order the files are then written in.
 */
export function mirrorFiles(notes: Note[], words: CardWords = enUS.cards): Map<string, MirrorFile> {
  // An untitled note is named by its id here, not by the word "Untitled": the
  // folder outlives a change of language, and a new name would leave a second
  // copy of the same note behind.
  const baseOf = (note: Note) => safeFilename(note.title, note.id);
  const taken = new Set<string>();
  const names = new Map<Note, string>();
  const unnamed: Note[] = [];
  for (const note of [...notes].sort(byAge)) {
    const name = `${baseOf(note)}.md`;
    if (taken.has(fileKey(name))) {
      unnamed.push(note);
    } else {
      taken.add(fileKey(name));
      names.set(note, name);
    }
  }
  // Where each name's count got to, because this runs on every autosave and
  // starting again from 2 is quadratic in notes sharing a title.
  const counts = new Map<string, number>();
  for (const note of unnamed) {
    const base = baseOf(note);
    let n = counts.get(fileKey(base)) ?? 2;
    while (taken.has(fileKey(`${base} (${n}).md`))) n++;
    counts.set(fileKey(base), n + 1);
    taken.add(fileKey(`${base} (${n}).md`));
    names.set(note, `${base} (${n}).md`);
  }
  const files = new Map<string, MirrorFile>();
  for (const note of notes) {
    const name = names.get(note)!;
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
 * `inFolder` is keyed by `fileKey`, because on a disk that folds names a file
 * written as "t.md" replaces the one recorded as "T.md".
 *
 * This one comparison is what brings the rest back without any caller asking:
 * - A failed write records nothing, nor does a lapsed permission, so the note
 *   still differs at the next autosave and is written then.
 * - A rename, a deletion or an older note can move other notes along "Title (2)",
 *   so those notes differ from what their new file holds and follow.
 * - A change of language differs only for untitled notes, the only text it
 *   alters, so those are all it rewrites. The rest would be identical bytes.
 * - A file left behind by a deletion is never in this list, so it stays on disk.
 */
export function filesToWrite(files: Map<string, MirrorFile>, inFolder: Map<string, MirrorFile>): MirrorFile[] {
  return [...files.values()].filter((file) => {
    const had = inFolder.get(fileKey(file.name));
    return had?.note !== file.note || had.heading !== file.heading || had.name !== file.name;
  });
}

/**
 * The record of file names, as stored: note id to the file last written for it,
 * beside the folder that was written to. A map of what the app itself wrote,
 * and the only thing that may ever name a file to remove.
 *
 * It carries the handle rather than being cleared when a folder is chosen, because
 * a mirror still running then would save the old folder's names after the
 * clearing, and the new folder would lose files of the same name.
 */
interface NameRecord {
  folder: FileSystemDirectoryHandle;
  files: Record<string, string>;
}

/**
 * What was recorded for this folder. Anything else is an empty record: one that
 * is missing, malformed or another folder's, and an empty record removes nothing.
 * The price of being wrong that way is a stray file, and of the reverse a lost one.
 */
export async function recordedNames(
  stored: unknown,
  folder: Pick<FileSystemDirectoryHandle, 'isSameEntry'>
): Promise<Map<string, string>> {
  try {
    const record = stored as NameRecord;
    if (!(await folder.isSameEntry(record.folder))) return new Map();
    const entries = Object.entries(record.files);
    const names = entries.map(([, name]) => name);
    const sound = names.every((name) => typeof name === 'string' && /^[^/\\]+\.md$/.test(name));
    // Written by this file, one note to a file. Two notes claiming one is not.
    return sound && new Set(names.map(fileKey)).size === names.length ? new Map(entries) : new Map();
  } catch {
    return new Map();
  }
}

/**
 * Write what changed, record each file once its write has really finished, then
 * remove what a rename left behind. Returns the files written, which is not the
 * number of notes. `names` is the record of file names, brought up to date here.
 *
 * Slow typing in a title is one autosave per pause, and each used to leave a file
 * behind ("Ps.md", "Psal.md", "Psalm.md"). A note's old file goes when all of
 * this is true, and otherwise it stays, because a stray file costs nothing:
 * - This note's new file has been written. A failed write leaves the old one as
 *   the only copy, and the next autosave tries again.
 * - The name came from `names`, so the app wrote it for this very note. Nothing
 *   here guesses a name or lists the folder, and the reader's own files are safe.
 * - No note now owns that name, compared as a disk would. After two notes swap
 *   titles each one's old file is the other's new one. And "t.md" replacing
 *   "T.md" is one file on Windows and macOS, so a rename by case alone removes
 *   nothing, or it would remove the note it had just written. On a disk that
 *   keeps them apart, the old spelling stays behind.
 *
 * A file edited outside the app is overwritten at the note's next save, as it
 * always was, so an edit going with a renamed file is no new risk.
 *
 * Removals come after every write, so a slow or failing one holds up no note.
 */
export async function writeMirror(
  folder: Pick<FileSystemDirectoryHandle, 'getFileHandle' | 'removeEntry'>,
  notes: Note[],
  inFolder: Map<string, MirrorFile>,
  names: Map<string, string>,
  words: CardWords = enUS.cards
): Promise<number> {
  const files = mirrorFiles(notes, words);

  // A deleted note's file stays, as a safety net the owner chose. Forgetting the
  // note without touching the disk means nothing can later take that file away
  // in its name.
  const living = new Set(notes.map((note) => note.id));
  for (const id of names.keys()) if (!living.has(id)) names.delete(id);
  const holders = new Map([...names].map(([id, name]) => [fileKey(name), id]));

  const replaced: string[] = [];
  let written = 0;
  for (const file of filesToWrite(files, inFolder)) {
    try {
      const handle = await folder.getFileHandle(file.name, { create: true });
      const stream = await handle.createWritable();
      await stream.write(toMarkdown(file.note, words));
      await stream.close();
    } catch {
      // One unwritable note must not abort the rest of the mirror. It is not
      // recorded, so the next autosave tries it again.
      continue;
    }
    const key = fileKey(file.name);
    inFolder.set(key, file);
    written++;

    // The file is this note's now. If another note last held it, that note no
    // longer has anything there to clean up.
    const holder = holders.get(key);
    if (holder !== undefined && holder !== file.note.id) names.delete(holder);
    holders.set(key, file.note.id);

    const old = names.get(file.note.id);
    names.set(file.note.id, file.name);
    if (old !== undefined && fileKey(old) !== key) {
      holders.delete(fileKey(old));
      replaced.push(old);
    }
  }

  const owned = new Set([...files.keys()].map(fileKey));
  for (const name of replaced) {
    if (owned.has(fileKey(name))) continue;
    // Forgotten whether or not the removal works: a note coming back to this
    // name must be written again, not trusted to be there still.
    inFolder.delete(fileKey(name));
    try {
      await folder.removeEntry(name);
    } catch {
      // Already gone, or held open by something else. Best-effort, like the
      // writes, and a file left here is only a stray.
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
 *
 * The record of file names is the opposite case, and is in IndexedDB: it changes
 * only when a name does, and without it a rename made after a reload would leave
 * the old file behind. It is read afresh by each mirror, so nothing here can
 * hold a copy of another folder's.
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
    if (!folder) return 0;
    const stored = await get<unknown>(SETTINGS, FILE_NAMES).catch(() => undefined);
    const names = await recordedNames(stored, folder);
    const before = JSON.stringify([...names]);
    const written = await writeMirror(folder, notes, record, names, words);
    // Written only when a name changed, so an ordinary autosave adds no put. A
    // failure costs a stray file at some later rename, and is not worth a word.
    if (JSON.stringify([...names]) !== before) {
      const next: NameRecord = { folder, files: Object.fromEntries(names) };
      await put(SETTINGS, FILE_NAMES, next).catch(() => undefined);
    }
    return written;
  });
  // A rejected turn must not stop the turns after it.
  mirrorQueue = turn.catch(() => 0);
  return turn;
}
