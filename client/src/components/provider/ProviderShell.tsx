import type { CSSProperties, ReactNode } from "react";
import {
  Briefcase,
  Building2,
  LayoutDashboard,
  LogOut,
  MessageSquare,
  Package,
  Star,
  Store,
} from "lucide-react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import { ProviderPageHeader } from "@/components/provider/provider-primitives";

type ProviderShellProps = {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
  contentClassName?: string;
};

type NavItem = {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  match: (pathname: string) => boolean;
};


const providerThemeVars: CSSProperties = {
  ["--primary" as any]: "151 75% 32%",
  ["--primary-foreground" as any]: "0 0% 100%",
  ["--ring" as any]: "151 75% 32%",
};
const navItems: NavItem[] = [
  {
    href: "/provider/dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
    match: (pathname) => pathname === "/provider" || pathname === "/provider/dashboard",
  },
  {
    href: "/provider/company-registration",
    label: "Business",
    icon: Building2,
    match: (pathname) => pathname.startsWith("/provider/company-registration") || pathname.startsWith("/company-registration"),
  },
  {
    href: "/provider/jobs",
    label: "Jobs",
    icon: Briefcase,
    match: (pathname) => pathname.startsWith("/provider/jobs"),
  },
  {
    href: "/provider/tasks",
    label: "Tasks",
    icon: Briefcase,
    match: (pathname) => pathname.startsWith("/provider/tasks"),
  },
  {
    href: "/provider/chat",
    label: "Chat",
    icon: MessageSquare,
    match: (pathname) => pathname.startsWith("/provider/chat"),
  },
  {
    href: "/provider/stores",
    label: "Stores",
    icon: Store,
    match: (pathname) =>
      pathname === "/provider/stores" || pathname.startsWith("/provider/stores/"),
  },
  {
    href: "/provider/marketplace",
    label: "Marketplace",
    icon: Package,
    match: (pathname) => pathname.startsWith("/provider/marketplace"),
  },
];

export function ProviderShell({
  title,
  subtitle,
  actions,
  children,
  contentClassName,
}: ProviderShellProps) {
  const [location] = useLocation();
  const { user, logoutMutation } = useAuth();
  const pathname = location.split("?")[0];

  const { data: providerCompany } = useQuery({
    queryKey: ["/api/provider/company"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/provider/company");
      if (!res.ok) return null;
      return res.json();
    },
    enabled: user?.role === "provider",
    staleTime: 30_000,
  });

  const hasCompany = Boolean(providerCompany && (providerCompany as any).id);
  const companyApproved = Boolean((providerCompany as any)?.isActive);
  const companyOwner = Boolean((providerCompany as any)?.isOwner);

  return (
    <div
      className="flex min-h-screen bg-gradient-to-br from-emerald-50 via-background to-background text-foreground"
      style={providerThemeVars}
    >
      <aside className="hidden w-[280px] shrink-0 border-r border-emerald-900/30 bg-gradient-to-b from-[#00563f] via-[#00644a] to-[#07523f] text-emerald-50 shadow-[8px_0_28px_rgba(2,44,34,0.18)] lg:flex lg:flex-col">
        <div className="border-b border-emerald-200/15 px-5 py-5">
          <Link href="/provider/dashboard">
            <a className="flex items-center gap-3 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-200 focus-visible:ring-offset-2 focus-visible:ring-offset-emerald-900">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-300/20 text-emerald-100 shadow-[0_12px_28px_rgba(0,0,0,0.18)] ring-1 ring-emerald-200/25">
                <Building2 className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-100/70">
                  CityConnect
                </p>
                <p className="text-lg font-semibold text-emerald-50">Provider Hub</p>
              </div>
            </a>
          </Link>
        </div>

        <ScrollArea className="flex-1 px-4 py-5">
          <nav className="space-y-1.5">
            {navItems.map((item) => {
              const isActive = item.match(pathname);
              const Icon = item.icon;
              return (
                <Link key={item.href} href={item.href}>
                  <a
                    aria-current={isActive ? "page" : undefined}
                    className={cn(
                      "group flex items-center gap-3 rounded-2xl px-3.5 py-3 text-sm font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-200 focus-visible:ring-offset-2 focus-visible:ring-offset-emerald-900",
                      isActive
                        ? "bg-emerald-50/90 text-emerald-900 shadow-[0_10px_24px_rgba(0,0,0,0.2)] ring-1 ring-emerald-200/80"
                        : "text-emerald-100/85 hover:bg-emerald-400/10 hover:text-emerald-50",
                    )}
                  >
                    <span
                      className={cn(
                        "flex h-9 w-9 items-center justify-center rounded-xl transition-colors",
                        isActive
                          ? "bg-white text-emerald-700"
                          : "bg-emerald-900/35 text-emerald-100 group-hover:bg-emerald-300/20",
                      )}
                    >
                      <Icon className="h-4.5 w-4.5" />
                    </span>
                    <span>{item.label}</span>
                  </a>
                </Link>
              );
            })}
          </nav>
        </ScrollArea>

        <div className="border-t border-emerald-200/15 p-4">
          <Button
            variant="ghost"
            className="w-full justify-start rounded-2xl border border-emerald-100/20 bg-emerald-950/25 text-emerald-50 hover:bg-emerald-950/40 hover:text-emerald-50"
            onClick={() => logoutMutation.mutate()}
            data-testid="button-logout"
          >
            <LogOut className="mr-2 h-4 w-4" />
            Logout
          </Button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 border-b border-emerald-100/80 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/85">
          <ProviderPageHeader
            title={title}
            subtitle={subtitle}
            actions={
              <>
                {actions}
                <div
                  className="inline-flex items-center gap-2 rounded-full border border-amber-200/80 bg-amber-50 px-3 py-1.5 text-sm font-medium text-amber-800"
                  aria-label={`Provider rating ${user?.rating || "4.8"}`}
                >
                  <Star className="h-4 w-4 fill-current" />
                  <span>{user?.rating || "4.8"}</span>
                </div>
                {!hasCompany ? (
                  <Button asChild variant="outline" className="rounded-full border-emerald-200 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800">
                    <Link href="/provider/company-registration">Register business</Link>
                  </Button>
                ) : companyApproved && companyOwner ? (
                  <Button asChild className="rounded-full bg-emerald-600 text-white hover:bg-emerald-700">
                    <Link href="/company-dashboard">Go to Company</Link>
                  </Button>
                ) : hasCompany && !companyOwner ? (
                  <Badge
                    variant="outline"
                    className="rounded-full border-border bg-muted px-3 py-1.5 text-muted-foreground"
                  >
                    Company access managed by owner
                  </Badge>
                ) : (
                  <Badge
                    variant="outline"
                    className="rounded-full border-amber-200 bg-amber-50 px-3 py-1.5 text-amber-700"
                  >
                    Business awaiting review
                  </Badge>
                )}
              </>
            }
          />
        </header>

        <main className={cn("min-h-0 flex-1 overflow-auto px-4 py-4 sm:px-6 lg:px-8", contentClassName)}>
          {children}
        </main>
      </div>
    </div>
  );
}
