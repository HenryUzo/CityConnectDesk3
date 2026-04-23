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

test.describe("Ordinary draft autosave", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem("dev_user_email", "testresident@gmail.com");
      if (!window.sessionStorage.getItem("ordinary_flow_e2e_started")) {
        Object.keys(window.localStorage)
          .filter((key) => key.startsWith("ordinary_flow_draft_v1:"))
          .forEach((key) => window.localStorage.removeItem(key));
        window.sessionStorage.setItem("ordinary_flow_e2e_started", "1");
      }
    });
    await page.setExtraHTTPHeaders({
      "x-user-email": "testresident@gmail.com",
    });
  });

  test("answered prompts persist and restore after reload", async ({ page }) => {
    await openOrdinaryFlowAndSelectFirstCategory(page);

    await expect(page.getByText("Do you live in an estate registered with CityConnect?")).toBeVisible();
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

    const addressValue = "2 Saint Peters Church Street";
    const addressField = page.getByPlaceholder("Enter your address").first();
    await expect(addressField).toBeVisible();
    await addressField.fill(addressValue);

    const addLocationButton = page.getByRole("button", { name: /^Add location$/i });
    await expect(addLocationButton).toBeEnabled();
    await addLocationButton.click();

    await expect(page.getByText("How urgent is this?")).toBeVisible();

    await page.reload();
    await page.waitForLoadState("domcontentloaded");

    await expect(page.getByText(/You selected/i).first()).toBeVisible();
    await expect(page.getByText("Do you live in an estate registered with CityConnect?").first()).toBeVisible();
    await expect(page.getByText(addressValue).first()).toBeVisible();
    await expect(page.getByText("Draft").first()).toBeVisible();
  });
});
