import { chromium } from 'playwright';

const BASE_URL = 'http://localhost:5000';

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  await page.goto(`${BASE_URL}/admin-dashboard`);
  await page.locator('input[data-testid="input-admin-email"]').fill('pgadmin@cityconnect.com');
  await page.locator('input[data-testid="input-admin-password"]').fill('PgAdmin123!');
  await page.locator('button[data-testid="button-admin-login"]').click();
  await page.waitForURL(/admin-dashboard/, { timeout: 10000 });

  await page.goto(`${BASE_URL}/admin-dashboard/companies`);
  await page.locator('[data-testid="button-open-add-company"]').click();
  const nameInput = page.locator('#name').first();
  await nameInput.click();
  await nameInput.type('p', { delay: 50 });

  const activeElement = await page.evaluate(() => ({
    tag: document.activeElement?.tagName,
    id: document.activeElement?.id,
    classes: document.activeElement?.className,
    text: document.activeElement?.textContent?.trim(),
  }));

  console.log(activeElement);

  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
