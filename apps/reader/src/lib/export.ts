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
import { get, NOTES, put, SETTINGS } from './db';
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
  // The very names the folder mirror gives, from the one function, so a note is
  // the same file in both and the two cannot drift apart again. The zip had a
  // dedupe of its own that appended " (2)" without looking and compared names
  // as strings: "T", "T" and "T (2)" went in as two entries with one path, and
  // "Psalm" beside "psalm" unzipped to one file on Windows and macOS. Boards
  // have no folder, so an untitled one keeps the word for it.
  const boardNames = uniqueNames(boards, (board) => safeFilename(board.name || words.untitledBoard, board.id));

  return createZip([
    ...[...mirrorFiles(notes, words).values()].map((file) => ({
      name: `notes/${file.name}`,
      content: toMarkdown(file.note, words, renderBoard),
    })),
    ...boards.map((board) => ({
      name: `boards/${boardNames.get(board)!}`,
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

/** What a file is named after: a note or a board, by what never changes about it. */
interface Named {
  id: string;
  created: number;
}

/** Oldest first, by what never changes: not the list's order, and not `updated`. */
function byAge(a: Named, b: Named): number {
  // A note from before `created` was stored still needs a place, and NaN would
  // make the sort's order depend on the order it was handed.
  const age = (Number(a.created) || 0) - (Number(b.created) || 0);
  if (age) return age;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/**
 * A `.md` file name of its own for each of `items`, from the base name `baseOf`
 * gives it. The one naming for the folder and the zip, so a note is the same
 * file in both.
 *
 * Always over the whole list, however few are about to be written: an item's
 * number depends on who else wants its name. In list order if it could be, but
 * the list is sorted by `updated` when it loads and a new note goes on top, so
 * counting down it moved " (2)" from one note to the other whenever either was
 * edited and the page reloaded. The oldest of a name keeps it, and no edit can
 * change who that is.
 *
 * Two passes, so that a note titled "T (2)" holds that name against the second
 * of two notes titled "T". The dedupe once appended " (2)" without looking, and
 * those two shared a file: whichever was written last silently replaced the
 * other. An item nobody collides with has exactly the name it has always had.
 */
export function uniqueNames<T extends Named>(items: T[], baseOf: (item: T) => string): Map<T, string> {
  const taken = new Set<string>();
  const names = new Map<T, string>();
  const unnamed: T[] = [];
  for (const item of [...items].sort(byAge)) {
    const name = `${baseOf(item)}.md`;
    if (taken.has(fileKey(name))) {
      unnamed.push(item);
    } else {
      taken.add(fileKey(name));
      names.set(item, name);
    }
  }
  // Where each name's count got to, because this runs on every autosave and
  // starting again from 2 is quadratic in notes sharing a title.
  const counts = new Map<string, number>();
  for (const item of unnamed) {
    const base = baseOf(item);
    let n = counts.get(fileKey(base)) ?? 2;
    while (taken.has(fileKey(`${base} (${n}).md`))) n++;
    counts.set(fileKey(base), n + 1);
    taken.add(fileKey(`${base} (${n}).md`));
    names.set(item, `${base} (${n}).md`);
  }
  return names;
}

/**
 * Which note belongs in which file, as of this list (`uniqueNames`).
 *
 * Returned in list order, the order the files are then written in.
 */
export function mirrorFiles(notes: Note[], words: CardWords = enUS.cards): Map<string, MirrorFile> {
  // An untitled note is named by its id here, not by the word "Untitled": the
  // folder outlives a change of language, and a new name would leave a second
  // copy of the same note behind.
  const names = uniqueNames(notes, (note) => safeFilename(note.title, note.id));
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
 * The file last written for a note, and whether the app made it.
 *
 * `made` is false for a file that was already in the folder when the app first
 * wrote to it under this name: the reader's own, a deleted note's leftover, or
 * a file from before the record kept this. Overwriting such a file is as it
 * always was; removing it is new, and never done. The flag is asked of the
 * folder once, at the first write of a name (`writeMirror`), and carried along
 * when another note takes the file over.
 */
export interface FileRecord {
  name: string;
  made: boolean;
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
  files: Record<string, FileRecord>;
}

/**
 * What was recorded for this folder. Anything else is an empty record: one that
 * is missing, malformed or another folder's, and an empty record removes nothing.
 * The price of being wrong that way is a stray file, and of the reverse a lost one.
 *
 * The shape before `made` (a bare name per note) is malformed here on purpose:
 * it cannot say whether those files were there before the app, so the first
 * full write records them afresh, as found, and the first rename of each leaves
 * its old file behind, once.
 */
export async function recordedNames(
  stored: unknown,
  folder: Pick<FileSystemDirectoryHandle, 'isSameEntry'>
): Promise<Map<string, FileRecord>> {
  try {
    const record = stored as NameRecord;
    if (!(await folder.isSameEntry(record.folder))) return new Map();
    const entries = Object.entries(record.files);
    const sound = entries.every(
      ([, file]) => typeof file.name === 'string' && /^[^/\\]+\.md$/.test(file.name) && typeof file.made === 'boolean'
    );
    // Written by this file, one note to a file. Two notes claiming one is not.
    if (!sound || new Set(entries.map(([, file]) => fileKey(file.name))).size !== entries.length) return new Map();
    return new Map(entries.map(([id, file]) => [id, { name: file.name, made: file.made }]));
  } catch {
    return new Map();
  }
}

/**
 * Whether nothing in the folder answers to `name` yet. Asked before the first
 * write of a name, and only then, because a lookup per file per autosave is what
 * the mirror was just relieved of. Anything but a plain "not found" is taken as
 * "something is there": a folder that cannot be asked is a folder in doubt.
 */
async function absent(folder: Pick<FileSystemDirectoryHandle, 'getFileHandle'>, name: string): Promise<boolean> {
  try {
    await folder.getFileHandle(name);
    return false;
  } catch (error) {
    return (error as { name?: unknown } | null)?.name === 'NotFoundError';
  }
}

/** The note as the store has it now, or nothing when the store no longer has it. */
export type StoredNote = (id: string) => Promise<Pick<Note, 'updated'> | undefined>;

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
 * - The app made that file: nothing answered to the name when the app first
 *   wrote it (`absent`, `FileRecord.made`). A file that was already there, the
 *   reader's own or a deleted note's leftover, is overwritten as it always was
 *   and never removed, however many notes have since been written to it.
 * - No other note now owns that name, compared as a disk would. After two notes
 *   swap titles each one's old file is the other's new one.
 * - It is a different file from the one just written. "t.md" and "T.md" are
 *   one file on Windows and macOS and two on Linux, and the app cannot ask which;
 *   but on a disk that folds them the old file answers to the new spelling before
 *   it is written, so the old spelling goes only when the new one was `absent`.
 *   When it was not, the old spelling stays, and the new is recorded as not made:
 *   the price is a stray after a later rename, and the alternative was a note.
 * - The store's copy of the note is no newer than this list's (`latest`). Two
 *   tabs share the folder and the record, not their lists, and a tab behind on a
 *   note would otherwise remove the file the other tab had just written it to.
 *   A note the store no longer has, or a store that cannot be read, is doubt.
 *
 * A file edited outside the app is overwritten at the note's next save, as it
 * always was, so an edit going with a renamed file is no new risk.
 *
 * Removals come after every write, so a slow or failing one holds up no note.
 * Without `latest`, the list is taken as the store's: one tab, as the unit tests
 * are. `mirrorNotes` always asks.
 */
export async function writeMirror(
  folder: Pick<FileSystemDirectoryHandle, 'getFileHandle' | 'removeEntry'>,
  notes: Note[],
  inFolder: Map<string, MirrorFile>,
  names: Map<string, FileRecord>,
  words: CardWords = enUS.cards,
  latest: StoredNote = async (id) => notes.find((note) => note.id === id)
): Promise<number> {
  const files = mirrorFiles(notes, words);

  // A deleted note's file stays, as a safety net the owner chose. Forgetting the
  // note without touching the disk means nothing can later take that file away
  // in its name.
  const living = new Set(notes.map((note) => note.id));
  for (const id of names.keys()) if (!living.has(id)) names.delete(id);
  const holders = new Map([...names].map(([id, file]) => [fileKey(file.name), id]));

  // Files a note has moved off this turn, by key. One a note is written to
  // later in the same turn is still the file the app knows, however the record
  // reads by then: renaming the first of three "Psalm" notes hands "Psalm.md"
  // to the second, and asking the folder would find it there and call it the reader's.
  const left = new Map<string, FileRecord>();
  const replaced: { name: string; note: Note }[] = [];
  let written = 0;
  for (const file of filesToWrite(files, inFolder)) {
    const key = fileKey(file.name);
    // Whose the file is, settled before the write changes the answer. A name the
    // record holds under this very spelling is a file the app knows; any other,
    // including this note's own name in another case, is asked of the folder.
    const holder = holders.get(key);
    const known = holder === undefined ? left.get(key) : names.get(holder);
    const made = known?.name === file.name ? known.made : await absent(folder, file.name);
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
    inFolder.set(key, file);
    written++;

    // The file is this note's now. If another note last held it, that note no
    // longer has anything there to clean up.
    if (holder !== undefined && holder !== file.note.id) names.delete(holder);
    holders.set(key, file.note.id);

    const old = names.get(file.note.id);
    names.set(file.note.id, { name: file.name, made });
    if (old === undefined || old.name === file.name) continue;
    const apart = fileKey(old.name) !== key;
    if (apart) {
      holders.delete(fileKey(old.name));
      left.set(fileKey(old.name), old);
    }
    if (old.made && (apart || made)) replaced.push({ name: old.name, note: file.note });
  }

  const owners = new Map([...files.values()].map((file) => [fileKey(file.name), file.note.id]));
  for (const { name, note } of replaced) {
    const owner = owners.get(fileKey(name));
    if (owner !== undefined && owner !== note.id) continue;
    try {
      const stored = await latest(note.id);
      if (stored === undefined || stored.updated > note.updated) continue;
    } catch {
      continue;
    }
    // Forgotten whether or not the removal works: a note coming back to this
    // name must be written again, not trusted to be there still. After a rename
    // by case alone this forgets the new spelling too, and one autosave writes
    // it again: cheap insurance against a disk that folds names it said it kept.
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
    // Asked of the store, not of this list: another tab may have moved a note
    // on since this one loaded it, and its file must not go for that.
    const written = await writeMirror(folder, notes, record, names, words, (id) => get<Note>(NOTES, id));
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
