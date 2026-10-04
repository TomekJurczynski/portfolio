import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { chatPanel, mockReply, openChat, sendMessage } from './helpers';

// `astro preview` doesn't serve dist/_headers, so replay the production CSP that
// scripts/build-csp.mjs generated onto every document response and fail on any violation.
// `pnpm dev` deletes dist/_headers (see scripts/rm-dist-headers.mjs); regenerate it from the current dist/.
if (!existsSync('dist/_headers')) execFileSync('node', ['scripts/build-csp.mjs']);
const csp = /Content-Security-Policy: (.+)/.exec(readFileSync('dist/_headers', 'utf8'))?.[1];

async function withCsp(page: Page): Promise<string[]> {
  const violations: string[] = [];
  page.on('console', (msg) => {
    if (/Content Security Policy/i.test(msg.text())) violations.push(msg.text());
  });
  page.on('pageerror', (err) => violations.push(err.message));
  await page.route('**/*', async (route) => {
    if (route.request().resourceType() !== 'document') return route.fallback();
    const response = await route.fetch();
    await route.fulfill({ response, headers: { ...response.headers(), 'content-security-policy': csp! } });
  });
  return violations;
}

test('CSP file was generated', () => {
  expect(csp).toBeTruthy();
  expect(csp).not.toContain("'unsafe-inline'");
  expect(csp).not.toContain("'unsafe-eval'");
});

for (const path of ['/', '/pl/', '/privacy/', '/pl/privacy/', '/does-not-exist/']) {
  test(`no CSP violations on ${path}`, async ({ page }) => {
    const violations = await withCsp(page);
    await page.goto(path);
    const toggle = page.locator('#theme-toggle');
    if (await toggle.count()) await toggle.click();
    await page.waitForLoadState('networkidle');
    expect(violations).toEqual([]);
  });
}

test('no CSP violations with the chat open and a streamed reply', async ({ page }) => {
  const violations = await withCsp(page);
  await mockReply(page, ['Hello ', 'there.']);
  await page.goto('/');
  await openChat(page);
  await sendMessage(page, 'Hi');
  await expect(chatPanel(page)).toContainText('Hello there.');
  expect(violations).toEqual([]);
});
