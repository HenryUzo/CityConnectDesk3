/**
 * COMPREHENSIVE BUTTON SYSTEM
 * 
 * A complete button component library based on Figma designs featuring:
 * - Multiple variants (primary, secondary, outline, ghost, text, destructive)
 * - Different states (default, hover, active, disabled, loading, error)
 * - Icon positions (leading, trailing, icon-only, no icon)
 * - Social login buttons (Google, Facebook, Twitter, Instagram, LinkedIn, GitHub, Apple)
 * - Different sizes (sm, md, lg, xl)
 * - Fully accessible and keyboard navigable
 * 
 * All icons use the BaseIcons component library for consistency.
 */

import { ButtonHTMLAttributes, ReactNode, forwardRef } from "react";
import svgPathsPrimary from "./imports/svg-t1ocic70pj";
import svgPathsSecondary from "./imports/svg-ydzjg2w7qh";
import svgPathsGoogle from "./imports/svg-osk96kqs21";

// ============================================
// ICON COMPONENTS (from BaseIcons)
// ============================================

/**
 * Generic Icon Wrapper - makes icons compatible with button sizes
 */
function IconWrapper({ 
  children, 
  size = 20,
  className = "" 
}: { 
  children: ReactNode; 
  size?: number;
  className?: string;
}) {
  return (
    <div className={`relative shrink-0 ${className}`} style={{ width: size, height: size }}>
      {children}
    </div>
  );
}

/**
 * Tool Icon (Wrench) - Used in primary button
 */
export function ToolIcon({ 
  color = "white", 
  size = 20,
  className = "" 
}: { 
  color?: string; 
  size?: number;
  className?: string;
}) {
  return (
    <div className={`relative shrink-0 ${className}`} style={{ width: size, height: size }}>
      <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 20 20">
        <g id="tool">
          <path d={svgPathsPrimary.p3c4d1780} stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.67" />
        </g>
      </svg>
    </div>
  );
}

/**
 * Shopping Basket Icon - Used in secondary button
 */
export function BasketIcon({ 
  color = "#039855", 
  size = 20,
  className = "" 
}: { 
  color?: string; 
  size?: number;
  className?: string;
}) {
  return (
    <div className={`relative shrink-0 ${className}`} style={{ width: size, height: size }}>
      <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 20 20">
        <g id="Basket">
          <path d={svgPathsSecondary.p1563c240} stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
        </g>
      </svg>
    </div>
  );
}

/**
 * Google Icon - Multi-color
 */
export function GoogleIcon({ 
  size = 24,
  className = "" 
}: { 
  size?: number;
  className?: string;
}) {
  return (
    <div className={`relative shrink-0 ${className}`} style={{ width: size, height: size }}>
      <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 24 24">
        <g clipPath="url(#clip0_google)" id="Social icon">
          <path d={svgPathsGoogle.p30572700} fill="#4285F4" />
          <path d={svgPathsGoogle.p2d84f580} fill="#34A853" />
          <path d={svgPathsGoogle.p1de97300} fill="#FBBC04" />
          <path d={svgPathsGoogle.p1ebd4080} fill="#EA4335" />
        </g>
        <defs>
          <clipPath id="clip0_google">
            <rect fill="white" height="24" width="24" />
          </clipPath>
        </defs>
      </svg>
    </div>
  );
}

/**
 * Simple SVG Icons for other use cases
 */
export function ArrowRightIcon({ color = "white", size = 20 }: { color?: string; size?: number }) {
  return (
    <IconWrapper size={size}>
      <svg className="block size-full" fill="none" viewBox="0 0 20 20">
        <path d="M4 10h12m0 0l-4-4m4 4l-4 4" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    </IconWrapper>
  );
}

export function ArrowLeftIcon({ color = "white", size = 20 }: { color?: string; size?: number }) {
  return (
    <IconWrapper size={size}>
      <svg className="block size-full" fill="none" viewBox="0 0 20 20">
        <path d="M16 10H4m0 0l4 4m-4-4l4-4" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    </IconWrapper>
  );
}

export function PlusIcon({ color = "white", size = 20 }: { color?: string; size?: number }) {
  return (
    <IconWrapper size={size}>
      <svg className="block size-full" fill="none" viewBox="0 0 20 20">
        <path d="M10 4v12m-6-6h12" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    </IconWrapper>
  );
}

