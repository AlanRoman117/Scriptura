import { defineConfig } from 'vite';
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

export default defineConfig({
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
    VitePWA({
      registerType: 'autoUpdate',
      // The bundled translation is deliberately NOT precached. It is ~4.4MB, so
      // putting it in the precache manifest would block service-worker install
      // on a large download and re-download the whole thing whenever its hash
      // changed. The app fetches it once into IndexedDB instead, with progress.
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,woff2}'],
        globIgnores: ['**/bible/**'],
        navigateFallback: 'index.html',
      },
      manifest: {
        name: 'Scriptura Reader',
        short_name: 'Scriptura',
        description: 'Local-first Bible reading and note-taking.',
        theme_color: '#1a1a1a',
        background_color: '#faf9f7',
        display: 'standalone',
        start_url: '/',
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
