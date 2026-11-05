import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Book } from '@scriptura/core';

/**
 * A chapter's title (`superscription`): a Psalm's heading, which English Bibles
 * set before verse 1 unnumbered. It is the chapter's, never verse 1's, and the
 * field is present only where the source has one.
 *
 * The counts are facts about the committed corpus, from each source's own
 * markup (USFX `<d>`, USFM `\d`, OSIS `<title type="psalm">`), and a re-import
 * that changes one should change it here on purpose. The KJV's source carries
 * no titles; Segond, Reina-Valera, Young and Martin number the title as verse 1,
 * so it is verse text there and this field stays absent.
 */

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const DATA = join(ROOT, 'data');
const VALIDATE = join(ROOT, 'scripts', 'validate.py');

const EXPECTED: Record<string, number> = {
  asv: 116,
  blivre: 115,
  // 116 Psalms, and Zechariah 12, which the publisher's file opens with a
  // descriptive title ("This is the burden of the word of the LORD…").
  bsb: 117,
  bungo: 116,
  kjv: 0,
  lsg1910: 0,
  martin1744: 0,
  rv1909: 0,
  // 117 Psalms: the VBL gives Psalm 43 a title, and sets Psalm 76's over two lines.
  vbl: 117,
  web: 116,
  ylt: 0,
};

const translations = readdirSync(DATA, { withFileTypes: true })
  .filter((d) => d.isDirectory() && d.name !== 'schemas')
  .map((d) => d.name)
  .sort();

const books = (id: string): Book[] =>
  readdirSync(join(DATA, id, 'books'))
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((f) => JSON.parse(readFileSync(join(DATA, id, 'books', f), 'utf8')) as Book);

describe('the corpus', () => {
  test('every translation is accounted for', () => {
    expect(translations).toEqual(Object.keys(EXPECTED).sort());
  });

  test.each(translations)('%s carries the titles its source has, each a non-empty string', (id) => {
    let count = 0;
    for (const book of books(id)) {
      for (const chapter of book.chapters) {
        if (!('superscription' in chapter)) continue;
        expect(typeof chapter.superscription).toBe('string');
        expect(chapter.superscription!.trim()).toBe(chapter.superscription);
        expect(chapter.superscription!.length).toBeGreaterThan(0);
        count++;
      }
    }
    expect(count).toBe(EXPECTED[id]);
  });

  test('a title is not verse 1, and Psalm 119’s letters are headings, not a title', () => {
    const psalms = books('web').find((b) => b.number === 19)!;
    const third = psalms.chapters.find((c) => c.number === 3)!;
    expect(third.superscription).toBe('A Psalm by David, when he fled from Absalom his son.');
    expect(third.verses[0].text).toBe('LORD, how my adversaries have increased! Many are those who rise up against me.');
    // The World English Bible marks ALEPH..TAV with the title's marker; they are
    // left out rather than making "ALEPH" the Psalm's title.
    const acrostic = psalms.chapters.find((c) => c.number === 119)!;
    expect(acrostic).not.toHaveProperty('superscription');
    expect(acrostic.verses.find((v) => v.number === 8)!.text).toBe('I will observe your statutes. Don’t utterly forsake me.');
  });

  test('Segond’s headings and references are out of its verses', () => {
    const genesis = books('lsg1910').find((b) => b.number === 1)!;
    const verse = genesis.chapters.find((c) => c.number === 29)!.verses.find((v) => v.number === 14)!;
    expect(verse.text).toBe('Et Laban lui dit: Certainement, tu es mon os et ma chair. Jacob demeura un mois chez Laban.');
  });
});

describe('scripts/validate.py', () => {
  function validate(chapter: Record<string, unknown>): string {
    const data = mkdtempSync(join(tmpdir(), 'scriptura-title-'));
    try {
      const dir = join(data, 'tt');
      mkdirSync(join(dir, 'books'), { recursive: true });
      writeFileSync(
        join(dir, 'metadata.json'),
        JSON.stringify({
          id: 'tt',
          name: 'A name',
          language: 'en',
          license: 'public-domain',
          attribution: 'An attribution',
          source_url: 'https://example.com/',
          year: 1900,
          testament: 'both',
          book_count: 1,
        })
      );
      writeFileSync(
        join(dir, 'books', '19-psalms.json'),
        JSON.stringify({ number: 19, name: 'Psalms', abbreviation: 'Psa', testament: 'OT', chapters: [chapter] })
      );
      return spawnSync('python3', [VALIDATE, '--data-dir', data], { encoding: 'utf8' }).stdout;
    } finally {
      rmSync(data, { recursive: true, force: true });
    }
  }

  test('accepts a title that is text', () => {
    const output = validate({ number: 3, superscription: 'A Psalm of David.', verses: [{ number: 1, text: 'x' }] });
    expect(output).not.toContain('superscription');
  });

  test.each([
    ['empty', ''],
    ['blank', '   '],
    ['not a string', 7],
  ])('refuses a title that is %s', (_label, superscription) => {
    const output = validate({ number: 3, superscription, verses: [{ number: 1, text: 'x' }] });
    expect(output).toContain("'superscription' must be a non-empty string");
  });
});

describe('the schemas', () => {
  test('schema-gen declares it on a chapter, optional and never empty', () => {
    const source = readFileSync(join(ROOT, 'scripts', 'schema-gen.ts'), 'utf8');
    expect(source).toMatch(/superscription: \{\s*type: 'string',\s*minLength: 1/);
    // Optional: the chapter's required list is unchanged.
    expect(source).toMatch(/required: \['number', 'verses'\]/);
  });
});
