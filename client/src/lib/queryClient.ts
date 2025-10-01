import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response, url: string) {
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`${res.status} ${res.statusText} @ ${url}\n${text.slice(0,200)}`);
  }
}

function resolveUrlFromQueryKey(queryKey: readonly unknown[]): string {
  const raw = String(queryKey[0] ?? "");
  const BASE = import.meta.env.VITE_API_URL ?? "https://cityconnect.replit.app"; // hard fallback for Replit
  if (/^https?:\/\//i.test(raw)) return raw;                 // already absolute
  const path = raw.startsWith("/") ? raw : `/${raw}`;        // ensure leading slash
  return `${BASE}${path}`;
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown,
): Promise<Response> {
  const finalUrl = url.startsWith("http") ? url : resolveUrlFromQueryKey([url]);
  const res = await fetch(finalUrl, {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });
  await throwIfResNotOk(res, finalUrl);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";

export const getQueryFn: <T>(opts:{ on401: UnauthorizedBehavior }) => QueryFunction<T> =
  ({ on401 }) =>
  async ({ queryKey }) => {
    const url = resolveUrlFromQueryKey(queryKey);
    let res: Response;
    try {
      res = await fetch(url, { credentials: "include" });
    } catch (err: any) {
      console.error("Fetch network error:", url, err?.message || err);
      throw new Error(`Network error fetching ${url}: ${err?.message || err}`);
    }

    // If server served HTML (e.g., index.html or an error page), surface that now.
    const ct = res.headers.get("content-type") || "";
    if (ct.includes("text/html")) {
      const html = await res.text();
      throw new Error(`Expected JSON but got HTML @ ${url}\nFirst 120 chars:\n${html.slice(0,120)}`);
    }

    if (on401 === "returnNull" && res.status === 401) return null as any;
    await throwIfResNotOk(res, url);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: { retry: false },
  },
});
