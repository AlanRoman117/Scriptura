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
import { createZip, safeFilename } from './zip';

const DIR_HANDLE = 'notesDirectory';

/** Markdown, with the metadata a note needs to be worth something on its own. */
function toMarkdown(note: Note): string {
  const stamp = new Date(note.updated).toISOString();
  return `# ${note.title}\n\n<!-- scriptura:note ${note.id} updated:${stamp} -->\n\n${note.body}\n`;
}

export function exportNotes(notes: Note[]): Blob {
  const seen = new Map<string, number>();
  return createZip(
    notes.map((note) => {
      // Two notes may share a title; a zip with duplicate paths is ambiguous.
      const base = safeFilename(note.title, note.id);
      const n = (seen.get(base) ?? 0) + 1;
      seen.set(base, n);
      return {
        name: `notes/${base}${n > 1 ? ` (${n})` : ''}.md`,
        content: toMarkdown(note),
      };
    })
  );
}

export async function downloadNotes(notes: Note[]): Promise<void> {
  const blob = exportNotes(notes);
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

/** Write every note into the chosen folder as `.md`. Best-effort by design. */
export async function mirrorNotes(notes: Note[]): Promise<number> {
  const folder = await notesFolder();
  if (!folder) return 0;

  let written = 0;
  const seen = new Map<string, number>();
  for (const note of notes) {
    const base = safeFilename(note.title, note.id);
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    try {
      const file = await folder.getFileHandle(`${base}${n > 1 ? ` (${n})` : ''}.md`, {
        create: true,
      });
      const stream = await file.createWritable();
      await stream.write(toMarkdown(note));
      await stream.close();
      written++;
    } catch {
      // One unwritable note must not abort the rest of the mirror.
    }
  }
  return written;
}
