type NavigationTab = {
  label: string;
  isActive?: boolean;
  isComingSoon?: boolean;
  onClick?: () => void;
};

type SharedNavigationProps = {
  location?: string;
  tabs: NavigationTab[];
  searchPlaceholder?: string;
  onSearch?: (value: string) => void;
  onCartClick?: () => void;
  onCategoriesClick?: () => void;
  onLocationChange?: (location: string) => void;
};

export function CitymartNavigation({
  brandName,
  searchPlaceholder,
  location,
  tabs,
  onSearch,
  onCartClick,
  onCategoriesClick,
  onLocationChange,
  className = "",
}: SharedNavigationProps & {
  brandName?: string;
  className?: string;
}) {
  return (
    <div
      className={`bg-white rounded-[32px] px-[20px] py-[16px] shadow-[0px_20px_45px_rgba(6,24,44,0.1)] ${className}`}
      data-name="Citymart navigation"
    >
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[16px] font-semibold text-[#101828]">
              {brandName || "CityMart"}
            </p>
            {location && (
              <p className="text-[12px] uppercase text-[#667085]">
                {location}
              </p>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => onCartClick?.()}
              className="rounded-full border border-[#d0d5dd] px-3 py-1 text-[12px] font-medium text-[#039855]"
            >
              Cart
            </button>
            <button
              onClick={() => onCategoriesClick?.()}
              className="rounded-full border border-[#d0d5dd] px-3 py-1 text-[12px] font-medium text-[#039855]"
            >
              Categories
            </button>
          </div>
        </div>
        <div className="grid gap-2 md:grid-cols-3">
          <input
            type="text"
            placeholder={searchPlaceholder || "Search…"}
            onChange={(event) => onSearch?.(event.target.value)}
            className="w-full rounded-[16px] border border-[#f2f4f7] px-3 py-2 text-[12px]"
          />
          <button
            onClick={() => onLocationChange?.(location || "")}
            className="w-full rounded-[16px] border border-[#f2f4f7] px-3 py-2 text-[12px] text-left text-[#667085]"
          >
            {location ? `Location: ${location}` : "Select location"}
          </button>
          <div className="flex gap-2 overflow-x-auto">
            {tabs.map((tab) => (
              <button
                key={tab.label}
                onClick={tab.onClick}
                className={`rounded-[16px] border px-3 py-2 text-[12px] font-medium transition ${
                  tab.isActive
                    ? "border-[#039855] bg-[#ecfdf3] text-[#039855]"
                    : "border-[#f2f4f7] text-[#667085] hover:border-[#039855]/75"
                } ${tab.isComingSoon ? "opacity-70 pointer-events-none" : ""}`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function StickyNavigation({
  tabs,
  location,
  searchPlaceholder,
  isSticky,
  onSearch,
  onCartClick,
  onCategoriesClick,
  onLocationChange,
  className = "",
}: SharedNavigationProps & {
  isSticky?: boolean;
  className?: string;
}) {
  return (
    <div
      className={`bg-white px-[16px] py-[12px] shadow-[0px_10px_30px_rgba(6,24,44,0.1)] transition-transform duration-300 ${
        className
      }`}
      data-name="Sticky navigation"
    >
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-[12px] font-semibold uppercase text-[#039855]">
          {location || "CityMart"}
        </p>
        <div className="flex gap-2 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.label}
              onClick={tab.onClick}
              className={`rounded-[14px] border px-3 py-1 text-[12px] font-medium ${
                tab.isActive
                  ? "border-[#039855] bg-[#ecfdf3] text-[#039855]"
                  : "border-transparent text-[#667085]"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 ml-auto">
          <input
            type="text"
            onChange={(event) => onSearch?.(event.target.value)}
            placeholder={searchPlaceholder || "Search"}
            className="rounded-[12px] border border-[#f2f4f7] px-2 py-1 text-[12px]"
          />
          <button
            onClick={() => onCartClick?.()}
            className="rounded-[12px] border border-[#d0d5dd] px-3 py-1 text-[12px]"
          >
            Cart
          </button>
          <button
            onClick={() => onCategoriesClick?.()}
            className="rounded-[12px] border border-[#d0d5dd] px-3 py-1 text-[12px]"
          >
            Categories
          </button>
          <button
            onClick={() => onLocationChange?.(location || "")}
            className="rounded-[12px] border border-[#d0d5dd] px-3 py-1 text-[12px]"
          >
            {location ? "Change location" : "Set location"}
          </button>
        </div>
      </div>
    </div>
  );
}
