import { expect, test, type APIRequestContext, type Browser } from "@playwright/test";

const RESIDENT_EMAIL = "testresident@gmail.com";
const ADMIN_EMAIL = "admin@cityconnect.com";

async function pickProvider(api: APIRequestContext) {
  const response = await api.get("/api/admin/providers", {
    headers: { "x-user-email": ADMIN_EMAIL },
  });
  expect(response.ok()).toBeTruthy();
  const providers = (await response.json()) as Array<{ id?: string | null; email?: string | null; isApproved?: boolean | null }>;
  const provider =
    providers.find((entry) => entry?.id && entry?.email && entry.isApproved !== false) ??
    providers.find((entry) => entry?.id && entry?.email);
  if (!provider?.id) {
    throw new Error("No provider found for resident delivery confirmation CTA test.");
  }
  return provider.id;
}

async function createResidentRequest(api: APIRequestContext, suffix: string) {
  const uniqueLocation = `VGC CTA ${suffix}`;
  const response = await api.post("/api/service-requests", {
    headers: { "x-user-email": RESIDENT_EMAIL, "Content-Type": "application/json" },
    data: {
      category: "general_repairs",
      description: `Resident delivery CTA test ${suffix}`,
      budget: "200000",
      urgency: "medium",
      location: uniqueLocation,
      specialInstructions: "Resident delivery CTA visibility check",
    },
  });
  expect(response.ok()).toBeTruthy();
  const created = (await response.json()) as { id: string };
  return { id: created.id, uniqueLocation };
}

async function patchStatus(api: APIRequestContext, requestId: string, status: string, providerId?: string) {
  const payload: Record<string, unknown> = { status };
  if (providerId) {
    payload.providerId = providerId;
    payload.paymentRequestedAt = new Date().toISOString();
    payload.paymentStatus = "paid";
  }
  const response = await api.patch(`/api/service-requests/${requestId}`, {
    headers: { "x-user-email": ADMIN_EMAIL, "Content-Type": "application/json" },
    data: payload,
  });
  expect(response.ok()).toBeTruthy();
}

async function createResidentPage(browser: Browser) {
  const context = await browser.newContext({
    extraHTTPHeaders: { "x-user-email": RESIDENT_EMAIL },
  });
  await context.addInitScript((email: string) => {
    window.localStorage.setItem("dev_user_email", email);
    window.localStorage.setItem("resident_email_dev", email);
  }, RESIDENT_EMAIL);
  return context.newPage();
}

test.describe("Resident delivery confirmation CTA", () => {
  test("shows confirm/raise-issue controls and opens custom modals when awaiting resident confirmation", async ({ browser, request }) => {
    const providerId = await pickProvider(request);
    const { id: requestId, uniqueLocation } = await createResidentRequest(request, String(Date.now()));

    await patchStatus(request, requestId, "assigned_for_job", providerId);
    await patchStatus(request, requestId, "in_progress");
    await patchStatus(request, requestId, "work_completed_pending_resident");

    const page = await createResidentPage(browser);
    page.on("dialog", async (dialog) => dialog.dismiss());
    await page.goto("/resident/requests/ordinary");
    await page.waitForLoadState("domcontentloaded");
    await page.getByRole("button", { name: new RegExp(uniqueLocation.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i") }).first().click();

    const confirmCta = page.getByRole("button", { name: /Confirm delivery/i });
    const raiseIssueCta = page.getByRole("button", { name: /Raise issue/i });

    await expect(confirmCta).toBeVisible({ timeout: 60000 });
    await expect(raiseIssueCta).toBeVisible({ timeout: 60000 });

    await confirmCta.click();
    await expect(page.getByRole("heading", { name: /Confirm job delivery/i })).toBeVisible();
    await page.getByRole("button", { name: /^Cancel$/i }).first().click();

    await raiseIssueCta.click();
    await expect(page.getByRole("heading", { name: /Raise delivery issue/i })).toBeVisible();
    await page.getByRole("button", { name: /^Cancel$/i }).first().click();
  });
});
