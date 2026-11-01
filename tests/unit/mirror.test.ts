import { fileKey, filesToWrite, mirrorFiles, writeMirror, type MirrorFile } from '../../apps/reader/src/lib/export';
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

const note = (id: string, title: string, body = `body of ${id}`, created = 1): Note => ({
  id,
  title,
  body,
  created,
  updated: 1,
});

/** Which note holds which file, by id. */
const owners = (files: Map<string, MirrorFile>) => new Map([...files.values()].map((f) => [f.note.id, f.name]));

/** The next version of a note, as an edit makes one: a new object. */
const edited = (n: Note, body: string): Note => ({ ...n, body, updated: n.updated + 1 });

/**
 * `foldNames` is a disk like those of Windows and macOS: one file for names that
 * differ only by case or Unicode form. Folded here on its own terms, not with
 * `fileKey`, so that a mistake there cannot hide itself.
 */
function fakeFolder({ foldNames = false } = {}) {
  const on = (name: string) => (foldNames ? name.normalize('NFC').toLowerCase() : name);
  const files = {
    store: new Map<string, string>(),
    get(name: string) {
      return this.store.get(on(name));
    },
    set(name: string, text: string) {
      this.store.set(on(name), text);
    },
    get size() {
      return this.store.size;
    },
  };
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
  test('a name is counted over the whole list, and the files come in list order', () => {
    const names = [...mirrorFiles([note('a', 'Psalm'), note('b', 'John'), note('c', 'Psalm')]).keys()];
    expect(names).toEqual(['Psalm.md', 'John.md', 'Psalm (2).md']);
  });

  test('an untitled note is named by its id, in any language', () => {
    expect([...mirrorFiles([note('abc', '')], { ...enUS.cards, untitledNote: '無題' }).keys()]).toEqual(['abc.md']);
  });

  test('a note nobody collides with has the name it always had', () => {
    const notes = [note('a', 'John 3:16 / notes'), note('b', 'Psalm (2)'), note('c', 'Génesis 1'), note('d', '')];
    expect([...mirrorFiles(notes).keys()]).toEqual(['John 3-16 - notes.md', 'Psalm (2).md', 'Génesis 1.md', 'd.md']);
  });
});

/**
 * Two notes in one file is a note silently lost, and only the file system knows
 * it happened. So each of these counts the files as well as the names.
 */
describe('every note has a file of its own', () => {
  const allKept = async (notes: Note[], foldNames = false) => {
    const folder = fakeFolder({ foldNames });
    await writeMirror(folder.handle, notes, new Map());
    expect(folder.files.size).toBe(notes.length);
    return folder;
  };

  test('"T", "T" and "T (2)", the three that used to share two files', async () => {
    const [a, b, c] = [note('a', 'T'), note('b', 'T'), note('c', 'T (2)')];
    expect(owners(mirrorFiles([a, b, c]))).toEqual(
      new Map([
        ['a', 'T.md'],
        ['b', 'T (3).md'],
        ['c', 'T (2).md'],
      ])
    );
    const folder = await allKept([a, b, c]);
    expect(folder.files.get('T.md')).toContain('body of a');
    expect(folder.files.get('T (3).md')).toContain('body of b');
    expect(folder.files.get('T (2).md')).toContain('body of c');
  });

  test('"T (2)" holds its name whichever order the list has, and however old it is', () => {
    const [young, a, b] = [note('c', 'T (2)', 'x', 9), note('a', 'T', 'x', 1), note('b', 'T', 'x', 2)];
    const old = { ...young, created: 0 };
    for (const list of [[young, a, b], [a, b, young], [old, a, b]]) {
      expect(owners(mirrorFiles(list)).get('c')).toBe('T (2).md');
      expect(new Set(mirrorFiles(list).keys()).size).toBe(3);
    }
  });

  test('titles that differ only by case are two files, each spelled as it was written', async () => {
    const notes = [note('a', 'Psalm'), note('b', 'PSALM'), note('c', 'psalm')];
    expect(owners(mirrorFiles(notes))).toEqual(
      new Map([
        ['a', 'Psalm.md'],
        ['b', 'PSALM (2).md'],
        ['c', 'psalm (3).md'],
      ])
    );
    const folder = await allKept(notes, true);
    expect(folder.files.get('Psalm.md')).toContain('body of a');
  });

  test('a numbered name is checked against other titles by case too', async () => {
    await allKept([note('a', 'T'), note('b', 'T'), note('c', 't (2)')], true);
  });

  test('case and Unicode form together are one name on a disk that folds them', async () => {
    const nfc = 'caf\u00e9';
    const nfd = 'CAFE\u0301';
    expect(nfc).not.toBe(nfd.toLowerCase());
    const folder = await allKept([note('a', nfc), note('b', nfd)], true);
    expect(folder.files.get(`${nfc}.md`)).toContain('body of a');
  });

  test('NFC against NFD in the title itself, and in a name that came from an id', () => {
    const [nfc, nfd] = ['caf\u00e9', 'cafe\u0301'];
    expect(mirrorFiles([note('a', nfc), note('b', nfd)]).size).toBe(2);
    // An untitled note's id goes in unnormalised, so only the comparison can see it.
    const files = mirrorFiles([note('a', nfc), note(nfd, '')]);
    expect(new Set([...files.keys()].map((name) => name.normalize('NFC'))).size).toBe(2);
  });

  test('fileKey folds what the disks fold', () => {
    expect(fileKey('Psalm.md')).toBe(fileKey('pSALM.MD'));
    expect(fileKey('caf\u00e9.md')).toBe(fileKey('CAFE\u0301.md'));
    expect(fileKey('Stra\u00dfe.md')).toBe(fileKey('STRASSE.md'));
    expect(fileKey('\u0391\u03a3')).toBe(fileKey('\u03b1\u03c3'));
    expect(fileKey('\u0391\u03a3')).toBe(fileKey('\u03b1\u03c2'));
    expect(fileKey('Psalm.md')).not.toBe(fileKey('Psalms.md'));
  });
});

