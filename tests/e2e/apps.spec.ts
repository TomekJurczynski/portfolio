import { expect, test } from '@playwright/test';
import { mockReply, openChat, sendMessage } from './helpers';

// The long-form cards (this site, the n8n workflow) collapse like the phone-app cards and open
// their images in an in-page lightbox instead of a new tab.
for (const id of ['portfolio', 'n8n-image-pipeline']) {
  test.describe(`featured card — ${id}`, () => {
    test('is collapsed by default and the toggle expands / collapses the write-up', async ({ page }) => {
      await page.goto('/');
      const card = page.locator(`#app-${id}`);
      const toggle = card.locator('.details-toggle');
      const details = card.locator('.details');
      await expect(toggle).toHaveAttribute('aria-expanded', 'false');
      await expect(details).toBeHidden();
      await toggle.click();
      await expect(toggle).toHaveAttribute('aria-expanded', 'true');
      await expect(details).toBeVisible();
      await toggle.click();
      await expect(details).toBeHidden();
    });

    test('image opens in a lightbox; Esc and a click outside the image close it without moving the page', async ({
      page,
    }) => {
      await page.goto('/');
      const card = page.locator(`#app-${id}`);
      await card.scrollIntoViewIfNeeded();
      const lightbox = page.locator('#lightbox');

      await card.locator('.media-link').first().click();
      await expect(lightbox).toBeVisible();
      // Measured once the lightbox is open (the click may itself scroll the thumbnail into view).
      const before = await page.evaluate(() => window.scrollY);
      await expect(lightbox.locator('.lightbox-img')).toHaveAttribute('src', /\/images\/projects\/.+\.jpg$/);
      await expect(lightbox.locator('.lightbox-img')).not.toHaveAttribute('alt', '');

      await page.keyboard.press('Escape');
      await expect(lightbox).toBeHidden();
      expect(await page.evaluate(() => window.scrollY)).toBe(before);

      await card.locator('.media-link').first().click();
      await expect(lightbox).toBeVisible();
      await lightbox.click({ position: { x: 4, y: 200 } }); // dimmed area, well outside the picture
      await expect(lightbox).toBeHidden();
      expect(await page.evaluate(() => window.scrollY)).toBe(before);
    });
  });
}

test('the close button also closes the lightbox', async ({ page }) => {
  await page.goto('/');
  await page.locator('#app-portfolio .media-link').first().click();
  await expect(page.locator('#lightbox')).toBeVisible();
  await page.locator('#lightbox .lightbox-close').click();
  await expect(page.locator('#lightbox')).toBeHidden();
});

test('{{nav:app-portfolio}} expands the featured card', async ({ page }) => {
  await mockReply(page, ['This site is covered here. {{nav:app-portfolio}}']);
  await page.goto('/');
  await openChat(page);
  await sendMessage(page, 'Tell me about this site');
  await expect(page.locator('#app-portfolio .details-toggle')).toHaveAttribute('aria-expanded', 'true');
});
