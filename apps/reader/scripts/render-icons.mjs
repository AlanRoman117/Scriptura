#!/usr/bin/env node
/**
 * Render the app's PNG icons from public/icons/icon-512.svg.
 *
 * The SVG is the source; the PNGs exist because iOS takes only a PNG
 * apple-touch-icon, and Android wants a separate maskable icon whose artwork
 * sits in the safe zone of whatever shape the launcher cuts. They are
 * committed, like the SVGs, so a checkout without a browser still builds:
 * run this only after changing the SVG (`npm run icons --workspace
 * @scriptura/reader`). It uses Playwright's Chromium, already a dev
 * dependency, so nothing new is installed.
 *
 *   icon-192.png, icon-512.png  purpose "any": the artwork as drawn, rounded
 *                               corners and all, on transparency.
 *   icon-180.png                apple-touch-icon: full bleed and square. iOS
 *                               rounds the corners itself and fills
 *                               transparency with black.
 *   icon-512-maskable.png       purpose "maskable": full-bleed background,
 *                               artwork scaled to 80 %, well inside the
 *                               safe circle (a radius of 40 % of the icon).
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const ICONS = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons');
const source = readFileSync(join(ICONS, 'icon-512.svg'), 'utf8');

// The SVG is a rounded dark square (its first <rect>) with the artwork over it.
const plate = source.match(/<rect\b[^>]*\brx="[^"]*"[^>]*\/>/);
if (!plate) throw new Error('icon-512.svg: expected a rounded <rect> as its first shape');
const fill = plate[0].match(/fill="([^"]+)"/)?.[1] ?? '#1a1a1a';
const artwork = source.slice(source.indexOf(plate[0]) + plate[0].length, source.lastIndexOf('</svg>'));

const svg = (body) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="100%" height="100%">${body}</svg>`;
const asDrawn = svg(plate[0] + artwork);
const fullBleed = svg(`<rect width="512" height="512" fill="${fill}"/>${artwork}`);
const maskable = svg(`<rect width="512" height="512" fill="${fill}"/><g transform="translate(51.2 51.2) scale(.8)">${artwork}</g>`);

const outputs = [
  ['icon-192.png', 192, asDrawn, true],
  ['icon-512.png', 512, asDrawn, true],
  ['icon-180.png', 180, fullBleed, false],
  ['icon-512-maskable.png', 512, maskable, false],
];

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ deviceScaleFactor: 1 });
  for (const [name, size, markup, transparent] of outputs) {
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(
      `<!doctype html><html><body style="margin:0;background:transparent;width:${size}px;height:${size}px">${markup}</body></html>`
    );
    await page.screenshot({ path: join(ICONS, name), omitBackground: transparent, clip: { x: 0, y: 0, width: size, height: size } });
    console.log(`icons: ${name} (${size}×${size})`);
  }
} finally {
  await browser.close();
}