export function CheckIcon({ color = "white", size = 20 }: { color?: string; size?: number }) {
  return (
    <IconWrapper size={size}>
      <svg className="block size-full" fill="none" viewBox="0 0 20 20">
        <path d="M16.667 5L7.5 14.167 3.333 10" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    </IconWrapper>
  );
}

export function DownloadIcon({ color = "white", size = 20 }: { color?: string; size?: number }) {
  return (
    <IconWrapper size={size}>
      <svg className="block size-full" fill="none" viewBox="0 0 20 20">
        <path d="M17.5 12.5v2.917A1.667 1.667 0 0 1 15.833 17H4.167a1.667 1.667 0 0 1-1.667-1.583V12.5m4.167-5L10 10.833m0 0L13.333 7.5M10 10.833V3" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    </IconWrapper>
  );
}

export function UploadIcon({ color = "white", size = 20 }: { color?: string; size?: number }) {
  return (
    <IconWrapper size={size}>
      <svg className="block size-full" fill="none" viewBox="0 0 20 20">
        <path d="M17.5 12.5v2.917A1.667 1.667 0 0 1 15.833 17H4.167a1.667 1.667 0 0 1-1.667-1.583V12.5M13.333 6.667L10 3.333m0 0L6.667 6.667M10 3.333v9.167" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    </IconWrapper>
  );
}

export function HeartIcon({ color = "white", size = 20 }: { color?: string; size?: number }) {
  return (
    <IconWrapper size={size}>
      <svg className="block size-full" fill="none" viewBox="0 0 20 20">
        <path d="M17.367 3.842a4.583 4.583 0 0 0-6.484 0L10 4.725l-.883-.883a4.584 4.584 0 1 0-6.484 6.483l.884.884L10 17.692l6.483-6.483.884-.884a4.583 4.583 0 0 0 0-6.483v0z" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    </IconWrapper>
  );
}

export function SearchIcon({ color = "white", size = 20 }: { color?: string; size?: number }) {
  return (
    <IconWrapper size={size}>
      <svg className="block size-full" fill="none" viewBox="0 0 20 20">
        <path d="M9.167 15.833a6.667 6.667 0 1 0 0-13.333 6.667 6.667 0 0 0 0 13.333zm7.5 1.667l-3.625-3.625" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    </IconWrapper>
  );
}

export function SettingsIcon({ color = "white", size = 20 }: { color?: string; size?: number }) {
  return (
    <IconWrapper size={size}>
      <svg className="block size-full" fill="none" viewBox="0 0 20 20">
        <g clipPath="url(#clip0_settings)">
          <path d="M10 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M16.167 12.5a1.367 1.367 0 0 0 .275 1.508l.05.05a1.658 1.658 0 1 1-2.342 2.342l-.05-.05a1.367 1.367 0 0 0-1.508-.275 1.367 1.367 0 0 0-.83 1.25v.142a1.667 1.667 0 0 1-3.333 0v-.075a1.367 1.367 0 0 0-.892-1.25 1.367 1.367 0 0 0-1.508.275l-.05.05a1.658 1.658 0 1 1-2.342-2.342l.05-.05a1.367 1.367 0 0 0 .275-1.508 1.367 1.367 0 0 0-1.25-.83h-.142a1.667 1.667 0 0 1 0-3.333h.075a1.367 1.367 0 0 0 1.25-.892 1.367 1.367 0 0 0-.275-1.508l-.05-.05a1.658 1.658 0 1 1 2.342-2.342l.05.05a1.367 1.367 0 0 0 1.508.275h.067a1.367 1.367 0 0 0 .83-1.25v-.142a1.667 1.667 0 0 1 3.333 0v.075a1.367 1.367 0 0 0 .83 1.25 1.367 1.367 0 0 0 1.508-.275l.05-.05a1.658 1.658 0 1 1 2.342 2.342l-.05.05a1.367 1.367 0 0 0-.275 1.508v.067a1.367 1.367 0 0 0 1.25.83h.142a1.667 1.667 0 0 1 0 3.333h-.075a1.367 1.367 0 0 0-1.25.83v0z" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </g>
        <defs>
          <clipPath id="clip0_settings">
            <path fill="white" d="M0 0h20v20H0z"/>
          </clipPath>
        </defs>
      </svg>
    </IconWrapper>
  );
}

