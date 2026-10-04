import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { chatPanel, mockReply, openChat, sendMessage } from './helpers';

// Cloud read-aloud (CloudSpeechProvider -> /api/speak). The build must use
// PUBLIC_VOICE_PROVIDER=cloud, so these only run when E2E_CLOUD_VOICE=1 (CI sets it; locally:
// build with the variable set, then run with it set). /api/speak is always mocked — no TTS cost.
test.skip(!process.env.E2E_CLOUD_VOICE, 'needs a build with PUBLIC_VOICE_PROVIDER=cloud and E2E_CLOUD_VOICE=1');

if (!existsSync('dist/_headers')) execFileSync('node', ['scripts/build-csp.mjs']);
const csp = /Content-Security-Policy: (.+)/.exec(readFileSync('dist/_headers', 'utf8'))?.[1];

/** Replays the production CSP on documents (astro preview does not serve dist/_headers). */
async function withCsp(page: Page): Promise<string[]> {
  const violations: string[] = [];
  page.on('console', (msg) => {
    if (/Content Security Policy/i.test(msg.text())) violations.push(msg.text());
  });
  await page.route('**/*', async (route) => {
    if (route.request().resourceType() !== 'document') return route.fallback();
    const response = await route.fetch();
    await route.fulfill({ response, headers: { ...response.headers(), 'content-security-policy': csp! } });
  });
  return violations;
}

/** A silent 8-bit mono 8 kHz WAV of the given length — a real, playable audio file. */
function silentWav(seconds: number): Buffer {
  const rate = 8000;
  const data = Buffer.alloc(Math.round(rate * seconds), 128);
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write('WAVEfmt ', 8);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(rate, 24);
  header.writeUInt32LE(rate, 28);
  header.writeUInt16LE(1, 32);
  header.writeUInt16LE(8, 34);
  header.write('data', 36);
  header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
}

type SpeakBody = { text: string; lang: string };

async function mockSpeak(page: Page, seconds = 0.3): Promise<SpeakBody[]> {
  const bodies: SpeakBody[] = [];
  await page.route('**/api/speak', async (route) => {
    bodies.push(route.request().postDataJSON() as SpeakBody);
    await route.fulfill({ status: 200, contentType: 'audio/wav', body: silentWav(seconds) });
  });
  return bodies;
}

/** Replaces speechSynthesis with a recorder so the browser-voice fallback is observable. */
async function recordBrowserVoice(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const spoken: string[] = [];
    (window as unknown as { __spoken: string[] }).__spoken = spoken;
    const fake = {
      speaking: false,
      getVoices: () => [],
      addEventListener: () => {},
      removeEventListener: () => {},
      cancel: () => {},
      speak: (u: SpeechSynthesisUtterance) => {
        spoken.push(u.text);
        setTimeout(() => u.onend?.(new Event('end') as SpeechSynthesisEvent), 0);
      },
    };
    Object.defineProperty(window, 'speechSynthesis', { value: fake, configurable: true });
  });
}

const spokenByBrowser = (page: Page): Promise<string[]> =>
  page.evaluate(() => (window as unknown as { __spoken: string[] }).__spoken);

const speakButton = (page: Page) => chatPanel(page).locator('.chat-msg__speak').last();

async function askAndWait(page: Page, question: string, expected: string): Promise<void> {
  await openChat(page);
  await sendMessage(page, question);
  await expect(chatPanel(page).getByRole('log')).toContainText(expected);
  await expect(speakButton(page)).toBeVisible();
}

