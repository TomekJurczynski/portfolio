import { expect, test } from '@playwright/test';
import { chatPanel, mockReply, openChat, sendMessage } from './helpers';

test.describe('site — language', () => {
  test('the language switch goes EN -> PL and back, keeping the section hash', async ({ page }) => {
    await page.goto('/#apps');
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await page.locator('#lang-switch-link').click();
    await expect(page).toHaveURL(/\/pl\/#apps$/);
    await expect(page.locator('html')).toHaveAttribute('lang', 'pl');
    await page.locator('#lang-switch-link').click();
    await expect(page).toHaveURL(/localhost:\d+\/#apps$/);
  });

  test('the Polish page has a Polish chat that sends uiLang=pl', async ({ page }) => {
    const { requests } = await mockReply(page, ['Cześć!']);
    await page.goto('/pl/');
    await openChat(page);
    await expect(chatPanel(page)).toContainText('Przewodnik po portfolio');
    await sendMessage(page, 'Cześć');
    await expect(chatPanel(page).getByRole('log')).toContainText('Cześć!');
    expect((requests[0] as { uiLang: string }).uiLang).toBe('pl');
  });
});

test.describe('site — mobile menu', () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile', 'hamburger menu is mobile-only');
  });

  test('opens as a dialog, navigates, and closes', async ({ page }) => {
    await page.goto('/');
    const toggle = page.locator('#menu-toggle');
    await toggle.click();
    const menu = page.locator('#mobile-menu');
    await expect(menu).toBeVisible();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');

    await menu.getByRole('link', { name: 'Contact' }).click();
    await expect(menu).toBeHidden();
    await expect(page).toHaveURL(/#contact$/);
  });

  test('Esc closes the menu and restores focus to the toggle', async ({ page }) => {
    await page.goto('/');
    await page.locator('#menu-toggle').click();
    await page.keyboard.press('Escape');
    await expect(page.locator('#mobile-menu')).toBeHidden();
    await expect(page.locator('#menu-toggle')).toBeFocused();
  });
});

test.describe('site — theme', () => {
  test('defaults to dark and the toggle persists light across reload', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await page.locator('#theme-toggle').click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  });
});

test('every desktop nav link scrolls to an existing section', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'mobile', 'desktop nav is hidden on mobile');
  await page.goto('/');
  for (const id of ['about', 'apps', 'cv', 'contact']) {
    await page.locator(`.nav--desktop [data-nav-link="${id}"]`).click();
    await expect(page).toHaveURL(new RegExp(`#${id}$`));
  }
});
