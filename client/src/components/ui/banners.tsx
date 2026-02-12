import { FC } from "react";

type BannerButton = {
  [key: string]: any;
  buttonText?: string;
  onButtonClick?: () => void;
  buttonVariant?: 'primary' | 'secondary' | 'ghost' | string;
};

/* ───────────────── Fifty Percent / Hero Banner ───────────────── */

export type FiftyPercentBannerProps = BannerButton & {
  heading?: string;
  description?: string;
  priceText?: string;
  priceLabel?: string;
  priceSuffix?: string;
  image?: string;
  showCarouselDots?: boolean;
  activeCarouselDot?: number;
};

export const FiftyPercentBanner: FC<FiftyPercentBannerProps> = ({
  heading,
  description,
  priceText,
  priceLabel,
  priceSuffix,
  image,
  buttonText,
  onButtonClick,
  showCarouselDots,
  activeCarouselDot,
}) => (
  <div className="relative rounded-[16px] border border-[#e4e7e9] bg-white overflow-hidden">
    <div className="flex items-center min-h-[220px]">
      {/* Text */}
      <div className="flex-1 p-6 lg:p-8 z-10">
        <h2 className="text-[24px] lg:text-[28px] font-bold text-[#191c1f] leading-tight mb-2">
          {heading}
        </h2>
        <p className="text-[13px] text-[#5f6c72] mb-4 leading-relaxed max-w-[280px]">
          {description}
        </p>
        <button
          onClick={onButtonClick}
          className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-full bg-[#039855] text-white text-[13px] font-semibold hover:bg-[#027a45] transition-colors"
        >
          {buttonText || "Shop now"}
          <span>›</span>
        </button>
        {showCarouselDots && (
          <div className="flex gap-1.5 mt-4">
            {[0, 1, 2].map((dot) => (
              <span
                key={dot}
                className={`h-[8px] w-[8px] rounded-full ${
                  activeCarouselDot === dot ? "bg-[#191c1f]" : "bg-[#d1d5db]"
                }`}
              />
            ))}
          </div>
        )}
      </div>

      {/* Price badge + Image */}
      <div className="relative shrink-0 flex items-center">
        {/* Price badge */}
        {priceText && (
          <div className="absolute left-[-20px] top-1/2 -translate-y-1/2 z-20 w-[90px] h-[90px] rounded-full bg-[#039855] flex flex-col items-center justify-center text-white shadow-lg">
            <span className="text-[9px] uppercase tracking-wide">{priceLabel || "Just"}</span>
            <span className="text-[14px] font-bold leading-tight">{priceText}</span>
            <span className="text-[9px] uppercase">{priceSuffix || "Only!"}</span>
          </div>
        )}
        {image && (
          <img
            src={image}
            alt={heading}
            className="h-[220px] w-[280px] lg:w-[340px] object-cover"
          />
        )}
      </div>
    </div>
  </div>
);

/* ───────────────── Aside Banners ───────────────── */

type AsideBannerProps = BannerButton & {
  title?: string;
  description?: string;
  highlightWord?: string;
};

export const AsideBannerSmall: FC<AsideBannerProps & {
  countdown?: string;
}> = ({
  title,
  description,
  highlightWord,
  buttonText,
  onButtonClick,
  countdown,
}) => (
  <div className="relative h-full rounded-[12px] bg-gradient-to-br from-[#039855] to-[#027a45] p-5 text-white flex flex-col justify-between overflow-hidden min-h-[200px]">
    {/* Decorative circle */}
    <div className="absolute -right-8 -bottom-8 w-[120px] h-[120px] rounded-full bg-white/10" />

    {countdown && (
      <span className="inline-block self-start px-2.5 py-1 rounded bg-white/20 text-[11px] font-medium mb-2">
        {countdown}
      </span>
    )}
    <div>
      <h3 className="text-[22px] font-bold leading-tight mb-1">{title}</h3>
      <p className="text-[12px] text-white/80 leading-relaxed">
        {description?.split(highlightWord || "").map((part, i, arr) =>
          i < arr.length - 1 ? (
            <span key={i}>{part}<strong className="text-white">{highlightWord}</strong></span>
          ) : (
            <span key={i}>{part}</span>
          )
        )}
      </p>
    </div>
    <button
      onClick={onButtonClick}
      className="inline-flex items-center gap-1.5 self-start px-4 py-2 rounded-full bg-white text-[#039855] text-[12px] font-semibold hover:bg-white/90 transition-colors mt-3"
    >
      {buttonText || "Shop now"}
      <span>›</span>
    </button>
  </div>
);

export const AsideBannerMedium: FC<AsideBannerProps & { image?: string; showButton?: boolean }> = ({
  title,
  description,
  image,
  showButton,
  buttonText,
  onButtonClick,
}) => (
  <div className="flex h-full flex-col justify-between rounded-[12px] border border-[#e4e7e9] bg-white p-5">
    <div>
      <h3 className="text-[18px] font-semibold text-[#191c1f] mb-1">{title}</h3>
      <p className="text-[13px] text-[#5f6c72]">{description}</p>
    </div>
    {image && <img src={image} alt={title} className="mt-3 h-[140px] w-full rounded-lg object-cover" />}
    {showButton && (
      <button
        onClick={onButtonClick}
        className="mt-3 w-full rounded-full px-4 py-2 text-[12px] font-semibold bg-[#039855] text-white hover:bg-[#027a45] transition-colors"
      >
        {buttonText || "Shop now"}
      </button>
    )}
  </div>
);

export const AsideBannerLong: FC<
  AsideBannerProps & {
    category?: string;
    dealExpiry?: string;
    daysRemaining?: string;
    image?: string;
  }
> = ({ category, title, description, highlightWord, buttonText, onButtonClick, dealExpiry, daysRemaining, image }) => (
  <div className="relative rounded-[12px] bg-white border border-[#e4e7e9] overflow-hidden flex flex-col min-h-[400px]">
    {/* Content */}
    <div className="p-5 flex-1 flex flex-col">
      {category && (
        <span className="text-[11px] uppercase tracking-[0.15em] font-semibold text-[#039855] mb-2">
          {category}
        </span>
      )}
      <h3 className="text-[28px] font-bold text-[#191c1f] leading-tight mb-1">{title}</h3>
      <p className="text-[13px] text-[#5f6c72] leading-relaxed mb-3">
        {description?.split(highlightWord || "").map((part, i, arr) =>
          i < arr.length - 1 ? (
            <span key={i}>{part}<strong className="text-[#039855]">{highlightWord}</strong></span>
          ) : (
            <span key={i}>{part}</span>
          )
        )}
      </p>
      {(dealExpiry || daysRemaining) && (
        <div className="mb-3">
          {dealExpiry && <p className="text-[11px] text-[#98a2b3] mb-0.5">{dealExpiry}</p>}
          {daysRemaining && (
            <span className="inline-block px-3 py-1.5 rounded-md bg-[#f2f4f7] text-[12px] font-semibold text-[#191c1f]">
              {daysRemaining}
            </span>
          )}
        </div>
      )}
      <button
        onClick={onButtonClick}
        className="inline-flex items-center gap-1.5 self-start px-5 py-2 rounded-full bg-[#039855] text-white text-[12px] font-semibold hover:bg-[#027a45] transition-colors"
      >
        {buttonText || "Shop now"}
        <span>›</span>
      </button>
    </div>
    {/* Image area */}
    {image && (
      <div className="h-[160px] overflow-hidden">
        <img src={image} alt={title} className="w-full h-full object-cover" />
      </div>
    )}
  </div>
);

/* ───────────────── Full Width Banner ───────────────── */

export type FullWidthBannerProps = BannerButton & {
  heading?: string;
  description?: string;
  price?: string;
  priceTopText?: string;
  priceBottomText?: string;
  promoBadgeText?: string;
  backgroundImage?: string;
};

export const FullWidthBanner: FC<FullWidthBannerProps> = ({
  heading,
  description,
  price,
  priceTopText,
  priceBottomText,
  promoBadgeText,
  backgroundImage,
  buttonText,
  onButtonClick,
}) => (
  <div className="relative overflow-hidden rounded-[16px] min-h-[260px] flex items-center">
    {/* Background */}
    {backgroundImage && (
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${backgroundImage})` }}
      >
        <div className="absolute inset-0 bg-gradient-to-r from-[#191c1f]/90 via-[#191c1f]/60 to-transparent" />
      </div>
    )}
    {!backgroundImage && (
      <div className="absolute inset-0 bg-gradient-to-r from-[#1b2430] to-[#2d3a4a]" />
    )}

    {/* Content */}
    <div className="relative z-10 p-8 lg:p-10 max-w-[520px]">
      {promoBadgeText && (
        <span className="inline-block px-3 py-1 rounded text-[11px] font-bold uppercase tracking-wide bg-[#ecfdf3] text-[#039855] mb-3">
          {promoBadgeText}
        </span>
      )}
      <h2 className="text-[28px] lg:text-[36px] font-bold text-white leading-tight mb-2">
        {heading}
      </h2>
      <p className="text-[14px] text-white/80 mb-4 leading-relaxed">{description}</p>
      <button
        onClick={onButtonClick}
        className="inline-flex items-center gap-1.5 px-6 py-3 rounded-full bg-[#039855] text-white text-[13px] font-semibold hover:bg-[#027a45] transition-colors"
      >
        {buttonText || "Shop now"}
        <span>›</span>
      </button>
    </div>

    {/* Price badge */}
    {price && (
      <div className="absolute right-6 lg:right-10 top-6 z-10 w-[80px] h-[80px] lg:w-[100px] lg:h-[100px] rounded-full bg-[#ee5858] flex flex-col items-center justify-center text-white shadow-lg">
        <span className="text-[8px] lg:text-[9px] uppercase">{priceTopText || "Just"}</span>
        <span className="text-[12px] lg:text-[15px] font-bold leading-tight">{price}</span>
        <span className="text-[8px] lg:text-[9px]">{priceBottomText || "Only!"}</span>
      </div>
    )}
  </div>
);

// Convenience aliases for many themed banners used in Playground
export const ElectronicsBanner = FullWidthBanner;
export const FashionBanner = FullWidthBanner;
export const HomeGardenBanner = FullWidthBanner;
export const SportsFitnessBanner = FullWidthBanner;
export const BeautyBanner = FullWidthBanner;
export const BooksMediaBanner = FullWidthBanner;
export const SpringSaleBanner = FullWidthBanner;
export const SummerSaleBanner = FullWidthBanner;
export const FallSaleBanner = FullWidthBanner;
export const WinterSaleBanner = FullWidthBanner;
export const BlackFridayBanner = FullWidthBanner;
export const CyberMondayBanner = FullWidthBanner;
export const HolidayBanner = FullWidthBanner;
export const ValentinesBanner = FullWidthBanner;
export const BackToSchoolBanner = FullWidthBanner;
export const NewYearBanner = FullWidthBanner;