export function TrashIcon({ color = "white", size = 20 }: { color?: string; size?: number }) {
  return (
    <IconWrapper size={size}>
      <svg className="block size-full" fill="none" viewBox="0 0 20 20">
        <path d="M2.5 5h15M6.667 5V3.333a1.667 1.667 0 0 1 1.666-1.666h3.334a1.667 1.667 0 0 1 1.666 1.666V5m2.5 0v11.667a1.667 1.667 0 0 1-1.666 1.666H5.833a1.667 1.667 0 0 1-1.666-1.666V5h11.666z" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    </IconWrapper>
  );
}

export function LoaderIcon({ color = "white", size = 20 }: { color?: string; size?: number }) {
  return (
    <IconWrapper size={size}>
      <svg className="block size-full animate-spin" fill="none" viewBox="0 0 20 20">
        <path d="M10 1.667v3.333M10 15v3.333M4.107 4.107l2.357 2.357M13.536 13.536l2.357 2.357M1.667 10h3.333M15 10h3.333M4.107 15.893l2.357-2.357M13.536 6.464l2.357-2.357" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    </IconWrapper>
  );
}

export function AlertCircleIcon({ color = "#DC2626", size = 20 }: { color?: string; size?: number }) {
  return (
    <IconWrapper size={size}>
      <svg className="block size-full" fill="none" viewBox="0 0 20 20">
        <g clipPath="url(#clip0_alert)">
          <path d="M10 18.333a8.333 8.333 0 1 0 0-16.666 8.333 8.333 0 0 0 0 16.666zM10 6.667V10m0 3.333h.009" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </g>
        <defs>
          <clipPath id="clip0_alert">
            <path fill="white" d="M0 0h20v20H0z"/>
          </clipPath>
        </defs>
      </svg>
    </IconWrapper>
  );
}

export function XCircleIcon({ color = "white", size = 20 }: { color?: string; size?: number }) {
  return (
    <IconWrapper size={size}>
      <svg className="block size-full" fill="none" viewBox="0 0 20 20">
        <path d="M12.5 7.5l-5 5m0-5l5 5m5.833-2.5a8.333 8.333 0 1 1-16.666 0 8.333 8.333 0 0 1 16.666 0z" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    </IconWrapper>
  );
}

export function MailIcon({ color = "white", size = 20 }: { color?: string; size?: number }) {
  return (
    <IconWrapper size={size}>
      <svg className="block size-full" fill="none" viewBox="0 0 20 20">
        <path d="M3.333 3.333h13.334c.916 0 1.666.75 1.666 1.667v10c0 .917-.75 1.667-1.666 1.667H3.333c-.916 0-1.666-.75-1.666-1.667V5c0-.917.75-1.667 1.666-1.667z" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M18.333 5L10 10.833 1.667 5" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    </IconWrapper>
  );
}

export function LogInIcon({ color = "white", size = 20 }: { color?: string; size?: number }) {
  return (
    <IconWrapper size={size}>
      <svg className="block size-full" fill="none" viewBox="0 0 20 20">
        <path d="M12.5 2.5h2.917c.442 0 .866.176 1.179.488.312.313.487.737.487 1.179v11.666c0 .442-.175.866-.487 1.179a1.667 1.667 0 0 1-1.179.488H12.5M8.333 14.167L12.5 10m0 0L8.333 5.833M12.5 10h-10" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    </IconWrapper>
  );
}

export function LogOutIcon({ color = "white", size = 20 }: { color?: string; size?: number }) {
  return (
    <IconWrapper size={size}>
      <svg className="block size-full" fill="none" viewBox="0 0 20 20">
        <path d="M7.5 17.5H4.583c-.442 0-.866-.175-1.179-.487a1.667 1.667 0 0 1-.487-1.18V4.168c0-.442.175-.866.487-1.179.313-.312.737-.487 1.179-.487H7.5M13.333 14.167L17.5 10m0 0l-4.167-4.167M17.5 10h-10" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    </IconWrapper>
  );
}

