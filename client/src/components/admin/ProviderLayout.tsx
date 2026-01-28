import {
  LogOut,
  Star,
  Briefcase,
  Store,
  Package,
  LayoutDashboard,
  Building,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

interface ProviderLayoutProps {
  children: React.ReactNode;
  title: string;
}

const navLinks = [
  { href: "/provider-dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/provider/jobs", icon: Briefcase, label: "My Jobs" },
  { href: "/provider-store-items", icon: Store, label: "My Stores" },
  { href: "/provider/marketplace", icon: Package, label: "Marketplace" },
];

export function ProviderLayout({ children, title }: ProviderLayoutProps) {
  const [location] = useLocation();
  const { user, logoutMutation } = useAuth();
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

  const handleLogout = async () => {
    await logoutMutation.mutateAsync();
  };

  const hasCompany = Boolean(providerCompany && (providerCompany as any).id);
  const companyApproved = Boolean(providerCompany?.isActive);

  return (
    <TooltipProvider>
      <div className="flex min-h-screen w-full flex-col bg-muted/40">
        <aside className="fixed inset-y-0 left-0 z-10 hidden w-14 flex-col border-r bg-background sm:flex">
          <nav className="flex flex-col items-center gap-4 px-2 sm:py-5">
            <Link
              href="/provider-dashboard"
              className="group flex h-9 w-9 shrink-0 items-center justify-center gap-2 rounded-full bg-primary text-lg font-semibold text-primary-foreground md:h-8 md:w-8 md:text-base"
            >
              <Building className="h-4 w-4 transition-all group-hover:scale-110" />
              <span className="sr-only">CityConnect</span>
            </Link>
            {navLinks.map((link) => (
              <Tooltip key={link.href}>
                <TooltipTrigger asChild>
                  <Link
                    href={link.href}
                    className={`flex h-9 w-9 items-center justify-center rounded-lg transition-colors md:h-8 md:w-8 ${
                      location === link.href
                        ? "bg-accent text-accent-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <link.icon className="h-5 w-5" />
                    <span className="sr-only">{link.label}</span>
                  </Link>
                </TooltipTrigger>
                <TooltipContent side="right">{link.label}</TooltipContent>
              </Tooltip>
            ))}
          </nav>
          <nav className="mt-auto flex flex-col items-center gap-4 px-2 sm:py-5">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 md:h-8 md:w-8"
                  onClick={handleLogout}
                  data-testid="button-logout"
                >
                  <LogOut className="h-5 w-5" />
                  <span className="sr-only">Logout</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">Logout</TooltipContent>
            </Tooltip>
          </nav>
        </aside>
        <div className="flex flex-col sm:gap-4 sm:py-4 sm:pl-14">
          <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-background px-4 sm:static sm:h-auto sm:border-0 sm:bg-transparent sm:px-6">
            <h1 className="text-xl font-semibold text-foreground">{title}</h1>
            <div className="ml-auto flex items-center gap-4">
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-muted-foreground">Rating:</span>
                  <div className="flex items-center">
                    <Star className="w-4 h-4 text-yellow-400 fill-current" />
                    <span className="ml-1 font-semibold text-foreground" data-testid="text-provider-rating">
                      {user?.rating || "4.8"}
                    </span>
                  </div>
                </div>
                {!hasCompany && (
                  <Link href="/company-registration">
                    <Button variant="secondary" size="sm" data-testid="button-register-company">
                      Register as Company
                    </Button>
                  </Link>
                )}
                {hasCompany && companyApproved && (
                  <Link href="/company-dashboard">
                    <Button variant="secondary" size="sm" data-testid="button-go-to-company">
                      Go to Company
                    </Button>
                  </Link>
                )}
                {hasCompany && !companyApproved && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-50"
                    disabled
                    data-testid="button-company-awaiting"
                  >
                    Awaiting Review
                  </Button>
                )}
            </div>
          </header>
          <main className="grid flex-1 items-start gap-4 p-4 sm:px-6 sm:py-0 md:gap-8">
            {children}
          </main>
        </div>
      </div>
    </TooltipProvider>
  );
}
