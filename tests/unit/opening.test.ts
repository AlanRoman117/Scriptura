import { DEFAULT_TRANSLATION, openingOrder } from '../../apps/reader/src/lib/opening';

/**
 * The default moved from the BSB to the KJV. A device that has been reading the
 * BSB holds it and, unless its reader ever switched, has no stored choice.
 */
describe('which Bible a device opens on', () => {
  test('a new device opens on the default', () => {
    expect(DEFAULT_TRANSLATION).toBe('kjv');
    expect(openingOrder(undefined, [])[0]).toBe('kjv');
  });

  test('a device that has been reading the old default keeps it', () => {
    expect(openingOrder(undefined, ['bsb'])[0]).toBe('bsb');
    expect(openingOrder(undefined, ['bsb', 'kjv'])[0]).toBe('bsb');
  });

  test('a stored choice always wins', () => {
    expect(openingOrder('kjv', ['bsb', 'kjv'])[0]).toBe('kjv');
    expect(openingOrder('rv1909', ['bsb', 'rv1909'])[0]).toBe('rv1909');
  });

  test('a device with another Bible but not the old one opens on the default', () => {
    expect(openingOrder(undefined, ['rv1909'])).toEqual(['kjv', 'rv1909']);
  });

  test('when the wanted Bible cannot load, the default and then anything on the device is tried', () => {
    expect(openingOrder('web', ['rv1909', 'ylt'])).toEqual(['web', 'kjv', 'rv1909', 'ylt']);
  });

  test('a stored translation the catalog no longer lists is opened all the same', () => {
    // The order knows nothing of the catalog, and must not: nothing leaves a
    // device, or stops opening, because the library stopped offering it.
    expect(openingOrder('cuvs', ['kjv', 'cuvs'])[0]).toBe('cuvs');
  });

  test('nothing is tried twice', () => {
    expect(openingOrder('kjv', ['kjv', 'bsb'])).toEqual(['kjv', 'bsb']);
  });
});
