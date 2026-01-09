import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import Nav from "@/components/layout/Nav";
import MobileNavDrawer from "@/components/layout/MobileNavDrawer";
import { CitymartNavigation, StickyNavigation } from "@/components/ui/navigation";
import { FiftyPercentBanner, AsideBannerLong, AsideBannerMedium, AsideBannerSmall, FullWidthBanner } from "@/components/ui/banners";
import { HorizontalCard, CategoryCard } from "@/components/ui/cards";
import ProductCard from "@/components/ui/cards";
import { Pagination } from '../../components/ui/pagination'
import imgFrame1261153572 from "@/assets/illustrations/630a3214d20e175564b7a3c374bb6db96b4406f8.png";
import imgImage5 from "@/assets/illustrations/d59fbc735d007a7cd4f9a1f5213a75e964a3267f.png";
import imgFrame1261153583 from "@/assets/illustrations/e8ff5d9eeecdd876bb66bad7e2c0a06d80d02639.png";
import { ChevronLeft, ChevronRight } from "lucide-react";

export default function CityMart() {
  const [, navigate] = useLocation();
  const handleNavigateToHomepage = () => navigate("/resident");
  const handleNavigateToMarketplace = () => navigate("/resident/citymart");
  const handleNavigateToSettings = () => navigate("/resident/settings");
  const handleNavigateToChat = () => navigate("/resident/requests/new");
  const [activeTab, setActiveTab] = useState("all-markets");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedLocation, setSelectedLocation] = useState("Lagos, Nigeria");
  const categoryScrollRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [showStickyNav, setShowStickyNav] = useState(false);
  const [activeStoreTab, setActiveStoreTab] = useState("the-city-corner");
  const [currentPage, setCurrentPage] = useState(1);

  const tabs = [
    { label: "All Markets", id: "all-markets" },
    { label: "Local Markets", id: "local-markets" },
    { label: "Malls", id: "malls" },
    { label: "Neighborhood Shops", id: "neighborhood-shops" },
    { label: "Distress Sale", id: "distress-sale" },
    { label: "Properties (COMING SOON)", id: "properties", isComingSoon: true },
  ];

  // Scroll detection for sticky navigation
  useEffect(() => {
    const scrollContainer = scrollContainerRef.current;
    if (!scrollContainer) return;

    const handleScroll = () => {
      const scrollTop = scrollContainer.scrollTop;
      // Show sticky nav after scrolling 200px
      setShowStickyNav(scrollTop > 200);
    };

    scrollContainer.addEventListener("scroll", handleScroll);
    return () => scrollContainer.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollCategories = (direction: "left" | "right") => {
    if (categoryScrollRef.current) {
      const scrollAmount = 250; // Adjust scroll distance as needed
      const newScrollPosition =
        categoryScrollRef.current.scrollLeft +
        (direction === "right" ? scrollAmount : -scrollAmount);
      categoryScrollRef.current.scrollTo({
        left: newScrollPosition,
        behavior: "smooth",
      });
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-[#054f31]">
      {/* Sidebar Navigation */}
      <MobileNavDrawer
        onNavigateToHomepage={handleNavigateToHomepage}
        onNavigateToSettings={handleNavigateToSettings}
        onBookServiceClick={handleNavigateToChat}
        onNavigateToMarketplace={handleNavigateToMarketplace}
        onNavigateToServiceRequests={() => navigate("/service-requests")}
        currentPage="marketplace"
      />
      <div className="hidden lg:block">
        <Nav
          onNavigateToHomepage={handleNavigateToHomepage}
          onNavigateToSettings={handleNavigateToSettings}
          onBookServiceClick={handleNavigateToChat}
          onNavigateToMarketplace={handleNavigateToMarketplace}
          onNavigateToServiceRequests={() => navigate("/service-requests")}
          currentPage="marketplace"
        />
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden bg-white lg:rounded-tl-[40px] lg:rounded-bl-[40px] lg:ml-[14px] lg:mt-[12px]">
        {/* CityMart Navigation */}
        <div className={`shrink-0 transition-all duration-300 ${
          showStickyNav ? 'opacity-0 -translate-y-4 pointer-events-none h-0 overflow-hidden' : 'opacity-100 translate-y-0'
        }`}>
          <CitymartNavigation
            brandName="CityMart"
            searchPlaceholder="Search for any item"
            location={selectedLocation}
            tabs={tabs.map((tab) => ({
              label: tab.label,
              isActive: activeTab === tab.id,
              isComingSoon: tab.isComingSoon,
              onClick: () => setActiveTab(tab.id),
            }))}
            onSearch={(query) => {
              setSearchQuery(query);
              console.log(`Searching for: "${query}"`);
            }}
            onCartClick={() => {
              console.log("Cart clicked!");
            }}
            onCategoriesClick={() => {
              console.log("Categories opened!");
            }}
            onLocationChange={(loc) => {
              setSelectedLocation(loc);
              console.log(`Location changed to: ${loc}`);
            }}
          />
        </div>

        {/* Sticky Navigation - Appears on scroll */}
        <div
          className={`sticky top-0 left-0 right-0 z-40 transition-transform duration-300 ${
            showStickyNav ? "translate-y-0" : "-translate-y-full"
          }`}
        >
          <StickyNavigation
            tabs={tabs.map((tab) => ({
              label: tab.label,
              isActive: activeTab === tab.id,
              isComingSoon: tab.isComingSoon,
              onClick: () => setActiveTab(tab.id),
            }))}
            location={selectedLocation}
            searchPlaceholder="Search for any item"
            isSticky={showStickyNav}
            onSearch={(query) => {
              setSearchQuery(query);
              console.log(`Searching for: "${query}"`);
            }}
            onCartClick={() => {
              console.log("Cart clicked!");
            }}
            onCategoriesClick={() => {
              console.log("Categories opened!");
            }}
            onLocationChange={(loc) => {
              setSelectedLocation(loc);
              console.log(`Location changed to: ${loc}`);
            }}
          />
        </div>

        {/* Main Content Area */}
        <div className="flex-1 overflow-y-auto bg-[#f9fafb] px-[48px] py-[32px]" ref={scrollContainerRef}>
          <div className="w-full mx-auto">
            {/* Banners Section */}
            <div className="flex gap-[24px] items-start mb-[48px]">
              {/* Left Banner - Food Items */}
              <div className="flex-[819]">
                <FiftyPercentBanner
                  heading="Food items"
                  description="Get your fresh food items at market cost. No hidden charges."
                  buttonText="Shop now"
                  buttonVariant="primary"
                  priceText="₦299,000"
                  priceLabel="Just"
                  priceSuffix="Only!"
                  image={imgFrame1261153572}
                  showCarouselDots={true}
                  activeCarouselDot={0}
                  onButtonClick={() => console.log("Shop now clicked!")}
                />
              </div>

              {/* Right Banner - Google Pixel */}
              <div className="flex-[424]">
                <HorizontalCard
                  title="New Google Pixel 6 Pro"
                  image={imgImage5}
                  buttonText="Bid Now"
                  variant="dark"
                  badge={{ text: "HOT", color: "red" }}
                  discount="ABOVE 50%"
                  discountColor="yellow"
                  showCarouselDots={true}
                  activeCarouselDot={1}
                  onButtonClick={() => console.log("Bid Now clicked!")}
                />
              </div>
            </div>

            {/* Categories Section */}
            <div className="mb-[48px]">
              {/* Section Header */}
              <div className="flex items-center justify-between mb-[24px]">
                <h2 className="font-['Public_Sans:SemiBold',sans-serif] font-semibold text-[#191c1f] text-[20px] leading-[28px]">
                  Shop by Item Categories
                </h2>
                <button className="font-['Public_Sans:Medium',sans-serif] font-medium text-[#039855] text-[14px] leading-[20px] hover:underline">
                  View all Categories
                </button>
              </div>

              {/* Category Cards Container with Navigation */}
              <div className="relative">
                {/* Left Arrow Button */}
                <button
                  className="absolute left-[-24px] top-1/2 -translate-y-1/2 z-10 bg-white hover:bg-gray-50 rounded-full p-2 shadow-md border border-[#f2f4f7] transition-colors"
                  onClick={() => scrollCategories("left")}
                >
                  <ChevronLeft className="w-6 h-6 text-[#191c1f]" />
                </button>

                {/* Categories Grid */}
                <div
                  className="flex gap-[18px] items-center overflow-x-scroll scrollbar-hide"
                  ref={categoryScrollRef}
                >
                  <CategoryCard
                    icon="🥦"
                    label="Groceries & Fresh Produce"
                    onClick={() => console.log("Groceries clicked")}
                  />
                  <CategoryCard
                    icon="🥩"
                    label="Meat, Fish & Poultry"
                    onClick={() => console.log("Meat clicked")}
                  />
                  <CategoryCard
                    icon="🍞"
                    label="Bakery & Pastries"
                    onClick={() => console.log("Bakery clicked")}
                  />
                  <CategoryCard
                    icon="🪣"
                    label="Household Essentials"
                    onClick={() => console.log("Household clicked")}
                  />
                  <CategoryCard
                    icon="🍼"
                    label="Baby Care & Diapers"
                    onClick={() => console.log("Baby Care clicked")}
                  />
                  <CategoryCard
                    icon="🧴"
                    label="Personal Care"
                    onClick={() => console.log("Personal Care clicked")}
                  />
                  <CategoryCard
                    icon="🍎"
                    label="Snacks & Beverages"
                    onClick={() => console.log("Snacks clicked")}
                  />
                  <CategoryCard
                    icon="🧊"
                    label="Frozen Foods"
                    onClick={() => console.log("Frozen clicked")}
                  />
                </div>

                {/* Right Arrow Button */}
                <button
                  className="absolute right-[-24px] top-1/2 -translate-y-1/2 z-10 bg-white hover:bg-gray-50 rounded-full p-2 shadow-md border border-[#f2f4f7] transition-colors"
                  onClick={() => scrollCategories("right")}
                >
                  <ChevronRight className="w-6 h-6 text-[#191c1f]" />
                </button>
              </div>
            </div>

            {/* Hot Items Section */}
            <div className="mb-[48px]">
              {/* Section Header */}
              <div className="flex items-center justify-between mb-[24px]">
                <h2 className="font-['Public_Sans:SemiBold',sans-serif] font-semibold text-[#191c1f] text-[20px] leading-[28px]">
                  Hot items
                </h2>
                <button className="font-['Public_Sans:Medium',sans-serif] font-medium text-[#039855] text-[14px] leading-[20px] hover:underline flex items-center gap-1">
                  Browse All Products
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M6 12L10 8L6 4" stroke="#039855" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
              </div>

              {/* Products Grid - 4 columns */}
              <div className="grid grid-cols-4 gap-[24px]">
                {/* Row 1 */}
                <ProductCard
                  image="https://images.unsplash.com/photo-1690375097427-78224325d7da?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxtYWNrZXJlbCUyMGZpc2h8ZW58MXx8fHwxNzY3NDM1MjAxfDA&ixlib=rb-4.1.0&q=80&w=1080"
                  title="Tomato Amigo Premium Parboiled Rice (50kg)"
                  price="₦442.12"
                  originalPrice="₦850.99"
                  rating={4}
                  ratingText="(123) 456-7890"
                  badges={[
                    { text: "19% OFF", variant: "discount" },
                    { text: "DISTRESS", variant: "distress" },
                    { text: "HOT", variant: "hot" }
                  ]}
                  onFavoriteToggle={() => console.log("Favorite toggled")}
                  onAddToCart={() => console.log("Added to cart")}
                />
                
                <ProductCard
                  image="https://images.unsplash.com/photo-1668649176554-3ad841a780d0?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxibHVldG9vdGglMjBlYXJidWRzfGVufDF8fHx8MTc2NzM0MDY3MXww&ixlib=rb-4.1.0&q=80&w=1080"
                  title="Bose Sport Earbuds - Wireless Earphones - Bluetooth In Ear..."
                  price="₦2,300"
                  badges={[
                    { text: "SOLD OUT", variant: "custom", backgroundColor: "#929fa5", textColor: "#ffffff" }
                  ]}
                  onFavoriteToggle={() => console.log("Favorite toggled")}
                  onAddToCart={() => console.log("Added to cart")}
                />

                <ProductCard
                  image="https://images.unsplash.com/photo-1741061963569-9d0ef54d10d2?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxzbWFydHBob25lJTIwbW9iaWxlJTIwcGhvbmV8ZW58MXx8fHwxNzY3NDA5OTA4fDA&ixlib=rb-4.1.0&q=80&w=1080"
                  title="Simple Mobile 4G LTE Prepaid Smartphone"
                  price="₦220"
                  onFavoriteToggle={() => console.log("Favorite toggled")}
                  onAddToCart={() => console.log("Added to cart")}
                />

                <ProductCard
                  image="https://images.unsplash.com/photo-1686820740687-426a7b9b2043?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxyaWNlJTIwZ3JhaW5zfGVufDF8fHx8MTc2NzM3NjMxNHww&ixlib=rb-4.1.0&q=80&w=1080"
                  title="Ijebu Garri (1 paint rubber)"
                  price="₦1,50"
                  originalPrice="₦865"
                  badges={[
                    { text: "19% OFF", variant: "discount" }
                  ]}
                  onFavoriteToggle={() => console.log("Favorite toggled")}
                  onAddToCart={() => console.log("Added to cart")}
                />

                {/* Row 2 */}
                <ProductCard
                  image="https://images.unsplash.com/photo-1611648694931-1aeda329f9da?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjb21wdXRlciUyMG1vbml0b3J8ZW58MXx8fHwxNzY3NDExNzMyfDA&ixlib=rb-4.1.0&q=80&w=1080"
                  title="Dell Optiplex 7000x7480 All-in-One Computer Monitor"
                  price="₦299"
                  onFavoriteToggle={() => console.log("Favorite toggled")}
                  onAddToCart={() => console.log("Added to cart")}
                />

                <ProductCard
                  image="https://images.unsplash.com/photo-1626806819282-2c1dc01a5e0c?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx3YXNoaW5nJTIwbWFjaGluZXxlbnwxfHx8fDE3NjczOTQ3NDR8MA&ixlib=rb-4.1.0&q=80&w=1080"
                  title="Portable Washing Machine, 11lbs capacity, 1400 RPM"
                  price="₦70"
                  originalPrice="₦865.99"
                  rating={3}
                  ratingText="(816)"
                  onFavoriteToggle={() => console.log("Favorite toggled")}
                  onAddToCart={() => console.log("Added to cart")}
                />

                <ProductCard
                  image="https://images.unsplash.com/photo-1652377853721-b6d8c9594442?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjYXIlMjBjYXJidXJldG9yfGVufDF8fHx8MTc2NzQzNTIwM3ww&ixlib=rb-4.1.0&q=80&w=1080"
                  title="2-Barrel Carburetor Carb 2100 Engine Increase Horsepower"
                  price="₦160"
                  badges={[
                    { text: "HOT", variant: "hot" }
                  ]}
                  onFavoriteToggle={() => console.log("Favorite toggled")}
                  onAddToCart={() => console.log("Added to cart")}
                />
              </div>
            </div>

            {/* Stores Section */}
            <div className="mb-[48px]">
              {/* Section Header */}
              <div className="flex items-center justify-between mb-[24px]">
                <h2 className="font-['Public_Sans:SemiBold',sans-serif] font-semibold text-[#191c1f] text-[20px] leading-[28px]">
                  Stores
                </h2>
              </div>

              {/* Stores Layout - Aside banners on left, products on right */}
              <div className="flex gap-[24px] items-start">
                {/* Left Side - Aside Banners Stack */}
                <div className="flex flex-col gap-[24px]  shrink-0">
                  {/* Aside Banner Long - 32% Discount */}
                  <div className="w-full ">
                    <AsideBannerLong
                      category="COMPUTER & ACCESSORIES"
                      title="32% Discount"
                      description="For all ellectronics products"
                      highlightWord="ellectronics"
                      buttonText="Shop now"
                      dealExpiry="Deals ends in"
                      daysRemaining="16d : 21h : 57m : 23s"
                      onButtonClick={() => console.log("Shop now clicked")}
                    />
                  </div>

                  {/* Aside Banner Medium - Food Image */}
                  {/* <div className="w-full h-[427px]">
                    <AsideBannerMedium
                      title=""
                      description=""
                      image="https://images.unsplash.com/photo-1622046751454-c99d3794f96a?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxmb29kJTIwbWVhbCUyMHBsYXR0ZXJ8ZW58MXx8fHwxNzY3NDM2ODExfDA&ixlib=rb-4.1.0&q=80&w=1080"
                      showButton={false}
                    />
                  </div> */}

                  {/* Aside Banner Small - 37% Discount for SmartPhone */}
                  <div className="w-full h-[232px]">
                    <AsideBannerSmall
                      title="37% DISCOUNT"
                      description="only for SmartPhone product."
                      highlightWord="SmartPhone"
                      buttonText="Shop now"
                      onButtonClick={() => console.log("Shop now clicked")}
                    />
                  </div>
                </div>

                {/* Right Side - Stores Tabs and Product Grid */}
                <div className="flex-1">
                  {/* Store Tabs */}
                  <div className="flex gap-[8px] mb-[24px] border-b border-[#e4e7e9] w-full overflow-x-auto">
                    <button
                      className={`px-[16px] py-[12px] font-['Public_Sans:Medium',sans-serif] font-medium text-[14px] leading-[20px] transition-colors border-b-2 ${
                        activeStoreTab === "the-city-corner"
                          ? "text-[#039855] border-[#039855]"
                          : "text-[#475467] border-transparent hover:text-[#039855]"
                      }`}
                      onClick={() => setActiveStoreTab("the-city-corner")}
                    >
                      The City Corner
                    </button>
                    <button
                      className={`px-[16px] py-[12px] font-['Public_Sans:Medium',sans-serif] font-medium text-[14px] leading-[20px] transition-colors border-b-2 ${
                        activeStoreTab === "fresh-fruits-market"
                          ? "text-[#039855] border-[#039855]"
                          : "text-[#475467] border-transparent hover:text-[#039855]"
                      }`}
                      onClick={() => setActiveStoreTab("fresh-fruits-market")}
                    >
                      Fresh Fruits Market
                    </button>
                    <button
                      className={`px-[16px] py-[12px] font-['Public_Sans:Medium',sans-serif] font-medium text-[14px] leading-[20px] transition-colors border-b-2 ${
                        activeStoreTab === "the-grand-emporium"
                          ? "text-[#039855] border-[#039855]"
                          : "text-[#475467] border-transparent hover:text-[#039855]"
                      }`}
                      onClick={() => setActiveStoreTab("the-grand-emporium")}
                    >
                      The Grand Emporium
                    </button>
                    <button
                      className={`px-[16px] py-[12px] font-['Public_Sans:Medium',sans-serif] font-medium text-[14px] leading-[20px] transition-colors border-b-2 ${
                        activeStoreTab === "charming-village-store"
                          ? "text-[#039855] border-[#039855]"
                          : "text-[#475467] border-transparent hover:text-[#039855]"
                      }`}
                      onClick={() => setActiveStoreTab("charming-village-store")}
                    >
                      Charming Village Store
                    </button>
                    <button
                      className={`px-[16px] py-[12px] font-['Public_Sans:Medium',sans-serif] font-medium text-[14px] leading-[20px] transition-colors border-b-2 ${
                        activeStoreTab === "biggest-news"
                          ? "text-[#039855] border-[#039855]"
                          : "text-[#475467] border-transparent hover:text-[#039855]"
                      }`}
                      onClick={() => setActiveStoreTab("biggest-news")}
                    >
                      Biggest News
                    </button>
                  </div>

                  {/* Products Grid - 3 columns */}
                  <div className="grid grid-cols-[248px_248px_248px] gap-0 mb-[24px] w-fit">
                    {/* Row 1 */}
                    <ProductCard
                      image="https://images.unsplash.com/photo-1668649176554-3ad841a780d0?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxibHVldG9vdGglMjBlYXJidWRzfGVufDF8fHx8MTc2NzM0MDY3MXww&ixlib=rb-4.1.0&q=80&w=1080"
                      title="Bose Sport Earbuds - Wireless Earphones - Bluetooth In Ear..."
                      price="₦2,300"
                      badges={[
                        { text: "SOLD OUT", variant: "custom", backgroundColor: "#929fa5", textColor: "#ffffff" }
                      ]}
                      onFavoriteToggle={() => console.log("Favorite toggled")}
                      onAddToCart={() => console.log("Added to cart")}
                    />

                    <ProductCard
                      image="https://images.unsplash.com/photo-1626806819282-2c1dc01a5e0c?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx3YXNoaW5nJTIwbWFjaGluZXxlbnwxfHx8fDE3NjczOTQ3NDR8MA&ixlib=rb-4.1.0&q=80&w=1080"
                      title="Simple Mobile 4G LTE Prepaid Smartphone"
                      price="₦220"
                      onFavoriteToggle={() => console.log("Favorite toggled")}
                      onAddToCart={() => console.log("Added to cart")}
                    />

                    <ProductCard
                      image="https://images.unsplash.com/photo-1686820740687-426a7b9b2043?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxyaWNlJTIwZ3JhaW5zfGVufDF8fHx8MTc2NzM3NjMxNHww&ixlib=rb-4.1.0&q=80&w=1080"
                      title="Ijebu Garri (1 paint rubber)"
                      price="₦1,50"
                      originalPrice="₦865"
                      badges={[
                        { text: "19% OFF", variant: "discount" }
                      ]}
                      onFavoriteToggle={() => console.log("Favorite toggled")}
                      onAddToCart={() => console.log("Added to cart")}
                    />

                    {/* Row 2 */}
                    <ProductCard
                      image="https://images.unsplash.com/photo-1611648694931-1aeda329f9da?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjb21wdXRlciUyMG1vbml0b3J8ZW58MXx8fHwxNzY3NDExNzMyfDA&ixlib=rb-4.1.0&q=80&w=1080"
                      title="Dell Optiplex 7000x7480 All-in-One Computer Monitor"
                      price="₦299"
                      onFavoriteToggle={() => console.log("Favorite toggled")}
                      onAddToCart={() => console.log("Added to cart")}
                    />

                    <ProductCard
                      image="https://images.unsplash.com/photo-1690375097427-78224325d7da?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxtYWNrZXJlbCUyMGZpc2h8ZW58MXx8fHwxNzY3NDM1MjAxfDA&ixlib=rb-4.1.0&q=80&w=1080"
                      title="Frozen Tuna Fillet"
                      price="₦850.00"
                      originalPrice="₦865.00"
                      rating={4}
                      ratingText="(238) 456-7890"
                      badges={[
                        { text: "19% OFF", variant: "discount" },
                        { text: "DISTRESS", variant: "distress" },
                        { text: "HOT", variant: "hot" },
                        { text: "SAVE UP TO 50%", variant: "custom", backgroundColor: "#f79009", textColor: "#ffffff" }
                      ]}
                      onFavoriteToggle={() => console.log("Favorite toggled")}
                      onAddToCart={() => console.log("Added to cart")}
                    />

                    <ProductCard
                      image="https://images.unsplash.com/photo-1652377853721-b6d8c9594442?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjYXIlMjBjYXJidXJldG9yfGVufDF8fHx8MTc2NzQzNTIwM3ww&ixlib=rb-4.1.0&q=80&w=1080"
                      title="2-Barrel Carburetor Carb 2100 Engine Increase Horsepower"
                      price="₦160"
                      badges={[
                        { text: "HOT", variant: "hot" }
                      ]}
                      onFavoriteToggle={() => console.log("Favorite toggled")}
                      onAddToCart={() => console.log("Added to cart")}
                    />

                    {/* Row 3 */}
                    <ProductCard
                      image="https://images.unsplash.com/photo-1690375097427-78224325d7da?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxtYWNrZXJlbCUyMGZpc2h8ZW58MXx8fHwxNzY3NDM1MjAxfDA&ixlib=rb-4.1.0&q=80&w=1080"
                      title="Frozen Tuna Fillet"
                      price="₦850.00"
                      originalPrice="₦865.00"
                      rating={3}
                      ratingText="(238) 456-7890"
                      badges={[
                        { text: "19% OFF", variant: "discount" },
                        { text: "DISTRESS", variant: "distress" },
                        { text: "HOT", variant: "hot" },
                        { text: "SAVE UP TO 50%", variant: "custom", backgroundColor: "#f79009", textColor: "#ffffff" }
                      ]}
                      onFavoriteToggle={() => console.log("Favorite toggled")}
                      onAddToCart={() => console.log("Added to cart")}
                    />

                    <ProductCard
                      image="https://images.unsplash.com/photo-1690375097427-78224325d7da?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxtYWNrZXJlbCUyMGZpc2h8ZW58MXx8fHwxNzY3NDM1MjAxfDA&ixlib=rb-4.1.0&q=80&w=1080"
                      title="Frozen Tuna Fillet"
                      price="₦850.00"
                      originalPrice="₦865.00"
                      rating={4}
                      ratingText="(238) 456-7890"
                      badges={[
                        { text: "19% OFF", variant: "discount" },
                        { text: "DISTRESS", variant: "distress" },
                        { text: "HOT", variant: "hot" },
                        { text: "SAVE UP TO 50%", variant: "custom", backgroundColor: "#f79009", textColor: "#ffffff" }
                      ]}
                      onFavoriteToggle={() => console.log("Favorite toggled")}
                      onAddToCart={() => console.log("Added to cart")}
                    />

                    <ProductCard
                      image="https://images.unsplash.com/photo-1690375097427-78224325d7da?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxtYWNrZXJlbCUyMGZpc2h8ZW58MXx8fHwxNzY3NDM1MjAxfDA&ixlib=rb-4.1.0&q=80&w=1080"
                      title="Frozen Tuna Fillet"
                      price="₦865.00"
                      rating={4}
                      ratingText="(238) 456-7890"
                      badges={[
                        { text: "19% OFF", variant: "discount" },
                        { text: "DISTRESS", variant: "distress" },
                        { text: "HOT", variant: "hot" },
                        { text: "SAVE UP TO 50%", variant: "custom", backgroundColor: "#f79009", textColor: "#ffffff" }
                      ]}
                      onFavoriteToggle={() => console.log("Favorite toggled")}
                      onAddToCart={() => console.log("Added to cart")}
                    />
                  </div>

                  {/* Pagination */}
                  <Pagination
                    currentPage={currentPage}
                    totalPages={10}
                    onPageChange={(page) => {
                      setCurrentPage(page);
                      console.log(`Page changed to: ${page}`);
                    }}
                    siblingCount={1}
                    showPrevNext={true}
                  />
                </div>
              </div>
            </div>

            {/* Full Width Banner - Macbook Pro */}
            <div className="mb-[48px] mx-[-48px]">
              <FullWidthBanner
                heading="Macbook Pro"
                description="Apple M1 Max Chip. 32GB Unified Memory, 1TB SSD Storage"
                price="₦299,000"
                priceTopText="Just"
                priceBottomText="Only!"
                promoBadgeText="SAVE UP TO 50%"
                buttonText="Shop now"
                backgroundImage={imgFrame1261153583}
                onButtonClick={() => console.log("Shop now clicked!")}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
