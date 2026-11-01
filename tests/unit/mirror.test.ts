import { filesToWrite, mirrorFiles, writeMirror, type MirrorFile } from '../../apps/reader/src/lib/export';
import { enUS } from '../../apps/reader/src/i18n/messages/en-US';
import type { Note } from '../../apps/reader/src/lib/notes';

/**
 * "Save to a folder" writes what changed, into the file it always went to.
 *
 * It rewrote every note on every autosave: 3 keystrokes in 1 of 100 notes were
 * 100 files. These count writes against a fake folder, because the failures
 * that matter are all about which file got touched and which was left alone.
 * tests/reader/mirror.spec.ts drives the same thing through the app.
 */

const note = (id: string, title: string, body = `body of ${id}`): Note => ({
  id,
  title,
  body,
  created: 1,
  updated: 1,
});

/** The next version of a note, as an edit makes one: a new object. */
const edited = (n: Note, body: string): Note => ({ ...n, body, updated: n.updated + 1 });

function fakeFolder() {
  const files = new Map<string, string>();
  const writes: string[] = [];
  const failOpen = new Set<string>();
  const failClose = new Set<string>();
  const handle = {
    getFileHandle: async (name: string) => ({
      createWritable: async () => {
        if (failOpen.has(name)) throw new Error('unwritable');
        let text = '';
        return {
          write: async (chunk: string) => {
            text = chunk;
          },
          close: async () => {
            // A real stream reaches the file only when it closes.
            if (failClose.has(name)) throw new Error('disk full');
            files.set(name, text);
            writes.push(name);
          },
        };
      },
    }),
  } as unknown as FileSystemDirectoryHandle;
  return { handle, files, writes, failOpen, failClose };
}

/** A folder that has already had `notes` written into it. */
async function mirrored(notes: Note[]) {
  const folder = fakeFolder();
  const known = new Map<string, MirrorFile>();
  await writeMirror(folder.handle, notes, known);
  folder.writes.length = 0;
  return { ...folder, known };
}

describe('naming', () => {
  test('counts over the whole list, in list order', () => {
    const names = [...mirrorFiles([note('a', 'Psalm'), note('b', 'John'), note('c', 'Psalm')]).keys()];
    expect(names).toEqual(['Psalm.md', 'John.md', 'Psalm (2).md']);
  });

  test('an untitled note is named by its id, in any language', () => {
    expect([...mirrorFiles([note('abc', '')], { ...enUS.cards, untitledNote: '無題' }).keys()]).toEqual(['abc.md']);
  });

  test('a title that lands on another note’s numbered name leaves one file, the later note’s', () => {
    const third = note('c', 'Psalm (2)');
    const files = mirrorFiles([note('a', 'Psalm'), note('b', 'Psalm'), third]);
    expect([...files.keys()]).toEqual(['Psalm.md', 'Psalm (2).md']);
    expect(files.get('Psalm (2).md')?.note).toBe(third);
  });
});

describe('what an autosave writes', () => {
  test('a first write is every note', async () => {
    const folder = fakeFolder();
    const notes = Array.from({ length: 100 }, (_, i) => note(`n${i}`, `Note ${i}`));
    expect(await writeMirror(folder.handle, notes, new Map())).toBe(100);
    expect(folder.writes).toHaveLength(100);
  });

  test('one edit among 100 notes is one file, the one it always went to', async () => {
    const notes = Array.from({ length: 100 }, (_, i) => note(`n${i}`, `Note ${i}`));
    const folder = await mirrored(notes);
    const next = notes.map((n) => (n.id === 'n57' ? edited(n, 'three more keys') : n));

    expect(await writeMirror(folder.handle, next, folder.known)).toBe(1);
    expect(folder.writes).toEqual(['Note 57.md']);
    expect(folder.files.get('Note 57.md')).toContain('three more keys');
  });

  test('nothing changed is nothing written, and says so', async () => {
    const notes = [note('a', 'A'), note('b', 'B')];
    const folder = await mirrored(notes);
    expect(await writeMirror(folder.handle, [...notes], folder.known)).toBe(0);
    expect(folder.writes).toEqual([]);
  });

  test('two notes with one title keep their files when only the second is edited', async () => {
    const [first, second] = [note('a', 'Psalm'), note('b', 'Psalm')];
    const folder = await mirrored([first, second]);

    await writeMirror(folder.handle, [first, edited(second, 'second note')], folder.known);

    expect(folder.writes).toEqual(['Psalm (2).md']);
    expect(folder.files.get('Psalm (2).md')).toContain('second note');
    expect(folder.files.get('Psalm.md')).toContain('body of a');
  });
});

/**
 * Each of these used to be repaired as a side effect of rewriting everything,
 * so each has to be repaired on purpose now, to the same result.
 */
