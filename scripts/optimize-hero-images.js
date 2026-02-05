/**
 * Optimizes hero images in public/ for web: max width 1920px, WebP quality ~82.
 * Run before deploy: npm run optimize:hero
 * Requires: npm install --save-dev sharp
 */

import { stat, writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const publicDir = join(__dirname, '..', 'public');
const heroOutDir = join(publicDir, 'hero');
const MAX_WIDTH = 1920;
const WEBP_QUALITY = 82;

async function optimizeHeroImages() {
  let sharp;
  try {
    sharp = (await import('sharp')).default;
  } catch {
    console.error('Missing dependency: run  npm install --save-dev sharp');
    process.exit(1);
  }

  await mkdir(heroOutDir, { recursive: true });

  const heroGlob = ['clr-lake-ducie.webp', 'clr-sign.webp', 'clr-tree.webp'];
  for (const name of heroGlob) {
    const inputPath = join(publicDir, name);
    const outputPath = join(heroOutDir, name);
    try {
      const s = await stat(inputPath);
      const beforeKiB = (s.size / 1024).toFixed(1);
      const img = sharp(inputPath);
      const meta = await img.metadata();
      const width = meta.width || 0;
      const needResize = width > MAX_WIDTH;

      const pipeline = needResize
        ? img.resize(MAX_WIDTH, null, { withoutEnlargement: true })
        : img;

      const outBuf = await pipeline
        .webp({ quality: WEBP_QUALITY, effort: 6 })
        .toBuffer();

      const afterKiB = (outBuf.length / 1024).toFixed(1);
      await writeFile(outputPath, outBuf);
      console.log(`${name}: ${beforeKiB} KiB → ${afterKiB} KiB → public/hero/${name}${needResize ? ' (resized)' : ''}`);
    } catch (err) {
      if (err.code === 'ENOENT') {
        console.warn(`Skip ${name}: file not found in public/`);
      } else {
        throw err;
      }
    }
  }
  console.log('\nHero images in public/hero/ are used by the site (see src/config/hero.ts).');
}

optimizeHeroImages().catch((err) => {
  console.error(err);
  process.exit(1);
});
