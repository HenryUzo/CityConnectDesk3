import { useState, ChangeEvent, FocusEvent, Fragment } from "react";
import { FLAG_COMPONENTS } from "./CountryFlags";

// ============================================
// ICON COMPONENTS FOR INPUT FIELDS
// ============================================

/**
 * Mail Icon Component (16px)
 * Used for email input fields
 */
export function MailIcon({ 
  color = "#667085", 
  size = 16,
  className = "" 
}: { 
  color?: string; 
  size?: number;
  className?: string;
}) {
  return (
    <div className={`relative shrink-0 ${className}`} style={{ width: size, height: size }} data-name="mail">
      <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 16 16">
        <g id="mail">
          <path 
            d="M14.6667 4C14.6667 3.26667 14.0667 2.66667 13.3333 2.66667H2.66667C1.93333 2.66667 1.33333 3.26667 1.33333 4M14.6667 4V12C14.6667 12.7333 14.0667 13.3333 13.3333 13.3333H2.66667C1.93333 13.3333 1.33333 12.7333 1.33333 12V4M14.6667 4L8 8.66667L1.33333 4" 
            id="Icon" 
            stroke={color}
            strokeLinecap="round" 
            strokeLinejoin="round" 
            strokeWidth="1.66667" 
          />
        </g>
      </svg>
    </div>
  );
}

/**
 * ChevronDown Icon Component (20px)
 * Used for dropdown indicators
 */
export function ChevronDownIcon({ 
  color = "#667085", 
  size = 20,
  className = "" 
}: { 
  color?: string; 
  size?: number;
  className?: string;
}) {
  return (
    <div className={`relative shrink-0 ${className}`} style={{ width: size, height: size }} data-name="chevron-down">
      <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 20 20">
        <g id="chevron-down">
          <path 
            d="M5 7.5L10 12.5L15 7.5" 
            id="Icon" 
            stroke={color}
            strokeLinecap="round" 
            strokeLinejoin="round" 
            strokeWidth="1.66667" 
          />
        </g>
      </svg>
    </div>
  );
}

// ============================================
// BASE INPUT FIELD COMPONENT
// ============================================

export interface InputFieldProps {
  /**
   * Input label
   */
  label?: string;
  /**
   * Input type (text, email, password, tel, etc.)
   */
  type?: string;
  /**
   * Placeholder text
   */
  placeholder?: string;
  /**
   * Input value (for controlled component)
   */
  value?: string;
  /**
   * Default value (for uncontrolled component)
   */
  defaultValue?: string;
  /**
   * Disabled state
   */
  disabled?: boolean;
  /**
   * Read-only state
   */
  readOnly?: boolean;
  /**
   * Required field
   */
  required?: boolean;
  /**
   * Error state
   */
  error?: boolean;
  /**
   * Error message
   */
  errorMessage?: string;
  /**
   * Helper text
   */
  helperText?: string;
  /**
   * Leading icon component
   */
  leadingIcon?: React.ReactNode;
  /**
   * Trailing icon component
   */
  trailingIcon?: React.ReactNode;
  /**
   * Prefix content (e.g., dropdown for phone country code)
   */
  prefix?: React.ReactNode;
  /**
   * Change handler
   */
  onChange?: (event: ChangeEvent<HTMLInputElement>) => void;
  /**
   * Blur handler
   */
  onBlur?: (event: FocusEvent<HTMLInputElement>) => void;
  /**
   * Focus handler
   */
  onFocus?: (event: FocusEvent<HTMLInputElement>) => void;
  /**
   * Key press handler
   */
  onKeyPress?: (event: React.KeyboardEvent<HTMLInputElement>) => void;
  /**
   * Additional CSS classes
   */
  className?: string;
  /**
   * Input name attribute
   */
  name?: string;
  /**
   * Input id attribute
   */
  id?: string;
}

/**
 * Base Input Field Component
 * 
 * A flexible input field with support for labels, icons, prefixes, validation, and more.
 * Follows the design system with proper spacing, colors, and states.
 * 
 * @example
 * // Basic input
 * <InputField
 *   label="Email"
 *   type="email"
 *   placeholder="olivia@untitledui.com"
 * />
 * 
 * @example
 * // Input with icon
 * <InputField
 *   label="Email"
 *   type="email"
 *   placeholder="olivia@untitledui.com"
 *   leadingIcon={<MailIcon />}
 * />
 * 
 * @example
 * // Input with error
 * <InputField
 *   label="Email"
 *   type="email"
 *   value="invalid-email"
 *   error={true}
 *   errorMessage="Please enter a valid email address"
 * />
 */
export function InputField({
  label,
  type = "text",
  placeholder,
  value,
  defaultValue,
  disabled = false,
  readOnly = false,
  required = false,
  error = false,
  errorMessage,
  helperText,
  leadingIcon,
  trailingIcon,
  prefix,
  onChange,
  onBlur,
  onFocus,
  className = "",
  name,
  id,
}: InputFieldProps) {
  const [isFocused, setIsFocused] = useState(false);

  const handleFocus = (e: FocusEvent<HTMLInputElement>) => {
    setIsFocused(true);
    onFocus?.(e);
  };

  const handleBlur = (e: FocusEvent<HTMLInputElement>) => {
    setIsFocused(false);
    onBlur?.(e);
  };

  // Determine border color based on state
  const borderColor = error 
    ? "#fda29b" // Error state
    : isFocused 
    ? "#84caff" // Focus state
    : "#f2f4f7"; // Default state

  const inputId = id || name || `input-${label?.toLowerCase().replace(/\s+/g, "-")}`;

  return (
    <div className={`content-stretch flex flex-col gap-[6px] items-start relative shrink-0 w-full ${className}`} data-name="Input field">
      {/* Label */}
      {label && (
        <label
          htmlFor={inputId}
          className="font-['General_Sans:Medium',sans-serif] leading-[1.32] not-italic relative shrink-0 text-[#344054] text-[12px] text-nowrap"
        >
          {label}
          {required && <span className="text-[#f04438] ml-0.5">*</span>}
        </label>
      )}

      {/* Input Container */}
      <div className="bg-white min-w-[200px] relative rounded-[8px] shrink-0 w-full" data-name="Input">
        <div className="flex flex-row items-center min-w-[inherit] overflow-clip rounded-[inherit] size-full">
          <div className="content-stretch flex gap-[8px] items-center min-w-[inherit] px-[12px] py-[6px] relative w-full">
            {/* Prefix (e.g., country code dropdown) */}
            {prefix && (
              <div className="flex items-center shrink-0">
                {prefix}
              </div>
            )}
            
            {/* Leading Icon */}
            {leadingIcon && !prefix && (
              <div className="flex items-center shrink-0">
                {leadingIcon}
              </div>
            )}
            
            {/* Input */}
            <input
              id={inputId}
              name={name}
              type={type}
              placeholder={placeholder}
              value={value}
              defaultValue={defaultValue}
              disabled={disabled}
              readOnly={readOnly}
              required={required}
              onChange={onChange}
              onFocus={handleFocus}
              onBlur={handleBlur}
              className={`
                basis-0 grow min-h-px min-w-px
                font-['General_Sans:Regular',sans-serif] 
                leading-[24px] 
                text-[12px]
                ${disabled ? 'text-[#98a2b3] bg-gray-50 cursor-not-allowed' : 'text-[#101828]'}
                ${!value && !defaultValue ? 'text-[#667085]' : ''}
                bg-transparent
                border-none
                outline-none
                placeholder:text-[#667085]
              `}
            />
            
            {/* Trailing Icon */}
            {trailingIcon && (
              <div className="flex items-center shrink-0">
                {trailingIcon}
              </div>
            )}
          </div>
        </div>
        
        {/* Border */}
        <div 
          aria-hidden="true" 
          className="absolute border border-solid inset-[-1px] pointer-events-none rounded-[9px] shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)] transition-colors"
          style={{ borderColor }}
        />
      </div>

      {/* Helper Text or Error Message */}
      {(helperText || (error && errorMessage)) && (
        <p className={`font-['General_Sans:Regular',sans-serif] text-[11px] leading-[16px] ${
          error ? 'text-[#f04438]' : 'text-[#667085]'
        }`}>
          {error && errorMessage ? errorMessage : helperText}
        </p>
      )}
    </div>
  );
}

