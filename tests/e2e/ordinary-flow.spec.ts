import { expect, test, type Page } from "@playwright/test";

async function openOrdinaryFlowAndSelectFirstCategory(page: Page) {
  await page.goto("/resident/requests/ordinary");
  await page.waitForLoadState("domcontentloaded");

  const createNewRequestCta = page.getByRole("button", { name: /Create new request/i }).first();
  if (await createNewRequestCta.isVisible().catch(() => false)) {
    await createNewRequestCta.click();
  }

  await expect(page.getByText("Select Categories")).toBeVisible();

  const categoryButton = page.locator('[data-name="Form"] button').first();
  await expect(categoryButton).toBeVisible();
  await categoryButton.click();
}

test.describe("Ordinary conversation flow", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem("dev_user_email", "testresident@gmail.com");
    });
    await page.setExtraHTTPHeaders({
      "x-user-email": "testresident@gmail.com",
    });
  });

  test("category -> estate branch -> urgency -> wizard", async ({ page }) => {
    await openOrdinaryFlowAndSelectFirstCategory(page);

    await expect(page.getByText("Do you live in a CityConnect estate?")).toBeVisible();
    await page.getByRole("button", { name: /^Yes$/i }).click();

    const estateOption = page.getByRole("button", { name: /Victoria Garden City/i }).first();
    if (await estateOption.isVisible({ timeout: 5000 }).catch(() => false)) {
      await estateOption.click();
    }

    const addressField = page.getByPlaceholder("Enter your address").first();
    if (await addressField.isVisible({ timeout: 5000 }).catch(() => false)) {
      await addressField.fill("Block 2, Saint Peters Church Street");
      const unitField = page.getByPlaceholder("Enter unit/apartment number").first();
      if (await unitField.isVisible().catch(() => false)) {
        await unitField.fill("Flat 12B");
      }
      const addLocationButton = page.getByRole("button", { name: /^Add location$/i });
      await expect(addLocationButton).toBeEnabled();
      await addLocationButton.click();
    }

    await expect(page.getByText(/How urgent is this\?|Pick the closest issue type\.|Conversation with your provider/i).first()).toBeVisible();
    await page.screenshot({ path: "test-results/ordinary-flow-estate.png", fullPage: true });
  });

  test("outside-estate branch asks state+lga+address before urgency", async ({ page }) => {
    await openOrdinaryFlowAndSelectFirstCategory(page);

    await page.getByRole("button", { name: /^No$/i }).click();
    await expect(page.getByText("Select state/LGA")).toBeVisible();

    const stateField = page
      .locator("p")
      .filter({ hasText: /^State$/i })
      .first()
      .locator("xpath=..");
    await stateField.getByRole("combobox").click();
    await page.locator("[role='listbox']").last().getByRole("option", { name: "Lagos" }).click();

    const lgaField = page
      .locator("p")
      .filter({ hasText: /^LGA$/i })
      .first()
      .locator("xpath=..");
    await lgaField.getByRole("combobox").click();
    await page.locator("[role='listbox']").last().getByRole("option", { name: "Alimosho" }).click();

    await expect(page.getByText("Enter your address.")).toBeVisible();
    await page.getByPlaceholder("Enter your address").fill("2 Saint Peters Church Street");

    const addLocationButton = page.getByRole("button", { name: /^Add location$/i });
    await expect(addLocationButton).toBeEnabled();
    await addLocationButton.click();

    await expect(page.getByText("How urgent is this?")).toBeVisible();
    await page.screenshot({ path: "test-results/ordinary-flow-outside.png", fullPage: true });
  });
});

async function pickProvider(page: Page) {
  const response = await page.context().request.get('/api/admin/providers', {
    headers: { 'x-user-email': 'admin@cityconnect.com' },
  });
  expect(response.ok()).toBeTruthy();
  const providers = (await response.json()) as Array<{ id?: string | null; email?: string | null; isApproved?: boolean | null }>;
  const provider = providers.find((entry) => entry?.id && entry?.email && entry.isApproved !== false) ?? providers.find((entry) => entry?.id && entry?.email);
  if (!provider?.id || !provider?.email) {
    throw new Error('No provider with an id and email was found for smoke testing.');
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

test("provider shell routes render with shared chrome", async ({ page }) => {
  const provider = await pickProvider(page);
  await loginAsProvider(page, provider);

  const routes = [
    { path: '/provider/dashboard', title: /Welcome|Dashboard/i, nav: /Dashboard/i },
    { path: '/provider/jobs', title: /My Jobs/i, nav: /Jobs/i },
    { path: '/provider/tasks', title: /My Tasks/i, nav: /Tasks/i },
    { path: '/provider/chat', title: /Provider Chat/i, nav: /Chat/i },
    { path: '/provider/stores', title: /My Stores/i, nav: /Stores/i },
    { path: '/provider/marketplace', title: /Marketplace/i, nav: /Marketplace/i },
    { path: '/provider/company-registration', title: /Register business/i, nav: /Business/i },
  ];

  for (const route of routes) {
    await page.goto(route.path);
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByRole('heading', { name: route.title }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: route.nav }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: /CityConnect Provider Hub/i }).first()).toBeVisible();
  }
});

