import { Link, useLocation } from "wouter";
import { LogOut, Building, Users, UserCheck, ClipboardList, LayoutDashboard, BarChart3, Settings, Bot, SlidersHorizontal } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface AdminLayoutProps {
  children: React.ReactNode;
  title: string;
}

export function AdminLayout({ children, title }: AdminLayoutProps) {
  const { user, logoutMutation } = useAuth();
  const [location] = useLocation();

  const handleLogout = async () => {
    await logoutMutation.mutateAsync();
  };

  const navLinks = [
    { href: "/admin", icon: LayoutDashboard, label: "Dashboard" },
    { href: "/admin/users", icon: Users, label: "User Management" },
    { href: "/admin/providers", icon: UserCheck, label: "Provider Management" },
    { href: "/admin/requests", icon: ClipboardList, label: "Service Requests" },
    { href: "/admin/reports", icon: BarChart3, label: "Reports & Analytics" },
    { href: "/admin/settings", icon: Settings, label: "Settings" },
  ];

  if (user?.globalRole === 'super_admin') {
    navLinks.push({ href: "/admin/ai/conversations", icon: Bot, label: "AI Conversations" });
    navLinks.push({ href: "/admin/ai/prepared-requests", icon: Bot, label: "AI Prepared Requests" });
    navLinks.push({ href: "/admin/pricing-rules", icon: SlidersHorizontal, label: "Pricing Rules" });
    navLinks.push({ href: "/admin/providers/matching", icon: UserCheck, label: "Provider Matching" });
    navLinks.push({ href: "/admin/request-questions", icon: SlidersHorizontal, label: "Request Questions" });
    navLinks.push({ href: "/admin-super", icon: Building, label: "Super Admin" });
  }

  return (
    <div className="flex min-h-screen w-full bg-muted/40">
      <aside className="fixed inset-y-0 left-0 z-10 hidden w-14 flex-col border-r bg-background sm:flex">
        <nav className="flex flex-col items-center gap-4 px-2 sm:py-5">
          <Link
            href="/admin"
            className="group flex h-9 w-9 shrink-0 items-center justify-center gap-2 rounded-full bg-primary text-lg font-semibold text-primary-foreground md:h-8 md:w-8 md:text-base"
          >
            <Building className="h-4 w-4 transition-all group-hover:scale-110" />
            <span className="sr-only">CityConnect</span>
          </Link>
          <TooltipProvider>
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
          </TooltipProvider>
        </nav>
        <nav className="mt-auto flex flex-col items-center gap-4 px-2 sm:py-5">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="mt-auto rounded-lg"
                  onClick={handleLogout}
                >
                  <LogOut className="h-5 w-5" />
                  <span className="sr-only">Logout</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">Logout</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </nav>
      </aside>
      <div className="flex flex-col sm:gap-4 sm:py-4 sm:pl-14 flex-1">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-background px-4 sm:static sm:h-auto sm:border-0 sm:bg-transparent sm:px-6">
          <h1 className="text-xl font-semibold">{title}</h1>
        </header>
        <main className="p-4 sm:px-6 sm:py-0">{children}</main>
      </div>
    </div>
  );
}
