// client/src/hooks/use-admin-auth.ts
import { useEffect, useMemo, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { adminQueryFn, setAdminToken, setCurrentEstate } from "@/lib/adminApi";
import { queryClient } from "@/lib/queryClient";

/** Runtime guard (prevents SSR/build-time crashes) */
const hasWindow = typeof window !== "undefined";

/** Read token safely (matches where your login stores it) */
function getTokenSafe(): string | null {
  if (!hasWindow) return null;
  return (
    window.sessionStorage.getItem("admin_access_token") ||
    window.localStorage.getItem("admin_access_token") ||
    window.localStorage.getItem("admin_jwt") ||
    null
  );
}

/** Read currently selected estate safely (normalize "null" to null) */
function getEstateSafe(): string | null {
  if (!hasWindow) return null;
  const raw = window.localStorage.getItem("admin_current_estate_id");
  return raw && raw !== "null" ? raw : null;
}

/** Decode JWT payload defensively, without Buffer. Never throws. */
function decodeJwtPayload(token: string | null): any | null {
  try {
    if (!token) return null;
    if (!hasWindow || typeof window.atob !== "function") return null;

    const parts = token.split(".");
    if (parts.length < 2) return null;

    // base64url -> base64
    const b64url = parts[1];
    const b64 = b64url.replace(/-/g, "+").replace(/_/g, "/");
    const pad = b64.length % 4 ? 4 - (b64.length % 4) : 0;
    const b64p = b64 + "=".repeat(pad);

    const json = window.atob(b64p);
    try {
      return JSON.parse(json);
    } catch {
      return null;
    }
  } catch {
    return null;
  }
}

/** Main hook used by the Admin app */
export function useAdminAuth() {
  // 1) Derive "user" from the JWT payload (never throws)
  const token = getTokenSafe();
  const user = useMemo(() => {
    const payload = decodeJwtPayload(token);
    if (!payload) return null;
    return {
      id: payload.sub,
      email: payload.email,
      name: payload.name,
      globalRole: payload.globalRole,
      memberships: payload.memberships ?? [],
    };
  }, [token]);

  // 2) Load estates only in the browser and only if we have a token
  const estatesQuery = useQuery({
    queryKey: ["/api/admin/estates"],
    queryFn: adminQueryFn, // adds Authorization (+ X-Estate-Id when present) in adminApi
    enabled: hasWindow && !!token,
    staleTime: 60_000,
    retry: false,
  });

  // 3) Estate selection logic:
  //    - If SUPER ADMIN → ensure NO estate is selected (global scope)
  //    - If not super admin and no estate selected yet → pick first one
  useEffect(() => {
    if (!hasWindow || !token) return;
    if (estatesQuery.isLoading || estatesQuery.isError) return;

    const estates: any[] = Array.isArray(estatesQuery.data) ? estatesQuery.data : [];
    const current = getEstateSafe();

    // Super admin must be GLOBAL (no X-Estate-Id)
    if (user?.globalRole === "super_admin") {
      if (current) {
        // Clear estate (removes localStorage; adminApi will stop sending header)
        setCurrentEstate(null);
        try {
          window.localStorage.removeItem("admin_current_estate_id");
        } catch {}
        // Re-fetch things that may have been scoped
        queryClient.invalidateQueries();
      }
      return; // don't auto-pick for super admin
    }

    // Non-super admins: auto-pick first estate if nothing is set yet
    if (!current && estates.length > 0) {
      const id = String(estates[0]._id || estates[0].id);
      setCurrentEstate(id); // persists to localStorage; header added by adminApi
      queryClient.invalidateQueries();
    }
  }, [
    token,
    user?.globalRole,
    estatesQuery.isLoading,
    estatesQuery.isError,
    estatesQuery.data,
  ]);

  // 4) Logout clears tokens & estate and invalidates queries
  const logout = useCallback(async () => {
    try {
      // If you add a server logout later:
      // await AdminAPI.auth.logout();
    } finally {
      setAdminToken(null);
      setCurrentEstate(null);
      if (hasWindow) {
        window.localStorage.removeItem("admin_jwt");
        window.localStorage.removeItem("admin_current_estate_id");
        window.localStorage.removeItem("admin_access_token");
        window.sessionStorage.removeItem("admin_access_token");
      }
      await queryClient.invalidateQueries();
    }
  }, []);

  // 5) Optional refresh token stub
  const refreshMutation = useMutation({
    mutationFn: async () => null,
    onSuccess: () => {
      queryClient.invalidateQueries();
    },
  });

  return {
    user,                             // what your Sidebar reads
    logout,                           // what your Sidebar calls
    isLoading: !!token && estatesQuery.isLoading,
    isError: estatesQuery.isError,
    error: (estatesQuery.error as Error) ?? null,
    estates: estatesQuery.data as any[] | undefined,
    refreshMutation,
  };
}
