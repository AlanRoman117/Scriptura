import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createZip, safeFilename } from '../../apps/reader/src/lib/zip';

/**
 * The export format, checked against a real unzip.
 *
 * "Export All Notes" is the promise that the data is genuinely the user's, so
 * the archive has to open in the tools they already have. A hand-written ZIP
 * that only our own reader can read would defeat the point — and a CRC or
 * offset that is subtly wrong still *looks* like a file.
 */

const hasUnzip = (() => {
  try {
    execFileSync('unzip', ['-v'], { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
})();

/**
 * Reported as skipped when there is no `unzip`, rather than passing silently.
 *
 * These two tests used to `return` early, so an environment without the binary
 * showed green with the only tests that actually open the archive doing
 * nothing. Both Linux and macOS ship Info-ZIP 6.00 — the same implementation,
 * with the same flags — so a skip here means something is genuinely missing and
 * should say so.
 */
const withUnzip = hasUnzip ? test : test.skip;

describe('createZip', () => {
  let work: string;
  beforeEach(() => {
    work = mkdtempSync(join(tmpdir(), 'scriptura-zip-'));
  });
  afterEach(() => rmSync(work, { recursive: true, force: true }));

  const write = async (blob: Blob) => {
    const path = join(work, 'out.zip');
    writeFileSync(path, Buffer.from(await blob.arrayBuffer()));
    return path;
  };

  withUnzip('produces a file the system unzip accepts', async () => {
    const path = await write(
      createZip([
        { name: 'notes/first.md', content: '# First\n\nBody.\n' },
        { name: 'notes/second.md', content: '# Second\n' },
      ])
    );
    // -t tests the archive, including every CRC.
    const output = execFileSync('unzip', ['-t', path], { encoding: 'utf-8' });
    expect(output).toContain('No errors detected');
  });

  withUnzip('round-trips content exactly, including non-ASCII', async () => {
    const content = '# Génesis\n\nそれ神はその獨子を賜ふ — amó.\n';
    const path = await write(createZip([{ name: 'notes/unicode.md', content }]));

    execFileSync('unzip', ['-q', path, '-d', join(work, 'out')], { stdio: 'pipe' });
    expect(readFileSync(join(work, 'out', 'notes', 'unicode.md'), 'utf-8')).toBe(content);
  });

  test('an empty archive is structurally valid', async () => {
    // `unzip -t` exits non-zero on an empty archive by design — that is unzip
    // reporting "nothing to test", not a malformed file — so this checks the
    // bytes instead: an end-of-central-directory record and nothing else.
    const bytes = new Uint8Array(await createZip([]).arrayBuffer());
    expect(bytes.length).toBe(22);
    expect(Array.from(bytes.slice(0, 4))).toEqual([0x50, 0x4b, 0x05, 0x06]);
  });
});

describe('safeFilename', () => {
  test('strips characters a filesystem will not take', () => {
    expect(safeFilename('John 3:16 / notes', 'id')).toBe('John 3-16 - notes');
    expect(safeFilename('a*b?c"d<e>f|g', 'id')).toBe('a-b-c-d-e-f-g');
  });

  test('falls back rather than producing an empty name', () => {
    expect(safeFilename('', 'note-1')).toBe('note-1');
    expect(safeFilename('///', 'note-1')).toBe('note-1');
  });

  test('keeps non-ASCII titles intact', () => {
    expect(safeFilename('Génesis 1', 'id')).toBe('Génesis 1');
  });
});
