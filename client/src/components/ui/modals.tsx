/**
 * PRODUCT DETAIL MODAL COMPONENT
 * 
 * A comprehensive modal dialog for displaying detailed product information including:
 * - Product image gallery with carousel navigation
 * - Rating, SKU, brand, availability, and category information
 * - Price display with discount badges
 * - Product option selectors (color, size, type, condition)
 * - Quantity controls
 * - Add to cart and wishlist functionality
 * - Social sharing options
 * - Payment methods display
 * 
 * Based on imported Figma ProductDetail design
 */

import { useState, useEffect } from "react";
import { RatingBadge } from "./badge";
import { DropdownInputField, DropdownOption } from "./dropdown";
import svgPaths from "../../imports/svg-3rnsh2it2n";
import img01 from "figma:asset/993680a4fb804721053db577fe1e84c4758c415b.png";
import img05 from "figma:asset/76236df7a5ad3774e8e14a241d83f4af473d2f52.png";
import img03 from "figma:asset/26a18289fe1664427df3d41a562c2d7f8e974028.png";
import img04 from "figma:asset/c9eba5bacad967cc00f3a52861556a8fe08da971.png";
import img02 from "figma:asset/495f2db0dba66b830ccfbc2b70ff68519b13ce45.png";
import img06 from "figma:asset/941971ccb99c4c28190b30a8b0a20273690c21db.png";
import imgPaymentMethod from "figma:asset/da7dfc5d524153edb59f51c68391739d1487b7ca.png";

// ============================================
// TYPES
// ============================================

export interface ProductDetailData {
  id?: string;
  title?: string;
  rating?: number;
  reviewCount?: number;
  sku?: string;
  brand?: string;
  category?: string;
  availability?: "In Stock" | "Out of Stock" | "Pre-Order";
  price?: string;
  originalPrice?: string;
  discount?: string;
  images?: string[];
  colors?: string[];
  sizes?: string[];
  types?: string[];
  conditions?: string[];
}

interface ProductDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  product?: ProductDetailData;
  onAddToCart?: (quantity: number) => void;
  onAddToWishlist?: () => void;
}

// ============================================
// SUB-COMPONENTS
// ============================================

/**
 * Star Rating Component
 */
function Star({ filled = true }: { filled?: boolean }) {
  return (
    <div className="relative shrink-0 size-[16px]" data-name="Star">
      <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 16 16">
        <g>
          <path 
            d={svgPaths.p3da874b0} 
            fill={filled ? "#FA8232" : "white"} 
            stroke={filled ? undefined : "#ADB7BC"}
            strokeLinecap={filled ? undefined : "round"}
            strokeLinejoin={filled ? undefined : "round"}
            strokeWidth={filled ? undefined : "1.5"}
          />
        </g>
      </svg>
    </div>
  );
}

/**
 * Rating Container
 */
function RatingContainer({ rating = 4.7, reviewCount = 816 }: { rating?: number; reviewCount?: number }) {
  const fullStars = Math.floor(rating);
  const hasHalfStar = rating % 1 >= 0.5;
  
  return (
    <div className="bg-[#f2f4f7] content-stretch flex gap-[8px] items-center px-[12px] py-[4px] relative rounded-[16px] shrink-0" data-name="Rating Container">
      <div className="content-stretch flex items-start relative shrink-0">
        {[...Array(5)].map((_, i) => (
          <Star key={i} filled={i < fullStars || (i === fullStars && hasHalfStar)} />
        ))}
      </div>
      <p className="font-['General_Sans:Medium',sans-serif] leading-[20px] not-italic relative shrink-0 text-[#191c1f] text-[14px] text-nowrap">
        {rating} Star Rating
      </p>
      <p className="font-['Public_Sans:Regular',sans-serif] font-normal leading-[16px] relative shrink-0 text-[#77878f] text-[12px] text-nowrap">
        ({reviewCount})
      </p>
    </div>
  );
}

/**
 * Arrow Navigation Buttons
 */
function ArrowButton({ direction, onClick }: { direction: "left" | "right"; onClick?: () => void }) {
  const path = direction === "left" ? svgPaths.pbf7d180 : svgPaths.p39396800;
  
  return (
    <button
      onClick={onClick}
      className="bg-[#039855] content-stretch flex h-[48px] items-center justify-center p-[12px] relative rounded-[100px] shrink-0 w-[48px] hover:bg-[#027a45] transition-colors"
      aria-label={`${direction === "left" ? "Previous" : "Next"} image`}
    >
      <div className="relative shrink-0 size-[24px]">
        <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 24 24">
          <g>
            <path d={path} stroke="white" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
          </g>
        </svg>
      </div>
    </button>
  );
}

