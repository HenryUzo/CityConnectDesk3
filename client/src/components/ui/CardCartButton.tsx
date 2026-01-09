import svgPaths from "./svg-mq83yt3bc5";

function Heart() {
  return (
    <div className="relative shrink-0 size-[20px]" data-name="heart">
      <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 20 20">
        <g id="heart">
          <path d={svgPaths.p1238af00} id="Icon" stroke="var(--stroke-0, #E31B54)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.67" />
        </g>
      </svg>
    </div>
  );
}

function ButtonBase() {
  return (
    <div className="bg-white relative rounded-[8px] shrink-0" data-name="_Button base">
      <div className="content-stretch flex items-center justify-center overflow-clip p-[10px] relative rounded-[inherit]">
        <Heart />
      </div>
      <div aria-hidden="true" className="absolute border border-[#d0d5dd] border-solid inset-0 pointer-events-none rounded-[8px] shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]" />
    </div>
  );
}

function Button() {
  return (
    <div className="content-stretch flex items-start relative rounded-[4px] shrink-0" data-name="Button">
      <ButtonBase />
    </div>
  );
}

function ShoppingCart() {
  return (
    <div className="relative shrink-0 size-[20px]" data-name="shopping-cart">
      <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 20 20">
        <g clipPath="url(#clip0_868_53306)" id="shopping-cart">
          <path d={svgPaths.p74b6e00} id="Icon" stroke="var(--stroke-0, white)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.67" />
        </g>
        <defs>
          <clipPath id="clip0_868_53306">
            <rect fill="white" height="20" width="20" />
          </clipPath>
        </defs>
      </svg>
    </div>
  );
}

function ButtonBase1() {
  return (
    <div className="basis-0 bg-[#039855] grow min-h-px min-w-px relative rounded-[8px] shrink-0" data-name="_Button base">
      <div className="flex flex-row items-center justify-center overflow-clip rounded-[inherit] size-full">
        <div className="content-stretch flex gap-[8px] items-center justify-center px-[16px] py-[10px] relative w-full">
          <ShoppingCart />
          <p className="font-['General_Sans:Semibold',sans-serif] leading-[20px] not-italic relative shrink-0 text-[14px] text-nowrap text-white">Add to cart</p>
        </div>
      </div>
      <div aria-hidden="true" className="absolute border border-[#039855] border-solid inset-0 pointer-events-none rounded-[8px] shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]" />
    </div>
  );
}

function Button1() {
  return (
    <div className="basis-0 content-stretch flex grow items-start min-h-px min-w-px relative rounded-[4px] shrink-0" data-name="Button">
      <ButtonBase1 />
    </div>
  );
}

function Eye() {
  return (
    <div className="relative shrink-0 size-[20px]" data-name="eye">
      <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 20 20">
        <g clipPath="url(#clip0_868_53303)" id="eye">
          <g id="Icon">
            <path d={svgPaths.p3d74ed00} stroke="var(--stroke-0, #039855)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.67" />
            <path d={svgPaths.p3b27f100} stroke="var(--stroke-0, #039855)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.67" />
          </g>
        </g>
        <defs>
          <clipPath id="clip0_868_53303">
            <rect fill="white" height="20" width="20" />
          </clipPath>
        </defs>
      </svg>
    </div>
  );
}

function ButtonBase2() {
  return (
    <div className="bg-white relative rounded-[8px] shrink-0" data-name="_Button base">
      <div className="content-stretch flex items-center justify-center overflow-clip p-[10px] relative rounded-[inherit]">
        <Eye />
      </div>
      <div aria-hidden="true" className="absolute border border-[#d0d5dd] border-solid inset-0 pointer-events-none rounded-[8px] shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]" />
    </div>
  );
}

function Button2() {
  return (
    <div className="content-stretch flex items-start relative rounded-[4px] shrink-0" data-name="Button">
      <ButtonBase2 />
    </div>
  );
}

export type CardCartButtonProps = {
  isFavorited?: boolean;
  onFavoriteToggle?: () => void;
  onAddToCart?: () => void;
  onQuickView?: () => void;
  isAddingToCart?: boolean;
  inCart?: boolean;
  quantity?: number;
  onIncrement?: () => void;
  onDecrement?: () => void;
};

export default function CardCartButton(props: CardCartButtonProps) {
  // This component currently renders static buttons; props are accepted for Playground demos.
  return (
    <div className="content-stretch flex gap-[8px] items-start relative size-full" data-name="Card Cart button">
      <Button />
      <Button1 />
      <Button2 />
    </div>
  );
}