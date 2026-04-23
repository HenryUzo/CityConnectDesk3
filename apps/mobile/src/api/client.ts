import { AuthTokens } from "./contracts";
import { env } from "../config/env";

export class ApiError extends Error {
  status: number;
  details?: unknown;

  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
  }
}

type ApiConfig = {
  getAccessToken: () => string | null;
  getRefreshToken?: () => string | null;
  refreshTokens?: (refreshToken: string) => Promise<AuthTokens | null>;
  onAuthFailure?: () => Promise<void> | void;
};

type RequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  headers?: Record<string, string>;
  query?: Record<string, string | number | boolean | undefined | null>;
  retryOnAuthFailure?: boolean;
};

export function buildApiUrl(path: string, query?: RequestOptions["query"]) {
  const url = `${env.apiUrl}${path.startsWith("/") ? path : `/${path}`}`;
  if (!query) return url;

  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === "") continue;
    search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `${url}?${qs}` : url;
}

async function parseResponse<T>(response: Response): Promise<T> {
  const contentType = response.headers.get("content-type") || "";
  const payload = contentType.includes("application/json")
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    const normalizedStringPayload =
      typeof payload === "string"
        ? payload
            .replace(/<!doctype html>/gi, "")
            .replace(/<[^>]+>/g, " ")
            .replace(/\s+/g, " ")
            .trim()
        : null;
    const cannotPostMatch =
      typeof payload === "string" ? payload.match(/Cannot POST\s+([^\s<]+)/i) : null;
    const message =
      cannotPostMatch?.[1]
        ? `Endpoint not available: POST ${cannotPostMatch[1]}`
        : normalizedStringPayload
          ? normalizedStringPayload
        : String((payload as any)?.message || (payload as any)?.error || "Request failed");
    throw new ApiError(message, response.status, payload);
  }

  return payload as T;
}

export function createApiClient(config: ApiConfig) {
  async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const url = buildApiUrl(path, options.query);
    const headers: Record<string, string> = {
      Accept: "application/json",
      ...(options.headers || {}),
    };

    if (options.body !== undefined) {
      headers["Content-Type"] = "application/json";
    }

    const token = config.getAccessToken();
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(url, {
      method: options.method || "GET",
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });

    if (
      response.status === 401 &&
      options.retryOnAuthFailure !== false &&
      config.getRefreshToken &&
      config.refreshTokens
    ) {
      const refreshToken = config.getRefreshToken();
      if (refreshToken) {
        const refreshed = await config.refreshTokens(refreshToken);
        if (refreshed?.accessToken) {
          return request<T>(path, { ...options, retryOnAuthFailure: false });
        }
      }
      await config.onAuthFailure?.();
    }

    return parseResponse<T>(response);
  }

  return {
    get: <T>(path: string, query?: RequestOptions["query"]) => request<T>(path, { query }),
    post: <T>(path: string, body?: unknown) => request<T>(path, { method: "POST", body }),
    patch: <T>(path: string, body?: unknown) => request<T>(path, { method: "PATCH", body }),
    put: <T>(path: string, body?: unknown) => request<T>(path, { method: "PUT", body }),
    delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
    request,
  };
}

export async function postPublicJson<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(buildApiUrl(path), {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  return parseResponse<T>(response);
}
