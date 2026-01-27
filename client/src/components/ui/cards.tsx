import { FC } from "react";

export type CardBadge = {
  text: string;
  variant?: string;
  backgroundColor?: string;
  textColor?: string;
};

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
  // Additional flexible props used by Playground and other pages
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
  variant,
  badge,
  discount,
  discountColor,
  showCarouselDots,
  activeCarouselDot,
  onButtonClick,
}) => (
  <div
    className={`rounded-[32px] border border-[#f2f4f7] p-[24px] text-left text-sm ${variant === "dark" ? "bg-[#101828] text-white" : "bg-white text-[#101828]"}`}
    style={{ gap: "1rem", display: "flex", alignItems: "center" }}
  >
    {image && (
      <img
        src={image}
        alt={title}
        className="h-[120px] w-[120px] shrink-0 rounded-[20px] object-cover"
      />
    )}
    <div className="flex flex-col gap-2">
      {badge && (
        <span
          className="text-[12px] font-semibold text-white"
          style={{ backgroundColor: badge.color ?? "#039855", borderRadius: 999 }}
        >
          {badge.text}
        </span>
      )}
      <h3 className="text-[20px] font-semibold text-white">
        {title}
      </h3>
      {discount && (
        <p className="text-[12px] font-medium" style={{ color: discountColor ?? "#ecfdf3" }}>
          {discount}
        </p>
      )}
      <button
        onClick={onButtonClick}
        className="rounded-[24px] border border-white px-5 py-2 text-[12px] font-semibold text-white"
      >
        {buttonText || "Learn more"}
      </button>
      {showCarouselDots && (
        <div className="flex gap-1">
          {[0, 1, 2].map((dot) => (
            <span
              key={dot}
              className={`h-[6px] w-[6px] rounded-full ${activeCarouselDot === dot ? "bg-[#039855]" : "bg-[#94a3b8]"}`}
            />
          ))}
        </div>
      )}
    </div>
  </div>
);

export type CategoryCardProps = {
  icon?: string;
  label?: string;
  onClick?: () => void;
};

export const CategoryCard: FC<CategoryCardProps> = ({ icon, label, onClick }) => (
  <button
    onClick={onClick}
    className="flex h-[150px] w-[190px] flex-col items-center justify-center rounded-[24px] border border-[#d0d5dd] bg-white text-center text-sm font-semibold text-[#101828]"
  >
    <span className="text-[32px]">{icon}</span>
    <span>{label}</span>
  </button>
);

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
}) => (
  <div className="flex flex-col gap-3 rounded-[32px] border border-[#e2e8f0] bg-white p-4 shadow-sm">
    {image && (
      <img src={image} alt={title} className="h-[180px] w-full rounded-[24px] object-cover" />
    )}
    <div className="flex flex-col gap-1">
      <h3 className="text-[16px] font-semibold text-[#101828]">{title}</h3>
      <div className="flex items-center gap-2">
        {price && <span className="text-[18px] font-bold text-[#039855]">{price}</span>}
        {originalPrice && <span className="text-[12px] text-[#94a3b8] line-through">{originalPrice}</span>}
      </div>
      <div className="flex items-center gap-1 text-[12px] text-[#667085]">
        <span>⭐ {rating ?? "0"}</span>
        {ratingText && <span>{ratingText}</span>}
      </div>
    </div>
    <div className="flex flex-wrap gap-2">
      {badges?.map((badge) => (
        <span
          key={badge.text}
          className="rounded-full border px-3 py-1 text-[10px] font-semibold"
          style={{
            backgroundColor: badge.backgroundColor ?? "#ecfdf3",
            color: badge.textColor ?? "#039855",
            borderColor: "#d1fae5",
          }}
        >
          {badge.text}
        </span>
      ))}
    </div>
    <div className="flex items-center gap-2">
      <button
        onClick={onFavoriteToggle}
        className="flex-1 rounded-[16px] border border-[#d1d5db] py-2 text-[12px] font-semibold text-[#667085]"
      >
        Favorite
      </button>
      <button
        onClick={onAddToCart}
        className="flex-1 rounded-[16px] bg-[#039855] py-2 text-[12px] font-semibold text-white"
      >
        Add to cart
      </button>
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
