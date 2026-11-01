import { fileKey, filesToWrite, mirrorFiles, recordedNames, writeMirror, type MirrorFile } from '../../apps/reader/src/lib/export';
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
  const removed: string[] = [];
  /** Writes and removals together, in the order they reached the folder. */
  const log: string[] = [];
  const failOpen = new Set<string>();
  const failClose = new Set<string>();
  const failRemove = new Set<string>();
  const handle: unknown = {
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
            log.push(`write ${name}`);
          },
        };
      },
    }),
    removeEntry: async (name: string) => {
      if (failRemove.has(name)) throw new Error('in use');
      // As the real thing does for a file that is not there.
      if (files.get(name) === undefined) throw new DOMException('missing', 'NotFoundError');
      files.store.delete(on(name));
      removed.push(name);
      log.push(`remove ${name}`);
    },
    isSameEntry: async (other: unknown) => other === handle,
  } as unknown as FileSystemDirectoryHandle;
  return { handle, files, writes, removed, log, failOpen, failClose, failRemove };
}

/** A folder that has already had `notes` written into it. */
async function mirrored(notes: Note[], options: { foldNames?: boolean } = {}) {
  const folder = fakeFolder(options);
  const known = new Map<string, MirrorFile>();
  const names = new Map<string, string>();
  await writeMirror(folder.handle, notes, known, names);
  folder.writes.length = 0;
  folder.log.length = 0;
  return { ...folder, known, names };
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
    await writeMirror(folder.handle, notes, new Map(), new Map());
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
    await writeMirror(folder.handle, sorted, folder.known, folder.names);
    expect(folder.writes).toEqual([before.get('c')]);
    expect(folder.files.get('T.md')).toContain('x');
    expect(folder.files.get('T.md')).not.toContain('typed in the youngest');
  });

  test('when a new note with the same title goes on top', async () => {
    const list = [a, b];
    const folder = await mirrored(list);
    const fresh = note('z', 'T', 'new', 9);

    await writeMirror(folder.handle, [fresh, a, b], folder.known, folder.names);

    expect(folder.writes).toEqual(['T (3).md']);
    expect(folder.files.get('T (3).md')).toContain('new');
  });

  test('when only one of the notes in a collision is in the batch', async () => {
    const [x, y, z] = [note('x', 'T'), note('y', 'T'), note('z', 'T (2)')];
    const folder = await mirrored([x, y, z]);
    const named = owners(mirrorFiles([x, y, z]));

    // What the autosave saved is one note. The name comes from the whole list.
    await writeMirror(folder.handle, [x, edited(y, 'in the batch'), z], folder.known, folder.names);

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
    expect(await writeMirror(folder.handle, notes, new Map(), new Map())).toBe(100);
    expect(folder.writes).toHaveLength(100);
  });

  test('one edit among 100 notes is one file, the one it always went to', async () => {
    const notes = Array.from({ length: 100 }, (_, i) => note(`n${i}`, `Note ${i}`));
    const folder = await mirrored(notes);
    const next = notes.map((n) => (n.id === 'n57' ? edited(n, 'three more keys') : n));

    expect(await writeMirror(folder.handle, next, folder.known, folder.names)).toBe(1);
    expect(folder.writes).toEqual(['Note 57.md']);
    expect(folder.files.get('Note 57.md')).toContain('three more keys');
  });

  test('nothing changed is nothing written, and says so', async () => {
    const notes = [note('a', 'A'), note('b', 'B')];
    const folder = await mirrored(notes);
    expect(await writeMirror(folder.handle, [...notes], folder.known, folder.names)).toBe(0);
    expect(folder.writes).toEqual([]);
  });

  test('two notes with one title keep their files when only the second is edited', async () => {
    const [first, second] = [note('a', 'Psalm'), note('b', 'Psalm')];
    const folder = await mirrored([first, second]);

    await writeMirror(folder.handle, [first, edited(second, 'second note')], folder.known, folder.names);

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
  test('renaming the first of three moves the other two along, and removes the file no one owns now', async () => {
    const [a, b, c] = [note('a', 'Psalm'), note('b', 'Psalm'), note('c', 'Psalm')];
    const folder = await mirrored([a, b, c]);

    await writeMirror(folder.handle, [{ ...a, title: 'New', updated: 2 }, b, c], folder.known, folder.names);

    expect(folder.writes.sort()).toEqual(['New.md', 'Psalm (2).md', 'Psalm.md']);
    expect(folder.files.get('Psalm.md')).toContain('body of b');
    expect(folder.files.get('Psalm (2).md')).toContain('body of c');
    expect(folder.removed).toEqual(['Psalm (3).md']);
  });

  test('deleting a note leaves its file; deleting one of a pair moves the other, and its old file goes', async () => {
    const [a, b, c] = [note('a', 'Psalm'), note('b', 'Psalm'), note('c', 'Gone')];
    const folder = await mirrored([a, b, c]);

    await writeMirror(folder.handle, [b], folder.known, folder.names);

    expect(folder.writes).toEqual(['Psalm.md']);
    expect(folder.files.get('Psalm.md')).toContain('body of b');
    expect(folder.removed).toEqual(['Psalm (2).md']);
    expect(folder.files.get('Gone.md')).toContain('body of c');
  });

  test('a note older than the holder of a name takes it, and the holder moves along', async () => {
    const a = note('a', 'Psalm', 'body of a', 2);
    const folder = await mirrored([a]);

    await writeMirror(folder.handle, [note('z', 'Psalm', 'body of z', 1), a], folder.known, folder.names);

    expect(folder.writes.sort()).toEqual(['Psalm (2).md', 'Psalm.md']);
    expect(folder.files.get('Psalm.md')).toContain('body of z');
    expect(folder.files.get('Psalm (2).md')).toContain('body of a');
  });

  test('a change of language rewrites untitled notes, the only text it alters', async () => {
    const notes = [note('a', ''), note('b', 'Titled')];
    const folder = await mirrored(notes);
    const words = { ...enUS.cards, untitledNote: '無題' };

    expect(await writeMirror(folder.handle, notes, folder.known, folder.names, words)).toBe(1);
    expect(folder.writes).toEqual(['a.md']);
    expect(folder.files.get('a.md')).toContain('# 無題');
  });

  test('a note reloaded from a restore or an import is a new object, and is written', async () => {
    const notes = [note('a', 'A'), note('b', 'B')];
    const folder = await mirrored(notes);
    expect(await writeMirror(folder.handle, notes.map((n) => ({ ...n })), folder.known, folder.names)).toBe(2);
  });

  test('a fresh record, as after choosing a folder or a page load, is a full write', async () => {
    const notes = [note('a', 'A'), note('b', 'B')];
    const folder = await mirrored(notes);
    expect(await writeMirror(folder.handle, notes, new Map(), new Map())).toBe(2);
  });
});

