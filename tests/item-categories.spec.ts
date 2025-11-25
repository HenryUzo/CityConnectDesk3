import { test, expect } from '@playwright/test';

test('item categories page loads without 404 and supports basic CRUD', async ({ page }) => {
  const responses: { url: string; status: number }[] = [];

  page.on('response', (response) => {
    const url = response.url();
    if (url.includes('/api/admin/item-categories')) {
      responses.push({ url, status: response.status() });
    }
  });

  // Navigate directly to the Item Categories admin page
  await page.goto('/admin-dashboard/item-categories', { waitUntil: 'networkidle' });

  // Wait for the table header to ensure UI rendered
  await expect(page.getByText('Item Categories')).toBeVisible();

  // Ensure the initial fetch did not 404
  const listCall = responses.find((r) => r.url.includes('/api/admin/item-categories') && r.status !== 204);
  expect(listCall, 'Expected item-categories API call on load').toBeDefined();
  expect(listCall!.status, 'GET /api/admin/item-categories should not 404').not.toBe(404);

  // Create a new category
  await page.getByRole('button', { name: '+ New Category' }).click();

  const nameInput = page.getByLabel('Name');
  await expect(nameInput).toBeVisible();

  const uniqueName = `Playwright Category ${Date.now()}`;
  await nameInput.fill(uniqueName);

  const descriptionInput = page.getByLabel('Description');
  await descriptionInput.fill('Created by Playwright test');

  await page.getByRole('button', { name: 'Save' }).click();

  // Wait for the new row to appear
  await expect(page.getByText(uniqueName)).toBeVisible();

  // Verify that a non-404 POST occurred
  const postCall = responses.find(
    (r) => r.url.endsWith('/api/admin/item-categories') && r.status >= 200 && r.status < 300,
  );
  expect(postCall, 'POST /api/admin/item-categories should succeed').toBeDefined();

  // Delete the created category to keep data clean (best-effort)
  const row = page.locator('tr', { hasText: uniqueName });
  await row.getByRole('button', { name: 'Delete' }).click();

  // There may be no confirmation dialog; just wait for row to disappear
  await expect(row).toHaveCount(0);

  const deleteCall = responses.find(
    (r) => r.url.includes('/api/admin/item-categories/') && r.status >= 200 && r.status < 300,
  );
  expect(deleteCall, 'DELETE /api/admin/item-categories/:id should succeed').toBeDefined();
});

