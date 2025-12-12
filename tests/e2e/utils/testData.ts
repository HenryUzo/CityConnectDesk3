import { request } from "@playwright/test";

export type ServiceRequestRecord = {
  id: string;
  title: string | null;
  description: string | null;
  status: string;
  createdAt: string;
  estateId?: string | null;
};

function resolveBaseURL(baseURL?: string) {
  return baseURL || "http://localhost:5000";
}

/**
 * Calls the dev helper endpoint to ensure at least one request exists.
 * If the request already exists, it will be returned unchanged.
 */
export async function ensureSampleRequest(baseURL?: string): Promise<ServiceRequestRecord> {
  const context = await request.newContext({ baseURL: resolveBaseURL(baseURL) });
  const response = await context.get("/api/dev/sample-request");

  if (!response.ok()) {
    throw new Error(`Failed to create sample request (${response.status()})`);
  }

  const record = (await response.json()) as ServiceRequestRecord;
  await context.dispose();
  return record;
}

/**
 * Forces a known status on a request so tests can be deterministic.
 */
export async function setRequestStatus(
  id: string,
  status: string,
  baseURL?: string
): Promise<ServiceRequestRecord> {
  const context = await request.newContext({ baseURL: resolveBaseURL(baseURL) });
  const response = await context.patch(`/api/requests/${id}/status`, {
    data: { status },
  });

  if (!response.ok()) {
    const body = await response.text();
    throw new Error(`Failed to update status (${response.status()}): ${body}`);
  }

  const record = (await response.json()) as ServiceRequestRecord;
  await context.dispose();
  return record;
}

/**
 * Ensures we have a request in the PENDING state by resetting the sample.
 */
export async function ensurePendingRequest(baseURL?: string): Promise<ServiceRequestRecord> {
  const sample = await ensureSampleRequest(baseURL);
  if (sample.status === "PENDING") {
    return sample;
  }
  return setRequestStatus(sample.id, "PENDING", baseURL);
}