describe('a write that fails', () => {
  test('does not stop the rest, is not counted, and is written at the next autosave', async () => {
    const [a, b, c] = [note('a', 'A'), note('b', 'B'), note('c', 'C')];
    const folder = await mirrored([a, b, c]);
    const next = [edited(a, 'a two'), edited(b, 'b two'), c];
    folder.failOpen.add('A.md');

    expect(await writeMirror(folder.handle, next, folder.known, folder.names)).toBe(1);
    expect(folder.writes).toEqual(['B.md']);
    expect(folder.files.get('A.md')).toContain('body of a');

    folder.failOpen.clear();
    folder.writes.length = 0;
    expect(await writeMirror(folder.handle, next, folder.known, folder.names)).toBe(1);
    expect(folder.writes).toEqual(['A.md']);
    expect(folder.files.get('A.md')).toContain('a two');
  });

  test('a stream that fails on closing counts as not written', async () => {
    const a = note('a', 'A');
    const folder = await mirrored([a]);
    const next = [edited(a, 'a two')];
    folder.failClose.add('A.md');

    expect(await writeMirror(folder.handle, next, folder.known, folder.names)).toBe(0);

    folder.failClose.clear();
    expect(await writeMirror(folder.handle, next, folder.known, folder.names)).toBe(1);
    expect(folder.files.get('A.md')).toContain('a two');
  });

  test('a note that moved file and failed still reaches the file it belongs in', async () => {
    const [a, b] = [note('a', 'Psalm'), note('b', 'Psalm')];
    const folder = await mirrored([a, b]);
    folder.failOpen.add('Psalm.md');

    await writeMirror(folder.handle, [b], folder.known, folder.names);
    expect(folder.files.get('Psalm.md')).toContain('body of a');

    folder.failOpen.clear();
    await writeMirror(folder.handle, [b], folder.known, folder.names);
    expect(folder.files.get('Psalm.md')).toContain('body of b');
  });
});

