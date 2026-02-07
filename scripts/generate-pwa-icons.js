/**
 * Generate PWA icons (192x192, 512x512) from public/favicon.svg.
 * Run: node scripts/generate-pwa-icons.js
 * Requires: sharp (npm install)
 */
import { readFileSync, mkdirSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const publicDir = join(root, 'public');
const iconsDir = join(publicDir, 'icons');
const faviconPath = join(publicDir, 'favicon.svg');

if (!existsSync(faviconPath)) {
  console.warn('favicon.svg not found; skipping PWA icon generation.');
  process.exit(0);
}

let sharp;
try {
  sharp = (await import('sharp')).default;
} catch {
  console.warn('sharp not found. Run: npm install sharp. Skipping PWA icons.');
  process.exit(0);
}

mkdirSync(iconsDir, { recursive: true });
const svg = readFileSync(faviconPath);

for (const size of [192, 512]) {
  const out = join(iconsDir, `${size}.png`);
  await sharp(svg).resize(size, size).png().toFile(out);
  console.log(`Wrote ${out}`);
}
