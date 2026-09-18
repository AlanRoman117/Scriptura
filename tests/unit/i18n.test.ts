import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import {
  DEFAULT_LOCALE,
  LANGUAGE_TO_LOCALE,
  LOCALES,
  LOCALE_LABELS,
  matchLocale,
  primaryLanguage,
} from '../../apps/reader/src/i18n/locales';
import { bytesFor, formattersFor, numberFor, percentFor, pluralFor } from '../../apps/reader/src/i18n/format';
import { CATALOGS } from '../../apps/reader/src/i18n/catalogs';
import { frenchSpacing, withFrenchSpacing } from '../../apps/reader/src/i18n/typography';

/**
 * Language tags, formatting and the catalogs.
 *
 * The tags are what a screen reader reads to choose its voice, so they are
 * checked against the IANA Language Subtag Registry
 * (https://www.iana.org/assignments/language-subtag-registry), whose records
 * for the subtags used here are copied below. `Intl.DisplayNames` cannot stand
 * in for the registry: it renders a made-up tag such as `xx-QQ` as "xx (QQ)"
 * rather than refusing it.
 */

/** Registry records, File-Date 2026-09-17: Type, Subtag, Description. */
const REGISTRY = {
  language: {
    en: 'English',
    es: 'Spanish; Castilian',
    fr: 'French',
    ja: 'Japanese',
    pt: 'Portuguese',
    zh: 'Chinese',
  },
  // A Bible's tag says which script it is written in where that is the whole
  // difference: one Chinese translation, two character sets.
  script: { Hans: 'Han (Simplified variant)', Hant: 'Han (Traditional variant)' },
  region: { US: 'United States', MX: 'Mexico', FR: 'France', JP: 'Japan', BR: 'Brazil' },
} as const;

/**
 * Bible languages with no interface yet, named rather than assumed.
 *
 * The rule is that the two sets match, so neither can drift unnoticed. A
 * language arrives here when its Bible lands and its catalog has not been
 * written; it leaves when the catalog does. A stale entry fails the test
 * below, so the list cannot be forgotten.
 */
const INTERFACE_PENDING = new Set<string>();

const DATA = fileURLToPath(new URL('../../data/', import.meta.url));
const metadataLanguages = readdirSync(DATA, { withFileTypes: true })
  .filter((d) => d.isDirectory() && d.name !== 'schemas')
  .map((d) => [d.name, JSON.parse(readFileSync(join(DATA, d.name, 'metadata.json'), 'utf8')).language as string]);

describe('language tags', () => {
  test.each([...LOCALES])('%s is canonical and built from registry subtags', (tag) => {
    expect(Intl.getCanonicalLocales(tag)).toEqual([tag]);
    const locale = new Intl.Locale(tag);
    expect(Object.keys(REGISTRY.language)).toContain(locale.language);
    // Every interface tag carries the subtag that decides its words: a region,
    // or for Chinese a script, since Simplified and Traditional each span
    // several regions.
    expect(locale.script ?? locale.region).toBeDefined();
    if (locale.script) expect(Object.keys(REGISTRY.script)).toContain(locale.script);
    if (locale.region) expect(Object.keys(REGISTRY.region)).toContain(locale.region);
  });

  test.each(metadataLanguages)('%s is tagged %s, built from registry subtags', (_id, tag) => {
    expect(Intl.getCanonicalLocales(tag)).toEqual([tag]);
    // A Bible's tag may carry a script (zh-Hans) or a region (pt-BR): both are
    // what the text is, and both are what a screen reader reads it as.
    const locale = new Intl.Locale(tag);
    expect(Object.keys(REGISTRY.language)).toContain(locale.language);
    if (locale.script) expect(Object.keys(REGISTRY.script)).toContain(locale.script);
    if (locale.region) expect(Object.keys(REGISTRY.region)).toContain(locale.region);
  });

  test('every interface has a Bible, and every Bible an interface or a place in the pending list', () => {
    const bibles = new Set(metadataLanguages.map(([, tag]) => primaryLanguage(tag)));
    const interfaces = new Set(LOCALES.map(primaryLanguage));

    expect(new Set(Object.keys(LANGUAGE_TO_LOCALE))).toEqual(interfaces);
    for (const language of interfaces) expect(bibles).toContain(language);
    for (const language of bibles) {
      expect(interfaces.has(language) || INTERFACE_PENDING.has(language)).toBe(true);
    }
    // Nothing waits for an interface it already has, or for a Bible that is
    // not here.
    for (const language of INTERFACE_PENDING) {
      expect(interfaces).not.toContain(language);
      expect(bibles).toContain(language);
    }
  });

  test('every language has its own label', () => {
    expect(Object.keys(LOCALE_LABELS).sort()).toEqual([...LOCALES].sort());
  });
});

