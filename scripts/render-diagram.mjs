// Renders scripts/architecture-diagram.html to public/images/projects/portfolio/architecture.jpg
// (600 CSS px wide, captured at 2x). Then run `pnpm run images` for the WebP variants:
//   node scripts/render-diagram.mjs
import { chromium } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 600, height: 800 }, deviceScaleFactor: 2 });
await page.goto(pathToFileURL(path.resolve('scripts/architecture-diagram.html')).href);
await page.evaluate(() => document.fonts.ready);
await page.screenshot({
  path: 'public/images/projects/portfolio/architecture.jpg',
  type: 'jpeg',
  quality: 90,
  fullPage: true,
});
await browser.close();
console.log('wrote public/images/projects/portfolio/architecture.jpg');
