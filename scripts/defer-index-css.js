/**
 * Post-build: make all _assets stylesheets on index.html non-render-blocking.
 * Astro injects about + emergency-contacts CSS into the index page; we defer
 * both so no CSS blocks render (LCP is the hero image, which doesn't need CSS).
 * Run after: npm run build
 */

import { readFile, writeFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const indexPath = join(__dirname, '..', 'dist', 'index.html');

const html = await readFile(indexPath, 'utf8');

const re = /<link rel="stylesheet" href="(\/_assets\/[^"]+\.css)"\s*>/g;
const hrefs = [];
const deferred = html.replace(re, (full, href) => {
  hrefs.push(href);
  return `<link rel="stylesheet" href="${href}" media="print" onload="this.media='all'">`;
});

// Noscript fallback so no-JS users still get styles
const noscript = hrefs.length
  ? `<noscript>${hrefs.map((h) => `<link rel="stylesheet" href="${h}">`).join('')}</noscript>`
  : '';
const newHtml = deferred.replace('</head>', `${noscript}</head>`);

if (newHtml !== html) {
  await writeFile(indexPath, newHtml);
  console.log('Deferred all stylesheets on index.html (non-render-blocking).');
}
