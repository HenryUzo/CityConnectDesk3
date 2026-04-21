import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";
import { Loader2 } from "lucide-react";
import { Redirect, Route } from "wouter";

type ProtectedRouteProps = {
  path: string;
  component: React.ComponentType<any>;
  requiredRole?: string;
  requiredRoles?: string[];
  fallbackPath?: string;
  allowUnapprovedProvider?: boolean;
  requireCompanyAccess?: boolean;
  requireActiveCompany?: boolean;
  requireCompanyOwner?: boolean;
  companyFallbackPath?: string;
};

type ProviderCompany = {
  id?: string;
  isActive?: boolean | null;
  isOwner?: boolean | null;
} | null;

function RouteLoader({ path }: { path: string }) {
  return (
    <Route path={path}>
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-border" />
      </div>
    </Route>
  );
}

export function ProtectedRoute({
  path,
  component: Component,
  requiredRole,
  requiredRoles,
  fallbackPath = "/",
  allowUnapprovedProvider = false,
  requireCompanyAccess = false,
  requireActiveCompany = false,
  requireCompanyOwner = false,
  companyFallbackPath = "/provider/company-registration",
}: ProtectedRouteProps) {
  const { user, isLoading } = useAuth();

  const shouldCheckCompanyAccess =
    !!user && user.role === "provider" && (requireCompanyAccess || requireCompanyOwner);

  const {
    data: providerCompany,
    isLoading: isCompanyLoading,
  } = useQuery<ProviderCompany>({
    queryKey: ["/api/provider/company", "route-guard"],
    enabled: shouldCheckCompanyAccess,
    staleTime: 30_000,
    queryFn: async () => {
      try {
        const res = await apiRequest("GET", "/api/provider/company");
        if (!res.ok) return null;
        return (await res.json()) as ProviderCompany;
      } catch {
        return null;
      }
    },
  });

  if (isLoading) {
    return <RouteLoader path={path} />;
  }

  if (!user) {
    return (
      <Route path={path}>
        <Redirect to="/auth" />
      </Route>
    );
  }

  const allowedRoles = requiredRoles && requiredRoles.length > 0
    ? requiredRoles
    : requiredRole
      ? [requiredRole]
      : [];

  if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
    return (
      <Route path={path}>
        <Redirect to={fallbackPath} />
      </Route>
    );
  }

  if (user.role === "provider" && user.isApproved === false && !allowUnapprovedProvider) {
    return (
      <Route path={path}>
        <Redirect to="/waiting-room" />
      </Route>
    );
  }

  if (shouldCheckCompanyAccess && isCompanyLoading) {
    return <RouteLoader path={path} />;
  }

  if (shouldCheckCompanyAccess) {
    const hasCompany = Boolean(providerCompany?.id);
    const isActiveCompany = providerCompany?.isActive !== false;
    const isCompanyOwner = providerCompany?.isOwner !== false;

    if (!hasCompany || (requireActiveCompany && !isActiveCompany) || (requireCompanyOwner && !isCompanyOwner)) {
      return (
        <Route path={path}>
          <Redirect to={companyFallbackPath} />
        </Route>
      );
    }
  }

  return (
    <Route path={path}>
      <Component />
    </Route>
  );
}
