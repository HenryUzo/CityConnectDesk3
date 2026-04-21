import { useState, useRef, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import ResidentShell from "@/components/layout/ResidentShell";
import { CitymartNavigation, StickyNavigation } from "@/components/ui/navigation";
import { FiftyPercentBanner, AsideBannerLong, AsideBannerSmall, FullWidthBanner } from "@/components/ui/banners";
import { HorizontalCard, CategoryCard } from "@/components/ui/cards";
import ProductCard from "@/components/ui/cards";
import { Pagination } from "@/components/ui/pagination";
import {
  ChevronLeft,
  ChevronRight,
  ShoppingCart,
  Minus,
  Plus,
  Trash2,
  X,
  Package,
  Loader2,
  ArrowRight,
} from "lucide-react";
import useCategories from "@/hooks/useCategories";
import CategorySkeleton from "@/components/ui/CategorySkeleton";
import { usePublicBanners } from "@/hooks/useCityMartBanners";
import {
  useStores,
  useProducts,
  useCart,
  useAddToCart,
  useUpdateCartItem,
  useRemoveCartItem,
  formatPrice,
  formatKobo,
  type MarketplaceItem,
  useEstates,
} from "@/hooks/useCityMart";
import { useToast } from "@/hooks/use-toast";

import imgFrame1261153572 from "@/assets/illustrations/630a3214d20e175564b7a3c374bb6db96b4406f8.png";
import imgImage5 from "@/assets/illustrations/d59fbc735d007a7cd4f9a1f5213a75e964a3267f.png";
import imgFrame1261153583 from "@/assets/illustrations/e8ff5d9eeecdd876bb66bad7e2c0a06d80d02639.png";

export default function CityMart() {
  const [, navigate] = useLocation();
  const { toast } = useToast();

  // ── State ──
  const [activeTab, setActiveTab] = useState("all-markets");
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);
  const [hotSalesPage, setHotSalesPage] = useState(1);
  const [storePage, setStorePage] = useState(1);
  const [selectedLocation, setSelectedLocation] = useState("global");
  const [showStickyNav, setShowStickyNav] = useState(false);
  const [showCartDrawer, setShowCartDrawer] = useState(false);

  const categoryScrollRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // ── Data fetching ──
  const { categories: fetchedCategories = [], isLoading: catsLoading } = useCategories({ scope: "global", kind: "item" });
  const { data: storesData, isLoading: storesLoading } = useStores();
  const { data: estatesData, isLoading: estatesLoading } = useEstates();
  const { data: bannersData = [], isLoading: bannersLoading } = usePublicBanners();
  
  // Hot sales products (not filtered by store)
  const { data: hotProductsData, isLoading: hotProductsLoading } = useProducts({
    search: debouncedSearch || undefined,
    category: selectedCategory || undefined,
    storeId: undefined, // Explicitly exclude storeId for hot sales
    page: hotSalesPage,
    limit: 12,
  });
  
  // Store-specific products (filtered by selected store)
  const { data: storeProductsData, isLoading: storeProductsLoading } = useProducts({
    search: undefined, // Explicitly exclude search for store products
    category: undefined, // Explicitly exclude category for store products
    storeId: selectedStoreId || undefined,
    page: storePage,
    limit: 20,
  });
  
  const { data: cartData } = useCart();
  const addToCart = useAddToCart();
  const updateCartItem = useUpdateCartItem();
  const removeCartItem = useRemoveCartItem();

  const stores = storesData ?? [];
  const estates = estatesData ?? [];
  const banners = bannersData ?? [];
  const hotProducts = hotProductsData?.products ?? [];
  const storeProducts = storeProductsData?.products ?? [];
  const totalPages = hotProductsData?.totalPages ?? 0;
  const cartItemCount = cartData?.totalItems ?? 0;

  // ── Debounce search ──
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setHotSalesPage(1);
    }, 400);
    return () => clearTimeout(t);
  }, [searchQuery]);

  // ── Scroll detection for sticky nav ──
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const handler = () => setShowStickyNav(el.scrollTop > 180);
    el.addEventListener("scroll", handler);
    return () => el.removeEventListener("scroll", handler);
  }, []);

  const scrollCategories = (dir: "left" | "right") => {
    categoryScrollRef.current?.scrollTo({
      left: categoryScrollRef.current.scrollLeft + (dir === "right" ? 280 : -280),
      behavior: "smooth",
    });
  };

  const handleAddToCart = useCallback(
    (product: MarketplaceItem) => {
      addToCart.mutate(
        { productId: product.id, qty: 1 },
        {
          onSuccess: () =>
            toast({ title: "Added to cart", description: product.name }),
          onError: (err: any) =>
            toast({ title: "Error", description: err.message, variant: "destructive" }),
        }
      );
    },
    [addToCart, toast]
  );

  // Get quantity of product in cart
  const getCartQuantity = useCallback(
    (productId: string): number => {
      if (!cartData) return 0;
      for (const group of cartData.storeGroups) {
        const item = group.items.find((i) => i.productId === productId);
        if (item) return item.qty;
      }
      return 0;
    },
    [cartData]
  );

  // Get cart item ID for a product
  const getCartItemId = useCallback(
    (productId: string): string | null => {
      if (!cartData) return null;
      for (const group of cartData.storeGroups) {
        const item = group.items.find((i) => i.productId === productId);
        if (item) return item.id;
      }
      return null;
    },
    [cartData]
  );

  const handleIncrement = useCallback(
    (product: MarketplaceItem) => {
      const itemId = getCartItemId(product.id);
      const currentQty = getCartQuantity(product.id);
      if (!itemId) return;
      
      updateCartItem.mutate(
        { id: itemId, qty: currentQty + 1 },
        {
          onError: (err: any) =>
            toast({ title: "Error", description: err.message, variant: "destructive" }),
        }
      );
    },
    [getCartItemId, getCartQuantity, updateCartItem, toast]
  );

  const handleDecrement = useCallback(
    (product: MarketplaceItem) => {
      const itemId = getCartItemId(product.id);
      const currentQty = getCartQuantity(product.id);
      if (!itemId) return;

      if (currentQty <= 1) {
        // Remove item from cart
        removeCartItem.mutate(itemId, {
          onSuccess: () =>
            toast({ title: "Removed from cart", description: product.name }),
          onError: (err: any) =>
            toast({ title: "Error", description: err.message, variant: "destructive" }),
        });
      } else {
        // Decrease quantity
        updateCartItem.mutate(
          { id: itemId, qty: currentQty - 1 },
          {
            onError: (err: any) =>
              toast({ title: "Error", description: err.message, variant: "destructive" }),
          }
        );
      }
    },
    [getCartItemId, getCartQuantity, updateCartItem, removeCartItem, toast]
  );

  const handleCategoryClick = (catName: string) => {
    setSelectedCategory((prev) => (prev === catName ? null : catName));
    setHotSalesPage(1);
  };

  const tabs: { label: string; id: string; isComingSoon?: boolean }[] = [
    { label: "All Markets", id: "all-markets" },
    { label: "Local Markets", id: "local-markets" },
    { label: "Malls", id: "malls" },
    { label: "Neighborhood Shops", id: "neighborhood-shops" },
  ];

  // Fallback categories if API returns none
  const categories =
    Array.isArray(fetchedCategories) && fetchedCategories.length > 0
      ? fetchedCategories
      : [
          { id: "1", name: "Groceries & Fresh Produce", emoji: "🥦" },
          { id: "2", name: "Meat, Fish & Poultry", emoji: "🥩" },
          { id: "3", name: "Bakery & Pastries", emoji: "🍞" },
          { id: "4", name: "Household Essentials", emoji: "🧹" },
          { id: "5", name: "Baby Care & Diapers", emoji: "🍼" },
          { id: "6", name: "Beverages", emoji: "🥤" },
          { id: "7", name: "Electronics", emoji: "📱" },
          { id: "8", name: "Fashion & Clothing", emoji: "👕" },
        ];

  return (
    <ResidentShell currentPage="marketplace">
      <div className="flex flex-col h-full overflow-hidden bg-[#f9fafb]">
        {/* ─── CityMart Navigation ─── */}
        {!showStickyNav && (
        <div className="shrink-0 transition-opacity duration-300">
          <CitymartNavigation
            brandName="CityMart"
            searchPlaceholder="Search for any item"
            location={selectedLocation}
            estates={estates}
            tabs={tabs.map((tab) => ({
              label: tab.label,
              isActive: activeTab === tab.id,
              isComingSoon: tab.isComingSoon,
              onClick: () => setActiveTab(tab.id),
            }))}
            onSearch={setSearchQuery}
            onCartClick={() => setShowCartDrawer(true)}
            onCategoriesClick={() => {}}
            onLocationChange={setSelectedLocation}
            cartCount={cartItemCount}
          />
        </div>
        )}

        {/* ─── Sticky Navigation ─── */}
        {showStickyNav && (
        <div className="sticky top-0 left-0 right-0 z-40">
          <StickyNavigation
            tabs={tabs.map((tab) => ({
              label: tab.label,
              isActive: activeTab === tab.id,
              isComingSoon: tab.isComingSoon,
              onClick: () => setActiveTab(tab.id),
            }))}
            estates={estates}
            location={selectedLocation}
            searchPlaceholder="Search for any item"
            isSticky={showStickyNav}
            onSearch={setSearchQuery}
            onCartClick={() => setShowCartDrawer(true)}
            onCategoriesClick={() => {}}
            onLocationChange={setSelectedLocation}
            cartCount={cartItemCount}
          />
        </div>
        )}

        {/* ─── Main scrollable content ─── */}
        <div
          className="flex-1 overflow-y-auto"
          ref={scrollContainerRef}
        >
          <div className="max-w-[1320px] mx-auto px-4 pt-4">

            {/* ═══════════════ BANNERS ═══════════════ */}
            <div className="mt-0">
              {bannersLoading ? (
                <div className="flex justify-center py-16">
                  <Loader2 className="w-8 h-8 animate-spin text-[#039855]" />
                </div>
              ) : banners.length > 0 ? (
                <div className="flex flex-col lg:flex-row gap-4 lg:gap-6 mb-4">
                {/* Main Hero Banner */}
                {(() => {
                  const heroBanner = banners.find(b => b.type === 'hero') || banners[0];
                  if (!heroBanner) return null;
                  return (
                    <div className="lg:flex-[65] w-full">
                      <FiftyPercentBanner
                        heading={heroBanner.heading || heroBanner.title}
                        description={heroBanner.description}
                        buttonText={heroBanner.buttonText || "Shop now"}
                        buttonVariant="primary"
                        image={heroBanner.imageUrl || imgFrame1261153572}
                        onButtonClick={() => heroBanner.buttonUrl && (window.location.href = heroBanner.buttonUrl)}
                      />
                    </div>
                  );
                })()}
                {/* Side Banner */}
                {(() => {
                  const sideBanner = banners.find(b => b.type === 'horizontal') || banners[1];
                  if (!sideBanner) return null;
                  return (
                    <div className="lg:flex-[35] w-full hidden lg:block">
                      <HorizontalCard
                        title={sideBanner.heading || sideBanner.title}
                        image={sideBanner.imageUrl || imgImage5}
                        buttonText={sideBanner.buttonText || "Shop now"}
                        variant="dark"
                        onButtonClick={() => sideBanner.buttonUrl && (window.location.href = sideBanner.buttonUrl)}
                      />
                    </div>
                  );
                })()}
              </div>
              ) : null}
            </div>

            {/* ═══════════════ CATEGORIES ═══════════════ */}
            <div className="mb-4 mt-8">
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-3">
                  <h2 className="text-[18px] font-semibold text-[#191c1f]">
                    Shop by Item Categories
                  </h2>
                  {/* "View all Categories" removed per request */}
                </div>
                {selectedCategory && (
                  <button
                    className="text-[13px] font-medium text-[#ee5858] hover:underline"
                    onClick={() => {
                      setSelectedCategory(null);
                      setHotSalesPage(1);
                    }}
                  >
                    Clear filter ✕
                  </button>
                )}
              </div>

              <div className="relative">
                {/* Left arrow */}
                <button
                  className="absolute left-[-12px] top-1/2 -translate-y-1/2 z-10 w-9 h-9 bg-white hover:bg-gray-50 rounded-full flex items-center justify-center shadow-md border border-[#e4e7e9]"
                  onClick={() => scrollCategories("left")}
                >
                  <ChevronLeft className="w-4 h-4 text-[#191c1f]" />
                </button>

                <div
                  className="flex gap-3 lg:gap-4 items-start overflow-x-auto scrollbar-hide px-2 py-2"
                  ref={categoryScrollRef}
                >
                  {catsLoading
                    ? Array.from({ length: 8 }).map((_, i) => (
                        <div key={i} className="shrink-0">
                          <CategorySkeleton />
                        </div>
                      ))
                    : categories.map((c: any) => (
                        <CategoryCard
                          key={c.id || c.name}
                          icon={c.emoji || "🛍️"}
                          image={c.image || c.imageUrl}
                          label={c.name}
                          isSelected={selectedCategory === c.name}
                          onClick={() => handleCategoryClick(c.name)}
                        />
                      ))}
                </div>

                {/* Right arrow */}
                <button
                  className="absolute right-[-12px] top-1/2 -translate-y-1/2 z-10 w-9 h-9 bg-[#039855] hover:bg-[#027a45] rounded-full flex items-center justify-center shadow-md"
                  onClick={() => scrollCategories("right")}
                >
                  <ChevronRight className="w-4 h-4 text-white" />
                </button>
              </div>
            </div>

            {/* ═══════════════ HOT ITEMS / PRODUCTS ═══════════════ */}
            <div className="mb-4 mt-8">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-[18px] font-semibold text-[#191c1f]">
                  {selectedCategory
                    ? selectedCategory
                    : debouncedSearch
                    ? `Results for "${debouncedSearch}"`
                    : "Hot items"}
                </h2>
                <button
                  className="hidden sm:inline-flex items-center gap-1 text-[13px] font-medium text-[#039855] hover:underline"
                  onClick={() => {
                    setSelectedCategory(null);
                    setSelectedStoreId(null);
                    setSearchQuery("");
                    setHotSalesPage(1);
                  }}
                >
                  Browse All Products
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {hotProductsLoading ? (
                <div className="flex justify-center py-16">
                  <Loader2 className="w-8 h-8 animate-spin text-[#039855]" />
                </div>
              ) : hotProducts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <Package className="w-16 h-16 text-[#d1d5db] mb-4" />
                  <p className="text-[15px] font-medium text-[#475467]">No products found</p>
                  <p className="text-[13px] text-[#98a2b3] mt-1">
                    {debouncedSearch
                      ? "Try a different search term"
                      : selectedCategory
                      ? "No products in this category yet"
                      : "Products will appear here once stores add them"}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                  {hotProducts.map((product) => (
                    <div key={product.id} className="w-full">
                      <ProductCard
                        image={product.images?.[0] || undefined}
                        title={product.name}
                        price={formatPrice(product.price)}
                        description={product.storeName ? `by ${product.storeName}` : undefined}
                        cartQuantity={getCartQuantity(product.id)}
                        onFavoriteToggle={() => {}}
                        onAddToCart={() => handleAddToCart(product)}
                        onIncrement={() => handleIncrement(product)}
                        onDecrement={() => handleDecrement(product)}
                        onView={() => navigate(`/resident/citymart/product/${product.id}`)}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ═══════════════ STORES SECTION ═══════════════ */}
              {stores.length > 0 && (
              <div className="mb-4 mt-8">
                <div className="flex flex-col lg:flex-row gap-5 lg:gap-6">
                  {/* Side promotional banners (desktop) - only render if banners exist */}
                  {(() => {
                    const longBanner = banners.find(b => b.type === 'aside-long');
                    const smallBanner = banners.find(b => b.type === 'aside-small');
                    if (!longBanner && !smallBanner) return null;
                    
                    return (
                      <div className="hidden lg:flex flex-col gap-4 shrink-0" style={{ width: 240 }}>
                        {longBanner && (
                          <AsideBannerLong
                            category={longBanner.description?.split(' ')[0] || ""}
                            title={longBanner.title}
                            description={longBanner.description}
                            highlightWord={longBanner.description?.split(' ')[0]}
                            buttonText={longBanner.buttonText || "Shop now"}
                            dealExpiry="Deals ends in"
                            daysRemaining="Limited time"
                            onButtonClick={() => longBanner.buttonUrl && (window.location.href = longBanner.buttonUrl)}
                          />
                        )}
                        {smallBanner && (
                          <AsideBannerSmall
                            title={smallBanner.title}
                            description={smallBanner.description}
                            highlightWord={smallBanner.description?.split(' ')[0]}
                            buttonText={smallBanner.buttonText || "Shop now"}
                            countdown={smallBanner.discountValue ? `${smallBanner.discountValue}% off` : "Limited time"}
                            onButtonClick={() => smallBanner.buttonUrl && (window.location.href = smallBanner.buttonUrl)}
                          />
                        )}
                      </div>
                    );
                  })()}

                  {/* Store tabs + product grid */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-[18px] font-semibold text-[#191c1f]">Stores</h2>
                    </div>

                    {/* Store tabs */}
                    <div className="flex gap-1 mb-5 border-b border-[#e4e7e9] overflow-x-auto scrollbar-hide">
                      {stores.slice(0, 6).map((store) => (
                        <button
                          key={store.id}
                          className={`px-3 py-2.5 text-[13px] font-medium whitespace-nowrap border-b-2 transition-colors ${
                            selectedStoreId === store.id
                              ? "text-[#191c1f] border-[#191c1f]"
                              : "text-[#98a2b3] border-transparent hover:text-[#5f6c72]"
                          }`}
                          onClick={() => {
                            setSelectedStoreId(
                              selectedStoreId === store.id ? null : store.id
                            );
                            setStorePage(1);
                          }}
                        >
                          {store.name}
                        </button>
                      ))}
                    </div>

                    {/* Selected store info */}
                    {selectedStoreId && (() => {
                      const s = stores.find((x) => x.id === selectedStoreId);
                      if (!s) return null;
                      return (
                        <div className="flex items-center gap-3 mb-4 p-3 bg-white rounded-lg border border-[#e4e7e9]">
                          {s.logo ? (
                            <img src={s.logo} alt={s.name} className="w-9 h-9 rounded-full object-cover" />
                          ) : (
                            <div className="w-9 h-9 rounded-full bg-[#039855] flex items-center justify-center text-white font-bold text-sm">
                              {s.name.charAt(0)}
                            </div>
                          )}
                          <div>
                            <p className="text-[13px] font-semibold text-[#191c1f]">{s.name}</p>
                            {s.location && <p className="text-[11px] text-[#98a2b3]">{s.location}</p>}
                          </div>
                        </div>
                      );
                    })()}

                    {/* Store products grid (3 columns since side banner takes space) */}
                    {selectedStoreId && storeProductsLoading ? (
                      <div className="flex justify-center py-12">
                        <Loader2 className="w-6 h-6 animate-spin text-[#039855]" />
                      </div>
                    ) : selectedStoreId && storeProducts.length > 0 ? (
                      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                        {storeProducts.map((product) => (
                          <ProductCard
                            key={product.id}
                            image={product.images?.[0] || undefined}
                            title={product.name}
                            price={formatPrice(product.price)}
                            description={product.storeName ? `by ${product.storeName}` : undefined}
                            cartQuantity={getCartQuantity(product.id)}
                            onFavoriteToggle={() => {}}
                            onAddToCart={() => handleAddToCart(product)}
                            onIncrement={() => handleIncrement(product)}
                            onDecrement={() => handleDecrement(product)}
                            onView={() => navigate(`/resident/citymart/product/${product.id}`)}
                          />
                        ))}
                      </div>
                    ) : selectedStoreId ? (
                      <div className="text-center py-10 text-[#98a2b3]">
                        <Package className="w-12 h-12 mx-auto mb-3 opacity-50" />
                        <p className="text-[13px]">No products in this store yet</p>
                      </div>
                    ) : (
                      <div className="text-center py-10 text-[#98a2b3]">
                        <p className="text-[13px]">Select a store above to browse their products</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ═══════════════ PAGINATION ═══════════════ */}
            {totalPages > 1 && (
              <div className="mb-4 flex justify-center">
                <Pagination
                  currentPage={hotSalesPage}
                  totalPages={totalPages}
                  onPageChange={(p) => setHotSalesPage(p)}
                  siblingCount={1}
                  showPrevNext={true}
                />
              </div>
            )}

            {/* ═══════════════ FULL WIDTH BANNER ═══════════════ */}
            {(() => {
              const fullBanner = banners.find(b => b.type === 'full-width');
              if (!fullBanner) return null;
              return (
                <div className="mb-4">
                  <FullWidthBanner
                    heading={fullBanner.heading || fullBanner.title}
                    description={fullBanner.description}
                    price={fullBanner.priceValue?.toString()}
                    buttonText={fullBanner.buttonText || "Shop now"}
                    backgroundImage={fullBanner.backgroundImageUrl || imgFrame1261153583}
                    onButtonClick={() => fullBanner.buttonUrl && (window.location.href = fullBanner.buttonUrl)}
                  />
                </div>
              );
            })()}
          </div>
        </div>

        {/* ─── Floating Cart Button (mobile) ─── */}
        <button
          className="fixed bottom-6 right-6 z-50 bg-[#039855] text-white rounded-full p-4 shadow-lg lg:hidden flex items-center gap-2"
          onClick={() => setShowCartDrawer(true)}
        >
          <ShoppingCart className="w-5 h-5" />
          {cartItemCount > 0 && (
            <span className="bg-white text-[#039855] text-[11px] font-bold rounded-full w-5 h-5 flex items-center justify-center">
              {cartItemCount}
            </span>
          )}
        </button>

        {/* ─── Cart Drawer ─── */}
        {showCartDrawer && (
          <div className="fixed inset-0 z-50 flex justify-end">
            {/* Backdrop */}
            <div
              className="absolute inset-0 bg-black/40"
              onClick={() => setShowCartDrawer(false)}
            />
            {/* Drawer */}
            <div className="relative w-full max-w-md bg-white shadow-xl flex flex-col animate-in slide-in-from-right duration-300">
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-[#e4e7e9]">
                <h2 className="font-semibold text-[16px] text-[#191c1f] flex items-center gap-2">
                  <ShoppingCart className="w-5 h-5" />
                  Cart
                  {cartItemCount > 0 && (
                    <span className="text-[13px] text-[#98a2b3] font-normal">({cartItemCount})</span>
                  )}
                </h2>
                <button
                  onClick={() => setShowCartDrawer(false)}
                  className="p-1 hover:bg-[#f2f4f7] rounded-md transition-colors"
                >
                  <X className="w-5 h-5 text-[#667085]" />
                </button>
              </div>

              {/* Cart content */}
              <div className="flex-1 overflow-y-auto px-5 py-4">
                {!cartData || cartData.storeGroups.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center py-12">
                    <ShoppingCart className="w-16 h-16 text-[#e4e7e9] mb-4" />
                    <p className="text-[#5f6c72] font-medium text-[14px]">Your cart is empty</p>
                    <p className="text-[12px] text-[#98a2b3] mt-1">
                      Add items from the marketplace
                    </p>
                  </div>
                ) : (
                  <div className="space-y-5">
                    {cartData.storeGroups.map((group) => (
                      <div key={group.storeId}>
                        {/* Store label */}
                        <div className="flex items-center gap-2 mb-3">
                          <div className="w-6 h-6 rounded-full bg-[#039855] flex items-center justify-center text-white text-[10px] font-bold">
                            {group.storeName.charAt(0)}
                          </div>
                          <span className="font-medium text-[13px] text-[#191c1f]">
                            {group.storeName}
                          </span>
                        </div>
                        {/* Items */}
                        <div className="space-y-2.5">
                          {group.items.map((item) => (
                            <div key={item.id} className="flex gap-3 bg-[#f9fafb] rounded-lg p-3 border border-[#f2f4f7]">
                              {item.productImages?.[0] ? (
                                <img
                                  src={item.productImages[0]}
                                  alt={item.productName}
                                  className="w-14 h-14 rounded-md object-cover shrink-0"
                                />
                              ) : (
                                <div className="w-14 h-14 rounded-md bg-[#e4e7e9] flex items-center justify-center shrink-0">
                                  <Package className="w-5 h-5 text-[#98a2b3]" />
                                </div>
                              )}
                              <div className="flex-1 min-w-0">
                                <p className="text-[13px] font-medium text-[#191c1f] truncate">{item.productName}</p>
                                <p className="text-[13px] text-[#039855] font-semibold mt-0.5">
                                  {formatKobo(item.unitPrice)}
                                </p>
                                <div className="flex items-center gap-2 mt-2">
                                  <button
                                    className="w-7 h-7 rounded-md border border-[#e4e7e9] flex items-center justify-center hover:bg-white transition-colors"
                                    onClick={() =>
                                      item.qty <= 1
                                        ? removeCartItem.mutate(item.id)
                                        : updateCartItem.mutate({ id: item.id, qty: item.qty - 1 })
                                    }
                                  >
                                    {item.qty <= 1 ? (
                                      <Trash2 className="w-3.5 h-3.5 text-[#ee5858]" />
                                    ) : (
                                      <Minus className="w-3.5 h-3.5 text-[#5f6c72]" />
                                    )}
                                  </button>
                                  <span className="text-[13px] font-medium w-6 text-center text-[#191c1f]">
                                    {item.qty}
                                  </span>
                                  <button
                                    className="w-7 h-7 rounded-md border border-[#e4e7e9] flex items-center justify-center hover:bg-white transition-colors"
                                    onClick={() =>
                                      updateCartItem.mutate({ id: item.id, qty: item.qty + 1 })
                                    }
                                  >
                                    <Plus className="w-3.5 h-3.5 text-[#5f6c72]" />
                                  </button>
                                </div>
                              </div>
                              <button
                                className="shrink-0 self-start p-1 hover:bg-[#fef2f2] rounded-md transition-colors"
                                onClick={() => removeCartItem.mutate(item.id)}
                              >
                                <X className="w-4 h-4 text-[#98a2b3] hover:text-[#ee5858]" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Footer */}
              {cartData && cartData.totalItems > 0 && (
                <div className="border-t border-[#e4e7e9] px-5 py-4 space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="font-medium text-[14px] text-[#5f6c72]">Total</span>
                    <span className="font-bold text-[18px] text-[#039855]">
                      {formatKobo(cartData.totalAmount)}
                    </span>
                  </div>
                  <button
                    className="w-full bg-[#039855] text-white py-3 rounded-lg text-[14px] font-semibold hover:bg-[#027a45] transition-colors"
                    onClick={() => {
                      setShowCartDrawer(false);
                      navigate("/resident/citymart/cart");
                    }}
                  >
                    Proceed to Checkout
                  </button>
                  <button
                    className="w-full text-center text-[13px] text-[#039855] hover:underline py-1"
                    onClick={() => {
                      setShowCartDrawer(false);
                      navigate("/resident/citymart/orders");
                    }}
                  >
                    View My Orders
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </ResidentShell>
  );
}