test.describe('cloud voice', () => {
  test('speaker button plays the reply from /api/speak, with no CSP violations', async ({ page }) => {
    const violations = await withCsp(page);
    const bodies = await mockSpeak(page, 1.2);
    await mockReply(page, ['Tomasz builds ', 'AI apps.']);
    await page.goto('/');
    await askAndWait(page, 'What does he build?', 'Tomasz builds AI apps.');

    await speakButton(page).click();
    await expect(speakButton(page)).toHaveAttribute('aria-pressed', 'true');
    await expect.poll(() => bodies.length).toBe(1);
    expect(bodies[0]).toEqual({ text: 'Tomasz builds AI apps.', lang: 'en-US' });
    // plays to the end by itself, then the button returns to idle
    await expect(speakButton(page)).toHaveAttribute('aria-pressed', 'false', { timeout: 8_000 });
    expect(violations).toEqual([]);
  });

  test('uses the Polish voice language on /pl/', async ({ page }) => {
    const bodies = await mockSpeak(page);
    await mockReply(page, ['Cześć, jestem asystentem Tomasza.']);
    await page.goto('/pl/');
    await askAndWait(page, 'Cześć', 'Cześć, jestem asystentem Tomasza.');
    await speakButton(page).click();
    await expect.poll(() => bodies.length).toBe(1);
    expect(bodies[0]?.lang).toBe('pl-PL');
  });

  test('never sends Markdown or action markers to the voice', async ({ page }) => {
    const bodies = await mockSpeak(page);
    await mockReply(page, ['**Lexicon** is an app. {{link:lexicon}}']);
    await page.goto('/');
    await askAndWait(page, 'Tell me', 'Lexicon is an app.');
    await speakButton(page).click();
    await expect.poll(() => bodies.length).toBe(1);
    expect(bodies[0]?.text).toBe('Lexicon is an app.');
  });

  test('a long reply is split: short first chunk, the rest requested in parallel', async ({ page }) => {
    const bodies = await mockSpeak(page);
    const reply =
      'Tomasz works at Consdata as a low-code developer. He builds his own apps with AI agents, ' +
      'directing them through the whole implementation. His proudest project is this assistant, ' +
      'which also answers by voice. Would you like to know more about any of the projects?';
    await mockReply(page, [reply]);
    await page.goto('/');
    await askAndWait(page, 'Tell me everything', 'Would you like to know more');
    await speakButton(page).click();
    await expect.poll(() => bodies.length).toBeGreaterThanOrEqual(2);
    expect(bodies[0]?.text.length).toBeLessThan(reply.length / 2);
    expect(bodies.map((b) => b.text).join(' ')).toBe(reply);
  });

  test('clicking the button again stops playback', async ({ page }) => {
    await mockSpeak(page, 6);
    await mockReply(page, ['A fairly long answer that is playing right now.']);
    await page.goto('/');
    await askAndWait(page, 'Go', 'A fairly long answer');
    await speakButton(page).click();
    await expect(speakButton(page)).toHaveAttribute('aria-pressed', 'true');
    await expect(speakButton(page)).toHaveAttribute('aria-pressed', 'true'); // still speaking, not ended
    await speakButton(page).click();
    await expect(speakButton(page)).toHaveAttribute('aria-pressed', 'false');
  });

  for (const status of [429, 502, 503]) {
    test(`falls back to the browser voice when /api/speak returns ${status}`, async ({ page }) => {
      await recordBrowserVoice(page);
      await page.route('**/api/speak', (route) =>
        route.fulfill({ status, contentType: 'application/json', body: JSON.stringify({ type: 'error' }) }),
      );
      await mockReply(page, ['The assistant still talks.']);
      await page.goto('/');
      await askAndWait(page, 'Hello', 'The assistant still talks.');
      await speakButton(page).click();
      await expect.poll(() => spokenByBrowser(page)).toEqual(['The assistant still talks.']);
      await expect(speakButton(page)).toHaveAttribute('aria-pressed', 'false');
    });
  }

  test('falls back to the browser voice on a network failure', async ({ page }) => {
    await recordBrowserVoice(page);
    await page.route('**/api/speak', (route) => route.abort('failed'));
    await mockReply(page, ['Offline voice still works.']);
    await page.goto('/');
    await askAndWait(page, 'Hello', 'Offline voice still works.');
    await speakButton(page).click();
    await expect.poll(() => spokenByBrowser(page)).toEqual(['Offline voice still works.']);
  });
});
