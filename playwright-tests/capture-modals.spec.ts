import { test } from '@playwright/test';

test('capture homepage and try to capture category modals', async ({ page }) => {
  await page.goto('http://localhost:5173');
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'screenshots/homepage-pw.png', fullPage: true });

  // Try to open a Create Category modal by clicking buttons that commonly open it.
  const createSelectors = ['text=Create New Category', 'text=Create Category', 'text=New Category', 'button:has-text("Create Category")'];
  for (const sel of createSelectors) {
    try {
      await page.click(sel, { timeout: 1500 });
      await page.waitForTimeout(500);
      break;
    } catch (err) {
      // ignore and try next selector
    }
  }

  // If dialog title exists, capture it; otherwise capture visible modal container
  const dialogTitle = page.locator('text=Create New Category').first();
  if (await dialogTitle.count() > 0) {
    await dialogTitle.screenshot({ path: 'screenshots/create-modal-title-pw.png' });
  }

  // Attempt to capture the modal container
  const dialogContainer = page.locator('[role="dialog"]').first();
  if (await dialogContainer.count() > 0) {
    await dialogContainer.screenshot({ path: 'screenshots/create-modal-pw.png' });
  }

  // Try to open Edit dialog by clicking an Edit button if available
  try {
    await page.click('text=Edit', { timeout: 1500 });
    await page.waitForTimeout(500);
    const editDialog = page.locator('text=Edit Category').first();
    if (await editDialog.count() > 0) {
      await editDialog.screenshot({ path: 'screenshots/edit-modal-title-pw.png' });
    }
    const editContainer = page.locator('[role="dialog"]').first();
    if (await editContainer.count() > 0) {
      await editContainer.screenshot({ path: 'screenshots/edit-modal-pw.png' });
    }
  } catch (err) {
    // no edit button found — that's fine
  }
});