describe('matchLocale', () => {
  test.each([
    [['en-US'], 'en-US'],
    [['es-MX'], 'es-MX'],
    [['es-ES'], 'es-MX'],
    [['es-419'], 'es-MX'],
    [['fr-CA'], 'fr-FR'],
    [['ja'], 'ja-JP'],
    [['de-DE', 'fr-CA'], 'fr-FR'],
    [['de-DE', 'en-GB', 'es-MX'], 'en-US'],
    [['de-DE'], 'en-US'],
    [['PT_br'], 'pt-BR'],
    [['pt-PT'], 'pt-BR'],
    // Chinese by script: named, implied by a region, or neither.
    [['zh'], 'zh-Hans'],
    [['zh-CN'], 'zh-Hans'],
    [['zh-SG'], 'zh-Hans'],
    [['zh-Hans-CN'], 'zh-Hans'],
    [['zh-TW'], 'zh-Hant'],
    [['zh-HK'], 'zh-Hant'],
    [['zh-MO'], 'zh-Hant'],
    [['zh-Hant'], 'zh-Hant'],
    [['ZH-hant-tw'], 'zh-Hant'],
    // What Internet Explorer taught Windows to send.
    [['zh-CHT'], 'zh-Hant'],
    [['zh-CHS'], 'zh-Hans'],
    [['de-DE', 'zh-TW'], 'zh-Hant'],
    [[], 'en-US'],
  ] as [string[], string][])('%j → %s', (languages, expected) => {
    expect(matchLocale(languages)).toBe(expected);
  });

  test('undetected means English', () => {
    expect(matchLocale(undefined)).toBe(DEFAULT_LOCALE);
    expect(DEFAULT_LOCALE).toBe('en-US');
  });
});

describe('formatting follows the language', () => {
  const forms = { one: 'one', many: 'many', other: 'other' };

  test.each([
    ['en-US', ['other', 'one', 'other', 'other']],
    ['es-MX', ['other', 'one', 'other', 'many']],
    ['fr-FR', ['one', 'one', 'other', 'many']],
    ['ja-JP', ['other', 'other', 'other', 'other']],
    // Portuguese counts 0 as singular, as French does: «0 nota».
    ['pt-BR', ['one', 'one', 'other', 'many']],
    // Chinese counts with measure words and has one form, like Japanese.
    ['zh-Hans', ['other', 'other', 'other', 'other']],
    ['zh-Hant', ['other', 'other', 'other', 'other']],
  ] as const)('%s plurals for 0, 1, 2 and 1,000,000', (locale, expected) => {
    const plural = pluralFor(locale);
    expect([0, 1, 2, 1_000_000].map((n) => plural(n, forms))).toEqual(expected);
  });

  test('a form a language uses but a catalog leaves out falls back to other', () => {
    expect(pluralFor('es-MX')(1_000_000, { one: 'one', other: 'other' })).toBe('other');
  });

  test.each([
    ['en-US', '28,123'],
    ['es-MX', '28,123'],
    ['fr-FR', '28\u202f123'],
    ['ja-JP', '28,123'],
    ['pt-BR', '28.123'],
    ['zh-Hans', '28,123'],
    ['zh-Hant', '28,123'],
  ] as const)('%s groups thousands as %s', (locale, expected) => {
    expect(numberFor(locale)(28123)).toBe(expected);
  });

  test('percentages and sizes', () => {
    expect(percentFor('en-US')(45)).toBe('45%');
    // CLDR's own spaces: a no-break space before %, a narrow one before a unit.
    expect(percentFor('fr-FR')(45)).toBe('45\u00a0%');
    expect(bytesFor('en-US')(4.4 * 1048576)).toBe('4.4 MB');
    expect(bytesFor('en-US')(2048 * 1048576)).toBe('2.0 GB');
    expect(bytesFor('fr-FR')(4.4 * 1048576)).toBe('4,4\u202fMo');
    expect(bytesFor('en-US')(0)).toBe('—');
  });

  test('language names are headings in the interface language', () => {
    expect(formattersFor('en-US').languageName('es')).toBe('Spanish');
    expect(formattersFor('es-MX').languageName('es')).toBe('Español');
    expect(formattersFor('fr-FR').languageName('ja')).toBe('Japonais');
    expect(formattersFor('ja-JP').languageName('fr')).toBe('フランス語');
    expect(formattersFor('pt-BR').languageName('ja')).toBe('Japonês');
    expect(formattersFor('zh-Hans').languageName('fr')).toBe('法语');
    expect(formattersFor('zh-Hant').languageName('fr')).toBe('法文');
  });
});