const renamed = (n: Note, title: string): Note => ({ ...n, title, updated: n.updated + 1 });

/**
 * Each autosave while retitling a note used to leave a file behind. Everything
 * here is about what may go and, far more, what may not: this is the only code
 * in the app that deletes anything outside its own storage.
 */
describe('a rename removes the file it replaced', () => {
  test('the old file goes, and only once the new one has been written', async () => {
    const [a, b] = [note('a', 'Old'), note('b', 'Other')];
    const folder = await mirrored([a, b]);

    await writeMirror(folder.handle, [renamed(a, 'New'), b], folder.known, folder.names);

    expect(folder.log).toEqual(['write New.md', 'remove Old.md']);
    expect(folder.files.get('Old.md')).toBeUndefined();
    expect(folder.files.get('New.md')).toContain('body of a');
    expect(folder.files.get('Other.md')).toContain('body of b');
    expect(folder.names.get('a')).toBe('New.md');
  });

  test('two renames in a row leave one file', async () => {
    const a = note('a', 'Ps');
    const folder = await mirrored([a]);

    const mid = renamed(a, 'Psal');
    await writeMirror(folder.handle, [mid], folder.known, folder.names);
    await writeMirror(folder.handle, [renamed(mid, 'Psalm')], folder.known, folder.names);

    expect(folder.removed).toEqual(['Ps.md', 'Psal.md']);
    expect([...folder.files.store.keys()]).toEqual(['Psalm.md']);
  });

  test('an untitled note taking a title leaves no file named by its id', async () => {
    const a = note('abc', '');
    const folder = await mirrored([a]);
    await writeMirror(folder.handle, [renamed(a, 'Psalm')], folder.known, folder.names);
    expect([...folder.files.store.keys()]).toEqual(['Psalm.md']);
  });

  test('two notes swapping titles remove nothing, and each file holds the other now', async () => {
    const [a, b] = [note('a', 'First'), note('b', 'Second')];
    const folder = await mirrored([a, b]);

    await writeMirror(folder.handle, [renamed(a, 'Second'), renamed(b, 'First')], folder.known, folder.names);

    expect(folder.removed).toEqual([]);
    expect(folder.files.get('Second.md')).toContain('body of a');
    expect(folder.files.get('First.md')).toContain('body of b');
  });

  test('a rename into a name another note holds moves that note, and removes only what no one owns', async () => {
    const [a, b] = [note('a', 'T', 'body of a', 1), note('b', 'X', 'body of b', 2)];
    const folder = await mirrored([a, b]);

    // b joins a's name: b is younger, so it takes "T (2)" and X.md goes.
    const next = [a, renamed(b, 'T')];
    await writeMirror(folder.handle, next, folder.known, folder.names);
    expect(folder.removed).toEqual(['X.md']);

    // a leaves: b takes "T" over from it, and "T (2)" goes. "T.md" is b's now, so a must not take it.
    folder.removed.length = 0;
    await writeMirror(folder.handle, [renamed(a, 'New'), next[1]], folder.known, folder.names);
    expect(folder.removed).toEqual(['T (2).md']);
    expect(folder.files.get('T.md')).toContain('body of b');
    expect(folder.files.get('New.md')).toContain('body of a');
  });

  test('a name owned under another spelling is owned: the disk would remove the other note', async () => {
    const [a, b] = [note('a', 'T', 'body of a', 1), note('b', 't', 'body of b', 2)];
    const folder = await mirrored([a, b], { foldNames: true });
    expect(folder.files.get('T.md')).toContain('body of a');

    // a leaves "T.md", and b's "t.md" is the same file on this disk.
    await writeMirror(folder.handle, [renamed(a, 'New'), b], folder.known, folder.names);

    expect(folder.removed).toEqual(['t (2).md']);
    expect(folder.files.get('t.md')).toContain('body of b');
  });

  test('a rename by case alone keeps the file, on a disk where the two names are one', async () => {
    const a = note('a', 'psalm');
    const folder = await mirrored([a], { foldNames: true });

    await writeMirror(folder.handle, [{ ...renamed(a, 'Psalm'), body: 'recased' }], folder.known, folder.names);

    expect(folder.removed).toEqual([]);
    expect(folder.files.get('Psalm.md')).toContain('recased');
  });

  test('a note moved off a name and back is written again, since its file went', async () => {
    const [a, b] = [note('a', 'T', 'body of a', 1), note('b', 'T', 'body of b', 2)];
    const folder = await mirrored([a, b]);

    const away = renamed(a, 'Away');
    await writeMirror(folder.handle, [away, b], folder.known, folder.names);
    expect(folder.files.get('T (2).md')).toBeUndefined();

    await writeMirror(folder.handle, [renamed(away, 'T'), b], folder.known, folder.names);

    expect(folder.files.get('T.md')).toContain('body of a');
    expect(folder.files.get('T (2).md')).toContain('body of b');
  });
});

