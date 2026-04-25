import { test, expect } from './fixtures';

test.describe('unsaved-changes guard on ClientForm', () => {
  test('dismissing dialog keeps user on form; accepting navigates away', async ({
    page,
    registeredUser: _user,
  }) => {
    await page.goto('/clients/new');
    await page.waitForLoadState('networkidle');

    // Type something to mark the form dirty
    await page.getByLabel(/display name/i).fill('Draft Client');

    // First attempt: dismiss the dialog — user stays on form
    page.once('dialog', (d) => d.dismiss());
    await page.getByRole('button', { name: /cancel/i }).click();
    await expect(page).toHaveURL(/\/clients\/new/);

    // Second attempt: accept the dialog — navigates away
    page.once('dialog', (d) => d.accept());
    await page.getByRole('button', { name: /cancel/i }).click();
    await expect(page).not.toHaveURL(/\/clients\/new/, { timeout: 5_000 });
  });
});
