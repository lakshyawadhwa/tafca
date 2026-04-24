import { test as base, expect, type Page, type APIRequestContext } from '@playwright/test';

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

/**
 * Current admin JWT from the logged-in browser session — needed for
 * tests that want to create sibling users via API (faster than doing
 * it through the invite UI).
 */
export async function getAccessToken(page: Page): Promise<string> {
  const token = await page.evaluate(() => localStorage.getItem('ca_access_token'));
  if (!token) throw new Error('No access token in localStorage');
  return token;
}

export interface AuthedUser {
  email: string;
  password: string;
  fullName: string;
  role: 'PARTNER' | 'MANAGER' | 'JUNIOR_CA' | 'ARTICLE' | 'ADMIN';
}

/**
 * Direct API create of a sibling user in the current firm.
 * Caller must be logged in as PARTNER or ADMIN.
 */
export async function createSiblingUser(
  request: APIRequestContext,
  adminToken: string,
  role: AuthedUser['role'],
): Promise<AuthedUser> {
  const suffix = `${Date.now()}_${Math.floor(Math.random() * 10000)}`;
  const user: AuthedUser = {
    email: `pw_${role.toLowerCase()}_${suffix}@example.com`,
    password: 'SiblingPass123!',
    fullName: `Test ${role} ${suffix}`,
    role,
  };

  const res = await request.post('http://localhost:3000/api/users', {
    headers: { Authorization: `Bearer ${adminToken}` },
    data: {
      email: user.email,
      password: user.password,
      fullName: user.fullName,
      role: user.role,
    },
  });
  if (!res.ok()) {
    throw new Error(`createSiblingUser ${role} failed: ${res.status()} ${await res.text()}`);
  }
  return user;
}

export const test = base.extend<{ registeredUser: RegisteredUser }>({
  registeredUser: async ({ page }, use) => {
    const user = await registerNewFirm(page);
    await use(user);
  },
});

export { expect };