describe('what a rename must leave alone', () => {
  test('a file in the folder that the app did not write', async () => {
    const a = note('a', 'Old');
    const folder = await mirrored([a]);
    folder.files.set('Old copy.md', 'the reader’s');
    folder.files.set('shopping.txt', 'the reader’s');

    await writeMirror(folder.handle, [renamed(a, 'New')], folder.known, folder.names);

    expect(folder.removed).toEqual(['Old.md']);
    expect(folder.files.get('Old copy.md')).toBe('the reader’s');
    expect(folder.files.get('shopping.txt')).toBe('the reader’s');
  });

  test('the old file, when the write that would replace it fails on opening', async () => {
    const a = note('a', 'Old');
    const folder = await mirrored([a]);
    const next = [renamed(a, 'New')];
    folder.failOpen.add('New.md');

    expect(await writeMirror(folder.handle, next, folder.known, folder.names)).toBe(0);
    expect(folder.removed).toEqual([]);
    expect(folder.files.get('Old.md')).toContain('body of a');
    expect(folder.names.get('a')).toBe('Old.md');

    // And it goes once the write works, however much later.
    folder.failOpen.clear();
    await writeMirror(folder.handle, next, folder.known, folder.names);
    expect(folder.log).toEqual(['write New.md', 'remove Old.md']);
  });

  test('the old file, when the write fails on closing, where a real stream reaches the disk', async () => {
    const a = note('a', 'Old');
    const folder = await mirrored([a]);
    folder.failClose.add('New.md');

    await writeMirror(folder.handle, [renamed(a, 'New')], folder.known, folder.names);

    expect(folder.removed).toEqual([]);
    expect(folder.files.get('Old.md')).toContain('body of a');
  });

  test('a swap where one write fails: the note that failed keeps its text in nobody’s way', async () => {
    const [a, b] = [note('a', 'First'), note('b', 'Second')];
    const folder = await mirrored([a, b]);
    folder.failOpen.add('First.md');
    const next = [renamed(a, 'Second'), renamed(b, 'First')];

    await writeMirror(folder.handle, next, folder.known, folder.names);

    // a replaced b's file, so that file is no longer b's to remove later.
    expect(folder.removed).toEqual([]);
    expect(folder.names.has('b')).toBe(false);
    expect(folder.files.get('Second.md')).toContain('body of a');

    folder.failOpen.clear();
    await writeMirror(folder.handle, next, folder.known, folder.names);
    expect(folder.removed).toEqual([]);
    expect(folder.files.get('First.md')).toContain('body of b');
    expect(folder.files.get('Second.md')).toContain('body of a');
  });

  test('a deleted note’s file, and it forgets the note so nothing later can take that file', async () => {
    const [a, b] = [note('a', 'Keep me'), note('b', 'Other')];
    const folder = await mirrored([a, b]);

    await writeMirror(folder.handle, [b], folder.known, folder.names);

    expect(folder.removed).toEqual([]);
    expect(folder.files.get('Keep me.md')).toContain('body of a');
    expect(folder.names.has('a')).toBe(false);

    // A new note and its renames never reach the file the deleted note left.
    const fresh = note('z', 'Later');
    await writeMirror(folder.handle, [fresh, b], folder.known, folder.names);
    await writeMirror(folder.handle, [renamed(fresh, 'Later still'), b], folder.known, folder.names);
    expect(folder.removed).toEqual(['Later.md']);
    expect(folder.files.get('Keep me.md')).toContain('body of a');
  });

  test('a note deleted with nothing else written, and its id comes back knowing nothing', async () => {
    const a = note('a', 'Old');
    const folder = await mirrored([a]);

    await writeMirror(folder.handle, [], folder.known, folder.names);
    expect(folder.names.size).toBe(0);

    // The same id with a new title, as an import might bring it: no record, no removal.
    await writeMirror(folder.handle, [renamed(a, 'New')], folder.known, folder.names);
    expect(folder.removed).toEqual([]);
    expect(folder.files.get('Old.md')).toContain('body of a');
  });

  test('anything at all, with an empty record', async () => {
    const a = note('a', 'Old');
    const folder = await mirrored([a]);
    await writeMirror(folder.handle, [renamed(a, 'New')], folder.known, new Map());
    expect(folder.removed).toEqual([]);
    expect(folder.files.get('Old.md')).toContain('body of a');
  });
});

