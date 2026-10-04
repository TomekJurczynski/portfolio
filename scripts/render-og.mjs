// Renders scripts/og-cover.html to public/og/cover.png (1200x630).
import { chromium } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
await page.goto(pathToFileURL(path.resolve('scripts/og-cover.html')).href);
await page.screenshot({ path: 'public/og/cover.png' });
await browser.close();
console.log('wrote public/og/cover.png');
