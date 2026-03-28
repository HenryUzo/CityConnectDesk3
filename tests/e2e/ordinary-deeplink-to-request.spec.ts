import { expect, test } from "@playwright/test";

const RESIDENT_EMAIL = "testresident@gmail.com";

test.describe("Resident ordinary deep-link", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript((email: string) => {
      window.localStorage.setItem("dev_user_email", email);
      window.localStorage.setItem("resident_email_dev", email);
    }, RESIDENT_EMAIL);
    await page.setExtraHTTPHeaders({
      "x-user-email": RESIDENT_EMAIL,
    });
  });

  test("opens the exact request from query params instead of falling back to draft", async ({
    page,
    request,
  }) => {
    const createdResponse = await request.post("/api/service-requests", {
      headers: { "x-user-email": RESIDENT_EMAIL, "Content-Type": "application/json" },
      data: {
        category: "general_repairs",
        description: `Deep-link regression guard ${Date.now()}`,
        budget: "80000",
        urgency: "medium",
        location: "Victoria Garden City, Deep Link Lane",
        specialInstructions: "Ensure ordinary flow opens this request directly.",
      },
    });
    expect(createdResponse.ok()).toBeTruthy();
    const created = (await createdResponse.json()) as { id: string };

    await page.goto("/resident/requests/ordinary");
    await page.waitForLoadState("domcontentloaded");

    const createNewRequestCta = page.getByRole("button", { name: /Create new request/i }).first();
    if (await createNewRequestCta.isVisible().catch(() => false)) {
      await createNewRequestCta.click();
    }
    await expect(page.getByText("Select Categories")).toBeVisible();

    const plumberButton = page.getByRole("button", { name: /Plumber/i }).first();
    if (await plumberButton.isVisible().catch(() => false)) {
      await plumberButton.click();
      await expect(page.getByText(/You selected Plumber\./i)).toBeVisible();
    }

    await page.goto(
      `/resident/requests/ordinary?conversationId=${encodeURIComponent(created.id)}&requestId=${encodeURIComponent(created.id)}&serviceRequestId=${encodeURIComponent(created.id)}`,
    );
    await page.waitForLoadState("domcontentloaded");

    await expect
      .poll(
        async () =>
          page
            .locator("p")
            .filter({ hasText: /^You selected /i })
            .first()
            .textContent(),
        { timeout: 20000, intervals: [300, 700, 1000] },
      )
      .toMatch(/general repairs/i);
  });
});

