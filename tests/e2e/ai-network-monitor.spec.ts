import { test, expect } from '@playwright/test';

test.describe('AI Chat Network Test', () => {
  test('monitor /api/ai/chat calls', async ({ page }) => {
    const aiChatRequests: any[] = [];
    const allApiRequests: any[] = [];

    // Monitor all network activity
    page.on('request', request => {
      const url = request.url();
      if (url.includes('/api/')) {
        allApiRequests.push({
          method: request.method(),
          url,
          timestamp: new Date().toISOString()
        });
      }
      if (url.includes('/api/ai/chat')) {
        console.log('[REQUEST] /api/ai/chat called!');
        aiChatRequests.push({
          method: request.method(),
          url,
          postData: request.postData(),
        });
      }
    });

    page.on('response', async response => {
      if (response.url().includes('/api/ai/chat')) {
        console.log('[RESPONSE] /api/ai/chat response:', response.status());
        const body = await response.text().catch(() => 'Could not read body');
        console.log('[RESPONSE BODY]', body);
      }
    });

    // Go to homepage
    await page.goto('/');
   await page.waitForTimeout(2000);

    // Print what we found
    console.log('\n=== ALL API REQUESTS ===');
    console.log(JSON.stringify(allApiRequests, null, 2));
    
    console.log('\n=== AI CHAT REQUESTS ===');
    console.log(JSON.stringify(aiChatRequests, null, 2));
    
    console.log(`\nTotal API requests: ${allApiRequests.length}`);
    console.log(`AI Chat requests: ${aiChatRequests.length}`);
  });
});
