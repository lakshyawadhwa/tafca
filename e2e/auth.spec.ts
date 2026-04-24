import { test, expect, registerNewFirm, login } from './fixtures';

test.describe('auth', () => {
  test('register → auto-authed → logout → login', async ({ page }) => {
    const user = await registerNewFirm(page);

    // Should be past /login after register.
    await expect(page).not.toHaveURL(/\/login/);

    // Wipe auth and make sure /login becomes accessible.
    await page.evaluate(() => {
      localStorage.removeItem('ca_access_token');
      localStorage.removeItem('ca_user');
    });
    await page.goto('/login');
    await expect(page).toHaveURL(/\/login/);

    // Log back in.
    await login(page, user.email, user.password);
    await expect(page).not.toHaveURL(/\/login/);
  });

  test('rejects bad credentials', async ({ page }) => {
    // Unique email per test run so we don't trip the per-account lockout
    // across repeated local runs.
    const unusedEmail = `missing_${Date.now()}@example.com`;

    await page.goto('/login');
    await page.getByLabel(/email/i).fill(unusedEmail);
    await page.getByLabel(/password/i).fill('wrongpassword');
    await page.getByRole('button', { name: /sign in/i }).click();

    // Page should stay on /login and surface an error of some kind.
    await expect(page).toHaveURL(/\/login/);
    await expect(
      page.locator('p.text-red-600, p.bg-red-50'),
    ).toBeVisible({ timeout: 5_000 });
  });
});
