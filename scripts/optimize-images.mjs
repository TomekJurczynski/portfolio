// Generates resized WebP variants of the app screenshots next to the source JPEGs:
//   public/images/projects/<app>/<name>.jpg  ->  <name>-360.webp, <name>-720.webp
// Content frontmatter keeps pointing at the .jpg (fallback + stable ids); AppCard.astro
// derives the srcset from that path. Re-run after adding/changing a screenshot:
//   node scripts/optimize-images.mjs
import sharp from 'sharp';
import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';

const ROOT = 'public/images/projects';
// Phone screenshots (1080 px wide) get 360/720; wide diagrams (workflow screenshot) also get 1120.
const WIDTHS = [360, 720, 1120];
// Flat-colour text diagrams survive a lower quality; the tall architecture diagram needs it to stay in budget.
const QUALITY = { 'architecture.jpg': 64 };

let totalIn = 0;
let totalOut = 0;
for (const app of await readdir(ROOT)) {
  const dir = path.join(ROOT, app);
  if (!(await stat(dir)).isDirectory()) continue;
  for (const file of await readdir(dir)) {
    if (!file.endsWith('.jpg')) continue;
    const src = path.join(dir, file);
    totalIn += (await stat(src)).size;
    const { width: sourceWidth } = await sharp(src).metadata();
    for (const width of WIDTHS.filter((w) => w <= sourceWidth)) {
      const out = path.join(dir, file.replace(/\.jpg$/, `-${width}.webp`));
      await sharp(src).resize({ width }).webp({ quality: QUALITY[file] ?? 78 }).toFile(out);
      totalOut += (await stat(out)).size;
    }
  }
}
console.log(`JPEG sources: ${(totalIn / 1024).toFixed(0)} KB, WebP variants: ${(totalOut / 1024).toFixed(0)} KB`);
