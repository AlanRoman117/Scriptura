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
  // The @scriptura/* packages emit CommonJS (NodeNext with no "type": "module").
  // Rollup's commonjs plugin converts that during `vite build`, but the dev
  // server does not pre-bundle *linked* workspace dependencies by default — it
  // served dist/bible.js raw, and the browser rejected it with "does not
  // provide an export named 'createBible'". Listing the subpaths forces Vite to
  // pre-bundle them to ESM, so dev and production consume the same artefacts.
  //
  // The lasting fix is emitting ESM from the packages; that is a workspace-wide
  // change and is tracked separately.
  optimizeDeps: {
    include: [
      '@scriptura/core/bible',
      '@scriptura/core/books',
      '@scriptura/search/matcher',
      '@scriptura/compare/chapters',
    ],
  },
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
