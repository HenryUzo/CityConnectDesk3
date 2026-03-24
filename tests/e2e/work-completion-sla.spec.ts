import { expect, test, type APIRequestContext, type Browser } from "@playwright/test";

const ADMIN_EMAIL = "admin@cityconnect.com";
const RESIDENT_EMAIL = "testresident@gmail.com";

type ProviderRecord = {
  id: string;
  email: string;
};

type NotificationRecord = {
  id: string;
  title?: string;
  message?: string;
  metadata?: Record<string, unknown> | null;
};

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
    throw new Error("No provider with id/email found for SLA transition tests.");
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
      description: `E2E SLA auto-complete ${suffix}`,
      budget: "210000",
      urgency: "medium",
      location: "Victoria Garden City, Lagos",
      specialInstructions: "SLA auto-complete e2e request",
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

async function requestDetails(api: APIRequestContext, requestId: string): Promise<{
  status: string;
  closeReason?: string | null;
}> {
  const response = await api.get(`/api/service-requests/${requestId}`, {
    headers: { "x-user-email": ADMIN_EMAIL },
  });
  expect(response.ok()).toBeTruthy();
  const payload = (await response.json()) as { status: string; closeReason?: string | null };
  return payload;
}

async function moveToWorkCompletedPendingResident(
  api: APIRequestContext,
  requestId: string,
) {
  const inProgress = await api.patch(`/api/service-requests/${requestId}`, {
    headers: { "x-user-email": ADMIN_EMAIL, "Content-Type": "application/json" },
    data: { status: "in_progress" },
  });
  expect(inProgress.ok()).toBeTruthy();

  const done = await api.patch(`/api/service-requests/${requestId}`, {
    headers: { "x-user-email": ADMIN_EMAIL, "Content-Type": "application/json" },
    data: { status: "work_completed_pending_resident" },
  });
  expect(done.ok()).toBeTruthy();

  await expect
    .poll(async () => {
      const details = await requestDetails(api, requestId);
      return String(details.status || "").toLowerCase();
    }, { timeout: 30000, intervals: [1000, 2000, 3000] })
    .toBe("work_completed_pending_resident");
}

async function backdateRequestForSla(api: APIRequestContext, requestId: string, hoursAgo = 96) {
  const response = await api.post(`/api/admin/service-requests/${requestId}/sla/backdate`, {
    headers: { "x-user-email": ADMIN_EMAIL, "Content-Type": "application/json" },
    data: { hoursAgo },
  });
  expect(response.ok()).toBeTruthy();
}

async function triggerSlaSweep(api: APIRequestContext, requestId: string) {
  const response = await api.post("/api/admin/service-requests/sla/work-completion/sweep", {
    headers: { "x-user-email": ADMIN_EMAIL, "Content-Type": "application/json" },
    data: { requestId },
  });
  expect(response.ok()).toBeTruthy();
  const payload = (await response.json()) as { completedCount?: number };
  expect(Number(payload.completedCount || 0)).toBeGreaterThan(0);
}

async function listNotifications(api: APIRequestContext, email: string): Promise<NotificationRecord[]> {
  const response = await api.get("/api/notifications", {
    headers: { "x-user-email": email },
  });
  expect(response.ok()).toBeTruthy();
  return (await response.json()) as NotificationRecord[];
}

function findAutoCompletedNotification(notifications: NotificationRecord[], requestId: string) {
  return notifications.find((notification) => {
    const metadata =
      notification.metadata && typeof notification.metadata === "object" && !Array.isArray(notification.metadata)
        ? (notification.metadata as Record<string, unknown>)
        : {};
    return (
      String(metadata.kind || "") === "job_delivery_auto_completed" &&
      String(metadata.requestId || "") === requestId
    );
  });
}

test.describe("Work completion SLA auto-complete", () => {
  test("auto-completes stale work_completed_pending_resident request and emits deep-link notifications", async ({ browser, request }) => {
    const provider = await pickProvider(request);
    const requestId = await createResidentRequest(request, String(Date.now()));
    await assignForJob(request, requestId, provider.id);
    await moveToWorkCompletedPendingResident(request, requestId);

    await backdateRequestForSla(request, requestId, 96);
    await triggerSlaSweep(request, requestId);

    await expect
      .poll(async () => {
        const details = await requestDetails(request, requestId);
        return String(details.status || "").toLowerCase();
      }, { timeout: 30000, intervals: [1000, 2000, 3000] })
      .toBe("completed");

    const completedDetails = await requestDetails(request, requestId);
    expect(String(completedDetails.closeReason || "").toLowerCase()).toContain("auto-completed");

    const residentNotifications = await listNotifications(request, RESIDENT_EMAIL);
    const providerPage = await createProviderSession(browser, provider);
    const providerNotificationsResponse = await providerPage.context().request.get("/api/notifications");
    expect(providerNotificationsResponse.ok()).toBeTruthy();
    const providerNotifications = (await providerNotificationsResponse.json()) as NotificationRecord[];
    await providerPage.context().close();
    const residentNotification = findAutoCompletedNotification(residentNotifications, requestId);
    const providerNotification = findAutoCompletedNotification(providerNotifications, requestId);

    expect(residentNotification).toBeTruthy();
    expect(providerNotification).toBeTruthy();

    const residentMetadata =
      residentNotification?.metadata && typeof residentNotification.metadata === "object"
        ? (residentNotification.metadata as Record<string, unknown>)
        : {};
    const providerMetadata =
      providerNotification?.metadata && typeof providerNotification.metadata === "object"
        ? (providerNotification.metadata as Record<string, unknown>)
        : {};

    expect(String(residentMetadata.targetPath || "")).toBe(
      `/resident/requests/ordinary?requestId=${encodeURIComponent(requestId)}`,
    );
    expect(String(providerMetadata.targetPath || "")).toBe(
      `/provider/chat?requestId=${encodeURIComponent(requestId)}`,
    );
  });
});
