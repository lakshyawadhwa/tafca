import { test, expect } from './fixtures';

test.describe('error boundary', () => {
  test('shows fallback on uncaught error, clears on try again', async ({
    page,
    registeredUser: _user,
  }) => {
    // Navigate to any authed page
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Throw an uncaught error from page context
    await page.evaluate(() => {
      // Dispatch as a real ErrorEvent so the window 'error' listener fires
      const err = new Error('boom');
      window.dispatchEvent(
        new ErrorEvent('error', { error: err, message: err.message, bubbles: true }),
      );
    });

    // Fallback heading should appear
    await expect(page.getByRole('heading', { name: /something went wrong/i })).toBeVisible({
      timeout: 5_000,
    });

    // Click "Try again" — fallback clears
    await page.getByRole('button', { name: /try again/i }).click();
    await expect(page.getByRole('heading', { name: /something went wrong/i })).not.toBeVisible({
      timeout: 5_000,
    });
  });
});
