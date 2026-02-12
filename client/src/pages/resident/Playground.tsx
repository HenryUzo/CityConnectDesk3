import Nav from "./Nav";
import BaseIconsComponent from "@/components/ui/BaseIcons";
import CardCartButton from "@/components/ui/CardCartButton";
import Countdown, { CountdownWithText } from "@/components/ui/Countdown";
import { Badge, DiscountBadge, DistressBadge, HotBadge, RatingBadge, RoundPriceBadge } from "@/components/ui/badge";
import ProductCard, { 
  DefaultProductCard, 
  SimpleProductCard, 
  HotDealProductCard, 
  BigProductCard 
} from "@/components/ui/cards";
import { CategoryCard } from "@/components/ui/cards";
import { 
  HorizontalCard,
  TechDealHorizontalCard,
  FashionDealHorizontalCard,
  ElectronicsDealHorizontalCard,
  LimitedOfferHorizontalCard,
  PremiumHorizontalCard,
  LightHorizontalCard,
  HorizontalCardLarge
} from "@/components/ui/cards";
import { 
  FiftyPercentBanner, 
  FullWidthBanner,
  ElectronicsBanner,
  FashionBanner,
  HomeGardenBanner,
  SportsFitnessBanner,
  BeautyBanner,
  BooksMediaBanner,
  SpringSaleBanner,
  SummerSaleBanner,
  FallSaleBanner,
  WinterSaleBanner,
  BlackFridayBanner,
  CyberMondayBanner,
  HolidayBanner,
  ValentinesBanner,
  BackToSchoolBanner,
  NewYearBanner,
  AsideBannerSmall,
  AsideBannerMedium,
  AsideBannerLong
} from "@/components/ui/banners";
import { TabGroup, TabItem } from "@/components/ui/tab";
import { 
  InputField, 
  EmailInputField, 
  PhoneInputField, 
  PasswordInputField,
  SearchInputField,
  CurrencyInputField,
  URLInputField,
  CardNumberInputField,
  TextareaField,
  VerificationCodeInputField
} from "@/components/ui/inputfields";
import { DropdownInputField, UserIcon, StatusDot } from "@/components/ui/dropdown";
import { CitymartNavigation, StickyNavigation } from "@/components/ui/navigation";
import ProductDetailModal, { ProductDetailData } from "@/components/ui/modals";
import Pagination, { SimplePagination, CompactPagination } from "@/components/ui/pagination";
import { 
  Button,
  PrimaryButton,
  SecondaryButton,
  OutlineButton,
  GhostButton,
  TextButton,
  DestructiveButton,
  SuccessButton,
  WarningButton,
  IconButton,
  GoogleSignInButton,
  FacebookSignInButton,
  TwitterSignInButton,
  InstagramSignInButton,
  LinkedInSignInButton,
  GitHubSignInButton,
  AppleSignInButton,
  SubmitButton,
  CancelButton,
  DeleteButton,
  DownloadButton,
  UploadButton,
  SaveButton,
  NextButton,
  PreviousButton,
  AddButton,
  SearchButton,
  ToolIcon,
  BasketIcon,
  ArrowRightIcon,
  ArrowLeftIcon,
  PlusIcon,
  CheckIcon,
  DownloadIcon,
  UploadIcon,
  HeartIcon,
  SearchIcon as SearchIconComponent,
  SettingsIcon,
  TrashIcon,
  LoaderIcon,
  AlertCircleIcon,
  XCircleIcon,
  MailIcon,
  LogInIcon,
  LogOutIcon
} from "@/components/ui/buttons";
import React, { useState, useEffect, useRef } from "react";
import fishImage from "@/assets/illustrations/dbfd1eb1f4deee5c7bffcee9e49b449b6b495b86.png";

