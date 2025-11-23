import { test, expect } from '@playwright/test';

test('theme toggle toggles dark class on html and body', async ({ page }) => {
  await page.goto('/company-dashboard');

  // Wait for the toggle to appear
  const toggle = page.locator('[data-testid="theme-toggle-button"]');
  await expect(toggle).toBeVisible();

  const before = await page.evaluate(() => ({
    html: document.documentElement.classList.contains('dark'),
    body: document.body.classList.contains('dark'),
  }));

  await toggle.click();

  const after = await page.evaluate(() => ({
    html: document.documentElement.classList.contains('dark'),
    body: document.body.classList.contains('dark'),
  }));

  expect(after.html).toBe(!before.html);
  expect(after.body).toBe(!before.body);
});