/** Every leaf of a catalog: `path` → string, or the function itself. */
function leaves(value: unknown, path = ''): [string, unknown][] {
  if (typeof value === 'string' || typeof value === 'function') return [[path, value]];
  if (Array.isArray(value)) return value.flatMap((v, i) => leaves(v, `${path}[${i}]`));
  if (value && typeof value === 'object') {
    return Object.entries(value).flatMap(([k, v]) => leaves(v, path ? `${path}.${k}` : k));
  }
  return [[path, value]];
}

/** Keys only, ignoring array lengths: a language may split a paragraph differently. */
function shape(value: unknown, path = ''): string[] {
  if (Array.isArray(value) || typeof value !== 'object' || value === null) return [path];
  return Object.entries(value).flatMap(([k, v]) => shape(v, path ? `${path}.${k}` : k));
}

/**
 * Every text a catalog can produce: its strings, and what its functions return
 * when called with placeholder values. Code spans are dropped; they are
 * examples to be typed, not prose.
 */
function producedText(catalog: unknown): string[] {
  const out: string[] = [];
  for (const [, value] of leaves(catalog)) {
    let produced: unknown = value;
    if (typeof value === 'function') {
      try {
        produced = value('Jean 3:16', 'Tableau', 'X', 'Y');
      } catch {
        produced = value({ kind: 'card', label: 'Jean 3:16' }, 'X');
      }
    }
    for (const [, text] of leaves(produced)) {
      if (typeof text === 'string') out.push(text.replace(/`[^`]*`/g, '``'));
    }
  }
  return out;
}

/** Where French text lacks the no-break space its punctuation needs. */
function frenchSpacingProblems(texts: string[]): string[] {
  const wrong: string[] = [];
  for (const text of texts) {
    for (const m of text.matchAll(/([\s\S])([:;!?»])/g)) {
      const [, before, mark] = m;
      const at = m.index ?? 0;
      // A reference or a ratio: 3:16, 7:1.
      if (mark === ':' && /\d/.test(before) && /\d/.test(text[at + 2] ?? '')) continue;
      const expected = mark === ':' || mark === '»' ? '\u00a0' : '\u202f';
      if (before !== expected) wrong.push(`${JSON.stringify(before)} before ${mark} in: ${text}`);
    }
    for (const m of text.matchAll(/«([\s\S])/g)) {
      if (m[1] !== '\u00a0') wrong.push(`${JSON.stringify(m[1])} after « in: ${text}`);
    }
  }
  return wrong;
}

describe('punctuation follows each language', () => {
  test('French puts a no-break space before : ; ! ? and inside « »', () => {
    const texts = producedText(CATALOGS['fr-FR']);
    expect(texts.length).toBeGreaterThan(300);
    expect(frenchSpacingProblems(texts)).toEqual([]);
  });

  test('the French check catches what the spacing step would have fixed', () => {
    const typed = ['Aide : trouver', 'Confirmer ?', 'Tableau « Étude »', 'Aide:trouver'];
    expect(frenchSpacingProblems(typed)).toHaveLength(5);
    expect(frenchSpacingProblems(['Jean 3:16', 'un contraste de 7:1'])).toEqual([]);
    expect(frenchSpacingProblems(typed.map(frenchSpacing))).toHaveLength(1);
  });

  test('French spacing leaves what a message quotes as it was given', () => {
    const fr = CATALOGS['fr-FR'];
    // A note's own name keeps its own spacing; the message's punctuation is spaced.
    expect(fr.confirm.note.title('Plan: semaine 1 ?')).toBe('Supprimer la note «\u00a0Plan: semaine 1 ?\u00a0»\u202f?');
    expect(fr.confirm.note.done('Plan: semaine 1')).toBe('Note «\u00a0Plan: semaine 1\u00a0» supprimée');
    // Inside an object argument too, and without changing what the message switches on.
    expect(fr.canvas.removed({ kind: 'card', label: 'Idée : brouillon' })).toBe(
      'Fiche retirée\u00a0: Idée : brouillon. Vous pouvez annuler depuis la barre du tableau.'
    );
    expect(fr.canvas.removed({ kind: 'connection', label: 'A ; B' })).toMatch(/^Connexion retirée\u00a0: A ; B\./);
  });

  test('the spacing step keeps a quoted string whole, however often it appears, and spaces around it', () => {
    const say = withFrenchSpacing({ say: (a: string, b: string) => `« ${a} » : ${b} ?` }).say;
    // The longer string is kept whole where the shorter one starts it.
    expect(say('x : y', 'x : y !')).toBe('«\u00a0x : y\u00a0»\u00a0: x : y !\u202f?');
    // Unquoted, the same text is respaced: the keeping is what spares it.
    expect(frenchSpacing('« x : y » : x : y ! ?')).toBe('«\u00a0x\u00a0: y\u00a0»\u00a0: x\u00a0: y\u202f!\u202f?');
    // Strings with nothing to respace, and numbers, pass straight through.
    const count = withFrenchSpacing({ n: (n: number, word: string) => `${n} ${word} ?` }).n;
    expect(count(3, 'fiches')).toBe('3 fiches\u202f?');
  });

  test('Japanese uses Japanese punctuation after Japanese text', () => {
    const japanese = /[\u3040-\u30ff\u3400-\u9fff]/u;
    const wrong: string[] = [];
    for (const text of producedText(CATALOGS['ja-JP'])) {
      for (const m of text.matchAll(/([\s\S])([.,?!:;()])/g)) {
        if (japanese.test(m[1])) wrong.push(`${m[2]} after ${m[1]} in: ${text}`);
      }
    }
    expect(wrong).toEqual([]);
  });

  test.each(['zh-Hans', 'zh-Hant'] as const)('%s uses full-width punctuation after Chinese text', (locale) => {
    const han = /[\u3400-\u9fff]/u;
    const wrong: string[] = [];
    for (const text of producedText(CATALOGS[locale])) {
      for (const m of text.matchAll(/([\s\S])([.,?!:;()])/g)) {
        if (han.test(m[1])) wrong.push(`${m[2]} after ${m[1]} in: ${text}`);
      }
    }
    expect(wrong).toEqual([]);
  });

  /**
   * The mainland quotes with “ ”, Taiwan with 「 」. Either looks wrong to the
   * other, and a mechanical character conversion would carry the wrong pair
   * straight across.
   */
  test('each Chinese script quotes the way it is written', () => {
    const hans = producedText(CATALOGS['zh-Hans']).join('\n');
    const hant = producedText(CATALOGS['zh-Hant']).join('\n');
    expect(hans).toContain('\u201c');
    expect(hans).not.toMatch(/[\u300c\u300d]/u);
    expect(hant).toContain('\u300c');
    expect(hant).not.toMatch(/[\u201c\u201d]/u);
  });

  /**
   * Traditional Chinese is its own text, not a transliteration: Taiwan and the
   * mainland choose different words for the same thing, and a converter that
   * only maps characters leaves the mainland word in traditional strokes.
   */
  test('Traditional Chinese uses Taiwan words, not converted mainland ones', () => {
    const hans = producedText(CATALOGS['zh-Hans']).join('\n');
    const hant = producedText(CATALOGS['zh-Hant']).join('\n');
    // Mainland word, the traditional characters a converter would give it, and
    // the word Taiwan actually uses. Three of these change no characters at
    // all, which is exactly why converting is not translating.
    for (const [mainland, converted, taiwan] of [
      ['搜索', '搜索', '搜尋'],
      ['设置', '設置', '設定'],
      ['保存', '保存', '儲存'],
      ['导出', '導出', '匯出'],
      ['文件夹', '文件夾', '資料夾'],
      ['帮助', '幫助', '說明'],
      ['助手', '助手', '助理'],
    ]) {
      expect(hans).toContain(mainland);
      expect(hant).toContain(taiwan);
      expect(hant).not.toContain(converted);
    }
  });
});

describe('the catalogs', () => {
  const english = CATALOGS['en-US'];

  test.each([...LOCALES])('%s has exactly the keys English has', (locale) => {
    expect(shape(CATALOGS[locale]).sort()).toEqual(shape(english).sort());
  });

  test.each([...LOCALES])('%s has no empty text', (locale) => {
    const empty = leaves(CATALOGS[locale]).filter(([, v]) => v === '').map(([k]) => k);
    expect(empty).toEqual([]);
  });

  test.each([...LOCALES])('%s help examples use the book names they are given', (locale) => {
    const text = JSON.stringify(CATALOGS[locale].help.sections({ john: 'ZZJOHN', abbr: 'ZZABBR' }));
    expect(text).toContain('ZZJOHN 3:16');
    expect(text).toContain('ZZABBR 3:16');
  });
});
