import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * A very small Chinese Bible, in either script, for what only Chinese can prove.
 *
 * The library holds no Chinese Bible at present: `cuvs` and `cuvt` were
 * withdrawn on 2026-11-01. What they proved is still worth proving, since a
 * Chinese Bible may come back and a reader may still hold one: book names in Han,
 * search with no spaces between words, `lang` and type by script.
 *
 * ⚠️ These sentences are written for the tests and quote no translation. Do not
 * replace them with real verses of a Chinese Bible: that is the text withdrawn.
 */
export interface FixtureBook {
  number: number;
  slug: string;
  name: string;
  abbreviation: string;
  testament: 'OT' | 'NT';
  chapters: { number: number; verses: { number: number; text: string }[] }[];
}

export interface FixtureBible {
  id: string;
  name: string;
  language: string;
  license: 'public-domain';
  attribution: string;
  source_url: string;
  year: number;
  testament: 'both';
  book_count: number;
  books: FixtureBook[];
}

const SENTENCES = {
  'zh-Hans': [
    '这是测试用的句子：神的话写在这里。',
    '耶稣走过这一行，约翰看见了。',
    '这一行只为凑足行数，没有别的意思。',
    '约翰又写了一行，也是测试用的。',
    '最后一行提到耶稣和神，到此为止。',
  ],
  'zh-Hant': [
    '這是測試用的句子：神的話寫在這裡。',
    '耶穌走過這一行，約翰看見了。',
    '這一行只為湊足行數，沒有別的意思。',
    '約翰又寫了一行，也是測試用的。',
    '最後一行提到耶穌和神，到此為止。',
  ],
} as const;

const NAMES = {
  'zh-Hans': { john: '约翰福音', genesis: '创世记', abbreviation: '约' },
  'zh-Hant': { john: '約翰福音', genesis: '創世記', abbreviation: '約' },
} as const;

const chapter = (number: number, script: keyof typeof SENTENCES) => ({
  number,
  verses: SENTENCES[script].map((text, i) => ({ number: i + 1, text })),
});

/** The shape of `/translations/:id/full.json`, with John 1-3 and Genesis 1. */
export function chineseBible(id: string, script: keyof typeof SENTENCES, name = `测试 ${id}`): FixtureBible {
  return {
    id,
    name,
    language: script,
    license: 'public-domain',
    attribution: 'Written for the tests',
    source_url: 'https://example.com',
    year: 1919,
    testament: 'both',
    book_count: 2,
    books: [
      {
        number: 1,
        slug: 'genesis',
        name: NAMES[script].genesis,
        abbreviation: '创',
        testament: 'OT',
        chapters: [chapter(1, script)],
      },
      {
        number: 43,
        slug: 'john',
        name: NAMES[script].john,
        abbreviation: NAMES[script].abbreviation,
        testament: 'NT',
        chapters: [1, 2, 3].map((n) => chapter(n, script)),
      },
    ],
  };
}

/** Write one into a data directory, in the layout `packages/core` reads. */
export function writeBible(dataDir: string, bible: FixtureBible): void {
  const { books, ...meta } = bible;
  const dir = join(dataDir, bible.id, 'books');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dataDir, bible.id, 'metadata.json'), JSON.stringify(meta));
  for (const { slug, ...book } of books) {
    writeFileSync(join(dir, `${String(book.number).padStart(2, '0')}-${slug}.json`), JSON.stringify(book));
  }
}
