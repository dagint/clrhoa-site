/**
 * Post-build: make the second _assets stylesheet on index.html non-render-blocking.
 * Deferring only the second keeps one CSS file blocking so initial layout is correct (avoids CLS).
 * Deferring both caused large layout shift when CSS loaded. Run after: npm run build
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
