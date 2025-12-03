import { test, expect } from '@playwright/test';

// Run these tests with the dev server running (npm run dev)
// Checks:
// - /book-artisan loads
// - Service Category dropdown is populated by server categories (or falls back)
// - Budget and Location inputs are NOT present
// - Form submission works

const BASE = process.env.BASE_URL ?? 'http://localhost:5000';

// Helper to log in as a resident (or create test user)
async function loginAsResident(page) {
  await page.goto(`${BASE}/auth`);
  
  // Switch to Resident tab
  const residentTab = page.getByRole('tab', { name: /resident/i });
  await residentTab.click();
  
  // Try to log in with test credentials
  const emailInput = page.locator('[data-testid="input-email"]').first();
  const passwordInput = page.locator('[data-testid="input-password"]').first();
  const loginButton = page.locator('[data-testid="button-resident-login"]');
  
  await emailInput.fill('test-resident@cityconnect.com');
  await passwordInput.fill('TestPassword123!');
  await loginButton.click();
  
  // Wait for redirect to resident dashboard (or handle registration if needed)
  await page.waitForURL(/\/(resident|auth)/, { timeout: 5000 }).catch(() => {
    // If login fails, we might be on register - that's okay for this test
  });
}

test.describe('Book Artisan page', () => {
  test('loads and shows categories; budget & location removed', async ({ page }) => {
    // Login first
    await loginAsResident(page);
    
    // Navigate to book artisan
    await page.goto(`${BASE}/book-artisan`);

    // Wait for the form to render
    await expect(page.getByRole('heading', { name: /book artisan repair/i })).toBeVisible();

    // Ensure the service category select is present
    const selectTrigger = page.locator('[data-testid="select-service-category"]');
    await expect(selectTrigger).toBeVisible();

    // Open the dropdown to reveal options
    await selectTrigger.click();

    // Wait for some option to appear - prefer server-driven option but accept fallback
    const option = page.locator('text=Electrician').first();
    await expect(option).toBeVisible({ timeout: 3000 });

    // Ensure budget input is not present
    const budget = page.locator('[data-testid="input-budget"]');
    await expect(budget).toHaveCount(0);

    // Ensure location input is not present
    const location = page.locator('[data-testid="input-location"]');
    await expect(location).toHaveCount(0);
  });

  test('submits service request successfully', async ({ page }) => {
    // Login first
    await loginAsResident(page);
    
    // Navigate to book artisan
    await page.goto(`${BASE}/book-artisan`);

    // Wait for form to load
    await expect(page.getByRole('heading', { name: /book artisan repair/i })).toBeVisible();

    // Select category - open dropdown and pick Electrician
    const categorySelect = page.locator('[data-testid="select-service-category"]');
    await categorySelect.click();
    await page.locator('text=Electrician').first().click();

    // Fill description
    const descriptionField = page.locator('[data-testid="textarea-description"]');
    await descriptionField.fill('Need to fix electrical wiring in the living room. Multiple outlets not working.');

    // Select urgency
    const urgencySelect = page.locator('[data-testid="select-urgency"]');
    await urgencySelect.click();
    await page.locator('text=High - Within 24 hours').click();

    // Fill preferred time (optional)
    const preferredTimeInput = page.locator('[data-testid="input-preferred-time"]');
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const datetimeString = tomorrow.toISOString().slice(0, 16); // YYYY-MM-DDTHH:mm
    await preferredTimeInput.fill(datetimeString);

    // Fill special instructions (optional)
    const specialInstructionsField = page.locator('[data-testid="textarea-special-instructions"]');
    await specialInstructionsField.fill('Please bring testing equipment. Access code for gate is 1234.');

    // Submit the form
    const submitButton = page.locator('[data-testid="button-submit-request"]');
    await submitButton.click();

    // Wait for success (redirect to dashboard or toast notification)
    // The mutation should redirect to /resident on success
    await page.waitForURL(/\/resident/, { timeout: 10000 });

    // Verify we're on the resident dashboard
    await expect(page.getByRole('heading', { name: /dashboard/i })).toBeVisible({ timeout: 5000 });
  });

  test('cancel button returns to dashboard', async ({ page }) => {
    // Login first
    await loginAsResident(page);
    
    // Navigate to book artisan
    await page.goto(`${BASE}/book-artisan`);

    // Click cancel button
    const cancelButton = page.locator('[data-testid="button-cancel"]');
    await cancelButton.click();

    // Should redirect to resident dashboard
    await page.waitForURL(/\/resident/, { timeout: 5000 });
    await expect(page.getByRole('heading', { name: /dashboard/i })).toBeVisible();
  });
});