// Social Icons (Simple monochrome versions)
export function FacebookIcon({ color = "#1877F2", size = 20 }: { color?: string; size?: number }) {
  return (
    <IconWrapper size={size}>
      <svg className="block size-full" fill={color} viewBox="0 0 20 20">
        <path d="M20 10c0-5.523-4.477-10-10-10S0 4.477 0 10c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V10h2.54V7.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V10h2.773l-.443 2.89h-2.33v6.988C16.343 19.128 20 14.991 20 10z"/>
      </svg>
    </IconWrapper>
  );
}

export function TwitterIcon({ color = "#1DA1F2", size = 20 }: { color?: string; size?: number }) {
  return (
    <IconWrapper size={size}>
      <svg className="block size-full" fill={color} viewBox="0 0 20 20">
        <path d="M6.29 18.251c7.547 0 11.675-6.253 11.675-11.675 0-.178 0-.355-.012-.53A8.348 8.348 0 0020 3.92a8.19 8.19 0 01-2.357.646 4.118 4.118 0 001.804-2.27 8.224 8.224 0 01-2.605.996 4.107 4.107 0 00-6.993 3.743 11.65 11.65 0 01-8.457-4.287 4.106 4.106 0 001.27 5.477A4.073 4.073 0 01.8 7.713v.052a4.105 4.105 0 003.292 4.022 4.095 4.095 0 01-1.853.07 4.108 4.108 0 003.834 2.85A8.233 8.233 0 010 16.407a11.616 11.616 0 006.29 1.84"/>
      </svg>
    </IconWrapper>
  );
}

export function InstagramIcon({ color = "#E4405F", size = 20 }: { color?: string; size?: number }) {
  return (
    <IconWrapper size={size}>
      <svg className="block size-full" fill="none" viewBox="0 0 20 20" stroke={color}>
        <rect x="2.5" y="2.5" width="15" height="15" rx="4" strokeWidth="1.5"/>
        <circle cx="10" cy="10" r="3.5" strokeWidth="1.5"/>
        <circle cx="15" cy="5" r="0.5" fill={color}/>
      </svg>
    </IconWrapper>
  );
}

export function LinkedInIcon({ color = "#0A66C2", size = 20 }: { color?: string; size?: number }) {
  return (
    <IconWrapper size={size}>
      <svg className="block size-full" fill={color} viewBox="0 0 20 20">
        <path d="M18.5 0h-17A1.5 1.5 0 000 1.5v17A1.5 1.5 0 001.5 20h17a1.5 1.5 0 001.5-1.5v-17A1.5 1.5 0 0018.5 0zM6 17H3V8h3v9zM4.5 6.5a1.5 1.5 0 110-3 1.5 1.5 0 010 3zM17 17h-3v-4.5c0-1.08-.02-2.472-1.508-2.472-1.508 0-1.74 1.177-1.74 2.394V17H8v-9h2.844v1.227h.04c.396-.75 1.364-1.54 2.808-1.54C16.45 7.687 17 9.77 17 12.25V17z"/>
      </svg>
    </IconWrapper>
  );
}

export function GitHubIcon({ color = "#181717", size = 20 }: { color?: string; size?: number }) {
  return (
    <IconWrapper size={size}>
      <svg className="block size-full" fill={color} viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M10 0C4.477 0 0 4.477 0 10c0 4.42 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.603-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.463-1.11-1.463-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0110 4.836c.85.004 1.705.114 2.504.336 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C17.137 18.163 20 14.418 20 10c0-5.523-4.477-10-10-10z" clipRule="evenodd"/>
      </svg>
    </IconWrapper>
  );
}

export function AppleIcon({ color = "#000000", size = 20 }: { color?: string; size?: number }) {
  return (
    <IconWrapper size={size}>
      <svg className="block size-full" fill={color} viewBox="0 0 20 20">
        <path d="M16.09 10.3c-.03-2.84 2.32-4.21 2.42-4.27-1.32-1.93-3.37-2.19-4.1-2.22-1.74-.18-3.4 1.03-4.29 1.03-.89 0-2.26-1-3.72-.98-1.91.03-3.67 1.11-4.66 2.83-1.98 3.44-.51 8.54 1.42 11.34.95 1.37 2.08 2.91 3.57 2.86 1.45-.06 2-0.94 3.76-.94 1.75 0 2.25.94 3.71.91 1.53-.03 2.53-1.39 3.48-2.77 1.1-1.59 1.55-3.13 1.58-3.21-.03-.01-3.03-1.16-3.07-4.61v.03zM13.16 3.36c.79-.96 1.32-2.29 1.18-3.62-1.14.05-2.52.76-3.34 1.72-.73.84-1.37 2.19-1.2 3.48 1.27.1 2.57-.64 3.36-1.58z"/>
      </svg>
    </IconWrapper>
  );
}

