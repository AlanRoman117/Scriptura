/**
 * A build for the translation reviewers (scripts/build-site.mjs --preview).
 *
 * Such a build says what it is and where corrections go (PreviewNotice, and
 * the first section of Help). Everything else is the app as it will ship.
 */

/** True in a build made for the translation reviewers. */
export const PREVIEW: boolean = import.meta.env.VITE_SCRIPTURA_PREVIEW === '1';

/** The version and commit the build was made from; empty when the build did not say. */
export const VERSION: string = import.meta.env.VITE_SCRIPTURA_VERSION ?? '';

/**
 * "Hide" on the notice, remembered for this device and this version: a new
 * preview is news, so it shows the notice once more. A preference of the
 * device, like the Bible offer's "Not now", so it lives in localStorage —
 * which may be missing or refuse, and then the notice simply shows again.
 */
const HIDDEN_KEY = 'scriptura-preview-hidden';

export function previewHidden(version: string): boolean {
  try {
    return localStorage.getItem(HIDDEN_KEY) === version;
  } catch {
    return false;
  }
}

export function hidePreview(version: string): void {
  try {
    localStorage.setItem(HIDDEN_KEY, version);
  } catch {
    // Not remembered; it is only a notice.
  }
}
