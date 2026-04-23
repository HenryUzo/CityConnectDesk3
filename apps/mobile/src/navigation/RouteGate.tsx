import { ReactNode } from "react";
import { Redirect } from "expo-router";
import { AppRole } from "../api/contracts";
import { AppScreen, LoadingState } from "../components/ui";
import { useSession } from "../features/auth/session";

type RouteGateProps = {
  children: ReactNode;
  requireRole?: AppRole | AppRole[];
  fallbackHref?: "/(auth)/login" | "/(auth)/provider-pending" | "/(resident)" | "/(provider)";
  requireApprovedProvider?: boolean;
};

export function RouteGate({
  children,
  requireRole,
  fallbackHref = "/(auth)/login",
  requireApprovedProvider = false,
}: RouteGateProps) {
  const { status, user } = useSession();

  if (status === "loading") {
    return (
      <AppScreen>
        <LoadingState label="Loading workspace..." />
      </AppScreen>
    );
  }

  if (status !== "authenticated") {
    return <Redirect href={fallbackHref} />;
  }

  if (requireRole) {
    const allowedRoles = Array.isArray(requireRole) ? requireRole : [requireRole];
    const currentRole = String(user?.role || "");
    if (!allowedRoles.includes(currentRole as AppRole)) {
      const nextHref = currentRole === "provider" ? "/(provider)" : "/(resident)";
      return <Redirect href={nextHref} />;
    }
  }

  if (requireApprovedProvider && String(user?.role || "") === "provider" && user?.isApproved === false) {
    return <Redirect href="/(auth)/provider-pending" />;
  }

  return <>{children}</>;
}