// ============================================
// BUTTON TYPES & INTERFACES
// ============================================

export type ButtonVariant = 
  | "primary" 
  | "secondary" 
  | "outline" 
  | "ghost" 
  | "text" 
  | "destructive"
  | "success"
  | "warning";

export type ButtonSize = "sm" | "md" | "lg" | "xl";

export type IconPosition = "leading" | "trailing" | "only" | "none";

export interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  /**
   * Button variant/style
   * @default "primary"
   */
  variant?: ButtonVariant;
  
  /**
   * Button size
   * @default "md"
   */
  size?: ButtonSize;
  
  /**
   * Icon to display
   */
  icon?: ReactNode;
  
  /**
   * Position of the icon
   * @default "none"
   */
  iconPosition?: IconPosition;
  
  /**
   * Button text/content (not required for icon-only buttons)
   */
  children?: ReactNode;
  
  /**
   * Loading state
   * @default false
   */
  isLoading?: boolean;
  
  /**
   * Error state
   * @default false
   */
  hasError?: boolean;
  
  /**
   * Full width button
   * @default false
   */
  fullWidth?: boolean;
  
  /**
   * Additional CSS classes
   */
  className?: string;
}

// ============================================
// BASE BUTTON COMPONENT
// ============================================

/**
 * Base Button Component
 * 
 * A comprehensive button with support for all variants, sizes, icons, and states
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = "primary",
      size = "md",
      icon,
      iconPosition = "none",
      children,
      isLoading = false,
      hasError = false,
      fullWidth = false,
      disabled = false,
      className = "",
      ...props
    },
    ref
  ) => {
    // Filter out invalid DOM props that React doesn't recognize
    const {
      backgroundColor,
      textColor,
      ...validProps
    } = props as any;

    // Size configurations
    const sizeClasses = {
      sm: "px-[12px] py-[6px] text-[12px] gap-[6px]",
      md: "px-[16px] py-[10px] text-[14px] gap-[8px]",
      lg: "px-[20px] py-[12px] text-[16px] gap-[10px]",
      xl: "px-[24px] py-[14px] text-[18px] gap-[12px]",
    };

    const iconSizes = {
      sm: 16,
      md: 20,
      lg: 22,
      xl: 24,
    };

    // Variant configurations
    const variantClasses = {
      primary: {
        base: "bg-[#039855] text-white border border-[#039855]",
        hover: "hover:bg-[#027a48]",
        active: "active:bg-[#05603a]",
        disabled: "disabled:bg-[#D1FAE5] disabled:border-[#D1FAE5] disabled:text-[#6CE9A6]",
        error: "border-[#DC2626] bg-[#DC2626]",
      },
      secondary: {
        base: "bg-white text-[#027a48] border border-[#d0d5dd]",
        hover: "hover:bg-[#f9fafb] hover:border-[#84caff]",
        active: "active:bg-[#f2f4f7]",
        disabled: "disabled:bg-[#f9fafb] disabled:border-[#eaecf0] disabled:text-[#98a2b3]",
        error: "border-[#DC2626] text-[#DC2626]",
      },
      outline: {
        base: "bg-transparent text-[#344054] border border-[#d0d5dd]",
        hover: "hover:bg-[#f9fafb]",
        active: "active:bg-[#f2f4f7]",
        disabled: "disabled:bg-transparent disabled:border-[#eaecf0] disabled:text-[#98a2b3]",
        error: "border-[#DC2626] text-[#DC2626]",
      },
      ghost: {
        base: "bg-transparent text-[#344054] border-none",
        hover: "hover:bg-[#f9fafb]",
        active: "active:bg-[#f2f4f7]",
        disabled: "disabled:bg-transparent disabled:text-[#98a2b3]",
        error: "text-[#DC2626]",
      },
      text: {
        base: "bg-transparent text-[#027a48] border-none",
        hover: "hover:text-[#039855]",
        active: "active:text-[#05603a]",
        disabled: "disabled:text-[#98a2b3]",
        error: "text-[#DC2626]",
      },
      destructive: {
        base: "bg-[#DC2626] text-white border border-[#DC2626]",
        hover: "hover:bg-[#B91C1C]",
        active: "active:bg-[#991B1B]",
        disabled: "disabled:bg-[#FEE2E2] disabled:border-[#FEE2E2] disabled:text-[#FCA5A5]",
        error: "border-[#DC2626] bg-[#DC2626]",
      },
      success: {
        base: "bg-[#12B76A] text-white border border-[#12B76A]",
        hover: "hover:bg-[#0F9A5C]",
        active: "active:bg-[#0D8050]",
        disabled: "disabled:bg-[#D1FADF] disabled:border-[#D1FADF] disabled:text-[#6CE9A6]",
        error: "border-[#DC2626] bg-[#DC2626]",
      },
      warning: {
        base: "bg-[#F79009] text-white border border-[#F79009]",
        hover: "hover:bg-[#DC6803]",
        active: "active:bg-[#B54708]",
        disabled: "disabled:bg-[#FEF0C7] disabled:border-[#FEF0C7] disabled:text-[#FEC84B]",
        error: "border-[#DC2626] bg-[#DC2626]",
      },
    };

    const currentVariant = variantClasses[variant];
    const isIconOnly = iconPosition === "only";

    // Build class names
    const buttonClasses = `
      content-stretch flex items-center justify-center overflow-clip relative rounded-[8px] shrink-0
      font-['General_Sans:Semibold',sans-serif] leading-[20px] not-italic
      transition-all duration-200 cursor-pointer
      shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]
      disabled:cursor-not-allowed disabled:opacity-50
      focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#039855]
      ${sizeClasses[size]}
      ${currentVariant.base}
      ${!disabled && !isLoading ? currentVariant.hover : ""}
      ${!disabled && !isLoading ? currentVariant.active : ""}
      ${disabled ? currentVariant.disabled : ""}
      ${hasError ? currentVariant.error : ""}
      ${fullWidth ? "w-full" : ""}
      ${isIconOnly ? "aspect-square px-[10px]" : ""}
      ${className}
    `.trim().replace(/\s+/g, " ");

    // Determine what icon to show
    const displayIcon = isLoading ? <LoaderIcon size={iconSizes[size]} /> : icon;

    return (
      <button
        ref={ref}
        className={buttonClasses}
        disabled={disabled || isLoading}
        data-variant={variant}
        data-size={size}
        {...validProps}
      >
        {/* Leading Icon */}
        {iconPosition === "leading" && displayIcon}
        
        {/* Icon Only */}
        {iconPosition === "only" && displayIcon}
        
        {/* Button Text */}
        {!isIconOnly && (
          <span className="text-nowrap">{children}</span>
        )}
        
        {/* Trailing Icon */}
        {iconPosition === "trailing" && displayIcon}
      </button>
    );
  }
);

