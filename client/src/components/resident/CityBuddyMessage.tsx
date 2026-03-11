import { useState, useRef } from "react";
import { Calendar, AIAskBotIcon, UploadItem, svgPaths } from "@/components/ui/icon";
import { SecButton, PriButton } from "@/components/ui/buttons";
import { DatePickerModal } from "@/components/ui/datepicker";
import RobotIcon from "./CityBuddyMascot";
import imgFrame48096905 from "@/assets/illustrations/dbfd1eb1f4deee5c7bffcee9e49b449b6b495b86.png";
import imgFrame48096904 from "@/assets/illustrations/f63d5fd57c758ae2cb4167e39f9cb5ce550c7982.png";
import imgImage from "@/assets/avatars/f63f4dcbfe5ff0deaa52653ee347f8561b1180d8.png";
import { useProfile } from "@/contexts/ProfileContext";
import { formatServiceRequestStatusLabel } from "@/lib/serviceRequestStatus";

export type CityBuddyTicketStatus =
  | "pending_inspection"
  | "pending"
  | "assigned"
  | "assigned_for_job"
  | "in_progress"
  | "completed"
  | "cancelled"
  | (string & {});

export function formatTicketStatusLabel(status: string, categoryHint?: string) {
  return formatServiceRequestStatusLabel(status, categoryHint);
}

export function buildProgressSteps(status: string, categoryHint?: string) {
  const s = (status || "").toLowerCase();
  const assignedStepLabel = formatServiceRequestStatusLabel("assigned", categoryHint);
  const assignedForJobStepLabel = formatServiceRequestStatusLabel("assigned_for_job", categoryHint);

  if (s === "cancelled") {
    return {
      steps: ["Submitted", "Cancelled"],
      activeIndex: 1,
    };
  }

  if (s === "pending_inspection" || s === "assigned" || s === "assigned_for_job") {
    const steps = [
      "Submitted",
      "Inspection scheduled",
      assignedStepLabel,
      assignedForJobStepLabel,
      "In progress",
      "Completed",
    ];
    const activeIndex =
      s === "pending_inspection"
        ? 1
        : s === "assigned"
          ? 2
          : s === "assigned_for_job"
            ? 3
            : s === "in_progress"
              ? 4
              : s === "completed"
                ? 5
              : 0;
    return { steps, activeIndex };
  }

  const steps = ["Submitted", assignedStepLabel, assignedForJobStepLabel, "In progress", "Completed"];
  const activeIndex =
    s === "assigned"
      ? 1
      : s === "assigned_for_job"
        ? 2
        : s === "in_progress"
          ? 3
          : s === "completed"
            ? 4
            : 0;
  return { steps, activeIndex };
}

function StepDot({ done, active }: { done: boolean; active: boolean }) {
  return (
    <span
      className={
        done
          ? "inline-flex items-center justify-center w-[18px] h-[18px] rounded-full bg-[#039855] text-white text-[12px]"
          : active
            ? "inline-flex w-[18px] h-[18px] rounded-full border-[2px] border-[#039855]"
            : "inline-flex w-[18px] h-[18px] rounded-full border border-[#D0D5DD]"
      }
      aria-hidden="true"
    >
      {done ? "✓" : ""}
    </span>
  );
}

