/**
 * Which Bible a device opens on.
 *
 * ⚠️ Kept free of React, the DOM and `import.meta`, so jest can test it.
 */

/**
 * The translation bundled with the app for immediate offline use.
 *
 * The King James Version: the one a reader of the Bible in English, Baptists
 * above all, is most likely to know by name. Also written in
 * apps/reader/scripts/bundle-translation.mjs, which has to run without a build.
 */
export const DEFAULT_TRANSLATION = 'kjv';

/**
 * What every device opened on until 2026-11. Such a device holds this text, and
 * has no stored choice unless its reader ever switched, so its absence alone
 * would change the Bible under someone mid-study. Offline it was worse: the new
 * default is not on the device, and the error screen hid the Bible that was.
 */
const PREVIOUS_DEFAULT = 'bsb';

/**
 * What to try, in order, until one loads.
 *
 * The reader's choice; else the Bible this device has been reading all along;
 * else the default. Then the default, and last anything else on the device,
 * since offline a default that was never stored cannot load, and the app must
 * always have something to read.
 */
export function openingOrder(active: string | undefined, installed: readonly string[]): string[] {
  const first = active ?? (installed.includes(PREVIOUS_DEFAULT) ? PREVIOUS_DEFAULT : DEFAULT_TRANSLATION);
  return [...new Set([first, DEFAULT_TRANSLATION, ...installed])];
}