Button.displayName = "Button";

// ============================================
// PRE-CONFIGURED BUTTON VARIANTS
// ============================================

/**
 * Primary Button - Green background with white text
 */
export function PrimaryButton(props: ButtonProps) {
  return <Button variant="primary" {...props} />;
}

/**
 * Secondary Button - White background with green text
 */
export function SecondaryButton(props: ButtonProps) {
  return <Button variant="secondary" {...props} />;
}

export interface PriButtonProps extends ButtonProps {
  /**
   * Convenient shorthand for button text when you don't want to pass children
   */
  text?: ReactNode;
}

export function PriButton({ text, children, ...props }: PriButtonProps) {
  return (
    <PrimaryButton {...props}>
      {text ?? children}
    </PrimaryButton>
  );
}

export interface SecButtonProps extends ButtonProps {
  /**
   * Convenient shorthand for button text when you don't want to pass children
   */
  text?: ReactNode;
}

export function SecButton({ text, children, ...props }: SecButtonProps) {
  return (
    <SecondaryButton {...props}>
      {text ?? children}
    </SecondaryButton>
  );
}

/**
 * Outline Button - Transparent with border
 */
export function OutlineButton(props: ButtonProps) {
  return <Button variant="outline" {...props} />;
}

/**
 * Ghost Button - No border, minimal styling
 */
