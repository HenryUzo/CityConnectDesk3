import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground hover:bg-primary/80",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80",
        outline: "text-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: string;
  backgroundColor?: string;
  textColor?: string;
}

function Badge({ className, variant, backgroundColor, textColor, ...props }: BadgeProps) {
  const classes = cn(badgeVariants({ variant: variant as any }), className);
  const style = {
    ...(backgroundColor ? { backgroundColor } : {}),
    ...(textColor ? { color: textColor } : {}),
    ...(props.style || {}),
  } as React.CSSProperties;

  return (
    <div className={classes} {...props} style={style} />
  )
}

const DiscountBadge: React.FC<React.PropsWithChildren<{}>> = ({ children }) => (
  <Badge className="bg-yellow-100 text-yellow-800">{children}</Badge>
);

const DistressBadge: React.FC<React.PropsWithChildren<{}>> = ({ children }) => (
  <Badge className="bg-red-100 text-red-800">{children}</Badge>
);

const HotBadge: React.FC<React.PropsWithChildren<{}>> = ({ children }) => (
  <Badge className="bg-pink-100 text-pink-800">{children}</Badge>
);

const RatingBadge: React.FC<{ rating?: number; text?: string }> = ({ rating, text }) => (
  <div className="inline-flex items-center gap-2">
    <span className="text-[12px] font-semibold">{rating ?? 0} ⭐</span>
    {text && <span className="text-[12px] text-[#667085]">{text}</span>}
  </div>
);

const RoundPriceBadge: React.FC<{ price?: string; topText?: string; bottomText?: string; variant?: string }> = ({ price, topText, bottomText }) => (
  <div className="inline-flex flex-col items-center justify-center rounded-full bg-[#ecfdf3] px-3 py-2 text-[12px] font-semibold">
    {topText && <span className="text-[10px] text-[#475467]">{topText}</span>}
    <span className="text-[14px] text-[#039855]">{price}</span>
    {bottomText && <span className="text-[10px] text-[#94a3b8]">{bottomText}</span>}
  </div>
);

export { Badge, badgeVariants, DiscountBadge, DistressBadge, HotBadge, RatingBadge, RoundPriceBadge };
