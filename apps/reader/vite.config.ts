import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

/**
 * Where `/api` goes in dev and preview.
 *
 * The reader downloads additional translations from `/translations/:id/full.json`,
 * which the running API serves (the router accepts the `.json` suffix precisely
 * so one URL works against a local server and the static CDN tree alike).
 * `npm run dev:api` listens on 3000; the Playwright reader project points this
 * at the compiled server it already starts for the contract suite.
 */
const API_ORIGIN = process.env.SCRIPTURA_API_ORIGIN ?? 'http://127.0.0.1:3000';
const proxy = {
  '/api': {
    target: API_ORIGIN,
    changeOrigin: true,
    rewrite: (path: string) => path.replace(/^\/api/, ''),
  },
};

/**
 * Where the app is served from: `/`, except for a site published under a path
 * — GitHub Pages serves this repository at `/Scriptura/`, and
 * scripts/build-site.mjs sets it. The bundled Bible, the catalog and the API
 * all resolve against it (`import.meta.env.BASE_URL`), and so must the
 * manifest: a `start_url` of `/` would open the account's root site instead.
 */
const trimmedBase = (process.env.SCRIPTURA_BASE ?? '').replace(/^\/+|\/+$/g, '');
const BASE = trimmedBase ? `/${trimmedBase}/` : '/';

/**
 * A build for the translation reviewers (scripts/build-site.mjs --preview).
 *
 * GitHub Pages cannot put a site behind a password, so a preview asks search
 * engines to leave it out. A meta tag rather than robots.txt: a crawler reads
 * robots.txt only at the root of the host, and this site lives under a path.
 */
const PREVIEW = process.env.VITE_SCRIPTURA_PREVIEW === '1';
const noindex: Plugin = {
  name: 'scriptura-preview-noindex',
  transformIndexHtml: () =>
    PREVIEW ? [{ tag: 'meta', attrs: { name: 'robots', content: 'noindex, nofollow' }, injectTo: 'head' }] : [],
};

export default defineConfig({
  base: BASE,
  // No `optimizeDeps.include` here, and that is the point.
  //
  // The @scriptura/* packages used to emit CommonJS, which `vite build`
  // converted through Rollup while the dev server served raw — so dev rejected
  // `dist/bible.js` with "does not provide an export named 'createBible'" while
  // every production test passed. Listing each subpath forced Vite to
  // pre-bundle them, which worked but had to be remembered for every new
  // subpath: `@scriptura/compare/chapters` was forgotten and broke dev alone.
  //
  // The packages emit ESM now, so the browser reads them directly and dev and
  // production resolve them the same way. `tests/reader-dev/` still guards it.
  plugins: [
    react(),
    noindex,
    VitePWA({
      // A new build waits until the reader says so (components/UpdateNotice).
      // `autoUpdate` skipped waiting and took the open page the moment a build
      // was fetched — mid-edit, with up to 600ms of typing not yet saved.
      registerType: 'prompt',
      // The bundled translation is deliberately NOT precached. It is ~4.4MB, so
      // putting it in the precache manifest would block service-worker install
      // on a large download and re-download the whole thing whenever its hash
      // changed. The app fetches it once into IndexedDB instead, with progress.
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,woff2}'],
        globIgnores: ['**/bible/**'],
        navigateFallback: 'index.html',
        // On a first visit there is no page to interrupt, so the new worker
        // takes control at once and the app works offline from then on. An
        // update still waits: a worker only activates after the reader's
        // Reload asks it to skip waiting, and claims the page then.
        clientsClaim: true,
      },
      manifest: {
        name: 'Scriptura Reader',
        // The manifest's own text is English; tagged the way the app tags it.
        lang: 'en-US',
        dir: 'ltr',
        short_name: 'Scriptura',
        description: 'Local-first Bible reading and note-taking.',
        theme_color: '#1a1a1a',
        background_color: '#faf9f7',
        display: 'standalone',
        // Stated rather than assumed (1.3.4): nothing here needs a fixed orientation.
        orientation: 'any',
        start_url: BASE,
        scope: BASE,
        icons: [
          { src: 'icons/icon-192.svg', sizes: '192x192', type: 'image/svg+xml' },
          { src: 'icons/icon-512.svg', sizes: '512x512', type: 'image/svg+xml', purpose: 'any maskable' },
        ],
      },
      devOptions: { enabled: true, type: 'module' },
    }),
  ],
  server: { port: 5173, proxy },
  preview: { proxy },
});
