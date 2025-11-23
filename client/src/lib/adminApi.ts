// client/src/lib/adminApi.ts
import type { QueryFunction } from "@tanstack/react-query";

// Prefer same-origin by default (works on Replit preview & local dev).
// You can still override with VITE_API_URL if you deploy API elsewhere.
const API_BASE =
  (import.meta as any).env?.VITE_API_URL?.replace(/\/$/, "") ||
  (typeof window !== "undefined" ? window.location.origin : "") ||
  "";

// storage keys
const ADMIN_TOKEN_KEY = "admin_access_token";
const ADMIN_ESTATE_KEY = "admin_current_estate_id";

// ---------------------
// Token & estate helpers
// ---------------------
export function setAdminToken(token: string | null) {
  if (typeof window === "undefined") return;
  if (token) {
    window.sessionStorage.setItem(ADMIN_TOKEN_KEY, token);
    window.localStorage.setItem(ADMIN_TOKEN_KEY, token);
  } else {
    window.sessionStorage.removeItem(ADMIN_TOKEN_KEY);
    window.localStorage.removeItem(ADMIN_TOKEN_KEY);
  }
}

export function getAdminToken(): string | null {
  if (typeof window === "undefined") return null;
  return (
    window.sessionStorage.getItem(ADMIN_TOKEN_KEY) ||
    window.localStorage.getItem(ADMIN_TOKEN_KEY) ||
    window.localStorage.getItem("admin_jwt") ||
    null
  );
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

/** Build headers with Authorization and (conditionally) X-Estate-Id */
export function adminHeaders(extra?: Record<string, string>) {
  const headers: Record<string, string> = { Accept: "application/json" };

  const token = getAdminToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const estateId = getCurrentEstate();
  if (estateId) {
    headers["X-Estate-Id"] = estateId; // only when present & normalized
  }

  if (extra) Object.assign(headers, extra);
  return headers;
}

// -----------------------------------------------------
// Low-level fetch with JWT + estate header + query JSON
// -----------------------------------------------------
/**
 * - Never sends a body for GET/HEAD (prevents "GET cannot have body")
 * - Supports `json` (auto-stringified) and `query` (URLSearchParams)
 * - By default omits credentials (cookies) for cross-origin safety
 */
export async function adminFetch<T = any>(
  path: string,
  init?: (RequestInit & { json?: any; query?: Record<string, any> }) | undefined
): Promise<T> {
  // Build URL
  let url = path.startsWith("http")
    ? path
    : `${API_BASE}${path.startsWith("/") ? path : `/${path}`}`;

  // Append query string if provided
  if (init?.query && Object.keys(init.query).length > 0) {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(init.query)) {
      if (v === undefined || v === null) continue;
      qs.append(k, String(v));
    }
    url += (url.includes("?") ? "&" : "?") + qs.toString();
  }

  // Normalize method & headers
  const method = ((init?.method ?? "GET") as string).toUpperCase();
  const wantsJsonBody = init?.json !== undefined && method !== "GET" && method !== "HEAD";
  const headers = adminHeaders(wantsJsonBody ? { "Content-Type": "application/json" } : undefined);

  // Ensure we never pass a body for GET/HEAD
  let body: BodyInit | undefined;
  if (wantsJsonBody) {
    body = JSON.stringify(init!.json);
  } else if (method !== "GET" && method !== "HEAD" && init?.body !== undefined) {
    body = init.body as BodyInit;
  }

  // Include cookies for same-origin session-based auth; omit for cross-origin
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

// back-compat wrapper you may use elsewhere
export async function adminApiRequest(
  method: string,
  endpoint: string,
  data?: any
) {
  const init: any = { method };
  if (method.toUpperCase() !== "GET" && data !== undefined) {
    init.json = data;
  } else if (method.toUpperCase() === "GET" && data) {
    // if someone passes data for GET, treat it as query params
    init.query = data;
  }
  return adminFetch(endpoint, init);
}

// React Query queryFn for admin endpoints (path is queryKey[0])
export const adminQueryFn: QueryFunction<any> = async ({ queryKey, signal }) => {
  const path = String(queryKey[0] ?? "");
  return adminFetch(path, { signal });
};

// -----------------------------------------------------
// High-level Admin API (mirrors your existing structure)
// -----------------------------------------------------
export const AdminAPI = {
  auth: {
    setup: (data: any) =>
      adminFetch("/api/admin/setup", { method: "POST", json: data }),
    login: (data: any) =>
      adminFetch("/api/login", { method: "POST", json: data }),
    refresh: (data: any) =>
      adminFetch("/api/admin/auth/refresh", { method: "POST", json: data }),
    logout: () => adminFetch("/api/admin/auth/logout", { method: "POST" }),
  },
  dashboard: {
    getStats: () => adminFetch("/api/admin/dashboard/stats"),
  },
  users: {
    // Unified endpoint (admins + residents + providers)
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
    // If you have this endpoint, keep it; otherwise remove it
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
    }) => adminFetch("/api/admin/bridge/service-requests", { query: params }),
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
  },
  health: () => adminFetch("/api/admin/health"),
};
