import { FC } from "react";
import { Heart, ShoppingCart, Eye, Minus, Plus } from "lucide-react";

export type CardBadge = {
  text: string;
  variant?: string;
  backgroundColor?: string;
  textColor?: string;
};

/* ───────────────── Horizontal Card (Banner Card) ───────────────── */

export type HorizontalCardProps = {
  title?: string;
  image?: string;
  buttonText?: string;
  variant?: "dark" | "light";
  badge?: { text: string; color?: string };
  discount?: string;
  discountColor?: string;
  showCarouselDots?: boolean;
  activeCarouselDot?: number;
  onButtonClick?: () => void;
  description?: string;
  price?: string;
  priceTopText?: string;
  priceBottomText?: string;
  leftBadge?: any;
  rightBadge?: any;
  onDotClick?: (index: number) => void;
  totalDots?: number;
  activeDotIndex?: number;
  countdownTarget?: Date;
  backgroundColor?: string;
  titleColor?: string;
  descriptionColor?: string;
  activeDotColor?: string;
  inactiveDotColor?: string;
};

export const HorizontalCard: FC<HorizontalCardProps> = ({
  title,
  image,
  buttonText,
  variant = "dark",
  badge,
  discount,
  discountColor,
  showCarouselDots,
  activeCarouselDot,
  onButtonClick,
}) => {
  const isDark = variant === "dark";
  return (
    <div
      className={`relative rounded-[16px] overflow-hidden h-full min-h-[220px] flex flex-col justify-between p-5 ${
        isDark ? "bg-[#1b2430]" : "bg-white border border-[#e4e7e9]"
      }`}
    >
      {/* Badges row */}
      <div className="flex items-start justify-between gap-2 relative z-10">
        {badge && (
          <span className="inline-block px-2.5 py-1 rounded text-[11px] font-bold uppercase tracking-wide text-white"
            style={{ backgroundColor: badge.color === "red" ? "#ee5858" : (badge.color ?? "#039855") }}
          >
            {badge.text}
          </span>
        )}
        {discount && (
          <span className="inline-block px-2.5 py-1 rounded text-[11px] font-bold uppercase tracking-wide"
            style={{
              backgroundColor: discountColor === "yellow" ? "#ffd44f" : "#ecfdf3",
              color: discountColor === "yellow" ? "#191c1f" : "#039855",
            }}
          >
            {discount}
          </span>
        )}
      </div>

      {/* Image */}
      {image && (
        <div className="flex justify-center my-3">
          <img src={image} alt={title} className="h-[100px] w-auto object-contain" />
        </div>
      )}

      {/* Content */}
      <div className="relative z-10 mt-auto">
        <h3 className={`text-[16px] font-semibold leading-tight mb-2 ${isDark ? "text-white" : "text-[#191c1f]"}`}>
          {title}
        </h3>
        <button
          onClick={onButtonClick}
          className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-[13px] font-semibold transition-colors ${
            isDark
              ? "border border-white/60 text-white hover:bg-white/10"
              : "bg-[#039855] text-white hover:bg-[#027a45]"
          }`}
        >
          {buttonText || "Learn more"}
          <span className="text-[11px]">›</span>
        </button>
        {showCarouselDots && (
          <div className="flex gap-1.5 mt-3">
            {[0, 1, 2].map((dot) => (
              <span
                key={dot}
                className={`h-[7px] rounded-full transition-all ${
                  activeCarouselDot === dot
                    ? `w-[7px] ${isDark ? "bg-[#039855]" : "bg-[#191c1f]"}`
                    : `w-[7px] ${isDark ? "bg-white/30" : "bg-[#d1d5db]"}`
                }`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

/* ───────────────── Category Card ───────────────── */

export type CategoryCardProps = {
  icon?: string;
  image?: string;
  label?: string;
  isSelected?: boolean;
  onClick?: () => void;
};

export const CategoryCard: FC<CategoryCardProps> = ({ icon, image, label, isSelected, onClick }) => (
  <button
    onClick={onClick}
    className={`flex flex-col items-center gap-2 shrink-0 group transition-all ${
      isSelected ? "scale-[1.02]" : ""
    }`}
    style={{ width: 130 }}
  >
    <div
      className={`w-[80px] h-[80px] rounded-full flex items-center justify-center overflow-hidden transition-all ${
        isSelected
          ? "ring-2 ring-[#039855] ring-offset-2 bg-[#ecfdf3]"
          : "bg-[#f2f4f7] group-hover:bg-[#ecfdf3]"
      }`}
    >
      {image ? (
        <img src={image} alt={label} className="w-full h-full object-cover rounded-full" />
      ) : (
        <span className="text-[36px] leading-none">{icon || "🛍️"}</span>
      )}
    </div>
    <span
      className={`text-[12px] font-medium text-center leading-tight max-w-[120px] ${
        isSelected ? "text-[#039855]" : "text-[#475467] group-hover:text-[#191c1f]"
      }`}
    >
      {label}
    </span>
  </button>
);

/* ───────────────── Product Card ───────────────── */

export type ProductCardProps = {
  image?: string;
  title?: string;
  price?: string;
  originalPrice?: string;
  rating?: number;
  ratingText?: string;
  badges?: CardBadge[];
  onFavoriteToggle?: () => void;
  onAddToCart?: () => void;
  onQuickView?: () => void;
  onView?: () => void;
  discount?: string;
  reviewCount?: string;
  description?: string;
  isSoldOut?: boolean;
  cartQuantity?: number;
  onIncrement?: () => void;
  onDecrement?: () => void;
};

const ProductCard: FC<ProductCardProps> = ({
  image,
  title,
  price,
  originalPrice,
  rating,
  ratingText,
  badges,
  onFavoriteToggle,
  onAddToCart,
  onView,
  description,
  isSoldOut,
  cartQuantity = 0,
  onIncrement,
  onDecrement,
}) => (
  <div className="flex flex-col bg-white rounded-lg border border-[#e4e7e9] overflow-hidden group hover:shadow-md transition-shadow">
    {/* Image area */}
    <div className="relative aspect-[4/3] bg-[#f9fafb] overflow-hidden">
      {image ? (
        <img
          src={image}
          alt={title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          onClick={onView}
          style={{ cursor: onView ? "pointer" : undefined }}
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center text-[48px] text-gray-300">
          📦
        </div>
      )}

      {/* Badges overlaid on image */}
      {badges && badges.length > 0 && (
        <div className="absolute top-2 left-2 flex flex-wrap gap-1">
          {badges.map((badge) => (
            <span
              key={badge.text}
              className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide"
              style={{
                backgroundColor: badge.backgroundColor ?? "#039855",
                color: badge.textColor ?? "#fff",
              }}
            >
              {badge.text}
            </span>
          ))}
        </div>
      )}

      {/* Sold out overlay */}
      {isSoldOut && (
        <div className="absolute top-2 left-2">
          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide bg-[#2b3445] text-white">
            SOLD OUT
          </span>
        </div>
      )}
    </div>

    {/* Content */}
    <div className="flex flex-col flex-1 p-3 gap-1.5">
      {/* Rating */}
      {rating !== undefined && rating > 0 && (
        <div className="flex items-center gap-1 text-[12px]">
          <div className="flex">
            {[1, 2, 3, 4, 5].map((star) => (
              <span key={star} className={star <= rating ? "text-[#ffc107]" : "text-[#d1d5db]"}>
                ★
              </span>
            ))}
          </div>
          {ratingText && <span className="text-[#98a2b3]">{ratingText}</span>}
        </div>
      )}

      {/* Title */}
      <h3
        className="text-[13px] font-medium text-[#191c1f] leading-tight line-clamp-2 cursor-pointer hover:text-[#039855] transition-colors"
        onClick={onView}
      >
        {title}
      </h3>

      {/* Price */}
      <div className="flex items-baseline gap-1.5">
        {originalPrice && (
          <span className="text-[12px] text-[#98a2b3] line-through">{originalPrice}</span>
        )}
        {price && (
          <span className="text-[14px] font-bold text-[#039855]">{price}</span>
        )}
      </div>

      {/* Description */}
      {description && (
        <p className="text-[11px] text-[#667085] leading-relaxed line-clamp-2">{description}</p>
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Action bar */}
      <div className="flex items-center gap-1.5 pt-2 mt-auto border-t border-[#f2f4f7]">
        {cartQuantity > 0 ? (
          // Item is in cart - show quantity controls
          <>
            <button
              onClick={onDecrement}
              className="w-8 h-8 rounded-md border border-[#e4e7e9] flex items-center justify-center hover:bg-[#f2f4f7] transition-colors shrink-0"
              title="Decrease quantity"
            >
              <Minus className="w-3.5 h-3.5 text-[#191c1f]" />
            </button>
            <div className="flex-1 flex items-center justify-center h-8 text-[13px] font-semibold text-[#191c1f]">
              {cartQuantity}
            </div>
            <button
              onClick={onIncrement}
              className="w-8 h-8 rounded-md border border-[#e4e7e9] flex items-center justify-center hover:bg-[#f2f4f7] transition-colors shrink-0"
              title="Increase quantity"
            >
              <Plus className="w-3.5 h-3.5 text-[#191c1f]" />
            </button>
            {onView && (
              <button
                onClick={onView}
                className="w-8 h-8 rounded-md border border-[#e4e7e9] flex items-center justify-center hover:bg-[#f0fdf4] hover:border-[#86efac] transition-colors shrink-0"
                title="Quick view"
              >
                <Eye className="w-3.5 h-3.5 text-[#98a2b3]" />
              </button>
            )}
          </>
        ) : (
          // Item not in cart - show add to cart button
          <>
            <button
              onClick={onFavoriteToggle}
              className="w-8 h-8 rounded-md border border-[#e4e7e9] flex items-center justify-center hover:bg-[#fef2f2] hover:border-[#fca5a5] transition-colors shrink-0"
              title="Favorite"
            >
              <Heart className="w-3.5 h-3.5 text-[#98a2b3]" />
            </button>
            <button
              onClick={onAddToCart}
              disabled={isSoldOut}
              className="flex-1 flex items-center justify-center gap-1.5 h-8 rounded-md bg-[#039855] text-white text-[12px] font-semibold hover:bg-[#027a45] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ShoppingCart className="w-3.5 h-3.5" />
              Add to cart
            </button>
            {onView && (
              <button
                onClick={onView}
                className="w-8 h-8 rounded-md border border-[#e4e7e9] flex items-center justify-center hover:bg-[#f0fdf4] hover:border-[#86efac] transition-colors shrink-0"
                title="Quick view"
              >
                <Eye className="w-3.5 h-3.5 text-[#98a2b3]" />
              </button>
            )}
          </>
        )}
      </div>
    </div>
  </div>
);

export default ProductCard;

// Legacy / convenience named exports expected by other pages
export const TechDealHorizontalCard = HorizontalCard;
export const FashionDealHorizontalCard = HorizontalCard;
export const ElectronicsDealHorizontalCard = HorizontalCard;
export const LimitedOfferHorizontalCard = HorizontalCard;
export const PremiumHorizontalCard = HorizontalCard;
export const LightHorizontalCard = HorizontalCard;
export const HorizontalCardLarge = HorizontalCard;

// Product card variants expected by other pages
export const DefaultProductCard = ProductCard;
export const SimpleProductCard = ProductCard;
export const HotDealProductCard = ProductCard;
export const BigProductCard = ProductCard;
