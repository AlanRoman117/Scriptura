import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * The deny-list in scripts/validate.py, for the texts withdrawn on 2026-11-01.
 *
 * `cuvs`/`cuvt` carried the 1988/89 New Punctuation revision as the 1919 Union
 * Version, and `ostervald` the 1996 revision as the text of 1867. Those sources
 * must not come back unnoticed, under the old ids or new ones. The older works
 * themselves are free, so the name Ostervald must stay usable.
 *
 * Each case is a one-book translation in a temporary data directory; it fails
 * validation for being one book either way, so what is read is whether the
 * failure says FORBIDDEN.
 */
const SCRIPT = fileURLToPath(new URL('../../scripts/validate.py', import.meta.url));

function validate(id: string, metadata: Record<string, unknown> = {}): string {
  const data = mkdtempSync(join(tmpdir(), 'scriptura-deny-'));
  try {
    const dir = join(data, id);
    mkdirSync(join(dir, 'books'), { recursive: true });
    writeFileSync(
      join(dir, 'metadata.json'),
      JSON.stringify({
        id,
        name: 'A name',
        language: 'fr',
        license: 'public-domain',
        attribution: 'An attribution',
        source_url: 'https://example.com/',
        year: 1867,
        testament: 'both',
        book_count: 1,
        ...metadata,
      })
    );
    writeFileSync(
      join(dir, 'books', '01-genesis.json'),
      JSON.stringify({
        number: 1,
        name: 'Genèse',
        abbreviation: 'Gen',
        testament: 'OT',
        chapters: [{ number: 1, verses: [{ number: 1, text: 'x' }] }],
      })
    );
    return spawnSync('python3', [SCRIPT, '--data-dir', data], { encoding: 'utf8' }).stdout;
  } finally {
    rmSync(data, { recursive: true, force: true });
  }
}

describe('the withdrawn translations stay out', () => {
  test.each(['cuvs', 'cuvt', 'ostervald', 'cmn-cu89s', 'cmn-cu89t', 'cmn_cu89s', 'fra_fob', 'fra-fob'])(
    'the id %s is refused',
    (id) => {
      expect(validate(id)).toContain('FORBIDDEN');
    }
  );

  test.each([
    ['name', { name: '新标点和合本' }],
    ['name', { name: '新標點和合本' }],
    ['attribution', { attribution: 'Chinese Union New Punctuation 1989' }],
    ['attribution', { attribution: 'Copyright © 1996 Mission Baptiste Maranatha' }],
    // The case that matters most: everything about it says otherwise, and only
    // the source tells. A mislabelled text is how these got in.
    ['source', { source_url: 'https://ebible.org/fra_fob/' }],
    ['source', { source_url: 'https://ebible.org/cmn-cu89s/' }],
    ['source', { source_url: 'https://ebible.org/CMN-CU89T/' }],
  ])('a new id is refused when its %s gives it away: %j', (_where, metadata) => {
    expect(validate('newid', metadata)).toContain('FORBIDDEN');
  });
});

describe('what they only claimed to be is not refused', () => {
  test('an Ostervald of 1867 from another source', () => {
    const output = validate('ostervald1867', {
      name: 'Bible Ostervald (1867)',
      attribution: 'Bible Ostervald 1867 — Domaine public',
      source_url: 'https://example.com/ostervald-1867/',
    });
    // It reaches the real checks, and fails only for being one book.
    expect(output).toContain('ostervald1867');
    expect(output).not.toContain('FORBIDDEN');
  });

  test('a Union Version of 1919 under its own id', () => {
    const output = validate('cuv1919', {
      name: '官話和合本',
      language: 'zh-Hant',
      attribution: 'Chinese Union Version 1919 — Public Domain',
      source_url: 'https://example.com/cuv-1919/',
    });
    expect(output).not.toContain('FORBIDDEN');
  });

  test('the corpus as it stands', () => {
    const output = spawnSync('python3', [SCRIPT, '--strict'], {
      encoding: 'utf8',
      cwd: fileURLToPath(new URL('../../', import.meta.url)),
    }).stdout;
    expect(output).not.toContain('FORBIDDEN');
    expect(output).toContain('validation passed');
  });
});
