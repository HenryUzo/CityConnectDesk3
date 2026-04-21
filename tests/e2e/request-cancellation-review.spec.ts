import { expect, test, type APIRequestContext } from "@playwright/test";

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
  const providers = (await response.json()) as Array<{
    id?: string | null;
    email?: string | null;
    isApproved?: boolean | null;
  }>;
  const provider =
    providers.find((entry) => entry?.id && entry?.email && entry.isApproved !== false) ??
    providers.find((entry) => entry?.id && entry?.email);

  if (!provider?.id || !provider?.email) {
    throw new Error("No provider with id/email found for cancellation review e2e.");
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
      description: `Cancellation review flow ${suffix}`,
      budget: "350000",
      urgency: "high",
      location: `Victoria Garden City, Lagos ${suffix}`,
      specialInstructions: "E2E cancellation review request",
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

test.describe("Resident cancellation review workflow", () => {
  test("assigned job requires cancellation case + admin approval closes request with deep-link notification", async ({
    request,
  }) => {
    const provider = await pickProvider(request);
    const requestId = await createResidentRequest(request, String(Date.now()));
    await assignForJob(request, requestId, provider.id);

    const directDelete = await request.delete(`/api/service-requests/${requestId}`, {
      headers: { "x-user-email": RESIDENT_EMAIL },
    });
    expect(directDelete.status()).toBe(409);
    const directDeleteBody = (await directDelete.json()) as { requiresCancellationReview?: boolean };
    expect(directDeleteBody.requiresCancellationReview).toBeTruthy();

    const createCase = await request.post(`/api/service-requests/${requestId}/cancellation-cases`, {
      headers: { "x-user-email": RESIDENT_EMAIL, "Content-Type": "application/json" },
      data: {
        reasonCode: "delay_no_show",
        reasonDetail: "Provider has not shown up and timeline keeps shifting.",
        preferredResolution: "full_refund",
      },
    });
    expect(createCase.ok()).toBeTruthy();
    const createdCasePayload = (await createCase.json()) as { case?: { id?: string } };
    const caseId = String(createdCasePayload.case?.id || "");
    expect(caseId).toBeTruthy();

    const listCases = await request.get(`/api/admin/cancellation-cases?status=requested&requestId=${requestId}`, {
      headers: { "x-user-email": ADMIN_EMAIL },
    });
    expect(listCases.ok()).toBeTruthy();
    const listed = (await listCases.json()) as Array<{ id?: string; requestId?: string }>;
    expect(listed.some((row) => row.id === caseId && row.requestId === requestId)).toBeTruthy();

    const approveCase = await request.patch(`/api/admin/cancellation-cases/${caseId}`, {
      headers: { "x-user-email": ADMIN_EMAIL, "Content-Type": "application/json" },
      data: {
        action: "approve",
        note: "Timeline breach validated after provider and company call.",
        refundDecision: "full",
      },
    });
    expect(approveCase.ok()).toBeTruthy();

    const requestAfterApprove = await request.get(`/api/service-requests/${requestId}`, {
      headers: { "x-user-email": ADMIN_EMAIL },
    });
    expect(requestAfterApprove.ok()).toBeTruthy();
    const requestBody = (await requestAfterApprove.json()) as {
      status?: string;
      paymentStatus?: string;
    };
    expect(String(requestBody.status || "").toLowerCase()).toBe("cancelled");
    expect(["refunded", "cancelled"]).toContain(String(requestBody.paymentStatus || "").toLowerCase());

    const residentNotifications = await request.get("/api/notifications", {
      headers: { "x-user-email": RESIDENT_EMAIL },
    });
    expect(residentNotifications.ok()).toBeTruthy();
    const notifications = (await residentNotifications.json()) as Array<{
      metadata?: { kind?: string; requestId?: string; targetPath?: string };
    }>;
    const approvalNotification = notifications.find(
      (entry) =>
        entry?.metadata?.kind === "request_cancellation_approved" &&
        entry?.metadata?.requestId === requestId,
    );
    expect(approvalNotification).toBeTruthy();
    expect(String(approvalNotification?.metadata?.targetPath || "")).toContain(
      encodeURIComponent(requestId),
    );
  });
});
