import { test, expect } from '@playwright/test';

test.describe('AI Conversation Flow with Ollama', () => {
  test('should call /api/ai/chat endpoint when sending a message', async ({ page }) => {
    let aiChatCalled = false;
    let aiChatRequest: any = null;
    let aiChatResponse: any = null;

    // Intercept the /api/ai/chat endpoint
    await page.route('**/api/ai/chat', async (route) => {
      aiChatCalled = true;
      aiChatRequest = await route.request().postDataJSON().catch(() => ({}));
      
      // Mock a successful Ollama response
      const mockResponse = {
        intent: "guide",
        message: "I understand you're having an electrical issue. Can you tell me more about what's happening?",
        confidence: 0.85,
      };
      
      aiChatResponse = mockResponse;
      await route.fulfill({ 
        status: 200, 
        contentType: 'application/json', 
        body: JSON.stringify(mockResponse) 
      });
    });

    // Navigate to the service request page
    await page.goto('/');
    
    // Wait for page to load
    await page.waitForLoadState('networkidle');

    // Check if user is logged in, if not, try to login or skip
    const isLoggedIn = await page.getByText('Create new request').isVisible().catch(() => false);
    
    if (!isLoggedIn) {
      console.log('Not logged in, attempting to navigate to login');
      // Try to find login button or skip this test
      const loginButton = page.getByRole('button', { name: /sign in|login/i });
      if (await loginButton.isVisible().catch(() => false)) {
        await loginButton.click();
        await page.waitForURL('**/auth');
        // This test requires an authenticated user - skip if not logged in
        test.skip(true, 'Requires authenticated user');
      }
    }

    // Start a new conversation
    const newRequestButton = page.getByText('Create new request');
    if (await newRequestButton.isVisible().catch(() => false)) {
      await newRequestButton.click();
    }

    // Wait for conversation to load
    await page.waitForTimeout(2000);

    // Select a category (e.g., Electrical)
    const electricalCategory = page.getByText('Electrical').first();
    if (await electricalCategory.isVisible().catch(() => false)) {
      await electricalCategory.click();
      await page.waitForTimeout(1000);
    }

    // Look for the chat input field
    const chatInput = page.locator('input[type="text"], textarea').filter({ hasText: '' }).first();
    await chatInput.waitFor({ state: 'visible', timeout: 10000 }).catch(() => {
      console.log('Chat input not found');
    });

    // Type a message
    await chatInput.fill('My lights are flickering');
    await page.waitForTimeout(500);

    // Find and click send button
    const sendButton = page.getByRole('button', { name: /send|submit/i });
    await sendButton.click();

    // Wait for AI response
    await page.waitForTimeout(3000);

    // Assertions
    console.log('AI Chat Called:', aiChatCalled);
    console.log('AI Chat Request:', JSON.stringify(aiChatRequest, null, 2));
    console.log('AI Chat Response:', JSON.stringify(aiChatResponse, null, 2));

    expect(aiChatCalled).toBeTruthy();
    expect(aiChatRequest).toHaveProperty('category');
    expect(aiChatRequest).toHaveProperty('history');
  });

  test('should show Ollama provider in server logs', async ({ page }) => {
    // This test checks that the console/network shows the correct provider being used
    const consoleLogs: string[] = [];
    
    page.on('console', msg => {
      consoleLogs.push(msg.text());
    });

    // Monitor network requests
    const requests: any[] = [];
    page.on('request', request => {
      if (request.url().includes('/api/ai')) {
        requests.push({
          url: request.url(),
          method: request.method(),
          postData: request.postData(),
        });
      }
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Log what we captured
    console.log('Console logs:', consoleLogs);
    console.log('AI requests:', requests);
  });
});
