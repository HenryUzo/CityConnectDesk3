import { chromium } from 'playwright';
import fs from 'fs';

// This script assumes your dev server is available at http://localhost:5173
// and the backend is proxied via Vite (/api -> http://localhost:5000).
// It will perform a UI login and save a HAR to scripts/playwright-login.har

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ recordHar: { path: 'scripts/playwright-login.har' } });
  const page = await context.newPage();

  try {
    console.log('Navigating to Vite dev server...');
    await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });

    // Go to admin-super-dashboard route or login route
    // Adjust selectors if your login form differs
    // admin UI lives at /admin-dashboard
    await page.goto('http://localhost:5173/admin-dashboard', { waitUntil: 'networkidle' });

    // Wait for email input
    const emailSelector = '[data-testid="input-admin-email"]';
    const passSelector = '[data-testid="input-admin-password"]';
    const buttonSelector = '[data-testid="button-admin-login"]';

    // allow more time for dev server to compile and hydrate
    await page.waitForSelector(emailSelector, { timeout: 15000 });
    await page.fill(emailSelector, 'pgadmin@cityconnect.com');
    await page.fill(passSelector, 'PgAdmin123!');

    console.log('Submitting login form...');
    await page.click(buttonSelector);

    // Wait for a success indicator (dashboard nav) instead of full navigation
    console.log('Login submitted, waiting for dashboard content...');
    await page.waitForSelector('[data-testid="nav-dashboard"]', { timeout: 20000 });

    console.log('Finished. HAR saved to scripts/playwright-login.har');
  } catch (err) {
    console.error('Playwright run failed:', err);
  } finally {
    await context.close();
    await browser.close();
  }
})();