export function GhostButton(props: ButtonProps) {
  return <Button variant="ghost" {...props} />;
}

/**
 * Text Button - No background or border
 */
export function TextButton(props: ButtonProps) {
  return <Button variant="text" {...props} />;
}

/**
 * Destructive Button - Red background for dangerous actions
 */
export function DestructiveButton(props: ButtonProps) {
  return <Button variant="destructive" {...props} />;
}

/**
 * Success Button - Green variant
 */
export function SuccessButton(props: ButtonProps) {
  return <Button variant="success" {...props} />;
}

/**
 * Warning Button - Orange/Yellow variant
 */
export function WarningButton(props: ButtonProps) {
  return <Button variant="warning" {...props} />;
}

// ============================================
// ICON BUTTON VARIANTS
// ============================================

/**
 * Icon Only Button
 */
export function IconButton(props: Omit<ButtonProps, 'iconPosition'>) {
  return <Button iconPosition="only" {...props} />;
}

// ============================================
// SOCIAL LOGIN BUTTONS
// ============================================

export interface SocialButtonProps extends Omit<ButtonProps, 'icon' | 'iconPosition' | 'children' | 'variant'> {
  /**
   * Social platform
   */
  platform: 'google' | 'facebook' | 'twitter' | 'instagram' | 'linkedin' | 'github' | 'apple';
  
  /**
   * Custom button text
   */
  text?: string;
}

/**
 * Social Login Button
 */
export function SocialButton({ platform, text, fullWidth, className, ...props }: SocialButtonProps) {
  const platformConfig = {
    google: {
      icon: <GoogleIcon size={24} />,
      text: text || "Sign in with Google",
      color: "#344054",
    },
    facebook: {
      icon: <FacebookIcon size={20} />,
      text: text || "Sign in with Facebook",
      color: "#1877F2",
    },
    twitter: {
      icon: <TwitterIcon size={20} />,
      text: text || "Sign in with Twitter",
      color: "#1DA1F2",
    },
    instagram: {
      icon: <InstagramIcon size={20} />,
      text: text || "Sign in with Instagram",
      color: "#E4405F",
    },
    linkedin: {
      icon: <LinkedInIcon size={20} />,
      text: text || "Sign in with LinkedIn",
      color: "#0A66C2",
    },
    github: {
      icon: <GitHubIcon size={20} />,
      text: text || "Sign in with GitHub",
      color: "#181717",
    },
    apple: {
      icon: <AppleIcon size={20} />,
      text: text || "Sign in with Apple",
      color: "#000000",
    },
  };

  const config = platformConfig[platform];

  return (
    <button
      className={`
        bg-white relative rounded-[8px] shrink-0
        content-stretch flex gap-[12px] items-center justify-center overflow-clip px-[16px] py-[10px]
        font-['General_Sans:Semibold',sans-serif] leading-[24px] not-italic text-[16px] text-nowrap
        border border-[#d0d5dd] shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]
        hover:bg-[#f9fafb] hover:border-[#84caff]
        active:bg-[#f2f4f7]
        disabled:bg-[#f9fafb] disabled:border-[#eaecf0] disabled:text-[#98a2b3] disabled:cursor-not-allowed
        transition-all duration-200 cursor-pointer
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#039855]
        ${fullWidth ? "w-full" : ""}
        ${className || ""}
      `.trim().replace(/\s+/g, " ")}
      {...props}
    >
      {config.icon}
      <span style={{ color: config.color }}>{config.text}</span>
    </button>
  );
}

/**
 * Google Sign In Button
 */
export function GoogleSignInButton(props: Omit<SocialButtonProps, 'platform'>) {
  return <SocialButton platform="google" {...props} />;
}

/**
 * Facebook Sign In Button
 */
export function FacebookSignInButton(props: Omit<SocialButtonProps, 'platform'>) {
  return <SocialButton platform="facebook" {...props} />;
}

/**
 * Twitter Sign In Button
 */
