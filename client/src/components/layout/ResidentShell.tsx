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
    onBookServiceClick: () => navigate("/resident/requests/new"),
    onNavigateToHomepage: () => navigate("/resident"),
    onNavigateToSettings: () => navigate("/resident/settings"),
    onNavigateToMarketplace: () => navigate("/resident/citymart"),
    onNavigateToServiceRequests: () => navigate("/service-requests"),
    onNavigateToOrdinaryFlow: () => navigate("/resident/requests/ordinary"),
    currentPage,
  };

  return (
    <div
      className="flex h-screen overflow-hidden bg-[#054f31]"
      data-name="ResidentShell"
    >
      <MobileNavDrawer {...navProps} />

      <div className="hidden lg:block h-full">
        <Nav {...navProps} />
      </div>

      <div className="flex-1 min-w-0 h-full bg-white rounded-tl-[40px] rounded-bl-[40px] lg:ml-[14px] lg:mt-[12px] overflow-y-auto">
        {children}
      </div>
    </div>
  );
}
