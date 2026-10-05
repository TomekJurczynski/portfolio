import { expect, test } from '@playwright/test';
import { chatPanel, openChat } from './helpers';

// Mic input uses the browser's SpeechRecognition. The orb's cosmetic level meter opens a second
// getUserMedia capture, which phones do not allow next to recognition (it broke the mic on
// Android Chrome). So: desktop opens the meter, touch devices must not.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const w = window as unknown as Record<string, unknown>;
    w.__getUserMediaCalls = 0;
    const media = navigator.mediaDevices ?? ({} as MediaDevices);
    Object.defineProperty(navigator, 'mediaDevices', { value: media, configurable: true });
    media.getUserMedia = () => {
      (w.__getUserMediaCalls as number)++;
      return Promise.reject(new DOMException('stub', 'NotAllowedError')); // meter fails quietly, as without permission
    };
    class FakeRecognition {
      lang = '';
      continuous = false;
      interimResults = false;
      onstart: (() => void) | null = null;
      onend: (() => void) | null = null;
      onerror: ((e: { error: string }) => void) | null = null;
      onresult: unknown = null;
      start() {
        setTimeout(() => this.onstart?.(), 0);
      }
      stop() {
        this.onend?.();
      }
      abort() {
        this.onend?.();
      }
    }
    // Current Chromium ships the unprefixed constructor too, and the app prefers it — stub both.
    for (const name of ['SpeechRecognition', 'webkitSpeechRecognition']) {
      Object.defineProperty(window, name, { value: FakeRecognition, configurable: true, writable: true });
    }
  });
});

test('mic: starts listening, and opens the parallel level meter only where the mic can be shared', async ({
  page,
}, testInfo) => {
  await page.goto('/');
  await openChat(page);
  const mic = chatPanel(page).getByRole('button', { name: 'Speak your question' });
  await mic.click();
  await expect(chatPanel(page).getByRole('button', { name: 'Stop listening' })).toBeVisible();

  const calls = await page.evaluate(() => (window as unknown as { __getUserMediaCalls: number }).__getUserMediaCalls);
  expect(calls, `getUserMedia calls on ${testInfo.project.name}`).toBe(testInfo.project.name === 'mobile' ? 0 : 1);
});
