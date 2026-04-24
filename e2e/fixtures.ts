import { test as base, expect, type Page } from '@playwright/test';

/**
 * Each test gets a fresh firm + partner account registered through the UI.
 * No DB cleanup — we just use unique emails per test so data is isolated.
 * The backend dedup index is `(firm_id, email)` so cross-firm email reuse is fine;
 * cross-test reuse within the same firm is impossible because each test has a new firm.
 */

export interface RegisteredUser {
  email: string;
  password: string;
  fullName: string;
  firmName: string;
}

function uniqueSuffix() {
  return `${Date.now()}_${Math.floor(Math.random() * 10000)}`;
}

export async function registerNewFirm(page: Page): Promise<RegisteredUser> {
  const suffix = uniqueSuffix();
  const user: RegisteredUser = {
    email: `pw_${suffix}@example.com`,
    password: 'TestPassword123!',
    fullName: `Test Partner ${suffix}`,
    firmName: `Test Firm ${suffix}`,
  };

  await page.goto('/register');
  await page.getByLabel(/firm name/i).fill(user.firmName);
  await page.getByLabel(/full name/i).fill(user.fullName);
  await page.getByLabel(/email/i).fill(user.email);
  await page.getByLabel(/^password$/i).fill(user.password);
  await page.getByRole('button', { name: /register|sign up|create/i }).click();

  // Successful register lands on /welcome, /onboarding, or / — any authed page.
  await page.waitForURL(/\/(welcome|onboarding|$)/, { timeout: 10_000 });

  return user;
}

export async function login(page: Page, email: string, password: string) {
  await page.goto('/login');
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(password);
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), {
    timeout: 10_000,
  });
}

export const test = base.extend<{ registeredUser: RegisteredUser }>({
  registeredUser: async ({ page }, use) => {
    const user = await registerNewFirm(page);
    await use(user);
  },
});

export { expect };
