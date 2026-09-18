import { offerFor } from '../../apps/reader/src/lib/offer';
import type { CatalogEntry } from '../../apps/reader/src/lib/library';

/** Which Bibles a reader is offered, from the interface language and what is installed. */

const entry = (id: string, language: string): CatalogEntry =>
  ({ id, language, name: id.toUpperCase() }) as CatalogEntry;

const CATALOG = [
  entry('bsb', 'en'),
  entry('kjv', 'en'),
  entry('rv1909', 'es'),
  entry('vbl', 'es'),
  entry('lsg1910', 'fr'),
  entry('bungo', 'ja'),
  entry('cuvs', 'zh-Hans'),
  entry('cuvt', 'zh-Hant'),
  entry('blivre', 'pt-BR'),
];
const ids = (list: CatalogEntry[]) => list.map((e) => e.id);

describe('offerFor', () => {
  test('a Spanish interface is offered every Spanish Bible', () => {
    expect(ids(offerFor('es-MX', CATALOG, ['bsb'], []))).toEqual(['rv1909', 'vbl']);
  });

  test('French and Japanese get theirs', () => {
    expect(ids(offerFor('fr-FR', CATALOG, ['bsb'], []))).toEqual(['lsg1910']);
    expect(ids(offerFor('ja-JP', CATALOG, ['bsb'], []))).toEqual(['bungo']);
  });

  test('Brazilian Portuguese gets its own', () => {
    expect(ids(offerFor('pt-BR', CATALOG, ['bsb'], []))).toEqual(['blivre']);
  });

  test('Chinese is offered both scripts, the reader’s own first', () => {
    // One translation in two character sets: either is readable, so neither is
    // withheld, and the order is the whole of the preference.
    expect(ids(offerFor('zh-Hans', CATALOG, ['bsb'], []))).toEqual(['cuvs', 'cuvt']);
    expect(ids(offerFor('zh-Hant', CATALOG, ['bsb'], []))).toEqual(['cuvt', 'cuvs']);
  });

  test('either Chinese Bible answers the offer for both', () => {
    expect(offerFor('zh-Hant', CATALOG, ['bsb', 'cuvs'], [])).toEqual([]);
  });

  test('English is offered nothing: the bundled Bible is English', () => {
    expect(offerFor('en-US', CATALOG, ['bsb'], [])).toEqual([]);
  });

  test('nothing once any Bible in the language is installed', () => {
    expect(offerFor('es-MX', CATALOG, ['bsb', 'vbl'], [])).toEqual([]);
  });

  test('nothing once the offer for that language was put away, and only that language', () => {
    expect(offerFor('es-MX', CATALOG, ['bsb'], ['es'])).toEqual([]);
    expect(ids(offerFor('fr-FR', CATALOG, ['bsb'], ['es']))).toEqual(['lsg1910']);
  });

  test('nothing while the catalog is still loading', () => {
    expect(offerFor('es-MX', [], ['bsb'], [])).toEqual([]);
  });
});
