// Size budgets for the built site (run after `astro build`): node scripts/check-budgets.mjs
// Limits are gzip bytes for text assets, raw bytes for binary ones. Set with ~25% headroom over
// the T18 baseline so a regression (new heavy dependency, unoptimized image) fails CI.
import { readdir, readFile, stat } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import path from 'node:path';

const DIST = 'dist';
const KB = 1024;

const budgets = [
  { name: 'JavaScript (total, gzip)', match: /\.js$/, dir: '_astro', total: true, max: 100 * KB, gzip: true },
  { name: 'CSS (total, gzip)', match: /\.css$/, dir: '_astro', total: true, max: 8 * KB, gzip: true },
  { name: 'Fonts (each, woff2)', match: /\.woff2$/, dir: '_astro', max: 90 * KB },
  { name: 'Images 360/720 (each, webp)', match: /-(360|720)\.webp$/, dir: 'images', max: 60 * KB },
  // Only the wide diagrams (workflow, architecture) have a 1120 px variant; text-heavy, so heavier.
  { name: 'Images 1120 (each, webp)', match: /-1120\.webp$/, dir: 'images', max: 100 * KB },
  { name: 'HTML pages (each, gzip)', match: /\.html$/, dir: '.', max: 20 * KB, gzip: true },
];

async function walk(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await walk(full)));
    else out.push(full);
  }
  return out;
}

async function sizeOf(file, gzip) {
  return gzip ? gzipSync(await readFile(file)).length : (await stat(file)).size;
}

let failed = false;
for (const b of budgets) {
  const files = (await walk(path.join(DIST, b.dir))).filter((f) => b.match.test(f));
  const sizes = await Promise.all(files.map(async (f) => ({ f, size: await sizeOf(f, b.gzip) })));
  const measured = b.total
    ? [{ f: `${files.length} files`, size: sizes.reduce((sum, s) => sum + s.size, 0) }]
    : sizes;
  for (const { f, size } of measured) {
    const ok = size <= b.max;
    if (!ok) failed = true;
    if (!ok || b.total) console.log(`${ok ? 'ok  ' : 'FAIL'} ${b.name}: ${(size / KB).toFixed(1)} KB / ${b.max / KB} KB ${ok ? '' : `(${f})`}`);
  }
  if (!b.total) console.log(`ok   ${b.name}: ${files.length} files, largest ${(Math.max(0, ...sizes.map((s) => s.size)) / KB).toFixed(1)} KB / ${b.max / KB} KB`);
}
process.exit(failed ? 1 : 0);
