import { useState } from "react";

interface DatePickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  className?: string;
  onApply?: (date: string, time: string) => void;
}

function ChevronLeft() {
  return (
    <div className="relative shrink-0 size-[20px]" data-name="chevron-left">
      <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 20 20">
        <g id="chevron-left">
          <path d="M12.5 15L7.5 10L12.5 5" id="Icon" stroke="#667085" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.67" />
        </g>
      </svg>
    </div>
  );
}

function ChevronRight() {
  return (
    <div className="relative shrink-0 size-[20px]" data-name="chevron-right">
      <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 20 20">
        <g id="chevron-right">
          <path d="M7.5 15L12.5 10L7.5 5" id="Icon" stroke="#667085" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.67" />
        </g>
      </svg>
    </div>
  );
}

export function DatePickerModal({ isOpen, onClose, className, onApply }: DatePickerModalProps) {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date(2022, 0, 6)); // Jan 6, 2022
  const [selectedTime, setSelectedTime] = useState<string>("6:30PM");
  const [currentDate, setCurrentDate] = useState<Date>(new Date(2022, 0, 1)); // January 2022
  const [activeQuickOption, setActiveQuickOption] = useState<string>("Last week");
  const [viewMode, setViewMode] = useState<"calendar" | "year">("calendar");
  const [yearRangeStart, setYearRangeStart] = useState<number>(2020);

  if (!isOpen) return null;

  const monthNames = ["January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"];
  
  const currentMonth = `${monthNames[currentDate.getMonth()]} ${currentDate.getFullYear()}`;

  // Generate calendar days for the current month
  const generateCalendarDays = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const firstDayOfWeek = firstDay.getDay(); // 0 = Sunday
    const daysInMonth = lastDay.getDate();
    
    // Adjust to make Monday = 0
    const adjustedFirstDay = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1;
    
    const days: Array<{ day: number; isCurrentMonth: boolean; date: Date }> = [];
    
    // Previous month days
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = adjustedFirstDay - 1; i >= 0; i--) {
      days.push({
        day: prevMonthLastDay - i,
        isCurrentMonth: false,
        date: new Date(year, month - 1, prevMonthLastDay - i)
      });
    }
    
    // Current month days
    for (let i = 1; i <= daysInMonth; i++) {
      days.push({
        day: i,
        isCurrentMonth: true,
        date: new Date(year, month, i)
      });
    }
    
    // Next month days
    const remainingDays = 42 - days.length; // 6 rows * 7 days
    for (let i = 1; i <= remainingDays; i++) {
      days.push({
        day: i,
        isCurrentMonth: false,
        date: new Date(year, month + 1, i)
      });
    }
    
    return days;
  };

  const calendarDays = generateCalendarDays();

  const timeSlots = ["5:30PM", "6:30PM", "7:30PM", "8:30PM", "9:30PM"];

  const quickOptions = [
    { label: "Today" },
    { label: "Yesterday" },
    { label: "This week" },
    { label: "Last week" },
    { label: "This month" },
    { label: "Last month" },
    { label: "This year" },
    { label: "Last year" },
    { label: "All time" },
  ];

  const formatDate = (date: Date) => {
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
      "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return `${monthNames[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
  };

  const handleDateClick = (date: Date) => {
    setSelectedDate(date);
  };

  const handleTimeClick = (time: string) => {
    setSelectedTime(time);
  };

  const handlePrevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const handleQuickOption = (option: string) => {
    setActiveQuickOption(option);
    const today = new Date();
    
    switch (option) {
      case "Today":
        setSelectedDate(today);
        setCurrentDate(new Date(today.getFullYear(), today.getMonth(), 1));
        break;
      case "Yesterday":
        const yesterday = new Date(today);
        yesterday.setDate(today.getDate() - 1);
        setSelectedDate(yesterday);
        setCurrentDate(new Date(yesterday.getFullYear(), yesterday.getMonth(), 1));
        break;
      // Add more cases as needed
    }
  };

  const handleYearClick = (year: number) => {
    setCurrentDate(new Date(year, currentDate.getMonth(), 1));
    setViewMode("calendar");
  };

  const handlePrevYearRange = () => {
    setYearRangeStart(yearRangeStart - 12);
  };

  const handleNextYearRange = () => {
    setYearRangeStart(yearRangeStart + 12);
  };

  const toggleViewMode = () => {
    if (viewMode === "calendar") {
      setYearRangeStart(Math.floor(currentDate.getFullYear() / 12) * 12);
      setViewMode("year");
    } else {
      setViewMode("calendar");
    }
  };

  const generateYears = () => {
    const years = [];
    for (let i = 0; i < 12; i++) {
      years.push(yearRangeStart + i);
    }
    return years;
  };

  const isSameDay = (date1: Date, date2: Date) => {
    return date1.getDate() === date2.getDate() &&
           date1.getMonth() === date2.getMonth() &&
           date1.getFullYear() === date2.getFullYear();
  };

  const handleApply = () => {
    // Handle apply logic here
    if (onApply) {
      onApply(formatDate(selectedDate), selectedTime);
    }
    onClose();
  };

  const handleCancel = () => {
    onClose();
  };

  return (
    <div className={`fixed inset-0 flex items-center justify-center z-50 ${className || 'bg-black bg-opacity-50'}`} onClick={onClose}>
      <div 
        className="bg-white rounded-[16px] shadow-[0px_7px_15px_0px_rgba(25,32,32,0.08)] border border-[#e6eded] max-h-[90vh] overflow-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-[16px]">
          <div className="flex flex-col gap-[32px] w-full">
            {/* Title */}
            <p className="font-['Lexend_Deca:SemiBold',sans-serif] text-[24px] text-[#192020] text-center">
              Book an appointment
            </p>

            {/* Main Content */}
            <div className="flex gap-[48px] w-full">
              {/* Left Side - Quick Options */}
              <div className="flex flex-col gap-[4px] px-[16px] py-[12px]">
                {quickOptions.map((option, index) => (
                  <div
                    key={index}
                    className={`flex items-center px-[16px] py-[10px] rounded-[6px] w-[160px] cursor-pointer ${
                      option.label === activeQuickOption ? "bg-[#ecfdf3]" : "bg-white"
                    }`}
                    onClick={() => handleQuickOption(option.label)}
                  >
                    <p
                      className={`text-[14px] leading-[20px] ${
                        option.label === activeQuickOption
                          ? "font-['General_Sans:Medium',sans-serif] text-[#027a48]"
                          : "font-['General_Sans:Regular',sans-serif] text-[#344054]"
                      }`}
                    >
                      {option.label}
                    </p>
                  </div>
                ))}
              </div>

              {/* Right Side - Calendar and Time */}
              <div className="flex-1 flex flex-col">
                {/* Calendar and Time Selection */}
                <div className="flex gap-[32px] px-[24px] py-[20px]">
                  {/* Calendar */}
                  <div className="flex-1 flex flex-col gap-[12px]">
                    {/* Month Navigation */}
                    <div className="flex items-center justify-between w-full">
                      <div 
                        className="flex items-center justify-center p-[10px] rounded-[8px] cursor-pointer" 
                        onClick={viewMode === "calendar" ? handlePrevMonth : handlePrevYearRange}
                      >
                        <ChevronLeft />
                      </div>
                      <p 
                        className="font-['Inter:Medium',sans-serif] text-[16px] text-[#344054] text-center cursor-pointer hover:text-[#039855]"
                        onClick={toggleViewMode}
                      >
                        {viewMode === "calendar" ? currentMonth : `${yearRangeStart} - ${yearRangeStart + 11}`}
                      </p>
                      <div 
                        className="flex items-center justify-center p-[10px] rounded-[8px] cursor-pointer" 
                        onClick={viewMode === "calendar" ? handleNextMonth : handleNextYearRange}
                      >
                        <ChevronRight />
                      </div>
                    </div>

                    {/* Calendar Grid */}
                    <div className="flex flex-col gap-[4px] w-full">
                      {viewMode === "calendar" ? (
                        <>
                          {/* Day Headers */}
                          <div className="flex justify-between w-full">
                            {["Mo", "Tu", "We", "Th", "Fr", "Sat", "Su"].map((day, index) => (
                              <div key={index} className="rounded-[20px] size-[40px] flex items-center justify-center">
                                <p className="font-['General_Sans:Medium',sans-serif] text-[14px] text-[#344054] leading-[20px]">
                                  {day}
                                </p>
                              </div>
                            ))}
                          </div>

                          {/* Calendar Rows */}
                          {Array.from({ length: 6 }).map((_, weekIndex) => (
                            <div key={weekIndex} className="flex justify-between w-full">
                              {calendarDays.slice(weekIndex * 7, (weekIndex + 1) * 7).map((dayData, dayIndex) => {
                                const isSelected = isSameDay(dayData.date, selectedDate);
                                return (
                                  <div
                                    key={dayIndex}
                                    className={`rounded-[20px] size-[40px] flex items-center justify-center cursor-pointer ${
                                      isSelected ? "bg-[#039855]" : ""
                                    }`}
                                    onClick={() => handleDateClick(dayData.date)}
                                  >
                                    <p
                                      className={`text-[14px] leading-[20px] ${
                                        isSelected
                                          ? "text-white font-['General_Sans:Medium',sans-serif]"
                                          : dayData.isCurrentMonth
                                          ? "text-[#344054] font-['General_Sans:Regular',sans-serif]"
                                          : "text-[#667085] font-['General_Sans:Regular',sans-serif]"
                                      }`}
                                    >
                                      {dayData.day}
                                    </p>
                                  </div>
                                );
                              })}
                            </div>
                          ))}
                        </>
                      ) : (
                        /* Year Picker Grid */
                        <div className="grid grid-cols-3 gap-[8px] pt-[20px]">
                          {generateYears().map((year) => {
                            const isCurrentYear = year === currentDate.getFullYear();
                            return (
                              <div
                                key={year}
                                className={`rounded-[8px] py-[12px] px-[16px] flex items-center justify-center cursor-pointer hover:bg-[#ecfdf3] ${
                                  isCurrentYear ? "bg-[#039855]" : "bg-white"
                                }`}
                                onClick={() => handleYearClick(year)}
                              >
                                <p
                                  className={`text-[14px] leading-[20px] ${
                                    isCurrentYear
                                      ? "text-white font-['General_Sans:Medium',sans-serif]"
                                      : "text-[#344054] font-['General_Sans:Regular',sans-serif]"
                                  }`}
                                >
                                  {year}
                                </p>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Divider */}
                  <div className="h-[374px] w-0 relative shrink-0">
                    <div className="absolute inset-[0_-0.5px]">
                      <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 1 374">
                        <path d="M0.5 374V0" stroke="#D5DFDF" strokeDasharray="4 4" />
                      </svg>
                    </div>
                  </div>

                  {/* Time Selection */}
                  <div className="flex flex-col gap-[16px] py-[8px]">
                    <p className="font-['Lexend_Deca:Light',sans-serif] text-[16px] text-[#192020] text-center">
                      Select a Time
                    </p>
                    <div className="flex flex-col gap-[8px] items-end">
                      {timeSlots.map((slot, index) => (
                        <div key={index} className="flex gap-[6px] items-start w-[211px]">
                          <div
                            className={`flex items-center justify-center px-[72px] py-[16px] rounded-[10px] cursor-pointer ${
                              slot === selectedTime ? "bg-[#039855]" : "bg-white border border-[rgba(4,67,67,0.32)]"
                            }`}
                            onClick={() => handleTimeClick(slot)}
                          >
                            <p
                              className={`text-[14px] leading-[20px] text-center ${
                                slot === selectedTime
                                  ? "text-[#f6fef9] font-['General_Sans:Medium',sans-serif]"
                                  : "text-[rgba(4,67,67,0.32)] font-['General_Sans:Regular',sans-serif]"
                              }`}
                            >
                              {slot}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Bottom Panel */}
                <div className="w-full border-t border-[#e6eded]">
                  <div className="flex gap-[12px] items-start px-[24px] py-[16px]">
                    {/* Date Input */}
                    <div className="flex flex-col gap-[6px] min-w-[200px] w-[200px]">
                      <div className="bg-white border border-[#f2f4f7] rounded-[8px] shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]">
                        <div className="flex gap-[8px] items-center px-[12px] py-[8px]">
                          <p className="text-[12px] leading-[24px] text-[#101828] font-['General_Sans:Regular',sans-serif]">
                            {formatDate(selectedDate)}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Time Input */}
                    <div className="flex flex-col gap-[6px] min-w-[200px] w-[200px]">
                      <div className="bg-white border border-[#f2f4f7] rounded-[8px] shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]">
                        <div className="flex gap-[8px] items-center px-[12px] py-[8px]">
                          <p className="text-[12px] leading-[24px] text-[#101828] font-['General_Sans:Regular',sans-serif]">
                            {selectedTime}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-[12px] items-start">
                      {/* Cancel Button */}
                      <div
                        className="bg-white border border-[#d0d5dd] rounded-[4px] shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)] w-[104px] cursor-pointer"
                        onClick={handleCancel}
                      >
                        <div className="flex items-center justify-center px-[14px] py-[10px]">
                          <p className="text-[14px] leading-[20px] text-[#344054] font-['General_Sans:Medium',sans-serif]">
                            Cancel
                          </p>
                        </div>
                      </div>

                      {/* Apply Button */}
                      <div
                        className="bg-[#039855] border border-[#039855] rounded-[4px] shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)] w-[104px] cursor-pointer"
                        onClick={handleApply}
                      >
                        <div className="flex items-center justify-center px-[14px] py-[10px]">
                          <p className="text-[14px] leading-[20px] text-white font-['General_Sans:Medium',sans-serif]">
                            Apply
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}