// client/src/lib/residentApi.ts
const API_BASE =
  import.meta.env.VITE_API_URL?.replace(/\/$/, "") ||
  window.location.origin;

type FetchInit = RequestInit & { json?: any; headers?: Record<string, string> };

export async function residentFetch<T = any>(path: string, init?: FetchInit): Promise<T> {
  const url = path.startsWith("http")
    ? path
    : `${API_BASE}${path.startsWith("/") ? path : `/${path}`}`;

  const headers: Record<string, string> = { ...(init?.headers || {}) };

  // If you already know the logged-in resident email in your client state,
  // you can pass it along (helps when cookies aren’t available in dev):
  const devEmail = localStorage.getItem("resident_email_dev"); // optional
  if (devEmail && !headers["x-user-email"]) {
    headers["x-user-email"] = devEmail;
  }

  if (init?.json && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(url, {
    ...init,
    headers,
    body: init?.json ? JSON.stringify(init.json) : init?.body,
    credentials: "include", // <-- IMPORTANT (send cookies when same-site)
  });

  const ct = res.headers.get("content-type") || "";
  if (!res.ok) {
    const text = ct.includes("application/json") ? JSON.stringify(await res.json()) : await res.text();
    throw new Error(`${res.status} ${res.statusText} @ ${url}\n${text.slice(0, 300)}`);
  }
  return ct.includes("application/json") ? (await res.json()) as T : (await res.text() as any);
}

export const ResidentAPI = {
  // returns *this resident's* requests
  myRequests: () => residentFetch("/api/app/service-requests/mine"),
  whoami:     () => residentFetch("/api/app/_whoami"),
  devLogin:   (emailOrId: { email?: string; userId?: string }) =>
    residentFetch("/api/app/dev-login", { method: "POST", json: emailOrId }),
  logout:     () => residentFetch("/api/app/logout", { method: "POST" }),
};
