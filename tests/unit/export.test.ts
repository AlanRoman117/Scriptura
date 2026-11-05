import { exportNotes, fileKey, mirrorFiles } from '../../apps/reader/src/lib/export';
import type { Board } from '../../apps/reader/src/lib/canvas';
import type { Note } from '../../apps/reader/src/lib/notes';

/**
 * The zip names its files as the folder does.
 *
 * It had a dedupe of its own, older than the folder's: " (2)" appended without
 * looking, and names compared as strings. So "T", "T" and "T (2)" went in as two
 * entries with one path, and "Psalm" beside "psalm" unzipped to one file on
 * Windows and macOS. Both are a note silently lost, in the one artefact that is
 * the promise that the data is the reader's. The names here are read back out
 * of the archive's bytes, not taken from the code that wrote them.
 */

const note = (id: string, title: string, body = `body of ${id}`, created = 1): Note => ({
  id,
  title,
  body,
  created,
  updated: 1,
});

const board = (id: string, name: string, created = 1): Board => ({
  id,
  name,
  nodes: [],
  edges: [],
  created,
  updated: 1,
});

const u16 = (bytes: Uint8Array, at: number) => bytes[at] | (bytes[at + 1] << 8);
const u32 = (bytes: Uint8Array, at: number) => (u16(bytes, at) | (u16(bytes, at + 2) << 16)) >>> 0;

/**
 * Every entry in a store-only zip, from its central directory: the path, and
 * the bytes the local header points at. A zip with two entries at one path is
 * listed twice, which is the point of reading it rather than the writer.
 */
async function entries(zip: Blob): Promise<{ name: string; text: string }[]> {
  const bytes = new Uint8Array(await zip.arrayBuffer());
  const decoder = new TextDecoder();
  const end = bytes.length - 22;
  expect(u32(bytes, end)).toBe(0x06054b50);
  const count = u16(bytes, end + 10);
  let at = u32(bytes, end + 16);
  const found: { name: string; text: string }[] = [];
  for (let i = 0; i < count; i++) {
    expect(u32(bytes, at)).toBe(0x02014b50);
    const size = u32(bytes, at + 24);
    const nameLength = u16(bytes, at + 28);
    const extraLength = u16(bytes, at + 30);
    const commentLength = u16(bytes, at + 32);
    const local = u32(bytes, at + 42);
    const name = decoder.decode(bytes.subarray(at + 46, at + 46 + nameLength));
    expect(u32(bytes, local)).toBe(0x04034b50);
    const data = local + 30 + u16(bytes, local + 26) + u16(bytes, local + 28);
    found.push({ name, text: decoder.decode(bytes.subarray(data, data + size)) });
    at += 46 + nameLength + extraLength + commentLength;
  }
  return found;
}

const names = (found: { name: string }[]) => found.map((e) => e.name);

describe('the zip names a note as the folder does', () => {
  test('"T", "T" and "T (2)" are three entries, each holding its own note', async () => {
    const found = await entries(exportNotes([note('a', 'T'), note('b', 'T'), note('c', 'T (2)')]));
    expect(names(found)).toEqual(['notes/T.md', 'notes/T (3).md', 'notes/T (2).md']);
    expect(found.find((e) => e.name === 'notes/T (3).md')?.text).toContain('body of b');
    expect(found.find((e) => e.name === 'notes/T (2).md')?.text).toContain('body of c');
  });

  test('titles that differ only by case or Unicode form unzip to separate files on any disk', async () => {
    const found = await entries(
      exportNotes([note('a', 'Psalm'), note('b', 'psalm'), note('c', 'café'), note('d', 'café')])
    );
    expect(found).toHaveLength(4);
    expect(new Set(names(found).map(fileKey)).size).toBe(4);
  });

  test('every note has the file in the zip that the folder would give it', async () => {
    const notes = [
      note('a', 'T', 'x', 3),
      note('b', 'T', 'x', 1),
      note('c', 'T (2)', 'x', 2),
      note('d', 'PSALM'),
      note('e', 'Psalm'),
      note('f', ''),
      note('g', 'John 3:16 / notes'),
    ];
    const inFolder = [...mirrorFiles(notes).values()].map((file) => `notes/${file.name}`);
    expect(names(await entries(exportNotes(notes)))).toEqual(inFolder);
  });

  test('two boards of one name are two entries, apart from the notes', async () => {
    const found = await entries(
      exportNotes([note('a', 'Map')], [board('x', 'Map'), board('y', 'map'), board('z', 'Map (2)')])
    );
    expect(names(found)).toEqual(['notes/Map.md', 'boards/Map.md', 'boards/map (3).md', 'boards/Map (2).md']);
    expect(found[2].text).toContain('# map');
  });

  test('an untitled board keeps the word for it, since no folder names it by id', async () => {
    expect(names(await entries(exportNotes([], [board('x', '')])))).toEqual(['boards/Untitled board.md']);
  });
});