describe('a removal that fails', () => {
  test('stops nothing: every note is written and recorded', async () => {
    const [a, b, c] = [note('a', 'A'), note('b', 'B'), note('c', 'C')];
    const folder = await mirrored([a, b, c]);
    folder.failRemove.add('A.md');

    const next = [renamed(a, 'A2'), renamed(b, 'B2'), edited(c, 'c two')];
    await expect(writeMirror(folder.handle, next, folder.known, folder.names)).resolves.toBe(3);

    expect(folder.files.get('A2.md')).toContain('body of a');
    expect(folder.files.get('C.md')).toContain('c two');
    expect(folder.removed).toEqual(['B.md']);
    expect(folder.names.get('a')).toBe('A2.md');
  });

  test('a file already gone from the folder is no failure', async () => {
    const [a, b] = [note('a', 'A'), note('b', 'B')];
    const folder = await mirrored([a, b]);
    folder.files.store.delete('A.md');

    await expect(writeMirror(folder.handle, [renamed(a, 'A2'), b], folder.known, folder.names)).resolves.toBe(1);
    expect(folder.files.get('A2.md')).toContain('body of a');
  });

  test('a removal that never answers holds up no write: removals come last', async () => {
    const [a, b] = [note('a', 'A'), note('b', 'B')];
    const folder = await mirrored([a, b]);
    const stuck = { ...folder.handle, removeEntry: () => new Promise<void>(() => undefined) } as unknown as FileSystemDirectoryHandle;

    // Not awaited: it never finishes. The writes are all in by the time it hangs.
    void writeMirror(stuck, [renamed(a, 'A2'), renamed(b, 'B2')], folder.known, folder.names);
    await new Promise<void>((resolve) => setImmediate(resolve));

    expect(folder.files.get('A2.md')).toContain('body of a');
    expect(folder.files.get('B2.md')).toContain('body of b');
  });
});

