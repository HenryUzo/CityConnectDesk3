import { Search, MapPin, ShoppingCart, ChevronDown, Menu } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type NavigationTab = {
  label: string;
  isActive?: boolean;
  isComingSoon?: boolean;
  onClick?: () => void;
};

type Estate = {
  id: string;
  name: string;
};

type SharedNavigationProps = {
  location?: string;
  estates?: Estate[];
  tabs: NavigationTab[];
  searchPlaceholder?: string;
  onSearch?: (value: string) => void;
  onCartClick?: () => void;
  onCategoriesClick?: () => void;
  onLocationChange?: (location: string) => void;
  cartCount?: number;
};

export function CitymartNavigation({
  brandName,
  searchPlaceholder,
  location,
  estates = [],
  tabs,
  onSearch,
  onCartClick,
  onCategoriesClick,
  onLocationChange,
  cartCount,
  className = "",
}: SharedNavigationProps & {
  brandName?: string;
  className?: string;
}) {
  return (
    <div className={`bg-white border-b border-[#e4e7e9] ${className}`}>
      <div className="px-4 md:px-6 lg:px-8">
        {/* Desktop row */}
        <div className="flex items-center h-[56px] gap-3">
          {/* Brand */}
          <span className="text-[18px] font-bold text-[#039855] whitespace-nowrap shrink-0">
            {brandName || "CityMart"}
          </span>

          {/* All categories button removed */}

          {/* Tabs moved to sit beside the search input on large screens */}

          <div className="flex-1 min-w-0" />

          {/* Search */}
          <div className="relative shrink-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#039855]" />
            <input
              type="text"
              placeholder={searchPlaceholder || "Search for my item"}
              onChange={(e) => onSearch?.(e.target.value)}
              className="w-[280px] md:w-[400px] lg:w-[440px] pl-9 pr-3 py-[7px] border border-[#e4e7e9] rounded-full text-[13px] text-[#191c1f] placeholder:text-[#98a2b3] focus:outline-none focus:border-[#039855] focus:ring-1 focus:ring-[#039855]/20 bg-[#f9fafb]"
              style={{ animation: 'pulse 5s infinite' }}
            />
          </div>

          {/* Tabs (moved next to search) */}
          <nav className="hidden lg:flex items-center gap-0.5 overflow-x-auto min-w-0">
            {tabs.map((tab) => (
              <button
                key={tab.label}
                onClick={tab.onClick}
                className={`px-2 py-1 text-[12px] whitespace-nowrap transition-colors ${
                  tab.isActive
                    ? "text-[#191c1f] font-semibold"
                    : "text-[#5f6c72] hover:text-[#191c1f] font-normal"
                } ${tab.isComingSoon ? "opacity-50 pointer-events-none text-[11px]" : ""}`}
              >
                {tab.label}
              </button>
            ))}
          </nav>

          {/* Location dropdown */}
          <div className="hidden lg:flex shrink-0">
            <Select value={location || "global"} onValueChange={onLocationChange}>
              <SelectTrigger className="w-[160px] border-[#e4e7e9] text-[13px] h-[32px] bg-[#f9fafb]">
                <div className="flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-[#039855]" />
                  <SelectValue placeholder="Select location" />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="global">
                  <div className="flex items-center gap-2">
                    <span className="text-[13px]">🌍 Global</span>
                  </div>
                </SelectItem>
                {estates.map((estate) => (
                  <SelectItem key={estate.id} value={estate.id}>
                    <div className="flex items-center gap-2">
                      <span className="text-[13px]">{estate.name}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Cart */}
          <button
            onClick={() => onCartClick?.()}
            className="relative shrink-0 p-2 hover:bg-[#f2f4f7] rounded-lg transition-colors"
          >
            <ShoppingCart className="w-5 h-5 text-[#191c1f]" />
            {(cartCount ?? 0) > 0 && (
              <span className="absolute -top-0.5 -right-0.5 bg-[#039855] text-white text-[10px] font-bold rounded-full min-w-[16px] h-[16px] flex items-center justify-center px-0.5">
                {cartCount! > 99 ? "99+" : cartCount}
              </span>
            )}
          </button>
        </div>

        {/* Mobile tabs */}
        <div className="lg:hidden flex items-center gap-1 pb-2 overflow-x-auto scrollbar-hide">
          {/* Mobile 'All' categories button removed */}
          {tabs.map((tab) => (
            <button
              key={tab.label}
              onClick={tab.onClick}
              className={`px-2.5 py-1 text-[12px] whitespace-nowrap transition-colors ${
                tab.isActive
                  ? "text-[#191c1f] font-semibold"
                  : "text-[#5f6c72] font-normal"
              } ${tab.isComingSoon ? "opacity-50 pointer-events-none" : ""}`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export function StickyNavigation({
  tabs,
  location,
  estates = [],
  searchPlaceholder,
  isSticky,
  onSearch,
  onCartClick,
  onCategoriesClick,
  onLocationChange,
  cartCount,
  className = "",
}: SharedNavigationProps & {
  isSticky?: boolean;
  className?: string;
}) {
  return (
    <div
      className={`bg-white border-b border-[#e4e7e9] shadow-sm ${className}`}
      data-name="Sticky navigation"
    >
      <div className="px-4 md:px-6 lg:px-8">
        <div className="flex items-center h-[48px] gap-3">
          <span className="text-[15px] font-bold text-[#039855] whitespace-nowrap shrink-0">
            CityMart
          </span>

          {/* Left tabs removed to avoid duplicate tabs on sticky nav */}

          <div className="flex-1" />

          <div className="relative shrink-0">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#039855]" />
            <input
              type="text"
              onChange={(e) => onSearch?.(e.target.value)}
              placeholder={searchPlaceholder || "Search"}
              className="w-[320px] lg:w-[400px] pl-8 pr-3 py-1.5 border border-[#e4e7e9] rounded-full text-[12px] placeholder:text-[#98a2b3] focus:outline-none focus:border-[#039855] bg-[#f9fafb]"
              style={{ animation: 'pulse 5s infinite' }}
            />
          </div>

          {/* Tabs (moved next to search on sticky nav) */}
          <nav className="hidden lg:flex items-center gap-0.5 overflow-x-auto min-w-0">
            {tabs.map((tab) => (
              <button
                key={tab.label}
                onClick={tab.onClick}
                className={`px-2 py-1 text-[12px] whitespace-nowrap transition-colors ${
                  tab.isActive
                    ? "text-[#191c1f] font-semibold"
                    : "text-[#5f6c72] font-normal"
                } ${tab.isComingSoon ? "opacity-50 pointer-events-none" : ""}`}
              >
                {tab.label}
              </button>
            ))}
          </nav>

          {/* Location dropdown */}
          <div className="hidden lg:flex shrink-0">
            <Select value={location || "global"} onValueChange={onLocationChange}>
              <SelectTrigger className="w-[140px] border-[#e4e7e9] text-[12px] h-[28px] bg-[#f9fafb]">
                <div className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-[#039855]" />
                  <SelectValue placeholder="Location" />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="global">
                  <span className="text-[12px]">🌍 Global</span>
                </SelectItem>
                {estates.map((estate) => (
                  <SelectItem key={estate.id} value={estate.id}>
                    <span className="text-[12px]">{estate.name}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <button
            onClick={() => onCartClick?.()}
            className="relative shrink-0 p-1.5 hover:bg-[#f2f4f7] rounded-lg"
          >
            <ShoppingCart className="w-[18px] h-[18px] text-[#191c1f]" />
            {(cartCount ?? 0) > 0 && (
              <span className="absolute -top-0.5 -right-0.5 bg-[#039855] text-white text-[9px] font-bold rounded-full min-w-[14px] h-[14px] flex items-center justify-center px-0.5">
                {cartCount! > 99 ? "99+" : cartCount}
              </span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
