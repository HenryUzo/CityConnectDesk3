import { expect, test } from "@playwright/test";

const RESIDENT_EMAIL = "testresident@gmail.com";

test.describe("Resident recents visibility", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 1000 });
    await page.context().setExtraHTTPHeaders({
      "x-user-email": RESIDENT_EMAIL,
    });
    await page.addInitScript((email: string) => {
      window.localStorage.setItem("dev_user_email", email);
      window.localStorage.setItem("resident_email_dev", email);
    }, RESIDENT_EMAIL);
  });

  test("shows existing conversations in sidebar recents", async ({ page }) => {
    const apiResponse = await page.context().request.get("/api/app/service-requests/mine", {
      headers: { "x-user-email": RESIDENT_EMAIL },
    });
    expect(apiResponse.ok()).toBeTruthy();
    const apiRequests = (await apiResponse.json()) as Array<{ id: string }>;
    expect(apiRequests.length).toBeGreaterThan(1);

    await page.goto("/resident/requests/ordinary");
    await page.waitForLoadState("domcontentloaded");
    await expect(page.getByRole("heading", { name: /Recents/i })).toBeVisible();

    const requestCards = page.locator("div.city-scrollbar div.group.relative");
    await expect
      .poll(async () => requestCards.count(), {
        timeout: 30000,
        intervals: [500, 1000, 2000],
      })
      .toBeGreaterThan(1);
  });
});

