import { useEffect, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Home,
  LifeBuoy,
  LogOut,
  Settings,
  ShoppingBag,
  Wrench,
} from "lucide-react";

import { ProfilePics } from "@/components/resident/CityBuddyMessage";
import { useProfile } from "@/contexts/ProfileContext";

export type LayoutNavPage =
  | "homepage"
  | "chat"
  | "requests"
  | "settings"
  | "marketplace"
  | "playground";

export type LayoutNavProps = {
  onBookServiceClick?: () => void;
  onNavigateToHomepage?: () => void;
  onNavigateToSettings?: () => void;
  onNavigateToMarketplace?: () => void;
  onNavigateToServiceRequests?: () => void;
  currentPage: LayoutNavPage;
  defaultExpanded?: boolean;
  forceCollapsed?: boolean;
  disableAutoCollapse?: boolean;
};

type LayoutNavItemKey = Exclude<LayoutNavPage, "playground"> | "support";

type LayoutNavItem = {
  key: LayoutNavItemKey;
  label: string;
  Icon: LucideIcon;
  action?: () => void;
};

export default function Nav({
  onBookServiceClick,
  onNavigateToHomepage,
  onNavigateToSettings,
  onNavigateToMarketplace,
  onNavigateToServiceRequests,
  currentPage,
  defaultExpanded = false,
  forceCollapsed,
  disableAutoCollapse,
}: LayoutNavProps) {
  const { firstName, lastName, email } = useProfile();
  const [isCollapsed, setIsCollapsed] = useState(defaultExpanded === false);

  const [isBelowLg, setIsBelowLg] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const mediaQueryList = window.matchMedia("(max-width: 1023px)");
    const handleChange = () => setIsBelowLg(mediaQueryList.matches);

    handleChange();
    mediaQueryList.addEventListener("change", handleChange);
    return () => mediaQueryList.removeEventListener("change", handleChange);
  }, []);

  const autoCollapseActive = !disableAutoCollapse && isBelowLg;
  const collapsed = forceCollapsed ? true : autoCollapseActive ? true : isCollapsed;

  const navItems: LayoutNavItem[] = [
    {
      key: "homepage",
      label: "Dashboard",
      Icon: Home,
      action: onNavigateToHomepage,
    },
    {
      key: "chat",
      label: "Book a Service",
      Icon: Wrench,
      action: onBookServiceClick,
    },
    {
      key: "marketplace",
      label: "Marketplace",
      Icon: ShoppingBag,
      action: onNavigateToMarketplace,
    },
    {
      key: "requests",
      label: "Service requests",
      Icon: ClipboardList,
      action: onNavigateToServiceRequests,
    },
  ];

  const secondaryItems: LayoutNavItem[] = [
    {
      key: "support",
      label: "Support",
      Icon: LifeBuoy,
      action: onBookServiceClick,
    },
    {
      key: "settings",
      label: "Settings",
      Icon: Settings,
      action: onNavigateToSettings,
    },
  ];

  const isActive = (key: LayoutNavItemKey) => {
    if (key === "homepage") {
      return currentPage === "homepage" || currentPage === "playground";
    }
    if (key === "support") {
      return false;
    }
    return currentPage === key;
  };

  const handleToggle = () => {
    if (forceCollapsed || autoCollapseActive) {
      return;
    }
    setIsCollapsed((prev) => !prev);
  };

  const width = collapsed ? 96 : 280;

  const renderNavItem = (item: LayoutNavItem) => {
    const active = isActive(item.key);
    const baseClasses =
      "flex items-center gap-3 rounded-2xl px-3 py-3 text-left text-sm font-semibold transition-colors duration-200";
    const collapsedClasses = collapsed ? "justify-center px-0" : "";
    const stateClasses = active
      ? "bg-[#039855] text-white shadow-[0px_10px_30px_rgba(6,24,44,0.25)]"
      : "text-white/90 hover:bg-white/10";

    return (
      <button
        type="button"
        key={item.key}
        onClick={item.action}
        disabled={!item.action}
        className={`${baseClasses} ${collapsedClasses} ${stateClasses}`}
        style={{ width: "100%" }}
      >
        <item.Icon
          size={20}
          className={`transition ${active ? "text-white" : "text-white/80"}`}
        />
        {!collapsed && (
          <span className="flex-1 truncate">{item.label}</span>
        )}
      </button>
    );
  };

  return (
    <aside
      className="flex flex-col h-full min-h-screen bg-[#054f31] text-white transition-all duration-200"
      style={{ width }}
    >
      {/* TOP SECTION: Logo / Estate */}
      <div className="px-4 py-4">
        <div className="flex items-center justify-between">
          {!collapsed && (
            <div className="text-[18px] font-semibold tracking-wider uppercase">
              CityConnect
            </div>
          )}
          {!forceCollapsed && !autoCollapseActive && (
            <button
              type="button"
              onClick={handleToggle}
              className="rounded-full bg-white/10 p-2 text-white transition hover:bg-white/20"
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {collapsed ? (
                <ChevronRight size={18} />
              ) : (
                <ChevronLeft size={18} />
              )}
            </button>
          )}
        </div>
      </div>

      {/* PRIMARY NAV SECTION */}
      <div className="flex flex-col gap-2 px-2">
        {navItems.map(renderNavItem)}
      </div>

      {/* FLEX SPACER */}
      <div className="flex-1" />

      {/* BOTTOM SECTION: Support, Settings */}
      <div className="flex flex-col gap-2 px-2">
        {secondaryItems.map(renderNavItem)}
      </div>

      <div className="px-4 py-6 border-t border-white/10">
        <div
          className={`flex items-center gap-3 ${
            collapsed ? "justify-center" : ""
          }`}
        >
          <ProfilePics size={collapsed ? 36 : 48} />
          {!collapsed && (
            <div className="flex flex-col">
              <span className="text-sm font-semibold">
                {firstName} {lastName}
              </span>
              <span className="text-xs text-white/70 truncate">{email}</span>
            </div>
          )}
        </div>
        {!collapsed && (
          <button
            type="button"
            className="mt-4 flex items-center gap-2 text-xs uppercase tracking-wide text-white/80 hover:text-white"
          >
            <LogOut size={16} />
            <span>Sign out</span>
          </button>
        )}
      </div>
    </aside>
  );
}
