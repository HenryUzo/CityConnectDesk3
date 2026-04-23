import { type ReactNode } from "react";
import { useLocation } from "wouter";
import Nav, { type LayoutNavPage } from "@/components/layout/Nav";
import MobileNavDrawer from "@/components/layout/MobileNavDrawer";

interface ResidentShellProps {
  children: ReactNode;
  currentPage: LayoutNavPage;
}

/**
 * Unified layout shell for all resident-facing pages.
 * Provides the collapsible icon sidebar (Nav) on desktop
 * and a hamburger-drawer (MobileNavDrawer) on mobile.
 */
export default function ResidentShell({
  children,
  currentPage,
}: ResidentShellProps) {
  const [, navigate] = useLocation();

  const navProps = {
    onBookServiceClick: () => navigate("/resident/requests/ordinary"),
    onNavigateToHomepage: () => navigate("/resident"),
    onNavigateToSettings: () => navigate("/resident/settings"),
    onNavigateToMarketplace: () => navigate("/resident/citymart"),
    onNavigateToMaintenance: () => navigate("/resident/maintenance"),
    onNavigateToServiceRequests: () => navigate("/service-requests"),
    onNavigateToOrdinaryFlow: () => navigate("/resident/requests/ordinary"),
    currentPage,
  };

  return (
    <div
      className="flex min-h-[100dvh] bg-[#054f31] lg:h-[100dvh] lg:overflow-hidden"
      data-name="ResidentShell"
    >
      <MobileNavDrawer {...navProps} />

      <div className="hidden lg:block h-[100dvh] shrink-0">
        <Nav {...navProps} />
      </div>

      <div className="flex-1 min-w-0 min-h-[100dvh] bg-white rounded-tl-[40px] rounded-bl-[40px] lg:my-[8px] lg:ml-[8px] lg:min-h-0 lg:overflow-y-auto lg:h-[calc(100dvh-16px)]">
        {children}
      </div>
    </div>
  );
}
