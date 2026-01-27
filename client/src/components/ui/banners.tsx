import { FC } from "react";

type BannerButton = {
  [key: string]: any;
  buttonText?: string;
  onButtonClick?: () => void;
  buttonVariant?: 'primary' | 'secondary' | 'ghost' | string;
};

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
  buttonVariant,
  showCarouselDots,
  activeCarouselDot,
}) => (
  <div className="flex items-center gap-4 rounded-[32px] border border-[#d0d5dd] bg-white p-6 shadow-sm">
    <div className="flex-1">
      <p className="text-[12px] uppercase text-[#667085]">
        {priceLabel}
      </p>
      <h2 className="text-[32px] font-bold text-[#101828]">{heading}</h2>
      <p className="mb-4 text-[14px] text-[#475467]">{description}</p>
      <div className="flex items-center gap-2">
        <span className="text-[22px] font-bold text-[#039855]">{priceText}</span>
        <span className="text-[14px] text-[#94a3b8]">{priceSuffix}</span>
      </div>
      <button
        onClick={onButtonClick}
        className={`mt-4 rounded-[16px] px-5 py-2 text-[14px] font-semibold ${
          buttonVariant === 'secondary'
            ? 'bg-white text-[#039855] border border-[#039855]'
            : buttonVariant === 'ghost'
            ? 'bg-transparent text-[#039855]'
            : 'bg-[#039855] text-white'
        }`}
      >
        {buttonText || "Shop now"}
      </button>
      {showCarouselDots && (
        <div className="mt-2 flex gap-2">
          {[0, 1, 2].map((dot) => (
            <span
              key={dot}
              className={`h-[6px] w-[6px] rounded-full ${activeCarouselDot === dot ? "bg-[#039855]" : "bg-[#d1d5db]"}`}
            />
          ))}
        </div>
      )}
    </div>
    {image && (
      <img src={image} alt={heading} className="h-[200px] w-[260px] rounded-[24px] object-cover" />
    )}
  </div>
);

type AsideBannerProps = BannerButton & {
  title?: string;
  description?: string;
  highlightWord?: string;
};

export const AsideBannerSmall: FC<AsideBannerProps> = ({
  title,
  description,
  highlightWord,
  buttonText,
  onButtonClick,
  buttonVariant,
}) => (
  <div className="flex h-full flex-col justify-between rounded-[28px] bg-[#039855] p-6 text-white shadow-sm">
    <div>
      <p className="text-[12px] uppercase tracking-[0.3em]">CityMart</p>
      <h3 className="mt-2 text-[18px] font-bold">{title}</h3>
      <p className="text-[12px] text-[#ecfdf3]">
        {description} <strong>{highlightWord}</strong>
      </p>
    </div>
    <button
      onClick={onButtonClick}
      className={`rounded-[16px] px-4 py-2 text-[12px] font-semibold ${
        buttonVariant === 'secondary'
          ? 'bg-white text-[#039855] border border-white/50'
          : buttonVariant === 'ghost'
          ? 'bg-transparent text-white border border-white/30'
          : 'bg-transparent text-white border border-white/50'
      }`}
    >
      {buttonText || "Learn more"}
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
  buttonVariant,
}) => (
  <div className="flex h-full flex-col justify-between rounded-[28px] border border-[#d0d5dd] bg-white p-6 shadow-sm">
    <div>
      <h3 className="text-[20px] font-semibold text-[#101828]">{title}</h3>
      <p className="text-[14px] text-[#475467]">{description}</p>
    </div>
    {image && <img src={image} alt={title} className="mt-4 h-[180px] w-full rounded-[20px] object-cover" />}
    {showButton && (
      <button
        onClick={onButtonClick}
        className={`mt-4 w-full rounded-[16px] px-4 py-2 text-[12px] font-semibold ${
          buttonVariant === 'secondary'
            ? 'bg-white text-[#039855] border border-[#e6f4ee]'
            : buttonVariant === 'ghost'
            ? 'bg-transparent text-[#039855]'
            : 'bg-[#039855] text-white'
        }`}
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
  }
> = ({ category, title, description, highlightWord, buttonText, onButtonClick, dealExpiry, daysRemaining, buttonVariant }) => (
  <div className="flex h-full flex-col justify-between rounded-[28px] bg-white p-6 shadow-sm">
    <div>
      <p className="text-[12px] uppercase tracking-[0.3em] text-[#039855]">{category}</p>
      <h3 className="mt-2 text-[18px] font-bold text-[#101828]">{title}</h3>
      <p className="text-[14px] text-[#475467]">
        {description} <strong className="text-[#039855]">{highlightWord}</strong>
      </p>
      {dealExpiry && (
        <p className="mt-2 text-[12px] text-[#667085]">{dealExpiry}</p>
      )}
      {daysRemaining && (
        <p className="text-[12px] font-semibold text-[#039855]">{daysRemaining}</p>
      )}
    </div>
    <button
      onClick={onButtonClick}
      className={`mt-4 rounded-[16px] px-4 py-2 text-[12px] font-semibold ${
        buttonVariant === 'secondary'
          ? 'bg-white text-[#039855] border border-[#039855]'
          : buttonVariant === 'ghost'
          ? 'bg-transparent text-[#039855]'
          : 'bg-[#039855] text-white'
      }`}
    >
      {buttonText || "Shop now"}
    </button>
  </div>
);

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
  buttonVariant,
}) => (
  <div
    className="relative overflow-hidden rounded-[32px] px-8 py-10 text-white shadow-lg"
    style={{
      backgroundImage: backgroundImage ? `url(${backgroundImage})` : undefined,
      backgroundSize: "cover",
    }}
  >
    {promoBadgeText && (
      <span className="rounded-full bg-[#ecfdf3] px-4 py-1 text-[12px] font-semibold text-[#039855]">
        {promoBadgeText}
      </span>
    )}
    <h2 className="mt-4 text-[32px] font-bold">{heading}</h2>
    <p className="mt-2 text-[16px]">{description}</p>
    <div className="mt-4 flex items-baseline gap-2">
      <span className="text-[14px] uppercase text-[#ecfdf3]">{priceTopText}</span>
      <span className="text-[28px] font-bold">{price}</span>
      <span className="text-[12px] text-[#ecfdf3]">{priceBottomText}</span>
    </div>
    <button
      onClick={onButtonClick}
      className={`mt-6 rounded-[24px] px-6 py-3 text-[14px] font-semibold ${
        buttonVariant === 'secondary'
          ? 'bg-white text-[#039855] border border-white'
          : buttonVariant === 'ghost'
          ? 'bg-transparent text-white'
          : 'bg-[#039855] text-white'
      }`}
    >
      {buttonText || "Shop now"}
    </button>
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
