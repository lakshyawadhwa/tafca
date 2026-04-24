import { test, expect } from './fixtures';

test.describe('invite flow', () => {
  test('admin creates invite → invitee accepts → auto-logged-in as new user', async ({
    page,
    registeredUser: _admin,
  }) => {
    const invitee = {
      email: `invitee_${Date.now()}@example.com`,
      fullName: 'New Member',
      password: 'InviteePass123!',
    };

    // Partner is already on the app after register. Go to Settings.
    await page.goto('/settings');
    await page.getByRole('button', { name: /invite member/i }).first().click();

    // Fill the invite modal.
    await page.getByLabel(/full name/i).fill(invitee.fullName);
    await page.getByLabel(/email/i).fill(invitee.email);
    await page.getByLabel(/role/i).selectOption('JUNIOR_CA');
    await page.getByRole('button', { name: /create invite/i }).click();

    // Success state: a readonly input containing the invite URL.
    const urlInput = page.locator('input[readonly]');
    await expect(urlInput).toBeVisible({ timeout: 5_000 });
    const inviteUrl = await urlInput.inputValue();
    expect(inviteUrl).toMatch(/\/accept-invite\?token=[a-f0-9]{64}$/);
    await page.getByRole('button', { name: /^done$/i }).click();

    // New member shows up in pending invites list.
    await expect(page.getByText(invitee.email)).toBeVisible();

    // Sign out of the admin session before visiting the invite link so the
    // accept page handles an unauthenticated flow.
    await page.evaluate(() => {
      localStorage.removeItem('ca_access_token');
      localStorage.removeItem('ca_user');
    });

    // Navigate directly to the path+query (relative to baseURL).
    const acceptPath = inviteUrl.replace(/^https?:\/\/[^/]+/, '');
    await page.goto(acceptPath);

    // Preview should render.
    await expect(page.getByText(invitee.fullName)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(invitee.email)).toBeVisible();

    // Set password and submit.
    await page.getByLabel(/^set password$/i).fill(invitee.password);
    await page.getByLabel(/^confirm password$/i).fill(invitee.password);
    await page.getByRole('button', { name: /create account/i }).click();

    // Auto-login should push us off /accept-invite.
    await page.waitForURL((url) => !url.pathname.startsWith('/accept-invite'), {
      timeout: 10_000,
    });

    // Confirm auth state contains the new user.
    const stored = await page.evaluate(() => localStorage.getItem('ca_user'));
    expect(stored).not.toBeNull();
    const parsed = JSON.parse(stored!);
    expect(parsed.email).toBe(invitee.email);
    expect(parsed.role).toBe('JUNIOR_CA');
  });

  test('rejects expired/invalid tokens on accept page', async ({ page }) => {
    await page.goto('/accept-invite?token=' + 'a'.repeat(64));
    await expect(
      page.getByRole('heading', { name: /invite unavailable/i }),
    ).toBeVisible({ timeout: 10_000 });
  });
});
