// Post-build step (run after `astro build`): node scripts/build-csp.mjs
// Netlify headers are static, but Astro emits inline <script>/<style> blocks whose content can
// change between builds. So instead of 'unsafe-inline' we hash every inline block found in
// dist/**/*.html and write the resulting Content-Security-Policy to dist/_headers.
// (JSON-LD <script type="application/ld+json"> is data, not executed, so it needs no hash.)
import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const DIST = 'dist';

async function walk(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await walk(full)));
    else if (entry.name.endsWith('.html')) out.push(full);
  }
  return out;
}

const hash = (content) => `'sha256-${createHash('sha256').update(content).digest('base64')}'`;

const scriptHashes = new Set();
const styleHashes = new Set();
let inlineAttrs = 0;

for (const file of await walk(DIST)) {
  const html = await readFile(file, 'utf8');
  for (const m of html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)) {
    const [, attrs, body] = m;
    if (/\bsrc=/.test(attrs) || /type="application\/ld\+json"/.test(attrs) || !body.trim()) continue;
    scriptHashes.add(hash(body));
  }
  for (const m of html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)) {
    if (m[1].trim()) styleHashes.add(hash(m[1]));
  }
  inlineAttrs += (html.match(/\sstyle="/g) ?? []).length;
}

if (inlineAttrs > 0) {
  console.error(`build-csp: ${inlineAttrs} inline style="" attribute(s) found in dist — the CSP has no 'unsafe-inline' for styles. Use a class instead.`);
  process.exit(1);
}

const csp = [
  "default-src 'self'",
  "img-src 'self' data:",
  `style-src 'self' ${[...styleHashes].join(' ')}`.trim(),
  `script-src 'self' ${[...scriptHashes].join(' ')}`.trim(),
  "connect-src 'self'",
  "media-src 'self' blob: data:",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');

await writeFile(path.join(DIST, '_headers'), `/*\n  Content-Security-Policy: ${csp}\n`);
console.log(`build-csp: wrote dist/_headers (${scriptHashes.size} script hash(es), ${styleHashes.size} style hash(es))`);