// ============================================
// EMAIL INPUT FIELD
// ============================================

export interface EmailInputFieldProps extends Omit<InputFieldProps, 'type' | 'leadingIcon'> {
  /**
   * Show mail icon
   */
  showIcon?: boolean;
}

/**
 * Email Input Field Component
 * 
 * Pre-configured email input with optional mail icon.
 * 
 * @example
 * <EmailInputField
 *   label="Email"
 *   placeholder="olivia@untitledui.com"
 *   showIcon={true}
 * />
 */
export function EmailInputField({
  showIcon = false,
  placeholder = "olivia@untitledui.com",
  ...props
}: EmailInputFieldProps) {
  return (
    <InputField
      type="email"
      placeholder={placeholder}
      leadingIcon={showIcon ? <MailIcon /> : undefined}
      {...props}
    />
  );
}

// ============================================
// PHONE INPUT FIELD WITH COUNTRY CODE
// ============================================

// Comprehensive country data with codes, names, phone prefixes, and flag emojis
export const COUNTRIES = [
  { code: "US", name: "United States", dialCode: "+1", flag: "🇺🇸" },
  { code: "GB", name: "United Kingdom", dialCode: "+44", flag: "🇬🇧" },
  { code: "CA", name: "Canada", dialCode: "+1", flag: "🇨🇦" },
  { code: "AU", name: "Australia", dialCode: "+61", flag: "🇦🇺" },
  { code: "NZ", name: "New Zealand", dialCode: "+64", flag: "🇳🇿" },
  { code: "IN", name: "India", dialCode: "+91", flag: "🇮🇳" },
  { code: "CN", name: "China", dialCode: "+86", flag: "🇨🇳" },
  { code: "JP", name: "Japan", dialCode: "+81", flag: "🇯🇵" },
  { code: "KR", name: "South Korea", dialCode: "+82", flag: "🇰🇷" },
  { code: "SG", name: "Singapore", dialCode: "+65", flag: "🇸🇬" },
  { code: "MY", name: "Malaysia", dialCode: "+60", flag: "🇲🇾" },
  { code: "TH", name: "Thailand", dialCode: "+66", flag: "🇹🇭" },
  { code: "VN", name: "Vietnam", dialCode: "+84", flag: "🇻🇳" },
  { code: "PH", name: "Philippines", dialCode: "+63", flag: "🇵🇭" },
  { code: "ID", name: "Indonesia", dialCode: "+62", flag: "🇮🇩" },
  { code: "AE", name: "United Arab Emirates", dialCode: "+971", flag: "🇦🇪" },
  { code: "SA", name: "Saudi Arabia", dialCode: "+966", flag: "🇸🇦" },
  { code: "IL", name: "Israel", dialCode: "+972", flag: "🇮🇱" },
  { code: "TR", name: "Turkey", dialCode: "+90", flag: "🇹🇷" },
  { code: "ZA", name: "South Africa", dialCode: "+27", flag: "🇿🇦" },
  { code: "NG", name: "Nigeria", dialCode: "+234", flag: "🇳🇬" },
  { code: "KE", name: "Kenya", dialCode: "+254", flag: "🇰🇪" },
  { code: "EG", name: "Egypt", dialCode: "+20", flag: "🇪🇬" },
  { code: "BR", name: "Brazil", dialCode: "+55", flag: "🇧🇷" },
  { code: "MX", name: "Mexico", dialCode: "+52", flag: "🇲🇽" },
  { code: "AR", name: "Argentina", dialCode: "+54", flag: "🇦🇷" },
  { code: "CL", name: "Chile", dialCode: "+56", flag: "🇨🇱" },
  { code: "CO", name: "Colombia", dialCode: "+57", flag: "🇨🇴" },
  { code: "PE", name: "Peru", dialCode: "+51", flag: "🇵🇪" },
  { code: "DE", name: "Germany", dialCode: "+49", flag: "🇩🇪" },
  { code: "FR", name: "France", dialCode: "+33", flag: "🇫🇷" },
  { code: "IT", name: "Italy", dialCode: "+39", flag: "🇮🇹" },
  { code: "ES", name: "Spain", dialCode: "+34", flag: "🇪🇸" },
  { code: "PT", name: "Portugal", dialCode: "+351", flag: "🇹" },
  { code: "NL", name: "Netherlands", dialCode: "+31", flag: "🇳🇱" },
  { code: "BE", name: "Belgium", dialCode: "+32", flag: "🇧🇪" },
  { code: "CH", name: "Switzerland", dialCode: "+41", flag: "🇨🇭" },
  { code: "AT", name: "Austria", dialCode: "+43", flag: "🇦🇹" },
  { code: "SE", name: "Sweden", dialCode: "+46", flag: "🇸🇪" },
  { code: "NO", name: "Norway", dialCode: "+47", flag: "🇳🇴" },
  { code: "DK", name: "Denmark", dialCode: "+45", flag: "🇩🇰" },
  { code: "FI", name: "Finland", dialCode: "+358", flag: "🇫🇮" },
  { code: "PL", name: "Poland", dialCode: "+48", flag: "🇵🇱" },
  { code: "CZ", name: "Czech Republic", dialCode: "+420", flag: "🇨🇿" },
  { code: "HU", name: "Hungary", dialCode: "+36", flag: "🇭🇺" },
  { code: "RO", name: "Romania", dialCode: "+40", flag: "🇷🇴" },
  { code: "GR", name: "Greece", dialCode: "+30", flag: "🇬🇷" },
  { code: "RU", name: "Russia", dialCode: "+7", flag: "🇷🇺" },
  { code: "UA", name: "Ukraine", dialCode: "+380", flag: "🇺🇦" },
  { code: "IE", name: "Ireland", dialCode: "+353", flag: "🇮🇪" },
  { code: "IS", name: "Iceland", dialCode: "+354", flag: "🇮🇸" },
  { code: "LU", name: "Luxembourg", dialCode: "+352", flag: "🇱🇺" },
  { code: "HK", name: "Hong Kong", dialCode: "+852", flag: "🇭🇰" },
  { code: "TW", name: "Taiwan", dialCode: "+886", flag: "🇹🇼" },
  { code: "PK", name: "Pakistan", dialCode: "+92", flag: "🇵🇰" },
  { code: "BD", name: "Bangladesh", dialCode: "+880", flag: "🇧🇩" },
  { code: "LK", name: "Sri Lanka", dialCode: "+94", flag: "🇱🇰" },
  { code: "NP", name: "Nepal", dialCode: "+977", flag: "🇳🇵" },
  { code: "AF", name: "Afghanistan", dialCode: "+93", flag: "🇦🇫" },
  { code: "IQ", name: "Iraq", dialCode: "+964", flag: "🇮🇶" },
  { code: "IR", name: "Iran", dialCode: "+98", flag: "🇮🇷" },
  { code: "JO", name: "Jordan", dialCode: "+962", flag: "🇯🇴" },
  { code: "KW", name: "Kuwait", dialCode: "+965", flag: "🇰🇼" },
  { code: "LB", name: "Lebanon", dialCode: "+961", flag: "🇱🇧" },
  { code: "OM", name: "Oman", dialCode: "+968", flag: "🇴🇲" },
  { code: "QA", name: "Qatar", dialCode: "+974", flag: "🇶🇦" },
  { code: "SY", name: "Syria", dialCode: "+963", flag: "🇸🇾" },
  { code: "YE", name: "Yemen", dialCode: "+967", flag: "🇾🇪" },
  { code: "BH", name: "Bahrain", dialCode: "+973", flag: "🇧🇭" },
  { code: "AD", name: "Andorra", dialCode: "+376", flag: "🇦🇩" },
  { code: "AL", name: "Albania", dialCode: "+355", flag: "🇦🇱" },
  { code: "AO", name: "Angola", dialCode: "+244", flag: "🇦🇴" },
  { code: "AI", name: "Anguilla", dialCode: "+1264", flag: "🇦🇮" },
  { code: "AG", name: "Antigua and Barbuda", dialCode: "+1268", flag: "🇦🇬" },
  { code: "AM", name: "Armenia", dialCode: "+374", flag: "🇦🇲" },
  { code: "AW", name: "Aruba", dialCode: "+297", flag: "🇦🇼" },
  { code: "AZ", name: "Azerbaijan", dialCode: "+994", flag: "🇦🇿" },
  { code: "BS", name: "Bahamas", dialCode: "+1242", flag: "🇧🇸" },
  { code: "BB", name: "Barbados", dialCode: "+1246", flag: "🇧🇧" },
  { code: "BY", name: "Belarus", dialCode: "+375", flag: "🇧🇾" },
  { code: "BZ", name: "Belize", dialCode: "+501", flag: "🇧🇿" },
  { code: "BJ", name: "Benin", dialCode: "+229", flag: "🇧🇯" },
  { code: "BM", name: "Bermuda", dialCode: "+1441", flag: "🇧🇲" },
  { code: "BT", name: "Bhutan", dialCode: "+975", flag: "🇧🇹" },
  { code: "BN", name: "Brunei", dialCode: "+673", flag: "🇧🇳" },
  { code: "BG", name: "Bulgaria", dialCode: "+359", flag: "🇧🇬" },
  { code: "BF", name: "Burkina Faso", dialCode: "+226", flag: "🇧🇫" },
  { code: "BI", name: "Burundi", dialCode: "+257", flag: "🇧🇮" },
  { code: "KH", name: "Cambodia", dialCode: "+855", flag: "🇰🇭" },
  { code: "CM", name: "Cameroon", dialCode: "+237", flag: "🇨🇲" },
  { code: "KY", name: "Cayman Islands", dialCode: "+1345", flag: "🇰🇾" },
  { code: "CF", name: "Central African Republic", dialCode: "+236", flag: "🇨🇫" },
  { code: "TD", name: "Chad", dialCode: "+235", flag: "🇹🇩" },
  { code: "KM", name: "Comoros", dialCode: "+269", flag: "🇰🇲" },
  { code: "CK", name: "Cook Islands", dialCode: "+682", flag: "🇨🇰" },
  { code: "CR", name: "Costa Rica", dialCode: "+506", flag: "🇨🇷" },
  { code: "DJ", name: "Djibouti", dialCode: "+253", flag: "🇩🇯" },
  { code: "DM", name: "Dominica", dialCode: "+1767", flag: "🇩🇲" },
  { code: "EC", name: "Ecuador", dialCode: "+593", flag: "🇪🇨" },
  { code: "GQ", name: "Equatorial Guinea", dialCode: "+240", flag: "🇶" },
  { code: "ER", name: "Eritrea", dialCode: "+291", flag: "🇪🇷" },
  { code: "EE", name: "Estonia", dialCode: "+372", flag: "🇪🇪" },
  { code: "ET", name: "Ethiopia", dialCode: "+251", flag: "🇪🇹" },
  { code: "FK", name: "Falkland Islands", dialCode: "+500", flag: "🇫🇰" },
  { code: "FO", name: "Faroe Islands", dialCode: "+298", flag: "🇫🇴" },
  { code: "FJ", name: "Fiji", dialCode: "+679", flag: "🇫🇯" },
  { code: "GL", name: "Greenland", dialCode: "+299", flag: "🇬🇱" },
  { code: "GD", name: "Grenada", dialCode: "+1473", flag: "🇬🇩" },
  { code: "GU", name: "Guam", dialCode: "+1671", flag: "🇬🇺" },
  { code: "GT", name: "Guatemala", dialCode: "+502", flag: "🇬🇹" },
  { code: "GG", name: "Guernsey", dialCode: "+44", flag: "🇬🇬" },
  { code: "GN", name: "Guinea", dialCode: "+224", flag: "🇬🇳" },
  { code: "GW", name: "Guinea-Bissau", dialCode: "+245", flag: "🇬🇼" },
  { code: "GY", name: "Guyana", dialCode: "+592", flag: "🇬🇾" },
  { code: "HT", name: "Haiti", dialCode: "+509", flag: "🇭🇹" },
  { code: "HN", name: "Honduras", dialCode: "+504", flag: "🇭🇳" },
  { code: "KZ", name: "Kazakhstan", dialCode: "+7", flag: "🇰🇿" },
  { code: "KI", name: "Kiribati", dialCode: "+686", flag: "🇰🇮" },
  { code: "KG", name: "Kyrgyzstan", dialCode: "+996", flag: "🇰🇬" },
  { code: "LA", name: "Laos", dialCode: "+856", flag: "🇱🇦" },
  { code: "LV", name: "Latvia", dialCode: "+371", flag: "🇱🇻" },
  { code: "LS", name: "Lesotho", dialCode: "+266", flag: "🇱🇸" },
  { code: "LR", name: "Liberia", dialCode: "+231", flag: "🇱🇷" },
  { code: "LY", name: "Libya", dialCode: "+218", flag: "🇱🇾" },
  { code: "LI", name: "Liechtenstein", dialCode: "+423", flag: "🇱🇮" },
  { code: "LT", name: "Lithuania", dialCode: "+370", flag: "🇱🇹" },
  { code: "MA", name: "Morocco", dialCode: "+212", flag: "🇲🇦" },
  { code: "MC", name: "Monaco", dialCode: "+377", flag: "🇲🇨" },
  { code: "MD", name: "Moldova", dialCode: "+373", flag: "🇲🇩" },
  { code: "MN", name: "Mongolia", dialCode: "+976", flag: "🇲🇳" },
  { code: "ME", name: "Montenegro", dialCode: "+382", flag: "🇲🇪" },
  { code: "MS", name: "Montserrat", dialCode: "+1664", flag: "🇲🇸" },
  { code: "MZ", name: "Mozambique", dialCode: "+258", flag: "🇲🇿" },
  { code: "MM", name: "Myanmar", dialCode: "+95", flag: "🇲🇲" },
  { code: "NA", name: "Namibia", dialCode: "+264", flag: "🇳🇦" },
  { code: "NR", name: "Nauru", dialCode: "+674", flag: "🇳🇷" },
  { code: "NI", name: "Nicaragua", dialCode: "+505", flag: "🇳🇮" },
  { code: "NE", name: "Niger", dialCode: "+227", flag: "🇳🇪" },
  { code: "NU", name: "Niue", dialCode: "+683", flag: "🇳🇺" },
  { code: "PW", name: "Palau", dialCode: "+680", flag: "🇵🇼" },
  { code: "PS", name: "Palestine", dialCode: "+970", flag: "🇵🇸" },
  { code: "PA", name: "Panama", dialCode: "+507", flag: "🇵🇦" },
  { code: "PG", name: "Papua New Guinea", dialCode: "+675", flag: "🇵🇬" },
  { code: "PY", name: "Paraguay", dialCode: "+595", flag: "🇵🇾" },
  { code: "PN", name: "Pitcairn Islands", dialCode: "+64", flag: "🇵🇳" },
  { code: "PR", name: "Puerto Rico", dialCode: "+1", flag: "🇵🇷" },
  { code: "MK", name: "North Macedonia", dialCode: "+389", flag: "🇲🇰" },
  { code: "RS", name: "Serbia", dialCode: "+381", flag: "🇷🇸" },
  { code: "SC", name: "Seychelles", dialCode: "+248", flag: "🇸🇨" },
  { code: "SL", name: "Sierra Leone", dialCode: "+232", flag: "🇸🇱" },
  { code: "SX", name: "Sint Maarten", dialCode: "+1721", flag: "🇸🇽" },
  { code: "SK", name: "Slovakia", dialCode: "+421", flag: "🇸🇰" },
  { code: "SI", name: "Slovenia", dialCode: "+386", flag: "🇸🇮" },
  { code: "SB", name: "Solomon Islands", dialCode: "+677", flag: "🇸🇧" },
  { code: "SO", name: "Somalia", dialCode: "+252", flag: "🇸🇴" },
  { code: "SS", name: "South Sudan", dialCode: "+211", flag: "🇸🇸" },
  { code: "TJ", name: "Tajikistan", dialCode: "+992", flag: "🇹🇯" },
  { code: "TZ", name: "Tanzania", dialCode: "+255", flag: "🇹🇿" },
  { code: "TL", name: "Timor-Leste", dialCode: "+670", flag: "🇹🇱" },
  { code: "TG", name: "Togo", dialCode: "+228", flag: "🇹🇬" },
  { code: "TK", name: "Tokelau", dialCode: "+690", flag: "🇹🇰" },
  { code: "TO", name: "Tonga", dialCode: "+676", flag: "🇹🇴" },
  { code: "TT", name: "Trinidad and Tobago", dialCode: "+1868", flag: "🇹🇹" },
  { code: "TN", name: "Tunisia", dialCode: "+216", flag: "🇹🇳" },
  { code: "TM", name: "Turkmenistan", dialCode: "+993", flag: "🇹🇲" },
  { code: "TC", name: "Turks and Caicos Islands", dialCode: "+1649", flag: "🇹🇨" },
  { code: "TV", name: "Tuvalu", dialCode: "+688", flag: "🇹🇻" },
  { code: "UG", name: "Uganda", dialCode: "+256", flag: "🇺🇬" },
  { code: "UZ", name: "Uzbekistan", dialCode: "+998", flag: "🇺🇿" },
  { code: "VU", name: "Vanuatu", dialCode: "+678", flag: "🇻🇺" },
  { code: "VE", name: "Venezuela", dialCode: "+58", flag: "🇻🇪" },
  { code: "VG", name: "British Virgin Islands", dialCode: "+1284", flag: "🇻🇬" },
  { code: "VI", name: "U.S. Virgin Islands", dialCode: "+1340", flag: "🇻🇮" },
  { code: "WF", name: "Wallis and Futuna", dialCode: "+681", flag: "🇼🇫" },
  { code: "EH", name: "Western Sahara", dialCode: "+212", flag: "🇪🇭" },
  { code: "ZM", name: "Zambia", dialCode: "+260", flag: "🇿🇲" },
  { code: "ZW", name: "Zimbabwe", dialCode: "+263", flag: "🇿🇼" },
  { code: "FM", name: "Micronesia", dialCode: "+691", flag: "🇫🇲" },
];