export default function Playground({
  onNavigateToHomepage,
  onNavigateToSettings,
  onNavigateToChat,
  onNavigateToOrdinaryFlow,
  currentPage,
}: {
  onNavigateToHomepage?: () => void;
  onNavigateToSettings?: () => void;
  onNavigateToChat?: () => void;
  onNavigateToOrdinaryFlow?: () => void;
  currentPage: "homepage" | "chat" | "settings" | "playground";
}) {
  const [isFavorited, setIsFavorited] = useState(false);
  const [isAddingToCart, setIsAddingToCart] = useState(false);
  const [inCart, setInCart] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [notifications, setNotifications] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<ProductDetailData | undefined>(undefined);
  const [paginationPage1, setPaginationPage1] = useState(1);
  const [paginationPage2, setPaginationPage2] = useState(1);
  const [paginationPage3, setPaginationPage3] = useState(1);
  const [showStickyNav, setShowStickyNav] = useState(false);
  const navRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Scroll detection for sticky navigation
  useEffect(() => {
    const handleScroll = () => {
      if (navRef.current && scrollContainerRef.current) {
        const navBottom = navRef.current.getBoundingClientRect().bottom;
        const containerTop = scrollContainerRef.current.getBoundingClientRect().top;
        // Show sticky nav when original nav scrolls out of view
        setShowStickyNav(navBottom < containerTop);
      }
    };

    const scrollContainer = scrollContainerRef.current;
    if (scrollContainer) {
      scrollContainer.addEventListener('scroll', handleScroll);
      return () => scrollContainer.removeEventListener('scroll', handleScroll);
    }
  }, []);

  const handleFavoriteToggle = () => {
    setIsFavorited(!isFavorited);
    addNotification(isFavorited ? "Removed from favorites ❤" : "Added to favorites ❤️");
  };

  const handleAddToCart = () => {
    // This button adds 1 item to cart AND switches to cart controls
    setIsAddingToCart(true);
    setTimeout(() => {
      setIsAddingToCart(false);
      setInCart(true);
      setQuantity(1);
      addNotification("Added 1 item to cart! 🛒");
    }, 800);
  };

  const handleIncrement = () => {
    // Plus button increases quantity of the item in cart
    setQuantity(quantity + 1);
    addNotification(`Quantity increased to ${quantity + 1} 🛒`);
  };

  const handleDecrement = () => {
    // Minus button decreases quantity
    // If quantity reaches 0, remove from cart and switch back to initial state
    if (quantity > 1) {
      setQuantity(quantity - 1);
      addNotification(`Quantity decreased to ${quantity - 1}`);
    } else {
      // Remove from cart
      setQuantity(0);
      setInCart(false);
      addNotification("Item removed from cart");
    }
  };

  const handleQuickView = () => {
    addNotification("Quick view opened 👁️");
  };

  const addNotification = (message: string) => {
    setNotifications([message, ...notifications]);
    setTimeout(() => {
      setNotifications((prev) => prev.slice(0, -1));
    }, 3000);
  };

  return (
    <div
      className="bg-[#054f31] content-stretch flex items-start relative size-full min-h-screen"
      data-name="Playground"
    >
      <Nav
        onBookServiceClick={onNavigateToChat}
        onNavigateToHomepage={onNavigateToHomepage}
        onNavigateToSettings={onNavigateToSettings}
        onNavigateToMarketplace={() => console.log("Navigate to marketplace - will be connected in App.tsx")}
        onNavigateToOrdinaryFlow={onNavigateToOrdinaryFlow}
        currentPage={currentPage}
      />
      
      {/* Main Content Area */}
      <div className="basis-0 content-stretch flex flex-col grow items-start h-screen min-w-px pb-0 pt-[12px] px-0 relative shrink-0">
        <div ref={scrollContainerRef} className="bg-white content-stretch flex flex-col gap-0 items-start pb-[33px] pt-0 px-0 relative rounded-bl-[40px] rounded-tl-[40px] shrink-0 w-full h-full overflow-y-auto overflow-x-hidden">
          {/* Notifications */}
          {notifications.length > 0 && (
            <div className="fixed top-4 right-4 z-50 flex flex-col gap-2">
              {notifications.map((notification, index) => (
                <div
                  key={index}
                  className="bg-[#054f31] text-white px-4 py-3 rounded-lg shadow-lg animate-[slideIn_0.3s_ease-out]"
                >
                  {notification}
                </div>
              ))}
            </div>
          )}

          {/* CityMart Navigation */}
          <div ref={navRef}>
            <CitymartNavigation
              brandName="CityMart"
              searchPlaceholder="Search for any item"
              location="Lagos, Nigeria"
              tabs={[
                { label: "All Components", isActive: activeTab === "all", onClick: () => setActiveTab("all") },
                { label: "Buttons & Actions", isActive: activeTab === "buttons", onClick: () => setActiveTab("buttons") },
                { label: "Input Fields", isActive: activeTab === "forms", onClick: () => setActiveTab("forms") },
                { label: "Badges & Timers", isActive: activeTab === "badges", onClick: () => setActiveTab("badges") },
                { label: "Cards", isActive: activeTab === "cards", onClick: () => setActiveTab("cards") },
                { label: "Banners", isActive: activeTab === "banners", onClick: () => setActiveTab("banners") },
                { label: "Icons (COMING SOON)", isActive: activeTab === "icons", isComingSoon: true, onClick: () => setActiveTab("icons") },
              ]}
              onSearch={(query: string) => {
                setSearchQuery(query);
                addNotification(`Searching for: "${query}" 🔍`);
              }}
              onCartClick={() => addNotification("Cart clicked! 🛒")}
              onCategoriesClick={() => addNotification("Categories opened! 📂")}
              onLocationChange={(loc) => addNotification(`Location changed to: ${loc} 📍`)}
            />
          </div>

          {/* Sticky Navigation - Shows when scrolling */}
          <div 
            className={`sticky w-full top-0 left-0 right-0 z-40 transition-transform duration-300 ${
              showStickyNav ? 'translate-y-0' : '-translate-y-full'
            }`}
          >
            <StickyNavigation
              className="w-full p-[0px]"
              isSticky={showStickyNav}
              tabs={[
                { label: "All Components", isActive: activeTab === "all", onClick: () => setActiveTab("all") },
                { label: "Buttons & Actions", isActive: activeTab === "buttons", onClick: () => setActiveTab("buttons") },
                { label: "Input Fields", isActive: activeTab === "forms", onClick: () => setActiveTab("forms") },
                { label: "Badges & Timers", isActive: activeTab === "badges", onClick: () => setActiveTab("badges") },
                { label: "Cards", isActive: activeTab === "cards", onClick: () => setActiveTab("cards") },
                { label: "Banners", isActive: activeTab === "banners", onClick: () => setActiveTab("banners") },
                { label: "Icons (COMING SOON)", isActive: activeTab === "icons", isComingSoon: true, onClick: () => setActiveTab("icons") },
              ]}
              location="Lagos, Nigeria"
              searchPlaceholder="Search for any item"
              onSearch={(query: string) => {
                setSearchQuery(query);
                addNotification(`Searching for: "${query}" 🔍`);
              }}
              onCartClick={() => addNotification("Cart clicked! 🛒")}
              onCategoriesClick={() => addNotification("Categories opened! 📂")}
              onLocationChange={(loc) => addNotification(`Location changed to: ${loc} 📍`)}
            />
          </div>

          {/* Content Container */}
          <div className="content-stretch flex flex-col gap-[24px] items-start px-[32px] pt-[24px] w-full">{/* ... existing code ... */}

          {/* Tab Component Demo */}
          {(activeTab === "all" || activeTab === "buttons") && (
          <div className="w-full border border-gray-200 rounded-xl p-8 bg-gray-50">
            <h2 className="font-['General_Sans:Semibold',sans-serif] text-[#054f31] text-[20px] leading-[28px] mb-6">
              Tab Components
            </h2>
            <p className="font-['General_Sans:Regular',sans-serif] text-[#667085] text-[16px] leading-[24px] mb-8">
              Interactive navigation tabs with active state, disabled state, and coming soon badges
            </p>
            
            <div className="space-y-8">
              {/* CityMart Markets Example */}
              <div className="bg-white p-6 rounded-lg border border-gray-200">
                <h3 className="font-['General_Sans:Semibold',sans-serif] text-[16px] text-[#1D2939] mb-4">
                  CityMart Markets Navigation
                </h3>
                <p className="text-[14px] text-[#667085] mb-4">
                  Pre-configured tab group for marketplace categories
                </p>
                <TabGroup
                  tabs={[
                    { id: "all", label: "All Markets" },
                    { id: "local", label: "Local Markets" },
                    { id: "malls", label: "Malls" },
                    { id: "neighborhood", label: "Neighborhood Shops" },
                    { id: "distress", label: "Distress Sale" },
                    { id: "properties", label: "Properties", disabled: true, comingSoon: true },
                  ]}
                  defaultActiveTab="all"
                  onTabChange={(tabId: string) => addNotification(`Tab switched to: ${tabId} 📑`)}
                />
              </div>

              {/* Custom Tab Example */}
              <div className="bg-white p-6 rounded-lg border border-gray-200">
                <h3 className="font-['General_Sans:Semibold',sans-serif] text-[16px] text-[#1D2939] mb-4">
                  Custom Tab Group
                </h3>
                <p className="text-[14px] text-[#667085] mb-4">
                  Create your own tabs with custom labels and states
                </p>
                <TabGroup
                  tabs={[
                    { id: "electronics", label: "Electronics" },
                    { id: "fashion", label: "Fashion" },
                    { id: "home", label: "Home & Garden" },
                    { id: "sports", label: "Sports" },
                    { id: "beauty", label: "Beauty", disabled: true, comingSoon: true },
                  ]}
                  defaultActiveTab="electronics"
                  onTabChange={(tabId: string) => addNotification(`Category: ${tabId} 🏷️`)}
                />
              </div>

              {/* Features List */}
              <div className="bg-blue-50 p-6 rounded-lg border border-blue-200">
                <h3 className="font-['General_Sans:Semibold',sans-serif] text-[16px] text-[#1D2939] mb-3">
                  💡 Tab Component Features
                </h3>
                <ul className="text-[14px] text-[#667085] space-y-2 list-disc list-inside">
                  <li><strong>Active State:</strong> Bold text with orange bottom border (#f79009)</li>
                  <li><strong>Inactive State:</strong> Gray text with hover effects</li>
                  <li><strong>Disabled State:</strong> Light gray text, no interaction</li>
                  <li><strong>Coming Soon Badge:</strong> Shows upcoming features</li>
                  <li><strong>Controlled/Uncontrolled:</strong> Flexible state management</li>
                  <li><strong>TabGroup Component:</strong> Manages multiple tabs automatically</li>
                  <li>Click tabs above to see them in action!</li>
                </ul>
              </div>
            </div>
          </div>
          )}

          {/* Button Components Showcase */}
          {(activeTab === "all" || activeTab === "buttons") && (
          <div className="w-full border border-gray-200 rounded-xl p-8 bg-gray-50">
            <h2 className="font-['General_Sans:Semibold',sans-serif] text-[#054f31] text-[20px] leading-[28px] mb-6">
              Button Components
            </h2>
            <p className="font-['General_Sans:Regular',sans-serif] text-[#667085] text-[16px] leading-[24px] mb-8">
              Comprehensive button system with multiple variants, sizes, states, icons, and social login options
            </p>
            
            <div className="space-y-12">
              {/* Button Variants */}
              <div className="bg-white p-6 rounded-lg border border-gray-200">
                <h3 className="font-['General_Sans:Semibold',sans-serif] text-[18px] text-[#1D2939] mb-6">
                  Button Variants
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <p className="text-[12px] text-[#667085] mb-2">Primary</p>
                    <PrimaryButton onClick={() => addNotification("Primary button clicked! 🟢")}>
                      Primary Button
                    </PrimaryButton>
                  </div>
                  
                  <div className="space-y-2">
                    <p className="text-[12px] text-[#667085] mb-2">Secondary</p>
                    <SecondaryButton onClick={() => addNotification("Secondary button clicked! ⚪")}>
                      Secondary Button
                    </SecondaryButton>
                  </div>
                  
                  <div className="space-y-2">
                    <p className="text-[12px] text-[#667085] mb-2">Outline</p>
                    <OutlineButton onClick={() => addNotification("Outline button clicked! 🔲")}>
                      Outline Button
                    </OutlineButton>
                  </div>
                  
                  <div className="space-y-2">
                    <p className="text-[12px] text-[#667085] mb-2">Ghost</p>
                    <GhostButton onClick={() => addNotification("Ghost button clicked! 👻")}>
                      Ghost Button
                    </GhostButton>
                  </div>
                  
                  <div className="space-y-2">
                    <p className="text-[12px] text-[#667085] mb-2">Text</p>
                    <TextButton onClick={() => addNotification("Text button clicked! 📝")}>
                      Text Button
                    </TextButton>
                  </div>
                  
                  <div className="space-y-2">
                    <p className="text-[12px] text-[#667085] mb-2">Destructive</p>
                    <DestructiveButton onClick={() => addNotification("Destructive button clicked! 🔴")}>
                      Destructive
                    </DestructiveButton>
                  </div>
                  
                  <div className="space-y-2">
                    <p className="text-[12px] text-[#667085] mb-2">Success</p>
                    <SuccessButton onClick={() => addNotification("Success button clicked! ✅")}>
                      Success
                    </SuccessButton>
                  </div>
                  
                  <div className="space-y-2">
                    <p className="text-[12px] text-[#667085] mb-2">Warning</p>
                    <WarningButton onClick={() => addNotification("Warning button clicked! ⚠️")}>
                      Warning
                    </WarningButton>
                  </div>
                </div>
              </div>

              {/* Button Sizes */}
              <div className="bg-white p-6 rounded-lg border border-gray-200">
                <h3 className="font-['General_Sans:Semibold',sans-serif] text-[18px] text-[#1D2939] mb-6">
                  Button Sizes
                </h3>
                <div className="flex flex-wrap items-end gap-4">
                  <div className="space-y-2">
                    <p className="text-[12px] text-[#667085]">Small</p>
                    <PrimaryButton size="sm" onClick={() => addNotification("Small button! 🔹")}>
                      Small
                    </PrimaryButton>
                  </div>
                  
                  <div className="space-y-2">
                    <p className="text-[12px] text-[#667085]">Medium (Default)</p>
                    <PrimaryButton size="md" onClick={() => addNotification("Medium button! 🔸")}>
                      Medium
                    </PrimaryButton>
                  </div>
                  
                  <div className="space-y-2">
                    <p className="text-[12px] text-[#667085]">Large</p>
                    <PrimaryButton size="lg" onClick={() => addNotification("Large button! 🔶")}>
                      Large
                    </PrimaryButton>
                  </div>
                  
                  <div className="space-y-2">
                    <p className="text-[12px] text-[#667085]">Extra Large</p>
                    <PrimaryButton size="xl" onClick={() => addNotification("Extra large button! 🟧")}>
                      Extra Large
                    </PrimaryButton>
                  </div>
                </div>
              </div>

              {/* Button States */}
              <div className="bg-white p-6 rounded-lg border border-gray-200">
                <h3 className="font-['General_Sans:Semibold',sans-serif] text-[18px] text-[#1D2939] mb-6">
                  Button States
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <p className="text-[12px] text-[#667085] mb-2">Default</p>
                    <PrimaryButton onClick={() => addNotification("Default state! 🔘")}>
                      Default
                    </PrimaryButton>
                  </div>
                  
                  <div className="space-y-2">
                    <p className="text-[12px] text-[#667085] mb-2">Loading</p>
                    <PrimaryButton isLoading onClick={() => addNotification("Loading...")}>
                      Loading
                    </PrimaryButton>
                  </div>
                  
                  <div className="space-y-2">
                    <p className="text-[12px] text-[#667085] mb-2">Disabled</p>
                    <PrimaryButton disabled onClick={() => addNotification("Won't click!")}>
                      Disabled
                    </PrimaryButton>
                  </div>
                  
                  <div className="space-y-2">
                    <p className="text-[12px] text-[#667085] mb-2">Error State</p>
                    <PrimaryButton hasError onClick={() => addNotification("Error button! ❌")}>
                      Error
                    </PrimaryButton>
                  </div>
                </div>
              </div>

              {/* Buttons with Icons */}
              <div className="bg-white p-6 rounded-lg border border-gray-200">
                <h3 className="font-['General_Sans:Semibold',sans-serif] text-[18px] text-[#1D2939] mb-6">
                  Buttons with Icons
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <p className="text-[12px] text-[#667085] mb-2">Leading Icon</p>
                    <PrimaryButton 
                      icon={<ToolIcon size={20} />} 
                      iconPosition="leading"
                      onClick={() => addNotification("Book repairs! 🔧")}
                    >
                      Book Repairs
                    </PrimaryButton>
                  </div>
                  
                  <div className="space-y-2">
                    <p className="text-[12px] text-[#667085] mb-2">Trailing Icon</p>
                    <PrimaryButton 
                      icon={<ArrowRightIcon size={20} />} 
                      iconPosition="trailing"
                      onClick={() => addNotification("Continue! ➡️")}
                    >
                      Continue
                    </PrimaryButton>
                  </div>
                  
                  <div className="space-y-2">
                    <p className="text-[12px] text-[#667085] mb-2">Icon Only</p>
                    <IconButton 
                      icon={<SettingsIcon size={20} />}
                      variant="primary"
                      onClick={() => addNotification("Settings! ⚙️")}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <p className="text-[12px] text-[#667085] mb-2">Secondary with Icon</p>
                    <SecondaryButton 
                      icon={<BasketIcon color="#027a48" size={20} />} 
                      iconPosition="leading"
                      onClick={() => addNotification("Buy something! 🛒")}
                    >
                      Buy something
                    </SecondaryButton>
                  </div>
                  
                  <div className="space-y-2">
                    <p className="text-[12px] text-[#667085] mb-2">Heart Icon</p>
                    <OutlineButton 
                      icon={<HeartIcon color="#DC2626" size={20} />} 
                      iconPosition="leading"
                      onClick={() => addNotification("Added to favorites! ❤️")}
                    >
                      Favorite
                    </OutlineButton>
                  </div>
                  
                  <div className="space-y-2">
                    <p className="text-[12px] text-[#667085] mb-2">Mail Icon</p>
                    <OutlineButton 
                      icon={<MailIcon color="#344054" size={20} />} 
                      iconPosition="leading"
                      onClick={() => addNotification("Send email! ✉️")}
                    >
                      Email
                    </OutlineButton>
                  </div>
                </div>
              </div>

              {/* Pre-configured Action Buttons */}
              <div className="bg-white p-6 rounded-lg border border-gray-200">
                <h3 className="font-['General_Sans:Semibold',sans-serif] text-[18px] text-[#1D2939] mb-6">
                  Pre-configured Action Buttons
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <SubmitButton onClick={() => addNotification("Form submitted! ✅")} />
                  <CancelButton onClick={() => addNotification("Action cancelled! ❌")} />
                  <SaveButton onClick={() => addNotification("Saved! 💾")} />
                  <DeleteButton onClick={() => addNotification("Deleted! 🗑️")} />
                  <DownloadButton onClick={() => addNotification("Downloading... 📥")} />
                  <UploadButton onClick={() => addNotification("Uploading... 📤")} />
                  <NextButton onClick={() => addNotification("Next! ➡️")} />
                  <PreviousButton onClick={() => addNotification("Previous! ⬅️")} />
                  <AddButton onClick={() => addNotification("Item added! ➕")} />
                  <SearchButton onClick={() => addNotification("Searching... 🔍")} />
                  
                  <OutlineButton 
                    icon={<LogInIcon color="#344054" size={20} />} 
                    iconPosition="leading"
                    onClick={() => addNotification("Login! 🔑")}
                  >
                    Log In
                  </OutlineButton>
                  
                  <OutlineButton 
                    icon={<LogOutIcon color="#344054" size={20} />} 
                    iconPosition="leading"
                    onClick={() => addNotification("Logout! 👋")}
                  >
                    Log Out
                  </OutlineButton>
                </div>
              </div>

              {/* Social Login Buttons */}
              <div className="bg-white p-6 rounded-lg border border-gray-200">
                <h3 className="font-['General_Sans:Semibold',sans-serif] text-[18px] text-[#1D2939] mb-6">
                  Social Login Buttons
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <GoogleSignInButton onClick={() => addNotification("Sign in with Google! 🔵")} />
                  <FacebookSignInButton onClick={() => addNotification("Sign in with Facebook! 📘")} />
                  <TwitterSignInButton onClick={() => addNotification("Sign in with Twitter! 🐦")} />
                  <InstagramSignInButton onClick={() => addNotification("Sign in with Instagram! 📷")} />
                  <LinkedInSignInButton onClick={() => addNotification("Sign in with LinkedIn! 💼")} />
                  <GitHubSignInButton onClick={() => addNotification("Sign in with GitHub! 🐙")} />
                  <AppleSignInButton onClick={() => addNotification("Sign in with Apple! 🍎")} />
                </div>
              </div>

              {/* Full Width Buttons */}
              <div className="bg-white p-6 rounded-lg border border-gray-200">
                <h3 className="font-['General_Sans:Semibold',sans-serif] text-[18px] text-[#1D2939] mb-6">
                  Full Width Buttons
                </h3>
                <div className="space-y-4 max-w-md">
                  <PrimaryButton fullWidth onClick={() => addNotification("Full width primary! 📏")}>
                    Full Width Primary Button
                  </PrimaryButton>
                  
                  <SecondaryButton fullWidth onClick={() => addNotification("Full width secondary! 📏")}>
                    Full Width Secondary Button
                  </SecondaryButton>
                  
                  <GoogleSignInButton fullWidth onClick={() => addNotification("Full width Google! 📏")} />
                </div>
              </div>

              {/* Icon Gallery */}
              <div className="bg-white p-6 rounded-lg border border-gray-200">
                <h3 className="font-['General_Sans:Semibold',sans-serif] text-[18px] text-[#1D2939] mb-6">
                  Available Icons (Samples)
                </h3>
                <p className="text-[14px] text-[#667085] mb-6">
                  All icons can be customized with size and color props
                </p>
                <div className="grid grid-cols-4 md:grid-cols-8 lg:grid-cols-12 gap-4">
                  <div className="flex flex-col items-center gap-2">
                    <div className="p-3 bg-gray-100 rounded-lg">
                      <ToolIcon color="#054f31" size={24} />
                    </div>
                    <p className="text-[10px] text-center text-[#667085]">Tool</p>
                  </div>
                  
                  <div className="flex flex-col items-center gap-2">
                    <div className="p-3 bg-gray-100 rounded-lg">
                      <BasketIcon color="#054f31" size={24} />
                    </div>
                    <p className="text-[10px] text-center text-[#667085]">Basket</p>
                  </div>
                  
                  <div className="flex flex-col items-center gap-2">
                    <div className="p-3 bg-gray-100 rounded-lg">
                      <ArrowRightIcon color="#054f31" size={24} />
                    </div>
                    <p className="text-[10px] text-center text-[#667085]">Arrow Right</p>
                  </div>
                  
                  <div className="flex flex-col items-center gap-2">
                    <div className="p-3 bg-gray-100 rounded-lg">
                      <ArrowLeftIcon color="#054f31" size={24} />
                    </div>
                    <p className="text-[10px] text-center text-[#667085]">Arrow Left</p>
                  </div>
                  
                  <div className="flex flex-col items-center gap-2">
                    <div className="p-3 bg-gray-100 rounded-lg">
                      <PlusIcon color="#054f31" size={24} />
                    </div>
                    <p className="text-[10px] text-center text-[#667085]">Plus</p>
                  </div>
                  
                  <div className="flex flex-col items-center gap-2">
                    <div className="p-3 bg-gray-100 rounded-lg">
                      <CheckIcon color="#054f31" size={24} />
                    </div>
                    <p className="text-[10px] text-center text-[#667085]">Check</p>
                  </div>
                  
                  <div className="flex flex-col items-center gap-2">
                    <div className="p-3 bg-gray-100 rounded-lg">
                      <DownloadIcon color="#054f31" size={24} />
                    </div>
                    <p className="text-[10px] text-center text-[#667085]">Download</p>
                  </div>
                  
                  <div className="flex flex-col items-center gap-2">
                    <div className="p-3 bg-gray-100 rounded-lg">
                      <UploadIcon color="#054f31" size={24} />
                    </div>
                    <p className="text-[10px] text-center text-[#667085]">Upload</p>
                  </div>
                  
                  <div className="flex flex-col items-center gap-2">
                    <div className="p-3 bg-gray-100 rounded-lg">
                      <HeartIcon color="#DC2626" size={24} />
                    </div>
                    <p className="text-[10px] text-center text-[#667085]">Heart</p>
                  </div>
                  
                  <div className="flex flex-col items-center gap-2">
                    <div className="p-3 bg-gray-100 rounded-lg">
                      <SearchIconComponent color="#054f31" size={24} />
                    </div>
                    <p className="text-[10px] text-center text-[#667085]">Search</p>
                  </div>
                  
                  <div className="flex flex-col items-center gap-2">
                    <div className="p-3 bg-gray-100 rounded-lg">
                      <SettingsIcon color="#054f31" size={24} />
                    </div>
                    <p className="text-[10px] text-center text-[#667085]">Settings</p>
                  </div>
                  
                  <div className="flex flex-col items-center gap-2">
                    <div className="p-3 bg-gray-100 rounded-lg">
                      <TrashIcon color="#DC2626" size={24} />
                    </div>
                    <p className="text-[10px] text-center text-[#667085]">Trash</p>
                  </div>
                  
                  <div className="flex flex-col items-center gap-2">
                    <div className="p-3 bg-gray-100 rounded-lg">
                      <LoaderIcon color="#054f31" size={24} />
                    </div>
                    <p className="text-[10px] text-center text-[#667085]">Loader</p>
                  </div>
                  
                  <div className="flex flex-col items-center gap-2">
                    <div className="p-3 bg-gray-100 rounded-lg">
                      <AlertCircleIcon color="#DC2626" size={24} />
                    </div>
                    <p className="text-[10px] text-center text-[#667085]">Alert</p>
                  </div>
                  
                  <div className="flex flex-col items-center gap-2">
                    <div className="p-3 bg-gray-100 rounded-lg">
                      <XCircleIcon color="#DC2626" size={24} />
                    </div>
                    <p className="text-[10px] text-center text-[#667085]">X Circle</p>
                  </div>
                  
                  <div className="flex flex-col items-center gap-2">
                    <div className="p-3 bg-gray-100 rounded-lg">
                      <MailIcon color="#054f31" size={24} />
                    </div>
                    <p className="text-[10px] text-center text-[#667085]">Mail</p>
                  </div>
                  
                  <div className="flex flex-col items-center gap-2">
                    <div className="p-3 bg-gray-100 rounded-lg">
                      <LogInIcon color="#054f31" size={24} />
                    </div>
                    <p className="text-[10px] text-center text-[#667085]">Log In</p>
                  </div>
                  
                  <div className="flex flex-col items-center gap-2">
                    <div className="p-3 bg-gray-100 rounded-lg">
                      <LogOutIcon color="#054f31" size={24} />
                    </div>
                    <p className="text-[10px] text-center text-[#667085]">Log Out</p>
                  </div>
                </div>
              </div>

              {/* Features List */}
              <div className="bg-blue-50 p-6 rounded-lg border border-blue-200">
                <h3 className="font-['General_Sans:Semibold',sans-serif] text-[16px] text-[#1D2939] mb-3">
                  💡 Button Component Features
                </h3>
                <ul className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[14px] text-[#667085] list-disc list-inside">
                  <li><strong>8 Variants:</strong> Primary, Secondary, Outline, Ghost, Text, Destructive, Success, Warning</li>
                  <li><strong>4 Sizes:</strong> Small, Medium, Large, Extra Large</li>
                  <li><strong>Multiple States:</strong> Default, Hover, Active, Loading, Disabled, Error</li>
                  <li><strong>Icon Positions:</strong> Leading, Trailing, Icon-only, No icon</li>
                  <li><strong>Social Logins:</strong> Google, Facebook, Twitter, Instagram, LinkedIn, GitHub, Apple</li>
                  <li><strong>Pre-configured:</strong> Submit, Cancel, Save, Delete, Download, Upload, etc.</li>
                  <li><strong>18+ Icons:</strong> Customizable size and color</li>
                  <li><strong>Full Width:</strong> Responsive button widths</li>
                  <li><strong>Accessibility:</strong> Keyboard navigation, focus states, ARIA labels</li>
                  <li><strong>TypeScript:</strong> Fully typed with interfaces</li>
                  <li><strong>Animations:</strong> Smooth transitions and loading spinners</li>
                  <li><strong>Customizable:</strong> All props can be overridden</li>
                </ul>
              </div>
            </div>
          </div>
          )}

          {/* Input Field Components Demo */}
          {(activeTab === "all" || activeTab === "forms") && (
          <div className="w-full border border-gray-200 rounded-xl p-8 bg-gray-50">
            <h2 className="font-['General_Sans:Semibold',sans-serif] text-[#054f31] text-[20px] leading-[28px] mb-6">
              Input Field Components
            </h2>
            <p className="font-['General_Sans:Regular',sans-serif] text-[#667085] text-[16px] leading-[24px] mb-8">
              Flexible form input components with labels, icons, validation states, and prefixes
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Basic Text Input */}
              <div className="bg-white p-6 rounded-lg border border-gray-200">
                <h3 className="font-['General_Sans:Semibold',sans-serif] text-[16px] text-[#1D2939] mb-4">
                  Basic Text Input
                </h3>
                <InputField
                  label="Email"
                  type="email"
                  placeholder="olivia@untitledui.com"
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => console.log("Email:", e.target.value)}
                />
              </div>

              {/* Email Input with Icon */}
              <div className="bg-white p-6 rounded-lg border border-gray-200">
                <h3 className="font-['General_Sans:Semibold',sans-serif] text-[16px] text-[#1D2939] mb-4">
                  Email Input with Icon
                </h3>
                <EmailInputField
                  label="Email"
                  placeholder="olivia@untitledui.com"
                  showIcon={true}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => addNotification(`Email updated: ${e.target.value} ✉️`)}
                />
              </div>

              {/* Phone Input with Country Code */}
              <div className="bg-white p-6 rounded-lg border border-gray-200">
                <h3 className="font-['General_Sans:Semibold',sans-serif] text-[16px] text-[#1D2939] mb-4">
                  Phone Input with Dropdown
                </h3>
                <PhoneInputField
                  label="Phone number"
                  placeholder="+1 (555) 000-0000"
                  countryCode="US"
                  showCountryDropdown={true}
                  onCountryCodeChange={(code: string) => addNotification(`Country changed to: ${code} 🌍`)}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => console.log("Phone:", e.target.value)}
                />
                <p className="text-[11px] text-[#667085] mt-2">
                  Click the country code to toggle between US and GB
                </p>
              </div>

              {/* Password Input with Toggle */}
              <div className="bg-white p-6 rounded-lg border border-gray-200">
                <h3 className="font-['General_Sans:Semibold',sans-serif] text-[16px] text-[#1D2939] mb-4">
                  Password Input
                </h3>
                <PasswordInputField
                  label="Password"
                  placeholder="Enter your password"
                  showToggle={true}
                  required={true}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => console.log("Password length:", e.target.value.length)}
                />
              </div>

              {/* Search Input */}
              <div className="bg-white p-6 rounded-lg border border-gray-200">
                <h3 className="font-['General_Sans:Semibold',sans-serif] text-[16px] text-[#1D2939] mb-4">
                  Search Input
                </h3>
                <SearchInputField
                  placeholder="Search products..."
                  onSearch={(query: string) => addNotification(`Searching for: "${query}" 🔍`)}
                  helperText="Press Enter to search"
                />
              </div>

              {/* Input with Error */}
              <div className="bg-white p-6 rounded-lg border border-gray-200">
                <h3 className="font-['General_Sans:Semibold',sans-serif] text-[16px] text-[#1D2939] mb-4">
                  Input with Validation
                </h3>
                <EmailInputField
                  label="Email"
                  placeholder="olivia@untitledui.com"
                  showIcon={true}
                  defaultValue="invalid-email"
                  error={true}
                  errorMessage="Please enter a valid email address"
                />
              </div>

              {/* Required Input */}
              <div className="bg-white p-6 rounded-lg border border-gray-200">
                <h3 className="font-['General_Sans:Semibold',sans-serif] text-[16px] text-[#1D2939] mb-4">
                  Required Field
                </h3>
                <InputField
                  label="Full Name"
                  placeholder="John Doe"
                  required={true}
                  helperText="This field is required"
                />
              </div>

              {/* Disabled Input */}
              <div className="bg-white p-6 rounded-lg border border-gray-200">
                <h3 className="font-['General_Sans:Semibold',sans-serif] text-[16px] text-[#1D2939] mb-4">
                  Disabled State
                </h3>
                <InputField
                  label="Account ID"
                  value="ACC-2024-1234"
                  disabled={true}
                  helperText="This field cannot be edited"
                />
              </div>

              {/* Currency Input */}
              <div className="bg-white p-6 rounded-lg border border-gray-200">
                <h3 className="font-['General_Sans:Semibold',sans-serif] text-[16px] text-[#1D2939] mb-4">
                  Currency Input with Dropdown
                </h3>
                <CurrencyInputField
                  label="Sale amount"
                  placeholder="1,000.00"
                  currencySymbol="$"
                  currencyCode="USD"
                  showCurrencyDropdown={true}
                  onCurrencyCodeChange={(code: string) => addNotification(`Currency changed to: ${code} 💵`)}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => console.log("Amount:", e.target.value)}
                />
                <p className="text-[11px] text-[#667085] mt-2">
                  Click currency code to toggle between USD, EUR, GBP
                </p>
              </div>

              {/* URL Input */}
              <div className="bg-white p-6 rounded-lg border border-gray-200">
                <h3 className="font-['General_Sans:Semibold',sans-serif] text-[16px] text-[#1D2939] mb-4">
                  URL Input with Prefix
                </h3>
                <URLInputField
                  label="Website"
                  placeholder="www.untitledui.com"
                  urlPrefix="http://"
                  showPrefix={true}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => addNotification(`URL updated: ${e.target.value} 🌐`)}
                />
              </div>

              {/* Card Number Input */}
              <div className="bg-white p-6 rounded-lg border border-gray-200">
                <h3 className="font-['General_Sans:Semibold',sans-serif] text-[16px] text-[#1D2939] mb-4">
                  Card Number Input
                </h3>
                <CardNumberInputField
                  label="Card number"
                  placeholder="1234 5678 9012 3456"
                  showCardIcon={true}
                  cardType="mastercard"
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => console.log("Card:", e.target.value)}
                />
              </div>

              {/* Textarea Field */}
              <div className="bg-white p-6 rounded-lg border border-gray-200">
                <h3 className="font-['General_Sans:Semibold',sans-serif] text-[16px] text-[#1D2939] mb-4">
                  Textarea Field
                </h3>
                <TextareaField
                  label="Description"
                  placeholder="Enter a description..."
                  rows={4}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => addNotification(`Description updated 📝`)}
                />
              </div>

              {/* Verification Code Input */}
              <div className="bg-white p-6 rounded-lg border border-gray-200">
                <h3 className="font-['General_Sans:Semibold',sans-serif] text-[16px] text-[#1D2939] mb-4">
                  Verification Code Input (4 digits)
                </h3>
                <VerificationCodeInputField
                  label="Secure code"
                  length={4}
                  helperText="This is a hint text to help user."
                  onComplete={(code: string) => addNotification(`Code completed: ${code} 🔐`)}
                  onChange={(code: string) => console.log("Code:", code)}
                />
              </div>

              {/* Verification Code Input with Separator */}
              <div className="bg-white p-6 rounded-lg border border-gray-200">
                <h3 className="font-['General_Sans:Semibold',sans-serif] text-[16px] text-[#1D2939] mb-4">
                  Verification Code Input (6 digits with dash)
                </h3>
                <VerificationCodeInputField
                  label="Secure code"
                  length={6}
                  separator={{ char: "-", position: 3 }}
                  helperText="This is a hint text to help user."
                  onComplete={(code: string) => addNotification(`6-digit code completed: ${code} 🔐`)}
                  onChange={(code: string) => console.log("Code:", code)}
                />
              </div>

              {/* Dropdown Input (Basic) */}
              <div className="bg-white p-6 rounded-lg border border-gray-200">
                <h3 className="font-['General_Sans:Semibold',sans-serif] text-[16px] text-[#1D2939] mb-4">
                  Dropdown Input (Basic)
                </h3>
                <DropdownInputField
                  label="Team member"
                  placeholder="Select team member"
                  options={[
                    { value: "1", label: "John Doe" },
                    { value: "2", label: "Jane Smith" },
                    { value: "3", label: "Michael Brown" },
                    { value: "4", label: "Emily Davis" },
                  ]}
                  onChange={(value: string) => addNotification(`Selected team member: ${value} 👤`)}
                />
              </div>

              {/* Dropdown Input with Icon */}
              <div className="bg-white p-6 rounded-lg border border-gray-200">
                <h3 className="font-['General_Sans:Semibold',sans-serif] text-[16px] text-[#1D2939] mb-4">
                  Dropdown Input (With User Icon)
                </h3>
                <DropdownInputField
                  label="Team member"
                  placeholder="Select team member"
                  showIcon={true}
                  iconType="user"
                  options={[
                    { value: "1", label: "John Doe" },
                    { value: "2", label: "Jane Smith" },
                    { value: "3", label: "Michael Brown" },
                    { value: "4", label: "Emily Davis" },
                    { value: "5", label: "Sarah Wilson" },
                    { value: "6", label: "David Miller" },
                  ]}
                  onChange={(value: string) => addNotification(`Selected: ${value} 👥`)}
                />
              </div>

              {/* Dropdown Input with Status Dot */}
              <div className="bg-white p-6 rounded-lg border border-gray-200">
                <h3 className="font-['General_Sans:Semibold',sans-serif] text-[16px] text-[#1D2939] mb-4">
                  Dropdown Input (With Status Dot)
                </h3>
                <DropdownInputField
                  label="Team member"
                  placeholder="Select team member"
                  showStatusDot={true}
                  statusDotColor="#12B76A"
                  options={[
                    { value: "1", label: "John Doe (Online)", statusColor: "#12B76A" },
                    { value: "2", label: "Jane Smith (Away)", statusColor: "#F79009" },
                    { value: "3", label: "Michael Brown (Busy)", statusColor: "#F04438" },
                    { value: "4", label: "Emily Davis (Offline)", statusColor: "#98A2B3" },
                  ]}
                  onChange={(value: string) => addNotification(`Selected: ${value} 🟢`)}
                />
              </div>
            </div>

            {/* Features List */}
            <div className="bg-blue-50 p-6 rounded-lg border border-blue-200 mt-8">
              <h3 className="font-['General_Sans:Semibold',sans-serif] text-[16px] text-[#1D2939] mb-3">
                💡 Input Field Features
              </h3>
              <ul className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[14px] text-[#667085] list-disc list-inside">
                <li><strong>InputField:</strong> Base component for all inputs</li>
                <li><strong>EmailInputField:</strong> Pre-configured email input</li>
                <li><strong>PhoneInputField:</strong> Phone with country code</li>
                <li><strong>PasswordInputField:</strong> Password with show/hide</li>
                <li><strong>SearchInputField:</strong> Search with icon</li>
                <li><strong>CurrencyInputField:</strong> Currency with dropdown</li>
                <li><strong>URLInputField:</strong> URL with protocol prefix</li>
                <li><strong>CardNumberInputField:</strong> Card with payment icon</li>
                <li><strong>TextareaField:</strong> Multiline text input</li>
                <li><strong>VerificationCodeInputField:</strong> OTP/PIN with auto-focus</li>
                <li><strong>DropdownInputField:</strong> Select/dropdown with search</li>
                <li><strong>Validation States:</strong> Error, focus, disabled</li>
                <li><strong>Icons & Prefixes:</strong> User, Mail, Search icons</li>
                <li><strong>Helper Text:</strong> Hints and error messages</li>
                <li><strong>Required Fields:</strong> Visual asterisk indicator</li>
                <li><strong>Controlled/Uncontrolled:</strong> Flexible state</li>
                <li><strong>Interactive Dropdowns:</strong> With options & search</li>
              </ul>
            </div>
          </div>
          )}

          {/* Card Cart Button Demo */}
          {(activeTab === "all" || activeTab === "buttons") && (
          <div className="w-full border border-gray-200 rounded-xl p-8 bg-gray-50">
            <h2 className="font-['General_Sans:Semibold',sans-serif] text-[#054f31] text-[20px] leading-[28px] mb-6">
              Card Cart Button Component
            </h2>
            
            {/* Demo Card */}
            <div className="max-w-sm mx-auto">
              <div className="bg-white rounded-2xl overflow-hidden shadow-lg border border-gray-200">
                {/* Product Image */}
                <div className="aspect-square bg-gradient-to-br from-green-100 to-green-200 flex items-center justify-center">
                  <div className="text-6xl">🛍️</div>
                </div>
                
                {/* Product Info */}
                <div className="p-6">
                  <h3 className="font-['General_Sans:Semibold',sans-serif] text-[18px] text-[#1D2939] mb-2">
                    Premium Product
                  </h3>
                  <p className="text-[#667085] text-[14px] mb-4">
                    High-quality product with amazing features
                  </p>
                  <div className="flex items-baseline gap-2 mb-6">
                    <span className="font-['General_Sans:Bold',sans-serif] text-[24px] text-[#054f31]">
                      $99.00
                    </span>
                    <span className="text-[#98A2B3] text-[16px] line-through">
                      $149.00
                    </span>
                  </div>
                  
                  {/* Card Cart Button */}
                  <CardCartButton
                    isFavorited={isFavorited}
                    onFavoriteToggle={handleFavoriteToggle}
                    onAddToCart={handleAddToCart}
                    onQuickView={handleQuickView}
                    isAddingToCart={isAddingToCart}
                    inCart={inCart}
                    quantity={quantity}
                    onIncrement={handleIncrement}
                    onDecrement={handleDecrement}
                  />
                </div>
              </div>
              
              {/* Status */}
              <div className="mt-6 p-4 bg-white rounded-lg border border-gray-200">
                <h4 className="font-['General_Sans:Semibold',sans-serif] text-[14px] text-[#1D2939] mb-2">
                  Component State:
                </h4>
                <ul className="text-[13px] text-[#667085] space-y-1">
                  <li>
                    <span className="font-medium">Favorited:</span>{" "}
                    <span className={isFavorited ? "text-[#E31B54]" : "text-gray-400"}>
                      {isFavorited ? "Yes ❤️" : "No"}
                    </span>
                  </li>
                  <li>
                    <span className="font-medium">In Cart:</span>{" "}
                    <span className={inCart ? "text-[#039855]" : "text-gray-400"}>
                      {inCart ? "Yes 🛒" : "No"}
                    </span>
                  </li>
                  <li>
                    <span className="font-medium">Quantity:</span>{" "}
                    <span className="text-[#039855]">{quantity}</span>
                  </li>
                  <li>
                    <span className="font-medium">Adding to Cart:</span>{" "}
                    <span className={isAddingToCart ? "text-[#F79009]" : "text-gray-400"}>
                      {isAddingToCart ? "Yes ⏳" : "No"}
                    </span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
          )}

          {/* Countdown Component Demo */}
          {(activeTab === "all" || activeTab === "badges") && (
          <div className="w-full border border-gray-200 rounded-xl p-8 bg-gray-50">
            <h2 className="font-['General_Sans:Semibold',sans-serif] text-[#054f31] text-[20px] leading-[28px] mb-6">
              Countdown Badge Components
            </h2>
            <p className="font-['General_Sans:Regular',sans-serif] text-[#667085] text-[16px] leading-[24px] mb-8">
              Live countdown timers that update every second
            </p>
            
            <div className="flex flex-col gap-8">
              {/* Countdown with Text */}
              <div className="bg-white p-6 rounded-lg border border-gray-200">
                <h3 className="font-['General_Sans:Semibold',sans-serif] text-[16px] text-[#1D2939] mb-4">
                  Countdown with Text Label
                </h3>
                <div className="flex flex-wrap gap-4">
                  <CountdownWithText 
                    targetDate={new Date(Date.now() + 16 * 24 * 60 * 60 * 1000 + 21 * 60 * 60 * 1000 + 57 * 60 * 1000 + 23 * 1000)}
                    label="Ends in"
                    onExpire={() => addNotification("Countdown expired! ⏰")}
                  />
                  <CountdownWithText 
                    targetDate={new Date(Date.now() + 5 * 24 * 60 * 60 * 1000 + 12 * 60 * 60 * 1000)}
                    label="Sale ends"
                    onExpire={() => addNotification("Sale ended! 🛍️")}
                  />
                  <CountdownWithText 
                    targetDate={new Date(Date.now() + 2 * 60 * 60 * 1000 + 30 * 60 * 1000)}
                    label="Offer expires"
                    onExpire={() => addNotification("Offer expired! 🎁")}
                  />
                </div>
              </div>

              {/* Countdown without Text */}
              <div className="bg-white p-6 rounded-lg border border-gray-200">
                <h3 className="font-['General_Sans:Semibold',sans-serif] text-[16px] text-[#1D2939] mb-4">
                  Countdown without Text (Compact)
                </h3>
                <div className="flex flex-wrap gap-4">
                  <Countdown 
                    targetDate={new Date(Date.now() + 16 * 24 * 60 * 60 * 1000 + 21 * 60 * 60 * 1000 + 57 * 60 * 1000 + 23 * 1000)}
                    onExpire={() => addNotification("Timer finished! ⏰")}
                  />
                  <Countdown 
                    targetDate={new Date(Date.now() + 3 * 24 * 60 * 60 * 1000 + 8 * 60 * 60 * 1000)}
                    onExpire={() => addNotification("Time's up! ⏱️")}
                  />
                  <Countdown 
                    targetDate={new Date(Date.now() + 45 * 60 * 1000)}
                    onExpire={() => addNotification("Countdown complete! ✅")}
                  />
                </div>
              </div>

              {/* Usage Examples */}
              <div className="bg-blue-50 p-6 rounded-lg border border-blue-200">
                <h3 className="font-['General_Sans:Semibold',sans-serif] text-[16px] text-[#1D2939] mb-3">
                  💡 Usage Examples
                </h3>
                <ul className="text-[14px] text-[#667085] space-y-2 list-disc list-inside">
                  <li>Flash sales and limited-time offers</li>
                  <li>Event countdowns (webinars, launches, etc.)</li>
                  <li>Delivery time estimates</li>
                  <li>Auction endings</li>
                  <li>Subscription renewals</li>
                </ul>
              </div>
            </div>
          </div>
          )}

          {/* Badge Component Demo */}
          {(activeTab === "all" || activeTab === "badges") && (
          <div className="w-full border border-gray-200 rounded-xl p-8 bg-gray-50">
            <h2 className="font-['General_Sans:Semibold',sans-serif] text-[#054f31] text-[20px] leading-[28px] mb-6">
              Badge Components
            </h2>
            <p className="font-['General_Sans:Regular',sans-serif] text-[#667085] text-[16px] leading-[24px] mb-8">
              Compact label badges for status, promotions, and categories
            </p>
            
            <div className="flex flex-col gap-8">
              {/* Preset Variants */}
              <div className="bg-white p-6 rounded-lg border border-gray-200">
                <h3 className="font-['General_Sans:Semibold',sans-serif] text-[16px] text-[#1D2939] mb-4">
                  Preset Badge Variants
                </h3>
                <div className="flex flex-wrap gap-4 items-center">
                  <div className="flex flex-col gap-2">
                    <DiscountBadge />
                    <span className="text-[12px] text-[#667085]">Discount</span>
                  </div>
                  <div className="flex flex-col gap-2">
                    <DistressBadge />
                    <span className="text-[12px] text-[#667085]">Distress</span>
                  </div>
                  <div className="flex flex-col gap-2">
                    <HotBadge />
                    <span className="text-[12px] text-[#667085]">Hot</span>
                  </div>
                </div>
              </div>

              {/* Custom Text Examples */}
              <div className="bg-white p-6 rounded-lg border border-gray-200">
                <h3 className="font-['General_Sans:Semibold',sans-serif] text-[16px] text-[#1D2939] mb-4">
                  Custom Text Examples
                </h3>
                <div className="flex flex-wrap gap-4 items-center">
                  <DiscountBadge>50% OFF</DiscountBadge>
                  <DiscountBadge>SALE</DiscountBadge>
                  <DiscountBadge>BUY 1 GET 1</DiscountBadge>
                  <DistressBadge>URGENT</DistressBadge>
                  <DistressBadge>PRIORITY</DistressBadge>
                  <HotBadge>TRENDING</HotBadge>
                  <HotBadge>NEW</HotBadge>
                  <HotBadge>BESTSELLER</HotBadge>
                </div>
              </div>

              {/* Custom Color Badges */}
              <div className="bg-white p-6 rounded-lg border border-gray-200">
                <h3 className="font-['General_Sans:Semibold',sans-serif] text-[16px] text-[#1D2939] mb-4">
                  Custom Color Badges
                </h3>
                <div className="flex flex-wrap gap-4 items-center">
                  <Badge variant="custom" backgroundColor="#4F46E5" textColor="white">
                    PREMIUM
                  </Badge>
                  <Badge variant="custom" backgroundColor="#EC4899" textColor="white">
                    LIMITED
                  </Badge>
                  <Badge variant="custom" backgroundColor="#F59E0B" textColor="white">
                    FEATURED
                  </Badge>
                  <Badge variant="custom" backgroundColor="#10B981" textColor="white">
                    IN STOCK
                  </Badge>
                  <Badge variant="custom" backgroundColor="#6366F1" textColor="white">
                    EXCLUSIVE
                  </Badge>
                  <Badge variant="custom" backgroundColor="#8B5CF6" textColor="white">
                    VIP
                  </Badge>
                </div>
              </div>

              {/* Product Card Example */}
              <div className="bg-white p-6 rounded-lg border border-gray-200">
                <h3 className="font-['General_Sans:Semibold',sans-serif] text-[16px] text-[#1D2939] mb-4">
                  In Product Card Context
                </h3>
                <div className="max-w-xs bg-gray-50 rounded-lg overflow-hidden border border-gray-300">
                  <div className="relative aspect-square bg-gradient-to-br from-orange-100 to-orange-200 flex items-center justify-center">
                    <div className="text-6xl">📱</div>
                    {/* Badges positioned absolutely */}
                    <div className="absolute top-3 left-3 flex flex-col gap-2">
                      <HotBadge>HOT</HotBadge>
                      <DiscountBadge>30% OFF</DiscountBadge>
                    </div>
                  </div>
                  <div className="p-4">
                    <h4 className="font-['General_Sans:Semibold',sans-serif] text-[16px] text-[#1D2939] mb-2">
                      Premium Smartphone
                    </h4>
                    <div className="flex items-baseline gap-2">
                      <span className="font-['General_Sans:Bold',sans-serif] text-[20px] text-[#054f31]">
                        $699
                      </span>
                      <span className="text-[#98A2B3] text-[14px] line-through">
                        $999
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Usage Examples */}
              <div className="bg-blue-50 p-6 rounded-lg border border-blue-200">
                <h3 className="font-['General_Sans:Semibold',sans-serif] text-[16px] text-[#1D2939] mb-3">
                  💡 Usage Examples
                </h3>
                <ul className="text-[14px] text-[#667085] space-y-2 list-disc list-inside">
                  <li>Product discounts and promotions (19% OFF, SALE)</li>
                  <li>Urgency indicators (DISTRESS, URGENT, PRIORITY)</li>
                  <li>Trending items (HOT, TRENDING, BESTSELLER)</li>
                  <li>Stock status (IN STOCK, LIMITED, SOLD OUT)</li>
                  <li>Product features (NEW, PREMIUM, EXCLUSIVE)</li>
                </ul>
              </div>

              {/* Round Price Badges */}
              <div className="bg-white p-6 rounded-lg border border-gray-200">
                <h3 className="font-['General_Sans:Semibold',sans-serif] text-[16px] text-[#1D2939] mb-4">
                  Round Price Badges
                </h3>
                <div className="flex flex-wrap gap-8 items-center">
                  <div className="flex flex-col gap-3 items-center">
                    <div className="w-[107px] h-[107px]">
                      <RoundPriceBadge price="₦299,000" variant="green" />
                    </div>
                    <span className="text-[12px] text-[#667085]">Green variant</span>
                  </div>
                  <div className="flex flex-col gap-3 items-center">
                    <div className="w-[107px] h-[107px]">
                      <RoundPriceBadge price="₦299,000" variant="orange" />
                    </div>
                    <span className="text-[12px] text-[#667085]">Orange variant</span>
                  </div>
                  <div className="flex flex-col gap-3 items-center">
                    <div className="w-[107px] h-[107px]">
                      <RoundPriceBadge price="$49.99" topText="Only" bottomText="Now!" variant="green" />
                    </div>
                    <span className="text-[12px] text-[#667085]">Custom text</span>
                  </div>
                  <div className="flex flex-col gap-3 items-center">
                    <div className="w-[107px] h-[107px]">
                      <RoundPriceBadge price="$99" topText="Flash" bottomText="Sale!" variant="orange" />
                    </div>
                    <span className="text-[12px] text-[#667085]">Flash sale</span>
                  </div>
                </div>
              </div>

              {/* Rating Badges */}
              <div className="bg-white p-6 rounded-lg border border-gray-200">
                <h3 className="font-['General_Sans:Semibold',sans-serif] text-[16px] text-[#1D2939] mb-4">
                  Rating Badges
                </h3>
                <div className="flex flex-col gap-6">
                  {/* Various rating examples */}
                  <div className="flex flex-wrap gap-4 items-center">
                    <div className="flex flex-col gap-2">
                      <RatingBadge rating={5} text="245 reviews" />
                      <span className="text-[12px] text-[#667085]">Perfect rating</span>
                    </div>
                    <div className="flex flex-col gap-2">
                      <RatingBadge rating={4.5} text="1,234 reviews" />
                      <span className="text-[12px] text-[#667085]">4.5 stars</span>
                    </div>
                    <div className="flex flex-col gap-2">
                      <RatingBadge rating={4} text="(123) 456-7890" />
                      <span className="text-[12px] text-[#667085]">Figma example</span>
                    </div>
                    <div className="flex flex-col gap-2">
                      <RatingBadge rating={3.5} text="89 reviews" />
                      <span className="text-[12px] text-[#667085]">3.5 stars</span>
                    </div>
                    <div className="flex flex-col gap-2">
                      <RatingBadge rating={3} text="42 reviews" />
                      <span className="text-[12px] text-[#667085]">3 stars</span>
                    </div>
                  </div>

                  {/* Without text */}
                  <div>
                    <h4 className="font-['General_Sans:Medium',sans-serif] text-[14px] text-[#1D2939] mb-3">
                      Without text:
                    </h4>
                    <div className="flex flex-wrap gap-4 items-center">
                      <RatingBadge rating={5} />
                      <RatingBadge rating={4.5} />
                      <RatingBadge rating={4} />
                      <RatingBadge rating={3.5} />
                      <RatingBadge rating={3} />
                      <RatingBadge rating={2.5} />
                      <RatingBadge rating={2} />
                      <RatingBadge rating={1} />
                    </div>
                  </div>

                  {/* In product context */}
                  <div>
                    <h4 className="font-['General_Sans:Medium',sans-serif] text-[14px] text-[#1D2939] mb-3">
                      In product card:
                    </h4>
                    <div className="max-w-xs bg-gray-50 rounded-lg overflow-hidden border border-gray-300">
                      <div className="relative aspect-square bg-gradient-to-br from-blue-100 to-blue-200 flex items-center justify-center">
                        <div className="text-6xl">🎧</div>
                      </div>
                      <div className="p-4">
                        <h4 className="font-['General_Sans:Semibold',sans-serif] text-[16px] text-[#1D2939] mb-2">
                          Wireless Headphones
                        </h4>
                        <div className="mb-3">
                          <RatingBadge rating={4.5} text="2,847 reviews" />
                        </div>
                        <div className="flex items-baseline gap-2">
                          <span className="font-['General_Sans:Bold',sans-serif] text-[20px] text-[#054f31]">
                            $129
                          </span>
                          <span className="text-[#98A2B3] text-[14px] line-through">
                            $199
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          )}

          {/* Product Cards Demo */}
          {(activeTab === "all" || activeTab === "cards") && (
          <div className="w-full border border-gray-200 rounded-xl p-8 bg-gray-50">
            <h2 className="font-['General_Sans:Semibold',sans-serif] text-[#054f31] text-[20px] leading-[28px] mb-6">
              Product Card Components
            </h2>
            <p className="font-['General_Sans:Regular',sans-serif] text-[#667085] text-[16px] leading-[24px] mb-8">
              Complete product cards with badges, ratings, and interactive cart buttons. Hover to see cart controls!
            </p>
            
            <div className="flex flex-col gap-8">
              {/* Figma Design Example */}
              <div className="bg-white p-6 rounded-lg border border-gray-200">
                <h3 className="font-['General_Sans:Semibold',sans-serif] text-[16px] text-[#1D2939] mb-4">
                  Figma Design (Default & Hover States)
                </h3>
                <p className="text-[14px] text-[#667085] mb-6">
                  Hover over the card to see the cart controls appear with a dark overlay
                </p>
                <div className="flex flex-wrap gap-6 justify-center">
                  <DefaultProductCard 
                    onFavoriteToggle={() => addNotification("Favorite toggled! ❤️")}
                    onAddToCart={() => addNotification("Added to cart! 🛒")}
                    onQuickView={() => addNotification("Quick view opened! 👁️")}
                  />
                </div>
              </div>

              {/* Simple Product Cards */}
              <div className="bg-white p-6 rounded-lg border border-gray-200">
                <h3 className="font-['General_Sans:Semibold',sans-serif] text-[16px] text-[#1D2939] mb-4">
                  Simple Product Cards
                </h3>
                <div className="flex flex-wrap gap-6 justify-center">
                  <SimpleProductCard
                    image={fishImage}
                    title="Fresh Salmon Fillet"
                    price="₦129.00"
                    originalPrice="₦199.00"
                    rating={4.5}
                    reviewCount="342 reviews"
                    discount="35% OFF"
                    onView={() => {
                      setSelectedProduct({
                        title: "Fresh Salmon Fillet",
                        rating: 4.5,
                        reviewCount: 342,
                        sku: "FSF-001",
                        brand: "Ocean Fresh",
                        category: "Seafood",
                        availability: "In Stock",
                        price: "₦129.00",
                        originalPrice: "₦199.00",
                        discount: "35% OFF",
                        images: [fishImage],
                      });
                      setIsProductModalOpen(true);
                    }}
                  />
                  <SimpleProductCard
                    image={fishImage}
                    title="Premium Tuna Steak"
                    price="₦89.00"
                    rating={5}
                    reviewCount="156 reviews"
                    onView={() => {
                      setSelectedProduct({
                        title: "Premium Tuna Steak",
                        rating: 5,
                        reviewCount: 156,
                        sku: "PTS-002",
                        brand: "Ocean Fresh",
                        category: "Seafood",
                        availability: "In Stock",
                        price: "₦89.00",
                        images: [fishImage],
                      });
                      setIsProductModalOpen(true);
                    }}
                  />
                  <SimpleProductCard
                    image={fishImage}
                    title="Organic Cod Fish"
                    price="₦75.00"
                    originalPrice="₦95.00"
                    rating={4}
                    reviewCount="89 reviews"
                    discount="21% OFF"
                    onView={() => {
                      setSelectedProduct({
                        title: "Organic Cod Fish",
                        rating: 4,
                        reviewCount: 89,
                        sku: "OCF-003",
                        brand: "Ocean Fresh",
                        category: "Seafood",
                        availability: "In Stock",
                        price: "₦75.00",
                        originalPrice: "₦95.00",
                        discount: "21% OFF",
                        images: [fishImage],
                      });
                      setIsProductModalOpen(true);
                    }}
                  />
                </div>
              </div>

              {/* Hot Deal Cards */}
              <div className="bg-white p-6 rounded-lg border border-gray-200">
                <h3 className="font-['General_Sans:Semibold',sans-serif] text-[16px] text-[#1D2939] mb-4">
                  Hot Deal Product Cards
                </h3>
                <div className="flex flex-wrap gap-6 justify-center">
                  <HotDealProductCard
                    image={fishImage}
                    title="Flash Sale: Lobster Tail"
                    price="₦249.00"
                    originalPrice="₦499.00"
                    rating={4.5}
                    reviewCount="678 reviews"
                  />
                  <HotDealProductCard
                    image={fishImage}
                    title="Today's Special: Shrimp"
                    price="₦149.00"
                    originalPrice="₦299.00"
                    rating={5}
                    reviewCount="1.2k reviews"
                  />
                </div>
              </div>

              {/* Custom Product Cards */}
              <div className="bg-white p-6 rounded-lg border border-gray-200">
                <h3 className="font-['General_Sans:Semibold',sans-serif] text-[16px] text-[#1D2939] mb-4">
                  Custom Badge Combinations
                </h3>
                <div className="flex flex-wrap gap-6 justify-center">
                  <ProductCard
                    image={fishImage}
                    title="Premium Atlantic Mackerel"
                    price="₦159.00"
                    originalPrice="₦229.00"
                    rating={4.5}
                    ratingText="234 reviews"
                    badges={[
                      { text: "PREMIUM", variant: "custom", backgroundColor: "#4F46E5", textColor: "white" },
                      { text: "30% OFF", variant: "discount" }
                    ]}
                    onFavoriteToggle={() => addNotification("Favorite toggled! ❤️")}
                    onAddToCart={() => addNotification("Added to cart! 🛒")}
                  />
                  <ProductCard
                    image={fishImage}
                    title="Sold Out: King Crab"
                    price="₦599.00"
                    rating={5}
                    ratingText="892 reviews"
                    badges={[
                      { text: "SOLD OUT", variant: "custom", backgroundColor: "#929fa5", textColor: "white" }
                    ]}
                    onFavoriteToggle={() => addNotification("Favorite toggled! ❤️")}
                    onAddToCart={() => addNotification("Item is sold out!")}
                  />
                </div>
              </div>

              {/* Big Product Cards */}
              <div className="bg-white p-6 rounded-lg border border-gray-200">
                <h3 className="font-['General_Sans:Semibold',sans-serif] text-[16px] text-[#1D2939] mb-4">
                  Big Product Cards (Featured/Detailed Display)
                </h3>
                <p className="text-[14px] text-[#667085] mb-6">
                  Larger cards with product descriptions and always-visible action buttons
                </p>
                <div className="flex flex-wrap gap-6 justify-center">
                  <BigProductCard
                    image={fishImage}
                    title="Tomato Amigo Premium Parboiled Rice (50kg)"
                    price="₦442.12"
                    originalPrice="₦865.99"
                    description="Games built using the Xbox Series X|S development kit showcase unparalleled load times and visuals."
                    rating={4}
                    ratingText="(123) 456-7890"
                    badges={[
                      { text: "19% OFF", variant: "discount" },
                      { text: "DISTRESS", variant: "distress" },
                      { text: "HOT", variant: "hot" },
                      { text: "SOLD OUT", variant: "custom", backgroundColor: "#929fa5", textColor: "white" },
                      { text: "SAVE UP TO 50%", variant: "custom", backgroundColor: "#f79009", textColor: "white" }
                    ]}
                    onFavoriteToggle={() => addNotification("Favorite toggled! ❤️")}
                    onAddToCart={() => addNotification("Added to cart! 🛒")}
                    onQuickView={() => {
                      setSelectedProduct({
                        title: "Tomato Amigo Premium Parboiled Rice (50kg)",
                        price: "₦442.12",
                        originalPrice: "₦865.99",
                        discount: "19% OFF",
                        rating: 4,
                        reviewCount: 123,
                        sku: "A264671",
                        brand: "Tomato Amigo",
                        category: "Food & Groceries",
                        availability: "In Stock"
                      });
                      setIsProductModalOpen(true);
                      addNotification("Quick view opened! 👁️");
                    }}
                  />
                  <BigProductCard
                    image={fishImage}
                    title="Premium Organic Coffee Beans (1kg)"
                    price="₦89.99"
                    originalPrice="₦129.99"
                    description="Ethically sourced from sustainable farms, our premium coffee beans deliver rich, complex flavors with every brew."
                    rating={5}
                    ratingText="2,847 reviews"
                    badges={[
                      { text: "PREMIUM", variant: "custom", backgroundColor: "#4F46E5", textColor: "white" },
                      { text: "31% OFF", variant: "discount" }
                    ]}
                    onFavoriteToggle={() => addNotification("Favorite toggled! ❤️")}
                    onAddToCart={() => addNotification("Added to cart! 🛒")}
                    onQuickView={() => {
                      setSelectedProduct({
                        title: "Premium Organic Coffee Beans (1kg)",
                        price: "₦89.99",
                        originalPrice: "₦129.99",
                        discount: "31% OFF",
                        rating: 5,
                        reviewCount: 2847,
                        sku: "CF789123",
                        brand: "Premium Roasters",
                        category: "Food & Beverages",
                        availability: "In Stock"
                      });
                      setIsProductModalOpen(true);
                      addNotification("Quick view opened! 👁️");
                    }}
                  />
                </div>
              </div>

              {/* Usage Examples */}
              <div className="bg-blue-50 p-6 rounded-lg border border-blue-200">
                <h3 className="font-['General_Sans:Semibold',sans-serif] text-[16px] text-[#1D2939] mb-3">
                  💡 Product Card Features
                </h3>
                <ul className="text-[14px] text-[#667085] space-y-2 list-disc list-inside">
                  <li>Hover to reveal cart controls (favorite, add to cart, quick view)</li>
                  <li>Supports multiple badge combinations for sales, status, and features</li>
                  <li>Integrated rating system with star display and review count</li>
                  <li>Price display with optional strikethrough for original price</li>
                  <li>Smooth animations and transitions on hover</li>
                  <li>Fully interactive with state management for cart and favorites</li>
                  <li>Perfect for e-commerce product grids and catalogs</li>
                </ul>
              </div>
            </div>
          </div>
          )}

          {/* Banner Components Demo */}
          {(activeTab === "all" || activeTab === "banners") && (
          <div className="w-full border border-gray-200 rounded-xl p-8 bg-gray-50">
            <h2 className="font-['General_Sans:Semibold',sans-serif] text-[#054f31] text-[20px] leading-[28px] mb-6">
              Banner Components
            </h2>
            <p className="font-['General_Sans:Regular',sans-serif] text-[#667085] text-[16px] leading-[24px] mb-8">
              Full-width promotional banners with price badges, buttons, and carousel dots. Click dots to navigate!
            </p>
            
            <div className="flex flex-col gap-8">
              {/* Food Items Banner */}
              <div className="bg-white p-6 rounded-lg border border-gray-200">
                <h3 className="font-['General_Sans:Semibold',sans-serif] text-[16px] text-[#1D2939] mb-4">
                  Food Items Banner (Figma Design)
                </h3>
                <p className="text-[14px] text-[#667085] mb-6">
                  Gray background with green price badge and product image
                </p>
                <FiftyPercentBanner
                  heading="Food items"
                  description="Get your fresh food items at market cost. No hidden charges."
                  price="₦299,000"
                  priceTopText="Just"
                  priceBottomText="Only!"
                  buttonText="Shop now"
                  totalDots={3}
                  activeDotIndex={0}
                  onButtonClick={() => addNotification("Shop now clicked! 🛒")}
                  onDotClick={(index: number) => addNotification(`Navigated to slide ${index + 1} 📍`)}
                />
              </div>

              {/* Macbook Pro Banner */}
              <div className="bg-white p-6 rounded-lg border border-gray-200">
                <h3 className="font-['General_Sans:Semibold',sans-serif] text-[16px] text-[#1D2939] mb-4">
                  Macbook Pro Banner (Orange Theme)
                </h3>
                <p className="text-[14px] text-[#667085] mb-6">
                  Beige/orange background with orange price badge and promo badge
                </p>
                <div className="w-full">
                  <FullWidthBanner
                    heading="Macbook Pro"
                    description="Experience the power of Apple M2 chip with stunning Retina display."
                    price="$1,999"
                    priceTopText="From"
                    priceBottomText="Only!"
                    promoBadgeText="SAVE UP TO 50%"
                    buttonText="Shop now"
                    onButtonClick={() => addNotification("Shop now clicked! 💻")}
                  />
                </div>
              </div>

              {/* Custom Banner Examples */}
              <div className="bg-white p-6 rounded-lg border border-gray-200">
                <h3 className="font-['General_Sans:Semibold',sans-serif] text-[16px] text-[#1D2939] mb-4">
                  Custom Banner Variations
                </h3>
                <div className="flex flex-col gap-6">
                  <div className="h-full">
                    <FiftyPercentBanner
                      heading="Summer Sale"
                      description="Enjoy fresh seasonal fruits and vegetables at unbeatable prices!"
                      price="$49.99"
                      priceTopText="Only"
                      priceBottomText="Today!"
                      backgroundColor="#E8F5E9"
                      buttonText="Browse deals"
                      totalDots={5}
                      activeDotIndex={2}
                      onButtonClick={() => addNotification("Browse deals clicked! 🍎")}
                    />
                  </div>
                  
                  <FullWidthBanner
                    heading="Gaming Laptops"
                    description="High-performance gaming laptops with RTX graphics and RGB lighting."
                    price="$899"
                    priceTopText="Starting"
                    priceBottomText="Now!"
                    promoBadgeText="LIMITED TIME OFFER"
                    backgroundColor="#FFF3E0"
                    buttonText="Explore now"
                    onButtonClick={() => addNotification("Explore now clicked! 🎮")}
                  />
                </div>
              </div>

              {/* Category Banner Variants */}
              <div className="bg-white p-6 rounded-lg border border-gray-200">
                <h3 className="font-['General_Sans:Semibold',sans-serif] text-[16px] text-[#1D2939] mb-4">
                  Category Banner Variants
                </h3>
                <p className="text-[14px] text-[#667085] mb-6">
                  Pre-configured banners for different product categories with auto-advancing carousels (5s interval). Watch the dots animate!
                </p>
                <div className="flex flex-col gap-6">
                  <div className="min-h-[300px]">
                    <ElectronicsBanner 
                      onButtonClick={() => addNotification("Electronics shop clicked! 📱")}
                    />
                  </div>
                  <div className="min-h-[300px]">
                    <FashionBanner 
                      onButtonClick={() => addNotification("Fashion shop clicked! 👗")}
                    />
                  </div>
                  <div className="min-h-[300px]">
                    <HomeGardenBanner 
                      onButtonClick={() => addNotification("Home & Garden shop clicked! 🏡")}
                    />
                  </div>
                  <div className="min-h-[300px]">
                    <SportsFitnessBanner 
                      onButtonClick={() => addNotification("Sports & Fitness shop clicked! 🏋️")}
                    />
                  </div>
                  <div className="min-h-[300px]">
                    <BeautyBanner 
                      onButtonClick={() => addNotification("Beauty shop clicked! 💄")}
                    />
                  </div>
                  <div className="min-h-[300px]">
                    <BooksMediaBanner 
                      onButtonClick={() => addNotification("Books & Media shop clicked! 📚")}
                    />
                  </div>
                </div>
              </div>

              {/* Seasonal Banner Templates */}
              <div className="bg-white p-6 rounded-lg border border-gray-200">
                <h3 className="font-['General_Sans:Semibold',sans-serif] text-[16px] text-[#1D2939] mb-4">
                  Seasonal Banner Templates
                </h3>
                <p className="text-[14px] text-[#667085] mb-6">
                  Ready-to-use seasonal promotional banners with auto-advancing carousels (4s interval for most, 3s for Black Friday/Cyber Monday)
                </p>
                <div className="flex flex-col gap-6">
                  {/* Spring/Summer */}
                  <div>
                    <h4 className="font-['General_Sans:Medium',sans-serif] text-[14px] text-[#1D2939] mb-3">
                      Spring & Summer:
                    </h4>
                    <div className="flex flex-col gap-4">
                      <div className="min-h-[300px]">
                        <SpringSaleBanner 
                          onButtonClick={() => addNotification("Spring sale clicked! 🌸")}
                        />
                      </div>
                      <div className="min-h-[300px]">
                        <SummerSaleBanner 
                          onButtonClick={() => addNotification("Summer sale clicked! ☀️")}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Fall/Winter */}
                  <div>
                    <h4 className="font-['General_Sans:Medium',sans-serif] text-[14px] text-[#1D2939] mb-3">
                      Fall & Winter:
                    </h4>
                    <div className="flex flex-col gap-4">
                      <div className="min-h-[300px]">
                        <FallSaleBanner 
                          onButtonClick={() => addNotification("Fall sale clicked! 🍂")}
                        />
                      </div>
                      <div className="min-h-[300px]">
                        <WinterSaleBanner 
                          onButtonClick={() => addNotification("Winter sale clicked! ❄️")}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Major Shopping Events */}
                  <div>
                    <h4 className="font-['General_Sans:Medium',sans-serif] text-[14px] text-[#1D2939] mb-3">
                      Major Shopping Events:
                    </h4>
                    <div className="flex flex-col gap-4">
                      <div className="min-h-[300px]">
                        <BlackFridayBanner 
                          onButtonClick={() => addNotification("Black Friday clicked! 🔥")}
                        />
                      </div>
                      <div className="min-h-[300px]">
                        <CyberMondayBanner 
                          onButtonClick={() => addNotification("Cyber Monday clicked! 💻")}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Holidays */}
                  <div>
                    <h4 className="font-['General_Sans:Medium',sans-serif] text-[14px] text-[#1D2939] mb-3">
                      Holidays & Special Occasions:
                    </h4>
                    <div className="flex flex-col gap-4">
                      <div className="min-h-[300px]">
                        <HolidayBanner 
                          onButtonClick={() => addNotification("Holiday gifts clicked! 🎄")}
                        />
                      </div>
                      <div className="min-h-[300px]">
                        <ValentinesBanner 
                          onButtonClick={() => addNotification("Valentine's clicked! 💝")}
                        />
                      </div>
                      <div className="min-h-[300px]">
                        <NewYearBanner 
                          onButtonClick={() => addNotification("New Year sale clicked! 🎊")}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Back to School */}
                  <div>
                    <h4 className="font-['General_Sans:Medium',sans-serif] text-[14px] text-[#1D2939] mb-3">
                      Back to School:
                    </h4>
                    <div className="min-h-[300px]">
                      <BackToSchoolBanner 
                        onButtonClick={() => addNotification("Back to school clicked! 📚")}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Usage Examples */}
              <div className="bg-blue-50 p-6 rounded-lg border border-blue-200">
                <h3 className="font-['General_Sans:Semibold',sans-serif] text-[16px] text-[#1D2939] mb-3">
                  💡 Banner Component Features
                </h3>
                <ul className="text-[14px] text-[#667085] space-y-2 list-disc list-inside">
                  <li>Full-width responsive design for hero sections and promotions</li>
                  <li>Circular price badges with custom text and colors (green/orange)</li>
                  <li>Shop now buttons with chevron icons</li>
                  <li>Interactive carousel dots for multi-slide banners</li>
                  <li>Auto-advancing carousel functionality (customizable intervals)</li>
                  <li>Customizable background colors and images</li>
                  <li>Optional promotional badges (e.g., "SAVE UP TO 50%")</li>
                  <li>Pre-configured category and seasonal templates</li>
                  <li>Perfect for homepage heroes, category promos, and flash sales</li>
                </ul>
              </div>
            </div>
          </div>
          )}

          {/* Horizontal Cards Demo */}
          {(activeTab === "all" || activeTab === "cards") && (
          <div className="w-full border border-gray-200 rounded-xl p-8 bg-gray-50">
            <h2 className="font-['General_Sans:Semibold',sans-serif] text-[#054f31] text-[20px] leading-[28px] mb-6">
              Horizontal Card Components
            </h2>
            <p className="font-['General_Sans:Regular',sans-serif] text-[#667085] text-[16px] leading-[24px] mb-8">
              Promotional horizontal cards with dark backgrounds, badges, product images, and action buttons. Perfect for hero sections and featured products!
            </p>
            
            <div className="flex flex-col gap-8">
              {/* Figma Design Example */}
              <div className="bg-white p-6 rounded-lg border border-gray-200">
                <h3 className="font-['General_Sans:Semibold',sans-serif] text-[16px] text-[#1D2939] mb-4">
                  Figma Design (Tech Deal)
                </h3>
                <p className="text-[14px] text-[#667085] mb-6">
                  Dark background with HOT badge, product title, Bid Now button, and carousel dots
                </p>
                <div className="w-full">
                  <TechDealHorizontalCard
                    onButtonClick={() => addNotification("Bid Now clicked! 📱")}
                    onDotClick={(index: number) => addNotification(`Navigated to slide ${index + 1} 📍`)}
                  />
                </div>
              </div>

              {/* Custom Variants */}
              <div className="bg-white p-6 rounded-lg border border-gray-200">
                <h3 className="font-['General_Sans:Semibold',sans-serif] text-[16px] text-[#1D2939] mb-4">
                  Fashion Deal Variant
                </h3>
                <div className="w-full">
                  <FashionDealHorizontalCard
                    title="Summer Fashion Collection"
                    discount="30% OFF"
                    onButtonClick={() => addNotification("Shop Now clicked! 👗")}
                  />
                </div>
              </div>

              <div className="bg-white p-6 rounded-lg border border-gray-200">
                <h3 className="font-['General_Sans:Semibold',sans-serif] text-[16px] text-[#1D2939] mb-4">
                  Electronics Deal Variant
                </h3>
                <div className="w-full">
                  <ElectronicsDealHorizontalCard
                    title="Latest Gaming Laptop"
                    discount="25% OFF"
                    onButtonClick={() => addNotification("View Deal clicked! 💻")}
                  />
                </div>
              </div>

              <div className="bg-white p-6 rounded-lg border border-gray-200">
                <h3 className="font-['General_Sans:Semibold',sans-serif] text-[16px] text-[#1D2939] mb-4">
                  Limited Offer Variant
                </h3>
                <div className="w-full">
                  <LimitedOfferHorizontalCard
                    title="Flash Sale: 24 Hours Only"
                    discount="50% OFF"
                    onButtonClick={() => addNotification("Grab Now clicked! ⚡")}
                  />
                </div>
              </div>

              <div className="bg-white p-6 rounded-lg border border-gray-200">
                <h3 className="font-['General_Sans:Semibold',sans-serif] text-[16px] text-[#1D2939] mb-4">
                  Premium Product Variant
                </h3>
                <div className="w-full">
                  <PremiumHorizontalCard
                    title="Luxury Watch Collection"
                    onButtonClick={() => addNotification("Explore clicked! ⌚")}
                  />
                </div>
              </div>

              <div className="bg-white p-6 rounded-lg border border-gray-200">
                <h3 className="font-['General_Sans:Semibold',sans-serif] text-[16px] text-[#1D2939] mb-4">
                  Light Mode Variant (Figma Design)
                </h3>
                <p className="text-[14px] text-[#667085] mb-6 w-full">
                  Light background (#f2f4f7) with dark text - perfect for bright, clean layouts
                </p>
                <div className="w-full">
                  <LightHorizontalCard
                    title="New Google Pixel 6 Pro"
                    discount="19% OFF"
                    onButtonClick={() => addNotification("Bid Now clicked (Light Mode)! 📱")}
                    onDotClick={(index: number) => addNotification(`Light Mode - Slide ${index + 1} 📍`)}
                  />
                </div>
              </div>

              {/* Custom Configuration Example */}
              <div className="bg-white p-6 rounded-lg border border-gray-200">
                <h3 className="font-['General_Sans:Semibold',sans-serif] text-[16px] text-[#1D2939] mb-4">
                  Custom Configuration
                </h3>
                <p className="text-[14px] text-[#667085] mb-6">
                  Fully customizable colors, badges, text, and carousel settings
                </p>
                <div className="w-full">
                  <HorizontalCard
                    title="Custom Promotional Card"
                    leftBadge={{ text: "EXCLUSIVE", variant: "custom", backgroundColor: "#8B5CF6", textColor: "white" }}
                    rightBadge={{ text: "MEMBERS ONLY", variant: "custom", backgroundColor: "#F59E0B", textColor: "white" }}
                    buttonText="Join Now"
                    backgroundColor="#4C1D95"
                    titleColor="#FFFFFF"
                    totalDots={5}
                    activeDotIndex={2}
                    activeDotColor="#FFFFFF"
                    inactiveDotColor="#A78BFA"
                    onButtonClick={() => addNotification("Join Now clicked! 🎯")}
                    onDotClick={(index: number) => addNotification(`Slide ${index + 1} selected 📍`)}
                  />
                </div>
              </div>

              {/* Usage Examples */}
              <div className="bg-blue-50 p-6 rounded-lg border border-blue-200">
                <h3 className="font-['General_Sans:Semibold',sans-serif] text-[16px] text-[#1D2939] mb-3">
                  💡 Horizontal Card Features
                </h3>
                <ul className="text-[14px] text-[#667085] space-y-2 list-disc list-inside">
                  <li>Split layout: Content on left, product image on right</li>
                  <li>Customizable left badge (HOT, NEW, TRENDING, etc.)</li>
                  <li>Customizable right badge (discounts, exclusivity, etc.)</li>
                  <li>Action button with chevron icon and hover effects</li>
                  <li>Interactive carousel dots for navigation</li>
                  <li>Fully customizable colors (background, text, dots)</li>
                  <li>Pre-configured variants for different use cases</li>
                  <li>Perfect for hero banners, featured deals, and promotional sections</li>
                  <li>Responsive height: 248px for consistent display</li>
                </ul>
              </div>
            </div>
          </div>
          )}

          {/* Horizontal Card Large Demo */}
          {(activeTab === "all" || activeTab === "cards") && (
          <div className="w-full border border-gray-200 rounded-xl p-8 bg-gray-50">
            <h2 className="font-['General_Sans:Semibold',sans-serif] text-[#054f31] text-[20px] leading-[28px] mb-6">
              Horizontal Card Large Component
            </h2>
            <p className="font-['General_Sans:Regular',sans-serif] text-[#667085] text-[16px] leading-[24px] mb-8">
              Large promotional card with badge, title, description, countdown timer, price badge, action button, and carousel dots. Perfect for major product launches and featured promotions!
            </p>
            
            <div className="flex flex-col gap-8">
              {/* Default Dark Theme */}
              <div className="bg-white p-6 rounded-lg border border-gray-200">
                <h3 className="font-['General_Sans:Semibold',sans-serif] text-[16px] text-[#1D2939] mb-4">
                  Figma Design (Dark Theme)
                </h3>
                <p className="text-[14px] text-[#667085] mb-6">
                  Complete promotional card with countdown timer and circular price badge
                </p>
                <div className="w-full flex justify-center">
                  <HorizontalCardLarge
                    variant="dark"
                    title='Xiaomi Mi 11 Ultra 12GB+256GB'
                    description="*Data provided by internal laboratories. Industry measurement."
                    price="₦299,000"
                    countdownTarget={new Date(Date.now() + 16 * 24 * 60 * 60 * 1000 + 21 * 60 * 60 * 1000 + 57 * 60 * 1000 + 23 * 1000)}
                    buttonText="Shop now"
                    onButtonClick={() => addNotification("Shop now clicked! 💻")}
                    onDotClick={(index: number) => addNotification(`Navigated to slide ${index + 1} 📍`)}
                  />
                </div>
              </div>

              {/* Light Theme */}
              <div className="bg-white p-6 rounded-lg border border-gray-200">
                <h3 className="font-['General_Sans:Semibold',sans-serif] text-[16px] text-[#1D2939] mb-4">
                  Figma Design (Light Theme)
                </h3>
                <p className="text-[14px] text-[#667085] mb-6">
                  Same card with light background for alternative design aesthetic
                </p>
                <div className="w-full flex justify-center">
                  <HorizontalCardLarge
                    variant="light"
                    title='Xiaomi Mi 11 Ultra 12GB+256GB'
                    description="*Data provided by internal laboratories. Industry measurement."
                    price="₦299,000"
                    countdownTarget={new Date(Date.now() + 16 * 24 * 60 * 60 * 1000 + 21 * 60 * 60 * 1000 + 57 * 60 * 1000 + 23 * 1000)}
                    buttonText="Shop now"
                    onButtonClick={() => addNotification("Shop now clicked (Light)! 💡")}
                    onDotClick={(index: number) => addNotification(`Navigated to slide ${index + 1} 📍`)}
                  />
                </div>
              </div>

              {/* Without Countdown */}
              <div className="bg-white p-6 rounded-lg border border-gray-200">
                <h3 className="font-['General_Sans:Semibold',sans-serif] text-[16px] text-[#1D2939] mb-4">
                  Without Countdown Timer
                </h3>
                <p className="text-[14px] text-[#667085] mb-6">
                  Omit the countdown for products without time-sensitive offers
                </p>
                <div className="w-full flex justify-center">
                  <HorizontalCardLarge
                    title="iPhone 15 Pro Max"
                    description="The most advanced iPhone ever with A17 Pro chip and titanium design."
                    price="₦450,000"
                    priceTopText="Only"
                    priceBottomText="Now!"
                    buttonText="Shop Now"
                    onButtonClick={() => addNotification("Shop Now clicked! 📱")}
                  />
                </div>
              </div>

              {/* Custom Theme */}
              <div className="bg-white p-6 rounded-lg border border-gray-200">
                <h3 className="font-['General_Sans:Semibold',sans-serif] text-[16px] text-[#1D2939] mb-4">
                  Custom Color Theme
                </h3>
                <p className="text-[14px] text-[#667085] mb-6">
                  Fully customizable colors for different branding and seasonal campaigns
                </p>
                <div className="w-full flex justify-center">
                  <HorizontalCardLarge
                    title="Gaming Console Bundle"
                    description="Ultimate gaming experience with the latest console and 3 AAA games included."
                    price="$599"
                    priceTopText="Just"
                    priceBottomText="Today!"
                    countdownTarget={new Date(Date.now() + 5 * 24 * 60 * 60 * 1000)}
                    buttonText="Grab Deal"
                    backgroundColor="#1E3A8A"
                    titleColor="#FFFFFF"
                    descriptionColor="#BFDBFE"
                    activeDotColor="#60A5FA"
                    inactiveDotColor="#1E40AF"
                    onButtonClick={() => addNotification("Grab Deal clicked! 🎮")}
                  />
                </div>
              </div>

              {/* Usage Examples */}
              <div className="bg-blue-50 p-6 rounded-lg border border-blue-200">
                <h3 className="font-['General_Sans:Semibold',sans-serif] text-[16px] text-[#1D2939] mb-3">
                  💡 Horizontal Card Large Features
                </h3>
                <ul className="text-[14px] text-[#667085] space-y-2 list-disc list-inside">
                  <li>Large format: 648px × 336px with premium layout</li>
                  <li>Two theme variants: dark (default) and light</li>
                  <li>Title and description for detailed product info</li>
                  <li>Optional countdown timer for flash sales</li>
                  <li>Circular price badge with heartbeat animation</li>
                  <li>Action button with chevron icon</li>
                  <li>Carousel dots for multi-product slideshows</li>
                  <li>Fully customizable colors and text</li>
                  <li>Perfect for homepage heroes, product launches, and major promotions</li>
                </ul>
              </div>
            </div>
          </div>
          )}

          {/* Category Cards Demo */}
          {(activeTab === "all" || activeTab === "cards") && (
          <div className="w-full border border-gray-200 rounded-xl p-8 bg-gray-50">
            <h2 className="font-['General_Sans:Semibold',sans-serif] text-[#054f31] text-[20px] leading-[28px] mb-6">
              Category Card Components
            </h2>
            <p className="font-['General_Sans:Regular',sans-serif] text-[#667085] text-[16px] leading-[24px] mb-8">
              Simple category cards with icons and labels. Hover to see the background change from white to gray!
            </p>
            
            <div className="flex flex-col gap-8">
              {/* Basic Examples */}
              <div className="bg-white p-6 rounded-lg border border-gray-200">
                <h3 className="font-['General_Sans:Semibold',sans-serif] text-[16px] text-[#1D2939] mb-4">
                  Figma Design (Default & Hover States)
                </h3>
                <p className="text-[14px] text-[#667085] mb-6">
                  Hover over any card to see it change from white to gray background (#F2F4F7)
                </p>
                <div className="flex flex-wrap gap-6 justify-center">
                  <CategoryCard
                    icon="🥩"
                    label="Meat, Fish & Poultry"
                    onClick={() => addNotification("Meat, Fish & Poultry clicked! 🥩")}
                  />
                  <CategoryCard
                    icon="🥬"
                    label="Vegetables & Fruits"
                    onClick={() => addNotification("Vegetables & Fruits clicked! 🥬")}
                  />
                  <CategoryCard
                    icon="🥖"
                    label="Bakery & Bread"
                    onClick={() => addNotification("Bakery & Bread clicked! 🥖")}
                  />
                </div>
              </div>

              {/* More Categories */}
              <div className="bg-white p-6 rounded-lg border border-gray-200">
                <h3 className="font-['General_Sans:Semibold',sans-serif] text-[16px] text-[#1D2939] mb-4">
                  Additional Category Examples
                </h3>
                <div className="flex flex-wrap gap-6 justify-center">
                  <CategoryCard
                    icon="🧀"
                    label="Dairy Products"
                    onClick={() => addNotification("Dairy Products clicked! 🧀")}
                  />
                  <CategoryCard
                    icon="🍫"
                    label="Snacks & Candy"
                    onClick={() => addNotification("Snacks & Candy clicked! 🍫")}
                  />
                  <CategoryCard
                    icon="🍷"
                    label="Beverages"
                    onClick={() => addNotification("Beverages clicked! 🍷")}
                  />
                  <CategoryCard
                    icon="🥫"
                    label="Canned Goods"
                    onClick={() => addNotification("Canned Goods clicked! 🥫")}
                  />
                  <CategoryCard
                    icon="🧊"
                    label="Frozen Foods"
                    onClick={() => addNotification("Frozen Foods clicked! 🧊")}
                  />
                  <CategoryCard
                    icon="🧴"
                    label="Personal Care"
                    onClick={() => addNotification("Personal Care clicked! 🧴")}
                  />
                </div>
              </div>

              {/* Usage Examples */}
              <div className="bg-blue-50 p-6 rounded-lg border border-blue-200">
                <h3 className="font-['General_Sans:Semibold',sans-serif] text-[16px] text-[#1D2939] mb-3">
                  💡 Category Card Features
                </h3>
                <ul className="text-[14px] text-[#667085] space-y-2 list-disc list-inside">
                  <li>Smooth hover state transition from white to gray background</li>
                  <li>Supports both emoji icons and image URLs</li>
                  <li>Clickable with onClick callback for navigation</li>
                  <li>Perfect for category selection, department navigation, or product filters</li>
                  <li>Clean, minimal design with consistent sizing (205x176px)</li>
                  <li>Rounded corners and subtle borders for modern look</li>
                </ul>
              </div>
            </div>
          </div>
          )}

          {/* Aside Banner Components */}
          {(activeTab === "all" || activeTab === "banners") && (
          <div className="w-full border border-gray-200 rounded-xl p-8 bg-gray-50">
            <h2 className="font-['General_Sans:Semibold',sans-serif] text-[#054f31] text-[20px] leading-[28px] mb-6">
              Aside Banner Components
            </h2>
            <p className="font-['General_Sans:Regular',sans-serif] text-[#667085] text-[16px] leading-[24px] mb-8">
              Vertical sidebar banners in three sizes - perfect for promotional content, featured products, and category deals.
            </p>
            
            <div className="flex flex-col gap-8">
              {/* AsideBannerSmall */}
              <div className="bg-white p-6 rounded-lg border border-gray-200">
                <h3 className="font-['General_Sans:Semibold',sans-serif] text-[16px] text-[#1D2939] mb-4">
                  Aside Banner Small
                </h3>
                <p className="text-[14px] text-[#667085] mb-6">
                  Compact banner with countdown timer and highlighted text. Perfect for quick promotions.
                </p>
                <div className="w-full flex justify-center">
                  <AsideBannerSmall
                    title="37% DISCOUNT"
                    description="only for SmartPhone product."
                    highlightWord="SmartPhone"
                    countdownTarget={new Date(Date.now() + 16 * 24 * 60 * 60 * 1000 + 21 * 60 * 60 * 1000 + 57 * 60 * 1000 + 23 * 1000)}
                    buttonText="Shop now"
                    onButtonClick={() => addNotification("Shop now clicked! 📱")}
                  />
                </div>
              </div>

              {/* AsideBannerSmall Dark Mode */}
              <div className="bg-white p-6 rounded-lg border border-gray-200">
                <h3 className="font-['General_Sans:Semibold',sans-serif] text-[16px] text-[#1D2939] mb-4">
                  Aside Banner Small (Dark Mode)
                </h3>
                <p className="text-[14px] text-[#667085] mb-6">
                  Dark theme with white text and yellow highlighted word.
                </p>
                <div className="w-full flex justify-center">
                  <AsideBannerSmall
                    title="37% DISCOUNT"
                    description="only for SmartPhone product."
                    highlightWord="SmartPhone"
                    countdownTarget={new Date(Date.now() + 16 * 24 * 60 * 60 * 1000 + 21 * 60 * 60 * 1000 + 57 * 60 * 1000 + 23 * 1000)}
                    buttonText="Shop now"
                    darkMode={true}
                    onButtonClick={() => addNotification("Shop now clicked! 📱 (Dark Mode)")}
                  />
                </div>
              </div>

              {/* AsideBannerMedium */}
              <div className="bg-white p-6 rounded-lg border border-gray-200">
                <h3 className="font-['General_Sans:Semibold',sans-serif] text-[16px] text-[#1D2939] mb-4">
                  Aside Banner Medium
                </h3>
                <p className="text-[14px] text-[#667085] mb-6">
                  Product-focused banner with image, price badge, and carousel navigation.
                </p>
                <div className="w-full flex justify-center">
                  <AsideBannerMedium
                    title="Xiaomi True Wireless Earbuds"
                    description="Escape the noise, It's time to hear the magic with Xiaomi Earbuds."
                    price="$299 USD"
                    priceLabel="Only for:"
                    buttonText="Shop now"
                    totalDots={3}
                    activeDotIndex={0}
                    showShadow={false}
                    onButtonClick={() => addNotification("Shop now clicked! 🎧")}
                    onDotClick={(index: number) => addNotification(`Navigated to slide ${index + 1} 📍`)}
                  />
                </div>
              </div>

              {/* AsideBannerMedium Dark Mode */}
              <div className="bg-white p-6 rounded-lg border border-gray-200">
                <h3 className="font-['General_Sans:Semibold',sans-serif] text-[16px] text-[#1D2939] mb-4">
                  Aside Banner Medium (Dark Mode)
                </h3>
                <p className="text-[14px] text-[#667085] mb-6">
                  Dark green background with white title and dark price badge.
                </p>
                <div className="w-full flex justify-center">
                  <AsideBannerMedium
                    title="Xiaomi True Wireless Earbuds"
                    description="Escape the noise, It's time to hear the magic with Xiaomi Earbuds."
                    price="$299 USD"
                    priceLabel="Only for:"
                    buttonText="Shop now"
                    totalDots={3}
                    activeDotIndex={0}
                    showShadow={false}
                    darkMode={true}
                    onButtonClick={() => addNotification("Shop now clicked! 🎧 (Dark Mode)")}
                    onDotClick={(index: number) => addNotification(`Navigated to slide ${index + 1} 📍`)}
                  />
                </div>
              </div>

              {/* AsideBannerLong */}
              <div className="bg-white p-6 rounded-lg border border-gray-200">
                <h3 className="font-['General_Sans:Semibold',sans-serif] text-[16px] text-[#1D2939] mb-4">
                  Aside Banner Long
                </h3>
                <p className="text-[14px] text-[#667085] mb-6">
                  Tall banner with category label, countdown, and large product image at bottom.
                </p>
                <div className="w-full flex justify-center">
                  <AsideBannerLong
                    category="COMPUTER & ACCESSORIES"
                    title="32% Discount"
                    description="For all ellectronics products"
                    countdownLabel="Deals ends in"
                    countdownTarget={new Date(Date.now() + 16 * 24 * 60 * 60 * 1000 + 21 * 60 * 60 * 1000 + 57 * 60 * 1000 + 23 * 1000)}
                    buttonText="Shop now"
                    onButtonClick={() => addNotification("Shop now clicked! 💻")}
                  />
                </div>
              </div>

              {/* AsideBannerLong Dark Mode */}
              <div className="bg-white p-6 rounded-lg border border-gray-200">
                <h3 className="font-['General_Sans:Semibold',sans-serif] text-[16px] text-[#1D2939] mb-4">
                  Aside Banner Long (Dark Mode)
                </h3>
                <p className="text-[14px] text-[#667085] mb-6">
                  Dark theme with orange category, white title, and light gray description.
                </p>
                <div className="w-full flex justify-center">
                  <AsideBannerLong
                    category="COMPUTER & ACCESSORIES"
                    title="32% Discount"
                    description="For all ellectronics products"
                    countdownLabel="Deals ends in"
                    countdownTarget={new Date(Date.now() + 16 * 24 * 60 * 60 * 1000 + 21 * 60 * 60 * 1000 + 57 * 60 * 1000 + 23 * 1000)}
                    buttonText="Shop now"
                    darkMode={true}
                    onButtonClick={() => addNotification("Shop now clicked! 💻 (Dark Mode)")}
                  />
                </div>
              </div>

              {/* Usage Examples */}
              <div className="bg-blue-50 p-6 rounded-lg border border-blue-200">
                <h3 className="font-['General_Sans:Semibold',sans-serif] text-[16px] text-[#1D2939] mb-3">
                  💡 Aside Banner Features
                </h3>
                <ul className="text-[14px] text-[#667085] space-y-2 list-disc list-inside">
                  <li><strong>Small (312px width):</strong> Countdown timer, highlighted text, green button</li>
                  <li><strong>Medium (312px width):</strong> Product image, price badge, carousel dots, perfect for product features</li>
                  <li><strong>Long (312px width, tall height):</strong> Category label, countdown, large image section at bottom</li>
                  <li><strong>Dark Mode Support:</strong> All variants support dark mode with darkMode prop</li>
                  <li><strong>showShadow prop:</strong> Medium banner supports optional image shadow</li>
                  <li>All use reusable Countdown and CarouselDots components</li>
                  <li>Fully customizable colors, text, and images</li>
                  <li>Perfect for sidebar promotions and featured deals</li>
                  <li>Consistent green Shop Now button across all variants</li>
                </ul>
              </div>
            </div>
          </div>
          )}

          {/* Pagination Components Demo */}
          {(activeTab === "all" || activeTab === "buttons") && (
          <div className="w-full border border-gray-200 rounded-xl p-8 bg-gray-50">
            <h2 className="font-['General_Sans:Semibold',sans-serif] text-[#054f31] text-[20px] leading-[28px] mb-6">
              Pagination Components
            </h2>
            <p className="font-['General_Sans:Regular',sans-serif] text-[#667085] text-[16px] leading-[24px] mb-8">
              Navigation controls for multi-page content with Previous/Next buttons and smart page numbering. Features active state highlighting and ellipsis for large page counts.
            </p>
            
            <div className="flex flex-col gap-8">
              {/* Default Pagination */}
              <div className="bg-white p-6 rounded-lg border border-gray-200">
                <h3 className="font-['General_Sans:Semibold',sans-serif] text-[16px] text-[#1D2939] mb-4">
                  Default Pagination (Figma Design)
                </h3>
                <p className="text-[14px] text-[#667085] mb-6">
                  Full pagination with Previous/Next buttons and numbered pages. Active page has green background.
                </p>
                <div className="w-full max-w-4xl mx-auto">
                  <Pagination
                    currentPage={paginationPage1}
                    totalPages={10}
                    onPageChange={(page: number) => {
                      setPaginationPage1(page);
                      addNotification(`Navigated to page ${page} 📄`);
                    }}
                  />
                </div>
              </div>

              {/* Simple Pagination (No Previous/Next) */}
              <div className="bg-white p-6 rounded-lg border border-gray-200">
                <h3 className="font-['General_Sans:Semibold',sans-serif] text-[16px] text-[#1D2939] mb-4">
                  Simple Pagination (Numbers Only)
                </h3>
                <p className="text-[14px] text-[#667085] mb-6">
                  Pagination without Previous/Next buttons - just page numbers
                </p>
                <div className="w-full max-w-4xl mx-auto">
                  <SimplePagination
                    currentPage={paginationPage2}
                    totalPages={7}
                    onPageChange={(page: number) => {
                      setPaginationPage2(page);
                      addNotification(`Navigated to page ${page} 📄`);
                    }}
                  />
                </div>
              </div>

              {/* Compact Pagination */}
              <div className="bg-white p-6 rounded-lg border border-gray-200">
                <h3 className="font-['General_Sans:Semibold',sans-serif] text-[16px] text-[#1D2939] mb-4">
                  Compact Pagination (Centered)
                </h3>
                <p className="text-[14px] text-[#667085] mb-6">
                  Centered layout with all elements in a compact row
                </p>
                <div className="w-full max-w-4xl mx-auto">
                  <CompactPagination
                    currentPage={paginationPage3}
                    totalPages={15}
                    onPageChange={(page: number) => {
                      setPaginationPage3(page);
                      addNotification(`Navigated to page ${page} 📄`);
                    }}
                  />
                </div>
              </div>

              {/* Configuration Examples */}
              <div className="bg-white p-6 rounded-lg border border-gray-200">
                <h3 className="font-['General_Sans:Semibold',sans-serif] text-[16px] text-[#1D2939] mb-4">
                  Different Page Counts
                </h3>
                <p className="text-[14px] text-[#667085] mb-6">
                  Pagination adapts intelligently to different total page counts
                </p>
                <div className="flex flex-col gap-6">
                  {/* Few pages */}
                  <div>
                    <p className="text-[12px] text-[#667085] mb-3">3 Pages (shows all numbers)</p>
                    <Pagination
                      currentPage={1}
                      totalPages={3}
                      onPageChange={(page: number) => addNotification(`Page ${page}`)}
                    />
                  </div>
                  
                  {/* Many pages */}
                  <div>
                    <p className="text-[12px] text-[#667085] mb-3">50 Pages (shows ellipsis)</p>
                    <Pagination
                      currentPage={25}
                      totalPages={50}
                      onPageChange={(page: number) => addNotification(`Page ${page}`)}
                    />
                  </div>

                  {/* Many pages at start */}
                  <div>
                    <p className="text-[12px] text-[#667085] mb-3">100 Pages (at page 1)</p>
                    <Pagination
                      currentPage={1}
                      totalPages={100}
                      onPageChange={(page: number) => addNotification(`Page ${page}`)}
                    />
                  </div>

                  {/* Many pages at end */}
                  <div>
                    <p className="text-[12px] text-[#667085] mb-3">100 Pages (at page 100)</p>
                    <Pagination
                      currentPage={100}
                      totalPages={100}
                      onPageChange={(page: number) => addNotification(`Page ${page}`)}
                    />
                  </div>
                </div>
              </div>

              {/* Usage Examples */}
              <div className="bg-blue-50 p-6 rounded-lg border border-blue-200">
                <h3 className="font-['General_Sans:Semibold',sans-serif] text-[16px] text-[#1D2939] mb-3">
                  💡 Pagination Features
                </h3>
                <ul className="text-[14px] text-[#667085] space-y-2 list-disc list-inside">
                  <li><strong>Smart Ellipsis:</strong> Shows ... when there are too many pages to display</li>
                  <li><strong>Active State:</strong> Current page highlighted with green background (#ecfdf3) and green text (#039855)</li>
                  <li><strong>Previous/Next Buttons:</strong> Arrow icons with disabled state when at boundaries</li>
                  <li><strong>Hover Effects:</strong> Smooth transitions on page button hover</li>
                  <li><strong>Accessibility:</strong> Proper ARIA labels and disabled states</li>
                  <li><strong>Responsive:</strong> Adapts to different page counts intelligently</li>
                  <li><strong>Customizable:</strong> Control siblingCount to show more/fewer pages around current</li>
                  <li><strong>Multiple Variants:</strong> Default, Simple (no prev/next), and Compact (centered) layouts</li>
                  <li>Perfect for product listings, search results, blog archives, and data tables</li>
                </ul>
              </div>
            </div>
          </div>
          )}

          {/* Icon Library Section */}
          {(activeTab === "all" || activeTab === "icons") && (
          <div className="w-full border-t-2 border-gray-200 pt-8 mt-8">
            <h2 className="font-['General_Sans:Semibold',sans-serif] text-[#054f31] text-[20px] leading-[28px] mb-6">
              Icon Library - Complete Collection
            </h2>
            <p className="font-['General_Sans:Regular',sans-serif] text-[#667085] text-[16px] leading-[24px] mb-6">
              322+ reusable icon components from your Figma design system
            </p>
            
            {/* All Icons Display */}
            <div className="w-full">
              <BaseIconsComponent />
            </div>
          </div>
          )}
          </div>
          {/* End Content Container */}
        </div>
      </div>

      <style>
        {`
          @keyframes slideIn {
            from {
              transform: translateX(100%);
              opacity: 0;
            }
            to {
              transform: translateX(0);
              opacity: 1;
            }
          }
        `}
      </style>

      {/* Product Detail Modal */}
      <ProductDetailModal
        isOpen={isProductModalOpen}
        onClose={() => setIsProductModalOpen(false)}
        product={selectedProduct}
        onAddToCart={(quantity: number) => {
          addNotification(`Added ${quantity} item(s) to cart! 🛒`);
        }}
        onAddToWishlist={() => {
          addNotification("Added to wishlist! ❤️");
        }}
      />
    </div>
  );
}
