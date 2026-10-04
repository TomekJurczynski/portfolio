import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { chatPanel, mockReply, openChat, sendMessage } from './helpers';

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

async function audit(page: Page) {
  const { violations } = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  // Readable failure output: rule, impact, and the offending selectors.
  const summary = violations.map((v) => ({
    rule: v.id,
    impact: v.impact,
    nodes: v.nodes.map((n) => n.target.join(' ')),
  }));
  expect(summary).toEqual([]);
}

async function setLight(page: Page) {
  await page.locator('#theme-toggle').click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
}

for (const path of ['/', '/pl/']) {
  test.describe(`a11y — ${path}`, () => {
    test('dark theme (default)', async ({ page }) => {
      await page.goto(path);
      await audit(page);
    });

    test('light theme', async ({ page }) => {
      await page.goto(path);
      await setLight(page);
      await audit(page);
    });

    test('chat panel open with a conversation (dark)', async ({ page }) => {
      await mockReply(page, ['Hello! I can tell you about the apps.']);
      await page.goto(path);
      await openChat(page);
      await sendMessage(page, 'Hi');
      await expect(chatPanel(page).getByRole('log')).toContainText('Hello');
      await audit(page);
    });

    test('chat panel open (light)', async ({ page }) => {
      await page.goto(path);
      await setLight(page);
      await openChat(page);
      await audit(page);
    });
  });
}
