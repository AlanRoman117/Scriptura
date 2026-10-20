import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { LOCALES } from '../../apps/reader/src/i18n/locales';
import { guide, index, OUT, withTheirs, written, YOURS } from '../../scripts/language-review';

/**
 * The reviewers' guides in docs/human-language-review are written from the
 * catalogs, so that a reviewer reads what the app says. That only holds while
 * they are written again whenever a catalog changes — which is what this
 * checks, and what a reviewer handed a stale guide would have no way to know.
 *
 * A failure here means: run `npm run review:docs` and commit the result.
 */
describe.each(LOCALES)('the guide for the reviewer of %s', (locale) => {
  const path = join(OUT, `${locale}.md`);
  const onDisk = readFileSync(path, 'utf8');

  test('says what the catalog says now', () => {
    // Compared without what its reviewer has added: their notes, and the boxes they ticked.
    expect(written(onDisk)).toBe(written(withTheirs(guide(locale), null)));
  });

  test('shows only pictures that are there', () => {
    const pictures = [...onDisk.matchAll(/\]\((img\/[^)]+)\)/g)].map((match) => match[1]);
    expect(pictures.length).toBeGreaterThan(10);
    expect(pictures.filter((file) => !existsSync(join(OUT, file)))).toEqual([]);
  });

  test('has every text of the catalog in a table, and none of them broken', () => {
    const keys = new Set([...onDisk.matchAll(/^\| `([^`]+)`/gm)].map((match) => match[1]));
    // A sample from each end of the app: seen, heard, counted, and deep in Help.
    for (const key of ['reader.book', 'verseActions.summary', 'search.matches', 'confirm.note.title', 'canvas.undo', 'help.sections.finding.heading']) {
      expect(keys.has(key)).toBe(true);
    }
    expect(keys.size).toBeGreaterThan(450);
    expect(onDisk).not.toMatch(/\bundefined\b|\[object /);
  });

  test('keeps room for its reviewer under a line that is never rewritten', () => {
    expect(onDisk.split(YOURS)).toHaveLength(2);
    expect(onDisk.slice(onDisk.indexOf(YOURS))).toContain('| Reviewed by |');
  });
});

describe('writing a guide again', () => {
  const fresh = ['# Guide', '', '- [ ] The voice is right.', '- [ ] The counts are right.', '', '## Your notes', ''].join('\n');

  test('a first writing ends with the form a reviewer fills in', () => {
    const file = withTheirs(fresh, null);
    expect(file.startsWith(fresh)).toBe(true);
    expect(file).toContain(YOURS);
  });

  test('keeps what the reviewer wrote, and the boxes they ticked', () => {
    const first = withTheirs(fresh, null);
    const reviewed = first.replace('- [ ] The voice is right.', '- [x] The voice is right.').replace('| | | |', '| `notes.new` | Too formal | Nueva |');
    const again = withTheirs(fresh.replace('# Guide', '# Guide, with a new text'), reviewed);
    expect(again).toContain('# Guide, with a new text');
    expect(again).toContain('- [x] The voice is right.');
    expect(again).toContain('- [ ] The counts are right.');
    expect(again).toContain('| `notes.new` | Too formal | Nueva |');
    // And the part this script writes is the same whether or not anything was ticked.
    expect(written(again)).toBe(written(withTheirs(fresh.replace('# Guide', '# Guide, with a new text'), null)));
  });

  test('a box whose words have changed starts unticked: it is a new thing to check', () => {
    const reviewed = withTheirs(fresh, null).replace('- [ ] The counts are right.', '- [x] The counts are right.');
    const again = withTheirs(fresh.replace('The counts are right.', 'The counts and the sizes are right.'), reviewed);
    expect(again).toContain('- [ ] The counts and the sizes are right.');
  });
});

test('the index of the guides is as the script writes it', () => {
  expect(readFileSync(join(OUT, 'README.md'), 'utf8')).toBe(index());
});
