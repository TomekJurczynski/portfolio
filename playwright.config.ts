import { defineConfig, devices } from '@playwright/test';

// E2E runs against the built static site (`pnpm run build:all` first) served by
// `astro preview`. /api/chat is never hit for real: every test mocks it via
// page.route (see tests/e2e/helpers.ts), so no API cost and no Netlify needed.
// E2E_PORT lets you run next to a local `astro dev` on 4321 (reuseExistingServer would
// otherwise silently test the dev server instead of the built site).
const PORT = Number(process.env.E2E_PORT ?? 4321);

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
    // Deterministic scroll assertions (nav.ts jumps instead of animating).
    reducedMotion: 'reduce',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    {
      name: 'mobile',
      use: { ...devices['Pixel 7'], viewport: { width: 390, height: 844 } },
    },
  ],
  webServer: {
    command: `pnpm exec astro preview --port ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
