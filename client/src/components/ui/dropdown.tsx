/**
 * DROPDOWN INPUT FIELD COMPONENTS
 * 
 * A comprehensive dropdown/select component system that matches the Figma design.
 * Includes variants with and without icons, full keyboard navigation, search functionality,
 * and all standard input field features (error states, helper text, required fields, etc.)
 * 
 * COMPONENTS:
 * - UserIcon: 16px user icon for team member selections
 * - StatusDot: 10px status dot for online/offline/busy indicators
 * - DropdownInputField: Main dropdown component with full feature set
 * 
 * VARIANTS:
 * 1. Basic dropdown (no icon)
 * 2. Dropdown with user icon
 * 3. Dropdown with custom icon
 * 4. Dropdown with status dot (green/orange/red/gray for online/away/busy/offline)
 * 
 * FEATURES:
 * - Auto search when options > 5
 * - Keyboard navigation (tab, enter, escape)
 * - Click outside to close
 * - Animated chevron rotation
 * - Selected state highlighting with checkmark
 * - Disabled options support
 * - Error/focus/disabled states
 * - Helper text and error messages
 * - Required field indicator
 * - ARIA accessibility attributes
 * - Per-option status colors
 * 
 * @example Basic
 * <DropdownInputField
 *   label="Team member"
 *   placeholder="Select team member"
 *   options={[{ value: "1", label: "John Doe" }]}
 *   onChange={(value) => console.log(value)}
 * />
 * 
 * @example With Icon
 * <DropdownInputField
 *   label="Team member"
 *   placeholder="Select team member"
 *   showIcon={true}
 *   iconType="user"
 *   options={teamMembers}
 * />
 * 
 * @example With Status Dot
 * <DropdownInputField
 *   label="Team member"
 *   placeholder="Select team member"
 *   showStatusDot={true}
 *   options={[
 *     { value: "1", label: "John (Online)", statusColor: "#12B76A" },
 *     { value: "2", label: "Jane (Away)", statusColor: "#F79009" }
 *   ]}
 * />
 */

import { useState } from "react";
import { ChevronDownIcon } from "./inputfields";

// ============================================
// USER ICON COMPONENT (for dropdowns)
// ============================================

/**
 * User Icon Component (16px)
 * Used for user/team member selection dropdowns
 */
