// client/src/lib/adminApi.ts
import type { QueryFunction } from "@tanstack/react-query";

function normalizeApiPath(path: string) {
  return String(path || "")
    .trim()
    .replace(/^\$\{import\.meta\.env\.VITE_API_URL\}/, "")
    .replace(/^(undefined|null)(?=\/api\/)/, "");
}

const configuredApiBase = ((import.meta as any).env?.VITE_API_URL || "")
  .replace(/\/$/, "")
  .trim();

const API_BASE =
  (configuredApiBase && configuredApiBase !== "undefined" && configuredApiBase !== "null"
    ? configuredApiBase
    : "") ||
  (typeof window !== "undefined" ? window.location.origin : "") ||
  "";

const ADMIN_ESTATE_KEY = "admin_current_estate_id";
const LEGACY_ADMIN_AUTH_KEYS = ["admin_access_token", "admin_refresh_token", "admin_jwt", "jwt", "refreshToken", "token"];

export function clearLegacyAdminAuthStorage() {
  if (typeof window === "undefined") return;
  for (const key of LEGACY_ADMIN_AUTH_KEYS) {
    window.sessionStorage.removeItem(key);
    window.localStorage.removeItem(key);
  }
}

export function setCurrentEstate(estateId: string | null) {
  if (typeof window === "undefined") return;
  if (estateId) window.localStorage.setItem(ADMIN_ESTATE_KEY, estateId);
  else window.localStorage.removeItem(ADMIN_ESTATE_KEY);
}

/** Normalize stored estate id: treat "", "null", null as no estate */
export function getCurrentEstate(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(ADMIN_ESTATE_KEY);
    if (!raw) return null;
    const trimmed = String(raw).trim();
    if (!trimmed || trimmed.toLowerCase() === "null") return null;
    return trimmed;
  } catch {
    return null;
  }
}

/** Build headers with tenant-scoping context only (auth comes from session cookies). */
export function adminHeaders(extra?: Record<string, string>) {
  const headers: Record<string, string> = { Accept: "application/json" };

  const estateId = getCurrentEstate();
  if (estateId) {
    headers["X-Estate-Id"] = estateId;
  }

  if (extra) Object.assign(headers, extra);
  return headers;
}

export async function adminFetch<T = any>(
  path: string,
  init?: (RequestInit & { json?: any; query?: Record<string, any> }) | undefined
): Promise<T> {
  const normalizedPath = normalizeApiPath(path);
  let url = normalizedPath.startsWith("http")
    ? normalizedPath
    : `${API_BASE}${normalizedPath.startsWith("/") ? normalizedPath : `/${normalizedPath}`}`;

  if (init?.query && Object.keys(init.query).length > 0) {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(init.query)) {
      if (v === undefined || v === null) continue;
      qs.append(k, String(v));
    }
    url += (url.includes("?") ? "&" : "?") + qs.toString();
  }

  const method = ((init?.method ?? "GET") as string).toUpperCase();
  const wantsJsonBody = init?.json !== undefined && method !== "GET" && method !== "HEAD";
  const headers = adminHeaders(wantsJsonBody ? { "Content-Type": "application/json" } : undefined);

  let body: BodyInit | undefined;
  if (wantsJsonBody) {
    body = JSON.stringify(init!.json);
  } else if (method !== "GET" && method !== "HEAD" && init?.body !== undefined) {
    body = init.body as BodyInit;
  }

  const shouldIncludeCredentials =
    typeof window !== "undefined" &&
    (!url.startsWith("http") ||
      new URL(url, window.location.origin).origin === window.location.origin);

  const res = await fetch(url, {
    ...init,
    method,
    headers,
    body,
    credentials: shouldIncludeCredentials ? "include" : "omit",
  });

  const ct = res.headers.get("content-type") || "";
  if (!res.ok) {
    let bodyText = "";
    try {
      bodyText = ct.includes("application/json")
        ? JSON.stringify(await res.json())
        : await res.text();
    } catch {
      // ignore parse errors on failure path
    }
    throw new Error(`${res.status} ${res.statusText} @ ${url}\n${bodyText.slice(0, 300)}`);
  }

  if (!ct.includes("application/json")) {
    const text = await res.text();
    throw new Error(`Expected JSON but got ${ct} @ ${url}\n${text.slice(0, 300)}`);
  }

  return (await res.json()) as T;
}

function isHttpNotFoundError(error: unknown) {
  return error instanceof Error && /\b404\b/.test(error.message);
}

export async function adminApiRequest(
  method: string,
  endpoint: string,
  data?: any
) {
  const init: any = { method };
  if (method.toUpperCase() !== "GET" && data !== undefined) {
    init.json = data;
  } else if (method.toUpperCase() === "GET" && data) {
    init.query = data;
  }
  return adminFetch(endpoint, init);
}

export const adminQueryFn: QueryFunction<any> = async ({ queryKey, signal }) => {
  const path = String(queryKey[0] ?? "");
  return adminFetch(path, { signal });
};

export interface ProviderRequest {
  id: string;
  name: string;
  email: string;
  createdAt: string;
  status: string;
}