export function TwitterSignInButton(props: Omit<SocialButtonProps, 'platform'>) {
  return <SocialButton platform="twitter" {...props} />;
}

/**
 * Instagram Sign In Button
 */
export function InstagramSignInButton(props: Omit<SocialButtonProps, 'platform'>) {
  return <SocialButton platform="instagram" {...props} />;
}

/**
 * LinkedIn Sign In Button
 */
export function LinkedInSignInButton(props: Omit<SocialButtonProps, 'platform'>) {
  return <SocialButton platform="linkedin" {...props} />;
}

/**
 * GitHub Sign In Button
 */
export function GitHubSignInButton(props: Omit<SocialButtonProps, 'platform'>) {
  return <SocialButton platform="github" {...props} />;
}

/**
 * Apple Sign In Button
 */
export function AppleSignInButton(props: Omit<SocialButtonProps, 'platform'>) {
  return <SocialButton platform="apple" {...props} />;
}

// ============================================
// COMMON USE CASE BUTTONS
// ============================================

/**
 * Submit Button - Primary button with loading state
 */
export function SubmitButton({ isLoading, children = "Submit", ...props }: ButtonProps) {
  return (
    <PrimaryButton isLoading={isLoading} {...props}>
      {children}
    </PrimaryButton>
  );
}

/**
 * Cancel Button - Secondary button
 */
export function CancelButton({ children = "Cancel", ...props }: ButtonProps) {
  return (
    <SecondaryButton {...props}>
      {children}
    </SecondaryButton>
  );
}

/**
 * Delete Button - Destructive with trash icon
 */
export function DeleteButton({ children = "Delete", ...props }: ButtonProps) {
  return (
    <DestructiveButton 
      icon={<TrashIcon size={20} />} 
      iconPosition="leading"
      {...props}
    >
      {children}
    </DestructiveButton>
  );
}

/**
 * Download Button - Primary with download icon
 */
export function DownloadButton({ children = "Download", ...props }: ButtonProps) {
  return (
    <PrimaryButton 
      icon={<DownloadIcon size={20} />} 
      iconPosition="leading"
      {...props}
    >
      {children}
    </PrimaryButton>
  );
}

/**
 * Upload Button - Secondary with upload icon
 */
export function UploadButton({ children = "Upload", ...props }: ButtonProps) {
  return (
    <SecondaryButton 
      icon={<UploadIcon size={20} />} 
      iconPosition="leading"
      {...props}
    >
      {children}
    </SecondaryButton>
  );
}

/**
 * Save Button - Primary with check icon
 */
export function SaveButton({ children = "Save", isLoading, ...props }: ButtonProps) {
  return (
    <PrimaryButton 
      icon={!isLoading ? <CheckIcon size={20} /> : undefined}
      iconPosition="leading"
      isLoading={isLoading}
      {...props}
    >
      {children}
    </PrimaryButton>
  );
}

/**
 * Next Button - Primary with arrow right
 */
export function NextButton({ children = "Next", ...props }: ButtonProps) {
  return (
    <PrimaryButton 
      icon={<ArrowRightIcon size={20} />} 
      iconPosition="trailing"
      {...props}
    >
      {children}
    </PrimaryButton>
  );
}

/**
 * Previous Button - Secondary with arrow left
 */
export function PreviousButton({ children = "Previous", ...props }: ButtonProps) {
  return (
    <SecondaryButton 
      icon={<ArrowLeftIcon size={20} />} 
      iconPosition="leading"
      {...props}
    >
      {children}
    </SecondaryButton>
  );
}

/**
 * Add Button - Primary with plus icon
 */
export function AddButton({ children = "Add", ...props }: ButtonProps) {
  return (
    <PrimaryButton 
      icon={<PlusIcon size={20} />} 
      iconPosition="leading"
      {...props}
    >
      {children}
    </PrimaryButton>
  );
}

/**
 * Search Button - Primary with search icon
 */
export function SearchButton({ children = "Search", ...props }: ButtonProps) {
  return (
    <PrimaryButton 
      icon={<SearchIcon size={20} />} 
      iconPosition="leading"
      {...props}
    >
      {children}
    </PrimaryButton>
  );
}

// Export all as default for convenience
export default Button;