/**
 * A name must not move because of something that has nothing to do with it. The
 * list is sorted by `updated` on load (`listNotes`) and a new note goes on top,
 * so the list's order is the one thing here that cannot decide.
 */
describe('a name stays put', () => {
  const [a, b, c] = [note('a', 'T', 'x', 1), note('b', 'T', 'x', 2), note('c', 'T', 'x', 3)];

  test('whatever order the list is in', () => {
    const before = owners(mirrorFiles([a, b, c]));
    expect(before.get('a')).toBe('T.md');
    expect(owners(mirrorFiles([c, b, a]))).toEqual(before);
    expect(owners(mirrorFiles([b, c, a]))).toEqual(before);
  });

  test('when another note is edited and the list sorts it to the top', async () => {
    const list = [a, b, c];
    const folder = await mirrored(list);
    const before = owners(mirrorFiles(list));

    const newest = edited(c, 'typed in the youngest');
    const sorted = [newest, a, b];

    expect(owners(mirrorFiles(sorted))).toEqual(before);
    await writeMirror(folder.handle, sorted, folder.known);
    expect(folder.writes).toEqual([before.get('c')]);
    expect(folder.files.get('T.md')).toContain('x');
    expect(folder.files.get('T.md')).not.toContain('typed in the youngest');
  });

  test('when a new note with the same title goes on top', async () => {
    const list = [a, b];
    const folder = await mirrored(list);
    const fresh = note('z', 'T', 'new', 9);

    await writeMirror(folder.handle, [fresh, a, b], folder.known);

    expect(folder.writes).toEqual(['T (3).md']);
    expect(folder.files.get('T (3).md')).toContain('new');
  });

  test('when only one of the notes in a collision is in the batch', async () => {
    const [x, y, z] = [note('x', 'T'), note('y', 'T'), note('z', 'T (2)')];
    const folder = await mirrored([x, y, z]);
    const named = owners(mirrorFiles([x, y, z]));

    // What the autosave saved is one note. The name comes from the whole list.
    await writeMirror(folder.handle, [x, edited(y, 'in the batch'), z], folder.known);

    expect(folder.writes).toEqual([named.get('y')]);
    expect(folder.files.get(named.get('y')!)).toContain('in the batch');
    expect(folder.files.get(named.get('z')!)).toContain('body of z');
  });

  test('two notes of one age are ordered by id, not by the locale', () => {
    const list = [note('b', 'T'), note('Z', 'T'), note('a', 'T')];
    expect(owners(mirrorFiles(list)).get('Z')).toBe('T.md');
  });

  test('a note without a stored age still gets one answer', () => {
    const undated = { ...note('b', 'T'), created: undefined as unknown as number };
    const dated = note('a', 'T', 'x', 5);
    expect(owners(mirrorFiles([undated, dated]))).toEqual(owners(mirrorFiles([dated, undated])));
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

  test('a note older than the holder of a name takes it, and the holder moves along', async () => {
    const a = note('a', 'Psalm', 'body of a', 2);
    const folder = await mirrored([a]);

    await writeMirror(folder.handle, [note('z', 'Psalm', 'body of z', 1), a], folder.known);

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
