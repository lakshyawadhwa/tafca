import { test, expect, createSiblingUser, getAccessToken, login } from './fixtures';

/**
 * Comments e2e tests.
 * Each test uses a fresh firm (via registeredUser fixture) so there is no
 * state bleed between tests.
 *
 * Strategy:
 * - Create a task via API (faster than UI), then drive comment interactions in UI.
 */

async function createTaskViaApi(
  request: import('@playwright/test').APIRequestContext,
  token: string,
): Promise<string> {
  const res = await request.post('http://localhost:3000/api/tasks', {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    data: { title: `E2E Comment Task ${Date.now()}`, priority: 'MEDIUM' },
  });
  if (!res.ok()) {
    throw new Error(`createTaskViaApi failed: ${res.status()} ${await res.text()}`);
  }
  const body = await res.json();
  return body.id as string;
}

test.describe('comments', () => {
  test('post comment, verify it renders', async ({ page, request, registeredUser: _partner }) => {
    const token = await getAccessToken(page);
    const taskId = await createTaskViaApi(request, token);

    await page.goto(`/tasks/${taskId}`);

    // Wait for CommentSection to appear
    await expect(page.getByText('Comments').first()).toBeVisible({ timeout: 10_000 });

    const commentText = `Hello from e2e ${Date.now()}`;

    // Fill and submit
    await page.getByPlaceholder(/add a comment/i).fill(commentText);
    await page.getByRole('button', { name: /^comment$/i }).click();

    // Comment appears in list
    await expect(page.getByText(commentText)).toBeVisible({ timeout: 8_000 });
  });

  test('edit own comment', async ({ page, request, registeredUser: _partner }) => {
    const token = await getAccessToken(page);
    const taskId = await createTaskViaApi(request, token);

    await page.goto(`/tasks/${taskId}`);
    await expect(page.getByText('Comments').first()).toBeVisible({ timeout: 10_000 });

    const original = `Original comment ${Date.now()}`;
    const edited = `Edited comment ${Date.now()}`;

    await page.getByPlaceholder(/add a comment/i).fill(original);
    await page.getByRole('button', { name: /^comment$/i }).click();
    await expect(page.getByText(original)).toBeVisible({ timeout: 8_000 });

    // Click Edit button for the comment
    await page.getByRole('button', { name: /^edit$/i }).first().click();

    // Textarea should be pre-filled — clear and retype
    const editTextarea = page.locator('textarea').last();
    await editTextarea.fill(edited);
    await page.getByRole('button', { name: /^save$/i }).click();

    await expect(page.getByText(edited)).toBeVisible({ timeout: 8_000 });
    await expect(page.getByText(original)).not.toBeVisible();
  });

  test('delete own comment with replies shows [comment deleted]', async ({
    page,
    request,
    registeredUser: _partner,
  }) => {
    const token = await getAccessToken(page);
    const taskId = await createTaskViaApi(request, token);

    // Post the top-level comment via API so we have its ID for the reply
    const commentRes = await request.post(
      `http://localhost:3000/api/tasks/${taskId}/comments`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        data: { body: `Top level ${Date.now()}` },
      },
    );
    expect(commentRes.ok()).toBeTruthy();
    const commentBody = await commentRes.json();
    const commentId = commentBody.id as string;

    // Post a reply via API
    await request.post(
      `http://localhost:3000/api/tasks/${taskId}/comments`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        data: { body: `Reply ${Date.now()}`, parentCommentId: commentId },
      },
    );

    await page.goto(`/tasks/${taskId}`);
    await expect(page.getByText('Comments').first()).toBeVisible({ timeout: 10_000 });

    // Wait for comment list to render
    await expect(page.getByText(commentBody.body)).toBeVisible({ timeout: 8_000 });

    // Delete the top-level comment
    await page.getByRole('button', { name: /^delete$/i }).first().click();

    // Should show tombstone
    await expect(page.getByText('[comment deleted]')).toBeVisible({ timeout: 8_000 });
  });

  test('sibling user cannot edit or delete another user comment', async ({
    page,
    request,
    registeredUser: _partner,
  }) => {
    const partnerToken = await getAccessToken(page);
    const taskId = await createTaskViaApi(request, partnerToken);

    // Partner posts a comment
    await request.post(
      `http://localhost:3000/api/tasks/${taskId}/comments`,
      {
        headers: {
          Authorization: `Bearer ${partnerToken}`,
          'Content-Type': 'application/json',
        },
        data: { body: `Partner comment ${Date.now()}` },
      },
    );

    // Create a sibling (JUNIOR_CA) and log in as them
    const sibling = await createSiblingUser(request, partnerToken, 'JUNIOR_CA');

    await page.evaluate(() => {
      localStorage.removeItem('ca_access_token');
      localStorage.removeItem('ca_user');
    });
    await login(page, sibling.email, sibling.password);

    await page.goto(`/tasks/${taskId}`);
    await expect(page.getByText('Comments').first()).toBeVisible({ timeout: 10_000 });

    // Partner's comment should be visible
    await expect(page.locator('.text-sm.text-gray-700').first()).toBeVisible({ timeout: 8_000 });

    // Edit and Delete buttons should NOT be present for the sibling viewing partner's comment
    await expect(page.getByRole('button', { name: /^edit$/i })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /^delete$/i })).toHaveCount(0);
  });

  test('@mention inserts chip and mention renders in submitted comment', async ({
    page,
    request,
    registeredUser: _partner,
  }) => {
    const token = await getAccessToken(page);
    const taskId = await createTaskViaApi(request, token);

    // Create a sibling user to mention
    const sibling = await createSiblingUser(request, token, 'JUNIOR_CA');

    await page.goto(`/tasks/${taskId}`);
    await expect(page.getByText('Comments').first()).toBeVisible({ timeout: 10_000 });

    const textarea = page.getByPlaceholder(/add a comment/i);
    await textarea.click();
    // Type @ to trigger mention popup
    await textarea.type('@');

    // Type a portion of the sibling's name
    const namePart = sibling.fullName.split(' ')[1]; // "JUNIOR_CA_<suffix>" → take last word
    await textarea.type(namePart.slice(0, 4));

    // Mention popup should appear
    await expect(page.locator('[role="listbox"]')).toBeVisible({ timeout: 5_000 });

    // Select first result with Enter key
    await page.keyboard.press('Enter');

    // Mention popup should close
    await expect(page.locator('[role="listbox"]')).not.toBeVisible();

    // Submit the comment
    await page.getByRole('button', { name: /^comment$/i }).click();

    // The mention chip (@FullName rendered in blue) should appear
    await expect(
      page.locator('.text-blue-600').filter({ hasText: /@/ }).first(),
    ).toBeVisible({ timeout: 8_000 });
  });
});
