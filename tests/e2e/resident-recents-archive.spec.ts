import { expect, test } from "@playwright/test";

const RESIDENT_EMAIL = "testresident@gmail.com";

async function createResidentRequest(page: import("@playwright/test").Page, suffix: string) {
  const uniqueLocation = `Archive flow ${suffix}`;
  const response = await page.context().request.post("/api/service-requests", {
    headers: { "x-user-email": RESIDENT_EMAIL, "Content-Type": "application/json" },
    data: {
      category: "general_repairs",
      description: `Archive conversation flow ${suffix}`,
      budget: "120000",
      urgency: "medium",
      location: uniqueLocation,
      specialInstructions: "Archive recents tab test",
    },
  });
  expect(response.ok()).toBeTruthy();
  const created = (await response.json()) as { id: string };
  return { id: created.id, uniqueLocation };
}

test.describe("Resident recents archive", () => {
  test.beforeEach(async ({ page }) => {
    await page.context().setExtraHTTPHeaders({
      "x-user-email": RESIDENT_EMAIL,
    });
    await page.addInitScript(() => {
      window.localStorage.setItem("dev_user_email", "testresident@gmail.com");
      const keysToRemove: string[] = [];
      for (let i = 0; i < window.localStorage.length; i += 1) {
        const key = window.localStorage.key(i);
        if (key && key.startsWith("resident_archived_request_ids_v1:")) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach((key) => window.localStorage.removeItem(key));
    });
  });

  test("delete action archives conversation and moves it to Archived tab", async ({ page }) => {
    const { uniqueLocation } = await createResidentRequest(page, String(Date.now()));

    await page.goto("/resident/requests/ordinary");
    await page.waitForLoadState("domcontentloaded");

    const card = page.locator("div.group.relative", { hasText: uniqueLocation }).first();
    await expect(card).toBeVisible({ timeout: 60000 });

    await card.getByRole("button", { name: /Delete conversation/i }).click();
    await expect(
      page.locator("div.text-sm.opacity-90", { hasText: "Conversation moved to archived." }).first()
    ).toBeVisible();

    await expect(page.locator("div.group.relative", { hasText: uniqueLocation }).first()).toHaveCount(0);

    await page.getByRole("button", { name: /^Archived \(/i }).click();
    await expect(page.locator("div.group.relative", { hasText: uniqueLocation }).first()).toBeVisible();
  });
});
