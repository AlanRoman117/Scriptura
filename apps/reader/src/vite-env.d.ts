/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  /**
   * Where the JSON API lives. Defaults to `/api`, which a same-origin
   * deployment or the dev proxy answers; set it to a CDN origin to read the
   * static tree directly.
   */
  readonly VITE_SCRIPTURA_API?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