/**
 * Product Image Gallery with Thumbnails
 */
function ProductPreview({ images }: { images: string[] }) {
  const [currentIndex, setCurrentIndex] = useState(0);

  const handlePrevious = () => {
    setCurrentIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1));
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1));
  };

  return (
    <div className="content-stretch flex flex-col gap-[24px] items-start relative shrink-0 w-full lg:w-[616px]" data-name="Product Preview">
      {/* Main Image */}
      <div className="h-[464px] pointer-events-none relative rounded-[4px] shrink-0 w-full" data-name="Main Image">
        <div className="absolute inset-0 overflow-hidden rounded-[4px]">
          <img alt="Product" className="absolute inset-0 object-contain w-full h-full p-4" src={images[currentIndex]} />
        </div>
        <div aria-hidden="true" className="absolute border border-[#e4e7e9] border-solid inset-0 rounded-[4px]" />
      </div>
      
      {/* Thumbnails and Navigation */}
      <div className="relative w-full" data-name="Images">
        {/* Thumbnails */}
        <div className="content-stretch flex gap-[8px] items-start w-full overflow-x-auto scrollbar-hide" data-name="Photo">
          {images.map((img, index) => (
            <button
              key={index}
              onClick={() => setCurrentIndex(index)}
              className={`pointer-events-auto relative rounded-[2px] shrink-0 size-[96px] hover:opacity-80 transition-opacity ${
                index === currentIndex ? 'ring-2 ring-[#fa8232]' : 'ring-1 ring-[#e4e7e9]'
              }`}
              data-name={`0${index + 1}`}
            >
              <div className="absolute inset-0 overflow-hidden rounded-[2px]">
                <img alt={`Thumbnail ${index + 1}`} className="absolute inset-0 object-contain w-full h-full p-2" src={img} />
              </div>
            </button>
          ))}
        </div>
        
        {/* Arrow Navigation */}
        <div className="absolute content-stretch flex justify-between items-center left-0 right-0 top-1/2 -translate-y-1/2 pointer-events-none px-[-24px]" data-name="Arrow">
          <div className="pointer-events-auto -ml-6">
            <ArrowButton direction="left" onClick={handlePrevious} />
          </div>
          <div className="pointer-events-auto -mr-6">
            <ArrowButton direction="right" onClick={handleNext} />
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Product Content - Title and Info
 */
function ProductContent({ 
  title, 
  sku, 
  brand, 
  category, 
  availability,
  rating,
  reviewCount 
}: { 
  title?: string;
  sku?: string;
  brand?: string;
  category?: string;
  availability?: string;
  rating?: number;
  reviewCount?: number;
}) {
  return (
    <div className="content-stretch flex flex-col gap-[16px] items-start relative shrink-0 w-full" data-name="Product Content">
      {/* Heading with Rating */}
      <div className="content-stretch flex flex-col gap-[8px] items-start relative shrink-0 w-full">
        <RatingContainer rating={rating} reviewCount={reviewCount} />
        <p className="font-['Public_Sans:Regular',sans-serif] font-normal leading-[28px] relative shrink-0 text-[#191c1f] text-[20px] w-full">
          {title}
        </p>
      </div>
      
      {/* Product Info */}
      <div className="content-stretch flex flex-col gap-[8px] items-start relative shrink-0 w-full" data-name="Fun-Fact">
        <div className="content-stretch flex gap-[24px] items-start relative shrink-0 flex-wrap w-full">
          <p className="leading-[20px] relative shrink-0 text-[14px] flex-1 min-w-[200px]">
            <span className="font-['Public_Sans:Regular',sans-serif] text-[#5f6c72]">Sku: </span>
            <span className="font-['Public_Sans:SemiBold',sans-serif] font-semibold text-[#191c1f]">{sku}</span>
          </p>
          <p className="leading-[20px] relative shrink-0 text-[14px] flex-1 min-w-[200px]">
            <span className="font-['Public_Sans:Regular',sans-serif] font-normal text-[#5f6c72]">Availability: </span>
            <span className={`font-['Public_Sans:SemiBold',sans-serif] font-semibold ${
              availability === "In Stock" ? "text-[#2db224]" : "text-[#f04438]"
            }`}>
              {availability}
            </span>
          </p>
        </div>
        <div className="content-stretch flex gap-[24px] items-start relative shrink-0 flex-wrap w-full">
          <p className="leading-[20px] relative shrink-0 text-[14px] flex-1 min-w-[200px]">
            <span className="font-['Public_Sans:Regular',sans-serif] text-[#5f6c72]">Brand: </span>
            <span className="font-['Public_Sans:SemiBold',sans-serif] font-semibold text-[#191c1f]">{brand}</span>
          </p>
          <p className="leading-[20px] relative shrink-0 text-[14px] flex-1 min-w-[200px]">
            <span className="font-['Public_Sans:Regular',sans-serif] font-normal text-[#5f6c72]">Category: </span>
            <span className="font-['Public_Sans:SemiBold',sans-serif] font-semibold text-[#191c1f]">{category}</span>
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * Price Display with Discount Badge
 */
function Prices({ price, originalPrice, discount }: { price?: string; originalPrice?: string; discount?: string }) {
  return (
    <div className="content-stretch flex gap-[12px] items-center justify-center relative shrink-0 flex-wrap" data-name="Prices">
      <div className="content-stretch flex gap-[4px] items-center relative shrink-0 text-nowrap">
        <p className="font-['Public_Sans:SemiBold',sans-serif] font-semibold leading-[32px] relative shrink-0 text-[#039855] text-[24px]">
          {price}
        </p>
        {originalPrice && (
          <p className="[text-decoration-skip-ink:none] [text-underline-position:from-font] decoration-solid font-['Public_Sans:Regular',sans-serif] font-normal leading-[24px] line-through relative shrink-0 text-[#77878f] text-[18px]">
            {originalPrice}
          </p>
        )}
      </div>
      {discount && (
        <div className="bg-[#efd33d] content-stretch flex items-start px-[10px] py-[5px] relative rounded-[2px] shrink-0">
          <p className="font-['Public_Sans:SemiBold',sans-serif] font-semibold leading-[16px] relative shrink-0 text-[#191c1f] text-[12px] text-nowrap">
            {discount}
          </p>
        </div>
      )}
    </div>
  );
}

/**
 * Color Selector
 */
function ColorSelector({ colors = ["#B1B5B8", "#E0E1E1"] }: { colors?: string[] }) {
  const [selectedColor, setSelectedColor] = useState(0);

  return (
    <div className="w-full sm:w-auto sm:min-w-[120px] md:min-w-[150px] h-[72px] relative shrink-0" data-name="Color">
      <p className="absolute font-['Public_Sans:Regular',sans-serif] font-normal leading-[20px] left-0 text-[#191c1f] text-[14px] top-0">
        Color
      </p>
      <div className="absolute content-stretch flex gap-[8px] sm:gap-[12px] items-start left-0 top-[28px]">
        {colors.map((color, index) => (
          <button
            key={index}
            onClick={() => setSelectedColor(index)}
            className={`relative shrink-0 size-[36px] sm:size-[40px] md:size-[44px] rounded-full transition-all hover:scale-105 ${
              selectedColor === index ? 'ring-2 ring-[#FA8232] ring-offset-0' : ''
            }`}
          >
            <div className="size-full rounded-full bg-white flex items-center justify-center">
              <div 
                className="size-[28px] sm:size-[30px] md:size-[32px] rounded-full shadow-inner" 
                style={{ backgroundColor: color }}
              />
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * Product Options Form
 */
function Form({ colors, sizes, types, conditions }: { colors?: string[]; sizes?: string[]; types?: string[]; conditions?: string[] }) {
  const [selectedSize, setSelectedSize] = useState(sizes?.[0] || "Large");
  const [selectedType, setSelectedType] = useState(types?.[0] || "Lagos, Nigeria");
  const [selectedCondition, setSelectedCondition] = useState(conditions?.[0] || "Fresh");

  const sizeOptions: DropdownOption[] = (sizes || ["Large"]).map(size => ({ 
    value: size, 
    label: size 
  }));
  
  const typeOptions: DropdownOption[] = (types || ["Lagos, Nigeria"]).map(type => ({ 
    value: type, 
    label: type 
  }));
  
  const conditionOptions: DropdownOption[] = (conditions || ["Fresh"]).map(condition => ({ 
    value: condition, 
    label: condition 
  }));

  return (
    <div className="content-stretch flex flex-col gap-[12px] sm:gap-[16px] items-start relative shrink-0 w-full" data-name="Form">
      {/* Row 1: Color and Size */}
      <div className="content-stretch flex gap-[12px] sm:gap-[16px] items-end relative shrink-0 w-full flex-wrap" data-name="Row">
        <ColorSelector colors={colors} />
        <div className="w-full sm:flex-1 sm:min-w-[130px] md:min-w-[150px]">
          <DropdownInputField 
            label="Size" 
            value={selectedSize}
            options={sizeOptions}
            onChange={(value) => setSelectedSize(value)}
          />
        </div>
      </div>
      
      {/* Row 2: Condition and Type */}
      <div className="content-stretch flex gap-[12px] sm:gap-[16px] items-end relative shrink-0 w-full flex-wrap" data-name="Row">
        <div className="w-full sm:flex-1 sm:min-w-[130px] md:min-w-[150px]">
          <DropdownInputField 
            label="Condition" 
            value={selectedCondition}
            options={conditionOptions}
            onChange={(value) => setSelectedCondition(value)}
          />
        </div>
        <div className="w-full sm:flex-1 sm:min-w-[130px] md:min-w-[150px]">
          <DropdownInputField 
            label="Type" 
            value={selectedType}
            options={typeOptions}
            onChange={(value) => setSelectedType(value)}
          />
        </div>
      </div>
    </div>
  );
}

/**
 * Quantity Counter
 */
function Counter({ 
  quantity, 
  onIncrement, 
  onDecrement 
}: { 
  quantity: number; 
  onIncrement: () => void; 
  onDecrement: () => void;
}) {
  return (
    <div className="content-stretch flex gap-[8px] items-center relative shrink-0" data-name="Counter">
      {/* Minus Button */}
      <button
        onClick={onDecrement}
        disabled={quantity <= 1}
        className="bg-white relative rounded-[8px] shrink-0 hover:bg-gray-50 active:scale-95 disabled:opacity-30 transition-all"
      >
        <div className="content-stretch flex items-center justify-center overflow-clip p-[10px] relative rounded-[inherit]">
          <div className="relative shrink-0 size-[20px]">
            <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 20 20">
              <g>
                <path d="M4.16667 10H15.8333" stroke="#039855" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.67" />
              </g>
            </svg>
          </div>
        </div>
        <div aria-hidden="true" className="absolute border border-[#d0d5dd] border-solid inset-0 pointer-events-none rounded-[8px] shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]" />
      </button>
      
      {/* Quantity Display */}
      <div className="basis-0 bg-[#f2f4f7] grow min-h-px min-w-px relative rounded-[8px] shrink-0 w-full max-w-[136px]">
        <div aria-hidden="true" className="absolute border border-[#f2f4f7] border-solid inset-0 pointer-events-none rounded-[8px] shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]" />
        <div className="flex flex-row items-center size-full">
          <div className="content-stretch flex items-center px-[12px] py-[6px] relative size-full">
            <div className="basis-0 content-stretch flex gap-[8px] grow items-center min-h-px min-w-px relative shrink-0">
              <p className="basis-0 font-['General_Sans:Medium',sans-serif] grow leading-[20px] min-h-px min-w-px not-italic relative shrink-0 text-[#1d2939] text-[14px] text-center">
                {quantity}
              </p>
            </div>
          </div>
        </div>
      </div>
      
      {/* Plus Button */}
      <button
        onClick={onIncrement}
        className="bg-white relative rounded-[8px] shrink-0 hover:bg-gray-50 active:scale-95 transition-all"
      >
        <div className="content-stretch flex items-center justify-center overflow-clip p-[10px] relative rounded-[inherit]">
          <div className="relative shrink-0 size-[20px]">
            <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 20 20">
              <g>
                <path d={svgPaths.p17eb400} stroke="#039855" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.67" />
              </g>
            </svg>
          </div>
        </div>
        <div aria-hidden="true" className="absolute border border-[#d0d5dd] border-solid inset-0 pointer-events-none rounded-[8px] shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]" />
      </button>
    </div>
  );
}

/**
 * Action Buttons Row
 */
function ActionButtons({ 
  quantity, 
  onIncrement,
  onDecrement,
  onAddToCart
}: { 
  quantity: number;
  onIncrement: () => void;
  onDecrement: () => void;
  onAddToCart?: () => void;
}) {
  return (
    <div className="content-stretch flex gap-[12px] items-center relative shrink-0 w-full flex-wrap" data-name="Actions">
      {/* Counter */}
      <Counter 
        quantity={quantity} 
        onIncrement={onIncrement}
        onDecrement={onDecrement}
      />
      
      {/* Checkout Button */}
      <button
        onClick={onAddToCart}
        className="basis-0 bg-[#039855] grow min-h-px min-w-px relative rounded-[8px] shrink-0 hover:bg-[#027a45] active:scale-[0.98] transition-all min-w-[200px]"
      >
        <div className="flex flex-row items-center justify-center overflow-clip rounded-[inherit] size-full">
          <div className="content-stretch flex gap-[8px] items-center justify-center px-[16px] py-[10px] relative w-full">
            <p className="font-['General_Sans:Semibold',sans-serif] leading-[20px] not-italic relative shrink-0 text-[14px] text-nowrap text-white">
              Check out now
            </p>
            <div className="relative shrink-0 size-[20px]">
              <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 20 20">
                <g>
                  <path d={svgPaths.p3b6ad300} stroke="white" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.67" />
                </g>
              </svg>
            </div>
          </div>
        </div>
        <div aria-hidden="true" className="absolute border border-[#039855] border-solid inset-0 pointer-events-none rounded-[8px] shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]" />
      </button>
      
      {/* View Cart Button */}
      <button
        className="basis-0 bg-white grow min-h-px min-w-px relative rounded-[8px] shrink-0 hover:bg-gray-50 active:scale-[0.98] transition-all min-w-[150px]"
      >
        <div className="flex flex-row items-center justify-center overflow-clip rounded-[inherit] size-full">
          <div className="content-stretch flex gap-[8px] items-center justify-center px-[16px] py-[10px] relative w-full">
            <div className="relative shrink-0 size-[20px]">
              <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 20 20">
                <g clipPath="url(#clip0_cart)">
                  <path d={svgPaths.p74b6e00} stroke="#039855" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.67" />
                </g>
                <defs>
                  <clipPath id="clip0_cart">
                    <rect fill="white" height="20" width="20" />
                  </clipPath>
                </defs>
              </svg>
            </div>
            <p className="font-['General_Sans:Semibold',sans-serif] leading-[20px] not-italic relative shrink-0 text-[#039855] text-[14px] text-nowrap">
              View Cart
            </p>
          </div>
        </div>
        <div aria-hidden="true" className="absolute border border-[#d0d5dd] border-solid inset-0 pointer-events-none rounded-[8px] shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]" />
      </button>
    </div>
  );
}

/**
 * Wishlist and Share Section
 */
function WishlistShare({ onAddToWishlist }: { onAddToWishlist?: () => void }) {
  return (
    <div className="content-stretch flex gap-[24px] items-center relative shrink-0 w-full flex-wrap justify-between">
      {/* Add to Wishlist */}
      <button
        onClick={onAddToWishlist}
        className="content-stretch flex gap-[8px] items-center justify-center relative shrink-0 hover:opacity-80 transition-opacity"
      >
        <div className="relative shrink-0 size-[20px]">
          <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 20 20">
            <g>
              <path 
                d={svgPaths.p3e866700} 
                stroke="#5F6C72" 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth="1.5" 
              />
            </g>
          </svg>
        </div>
        <p className="font-['Public_Sans:Regular',sans-serif] font-normal leading-[20px] relative shrink-0 text-[#5f6c72] text-[14px] text-nowrap">
          Add to Wishlist
        </p>
      </button>
      
      {/* Share Product */}
      <div className="content-stretch flex gap-[12px] items-center relative shrink-0">
        <p className="font-['Public_Sans:Regular',sans-serif] font-normal leading-[20px] relative shrink-0 text-[#191c1f] text-[14px] text-nowrap">
          Share product:
        </p>
        <div className="content-stretch flex gap-[8px] items-start relative shrink-0">
          {/* Copy Link */}
          <button className="relative shrink-0 size-[32px] hover:opacity-80 transition-opacity">
            <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 32 32">
              <rect fill="white" height="32" rx="16" width="32" />
              <rect height="31" rx="15.5" stroke="#E4E7E9" width="31" x="0.5" y="0.5" />
              <g>
                <path d={svgPaths.p310def80} stroke="#191C1F" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.25" />
                <path d={svgPaths.p21ef4800} stroke="#191C1F" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.25" />
              </g>
            </svg>
          </button>
          
          {/* Facebook */}
          <button className="relative shrink-0 size-[32px] hover:opacity-80 transition-opacity">
            <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 32 32">
              <rect fill="white" height="32" rx="16" width="32" />
              <rect height="31" rx="15.5" stroke="#E4E7E9" width="31" x="0.5" y="0.5" />
              <path d={svgPaths.p167d1b80} fill="#4267B2" />
            </svg>
          </button>
          
          {/* Twitter */}
          <button className="relative shrink-0 size-[32px] hover:opacity-80 transition-opacity">
            <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 32 32">
              <rect fill="white" height="32" rx="16" width="32" />
              <rect height="31" rx="15.5" stroke="#E4E7E9" width="31" x="0.5" y="0.5" />
              <path d={svgPaths.p2b76b4db} fill="#03A9F4" />
            </svg>
          </button>
          
          {/* Pinterest */}
          <button className="relative shrink-0 size-[32px] hover:opacity-80 transition-opacity">
            <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 32 32">
              <rect fill="white" height="32" rx="16" width="32" />
              <rect height="31" rx="15.5" stroke="#E4E7E9" width="31" x="0.5" y="0.5" />
              <path d={svgPaths.p266a8200} fill="#E60023" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Payment Methods Display
 */
function PaymentMethods() {
  return (
    <div className="content-stretch flex gap-[12px] items-center relative shrink-0 flex-wrap">
      <p className="font-['Public_Sans:Regular',sans-serif] font-normal leading-[20px] relative shrink-0 text-[#191c1f] text-[14px] text-nowrap">
        100% Guarantee Safe Checkout
      </p>
      <div className="h-[14px] relative shrink-0 w-[288px]">
        <img alt="Payment methods" className="absolute inset-0 object-contain" src={imgPaymentMethod} />
      </div>
    </div>
  );
}

// ============================================
// MAIN MODAL COMPONENT
// ============================================

export default function ProductDetailModal({
  isOpen,
  onClose,
  product = {
    title: "2020 Apple MacBook Pro with Apple M1 Chip (13-inch, 8GB RAM, 256GB SSD Storage) - Space Gray",
    rating: 4.7,
    reviewCount: 816,
    sku: "A264671",
    brand: "Apple",
    category: "Electronics Devices",
    availability: "In Stock",
    price: "₦1,300,000",
    originalPrice: "₦1,540,000.00",
    discount: "19% OFF",
    images: [img01, img05, img03, img04, img02, img06],
    colors: ["#B1B5B8", "#E0E1E1"],
    sizes: ["Large"],
    types: ["Lagos, Nigeria"],
    conditions: ["Fresh"]
  },
  onAddToCart,
  onAddToWishlist
}: ProductDetailModalProps) {
  const [quantity, setQuantity] = useState(1);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  // Close on Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleAddToCart = () => {
    onAddToCart?.(quantity);
    onClose();
  };

  const handleIncrement = () => {
    setQuantity((prev) => prev + 1);
  };

  const handleDecrement = () => {
    if (quantity > 1) {
      setQuantity((prev) => prev - 1);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-2 sm:p-4 md:p-6" data-name="Product Detail Modal">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />
      
      {/* Modal Content */}
      <div className="relative bg-white rounded-[16px] shadow-2xl w-full h-full max-h-[98vh] overflow-y-auto">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 z-10 p-2 rounded-full hover:bg-gray-100 transition-colors"
          aria-label="Close modal"
        >
          <svg className="size-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 md:p-8 lg:p-10">
          <div className="content-stretch flex gap-[24px] md:gap-[48px] items-start relative w-full flex-col lg:flex-row">
            {/* Product Preview */}
            <ProductPreview images={product.images || [img01, img05, img03, img04, img02, img06]} />
            
            {/* Product Details */}
            <div className="content-stretch flex flex-col gap-[16px] md:gap-[24px] items-start relative shrink-0 w-full lg:flex-1">
              {/* Product Info */}
              <ProductContent
                title={product.title}
                sku={product.sku}
                brand={product.brand}
                category={product.category}
                availability={product.availability}
                rating={product.rating}
                reviewCount={product.reviewCount}
              />
              
              {/* Prices */}
              <Prices 
                price={product.price} 
                originalPrice={product.originalPrice}
                discount={product.discount}
              />
              
              {/* Options Form */}
              <Form 
                colors={product.colors}
                sizes={product.sizes}
                types={product.types}
                conditions={product.conditions}
              />
              
              {/* Actions */}
              <ActionButtons 
                quantity={quantity}
                onIncrement={handleIncrement}
                onDecrement={handleDecrement}
                onAddToCart={handleAddToCart}
              />
              
              {/* Wishlist & Share */}
              <WishlistShare onAddToWishlist={onAddToWishlist} />
              
              {/* Payment Methods */}
              <PaymentMethods />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}