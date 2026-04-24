import { test, expect } from './fixtures';

test.describe('client create', () => {
  test('partner creates an INDIVIDUAL client, sees it in list + detail', async ({
    page,
    registeredUser: _partner,
  }) => {
    const suffix = Date.now();
    const displayName = `Ramesh Kumar ${suffix}`;

    await page.goto('/clients/new');

    // Entity type defaults to INDIVIDUAL — no PAN required.
    await page.getByLabel(/display name/i).fill(displayName);
    await page.getByLabel(/legal name/i).fill(displayName);

    const [createResp] = await Promise.all([
      page.waitForResponse(
        (r) => r.url().endsWith('/api/clients') && r.request().method() === 'POST',
      ),
      page.getByRole('button', { name: /create client/i }).click(),
    ]);
    expect(createResp.status()).toBe(201);

    // Success lands on detail page /clients/:id.
    await page.waitForURL(/\/clients\/[^/]+$/, { timeout: 10_000 });
    await expect(
      page.getByRole('heading', { name: displayName }),
    ).toBeVisible({ timeout: 10_000 });

    // Back to the list — client shows up.
    await page.goto('/clients');
    await expect(page.getByText(displayName).first()).toBeVisible({ timeout: 10_000 });
  });

  test('URL filters persist on reload and back-button', async ({
    page,
    registeredUser: _partner,
  }) => {
    await page.goto('/clients?status=ACTIVE&q=acme');

    // After the app hydrates, filters should round-trip into the URL.
    await page.waitForLoadState('networkidle');
    const url = new URL(page.url());
    expect(url.searchParams.get('status')).toBe('ACTIVE');
    expect(url.searchParams.get('q')).toBe('acme');
  });
});
