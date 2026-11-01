import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { TranslationMeta } from '@scriptura/core/types';
import { CATALOGS } from '../../apps/reader/src/i18n/catalogs';
import { LOCALES } from '../../apps/reader/src/i18n/locales';
import { withCurrentRights } from '../../apps/reader/src/lib/rights';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (path: string) => readFileSync(join(ROOT, path), 'utf8');

const metadata = readdirSync(join(ROOT, 'data'), { withFileTypes: true })
  .filter((d) => d.isDirectory() && d.name !== 'schemas')
  .map((d) => JSON.parse(read(`data/${d.name}/metadata.json`)) as TranslationMeta);
const of = (id: string) => metadata.find((m) => m.id === id)!;

/** The quoted strings of the first line matching `pattern`. */
function listed(source: string, pattern: RegExp): string[] {
  const line = source.split('\n').find((l) => pattern.test(l));
  if (!line) throw new Error(`No line matches ${pattern}`);
  return [...line.matchAll(/["']([a-z0-9.-]+)["']/g)].map((m) => m[1]).filter((v) => v !== 'string');
}

describe('the allowed licences are one list, in every place that spells it', () => {
  // schema-gen and the TS validator each lacked cc-by-4.0 while a Bible used it.
  const types = listed(read('packages/core/src/types.ts'), /export type License =/).sort();

  test.each([
    ['scripts/validate.py', /^LICENSE_ENUM =/],
    ['scripts/schema-gen.ts', /license: \{ type: 'string', enum:/],
    ['packages/validate/src/index.ts', /const VALID_LICENSES =/],
  ])('%s', (path, pattern) => {
    const values = listed(read(path), pattern).filter((v) => types.includes(v));
    expect(values.sort()).toEqual(types);
  });

  test.each([...LOCALES])('%s has a label for each', (locale) => {
    expect(Object.keys(CATALOGS[locale].library.licences).sort()).toEqual(types);
  });

  test('schema-gen declares every metadata field, since it allows no others', () => {
    const source = read('scripts/schema-gen.ts');
    for (const meta of metadata) {
      for (const field of Object.keys(meta)) expect(source).toMatch(new RegExp(`\\b${field}: \\{`));
    }
  });
});

describe('what the metadata says', () => {
  test('every Creative Commons text states its licence’s address, and links it', () => {
    const licensed = metadata.filter((m) => m.license.startsWith('cc-by'));
    expect(licensed.map((m) => m.id).sort()).toEqual(['blivre', 'vbl']);
    for (const meta of licensed) {
      expect(meta.license_url).toMatch(/^https:\/\/creativecommons\.org\/licenses\//);
      expect(meta.attribution).toContain(meta.license_url);
    }
  });

  test('Bíblia Livre follows its authors, not the aggregator', () => {
    const meta = of('blivre');
    expect(meta.license).toBe('cc-by-3.0-br');
    expect(meta.source_url).toBe('https://sites.google.com/site/biblialivre/');
    // Their three conditions: the translators, this site, the licence.
    for (const name of ['Diego Santos', 'Mario Sérgio', 'Marco Teles', meta.source_url, 'CC BY 3.0 Brasil']) {
      expect(meta.attribution).toContain(name);
    }
  });

  test('only the King James carries a rights notice, and stays public domain', () => {
    expect(metadata.filter((m) => m.rights_notice).map((m) => m.id)).toEqual(['kjv']);
    expect(of('kjv').license).toBe('public-domain');
    expect(of('kjv').rights_notice).toBe(
      'Public domain outside the UK; in the UK, rights are vested in the Crown and administered by Cambridge University Press.'
    );
  });
});

describe('withCurrentRights', () => {
  const stored = {
    id: 'blivre',
    name: 'Bíblia Livre',
    language: 'pt-BR',
    license: 'cc-by-4.0',
    attribution: 'old',
    source_url: 'https://ebible.org/porbr2018/',
    year: 2018,
    testament: 'both',
    book_count: 66,
    books: [{ kept: true }],
  } as unknown as TranslationMeta & { books: unknown[] };

  test('returns the same object when nothing differs, so nothing is written', () => {
    expect(withCurrentRights(stored, { ...stored })).toBe(stored);
    expect(withCurrentRights(stored, undefined)).toBe(stored);
  });

  test('takes the licence words and leaves everything else', () => {
    const next = withCurrentRights(stored, {
      ...stored,
      license: 'cc-by-3.0-br',
      attribution: 'new',
      license_url: 'https://example.org/',
      year: 1,
      name: 'Other',
    });
    expect(next.license).toBe('cc-by-3.0-br');
    expect(next.attribution).toBe('new');
    expect(next.license_url).toBe('https://example.org/');
    expect(next.year).toBe(2018);
    expect(next.name).toBe('Bíblia Livre');
    expect(next.books).toBe(stored.books);
  });

  test('a notice that was withdrawn stops being shown', () => {
    const withNotice = { ...stored, rights_notice: 'withdrawn' };
    const next = withCurrentRights(withNotice, stored);
    expect(next).not.toHaveProperty('rights_notice');
  });
});
