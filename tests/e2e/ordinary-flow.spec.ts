import { expect, test, type Page } from "@playwright/test";

async function openOrdinaryFlowAndSelectFirstCategory(page: Page) {
  await page.goto("/resident/requests/ordinary");
  await page.waitForLoadState("domcontentloaded");

  const createNewRequestCta = page.getByRole("button", { name: /Create new request/i }).first();
  if (await createNewRequestCta.isVisible().catch(() => false)) {
    await createNewRequestCta.click();
  }

  await expect(page.getByText("Request Assistant")).toBeVisible();
  await expect(page.getByText("Select Categories")).toBeVisible();

  const categoryButton = page.locator('[data-name="Form"] button').first();
  await expect(categoryButton).toBeVisible();
  await categoryButton.click();
}

test.describe("Ordinary conversation flow", () => {
  test.beforeEach(async ({ page }) => {
    await page.setExtraHTTPHeaders({
      "x-user-email": "testresident@gmail.com",
    });
  });

  test("category -> estate branch -> urgency -> wizard", async ({ page }) => {
    await openOrdinaryFlowAndSelectFirstCategory(page);

    await expect(page.getByText("Which estate do you reside?")).toBeVisible();

    await page.getByPlaceholder("Enter your address").fill("Block 2, Saint Peters Church Street");
    await page.getByPlaceholder("Enter unit/apartment number").fill("Flat 12B");

    const addLocationButton = page.getByRole("button", { name: /^Add location$/i });
    await expect(addLocationButton).toBeEnabled();
    await addLocationButton.click();

    await expect(page.getByText("How urgent is this?")).toBeVisible();
    await page.getByRole("button", { name: /Emergency/i }).click();

    await expect(page.getByText("Pick the closest issue type.")).toBeVisible();
    await page.screenshot({ path: "test-results/ordinary-flow-estate.png", fullPage: true });
  });

  test("outside-estate branch asks state+lga+address before urgency", async ({ page }) => {
    await openOrdinaryFlowAndSelectFirstCategory(page);

    const outsideButton = page.getByRole("button", { name: "I don't stay in an estate" });
    await outsideButton.click();

    await expect(page.getByText("Where do you stay?")).toBeVisible();

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

    await page.getByPlaceholder("Enter your address").fill("2 Saint Peters Church Street");

    const addLocationButton = page.getByRole("button", { name: /^Add location$/i });
    await expect(addLocationButton).toBeEnabled();
    await addLocationButton.click();

    await expect(page.getByText("How urgent is this?")).toBeVisible();
    await page.screenshot({ path: "test-results/ordinary-flow-outside.png", fullPage: true });
  });
});
