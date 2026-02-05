/**
 * Post-build: make only the second _assets stylesheet on index.html non-render-blocking.
 * Keeping the first stylesheet blocking ensures full layout at first paint and avoids CLS.
 * Deferring both caused body/hero shift (0.5–0.8) when full CSS loaded. Run after: npm run build
 */

import { readFile, writeFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const indexPath = join(__dirname, '..', 'dist', 'index.html');

const html = await readFile(indexPath, 'utf8');

const re = /<link rel="stylesheet" href="(\/_assets\/[^"]+\.css)"\s*>/g;
let count = 0;
const newHtml = html.replace(re, (full, href) => {
  count++;
  if (count === 2) {
    return `<link rel="stylesheet" href="${href}" media="print" onload="this.media='all'">`;
  }
  return full;
});

if (newHtml !== html) {
  await writeFile(indexPath, newHtml);
  console.log('Deferred second stylesheet on index.html (non-render-blocking).');
}