describe('what a rewrite of everything used to bring along', () => {
  test('a rename writes the new file and leaves the old one on disk', async () => {
    const [a, b] = [note('a', 'Old'), note('b', 'Other')];
    const folder = await mirrored([a, b]);

    await writeMirror(folder.handle, [{ ...a, title: 'New', updated: 2 }, b], folder.known);

    expect(folder.writes).toEqual(['New.md']);
    expect(folder.files.get('Old.md')).toContain('body of a');
  });

  test('renaming the first of three moves the other two along, and leaves the last file', async () => {
    const [a, b, c] = [note('a', 'Psalm'), note('b', 'Psalm'), note('c', 'Psalm')];
    const folder = await mirrored([a, b, c]);

    await writeMirror(folder.handle, [{ ...a, title: 'New', updated: 2 }, b, c], folder.known);

    expect(folder.writes.sort()).toEqual(['New.md', 'Psalm (2).md', 'Psalm.md']);
    expect(folder.files.get('Psalm.md')).toContain('body of b');
    expect(folder.files.get('Psalm (2).md')).toContain('body of c');
    expect(folder.files.get('Psalm (3).md')).toContain('body of c');
  });

  test('deleting a note leaves its file; deleting one of a pair moves the other', async () => {
    const [a, b, c] = [note('a', 'Psalm'), note('b', 'Psalm'), note('c', 'Gone')];
    const folder = await mirrored([a, b, c]);

    await writeMirror(folder.handle, [b], folder.known);

    expect(folder.writes).toEqual(['Psalm.md']);
    expect(folder.files.get('Psalm.md')).toContain('body of b');
    expect(folder.files.get('Psalm (2).md')).toContain('body of b');
    expect(folder.files.get('Gone.md')).toContain('body of c');
  });

  test('a new note at the top with a title in use takes the first file', async () => {
    const a = note('a', 'Psalm');
    const folder = await mirrored([a]);

    await writeMirror(folder.handle, [note('z', 'Psalm'), a], folder.known);

    expect(folder.writes.sort()).toEqual(['Psalm (2).md', 'Psalm.md']);
    expect(folder.files.get('Psalm.md')).toContain('body of z');
    expect(folder.files.get('Psalm (2).md')).toContain('body of a');
  });

  test('a change of language rewrites untitled notes, the only text it alters', async () => {
    const notes = [note('a', ''), note('b', 'Titled')];
    const folder = await mirrored(notes);
    const words = { ...enUS.cards, untitledNote: '無題' };

    expect(await writeMirror(folder.handle, notes, folder.known, words)).toBe(1);
    expect(folder.writes).toEqual(['a.md']);
    expect(folder.files.get('a.md')).toContain('# 無題');
  });

  test('a note reloaded from a restore or an import is a new object, and is written', async () => {
    const notes = [note('a', 'A'), note('b', 'B')];
    const folder = await mirrored(notes);
    expect(await writeMirror(folder.handle, notes.map((n) => ({ ...n })), folder.known)).toBe(2);
  });

  test('a fresh record, as after choosing a folder or a page load, is a full write', async () => {
    const notes = [note('a', 'A'), note('b', 'B')];
    const folder = await mirrored(notes);
    expect(await writeMirror(folder.handle, notes, new Map())).toBe(2);
  });
});

describe('a write that fails', () => {
  test('does not stop the rest, is not counted, and is written at the next autosave', async () => {
    const [a, b, c] = [note('a', 'A'), note('b', 'B'), note('c', 'C')];
    const folder = await mirrored([a, b, c]);
    const next = [edited(a, 'a two'), edited(b, 'b two'), c];
    folder.failOpen.add('A.md');

    expect(await writeMirror(folder.handle, next, folder.known)).toBe(1);
    expect(folder.writes).toEqual(['B.md']);
    expect(folder.files.get('A.md')).toContain('body of a');

    folder.failOpen.clear();
    folder.writes.length = 0;
    expect(await writeMirror(folder.handle, next, folder.known)).toBe(1);
    expect(folder.writes).toEqual(['A.md']);
    expect(folder.files.get('A.md')).toContain('a two');
  });

  test('a stream that fails on closing counts as not written', async () => {
    const a = note('a', 'A');
    const folder = await mirrored([a]);
    const next = [edited(a, 'a two')];
    folder.failClose.add('A.md');

    expect(await writeMirror(folder.handle, next, folder.known)).toBe(0);

    folder.failClose.clear();
    expect(await writeMirror(folder.handle, next, folder.known)).toBe(1);
    expect(folder.files.get('A.md')).toContain('a two');
  });

  test('a note that moved file and failed still reaches the file it belongs in', async () => {
    const [a, b] = [note('a', 'Psalm'), note('b', 'Psalm')];
    const folder = await mirrored([a, b]);
    folder.failOpen.add('Psalm.md');

    await writeMirror(folder.handle, [b], folder.known);
    expect(folder.files.get('Psalm.md')).toContain('body of a');

    folder.failOpen.clear();
    await writeMirror(folder.handle, [b], folder.known);
    expect(folder.files.get('Psalm.md')).toContain('body of b');
  });
});

describe('filesToWrite', () => {
  test('an empty record wants everything; an up-to-date one wants nothing', () => {
    const files = mirrorFiles([note('a', 'A'), note('b', 'B')]);
    expect(filesToWrite(files, new Map()).map((f) => f.name)).toEqual(['A.md', 'B.md']);
    expect(filesToWrite(files, new Map(files))).toEqual([]);
  });
});