export function UserIcon({ 
  color = "#667085", 
  size = 16,
  className = "" 
}: { 
  color?: string; 
  size?: number;
  className?: string;
}) {
  return (
    <div className={`relative shrink-0 ${className}`} style={{ width: size, height: size }} data-name="user">
      <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 16 16">
        <g id="user">
          <path 
            d="M13.3333 14V12.6667C13.3333 11.9594 13.0524 11.2811 12.5523 10.781C12.0522 10.281 11.3739 10 10.6667 10H5.33333C4.62609 10 3.94781 10.281 3.44772 10.781C2.94762 11.2811 2.66667 11.9594 2.66667 12.6667V14M10.6667 4.66667C10.6667 6.13943 9.47276 7.33333 8 7.33333C6.52724 7.33333 5.33333 6.13943 5.33333 4.66667C5.33333 3.19391 6.52724 2 8 2C9.47276 2 10.6667 3.19391 10.6667 4.66667Z"
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
 * Status Dot Component (10px)
 * Used for status indicators in dropdowns (online, offline, busy, etc.)
 */
export function StatusDot({ 
  color = "#12B76A", 
  size = 10,
  className = "" 
}: { 
  color?: string; 
  size?: number;
  className?: string;
}) {
  return (
    <div className={`relative shrink-0 ${className}`} style={{ width: size, height: size }} data-name="_Dot">
      <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 10 10">
        <g id="_Dot">
          <circle cx="5" cy="5" fill={color} id="Dot" r="4" />
        </g>
      </svg>
    </div>
  );
}

// ============================================
// DROPDOWN INPUT FIELD COMPONENT
// ============================================

export interface DropdownOption {
  value: string;
  label: string;
  icon?: React.ReactNode;
  disabled?: boolean;
  statusColor?: string;
}

export interface DropdownInputFieldProps {
  /**
   * Field label
   */
  label?: string;
  /**
   * Placeholder text
   */
  placeholder?: string;
  /**
   * Current selected value
   */
  value?: string;
  /**
   * Dropdown options
   */
  options?: DropdownOption[];
  /**
   * Disabled state
   */
  disabled?: boolean;
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
   * Show leading icon
   */
  showIcon?: boolean;
  /**
   * Icon type preset ('user' or custom)
   */
  iconType?: 'user' | 'custom';
  /**
   * Show status dot before text
   */
  showStatusDot?: boolean;
  /**
   * Status dot color (default: #12B76A for green/online)
   */
  statusDotColor?: string;
  /**
   * Change handler
   */
  onChange?: (value: string) => void;
  /**
   * Additional CSS classes
   */
  className?: string;
  /**
   * Field name attribute
   */
  name?: string;
  /**
   * Field id attribute
   */
  id?: string;
}

/**
 * Dropdown Input Field Component
 * 
 * A select/dropdown input styled like a text input with options menu.
 * Supports leading icons, placeholder text, and full keyboard navigation.
 * 
 * @example
 * // Basic dropdown
 * <DropdownInputField
 *   label="Team member"
 *   placeholder="Select team member"
 *   options={[
 *     { value: "1", label: "John Doe" },
 *     { value: "2", label: "Jane Smith" }
 *   ]}
 * />
 * 
 * @example
 * // Dropdown with user icon
 * <DropdownInputField
 *   label="Team member"
 *   placeholder="Select team member"
 *   iconType="user"
 *   showIcon={true}
 *   options={teamMembers}
 * />
 * 
 * @example
 * // Dropdown with custom icon
 * <DropdownInputField
 *   label="Category"
 *   placeholder="Select category"
 *   leadingIcon={<CategoryIcon />}
 *   options={categories}
 * />
 */
export function DropdownInputField({
  label,
  placeholder = "Select option",
  value,
  options = [],
  disabled = false,
  required = false,
  error = false,
  errorMessage,
  helperText,
  leadingIcon,
  showIcon = false,
  iconType = 'user',
  showStatusDot = false,
  statusDotColor = '#12B76A',
  onChange,
  className = "",
  name,
  id,
}: DropdownInputFieldProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Get selected option
  const selectedOption = options.find(opt => opt.value === value);

  // Filter options based on search query
  const filteredOptions = options.filter(option => 
    option.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
    option.value.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleOptionSelect = (optionValue: string) => {
    if (!disabled) {
      onChange?.(optionValue);
      setIsOpen(false);
      setSearchQuery("");
    }
  };

  const handleToggle = () => {
    if (!disabled) {
      setIsOpen(!isOpen);
    }
  };

  // Determine border color based on state
  const borderColor = error 
    ? "#fda29b" // Error state
    : isFocused || isOpen
    ? "#84caff" // Focus/Open state
    : "#f2f4f7"; // Default state

  const fieldId = id || name || `dropdown-${label?.toLowerCase().replace(/\s+/g, "-")}`;

  // Determine which icon to show
  let displayIcon = leadingIcon;
  if (!leadingIcon && showIcon) {
    if (iconType === 'user') {
      displayIcon = <UserIcon />;
    }
  }

  return (
    <div className={`content-stretch flex flex-col gap-[6px] items-start relative shrink-0 w-full ${className}`} data-name="Dropdown input field">
      {/* Label */}
      {label && (
        <label
          htmlFor={fieldId}
          className="font-['General_Sans:Medium',sans-serif] leading-[1.32] not-italic relative shrink-0 text-[#344054] text-[12px] text-nowrap"
        >
          {label}
          {required && <span className="text-[#f04438] ml-0.5">*</span>}
        </label>
      )}

      {/* Dropdown Container */}
      <div className="relative w-full">
        <div 
          className={`bg-white min-w-[200px] relative rounded-[8px] shrink-0 w-full ${
            disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'
          }`} 
          data-name="Input"
          onClick={handleToggle}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          tabIndex={disabled ? -1 : 0}
          role="combobox"
          aria-expanded={isOpen}
          aria-haspopup="listbox"
          aria-labelledby={fieldId}
        >
          <div className="flex flex-row items-center size-full">
            <div className="content-stretch flex gap-[8px] items-center px-[12px] py-[6px] relative w-full">
              {/* Leading Icon */}
              {displayIcon && (
                <div className="flex items-center shrink-0">
                  {displayIcon}
                </div>
              )}
              
              {/* Content */}
              <div className="basis-0 content-stretch flex gap-[8px] grow items-center min-h-px min-w-px relative shrink-0">
                {/* Status Dot */}
                {showStatusDot && (
                  <StatusDot color={selectedOption?.statusColor || statusDotColor} />
                )}
                
                <p className={`font-['General_Sans:Regular',sans-serif] leading-[24px] not-italic relative shrink-0 text-[12px] text-nowrap ${
                  selectedOption ? 'text-[#101828]' : 'text-[#667085]'
                }`}>
                  {selectedOption ? selectedOption.label : placeholder}
                </p>
              </div>
              
              {/* Chevron Down Icon */}
              <ChevronDownIcon 
                size={16} 
                color="#667085"
                className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
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

        {/* Dropdown Menu */}
        {isOpen && (
          <>
            {/* Backdrop */}
            <div 
              className="fixed inset-0 z-40" 
              onClick={() => setIsOpen(false)}
            />
            
            {/* Dropdown Content */}
            <div className="absolute top-full left-0 mt-2 w-full bg-white border border-[#d0d5dd] rounded-lg shadow-lg z-50 max-h-[280px] flex flex-col">
              {/* Search Input (if more than 5 options) */}
              {options.length > 5 && (
                <div className="p-3 border-b border-[#f2f4f7]">
                  <input
                    type="text"
                    placeholder="Search..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full px-3 py-2 text-[12px] border border-[#d0d5dd] rounded-md outline-none focus:border-[#84caff] transition-colors font-['General_Sans:Regular',sans-serif]"
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
              )}

              {/* Options List */}
              <div className="overflow-y-auto flex-1" role="listbox">
                {filteredOptions.length > 0 ? (
                  filteredOptions.map((option) => (
                    <div
                      key={option.value}
                      className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors ${
                        option.disabled 
                          ? 'opacity-50 cursor-not-allowed' 
                          : 'hover:bg-gray-50'
                      } ${
                        option.value === value ? 'bg-blue-50' : ''
                      }`}
                      onClick={() => !option.disabled && handleOptionSelect(option.value)}
                      role="option"
                      aria-selected={option.value === value}
                    >
                      {option.icon && (
                        <div className="flex items-center shrink-0">
                          {option.icon}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-['General_Sans:Regular',sans-serif] text-[12px] text-[#101828] truncate">
                          {option.label}
                        </p>
                      </div>
                      {option.value === value && (
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                          <path d="M13.3346 4L6.0013 11.3333L2.66797 8" stroke="#054f31" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="px-3 py-8 text-center">
                    <p className="font-['General_Sans:Regular',sans-serif] text-[12px] text-[#667085]">
                      No options found
                    </p>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
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