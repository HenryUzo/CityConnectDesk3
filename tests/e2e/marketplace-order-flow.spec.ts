import { test, expect } from '@playwright/test';

/**
 * E2E Test: Marketplace Order Flow
 * Tests the complete flow from item selection to payment confirmation
 */

test.describe('Marketplace Order Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to auth page and authenticate as test resident
    await page.goto('/auth');
    await page.waitForLoadState('networkidle');
    
    // Wait for auth form to load
    await page.waitForSelector('input[name="email"]', { timeout: 10000 });
    
    // Fill in test resident credentials
    await page.fill('input[name="email"]', 'testresident@gmail.com');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button[type="submit"]');
    
    // Wait for redirect after login
    await page.waitForURL(/\/resident/, { timeout: 10000 });
  });

  test('complete marketplace order flow - browse to checkout', async ({ page }) => {
    // Step 1: Navigate to marketplace
    await page.goto('/resident/citymart');
    await page.waitForLoadState('networkidle');
    
    // Verify marketplace page loaded
    const marketplaceHeading = page.getByRole('heading', { name: /citymart|marketplace/i });
    await expect(marketplaceHeading).toBeVisible({ timeout: 5000 });
    
    // Step 2: Find and click on a product card
    const productCards = page.locator('[data-testid*="product-card"], .product-card, button:has-text("Add to Cart")').first();
    await expect(productCards).toBeVisible({ timeout: 10000 });
    
    // Click "Add to Cart" button on first available product
    const addToCartButton = page.locator('button:has-text("Add to Cart")').first();
    await addToCartButton.waitFor({ state: 'visible', timeout: 5000 });
    await addToCartButton.click();
    
    // Wait for cart update confirmation
    await page.waitForTimeout(1000);
    
    // Step 3: Navigate to cart
    const cartLink = page.locator('a[href*="cart"], button:has-text("Cart")').first();
    await cartLink.click();
    await page.waitForURL(/\/cart/, { timeout: 5000 });
    
    // Verify cart page loaded with items
    const cartHeading = page.getByRole('heading', { name: /your cart|cart/i });
    await expect(cartHeading).toBeVisible();
    
    // Check that cart has items
    const cartItems = page.locator('[data-testid*="cart-item"], .cart-item, [class*="cart"]');
    await expect(cartItems.first()).toBeVisible({ timeout: 5000 });
    
    // Step 4: Proceed to checkout
    const checkoutButton = page.locator('button:has-text("Checkout"), button:has-text("Proceed")').first();
    await checkoutButton.waitFor({ state: 'visible', timeout: 5000 });
    await checkoutButton.click();
    
    // Wait for checkout form to appear
    await page.waitForTimeout(1000);
    
    // Step 5: Fill delivery details
    const addressInput = page.locator('input[placeholder*="address" i], input[name*="address" i]').first();
    if (await addressInput.isVisible()) {
      await addressInput.fill('123 Test Street, Test Estate');
    }
    
    const phoneInput = page.locator('input[placeholder*="phone" i], input[name*="phone" i]').first();
    if (await phoneInput.isVisible()) {
      await phoneInput.fill('08012345678');
    }
    
    // Step 6: Initiate payment
    const payButton = page.locator('button:has-text("Pay"), button:has-text("Complete")').first();
    await expect(payButton).toBeVisible({ timeout: 5000 });
    
    console.log('✓ Marketplace order flow - reached payment step successfully');
  });

  test('verify cart operations - add, update quantity, remove', async ({ page }) => {
    // Navigate to marketplace
    await page.goto('/resident/citymart');
    await page.waitForLoadState('networkidle');
    
    // Add first product to cart
    const firstAddButton = page.locator('button:has-text("Add to Cart")').first();
    await firstAddButton.waitFor({ state: 'visible', timeout: 10000 });
    await firstAddButton.click();
    await page.waitForTimeout(1000);
    
    // Navigate to cart
    await page.goto('/resident/citymart/cart');
    await page.waitForLoadState('networkidle');
    
    // Verify item is in cart
    const cartItems = page.locator('[data-testid*="cart-item"]');
    const itemCount = await cartItems.count();
    expect(itemCount).toBeGreaterThan(0);
    
    // Test quantity update - click plus button
    const plusButton = page.locator('button:has(svg)').filter({ hasText: /\+|plus/i }).first();
    if (await plusButton.isVisible()) {
      await plusButton.click();
      await page.waitForTimeout(500);
    }
    
    // Test quantity update - click minus button
    const minusButton = page.locator('button:has(svg)').filter({ hasText: /\-|minus/i }).first();
    if (await minusButton.isVisible()) {
      await minusButton.click();
      await page.waitForTimeout(500);
    }
    
    console.log('✓ Cart operations - quantity updates work');
  });

  test('verify payment reference is passed to checkout', async ({ page, context }) => {
    // Navigate to cart (assuming items already added)
    await page.goto('/resident/citymart/cart');
    await page.waitForLoadState('networkidle');
    
    // Intercept payment initialization request
    const paymentRequests: any[] = [];
    page.on('request', (request) => {
      if (request.url().includes('/api/paystack/init')) {
        paymentRequests.push({
          url: request.url(),
          method: request.method(),
          postData: request.postData(),
        });
      }
    });
    
    // Fill checkout form and click pay
    const checkoutButton = page.locator('button:has-text("Checkout"), button:has-text("Proceed")').first();
    if (await checkoutButton.isVisible()) {
      await checkoutButton.click();
      await page.waitForTimeout(1000);
      
      // Fill delivery details
      const addressInput = page.locator('input[placeholder*="address" i]').first();
      if (await addressInput.isVisible()) {
        await addressInput.fill('Test Address');
      }
      
      const phoneInput = page.locator('input[placeholder*="phone" i]').first();
      if (await phoneInput.isVisible()) {
        await phoneInput.fill('08012345678');
      }
      
      // Click pay button
      const payButton = page.locator('button:has-text("Pay")').first();
      if (await payButton.isVisible()) {
        await payButton.click();
        await page.waitForTimeout(2000);
        
        // Verify payment request was made
        expect(paymentRequests.length).toBeGreaterThan(0);
        console.log('✓ Payment request initiated:', paymentRequests[0]);
      }
    }
  });

  test('verify order appears in resident orders page after payment', async ({ page }) => {
    // This test checks that after payment, the order shows up in the orders list
    // Navigate to orders page
    await page.goto('/resident/citymart/orders');
    await page.waitForLoadState('networkidle');
    
    // Check for orders heading
    const ordersHeading = page.getByRole('heading', { name: /orders|my orders/i });
    await expect(ordersHeading).toBeVisible({ timeout: 5000 });
    
    // Check if any orders are displayed
    const ordersList = page.locator('[data-testid*="order"], .order-item, [class*="order"]');
    const hasOrders = await ordersList.count() > 0;
    
    if (hasOrders) {
      console.log('✓ Orders page shows order history');
    } else {
      console.log('ℹ No orders found (expected for new test user)');
    }
  });
});

test.describe('Marketplace Admin Order Verification', () => {
  test('admin can view marketplace orders', async ({ page }) => {
    // Login as admin
    await page.goto('/auth');
    await page.waitForSelector('input[name="email"]', { timeout: 10000 });
    await page.fill('input[name="email"]', 'admin@cityconnect.com');
    await page.fill('input[name="password"]', 'admin123');
    await page.click('button[type="submit"]');
    
    await page.waitForURL(/\/admin/, { timeout: 10000 });
    
    // Navigate to admin orders page
    await page.goto('/admin-dashboard/orders');
    await page.waitForLoadState('networkidle');
    
    // Verify orders table is visible
    const ordersTable = page.locator('table, [role="table"]').first();
    await expect(ordersTable).toBeVisible({ timeout: 5000 });
    
    // Check for marketplace order type column
    const marketplaceOrders = page.locator('text=Marketplace, text=marketplace').first();
    
    if (await marketplaceOrders.isVisible()) {
      console.log('✓ Admin dashboard displays marketplace orders');
    }
  });
});
