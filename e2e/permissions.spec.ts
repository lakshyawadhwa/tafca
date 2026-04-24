import { test, expect, createSiblingUser, getAccessToken, login } from './fixtures';

test.describe('role-based UI gating', () => {
  test('ARTICLE sees New Task but not New Client', async ({ page, request, registeredUser: _partner }) => {
    // Admin (partner) already logged in from fixture. Create an ARTICLE sibling.
    const adminToken = await getAccessToken(page);
    const article = await createSiblingUser(request, adminToken, 'ARTICLE');

    // Sign out, log in as the article.
    await page.evaluate(() => {
      localStorage.removeItem('ca_access_token');
      localStorage.removeItem('ca_user');
    });
    await login(page, article.email, article.password);

    // /clients: New Client button hidden (client:create denied for ARTICLE).
    await page.goto('/clients');
    await expect(page.getByRole('button', { name: /new client/i })).toHaveCount(0);

    // /tasks: New Task button visible (task:create = 'all' for every role).
    await page.goto('/tasks');
    await expect(page.getByRole('button', { name: /new task/i })).toBeVisible();
  });

  test('PARTNER sees both New Client and New Task', async ({ page, registeredUser: _partner }) => {
    await page.goto('/clients');
    await expect(page.getByRole('button', { name: /new client/i })).toBeVisible();

    await page.goto('/tasks');
    await expect(page.getByRole('button', { name: /new task/i })).toBeVisible();
  });
});
