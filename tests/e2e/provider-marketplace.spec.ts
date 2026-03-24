import { expect, test, type Page, type Request } from "@playwright/test";

async function pickProvider(page: Page) {
  const response = await page.context().request.get('/api/admin/providers', {
    headers: { 'x-user-email': 'admin@cityconnect.com' },
  });
  expect(response.ok()).toBeTruthy();

  const providers = (await response.json()) as Array<{
    id?: string | null;
    email?: string | null;
    isApproved?: boolean | null;
  }>;

  const provider =
    providers.find((entry) => entry?.id && entry?.email && entry.isApproved !== false) ??
    providers.find((entry) => entry?.id && entry?.email);

  if (!provider?.id || !provider?.email) {
    throw new Error('No provider with an id and email was found for marketplace testing.');
  }

  return { id: provider.id, email: provider.email };
}

async function loginAsProvider(page: Page, provider: { id: string; email: string }) {
  const password = 'Provider123!';

  const resetResponse = await page.context().request.post(`/api/admin/users/${provider.id}/reset-password`, {
    headers: { 'x-user-email': 'admin@cityconnect.com', 'Content-Type': 'application/json' },
    data: { password },
  });
  expect(resetResponse.ok()).toBeTruthy();

  const loginResponse = await page.context().request.post('/api/login', {
    headers: { 'Content-Type': 'application/json' },
    data: { username: provider.email, password },
  });
  expect(loginResponse.ok()).toBeTruthy();
}

test.describe('Provider marketplace endpoint isolation', () => {
  test('uses provider-safe endpoints and routes Store operations CTA correctly', async ({ page }) => {
    const provider = await pickProvider(page);
    await loginAsProvider(page, provider);

    const observedRequests: string[] = [];
    page.on('request', (request: Request) => {
      observedRequests.push(request.url());
    });

    const storesResponsePromise = page.waitForResponse((response) => {
      return response.request().method() === 'GET' && /\/api\/provider\/marketplace\/stores(?:\?|$)/.test(response.url());
    });

    const categoriesResponsePromise = page.waitForResponse((response) => {
      return response.request().method() === 'GET' && /\/api\/provider\/marketplace\/categories(?:\?|$)/.test(response.url());
    });

    const itemsResponsePromise = page.waitForResponse((response) => {
      return response.request().method() === 'GET' && /\/api\/provider\/marketplace\/items(?:\?|$)/.test(response.url());
    });

    await page.goto('/provider/marketplace');
    await page.waitForLoadState('domcontentloaded');

    const [storesResponse, categoriesResponse, itemsResponse] = await Promise.all([
      storesResponsePromise,
      categoriesResponsePromise,
      itemsResponsePromise,
    ]);


    const adminMarketplaceCalls = observedRequests.filter((url) => /\/api\/admin\/marketplace(?:\?|$)/.test(url));
    expect(adminMarketplaceCalls).toHaveLength(0);

    const providerMarketplaceCalls = observedRequests.filter((url) =>
      /\/api\/provider\/marketplace\/(stores|categories|items)(?:\?|$)/.test(url),
    );
    expect(providerMarketplaceCalls.length).toBeGreaterThanOrEqual(3);

    const goToStores = page.getByRole('button', { name: /Go to stores/i });
    await expect(goToStores).toBeVisible();
    await goToStores.click();

    await expect(page).toHaveURL(/\/provider\/stores(?:\?|$)/);
    await expect(page.getByRole('heading', { name: /My Stores/i })).toBeVisible();
  });
});


