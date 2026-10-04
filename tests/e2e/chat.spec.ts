import { expect, test } from '@playwright/test';
import {
  chatPanel,
  mockInterruptedReply,
  mockNetworkFailure,
  mockReply,
  mockStatus,
  openChat,
  sendMessage,
} from './helpers';

test.describe('chat — happy path', () => {
  test('never shows Markdown syntax, even when it is split across stream chunks', async ({ page }) => {
    await mockReply(page, ['**Zawodowo (Cons', 'data):** React, ', 'TypeScript.\n- Astro\n* Claude API']);
    await page.goto('/');
    await openChat(page);
    await sendMessage(page, 'Stack?');

    const log = chatPanel(page).getByRole('log');
    await expect(log).toContainText('Zawodowo (Consdata): React, TypeScript.');
    await expect(log).toContainText('Claude API');
    const text = (await log.innerText()).replace(/\s+/g, ' ');
    expect(text).not.toMatch(/[*`#]/);
    expect(text).not.toContain('- Astro');
  });

  test('opens from the launcher and from the hero CTA, closes with the button', async ({ page }) => {
    await page.goto('/');
    await openChat(page);
    await expect(chatPanel(page).locator('textarea')).toBeFocused();
    await chatPanel(page).getByRole('button', { name: 'Close', exact: true }).click();
    await expect(chatPanel(page)).toBeHidden();

    await page.locator('[data-chat-cta]').first().click();
    await expect(chatPanel(page)).toBeVisible();
  });

  test('sends a message, streams the reply and sends the right payload', async ({ page }) => {
    const { requests } = await mockReply(page, ['Tomasz builds ', 'AI apps.']);
    await page.goto('/');
    await openChat(page);
    await sendMessage(page, 'What does he build?');

    const log = chatPanel(page).getByRole('log');
    await expect(log).toContainText('What does he build?');
    await expect(log).toContainText('Tomasz builds AI apps.');
    await expect(chatPanel(page).locator('.chat-input__send--stop')).toBeHidden();

    expect(requests).toHaveLength(1);
    expect(requests[0]).toEqual({
      messages: [{ role: 'user', content: 'What does he build?' }],
      uiLang: 'en',
    });
  });

  test('suggestion chips send a question', async ({ page }) => {
    await mockReply(page, ['Sure.']);
    await page.goto('/');
    await openChat(page);
    await chatPanel(page).locator('.chat-suggestion-chip').first().click();
    await expect(chatPanel(page).getByRole('log')).toContainText('Sure.');
  });

  test('history survives a reload and "New conversation" clears it', async ({ page }) => {
    await mockReply(page, ['Hello there.']);
    await page.goto('/');
    await openChat(page);
    await sendMessage(page, 'Hi');
    await expect(chatPanel(page).getByRole('log')).toContainText('Hello there.');

    await page.reload();
    await openChat(page);
    await expect(chatPanel(page).getByRole('log')).toContainText('Hello there.');

    await chatPanel(page).getByRole('button', { name: 'New conversation' }).click();
    await expect(chatPanel(page).getByRole('log')).not.toContainText('Hello there.');
    await expect(chatPanel(page).locator('.chat-empty')).toBeVisible();
  });

  test('history sent to the server is capped at 8 messages', async ({ page }) => {
    const { requests } = await mockReply(page, ['ok']);
    await page.goto('/');
    await openChat(page);
    for (let i = 1; i <= 6; i++) {
      await sendMessage(page, `question ${i}`);
      await expect(chatPanel(page).getByRole('log')).toContainText('ok');
      await expect(chatPanel(page).locator('.chat-input__send')).toBeVisible();
    }
    const last = requests[requests.length - 1] as { messages: unknown[] };
    expect(last.messages).toHaveLength(8);
  });
});

test.describe('chat — action markers', () => {
  test('{{link}} becomes a whitelisted chip, markers never show as text (even split across chunks)', async ({
    page,
  }) => {
    await mockReply(page, ['Write to him: {{li', 'nk:email}} anytime.']);
    await page.goto('/');
    await openChat(page);
    await sendMessage(page, 'How do I contact him?');

    const log = chatPanel(page).getByRole('log');
    await expect(log).toContainText('Write to him:');
    await expect(log).not.toContainText('{{');
    const chip = log.locator('.chat-action-chip', { hasText: 'Email' });
    await expect(chip).toHaveAttribute('href', /^mailto:/);
  });

  test('an unknown action id is dropped, not rendered', async ({ page }) => {
    await mockReply(page, ['Here you go. {{link:evil}} {{nav:nowhere}}']);
    await page.goto('/');
    await openChat(page);
    await sendMessage(page, 'link please');
    const log = chatPanel(page).getByRole('log');
    await expect(log).toContainText('Here you go.');
    await expect(log.locator('.chat-action-chip')).toHaveCount(0);
  });

  test('{{nav}} auto-scrolls the page to the section', async ({ page }) => {
    await mockReply(page, ['Take a look at the apps. {{nav:apps}}']);
    await page.goto('/');
    await openChat(page);
    await sendMessage(page, 'Show me the apps');

    await expect(page).toHaveURL(/#apps$/);
    await expect
      .poll(async () =>
        page.evaluate(() => Math.round(document.getElementById('apps')?.getBoundingClientRect().top ?? 9999)),
      )
      .toBeLessThan(200);
  });

  test('{{nav:app-*}} expands the app card', async ({ page }) => {
    await mockReply(page, ['This one. {{nav:app-lexicon}}']);
    await page.goto('/');
    await openChat(page);
    await sendMessage(page, 'Tell me about Lexicon');
    // Not asserting the URL hash: Header's section observer rewrites it to #apps once the card scrolls into view.
    await expect(page.locator('#app-lexicon .details-toggle')).toHaveAttribute('aria-expanded', 'true');
    await expect(page.locator('#app-lexicon')).toBeInViewport();
  });
});

test.describe('chat — errors', () => {
  test('429 locks the input and shows the rate-limit message', async ({ page }) => {
    await mockStatus(page, 429, { 'Retry-After': '30' });
    await page.goto('/');
    await openChat(page);
    await sendMessage(page, 'hello');
    await expect(chatPanel(page).getByRole('alert')).toContainText('Too many messages');
    await expect(chatPanel(page).locator('textarea')).toBeDisabled();
    await expect(chatPanel(page).getByRole('link', { name: 'Email directly' })).toHaveAttribute(
      'href',
      /^mailto:/,
    );
  });

  test('503 disables the input and offers email, without retry', async ({ page }) => {
    await mockStatus(page, 503);
    await page.goto('/');
    await openChat(page);
    await sendMessage(page, 'hello');
    await expect(chatPanel(page).getByRole('alert')).toContainText('unavailable');
    await expect(chatPanel(page).locator('textarea')).toBeDisabled();
    await expect(chatPanel(page).getByRole('button', { name: 'Try again' })).toHaveCount(0);
  });

  test('a network failure offers retry, which succeeds once the API is back', async ({ page }) => {
    await mockNetworkFailure(page);
    await page.goto('/');
    await openChat(page);
    await sendMessage(page, 'hello');
    await expect(chatPanel(page).getByRole('alert')).toContainText("Couldn't connect");

    await page.unroute('**/api/chat');
    await mockReply(page, ['Back online.']);
    await chatPanel(page).getByRole('button', { name: 'Try again' }).click();
    await expect(chatPanel(page).getByRole('log')).toContainText('Back online.');
    await expect(chatPanel(page).getByRole('alert')).toHaveCount(0);
    // The failed user message is not duplicated by the retry.
    await expect(chatPanel(page).locator('.chat-msg--user')).toHaveCount(1);
  });

  test('a stream cut off before `done` keeps the partial text, flags it and offers retry', async ({ page }) => {
    await mockInterruptedReply(page, 'Tomasz is a develo');
    await page.goto('/');
    await openChat(page);
    await sendMessage(page, 'Who is he?');
    const log = chatPanel(page).getByRole('log');
    await expect(log).toContainText('Tomasz is a develo');
    await expect(log).toContainText('(response interrupted)');
    await expect(chatPanel(page).getByRole('alert')).toContainText('interrupted');
    await expect(chatPanel(page).getByRole('button', { name: 'Try again' })).toBeVisible();
  });
});

test.describe('chat — keyboard & focus', () => {
  test('Esc closes the panel and returns focus to the launcher', async ({ page }) => {
    await page.goto('/');
    await openChat(page);
    await page.keyboard.press('Escape');
    await expect(chatPanel(page)).toBeHidden();
    await expect(page.locator('.chat-launcher')).toBeFocused();
  });

  test('Enter sends and Shift+Enter inserts a newline (desktop)', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === 'mobile', 'touch devices: Enter always inserts a newline');
    const { requests } = await mockReply(page, ['ok']);
    await page.goto('/');
    await openChat(page);
    const box = chatPanel(page).locator('textarea');
    await box.fill('line one');
    await box.press('Shift+Enter');
    await box.pressSequentially('line two');
    expect(requests).toHaveLength(0);
    await box.press('Enter');
    await expect(chatPanel(page).getByRole('log')).toContainText('ok');
    expect((requests[0] as { messages: { content: string }[] }).messages[0]?.content).toBe('line one\nline two');
  });

  test('Tab is trapped inside the chat sheet (mobile)', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile', 'focus trap is mobile-only');
    await page.goto('/');
    await openChat(page);
    const panel = chatPanel(page);
    for (let i = 0; i < 12; i++) {
      await page.keyboard.press('Tab');
      const inside = await panel.evaluate((el) => el.contains(document.activeElement));
      expect(inside).toBe(true);
    }
  });

  test('the send button is disabled for an empty or whitespace-only draft', async ({ page }) => {
    await page.goto('/');
    await openChat(page);
    const send = chatPanel(page).locator('.chat-input__send');
    await expect(send).toBeDisabled();
    await chatPanel(page).locator('textarea').fill('   ');
    await expect(send).toBeDisabled();
    await chatPanel(page).locator('textarea').fill('x');
    await expect(send).toBeEnabled();
  });
});
