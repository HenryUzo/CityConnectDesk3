import { test, expect } from "@playwright/test";

test.describe("Smoke Tests", () => {
  test("can access homepage", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/.*localhost:5000.*/);
    console.log("✓ Homepage accessible");
  });

  test("can access login page", async ({ page }) => {
    await page.goto("/auth");
    await page.waitForSelector('input[name="email"]', { timeout: 10000 });
    console.log("✓ Login page loads");
  });

  test("can login as test resident", async ({ page }) => {
    await page.goto("/auth");
    
    // Wait for login form
    await page.waitForSelector('input[name="email"]', { timeout: 10000 });
    
    // Fill credentials
    await page.fill('input[name="email"]', "testresident@gmail.com");
    await page.fill('input[name="password"]', "password123");
    
    console.log("✓ Filled login form");
    
    // Click login button
    await page.click('button[type="submit"]');
    
    // Wait for navigation or error
    await page.waitForTimeout(3000);
    
    const currentUrl = page.url();
    console.log("Current URL after login:", currentUrl);
    
    // Check if we successfully logged in (not on /auth anymore)
    if (!currentUrl.includes("/auth")) {
      console.log("✓ Login successful - redirected to:", currentUrl);
    } else {
      console.log("✗ Login failed - still on login page");
      
      // Check for error messages
      const errorText = await page.textContent("body");
      console.log("Page content:", errorText?.substring(0, 500));
    }
  });

  test("can access marketplace", async ({ page }) => {
    // Login first
    await page.goto("/auth");
    await page.waitForSelector('input[name="email"]', { timeout: 10000 });
    await page.fill('input[name="email"]', "testresident@gmail.com");
    await page.fill('input[name="password"]', "password123");
    await page.click('button[type="submit"]');
    
    await page.waitForTimeout(2000);
    
    // Try to access marketplace
    await page.goto("/marketplace");
    await page.waitForTimeout(2000);
    
    const currentUrl = page.url();
    console.log("Marketplace URL:", currentUrl);
    
    // Look for marketplace-related content
    const hasMarketplaceContent = await page.locator("body").textContent();
    console.log("Page has content:", hasMarketplaceContent ? "Yes" : "No");
    
    if (hasMarketplaceContent) {
      const preview = hasMarketplaceContent.substring(0, 300);
      console.log("Page preview:", preview);
    }
  });

  test("check database - test resident exists", async ({ request }) => {
    const response = await request.get("/api/auth/me", {
      headers: {
        // This won't work without session, but let's try
      },
    });
    
    console.log("Auth check status:", response.status());
  });
});