/** The record survives a reload, so what is stored decides what can ever be removed. */
describe('the stored record', () => {
  const stored = (folder: unknown, files: unknown) => ({ folder, files });

  test('is read back for the folder it was written for', async () => {
    const folder = fakeFolder();
    const names = await recordedNames(stored(folder.handle, { a: 'Old.md' }), folder.handle);
    expect(names).toEqual(new Map([['a', 'Old.md']]));
  });

  test('read back, it removes the old file as if the page had never reloaded', async () => {
    const a = note('a', 'Old');
    const folder = await mirrored([a]);
    const names = await recordedNames(stored(folder.handle, Object.fromEntries(folder.names)), folder.handle);

    // A new page: nothing in memory, so a full write, then the rename's removal.
    await writeMirror(folder.handle, [renamed(a, 'New')], new Map(), names);
    expect(folder.removed).toEqual(['Old.md']);
  });

  test('is empty for any other folder, so a rename there removes nothing', async () => {
    const [one, other] = [fakeFolder(), fakeFolder()];
    const a = note('a', 'Old');
    other.files.set('Old.md', 'the reader’s, in another folder');

    const names = await recordedNames(stored(one.handle, { a: 'Old.md' }), other.handle);
    expect(names.size).toBe(0);

    await writeMirror(other.handle, [renamed(a, 'New')], new Map(), names);
    expect(other.removed).toEqual([]);
    expect(other.files.get('Old.md')).toBe('the reader’s, in another folder');
  });

  test('is empty when the folder cannot be compared', async () => {
    const folder = fakeFolder();
    const refusing = { isSameEntry: () => Promise.reject(new Error('gone')) };
    expect((await recordedNames(stored(folder.handle, { a: 'Old.md' }), refusing)).size).toBe(0);
  });

  test.each<[string, (handle: unknown) => unknown]>([
    ['nothing', () => undefined],
    ['null', () => null],
    ['a string', () => 'Old.md'],
    ['an old shape with no folder', () => ({ a: 'Old.md' })],
    ['no files', (handle) => ({ folder: handle })],
    ['files that are null', (handle) => stored(handle, null)],
    ['a name that is not text', (handle) => stored(handle, { a: 7 })],
    ['a name with no extension', (handle) => stored(handle, { a: 'Old' })],
    ['a name that climbs out of the folder', (handle) => stored(handle, { a: '../Old.md' })],
    ['a name in a subfolder', (handle) => stored(handle, { a: 'sub\\Old.md' })],
    ['two notes claiming one file', (handle) => stored(handle, { a: 'Old.md', b: 'old.MD' })],
  ])('malformed as %s removes nothing', async (_what, make) => {
    const a = note('a', 'Old');
    const folder = await mirrored([a]);

    const names = await recordedNames(make(folder.handle), folder.handle);
    expect(names.size).toBe(0);

    await writeMirror(folder.handle, [renamed(a, 'New')], folder.known, names);
    expect(folder.removed).toEqual([]);
    expect(folder.files.get('Old.md')).toContain('body of a');
  });
});

describe('filesToWrite', () => {
  test('an empty record wants everything; an up-to-date one wants nothing', () => {
    const files = mirrorFiles([note('a', 'A'), note('b', 'B')]);
    expect(filesToWrite(files, new Map()).map((f) => f.name)).toEqual(['A.md', 'B.md']);
    expect(filesToWrite(files, new Map([...files.values()].map((f) => [fileKey(f.name), f])))).toEqual([]);
  });

  test('the same note under another spelling is written: one disk keeps both', () => {
    const a = note('a', 'psalm');
    const before = mirrorFiles([a]);
    const known = new Map([...before.values()].map((f) => [fileKey(f.name), f]));
    const after = mirrorFiles([{ ...a, title: 'Psalm' }]);
    expect(filesToWrite(after, known).map((f) => f.name)).toEqual(['Psalm.md']);
  });
});