export interface PhoneInputFieldProps extends Omit<InputFieldProps, 'type' | 'prefix'> {
  /**
   * Country code (e.g., "US", "GB", "FR")
   */
  countryCode?: string;
  /**
   * Show country code dropdown
   */
  showCountryDropdown?: boolean;
  /**
   * Country code change handler
   */
  onCountryCodeChange?: (countryCode: string) => void;
}

/**
 * Phone Input Field Component
 * 
 * Phone number input with country code dropdown prefix.
 * 
 * @example
 * <PhoneInputField
 *   label="Phone number"
 *   placeholder="+1 (555) 000-0000"
 *   countryCode="US"
 *   showCountryDropdown={true}
 * />
 */
export function PhoneInputField({
  countryCode = "US",
  showCountryDropdown = true,
  onCountryCodeChange,
  placeholder = "+1 (555) 000-0000",
  ...props
}: PhoneInputFieldProps) {
  const [selectedCountry, setSelectedCountry] = useState(countryCode);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const handleCountrySelect = (code: string) => {
    setSelectedCountry(code);
    setIsDropdownOpen(false);
    setSearchQuery("");
    onCountryCodeChange?.(code);
  };

  // Filter countries based on search query
  const filteredCountries = COUNTRIES.filter(country => 
    country.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    country.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
    country.dialCode.includes(searchQuery)
  );

  const currentCountry = COUNTRIES.find(c => c.code === selectedCountry) || COUNTRIES[0];
  
  // Get the flag component for the current country
  const CurrentFlagComponent = FLAG_COMPONENTS[selectedCountry];

  const countryDropdown = showCountryDropdown ? (
    <div 
      className="content-stretch flex items-center justify-between overflow-clip pr-[6px] cursor-pointer hover:bg-gray-50 transition-colors -ml-[6px] pl-[6px] py-[2px] rounded-md" 
      onClick={() => setIsDropdownOpen(!isDropdownOpen)}
      data-name="Country Dropdown"
    >
      <div className="flex items-center gap-1">
        {CurrentFlagComponent ? (
          <CurrentFlagComponent size={18} />
        ) : (
          <span className="text-[16px]">{currentCountry.flag}</span>
        )}
        <p className="font-['General_Sans:Regular',sans-serif] leading-[24px] not-italic text-[#101828] text-[12px] text-nowrap">
          {selectedCountry}
        </p>
      </div>
      <ChevronDownIcon size={20} color="#667085" />
    </div>
  ) : null;

  return (
    <div className="relative w-full">
      <InputField
        type="tel"
        placeholder={placeholder}
        prefix={countryDropdown}
        {...props}
      />

      {/* Dropdown Menu - positioned outside InputField */}
      {isDropdownOpen && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setIsDropdownOpen(false)}
          />
          
          {/* Dropdown Content */}
          <div className="absolute top-[calc(100%-6px)] left-[12px] mt-2 w-[280px] bg-white border border-[#d0d5dd] rounded-lg shadow-lg z-50 max-h-[320px] flex flex-col">
            {/* Search Input */}
            <div className="p-3 border-b border-[#f2f4f7]">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search countries..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full px-3 py-2 text-[12px] border border-[#d0d5dd] rounded-md outline-none focus:border-[#84caff] transition-colors font-['General_Sans:Regular',sans-serif]"
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
            </div>

            {/* Countries List */}
            <div className="overflow-y-auto flex-1">
              {filteredCountries.length > 0 ? (
                filteredCountries.map((country) => {
                  const FlagComponent = FLAG_COMPONENTS[country.code];
                  return (
                    <div
                      key={country.code}
                      className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-gray-50 transition-colors ${
                        country.code === selectedCountry ? 'bg-blue-50' : ''
                      }`}
                      onClick={() => handleCountrySelect(country.code)}
                    >
                      {FlagComponent ? (
                        <FlagComponent size={22} />
                      ) : (
                        <span className="text-[20px]">{country.flag}</span>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-['General_Sans:Medium',sans-serif] text-[12px] text-[#101828] truncate">
                          {country.name}
                        </p>
                        <p className="font-['General_Sans:Regular',sans-serif] text-[11px] text-[#667085]">
                          {country.code} • {country.dialCode}
                        </p>
                      </div>
                      {country.code === selectedCountry && (
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                          <path d="M13.3346 4L6.0013 11.3333L2.66797 8" stroke="#054f31" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      )}
                    </div>
                  );
                })
              ) : (
                <div className="px-3 py-8 text-center">
                  <p className="font-['General_Sans:Regular',sans-serif] text-[12px] text-[#667085]">
                    No countries found
                  </p>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ============================================
// PASSWORD INPUT FIELD
// ============================================

export interface PasswordInputFieldProps extends Omit<InputFieldProps, 'type' | 'trailingIcon'> {
  /**
   * Show password toggle button
   */
  showToggle?: boolean;
}

/**
 * Password Input Field Component
 * 
 * Password input with optional show/hide toggle.
 * 
 * @example
 * <PasswordInputField
 *   label="Password"
 *   placeholder="Enter your password"
 *   showToggle={true}
 * />
 */
export function PasswordInputField({
  showToggle = false,
  ...props
}: PasswordInputFieldProps) {
  const [showPassword, setShowPassword] = useState(false);

  const toggleButton = showToggle ? (
    <button
      type="button"
      onClick={() => setShowPassword(!showPassword)}
      className="text-[#667085] hover:text-[#344054] transition-colors text-[11px] font-['General_Sans:Medium',sans-serif]"
    >
      {showPassword ? "Hide" : "Show"}
    </button>
  ) : null;

  return (
    <InputField
      type={showPassword ? "text" : "password"}
      trailingIcon={toggleButton}
      {...props}
    />
  );
}

// ============================================
// SEARCH INPUT FIELD
// ============================================

export interface SearchInputFieldProps extends Omit<InputFieldProps, 'type'> {
  /**
   * Search handler
   */
  onSearch?: (query: string) => void;
}

/**
 * Search Input Field Component
 * 
 * Search input with magnifying glass icon.
 * 
 * @example
 * <SearchInputField
 *   placeholder="Search..."
 *   onSearch={(query) => console.log("Searching for:", query)}
 * />
 */
export function SearchInputField({
  onSearch,
  placeholder = "Search...",
  ...props
}: SearchInputFieldProps) {
  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && onSearch) {
      onSearch((e.target as HTMLInputElement).value);
    }
  };

  // Simple search icon (magnifying glass)
  const searchIcon = (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path
        d="M7 12C9.76142 12 12 9.76142 12 7C12 4.23858 9.76142 2 7 2C4.23858 2 2 4.23858 2 7C2 9.76142 4.23858 12 7 12Z"
        stroke="#667085"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M14 14L10.5 10.5"
        stroke="#667085"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );

  return (
    <InputField
      type="search"
      placeholder={placeholder}
      leadingIcon={searchIcon}
      onKeyPress={handleKeyPress as any}
      {...props}
    />
  );
}

// ============================================
// MASTERCARD ICON COMPONENT
// ============================================

import svgPaths from "../../imports/svg-xjqmzlhbx";

/**
 * Mastercard Icon Component
 * Used for card number inputs
 */
export function MastercardIcon({ 
  size = 23,
  className = "" 
}: { 
  size?: number;
  className?: string;
}) {
  return (
    <div 
      className={`bg-white relative rounded-[4px] shrink-0 ${className}`}
      style={{ width: size, height: Math.round(size * 0.696) }}
      data-name="Payment method icon"
    >
      <div aria-hidden="true" className="absolute border border-[#f2f4f7] border-solid inset-0 pointer-events-none rounded-[4px]" />
      <div className="absolute inset-[20.96%_16.59%_23.21%_17.65%]" data-name="Mastercard">
        <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 15.1248 8.93359">
          <g id="Mastercard">
            <path d={svgPaths.p2db8f700} fill="#ED0006" id="Left" />
            <path d={svgPaths.p3b6d7e00} fill="#F9A000" id="Right" />
            <path d={svgPaths.p16f9ff50} fill="#FF5E00" id="Middle" />
          </g>
        </svg>
      </div>
    </div>
  );
}

// ============================================
// CURRENCY INPUT FIELD WITH DROPDOWN
// ============================================

export interface CurrencyInputFieldProps extends Omit<InputFieldProps, 'type' | 'prefix' | 'trailingIcon'> {
  /**
   * Currency symbol (e.g., "$", "€", "£")
   */
  currencySymbol?: string;
  /**
   * Currency code (e.g., "USD", "EUR", "GBP")
   */
  currencyCode?: string;
  /**
   * Show currency dropdown
   */
  showCurrencyDropdown?: boolean;
  /**
   * Currency code change handler
   */
  onCurrencyCodeChange?: (currencyCode: string) => void;
}

/**
 * Currency Input Field Component
 * 
 * Currency input with symbol prefix and currency code dropdown.
 * 
 * @example
 * <CurrencyInputField
 *   label="Sale amount"
 *   placeholder="1,000.00"
 *   currencySymbol="$"
 *   currencyCode="USD"
 *   showCurrencyDropdown={true}
 * />
 */
export function CurrencyInputField({
  currencySymbol = "$",
  currencyCode = "USD",
  showCurrencyDropdown = true,
  onCurrencyCodeChange,
  placeholder = "1,000.00",
  ...props
}: CurrencyInputFieldProps) {
  const [selectedCurrency, setSelectedCurrency] = useState(currencyCode);

  const handleCurrencyChange = () => {
    // Toggle between currencies for demo
    const newCurrency = selectedCurrency === "USD" ? "EUR" : selectedCurrency === "EUR" ? "GBP" : "USD";
    setSelectedCurrency(newCurrency);
    onCurrencyCodeChange?.(newCurrency);
  };

  // Currency symbol prefix
  const currencyPrefix = (
    <div className="flex items-center shrink-0">
      <p className="font-['General_Sans:Regular',sans-serif] leading-[24px] text-[#667085] text-[12px]">
        {currencySymbol}
      </p>
    </div>
  );

  // Currency dropdown suffix
  const currencyDropdown = showCurrencyDropdown ? (
    <div 
      className="content-stretch flex items-center justify-between overflow-clip px-[12px] py-[6px] cursor-pointer hover:bg-gray-50 transition-colors -mr-[6px] rounded-md" 
      onClick={handleCurrencyChange}
      data-name="Currency Dropdown"
    >
      <p className="font-['General_Sans:Regular',sans-serif] leading-[24px] not-italic text-[#101828] text-[12px] text-nowrap">
        {selectedCurrency}
      </p>
      <ChevronDownIcon size={16} color="#667085" />
    </div>
  ) : null;

  return (
    <InputField
      type="text"
      placeholder={placeholder}
      leadingIcon={currencyPrefix}
      trailingIcon={currencyDropdown}
      {...props}
    />
  );
}

// ============================================
// URL INPUT FIELD WITH PREFIX
// ============================================

export interface URLInputFieldProps extends Omit<InputFieldProps, 'type'> {
  /**
   * URL protocol prefix (e.g., "http://", "https://")
   */
  urlPrefix?: string;
  /**
   * Show URL prefix
   */
  showPrefix?: boolean;
}

/**
 * URL Input Field Component
 * 
 * URL input with protocol prefix (http://, https://).
 * 
 * @example
 * <URLInputField
 *   label="Website"
 *   placeholder="www.untitledui.com"
 *   urlPrefix="http://"
 *   showPrefix={true}
 * />
 */
export function URLInputField({
  urlPrefix = "http://",
  showPrefix = true,
  placeholder = "www.untitledui.com",
  ...props
}: URLInputFieldProps) {
  // URL prefix add-on
  const prefixAddon = showPrefix ? (
    <div 
      className="content-stretch flex items-center pl-[12px] pr-[6px] py-[6px] shrink-0 bg-gray-50 border-r border-[#d0d5dd]" 
      data-name="Add-on"
    >
      <p className="font-['General_Sans:Regular',sans-serif] leading-[24px] not-italic text-[#667085] text-[12px] text-nowrap">
        {urlPrefix}
      </p>
    </div>
  ) : null;

  return (
    <InputField
      type="url"
      placeholder={placeholder}
      prefix={prefixAddon}
      {...props}
    />
  );
}

// ============================================
// CARD NUMBER INPUT FIELD
// ============================================

export interface CardNumberInputFieldProps extends Omit<InputFieldProps, 'type' | 'leadingIcon'> {
  /**
   * Show card icon
   */
  showCardIcon?: boolean;
  /**
   * Card type ("mastercard", "visa", "amex", etc.)
   */
  cardType?: string;
}

/**
 * Card Number Input Field Component
 * 
 * Card number input with payment card icon.
 * 
 * @example
 * <CardNumberInputField
 *   label="Card number"
 *   placeholder="1234 5678 9012 3456"
 *   showCardIcon={true}
 *   cardType="mastercard"
 * />
 */
export function CardNumberInputField({
  showCardIcon = true,
  cardType = "mastercard",
  placeholder = "Card number",
  ...props
}: CardNumberInputFieldProps) {
  // Card icon based on type
  const cardIcon = showCardIcon ? (
    cardType === "mastercard" ? <MastercardIcon /> : null
  ) : null;

  return (
    <InputField
      type="text"
      placeholder={placeholder}
      leadingIcon={cardIcon}
      {...props}
    />
  );
}

// ============================================
// TEXTAREA FIELD COMPONENT
// ============================================

export interface TextareaFieldProps {
  /**
   * Textarea label
   */
  label?: string;
  /**
   * Placeholder text
   */
  placeholder?: string;
  /**
   * Textarea value (for controlled component)
   */
  value?: string;
  /**
   * Default value (for uncontrolled component)
   */
  defaultValue?: string;
  /**
   * Disabled state
   */
  disabled?: boolean;
  /**
   * Read-only state
   */
  readOnly?: boolean;
  /**
   * Required field
   */
  required?: boolean;
  /**
   * Error state
   */
  error?: boolean;
  /**
   * Error message
   */
  errorMessage?: string;
  /**
   * Helper text
   */
  helperText?: string;
  /**
   * Number of rows (height)
   */
  rows?: number;
  /**
   * Change handler
   */
  onChange?: (event: ChangeEvent<HTMLTextAreaElement>) => void;
  /**
   * Blur handler
   */
  onBlur?: (event: FocusEvent<HTMLTextAreaElement>) => void;
  /**
   * Focus handler
   */
  onFocus?: (event: FocusEvent<HTMLTextAreaElement>) => void;
  /**
   * Additional CSS classes
   */
  className?: string;
  /**
   * Textarea name attribute
   */
  name?: string;
  /**
   * Textarea id attribute
   */
  id?: string;
}

/**
 * Textarea Field Component
 * 
 * A multiline text input with support for labels, validation, and more.
 * Follows the design system with proper spacing, colors, and states.
 * 
 * @example
 * // Basic textarea
 * <TextareaField
 *   label="Description"
 *   placeholder="Enter a description..."
 * />
 * 
 * @example
 * // Textarea with error
 * <TextareaField
 *   label="Description"
 *   value="Too short"
 *   error={true}
 *   errorMessage="Description must be at least 10 characters"
 * />
 */
export function TextareaField({
  label,
  placeholder = "Enter a description...",
  value,
  defaultValue,
  disabled = false,
  readOnly = false,
  required = false,
  error = false,
  errorMessage,
  helperText,
  rows = 4,
  onChange,
  onBlur,
  onFocus,
  className = "",
  name,
  id,
}: TextareaFieldProps) {
  const [isFocused, setIsFocused] = useState(false);

  const handleFocus = (e: FocusEvent<HTMLTextAreaElement>) => {
    setIsFocused(true);
    onFocus?.(e);
  };

  const handleBlur = (e: FocusEvent<HTMLTextAreaElement>) => {
    setIsFocused(false);
    onBlur?.(e);
  };

  // Determine border color based on state
  const borderColor = error 
    ? "#fda29b" // Error state
    : isFocused 
    ? "#84caff" // Focus state
    : "#d0d5dd"; // Default state

  const textareaId = id || name || `textarea-${label?.toLowerCase().replace(/\s+/g, "-")}`;

  return (
    <div className={`content-stretch flex flex-col gap-[6px] items-start relative shrink-0 w-full ${className}`} data-name="Textarea field">
      {/* Label */}
      {label && (
        <label
          htmlFor={textareaId}
          className="font-['General_Sans:Medium',sans-serif] leading-[24px] not-italic relative shrink-0 text-[#344054] text-[12px] text-nowrap"
        >
          {label}
          {required && <span className="text-[#f04438] ml-0.5">*</span>}
        </label>
      )}

      {/* Textarea Container */}
      <div className="bg-white min-w-[200px] relative rounded-[8px] shrink-0 w-full" data-name="Textarea">
        <div className="flex flex-row items-stretch overflow-clip rounded-[inherit] size-full">
          <div className="content-stretch flex items-start px-[14px] py-[10px] relative w-full">
            {/* Textarea */}
            <textarea
              id={textareaId}
              name={name}
              placeholder={placeholder}
              value={value}
              defaultValue={defaultValue}
              disabled={disabled}
              readOnly={readOnly}
              required={required}
              rows={rows}
              onChange={onChange}
              onFocus={handleFocus}
              onBlur={handleBlur}
              className={`
                w-full min-h-[96px] resize-y
                font-['General_Sans:Regular',sans-serif] 
                leading-[24px] 
                text-[12px]
                ${disabled ? 'text-[#98a2b3] bg-gray-50 cursor-not-allowed' : 'text-[#101828]'}
                ${!value && !defaultValue ? 'text-[#667085]' : ''}
                bg-transparent
                border-none
                outline-none
                placeholder:text-[#667085]
              `}
            />
          </div>
        </div>
        
        {/* Border */}
        <div 
          aria-hidden="true" 
          className="absolute border border-solid inset-0 pointer-events-none rounded-[8px] shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)] transition-colors"
          style={{ borderColor }}
        />
      </div>

      {/* Helper Text or Error Message */}
      {(helperText || (error && errorMessage)) && (
        <p className={`font-['General_Sans:Regular',sans-serif] text-[11px] leading-[16px] ${
          error ? 'text-[#f04438]' : 'text-[#667085]'
        }`}>
          {error && errorMessage ? errorMessage : helperText}
        </p>
      )}
    </div>
  );
}

export default InputField;

// ============================================
// VERIFICATION CODE INPUT FIELD
// ============================================

export interface VerificationCodeInputFieldProps {
  /**
   * Field label
   */
  label?: string;
  /**
   * Number of digit boxes (default: 4)
   */
  length?: number;
  /**
   * Helper text
   */
  helperText?: string;
  /**
   * Error state
   */
  error?: boolean;
  /**
   * Error message
   */
  errorMessage?: string;
  /**
   * Completion handler - called when all digits are filled
   */
  onComplete?: (code: string) => void;
  /**
   * Change handler - called on any digit change
   */
  onChange?: (code: string) => void;
  /**
   * Additional CSS classes
   */
  className?: string;
  /**
   * Disabled state
   */
  disabled?: boolean;
  /**
   * Separator configuration (e.g., { char: "-", position: 3 } for dash after 3rd digit)
   */
  separator?: {
    char: string;
    position: number;
  };
}

/**
 * Verification Code Input Field Component
 * 
 * A specialized input for verification codes (OTP, PIN, etc.) with auto-focus navigation.
 * Each digit has its own box with large text display.
 * 
 * @example
 * // Basic usage
 * <VerificationCodeInputField
 *   label="Secure code"
 *   length={4}
 *   helperText="This is a hint text to help user."
 *   onComplete={(code) => console.log("Code:", code)}
 * />
 * 
 * @example
 * // With error state
 * <VerificationCodeInputField
 *   label="Verification code"
 *   length={6}
 *   error={true}
 *   errorMessage="Invalid code. Please try again."
 * />
 */
export function VerificationCodeInputField({
  label = "Secure code",
  length = 4,
  helperText = "This is a hint text to help user.",
  error = false,
  errorMessage,
  onComplete,
  onChange,
  className = "",
  disabled = false,
  separator,
}: VerificationCodeInputFieldProps) {
  const [values, setValues] = useState<string[]>(Array(length).fill(""));
  const [focusedIndex, setFocusedIndex] = useState<number>(-1);
  const inputRefs = useState<Array<HTMLInputElement | null>>(() => Array(length).fill(null))[0];

  const handleChange = (index: number, value: string) => {
    // Only allow digits
    const digit = value.replace(/\D/g, "").slice(-1);
    
    const newValues = [...values];
    newValues[index] = digit;
    setValues(newValues);

    // Call onChange callback
    const code = newValues.join("");
    onChange?.(code);

    // Auto-focus next input if digit was entered
    if (digit && index < length - 1) {
      inputRefs[index + 1]?.focus();
    }

    // Call onComplete if all digits are filled
    if (digit && newValues.every(v => v !== "")) {
      onComplete?.(newValues.join(""));
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    // Handle backspace
    if (e.key === "Backspace") {
      if (!values[index] && index > 0) {
        // If current input is empty, go to previous input
        inputRefs[index - 1]?.focus();
      } else {
        // Clear current input
        const newValues = [...values];
        newValues[index] = "";
        setValues(newValues);
        onChange?.(newValues.join(""));
      }
    }
    // Handle arrow keys
    else if (e.key === "ArrowLeft" && index > 0) {
      inputRefs[index - 1]?.focus();
    } else if (e.key === "ArrowRight" && index < length - 1) {
      inputRefs[index + 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, length);
    const newValues = [...values];
    
    for (let i = 0; i < pastedData.length; i++) {
      newValues[i] = pastedData[i];
    }
    
    setValues(newValues);
    onChange?.(newValues.join(""));
    
    // Focus the next empty input or the last one
    const nextEmptyIndex = newValues.findIndex(v => v === "");
    const focusIndex = nextEmptyIndex === -1 ? length - 1 : nextEmptyIndex;
    inputRefs[focusIndex]?.focus();

    // Check if complete
    if (newValues.every(v => v !== "")) {
      onComplete?.(newValues.join(""));
    }
  };

  // Determine border color based on state
  const getBorderColor = (index: number) => {
    if (error) return "#fda29b";
    if (focusedIndex === index) return "#84caff";
    return "#d0d5dd";
  };

  return (
    <div className={`content-stretch flex flex-col gap-[6px] items-start relative shrink-0 w-full ${className}`} data-name="Verification code input field">
      {/* Label */}
      {label && (
        <p className="font-['General_Sans:Medium',sans-serif] leading-[20px] not-italic relative shrink-0 text-[#344054] text-[14px] text-nowrap">
          {label}
        </p>
      )}

      {/* Input Boxes */}
      <div className="content-stretch flex gap-[8px] items-start relative shrink-0" data-name="Input">
        {Array.from({ length }).map((_, index) => (
          <Fragment key={index}>
            <div 
              className="content-stretch flex flex-col items-start relative rounded-[8px] shrink-0 w-[64px]" 
              data-name="_Mega input field base"
            >
              <div className="bg-white h-[64px] relative rounded-[8px] shrink-0 w-full" data-name="Input">
                <div 
                  aria-hidden="true" 
                  className="absolute border border-solid inset-0 pointer-events-none rounded-[8px] shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)] transition-colors"
                  style={{ borderColor: getBorderColor(index) }}
                />
                <div className="flex flex-row items-center size-full">
                  <div className="content-stretch flex items-center p-[8px] relative size-full">
                    <input
                      ref={(el) => (inputRefs[index] = el)}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={values[index]}
                      disabled={disabled}
                      onChange={(e) => handleChange(index, e.target.value)}
                      onKeyDown={(e) => handleKeyDown(index, e)}
                      onPaste={handlePaste}
                      onFocus={() => setFocusedIndex(index)}
                      onBlur={() => setFocusedIndex(-1)}
                      className={`
                        basis-0 grow min-h-px min-w-px
                        font-['General_Sans:Medium',sans-serif]
                        leading-[60px]
                        text-[48px]
                        text-center
                        tracking-[-0.96px]
                        ${values[index] ? 'text-[#101828]' : 'text-[#d0d5dd]'}
                        ${disabled ? 'cursor-not-allowed opacity-50' : ''}
                        bg-transparent
                        border-none
                        outline-none
                        caret-[#054f31]
                      `}
                      placeholder="0"
                    />
                  </div>
                </div>
              </div>
            </div>
            
            {/* Separator (e.g., dash) */}
            {separator && index === separator.position - 1 && index < length - 1 && (
              <div 
                key={`sep-${index}`}
                className="flex flex-col font-['General_Sans:Medium',sans-serif] h-[64px] justify-center leading-[0] not-italic relative shrink-0 text-[#d0d5dd] text-[60px] text-center tracking-[-1.2px] w-[28px]"
              >
                <p className="leading-[72px]">{separator.char}</p>
              </div>
            )}
          </Fragment>
        ))}
      </div>

      {/* Helper Text or Error Message */}
      {(helperText || (error && errorMessage)) && (
        <p className={`font-['General_Sans:Regular',sans-serif] leading-[20px] not-italic relative shrink-0 text-[14px] text-nowrap ${
          error ? 'text-[#f04438]' : 'text-[#667085]'
        }`}>
          {error && errorMessage ? errorMessage : helperText}
        </p>
      )}
    </div>
  );
}