export const AdminAPI = {
  auth: {
    setup: (data: any) =>
      adminFetch("/api/admin/setup", { method: "POST", json: data }),
    login: (data: any) =>
      adminFetch("/api/login", { method: "POST", json: data }),
    logout: () => adminFetch("/api/logout", { method: "POST" }),
  },
  dashboard: {
    getStats: () => adminFetch("/api/admin/dashboard/stats"),
  },
  users: {
    getAll: (params?: any) => adminFetch("/api/admin/users/all", { query: params }),
    create: (data: any) =>
      adminFetch("/api/admin/users", { method: "POST", json: data }),
    update: (id: string, data: any) =>
      adminFetch(`/api/admin/users/${id}`, { method: "PATCH", json: data }),
  },
  providers: {
    getAll: (params?: any) =>
      adminFetch("/api/admin/providers", { query: params }),
    create: (data: any) =>
      adminFetch("/api/admin/providers", { method: "POST", json: data }),
    update: (id: string, data: any) =>
      adminFetch(`/api/admin/providers/${id}`, { method: "PATCH", json: data }),
  },
  estates: {
    getAll: (params?: any) =>
      adminFetch("/api/admin/estates", { query: params }),
    create: (data: any) =>
      adminFetch("/api/admin/estates", { method: "POST", json: data }),
    update: (id: string, data: any) =>
      adminFetch(`/api/admin/estates/${id}`, { method: "PATCH", json: data }),
  },
  categories: {
    getAll: (params?: any) =>
      adminFetch("/api/admin/categories", { query: params }),
    create: (data: any) =>
      adminFetch("/api/admin/categories", { method: "POST", json: data }),
    update: (id: string, data: any) =>
      adminFetch(`/api/admin/categories/${id}`, { method: "PATCH", json: data }),
  },
  marketplace: {
    getAll: (params?: any) =>
      adminFetch("/api/admin/marketplace", { query: params }),
    create: (data: any) =>
      adminFetch("/api/admin/marketplace", { method: "POST", json: data }),
    update: (id: string, data: any) =>
      adminFetch(`/api/admin/marketplace/${id}`, { method: "PATCH", json: data }),
  },
  orders: {
    getAll: (params?: any) =>
      adminFetch("/api/admin/orders", { query: params }),
    getAnalytics: () => adminFetch("/api/admin/orders/analytics/stats"),
  },
  auditLogs: {
    getAll: (params?: any) =>
      adminFetch("/api/admin/audit-logs", { query: params }),
  },
  bridge: {
    getServiceRequests: (params?: {
      status?: string;
      category?: string;
      residentId?: string;
      providerId?: string;
      estateId?: string;
    }) => adminFetch("/api/admin/bridge/service-requests", { query: params }),
    updateServiceRequest: (id: string, data: any) =>
      adminFetch(`/api/service-requests/${id}`, { method: "PATCH", json: data }),
    requestJobPayment: async (id: string, data?: { amount?: string; materialCost?: number; serviceCost?: number; providerId?: string; note?: string }) => {
      try {
        return await adminFetch(`/api/admin/service-requests/${id}/request-payment`, {
          method: "POST",
          json: data ?? {},
        });
      } catch (error) {
        if (!isHttpNotFoundError(error)) throw error;
        return await adminFetch(`/api/service-requests/${id}`, {
          method: "PATCH",
          json: {
            status: "assigned",
            paymentStatus: "pending",
            paymentRequestedAt: new Date().toISOString(),
            ...(data?.providerId ? { providerId: data.providerId } : {}),
            ...(data?.amount
              ? { billedAmount: data.amount }
              : Number.isFinite(Number(data?.materialCost || 0) + Number(data?.serviceCost || 0))
                ? { billedAmount: String(Number(data?.materialCost || 0) + Number(data?.serviceCost || 0)) }
                : {}),
          },
        });
      }
    },
    approveRequestForJob: async (id: string, data?: { providerId?: string }) => {
      try {
        return await adminFetch(`/api/admin/service-requests/${id}/approve-job`, {
          method: "POST",
          json: data ?? {},
        });
      } catch (error) {
        if (!isHttpNotFoundError(error)) throw error;
        return await adminFetch(`/api/service-requests/${id}`, {
          method: "PATCH",
          json: {
            status: "assigned_for_job",
            ...(data?.providerId ? { providerId: data.providerId } : {}),
            approvedForJobAt: new Date().toISOString(),
          },
        });
      }
    },
    reassignJobProvider: async (
      id: string,
      data: { providerId: string; reason: string; evidence: string },
    ) => {
      return await adminFetch(`/api/admin/service-requests/${id}/reassign-job-provider`, {
        method: "POST",
        json: data,
      });
    },
    getUsers: (params?: { role?: string; search?: string; status?: string }) =>
      adminFetch("/api/admin/bridge/users", { query: params }),
    getStats: () => adminFetch("/api/admin/bridge/stats"),
    updateProviderApproval: (id: string, data: { approved: boolean; reason?: string }) =>
      adminFetch(`/api/admin/bridge/providers/${id}/approval`, {
        method: "PATCH",
        json: data,
      }),
    getUserWallet: (id: string) =>
      adminFetch(`/api/admin/bridge/users/${id}/wallet`),
    getCancellationCases: (params?: { status?: string; requestId?: string }) =>
      adminFetch("/api/admin/cancellation-cases", { query: params }),
    resolveCancellationCase: (
      id: string,
      data: {
        action: "under_review" | "approve" | "reject";
        note: string;
        refundDecision?: "none" | "full" | "partial";
        refundAmount?: number;
      },
    ) =>
      adminFetch(`/api/admin/cancellation-cases/${id}`, {
        method: "PATCH",
        json: data,
      }),
  },
  health: () => adminFetch("/api/admin/health"),
  providerRequests: {
    getProviderRequests: async () => {
      return await adminFetch<ProviderRequest[]>("/api/admin/provider-requests");
    },

    updateProviderRequestStatus: async (id: string, status: "approved" | "rejected") => {
      return await adminFetch(`/api/admin/provider-requests/${id}/status`, {
        method: "POST",
        json: { status },
      });
    },
  },
};
