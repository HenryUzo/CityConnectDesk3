import { expect, test, type APIRequestContext, type Browser } from "@playwright/test";

const RESIDENT_EMAIL = "testresident@gmail.com";
const ADMIN_EMAIL = "admin@cityconnect.com";

type ProviderRecord = {
  id: string;
  email: string;
};

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
    throw new Error("No provider with id/email found for delivery transition tests.");
  }

  return {
    id: provider.id,
    email: provider.email,
  };
}

async function createResidentRequest(api: APIRequestContext, suffix: string): Promise<string> {
  const response = await api.post("/api/service-requests", {
    headers: { "x-user-email": RESIDENT_EMAIL, "Content-Type": "application/json" },
    data: {
      category: "general_repairs",
      description: `E2E delivery transition ${suffix}`,
      budget: "250000",
      urgency: "medium",
      location: "Victoria Garden City, Lagos",
      specialInstructions: "E2E transition test request",
    },
  });
  expect(response.ok()).toBeTruthy();
  const created = (await response.json()) as { id: string };
  expect(created.id).toBeTruthy();
  return created.id;
}

async function assignForJob(
  api: APIRequestContext,
  requestId: string,
  providerId: string,
): Promise<void> {
  const response = await api.patch(`/api/service-requests/${requestId}`, {
    headers: { "x-user-email": ADMIN_EMAIL, "Content-Type": "application/json" },
    data: {
      providerId,
      status: "assigned_for_job",
      paymentRequestedAt: new Date().toISOString(),
      paymentStatus: "paid",
    },
  });
  expect(response.ok()).toBeTruthy();
}

async function requestStatus(api: APIRequestContext, requestId: string): Promise<string> {
  const response = await api.get(`/api/service-requests/${requestId}`, {
    headers: { "x-user-email": ADMIN_EMAIL },
  });
  expect(response.ok()).toBeTruthy();
  const payload = (await response.json()) as { status: string };
  return String(payload.status || "").toLowerCase();
}

async function createRolePage(browser: Browser, email: string) {
  const context = await browser.newContext({
    extraHTTPHeaders: { "x-user-email": email },
  });
  await context.addInitScript((userEmail: string) => {
    window.localStorage.setItem("dev_user_email", userEmail);
  }, email);
  return context.newPage();
}

async function loginAsProvider(page: Awaited<ReturnType<typeof createRolePage>>, provider: ProviderRecord) {
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

async function moveRequestToWorkCompletedPendingResident(
  browser: Browser,
  api: APIRequestContext,
  provider: ProviderRecord,
  requestId: string,
) {
  const providerPage = await createProviderSession(browser, provider);
  const startResponse = await providerPage.context().request.patch(`/api/service-requests/${requestId}`, {
    headers: { "Content-Type": "application/json" },
    data: { status: "in_progress" },
  });
  expect(startResponse.ok()).toBeTruthy();
  await expect
    .poll(async () => requestStatus(api, requestId), { timeout: 30000, intervals: [1000, 2000, 3000] })
    .toBe("in_progress");

  const doneResponse = await providerPage.context().request.post(`/api/service-requests/${requestId}/work-completed`);
  if (!doneResponse.ok()) {
    const fallbackResponse = await providerPage.context().request.patch(`/api/service-requests/${requestId}`, {
      headers: { "Content-Type": "application/json" },
      data: { status: "work_completed_pending_resident" },
    });
    if (!fallbackResponse.ok()) {
      const primaryError = await doneResponse.text();
      const fallbackError = await fallbackResponse.text();
      throw new Error(
        `Provider could not move request to work_completed_pending_resident. POST /work-completed: ${primaryError}. PATCH fallback: ${fallbackError}`,
      );
    }
  }

  await expect
    .poll(async () => requestStatus(api, requestId), { timeout: 60000, intervals: [1000, 2000, 3000] })
    .toBe("work_completed_pending_resident");
}

test.describe("Job delivery transitions", () => {
  test("provider marks done and resident confirms delivery", async ({ browser, request }) => {
    const provider = await pickProvider(request);
    const requestId = await createResidentRequest(request, `confirm-${Date.now()}`);
    await assignForJob(request, requestId, provider.id);

    await moveRequestToWorkCompletedPendingResident(browser, request, provider, requestId);

    const confirmResponse = await request.post(`/api/service-requests/${requestId}/confirm-delivery`, {
      headers: { "x-user-email": RESIDENT_EMAIL, "Content-Type": "application/json" },
      data: {},
    });
    expect(confirmResponse.ok()).toBeTruthy();

    await expect
      .poll(async () => requestStatus(request, requestId), { timeout: 60000, intervals: [1000, 2000, 3000] })
      .toBe("completed");
  });

  test("resident disputes delivery and admin resolves to rework", async ({ browser, request }) => {
    const provider = await pickProvider(request);
    const requestId = await createResidentRequest(request, `dispute-${Date.now()}`);
    await assignForJob(request, requestId, provider.id);

    await moveRequestToWorkCompletedPendingResident(browser, request, provider, requestId);

    const disputeResponse = await request.post(`/api/service-requests/${requestId}/dispute-delivery`, {
      headers: { "x-user-email": RESIDENT_EMAIL, "Content-Type": "application/json" },
      data: {
        reason: "Work is incomplete in two rooms.",
      },
    });
    expect(disputeResponse.ok()).toBeTruthy();

    await expect
      .poll(async () => requestStatus(request, requestId), { timeout: 60000, intervals: [1000, 2000, 3000] })
      .toBe("disputed");

    const resolveResponse = await request.post(`/api/admin/service-requests/${requestId}/resolve-dispute`, {
      headers: { "x-user-email": ADMIN_EMAIL, "Content-Type": "application/json" },
      data: {
        resolution: "rework_required",
        note: "Rework approved after dispute review.",
      },
    });
    expect(resolveResponse.ok()).toBeTruthy();

    await expect
      .poll(async () => requestStatus(request, requestId), { timeout: 60000, intervals: [1000, 2000, 3000] })
      .toBe("rework_required");

    const providerPage = await createProviderSession(browser, provider);
    const resumeResponse = await providerPage.context().request.patch(`/api/service-requests/${requestId}`, {
      headers: { "Content-Type": "application/json" },
      data: { status: "in_progress" },
    });
    expect(resumeResponse.ok()).toBeTruthy();
    await expect
      .poll(async () => requestStatus(request, requestId), { timeout: 60000, intervals: [1000, 2000, 3000] })
      .toBe("in_progress");
  });
});
