import { expect, type Page } from '@playwright/test';

type StreamEvent = { type: 'delta'; text: string } | { type: 'done' } | { type: 'error'; code: string };

const ndjson = (events: StreamEvent[]): string => events.map((e) => JSON.stringify(e)).join('\n') + '\n';

/** Mocks /api/chat with a complete, successful NDJSON reply split into the given text chunks. */
export async function mockReply(page: Page, chunks: string[]): Promise<{ requests: unknown[] }> {
  const requests: unknown[] = [];
  await page.route('**/api/chat', async (route) => {
    requests.push(route.request().postDataJSON());
    await route.fulfill({
      status: 200,
      contentType: 'application/x-ndjson',
      body: ndjson([...chunks.map((text) => ({ type: 'delta' as const, text })), { type: 'done' }]),
    });
  });
  return { requests };
}

/** Mocks /api/chat with a stream that ends without a `done` line (dropped connection). */
export async function mockInterruptedReply(page: Page, text: string): Promise<void> {
  await page.route('**/api/chat', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/x-ndjson',
      body: ndjson([{ type: 'delta', text }]),
    }),
  );
}

export async function mockStatus(page: Page, status: number, headers: Record<string, string> = {}): Promise<void> {
  await page.route('**/api/chat', (route) =>
    route.fulfill({ status, headers, contentType: 'application/json', body: JSON.stringify({ error: 'mock' }) }),
  );
}

export async function mockNetworkFailure(page: Page): Promise<void> {
  await page.route('**/api/chat', (route) => route.abort('failed'));
}

export function chatPanel(page: Page) {
  return page.getByRole('dialog', { name: /Portfolio guide|Przewodnik po portfolio/ });
}

/** Opens the chat via the launcher and waits for the panel (island hydrates on idle). */
export async function openChat(page: Page): Promise<void> {
  const launcher = page.locator('.chat-launcher');
  await expect(launcher).toBeVisible();
  // client:idle — click until the island has hydrated and the panel actually opens.
  await expect(async () => {
    await launcher.click();
    await expect(chatPanel(page)).toBeVisible({ timeout: 500 });
  }).toPass({ timeout: 10_000 });
}

export async function sendMessage(page: Page, text: string): Promise<void> {
  // Click send rather than pressing Enter: on touch devices Enter inserts a newline.
  await chatPanel(page).locator('textarea').fill(text);
  await chatPanel(page).locator('.chat-input__send').click();
}
