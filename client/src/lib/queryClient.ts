import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response, url: string) {
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`${res.status} ${res.statusText} @ ${url}\n${text.slice(0, 200)}`);
  }
}

/** Use same-origin in dev/preview, use VITE_API_URL (or current origin) in prod */
function getBaseUrl(): string {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  if (import.meta.env.DEV || origin.includes(".replit.dev") || origin.includes("localhost")) {
    // Dev / Replit preview: hit the same origin to avoid CORS
    return origin || "http://localhost:5173";
  }
  // Production: prefer configured API, else current origin, else hard fallback
  return import.meta.env.VITE_API_URL || origin || "https://cityconnect.replit.app";
}

/** Build an absolute URL from a queryKey (expects key[0] to be the path or URL) */
function resolveUrlFromQueryKey(queryKey: readonly unknown[]): string {
  const raw = String(queryKey[0] ?? "");
  if (/^https?:\/\//i.test(raw)) return raw; // already absolute
  const base = getBaseUrl();
  const path = raw.startsWith("/") ? raw : `/${raw}`;
  return `${base}${path}`;
}

/** Attach Bearer token from storage (sessionStorage preferred in this repo) */
function getAuthHeaders() {
  const headers: Record<string, string> = {};

  // Read admin token from storage (check resident token keys too)
  const token =
    sessionStorage.getItem("jwt") ||
    localStorage.getItem("jwt") ||
    sessionStorage.getItem("admin_access_token") ||
    localStorage.getItem("admin_access_token") ||
    localStorage.getItem("admin_jwt") ||
    localStorage.getItem("token") ||
    "";

  if (token) headers.Authorization = `Bearer ${token}`;

  // Send selected estate id with every admin call
  const estateId =
    localStorage.getItem("admin_current_estate_id") ||
    sessionStorage.getItem("admin_current_estate_id") ||
    "";

  if (estateId) headers["X-Estate-Id"] = estateId;

  return headers;
}



export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
  options?: { signal?: AbortSignal },
): Promise<Response> {
  const finalUrl = /^https?:\/\//i.test(url)
    ? url
    : resolveUrlFromQueryKey([url]);

  const headers: Record<string, string> = { ...getAuthHeaders() };
  if (data) headers["Content-Type"] = "application/json";

  const res = await fetch(finalUrl, {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
    signal: options?.signal,
  });

  await throwIfResNotOk(res, finalUrl);
  return res;
}


type UnauthorizedBehavior = "returnNull" | "throw";

export function getQueryFn<TReturn>(opts: { on401: UnauthorizedBehavior }): QueryFunction<TReturn> {
  const fn: QueryFunction<TReturn> = async ({ queryKey }) => {
    const url = resolveUrlFromQueryKey(queryKey);
    const headers = getAuthHeaders();

    let res: Response;
    try {
      res = await fetch(url, { credentials: "include", headers });
    } catch (err: any) {
      console.error("Fetch network error:", url, err?.message || err);
      throw new Error(`Network error fetching ${url}: ${err?.message || err}`);
    }

    const ct = res.headers.get("content-type") || "";
    if (ct.includes("text/html")) {
      const html = await res.text();
      throw new Error(`Expected JSON but got HTML @ ${url}\n${html.slice(0, 160)}`);
    }

    if (opts.on401 === "returnNull" && res.status === 401) return null as any;
    await throwIfResNotOk(res, url);
    return (await res.json()) as TReturn;
  };

  return fn;
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
