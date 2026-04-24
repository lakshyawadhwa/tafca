import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright e2e config.
 * Runs against local api + web. Spins both up via webServer block so
 * `pnpm exec playwright test` is a one-shot command.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false, // API + DB state shared; avoid flaky cross-test races
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? 'line' : 'list',

  use: {
    baseURL: 'http://localhost:5173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  webServer: [
    {
      command: 'pnpm --filter api dev',
      url: 'http://localhost:3000/api/health',
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
      stdout: 'pipe',
      stderr: 'pipe',
      // Lets the throttle guard bypass per-IP rate limits. Playwright
      // hammers /auth/register from loopback and the 3-per-minute cap
      // otherwise kills every test after the third.
      env: { E2E_BYPASS_THROTTLE: '1' },
    },
    {
      command: 'pnpm --filter web dev',
      url: 'http://localhost:5173',
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
      stdout: 'pipe',
      stderr: 'pipe',
    },
  ],
});
