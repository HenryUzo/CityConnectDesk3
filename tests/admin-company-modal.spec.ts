import { test, expect, type Page } from '@playwright/test';

const BASE_URL = 'http://localhost:5000';

async function ensureAdminSession(page: Page) {
  await page.goto(`${BASE_URL}/admin-dashboard`);

  const logoutButton = page.locator('button:has-text("Logout")');
  const loggedIn = await logoutButton.isVisible().catch(() => false);

  if (!loggedIn) {
    const emailInput = page.locator('input[type="email"], input[placeholder*="email" i]').first();
    const passwordInput = page.locator('input[type="password"]').first();
    const loginButton = page.locator('button:has-text("Login"), button:has-text("Sign In")').first();

    await emailInput.click();
    await emailInput.fill('');
    await emailInput.type('pgadmin@cityconnect.com');
    await expect(emailInput).toHaveValue('pgadmin@cityconnect.com');

    await passwordInput.click();
    await passwordInput.fill('');
    await passwordInput.type('PgAdmin123!');
    await expect(passwordInput).toHaveValue('PgAdmin123!');

    await loginButton.click();
    await page.waitForURL(/admin-dashboard\/dashboard/i, { timeout: 15000 });
  }
}

test.describe('Admin add company modal typing behaviour', () => {
  test('typing into business name keeps focus and accumulates characters', async ({ page }) => {
    await ensureAdminSession(page);

    const companiesNav = page.getByRole('button', { name: /^companies$/i }).first();
    await companiesNav.click();
    await page.waitForTimeout(500);

    const addCompanyBtn = page.getByRole('button', { name: /add company/i }).first();
    await addCompanyBtn.click();

    const modalHeading = page.getByRole('heading', { name: /add company/i });
    await expect(modalHeading).toBeVisible();

    const nameInput = page.locator('#name').first();
    await nameInput.click();

    const sampleValue = 'playwright-test';
    await nameInput.fill('');
    await nameInput.type('p', { delay: 50 });
    const activeAfterFirst = await page.evaluate(() => ({
      tag: document.activeElement?.tagName,
      id: document.activeElement?.id,
      className: document.activeElement?.className,
      text: document.activeElement?.textContent,
    }));
    console.log('active element after first char', activeAfterFirst);
    await nameInput.type(sampleValue.slice(1), { delay: 50 });

    await expect(nameInput).toHaveValue(sampleValue);
  });
});
