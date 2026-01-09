import SettingsMain from "./SettingsMain";
import { SidebarNavigation } from "@/components/resident/CityBuddyChat";
import MobileNavDrawer from "@/components/layout/MobileNavDrawer";
import { useLocation } from "wouter";

function MainWrap() {
  return (
    <div
      className="basis-0 grow h-full min-h-px min-w-px relative shrink-0"
      data-name="Main wrap"
    >
      <div className="size-full">
        <div className="content-stretch flex flex-col items-start pb-0 pl-[14px] pr-0 pt-[12px] relative size-full">
          <SettingsMain />
        </div>
      </div>
    </div>
  );
}

export default function Settings() {
  const [, navigate] = useLocation();

  const handleNavigateToHomepage = () => navigate("/resident");
  const handleNavigateToMarketplace = () => navigate("/resident/citymart");
  const handleNavigateToSettings = () => navigate("/resident/settings");
  const handleNavigateToChat = () => navigate("/resident/requests/new");

  return (
    <div
      className="bg-[#054f31] content-stretch flex items-start relative size-full min-h-screen"
      data-name="Settings"
    >
      <MobileNavDrawer
        onNavigateToHomepage={handleNavigateToHomepage}
        onNavigateToMarketplace={handleNavigateToMarketplace}
        onNavigateToSettings={handleNavigateToSettings}
        onNavigateToServiceRequests={() => navigate("/service-requests")}
        onBookServiceClick={handleNavigateToChat}
        currentPage="settings"
      />
      <div className="hidden lg:block">
        <SidebarNavigation
          currentView="select-category"
          isActive={false}
          navCurrentPage="settings"
          onNavigateToServiceRequests={() => navigate("/service-requests")}
        />
      </div>
      <MainWrap />
    </div>
  );
}
