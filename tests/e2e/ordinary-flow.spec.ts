import { expect, test } from "@playwright/test";

test.describe("Ordinary conversation flow", () => {
  test.beforeEach(async ({ page }) => {
    await page.setExtraHTTPHeaders({
      "x-user-email": "testresident@gmail.com",
    });
  });

  test("category -> estate branch -> urgency -> wizard", async ({ page }) => {
    await page.goto("/resident/requests/ordinary");
    await page.waitForLoadState("domcontentloaded");

    const createNewRequestCta = page.getByRole("button", { name: /Create new request/i }).first();
    if (await createNewRequestCta.isVisible().catch(() => false)) {
      await createNewRequestCta.click();
    }

    await expect(page.getByText("Smart Intake (Ordinary Mode)")).toBeVisible();
    await expect(page.getByText("Select the service category to begin.")).toBeVisible();

    const categoryButtons = page
      .locator("button")
      .filter({ hasText: /\+ Providers available/i });
    await expect(categoryButtons.first()).toBeVisible();
    await categoryButtons.first().click();

    await expect(page.getByText("Which estate do you reside?")).toBeVisible();
    const estateButton = page
      .locator("button.rounded-xl.border.px-4.py-2")
      .filter({ hasNotText: "I don't stay in an estate" })
      .first();
    await expect(estateButton).toBeVisible();
    await estateButton.click();

    await page.getByPlaceholder("Enter your address").fill("Block 2, Saint Peters Church Street");
    await page.getByPlaceholder("Enter unit/apartment number").fill("Flat 12B");

    const continueButton = page.getByRole("button", { name: /^Continue$/ });
    await expect(continueButton).toBeEnabled();
    await continueButton.click();

    await expect(page.getByText("How urgent is this?")).toBeVisible();
    await page.getByRole("button", { name: /Emergency/i }).click();

    await expect(page.getByText("Pick the closest issue type.")).toBeVisible();
    await page.screenshot({ path: "test-results/ordinary-flow-estate.png", fullPage: true });
  });

  test("outside-estate branch asks state+lga+address before urgency", async ({ page }) => {
    await page.goto("/resident/requests/ordinary");
    await page.waitForLoadState("domcontentloaded");

    const createNewRequestCta = page.getByRole("button", { name: /Create new request/i }).first();
    if (await createNewRequestCta.isVisible().catch(() => false)) {
      await createNewRequestCta.click();
    }

    const categoryButtons = page
      .locator("button")
      .filter({ hasText: /\+ Providers available/i });
    await expect(categoryButtons.first()).toBeVisible();
    await categoryButtons.first().click();

    const outsideButton = page.getByRole("button", { name: "I don't stay in an estate" });
    await outsideButton.click();

    await expect(page.getByText("Where do you stay?")).toBeVisible();

    await page.locator("button[role='combobox']").first().click();
    await page.getByRole("option", { name: "Lagos" }).click();

    await page.locator("button[role='combobox']").nth(1).click();
    await page.getByRole("option", { name: "Alimosho" }).click();

    await page.getByPlaceholder("Enter your address").fill("2 Saint Peters Church Street");
    const continueButton = page.getByRole("button", { name: /^Continue$/ });
    await expect(continueButton).toBeEnabled();
    await continueButton.click();

    await expect(page.getByText("How urgent is this?")).toBeVisible();
    await page.screenshot({ path: "test-results/ordinary-flow-outside.png", fullPage: true });
  });
});
