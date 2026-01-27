import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

(async () => {
  const outDir = path.resolve(process.cwd(), 'screenshots');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir);

  const browser = await chromium.launch();
  const page = await browser.newPage();
  try {
    await page.goto('http://127.0.0.1:5173', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(outDir, 'homepage-node.png'), fullPage: true });

    const createSelectors = ['text=Create New Category', 'text=Create Category', 'text=New Category', 'button:has-text("Create Category")'];
    for (const sel of createSelectors) {
      try {
        await page.click(sel, { timeout: 1500 });
        await page.waitForTimeout(500);
        break;
      } catch (err) {
        // ignore
      }
    }

    const dialogTitle = await page.locator('text=Create New Category').first();
    if ((await dialogTitle.count()) > 0) {
      await dialogTitle.screenshot({ path: path.join(outDir, 'create-modal-title-node.png') });
    }

    const dialogContainer = await page.locator('[role="dialog"]').first();
    if ((await dialogContainer.count()) > 0) {
      await dialogContainer.screenshot({ path: path.join(outDir, 'create-modal-node.png') });
    }

    try {
      await page.click('text=Edit', { timeout: 1500 });
      await page.waitForTimeout(500);
      const editDialog = await page.locator('text=Edit Category').first();
      if ((await editDialog.count()) > 0) {
        await editDialog.screenshot({ path: path.join(outDir, 'edit-modal-title-node.png') });
      }
      const editContainer = await page.locator('[role="dialog"]').first();
      if ((await editContainer.count()) > 0) {
        await editContainer.screenshot({ path: path.join(outDir, 'edit-modal-node.png') });
      }
    } catch (err) {
      // no edit
    }
  } finally {
    await browser.close();
  }
  console.log('Screenshots saved to', outDir);
})();