export function TicketMessage({
  requestId,
  title,
  status,
  createdAtIso,
  onViewRequest,
}: {
  requestId: string;
  title?: string | null;
  status: CityBuddyTicketStatus;
  createdAtIso?: string | null;
  onViewRequest?: () => void;
}) {
  const label = formatTicketStatusLabel(String(status || ""), title || undefined);
  const { steps, activeIndex } = buildProgressSteps(String(status || ""), title || undefined);

  return (
    <div
      className="bg-white content-stretch flex gap-[12px] items-start overflow-clip pb-[16px] pt-0 px-0 relative rounded-[8px] shrink-0 w-full"
      data-name="Ticket Message"
    >
      <div className="flex items-center overflow-clip px-px py-[4px] relative shrink-0" style={{ transform: "scale(1.05)", transformOrigin: "center", paddingLeft: "6px" }}>
        <RobotIcon />
      </div>

      <div className="flex-1 min-w-0">
        <div className="relative rounded-[16px] shrink-0 max-w-[600px] w-full border border-[#EAECF0] shadow-[0px_1px_2px_rgba(16,24,40,0.04)]">
          <div className="px-[16px] py-[12px]">
            <div className="flex items-start justify-between gap-[12px]">
              <div className="min-w-0">
                <p className="text-[14px] text-[#101828] font-['General_Sans:Semibold',sans-serif]">
                  Ticket created
                </p>
                <p className="text-[12px] text-[#667085] mt-[2px] break-words">
                  {title?.trim() ? title : "Service request"}
                </p>
              </div>

              <div className="shrink-0 text-right">
                <span className="inline-flex items-center text-[12px] text-[#475467] bg-[#f9fafb] border border-[#EAECF0] rounded-[999px] px-[10px] py-[4px]">
                  {label}
                </span>
              </div>
            </div>

            <div className="mt-[10px] grid grid-cols-1 gap-[10px]">
              <div className="text-[12px] text-[#667085]">
                Request ID: <span className="text-[#475467]">{requestId}</span>
                {createdAtIso ? (
                  <span className="text-[#D0D5DD]"> · </span>
                ) : null}
                {createdAtIso ? (
                  <span className="text-[#475467]">{new Date(createdAtIso).toLocaleString()}</span>
                ) : null}
              </div>

              <div className="bg-[#f9fafb] border border-[#EAECF0] rounded-[12px] px-[12px] py-[10px]">
                <p className="text-[12px] text-[#667085]">Progress</p>
                <div className="mt-[8px] space-y-[8px]">
                  {steps.map((step, idx) => {
                    const done = idx < activeIndex;
                    const active = idx === activeIndex;
                    return (
                      <div key={`${idx}-${step}`} className="flex items-center gap-[10px]">
                        <StepDot done={done} active={active} />
                        <p className={active ? "text-[12px] text-[#101828] font-['General_Sans:Medium',sans-serif]" : "text-[12px] text-[#475467]"}>
                          {step}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>

              {onViewRequest ? (
                <div className="flex gap-[10px]">
                  <SecButton type="button" onClick={onViewRequest}>
                    View request
                  </SecButton>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============ CategoryStatus - Category Selection Header ============
export function ProfilePics({ size = 32, withBorder = false, customImage }: { size?: number; withBorder?: boolean; customImage?: string | null }) {
  const { profileImage } = useProfile();
  const borderSize = size === 160 ? 4 : 0;
  const borderRadius = size + (withBorder ? borderSize * 2 : 0);
  
  // Priority: customImage (for pending preview) > global profileImage > default imgImage
  const displayImage = customImage !== undefined ? customImage : profileImage;
  
  return (
    <div
      className="relative rounded-[200px] shrink-0"
      style={{ width: size, height: size }}
      data-name="Avatar"
    >
      <img
        alt=""
        className="absolute inset-0 max-w-none object-50%-50% object-cover pointer-events-none rounded-[200px] size-full"
        src={displayImage || imgImage}
      />
      {withBorder && (
        <div 
          aria-hidden="true" 
          className="absolute border-solid border-white pointer-events-none shadow-[0px_12px_16px_-4px_rgba(16,24,40,0.08),0px_4px_6px_-2px_rgba(16,24,40,0.03)]"
          style={{
            borderWidth: `${borderSize}px`,
            inset: `-${borderSize}px`,
            borderRadius: `${borderRadius}px`
          }}
        />
      )}
    </div>
  );
}

function CategorySelected({ 
  categoryName, 
  onChangeCategory,
  onDeleteConversation,
  canDelete = true,
}: { 
  categoryName?: string;
  onChangeCategory?: () => void;
  onDeleteConversation?: () => void;
  canDelete?: boolean;
}) {
  return (
    <div className="flex flex-col items-end gap-[6px]" data-name="Category status">
      <div className="flex items-center gap-[8px]">
        <p className="text-[12px] text-[#667085]">
          You selected{" "}
          <span className="font-['General_Sans:Semibold',sans-serif] text-[#101828]">
            {categoryName || "Maintenance & Repair"}
          </span>
        </p>
        <ProfilePics size={20} />
      </div>

      <div className="flex items-center gap-[16px]">
        {onDeleteConversation ? (
          <button
            type="button"
            disabled={!canDelete}
            onClick={onDeleteConversation}
            className={`font-['General_Sans:Medium',sans-serif] leading-[18px] text-[#d92d20] text-[12px] text-nowrap underline cursor-pointer bg-transparent border-none p-0 ${!canDelete ? "opacity-20 cursor-not-allowed no-underline" : ""}`}
          >
            Delete conversation
          </button>
        ) : null}

        {onChangeCategory ? (
          <button
            type="button"
            onClick={onChangeCategory}
            className="font-['General_Sans:Medium',sans-serif] leading-[18px] text-[#039855] text-[12px] text-nowrap underline cursor-pointer bg-transparent border-none p-0"
          >
            Change category
          </button>
        ) : null}
      </div>
    </div>
  );
}

export function CategoryStatus({ 
  categoryName, 
  onChangeCategory,
  onDeleteConversation,
  canDelete = true,
}: { 
  categoryName?: string;
  onChangeCategory?: () => void;
  onDeleteConversation?: () => void;
  canDelete?: boolean;
}) {
  return (
    <div className="shrink-0" data-name="Category status">
      <CategorySelected
        categoryName={categoryName}
        onChangeCategory={onChangeCategory}
        onDeleteConversation={onDeleteConversation}
        canDelete={canDelete}
      />
    </div>
  );
}

// ============ AIResponseField - "Tell us what you need?" ============
function RequestIconDetails() {
  return (
    <div style={{ transform: "scale(0.8)", transformOrigin: "center", paddingLeft: "6px" }} >
      <RobotIcon />
    </div>
  );
}

function RequestSortedIcon() {
  return (
    <div
      className="content-stretch flex flex-col items-start overflow-clip px-px py-[4px] relative shrink-0"
      data-name="Request icon"
    >
      <RequestIconDetails />
    </div>
  );
}

function AIResponse() {
  return (
    <div
      className="content-stretch flex gap-[12px] items-center p-[12px] relative rounded-[48px] shrink-0"
      data-name="Content"
    >
      <RequestSortedIcon />
      <p className="font-['General_Sans:Medium',sans-serif] leading-[20px] not-italic relative shrink-0 text-[#475467] text-[14px] text-nowrap">
        Tell us what you need?
      </p>
    </div>
  );
}

export function AIResponseField() {
  return (
    <div
      className="bg-white content-stretch flex flex-col items-start overflow-clip pb-[16px] pt-0 px-0 relative rounded-[8px] shrink-0 w-full"
      data-name="Form"
    >
      <AIResponse />
    </div>
  );
}

// ============ AIMessage - CityBuddy AI response with mascot ============
export function AIMessage({ text }: { text: string }) {
  return (
    <div
      className="bg-white content-stretch flex gap-[12px] items-center overflow-clip pb-[16px] pt-0 px-0 relative rounded-[8px] shrink-0 w-full"
      data-name="AI Message"
    >
        <div className="flex items-center overflow-clip px-px py-[4px] relative shrink-0" style={{ transform: "scale(1.2)", transformOrigin: "center", paddingLeft: "6px" }}>
          <RobotIcon />
        </div>
      <div className="flex-1 min-w-0">
        <div
          className="relative rounded-[16px] shrink-0 max-w-[600px] w-full border border-[#EAECF0] shadow-[0px_1px_2px_rgba(16,24,40,0.04)]"
          data-name="Content"
        >
          <div className="flex flex-col justify-center size-full">
            <div className="content-stretch flex flex-col gap-[4px] items-start justify-center px-[24px] py-[12px] relative w-full">
              <p className="font-['General_Sans:Regular',sans-serif] leading-[24px] not-italic relative shrink-0 text-[#475467] text-[16px] whitespace-pre-wrap">
                {text}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============ AIThinking - Loading indicator when CityBuddy is thinking ============
export function AIThinking() {
  return (
    <div
      className="bg-white content-stretch flex gap-[12px] items-start overflow-clip pb-[16px] pt-0 px-0 relative rounded-[8px] shrink-0 w-full"
      data-name="AI Thinking"
    >
      <div className="content-stretch flex flex-col items-start overflow-clip px-px py-[4px] relative shrink-0" style={{ transform: "scale(0.96)", transformOrigin: "center", paddingLeft: "6px" }}>
        <RobotIcon />
      </div>
      <div className="flex-1 min-w-0">
        <div
          className="bg-[#f5f6f6] relative rounded-[16px] shrink-0"
          data-name="Content"
        >
          <div className="flex items-center gap-[8px] px-[24px] py-[16px]">
            <div className="flex gap-[4px]">
              <span className="w-[8px] h-[8px] bg-[#039855] rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
              <span className="w-[8px] h-[8px] bg-[#039855] rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
              <span className="w-[8px] h-[8px] bg-[#039855] rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
            </div>
            <p className="font-['General_Sans:Medium',sans-serif] leading-[20px] not-italic text-[#475467] text-[14px]">
              CityBuddy is thinking...
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============ UserResponse - Basic user response ============
export function UserResponse({ text }: { text?: string }) {
  return (
    <div
      className="bg-white content-stretch flex flex-col items-end overflow-clip pb-[32px] pt-[0px] pl-[72px] pr-[0px] relative rounded-[8px] shrink-0 w-full"
      data-name="Form"
    >
      <div
        className="bg-[#f2f4f7] flex flex-col gap-[4px] items-start justify-center px-[24px] py-[12px] relative rounded-[48px] shrink-0"
        data-name="Content"
      >
        <p className="font-['General_Sans:Medium',sans-serif] leading-[20px] not-italic relative shrink-0 text-[#475467] text-[14px]">
          {text || "A detailed description of the service the user needs."}
        </p>
      </div>
    </div>
  );
}

// ============ AIUploadImage - Image upload request ============
function DeleteIconImageGallery() {
  return (
    <div
      className="relative shrink-0 size-[16px]"
      data-name="Delete icon"
    >
      <svg
        className="block size-full"
        fill="none"
        preserveAspectRatio="none"
        viewBox="0 0 16 16"
      >
        <g id="Delete icon">
          <path
            d={svgPaths.p940fa80}
            id="Icon"
            stroke="var(--stroke-0, #D92D20)"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
          />
        </g>
      </svg>
    </div>
  );
}

function DeleteButtonImageGallery({
  onClick,
}: {
  onClick?: () => void;
}) {
  return (
    <div
      className="bg-[rgba(255,255,255,0.8)] content-stretch flex items-center overflow-clip p-[8px] relative rounded-[32px] shrink-0 cursor-pointer hover:bg-white transition-colors"
      data-name="Delete button"
      onClick={onClick}
    >
      <DeleteIconImageGallery />
    </div>
  );
}

function ImageGalleryItem({
  imageSrc,
  onDelete,
  onImageClick,
}: {
  imageSrc: string;
  onDelete?: () => void;
  onImageClick?: () => void;
}) {
  const handleImageClick = (e: React.MouseEvent) => {
    if (
      (e.target as HTMLElement).closest('[data-name="Delete button"]')
    ) {
      return;
    }
    onImageClick?.();
  };

  return (
    <div
      className="h-[172px] relative rounded-[8px] shrink-0 w-[163px] cursor-pointer"
      data-name="Image"
      onClick={handleImageClick}
    >
      <img
        alt=""
        className="absolute inset-0 max-w-none object-center object-cover pointer-events-none rounded-[8px] size-full"
        src={imageSrc}
      />
      <div className="content-stretch flex items-start justify-end overflow-clip px-[2px] py-[3px] relative rounded-[inherit] size-full">
        <DeleteButtonImageGallery onClick={onDelete} />
      </div>
      <div
        aria-hidden="true"
        className="absolute border-4 border-[#039855] border-solid inset-[-4px] pointer-events-none rounded-[12px]"
      />
    </div>
  );
}

function ImageGalleryForm({
  images,
  onDeleteImage,
  onImageClick,
}: {
  images: string[];
  onDeleteImage?: (index: number) => void;
  onImageClick?: (index: number) => void;
}) {
  return (
    <div
      className="content-stretch flex gap-[12px] items-start relative shrink-0 w-full"
      data-name="Form"
    >
      <div
        className="bg-white relative rounded-[8px] w-full"
        data-name="Form"
      >
        <div className="flex flex-row justify-end w-full">
          <div className="content-stretch flex gap-[24px] items-start justify-end pb-[32px] pl-0 pr-[4px] pt-0 relative w-full">
            {images.map((imageSrc, i) => (
              <ImageGalleryItem
                key={i}
                imageSrc={imageSrc}
                onDelete={() => onDeleteImage?.(i)}
                onImageClick={() => onImageClick?.(i)}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function ImageViewerModal({
  imageSrc,
  onClose,
}: {
  imageSrc: string;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 bg-opacity-25 flex items-center justify-center z-50 p-8"
      onClick={onClose}
    >
      <div
        className="relative max-w-[90vw] max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={imageSrc}
          alt="Full size"
          className="max-w-full max-h-[90vh] object-contain rounded-lg"
        />
        <button
          onClick={onClose}
          className="absolute top-4 right-4 bg-white rounded-full p-2 hover:bg-gray-100 transition-colors"
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path
              d="M18 6L6 18M6 6l12 12"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}

function ContentForm16({
  onUploadImage,
  onSkipUpload,
  onFilesSelected,
}: {
  onUploadImage?: () => void;
  onSkipUpload?: () => void;
  onFilesSelected?: (files: File[]) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      const fileArray = Array.from(files);
      if (onFilesSelected) {
        onFilesSelected(fileArray);
      }
      if (onUploadImage) {
        onUploadImage();
      }
    }
  };

  return (
    <div className="content-stretch flex flex-col gap-[16px] items-start relative shrink-0">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleFileChange}
        className="hidden"
      />
      <div
        className="bg-[#f5f6f6] content-stretch flex items-center overflow-clip px-[16px] py-[12px] relative rounded-[48px] shrink-0"
        data-name="Content"
        style={{
          fontFamily: '"General Sans Medium", sans-serif',
          fontSize: "18px",
          fontWeight: 500,
          lineHeight: "28px",
          letterSpacing: "0px",
          textAlign: "left",
        }}
      >
        <p className="shrink-0" style={{ color: "#054f31" }}>
          Upload a supporting image for more clarity or reference
        </p>
      </div>
      <div className="content-stretch flex gap-[12px] items-start relative shrink-0">
        <div
          className="bg-white cursor-pointer flex gap-[8px] items-center justify-center overflow-clip  relative rounded-[8px] shrink-0 hover:bg-gray-50 transition-colors"
          data-name="Button"
          onClick={handleUploadClick}
        >
          <SecButton text="Upload image" icon={<UploadItem />} />
        </div>
        <div>
          <SecButton text="I don't have any image" icon={<UploadItem />} />
        </div>
      </div>
    </div>
  );
}

function RequestIconForm16() {
  return (
    <div className="content-stretch flex flex-col items-start overflow-clip px-px py-[4px] relative shrink-0">
      <AIAskBotIcon />
    </div>
  );
}

export function AIUploadImage({
  onUploadImage,
  onSkipUpload,
}: {
  onUploadImage?: () => void;
  onSkipUpload?: () => void;
}) {
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);
  const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(
    null
  );

  const handleFilesSelected = (files: File[]) => {
    files.forEach((file) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        setUploadedImages((prev) => [...prev, reader.result as string]);
      };
      reader.readAsDataURL(file);
    });
  };

  const handleDeleteImage = (index: number) => {
    setUploadedImages((prev) => prev.filter((_, i) => i !== index));
  };

  const handleImageClick = (index: number) => {
    setSelectedImageIndex(index);
  };

  const handleCloseModal = () => {
    setSelectedImageIndex(null);
  };

  return (
    <>
      <div
        className="content-stretch flex gap-[12px] items-start relative shrink-0 w-full pt-[0px] pr-[0px] pb-[32px] pl-[0px]"
        data-name="Form"
      >
        <RequestIconForm16 />
        <ContentForm16
          onUploadImage={onUploadImage}
          onSkipUpload={onSkipUpload}
          onFilesSelected={handleFilesSelected}
        />
      </div>
      {uploadedImages.length > 0 && (
        <ImageGalleryForm
          images={uploadedImages}
          onDeleteImage={handleDeleteImage}
          onImageClick={handleImageClick}
        />
      )}
      {selectedImageIndex !== null && (
        <ImageViewerModal
          imageSrc={uploadedImages[selectedImageIndex]}
          onClose={handleCloseModal}
        />
      )}
    </>
  );
}

// ============ BookAppointment - Date/Time picker with chat ============
function AIIcon() {
  return (
    <div className="content-stretch flex flex-col items-start overflow-clip px-px py-[4px] relative shrink-0">
      <AIAskBotIcon />
    </div>
  );
}

function UserResponseAppoint({ date, time }: { date: string; time: string }) {
  return (
    <div
      className="bg-white content-stretch flex flex-col items-end overflow-clip pb-[16px] pt-[0px] pl-[72px] pr-[0px] relative rounded-[8px] shrink-0 w-full"
      data-name="Form"
    >
      <div
        className="bg-[#f2f4f7] flex flex-col gap-[4px] items-start justify-center px-[24px] py-[12px] relative rounded-[48px] shrink-0"
        data-name="Content"
      >
        <p className="font-['General_Sans:Medium',sans-serif] leading-[20px] not-italic relative shrink-0 text-[#475467] text-[14px]">
          <span>{`I will prefer to have the Professional come on `}</span>
          <span className="font-['General_Sans:Bold',sans-serif]">{date}</span>
          <span>{` by `}</span>
          <span className="font-['General_Sans:Bold',sans-serif]">{time}</span>
        </p>
      </div>
    </div>
  );
}

export default function BookAppointment() {
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [appointment, setAppointment] = useState<{
    date: string;
    time: string;
  } | null>(null);

  const handleApplyAppointment = (date: string, time: string) => {
    setAppointment({ date, time });
  };

  return (
    <>
      <div
        className="bg-white content-stretch flex gap-[12px] items-start overflow-clip pb-[16px] pt-0 px-0 relative rounded-[8px] size-full"
        data-name="Form"
      >
        <AIIcon />
        <div className="content-stretch flex flex-col gap-[16px] items-start justify-center relative shrink-0 w-[584px]">
          <div
            className="bg-[#f5f6f6] relative rounded-[16px] shrink-0 w-full"
            data-name="Content"
          >
            <div className="flex flex-col justify-center size-full">
              <div className="content-stretch flex flex-col gap-[4px] items-start justify-center px-[24px] py-[12px] relative w-full">
                <p className="font-['General_Sans:Medium',sans-serif] leading-[28px] min-w-full not-italic relative shrink-0 text-[#054f31] text-[18px] w-[min-content]">
                  Pick an available time within the available window so we can
                  get you a professional to properly access the situation and
                  give a precise recommendation and provide the service if ready
                </p>
              </div>
            </div>
          </div>
          <div className="content-stretch flex gap-[10px] grow items-start min-h-px min-w-px relative shrink-0">
            <div
              onClick={() => setIsDatePickerOpen(true)}
              className="cursor-pointer"
            >
              <SecButton text="Book Appointment" icon={<Calendar />} />
            </div>
          </div>
        </div>
      </div>

      {appointment && (
        <UserResponseAppoint date={appointment.date} time={appointment.time} />
      )}

      <DatePickerModal
        isOpen={isDatePickerOpen}
        onClose={() => setIsDatePickerOpen(false)}
        className="bg-[rgba(0,0,0,0.1)]"
        onApply={handleApplyAppointment}
      />
    </>
  );
}
