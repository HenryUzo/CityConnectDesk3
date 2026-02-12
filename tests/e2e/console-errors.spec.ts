import { test } from '@playwright/test';

test('Check browser console for errors', async ({ page }) => {
  const consoleMessages: string[] = [];
  const errors: string[] = [];

  page.on('console', msg => {
    const text = msg.text();
    consoleMessages.push(`[${msg.type()}] ${text}`);
    if (msg.type() === 'error') {
      errors.push(text);
    }
  });

  page.on('pageerror', error => {
    errors.push(`PAGE ERROR: ${error.message}`);
  });

  await page.goto('/');
  await page.waitForTimeout(3000);

  console.log('\n=== CONSOLE MESSAGES ===');
  consoleMessages.forEach(msg => console.log(msg));

  console.log('\n=== ERRORS ===');
  if (errors.length > 0) {
    errors.forEach(err => console.log(err));
  } else {
    console.log('No errors found');
  }

  console.log(`\nTotal console messages: ${consoleMessages.length}`);
  console.log(`Total errors: ${errors.length}`);
});
