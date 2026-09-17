/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />
/// <reference types="vite-plugin-pwa/react" />

interface ImportMetaEnv {
  /**
   * Where the JSON API lives. Defaults to `api` beside the app, which a
   * same-origin deployment or the dev proxy answers; set it to a CDN origin to
   * read the static tree directly.
   */
  readonly VITE_SCRIPTURA_API?: string;
  /** `1` in a build for the translation reviewers (scripts/build-site.mjs --preview). */
  readonly VITE_SCRIPTURA_PREVIEW?: string;
  /** The version and commit a published build was made from, e.g. `0.1.0 (abc1234)`. */
  readonly VITE_SCRIPTURA_VERSION?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
