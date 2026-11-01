import { offerFor } from '../../apps/reader/src/lib/offer';
import type { CatalogEntry } from '../../apps/reader/src/lib/library';

/** Which Bibles a reader is offered, from the interface language and what is installed. */

const entry = (id: string, language: string): CatalogEntry =>
  ({ id, language, name: id.toUpperCase() }) as CatalogEntry;

/** The library as it stands: no Chinese Bible since 2026-11-01. */
const CATALOG = [
  entry('bsb', 'en'),
  entry('kjv', 'en'),
  entry('rv1909', 'es'),
  entry('vbl', 'es'),
  entry('lsg1910', 'fr'),
  entry('bungo', 'ja'),
  entry('blivre', 'pt-BR'),
];
/** A language published in two scripts, as Chinese was and may be again. */
const WITH_CHINESE = [...CATALOG, entry('zhs', 'zh-Hans'), entry('zht', 'zh-Hant')];
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

  test('a Chinese interface is offered nothing while the library has no Chinese Bible', () => {
    expect(offerFor('zh-Hans', CATALOG, ['kjv'], [])).toEqual([]);
    expect(offerFor('zh-Hant', CATALOG, ['kjv'], [])).toEqual([]);
    // Holding a withdrawn one changes nothing: there is still nothing to offer.
    expect(offerFor('zh-Hans', CATALOG, ['kjv', 'cuvs'], [])).toEqual([]);
  });

  test('a withdrawn French Bible on the device does not stand in for the French ones offered', () => {
    expect(ids(offerFor('fr-FR', CATALOG, ['kjv', 'ostervald'], []))).toEqual(['lsg1910']);
  });

  test('a language in two scripts is offered both, the reader’s own first', () => {
    // Either is readable, so neither is withheld, and the order is the whole of
    // the preference.
    expect(ids(offerFor('zh-Hans', WITH_CHINESE, ['bsb'], []))).toEqual(['zhs', 'zht']);
    expect(ids(offerFor('zh-Hant', WITH_CHINESE, ['bsb'], []))).toEqual(['zht', 'zhs']);
  });

  test('either script answers the offer for both', () => {
    expect(offerFor('zh-Hant', WITH_CHINESE, ['bsb', 'zhs'], [])).toEqual([]);
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
