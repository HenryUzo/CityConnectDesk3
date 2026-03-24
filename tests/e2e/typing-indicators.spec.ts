import { expect, test, type APIRequestContext, type Browser, type Page } from "@playwright/test";

const ADMIN_EMAIL = "admin@cityconnect.com";
const RESIDENT_EMAIL = "testresident@gmail.com";

type ProviderRecord = {
  id: string;
  email: string;
};

async function createRolePage(browser: Browser, email: string) {
  const context = await browser.newContext({
    extraHTTPHeaders: { "x-user-email": email },
  });
  await context.addInitScript((userEmail: string) => {
    window.localStorage.setItem("dev_user_email", userEmail);
    window.localStorage.setItem("resident_email_dev", userEmail);
  }, email);
  return context.newPage();
}

async function pickProvider(api: APIRequestContext): Promise<ProviderRecord> {
  const response = await api.get("/api/admin/providers", {
    headers: { "x-user-email": ADMIN_EMAIL },
  });
  expect(response.ok()).toBeTruthy();
  const providers = (await response.json()) as Array<{ id?: string | null; email?: string | null; isApproved?: boolean | null }>;
  const provider =
    providers.find((entry) => entry?.id && entry?.email && entry.isApproved !== false) ??
    providers.find((entry) => entry?.id && entry?.email);
  if (!provider?.id || !provider?.email) {
    throw new Error("No provider with id/email available for typing indicator test.");
  }
  return { id: provider.id, email: provider.email };
}

async function loginAsProvider(page: Page, provider: ProviderRecord) {
  const password = "Provider123!";
  const resetResponse = await page.context().request.post(`/api/admin/users/${provider.id}/reset-password`, {
    headers: { "x-user-email": ADMIN_EMAIL, "Content-Type": "application/json" },
    data: { password },
  });
  expect(resetResponse.ok()).toBeTruthy();

  const loginResponse = await page.context().request.post("/api/login", {
    headers: { "Content-Type": "application/json" },
    data: { username: provider.email, password },
  });
  expect(loginResponse.ok()).toBeTruthy();
}

async function createProviderSession(browser: Browser, provider: ProviderRecord) {
  const providerPage = await createRolePage(browser, provider.email);
  await loginAsProvider(providerPage, provider);
  return providerPage;
}

async function createResidentRequest(api: APIRequestContext, suffix: string) {
  const uniqueLocation = `Typing indicator ${suffix}`;
  const response = await api.post("/api/service-requests", {
    headers: { "x-user-email": RESIDENT_EMAIL, "Content-Type": "application/json" },
    data: {
      category: "general_repairs",
      description: `Typing indicator test ${suffix}`,
      budget: "100000",
      urgency: "medium",
      location: uniqueLocation,
      specialInstructions: "Typing indicator e2e test",
    },
  });
  expect(response.ok()).toBeTruthy();
  const created = (await response.json()) as { id: string };
  return { id: created.id, uniqueLocation };
}

async function assignForJob(api: APIRequestContext, requestId: string, providerId: string) {
  const response = await api.patch(`/api/service-requests/${requestId}`, {
    headers: { "x-user-email": ADMIN_EMAIL, "Content-Type": "application/json" },
    data: {
      status: "assigned_for_job",
      providerId,
      paymentRequestedAt: new Date().toISOString(),
      paymentStatus: "paid",
    },
  });
  expect(response.ok()).toBeTruthy();
}

test.describe("Real-time typing indicators", () => {
  test("shows and clears resident/provider typing indicators", async ({ browser, request }) => {
    test.setTimeout(120000);

    const provider = await pickProvider(request);
    const { id: requestId, uniqueLocation } = await createResidentRequest(request, String(Date.now()));
    await assignForJob(request, requestId, provider.id);

    const residentPage = await createRolePage(browser, RESIDENT_EMAIL);
    const providerPage = await createProviderSession(browser, provider);

    await residentPage.goto(`/resident/requests/ordinary?requestId=${encodeURIComponent(requestId)}`);
    await providerPage.goto(`/provider/chat?requestId=${encodeURIComponent(requestId)}`);
    await residentPage.waitForLoadState("domcontentloaded");
    await providerPage.waitForLoadState("domcontentloaded");

    const residentRequestButton = residentPage.getByRole("button", {
      name: new RegExp(uniqueLocation.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"),
    }).first();
    if (await residentRequestButton.isVisible().catch(() => false)) {
      await residentRequestButton.click();
    }

    const providerRequestButton = providerPage.getByRole("button", {
      name: new RegExp(uniqueLocation.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"),
    }).first();
    if (await providerRequestButton.isVisible().catch(() => false)) {
      await providerRequestButton.click();
    }

    const residentComposer = residentPage
      .getByPlaceholder(/Describe the issue, preferred time, and any details that will help the provider\./i)
      .first();
    const providerComposer = providerPage
      .getByPlaceholder(/Describe the issue, preferred time, and any details that will help the provider\./i)
      .first();
    await expect(residentComposer).toBeVisible({ timeout: 60000 });
    await expect(providerComposer).toBeVisible({ timeout: 60000 });
    await residentPage.waitForTimeout(2500);

    const residentTypingOnProvider = providerPage.getByText(/Resident is typing\.\.\./i).first();
    const providerTypingOnResident = residentPage.getByText(/is typing\.\.\./i).first();

    const residentTypingStart = await request.post(`/api/service-requests/${requestId}/typing`, {
      headers: { "x-user-email": RESIDENT_EMAIL, "Content-Type": "application/json" },
      data: { isTyping: true },
    });
    expect(residentTypingStart.ok()).toBeTruthy();
    await expect
      .poll(
        async () => residentTypingOnProvider.isVisible().catch(() => false),
        { timeout: 15000, intervals: [300, 600, 1000] },
      )
      .toBeTruthy();

    const residentTypingStop = await request.post(`/api/service-requests/${requestId}/typing`, {
      headers: { "x-user-email": RESIDENT_EMAIL, "Content-Type": "application/json" },
      data: { isTyping: false },
    });
    expect(residentTypingStop.ok()).toBeTruthy();
    await expect
      .poll(
        async () => residentTypingOnProvider.isVisible().catch(() => false),
        { timeout: 10000, intervals: [500, 1000, 1500] },
      )
      .toBeFalsy();

    const providerTypingStart = await providerPage.context().request.post(
      `/api/service-requests/${requestId}/typing`,
      {
        headers: { "Content-Type": "application/json" },
        data: { isTyping: true },
      },
    );
    expect(providerTypingStart.ok()).toBeTruthy();
    await expect
      .poll(
        async () => providerTypingOnResident.isVisible().catch(() => false),
        { timeout: 15000, intervals: [300, 600, 1000] },
      )
      .toBeTruthy();

    const providerTypingStop = await providerPage.context().request.post(
      `/api/service-requests/${requestId}/typing`,
      {
        headers: { "Content-Type": "application/json" },
        data: { isTyping: false },
      },
    );
    expect(providerTypingStop.ok()).toBeTruthy();
    await expect
      .poll(
        async () => providerTypingOnResident.isVisible().catch(() => false),
        { timeout: 10000, intervals: [500, 1000, 1500] },
      )
      .toBeFalsy();
  });
});
