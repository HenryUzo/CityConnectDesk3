import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { io } from "socket.io-client";
import { AIAskBotIcon, AIAnsweredBotIcon, UploadItem } from "@/components/ui/icon";
import Nav from "@/components/layout/Nav";
import MobileNavDrawer from "@/components/layout/MobileNavDrawer";
import { useMyEstates } from "@/hooks/useMyEstates";
import useCategories from "@/hooks/useCategories";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MainWrapSelectCategory } from "@/components/resident/CityBuddyChat";
import { RequestsSidebar } from "@/components/resident/RequestsSidebar";
import { ProviderHeader } from "@/components/resident/ordinary-flow/ProviderHeader";
import { RequestProgressTracker } from "@/components/resident/ordinary-flow/RequestProgressTracker";
import { ChatThread, type ThreadItem } from "@/components/resident/ordinary-flow/ChatThread";
import { SystemMessage } from "@/components/resident/ordinary-flow/SystemMessage";
import {
  MessageComposer,
  type ComposerAttachment,
} from "@/components/resident/ordinary-flow/MessageComposer";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { residentFetch } from "@/lib/residentApi";
import { formatServiceRequestStatusLabel } from "@/lib/serviceRequestStatus";

type FlowStage = "intake" | "wizard" | "summary";

type WizardStep =
  | {
      id: "location";
      kind: "location";
      prompt: string;
    }
  | {
      id: "issue_type" | "quantity" | "time_window";
      kind: "chips";
      prompt: string;
      options: string[];
    }
  | {
      id: "photos";
      kind: "photos";
      prompt: string;
      required: boolean;
      helperText?: string;
    }
  | {
      id: "notes";
      kind: "text";
      prompt: string;
      placeholder: string;
    }
  | {
      id: string;
      kind: "chips";
      prompt: string;
      options: string[];
    };

type CategoryProfile = {
  issueChips: string[];
  followUps: Array<{ id: string; prompt: string; options: string[] }>;
  quantityPrompt: string;
  quantityOptions: string[];
  timeWindowPrompt: string;
  timeWindowOptions: string[];
  photoRequired: boolean;
  photoRecommended: boolean;
  photoHelper?: string;
};

type RequestMessage = {
  id: string;
  requestId: string;
  senderId: string;
  senderRole: "admin" | "resident" | "provider";
  message: string;
  attachmentUrl?: string | null;
  createdAt?: string;
};

type RequestProvider = {
  id: string;
  name: string | null;
  company: string | null;
  serviceCategory: string | null;
  avatarUrl?: string | null;
};

type ActiveServiceRequest = {
  id: string;
  category?: string;
  description?: string | null;
  location?: string | null;
  urgency?: string | null;
  status?: string;
  paymentStatus?: string | null;
  billedAmount?: string | number | null;
  paymentRequestedAt?: string | Date | null;
  consultancyReport?: {
    inspectionDate?: string;
    actualIssue?: string;
    causeOfIssue?: string;
    materialCost?: number;
    serviceCost?: number;
    totalRecommendation?: number;
    preventiveRecommendation?: string;
    submittedAt?: string;
  } | null;
  consultancyReportSubmittedAt?: string | Date | null;
  providerId?: string | null;
  preferredTime?: string | Date | null;
  assignedAt?: string | Date | null;
  updatedAt?: string | Date | null;
  provider?: RequestProvider | null;
};

type ParsedRequestDetails = {
  issueType?: string;
  quantity?: string;
  timeWindow?: string;
  photosCount?: number;
  notes?: string;
  urgency?: string;
  location?: string;
};

type RequestMessageSocketPayload = {
  requestId: string;
  message: RequestMessage;
};

type ServiceRequestUpdateSocketPayload = {
  type?: string;
  requestId: string;
  request?: Record<string, unknown> & { id?: string };
  at?: string;
};

const URGENCY_OPTIONS = [
  { value: "emergency", label: "Emergency", tone: "border-rose-200 text-rose-700 bg-rose-50" },
  { value: "high", label: "High", tone: "border-amber-200 text-amber-700 bg-amber-50" },
  { value: "medium", label: "Medium", tone: "border-slate-200 text-slate-700 bg-slate-50" },
  { value: "low", label: "Low", tone: "border-emerald-200 text-emerald-700 bg-emerald-50" },
];

const STATE_OPTIONS = ["Lagos", "Ogun", "Abuja (FCT)", "Oyo"];

const LGA_BY_STATE: Record<string, string[]> = {
  Lagos: ["Alimosho", "Ikeja", "Eti-Osa", "Surulere", "Yaba", "Kosofe"],
  Ogun: ["Abeokuta North", "Abeokuta South", "Ijebu Ode", "Ado-Odo/Ota"],
  "Abuja (FCT)": ["Abuja Municipal", "Bwari", "Gwagwalada", "Kuje"],
  Oyo: ["Ibadan North", "Ibadan South-West", "Ogbomosho North", "Egbeda"],
};

const DEFAULT_QUANTITY_OPTIONS = ["1", "2-3", "4-6", "7+"];
const DEFAULT_TIME_WINDOWS = ["Today", "Within 3 days", "This week", "Flexible"];

const REQUIRED_PHOTO_KEYWORDS = [
  "glass",
  "window",
  "roof",
  "roofing",
  "masonry",
  "tile",
  "tiling",
  "carpentry",
];

const RECOMMENDED_PHOTO_KEYWORDS = [
  "painting",
  "paint",
  "plumbing",
  "electrical",
  "hvac",
  "maintenance",
  "repair",
  ...REQUIRED_PHOTO_KEYWORDS,
];

const CHIP_STYLES =
  "rounded-full border px-4 py-2 text-sm font-medium transition shadow-sm hover:shadow";

function normalizeKey(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function buildCategoryProfile(categoryName: string): CategoryProfile {
  const key = normalizeKey(categoryName);
  const matches = (token: string) => key.includes(token);

  const photoRequired = REQUIRED_PHOTO_KEYWORDS.some(matches);
  const photoRecommended = photoRequired || RECOMMENDED_PHOTO_KEYWORDS.some(matches);

  if (matches("electrical") || matches("electric")) {
    return {
      issueChips: [
        "No power",
        "Flickering",
        "Breaker trips",
        "Burning smell",
        "Sparks",
      ],
      followUps: [
        {
          id: "electrical_scope",
          prompt: "Is it one socket or the whole house?",
          options: ["One socket", "A few rooms", "Whole house"],
        },
        {
          id: "electrical_safety",
          prompt: "Any smell, heat, or sparks right now?",
          options: ["Yes", "No", "Not sure"],
        },
      ],
      quantityPrompt: "How many sockets or points are affected?",
      quantityOptions: DEFAULT_QUANTITY_OPTIONS,
      timeWindowPrompt: "When should we come?",
      timeWindowOptions: DEFAULT_TIME_WINDOWS,
      photoRequired: false,
      photoRecommended: true,
      photoHelper: "A photo helps us estimate faster and send the right tools.",
    };
  }

  if (matches("plumb")) {
    return {
      issueChips: ["Leak", "Blocked drain", "Low pressure", "Burst pipe", "No water"],
      followUps: [
        {
          id: "plumbing_location",
          prompt: "Where is the issue located?",
          options: ["Kitchen", "Bathroom", "Outdoor", "Multiple areas"],
        },
      ],
      quantityPrompt: "How many fixtures are affected?",
      quantityOptions: DEFAULT_QUANTITY_OPTIONS,
      timeWindowPrompt: "When should we come?",
      timeWindowOptions: DEFAULT_TIME_WINDOWS,
      photoRequired: false,
      photoRecommended: true,
      photoHelper: "A photo helps us estimate faster and send the right tools.",
    };
  }

  if (matches("painting") || matches("paint")) {
    return {
      issueChips: ["Interior refresh", "Exterior repaint", "Touch-ups", "Water stains", "Peeling paint"],
      followUps: [
        {
          id: "painting_scope",
          prompt: "Do you want paint supplied or just labor?",
          options: ["Supply + labor", "Labor only", "Not sure"],
        },
      ],
      quantityPrompt: "How many rooms or areas?",
      quantityOptions: DEFAULT_QUANTITY_OPTIONS,
      timeWindowPrompt: "When should we come?",
      timeWindowOptions: DEFAULT_TIME_WINDOWS,
      photoRequired: false,
      photoRecommended: true,
      photoHelper: "A photo helps us estimate faster and send the right tools.",
    };
  }
  if (matches("carpentry") || matches("furniture") || matches("wood")) {
    return {
      issueChips: ["Door repair", "Furniture build", "Cabinet fix", "Shelving", "Window frame"],
      followUps: [
        {
          id: "carpentry_material",
          prompt: "Any preferred material or finish?",
          options: ["Hardwood", "MDF", "Metal + wood", "Not sure"],
        },
      ],
      quantityPrompt: "How many items are needed?",
      quantityOptions: DEFAULT_QUANTITY_OPTIONS,
      timeWindowPrompt: "When should we come?",
      timeWindowOptions: DEFAULT_TIME_WINDOWS,
      photoRequired,
      photoRecommended,
      photoHelper: "A photo helps us estimate faster and send the right tools.",
    };
  }

  if (matches("tile") || matches("tiling")) {
    return {
      issueChips: ["Replace broken tiles", "Regrout", "New tiling", "Water damage"],
      followUps: [
        {
          id: "tiling_area",
          prompt: "Which area is affected?",
          options: ["Bathroom", "Kitchen", "Outdoor", "Multiple areas"],
        },
      ],
      quantityPrompt: "Approximate area?",
      quantityOptions: ["1-2 sqm", "3-5 sqm", "6-10 sqm", "10+ sqm"],
      timeWindowPrompt: "When should we come?",
      timeWindowOptions: DEFAULT_TIME_WINDOWS,
      photoRequired,
      photoRecommended,
      photoHelper: "A photo helps us estimate faster and send the right tools.",
    };
  }

  if (matches("roof")) {
    return {
      issueChips: ["Leak", "Missing tiles", "Sagging", "Gutter issue", "Waterproofing"],
      followUps: [
        {
          id: "roofing_scope",
          prompt: "How long has the issue been present?",
          options: ["Today", "This week", "More than a week", "Not sure"],
        },
      ],
      quantityPrompt: "How many areas are affected?",
      quantityOptions: DEFAULT_QUANTITY_OPTIONS,
      timeWindowPrompt: "When should we come?",
      timeWindowOptions: DEFAULT_TIME_WINDOWS,
      photoRequired,
      photoRecommended,
      photoHelper: "A photo helps us estimate faster and send the right tools.",
    };
  }

  if (matches("glass") || matches("window")) {
    return {
      issueChips: ["Broken glass", "Window stuck", "Seal issue", "Frame damage"],
      followUps: [
        {
          id: "glass_safety",
          prompt: "Is the glass area safe right now?",
          options: ["Safe", "Needs urgent cover", "Not sure"],
        },
      ],
      quantityPrompt: "How many windows or panels?",
      quantityOptions: DEFAULT_QUANTITY_OPTIONS,
      timeWindowPrompt: "When should we come?",
      timeWindowOptions: DEFAULT_TIME_WINDOWS,
      photoRequired,
      photoRecommended,
      photoHelper: "A photo helps us estimate faster and send the right tools.",
    };
  }

  if (matches("masonry") || matches("crack")) {
    return {
      issueChips: ["Cracks", "Loose blocks", "Plaster repair", "Foundation check"],
      followUps: [
        {
          id: "masonry_area",
          prompt: "Where is the damage?",
          options: ["Exterior wall", "Interior wall", "Fence", "Multiple areas"],
        },
      ],
      quantityPrompt: "How many sections are affected?",
      quantityOptions: DEFAULT_QUANTITY_OPTIONS,
      timeWindowPrompt: "When should we come?",
      timeWindowOptions: DEFAULT_TIME_WINDOWS,
      photoRequired,
      photoRecommended,
      photoHelper: "A photo helps us estimate faster and send the right tools.",
    };
  }

  return {
    issueChips: ["Install", "Repair", "Inspection", "Replace", "Other"],
    followUps: [
      {
        id: "general_scope",
        prompt: "Which area is affected?",
        options: ["One room", "Multiple rooms", "Outdoor", "Not sure"],
      },
    ],
    quantityPrompt: "How many items or areas?",
    quantityOptions: DEFAULT_QUANTITY_OPTIONS,
    timeWindowPrompt: "When should we come?",
    timeWindowOptions: DEFAULT_TIME_WINDOWS,
    photoRequired,
    photoRecommended,
    photoHelper: photoRecommended
      ? "A photo helps us estimate faster and send the right tools."
      : undefined,
  };
}

function ChipButton({
  label,
  selected,
  onClick,
  className,
  selectedClassName,
}: {
  label: string;
  selected?: boolean;
  onClick?: () => void;
  className?: string;
  selectedClassName?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        CHIP_STYLES,
        selected
          ? selectedClassName || "border-[#039855] bg-[#039855] text-white"
          : "border-[#d0d5dd] bg-white text-[#344054] hover:bg-[#f9fafb]",
        className,
      )}
    >
      {label}
    </button>
  );
}

function ChatPrompt({ text, status = "active" }: { text: string; status?: "active" | "answered" }) {
  if (status === "answered") {
    return (
      <div className="flex items-center gap-2 text-[16px] leading-[24px] font-semibold text-[#475467]">
        <span className="inline-flex h-12 w-12 items-center justify-center text-[#475467] opacity-80">
          <AIAnsweredBotIcon />
        </span>
        <span>{text}</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <div className="h-10 w-10 shrink-0 rounded-full bg-[#ECFDF3] text-[#027A48] flex items-center justify-center border border-[#D1FADF] animate-pulse">
        <AIAskBotIcon />
      </div>
      <div className="rounded-[999px] bg-[#ECFDF3] px-6 py-[14px] text-[18px] leading-[24px] text-[#065F46] font-semibold max-w-[720px]">
        {text}
      </div>
    </div>
  );
}

function formatCategoryLabel(value: string) {
  if (!value) return "New request";
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatNaira(value: string | number | null | undefined) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) return "NGN 0";
  return `NGN ${amount.toLocaleString()}`;
}

function readConsultancyReport(report: ActiveServiceRequest["consultancyReport"]) {
  if (!report || typeof report !== "object") return null;
  const materialCost = Number((report as any).materialCost || 0);
  const serviceCost = Number((report as any).serviceCost || 0);
  const totalRecommendation =
    Number((report as any).totalRecommendation || 0) || materialCost + serviceCost;
  return {
    inspectionDate: String((report as any).inspectionDate || ""),
    actualIssue: String((report as any).actualIssue || ""),
    causeOfIssue: String((report as any).causeOfIssue || ""),
    materialCost: Number.isFinite(materialCost) ? materialCost : 0,
    serviceCost: Number.isFinite(serviceCost) ? serviceCost : 0,
    totalRecommendation: Number.isFinite(totalRecommendation) ? totalRecommendation : 0,
    preventiveRecommendation: String((report as any).preventiveRecommendation || ""),
  };
}

function formatCountdown(target: Date | null) {
  if (!target) return "Not scheduled";
  const diffMs = target.getTime() - Date.now();
  if (diffMs <= 0) return "Starting soon";

  const totalMinutes = Math.floor(diffMs / (1000 * 60));
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function toDate(value: string | Date | null | undefined) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function parseRequestDescription(description: string | null | undefined): ParsedRequestDetails {
  const source = String(description || "").trim();
  if (!source) return {};

  const boundaryLabels =
    "Issue|Quantity|Preferred time|Time window|Urgency|Location|Notes|Photos attached|Attachments|Photos";

  const pick = (labelPattern: string) => {
    const regex = new RegExp(
      `${labelPattern}:\\s*([\\s\\S]*?)(?=\\n|\\s(?:${boundaryLabels}):|$)`,
      "i",
    );
    const value = source.match(regex)?.[1]?.trim();
    return value || undefined;
  };

  const issueType = pick("Issue");
  const quantity = pick("Quantity");
  const timeWindow = pick("(?:Preferred time|Time window)");
  const notes = pick("Notes");
  const urgency = pick("Urgency");
  const location = pick("Location");
  const photoChunk = pick("(?:Photos attached|Attachments|Photos)");
  const photosMatch = photoChunk?.match(/(\d+)/);
  const photosCount = photosMatch ? Number(photosMatch[1]) : undefined;

  if (!issueType && !quantity && !timeWindow && !notes && !urgency && !location && photosCount === undefined) {
    return { notes: source };
  }

  return {
    issueType,
    quantity,
    timeWindow,
    photosCount,
    notes,
    urgency,
    location,
  };
}

function parseConsultancyReportMessage(text: string) {
  const source = String(text || "").trim();
  const hasConsultancyPrefix = /^consultancy report submitted\./i.test(source);
  const hasReportFields =
    /inspection date:/i.test(source) &&
    /issue:/i.test(source) &&
    /cause:/i.test(source) &&
    /recommended material cost:/i.test(source) &&
    /recommended service cost:/i.test(source) &&
    /preventive recommendation:/i.test(source);
  if (!hasConsultancyPrefix && !hasReportFields) return null;

  const pick = (label: string) => {
    const regex = new RegExp(`${label}:\\s*(.+)$`, "im");
    return source.match(regex)?.[1]?.trim() || "";
  };

  return {
    inspectionDate: pick("Inspection date") || undefined,
    actualIssue: pick("Issue") || "Not provided",
    causeOfIssue: pick("Cause") || "Not provided",
    materialCostLabel: pick("Recommended material cost") || "Not provided",
    serviceCostLabel: pick("Recommended service cost") || "Not provided",
    preventiveRecommendation: pick("Preventive recommendation") || "Not provided",
  };
}

export default function OrdinaryConversationFlow() {
  const [location, navigate] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: estates = [] } = useMyEstates();
  const { categories, isLoading: categoriesLoading } = useCategories({ scope: "global", kind: "service" });
  const CONSULTANCY_DRAFT_KEY = "citybuddy_consultancy_draft";

  const queryParams = useMemo(() => {
    const queryString = location.includes("?") ? location.split("?")[1] : "";
    return new URLSearchParams(queryString);
  }, [location]);

  const categoryFromSearch = queryParams.get("category") || "";
  const requestIdFromSearch = queryParams.get("requestId") || "";

  const [stage, setStage] = useState<FlowStage>("intake");

  const [estateName, setEstateName] = useState("");
  const [estateResidenceMode, setEstateResidenceMode] = useState<"estate" | "outside">("estate");
  const [estateSearch, setEstateSearch] = useState("");
  const [residentState, setResidentState] = useState("");
  const [residentLga, setResidentLga] = useState("");
  const [address, setAddress] = useState("");
  const [unit, setUnit] = useState("");
  const [selectedCategoryValue, setSelectedCategoryValue] = useState(categoryFromSearch);
  const [categorySelectSearch, setCategorySelectSearch] = useState("");
  const [urgency, setUrgency] = useState("");

  const [wizardIndex, setWizardIndex] = useState(0);
  const [wizardAnswers, setWizardAnswers] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState("");
  const [attachments, setAttachments] = useState<Array<{ id: string; name: string; dataUrl: string }>>([]);
  const [persistedAttachmentCount, setPersistedAttachmentCount] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const openedRequestFromQueryRef = useRef<string | null>(null);
  const skipCategoryResetRef = useRef(false);
  const chatBottomRef = useRef<HTMLDivElement | null>(null);
  const [activeRequestId, setActiveRequestId] = useState<string | null>(null);
  const [loadingRequestId, setLoadingRequestId] = useState<string | null>(null);
  const [pendingPrefill, setPendingPrefill] = useState(false);
  const [isTopSectionCollapsed, setIsTopSectionCollapsed] = useState(false);
  const [residentMessageDraft, setResidentMessageDraft] = useState("");
  const [composerAttachments, setComposerAttachments] = useState<ComposerAttachment[]>([]);
  const [isStartingJobPayment, setIsStartingJobPayment] = useState(false);

  useEffect(() => {
    if (!categories.length) return;

    if (selectedCategoryValue) return;

    if (categoryFromSearch) {
      const match = categories.find((cat: any) => {
        const name = String(cat?.name || "");
        const key = String(cat?.key || "");
        return name.toLowerCase() === categoryFromSearch.toLowerCase() || key.toLowerCase() === categoryFromSearch.toLowerCase();
      });
      if (match) {
        setSelectedCategoryValue(String(match.id ?? match.key ?? match.name));
        return;
      }
    }
  }, [categories, selectedCategoryValue, categoryFromSearch]);

  useEffect(() => {
    if (skipCategoryResetRef.current) {
      skipCategoryResetRef.current = false;
      return;
    }
    setWizardIndex(0);
    setWizardAnswers({});
    setNotes("");
    setAttachments([]);
    setPersistedAttachmentCount(null);
  }, [selectedCategoryValue]);

  useEffect(() => {
    if (selectedCategoryValue && stage === "intake") {
      setStage("wizard");
      setWizardIndex(0);
    }
  }, [selectedCategoryValue, stage]);

  const selectedCategoryLabel = useMemo(() => {
    if (!selectedCategoryValue) return "";
    const match = categories.find((cat: any) => {
      const id = String(cat?.id ?? "");
      const key = String(cat?.key ?? "");
      const name = String(cat?.name ?? "");
      return selectedCategoryValue === id || selectedCategoryValue === key || selectedCategoryValue === name;
    });
    return String(match?.name ?? match?.key ?? selectedCategoryValue);
  }, [categories, selectedCategoryValue]);

  const handleSelectCategoryFromGrid = (categoryName: string) => {
    const match = categories.find((cat: any) => {
      const name = String(cat?.name ?? "");
      const key = String(cat?.key ?? "");
      return (
        name.toLowerCase() === categoryName.toLowerCase() ||
        key.toLowerCase() === categoryName.toLowerCase()
      );
    });
    const value = String(match?.id ?? match?.key ?? match?.name ?? categoryName);
    const label = String(match?.name ?? match?.key ?? categoryName);
    setSelectedCategoryValue(value);
    setWizardAnswers((prev) => ({ ...prev, category_select: label }));
    setWizardIndex(0);
    setStage("wizard");
  };

  const categoryProfile = useMemo(
    () => buildCategoryProfile(selectedCategoryLabel || "General"),
    [selectedCategoryLabel],
  );

  const filteredEstates = useMemo(() => {
    const query = estateSearch.trim().toLowerCase();
    if (!query) return estates;
    return estates.filter((estate) => estate.name.toLowerCase().includes(query));
  }, [estates, estateSearch]);

  const availableLgas = useMemo(() => {
    return residentState ? LGA_BY_STATE[residentState] || [] : [];
  }, [residentState]);

  const isLocationComplete = useMemo(() => {
    if (estateResidenceMode === "outside") {
      return Boolean(residentState && residentLga && address.trim());
    }
    return Boolean((estateName || address).trim());
  }, [estateResidenceMode, residentState, residentLga, estateName, address]);

  const locationMissingHint = useMemo(() => {
    if (isLocationComplete) return "";
    if (estateResidenceMode === "outside") {
      if (!residentState) return "Select your state";
      if (!residentLga) return "Select your LGA";
      if (!address.trim()) return "Enter your address";
    } else {
      if (!(estateName || address).trim()) return "Select an estate or enter an address";
    }
    return "Complete the fields above to continue";
  }, [isLocationComplete, estateResidenceMode, residentState, residentLga, address, estateName]);

  const wizardSteps = useMemo<WizardStep[]>(() => {
    const followUps: WizardStep[] = categoryProfile.followUps.map((f) => ({
      id: f.id,
      kind: "chips",
      prompt: f.prompt,
      options: f.options,
    }));
    return [
      {
        id: "location",
        kind: "location",
        prompt: "Which estate do you reside?",
      },
      {
        id: "urgency",
        kind: "chips",
        prompt: "How urgent is this?",
        options: URGENCY_OPTIONS.map((opt) => opt.label),
      },
      {
        id: "issue_type",
        kind: "chips",
        prompt: "Pick the closest issue type.",
        options: categoryProfile.issueChips,
      },
      ...followUps,
      {
        id: "quantity",
        kind: "chips",
        prompt: categoryProfile.quantityPrompt,
        options: categoryProfile.quantityOptions,
      },
      {
        id: "time_window",
        kind: "chips",
        prompt: categoryProfile.timeWindowPrompt,
        options: categoryProfile.timeWindowOptions,
      },
      {
        id: "photos",
        kind: "photos",
        prompt: categoryProfile.photoRequired
          ? "Please upload at least one photo."
          : "Upload a photo if available.",
        required: categoryProfile.photoRequired,
        helperText: categoryProfile.photoHelper,
      },
      {
        id: "notes",
        kind: "text",
        prompt: "Anything else we should know?",
        placeholder: "Add any extra details here.",
      },
    ];
  }, [categoryProfile]);

  const intakeLocationLabel = () => {
    const base =
      estateResidenceMode === "outside"
        ? [address, residentLga, residentState].filter(Boolean).join(", ") || "Not provided"
        : estateName || address || "Not provided";
    if (!unit.trim()) return base;
    return `${base} - Unit ${unit.trim()}`;
  };

  const currentStep = wizardSteps[wizardIndex];
  const effectiveAttachmentCount = persistedAttachmentCount ?? attachments.length;

  const historyBlocks = wizardSteps
    .filter((step) => {
      if (step.kind === "photos") return effectiveAttachmentCount > 0 || wizardAnswers[step.id];
      if (step.kind === "text") return Boolean(notes.trim());
      return Boolean(wizardAnswers[step.id]);
    })
    .map((step) => {
      let answer = wizardAnswers[step.id] || "";
      if (step.kind === "photos") {
        answer = effectiveAttachmentCount ? `${effectiveAttachmentCount} photo(s) added` : "Skipped";
      }
      if (step.kind === "text") {
        answer = notes.trim();
      }
      return { prompt: step.prompt, answer };
    });

  const handleSelectChip = (stepId: string, value: string) => {
    if (stepId === "urgency") {
      setUrgency(value);
    }
    setWizardAnswers((prev) => ({ ...prev, [stepId]: value }));
    const nextIndex = Math.min(wizardIndex + 1, wizardSteps.length - 1);
    setWizardIndex(nextIndex);
  };

  const handleUploadClick = () => fileInputRef.current?.click();

  const handleAddAttachment = (file: File) => {
    setPersistedAttachmentCount(null);
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      if (!result) return;
      setAttachments((prev) => {
        if (prev.length >= 3) return prev;
        return [...prev, { id: `${Date.now()}-${Math.random()}`, name: file.name, dataUrl: result }];
      });
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveAttachment = (id: string) => {
    setPersistedAttachmentCount(null);
    setAttachments((prev) => prev.filter((att) => att.id !== id));
  };

  const handleFinishNotes = () => {
    if (!notes.trim()) {
      setNotes("");
    }
    setStage("summary");
  };

  const resetFlowForNewRequest = () => {
    setStage("intake");
    setSelectedCategoryValue("");
    setCategorySelectSearch("");
    setWizardIndex(0);
    setWizardAnswers({});
    setNotes("");
    setAttachments([]);
    setPersistedAttachmentCount(null);
    setUrgency("");
    setAddress("");
    setUnit("");
    setEstateName("");
    setResidentState("");
    setResidentLga("");
    setEstateResidenceMode("estate");
    setActiveRequestId(null);
  };

  const jumpToWizard = (stepId: string) => {
    const idx = wizardSteps.findIndex((s) => s.id === stepId);
    if (idx >= 0) {
      setStage("wizard");
      setWizardIndex(idx);
    }
  };

  const hydrateFromRequest = (request: any) => {
    const parsedDetails = parseRequestDescription(request?.description);
    const urgencyLabel =
      URGENCY_OPTIONS.find((opt) => opt.value.toLowerCase() === String(request?.urgency || "").toLowerCase())?.label ||
      parsedDetails.urgency ||
      String(request?.urgency || "");

    setActiveRequestId(request?.id || null);
    skipCategoryResetRef.current = true;
    setSelectedCategoryValue(request?.category || "");
    setUrgency(urgencyLabel);
    setWizardAnswers((prev) => ({
      ...prev,
      location: request?.location || parsedDetails.location || "",
      urgency: urgencyLabel,
      issue_type:
        parsedDetails.issueType ||
        (request?.category ? formatCategoryLabel(request.category) : prev.issue_type),
      quantity: parsedDetails.quantity || prev.quantity,
      time_window:
        parsedDetails.timeWindow ||
        (request?.preferredTime ? new Date(request.preferredTime).toLocaleString() : prev.time_window),
    }));
    setNotes(parsedDetails.notes || "");
    setAddress(request?.location || parsedDetails.location || "");
    setEstateResidenceMode("outside");
    setEstateName("");
    setResidentState("");
    setResidentLga("");
    setUnit("");
    setAttachments([]);
    setPersistedAttachmentCount(parsedDetails.photosCount ?? 0);
    setStage("wizard");
    setPendingPrefill(true);
  };

  const handleOpenRecentRequest = async (requestId: string) => {
    if (requestId === draftSessionId) {
      setActiveRequestId(null);
      setStage("wizard");
      return;
    }
    try {
      setLoadingRequestId(requestId);
      const res = await fetch(`/api/app/service-requests/${requestId}`);
      if (!res.ok) throw new Error(`Failed to load request (${res.status})`);
      const data = await res.json();
      hydrateFromRequest(data);
    } catch (error) {
      console.error("Failed to load request", error);
    } finally {
      setLoadingRequestId(null);
    }
  };

  useEffect(() => {
    if (!requestIdFromSearch) return;
    if (openedRequestFromQueryRef.current === requestIdFromSearch) return;
    openedRequestFromQueryRef.current = requestIdFromSearch;
    void handleOpenRecentRequest(requestIdFromSearch);
  }, [requestIdFromSearch]);

  const photoGuard =
    categoryProfile.photoRequired && attachments.length === 0
      ? "This category needs at least one photo before continuing."
      : "";

  const { data: activeRequestLive } = useQuery<ActiveServiceRequest>({
    queryKey: ["resident-active-request", activeRequestId],
    enabled: Boolean(activeRequestId),
    queryFn: async () => residentFetch<ActiveServiceRequest>(`/api/app/service-requests/${activeRequestId}`),
  });

  const [countdownTick, setCountdownTick] = useState(() => Date.now());
  useEffect(() => {
    if (!activeRequestId) return;
    const timer = window.setInterval(() => setCountdownTick(Date.now()), 60000);
    return () => window.clearInterval(timer);
  }, [activeRequestId]);

  const providerCount = activeRequestLive?.providerId ? 1 : 0;
  const providerStatusLabel = activeRequestId
    ? providerCount > 0
      ? "Provider assigned"
      : "No provider assigned yet"
    : "Providers will be matched after booking";

  const assignedProvider = useMemo(() => {
    if (!activeRequestLive?.providerId) return null;

    const scheduledAt = toDate(activeRequestLive.preferredTime) || toDate(activeRequestLive.assignedAt);
    const providerName = activeRequestLive.provider?.name || "Assigned consultant";
    const providerRole = formatCategoryLabel(
      activeRequestLive.provider?.serviceCategory ||
        activeRequestLive.category ||
        selectedCategoryLabel ||
        wizardAnswers.issue_type ||
        "Consultant",
    );
    const providerCompany = activeRequestLive.provider?.company || "Assigned provider";
    const providerAvatar =
      activeRequestLive.provider?.avatarUrl ||
      `https://api.dicebear.com/7.x/personas/svg?seed=${encodeURIComponent(activeRequestLive.providerId)}`;

    return {
      name: providerName,
      role: providerRole,
      company: providerCompany,
      scheduledAt,
      countdown: formatCountdown(scheduledAt),
      photo: providerAvatar,
    };
  }, [
    activeRequestLive?.providerId,
    activeRequestLive?.provider?.name,
    activeRequestLive?.provider?.company,
    activeRequestLive?.provider?.serviceCategory,
    activeRequestLive?.provider?.avatarUrl,
    activeRequestLive?.category,
    activeRequestLive?.preferredTime,
    activeRequestLive?.assignedAt,
    selectedCategoryLabel,
    wizardAnswers.issue_type,
    countdownTick,
  ]);

  useEffect(() => {
    if (!pendingPrefill) return;
    const firstUnansweredIdx = wizardSteps.findIndex((step) => {
      if (step.kind === "photos") return effectiveAttachmentCount === 0;
      if (step.kind === "text") return notes.trim().length === 0;
      return !wizardAnswers[step.id];
    });
    const targetIdx = firstUnansweredIdx === -1 ? Math.max(wizardSteps.length - 1, 0) : firstUnansweredIdx;
    setWizardIndex(targetIdx);
    setPendingPrefill(false);
  }, [pendingPrefill, wizardSteps, wizardAnswers, notes, effectiveAttachmentCount]);

  const handleBookConsultancy = () => {
    const requestStatus = String(activeRequestLive?.status || "").toLowerCase();
    const paymentStatus = String(activeRequestLive?.paymentStatus || "").toLowerCase();
    const alreadyBooked =
      Boolean(activeRequestId) &&
      (paymentStatus === "paid" ||
        ["pending_inspection", "assigned", "assigned_for_job", "in_progress", "completed", "cancelled"].includes(
          requestStatus,
        ));
    if (alreadyBooked) {
      return;
    }

    const selectedCategory = categories.find((cat: any) => {
      const id = String(cat?.id ?? "");
      const key = String(cat?.key ?? "");
      const name = String(cat?.name ?? "");
      return selectedCategoryValue === id || selectedCategoryValue === key || selectedCategoryValue === name;
    });

    const descriptionParts = [
      wizardAnswers.issue_type ? `Issue: ${wizardAnswers.issue_type}` : null,
      ...categoryProfile.followUps.map((f) =>
        wizardAnswers[f.id] ? `${f.prompt}: ${wizardAnswers[f.id]}` : null,
      ),
      wizardAnswers.quantity ? `Quantity: ${wizardAnswers.quantity}` : null,
      wizardAnswers.time_window ? `Preferred time: ${wizardAnswers.time_window}` : null,
      urgency ? `Urgency: ${urgency}` : null,
      `Location: ${intakeLocationLabel()}`,
      notes.trim() ? `Notes: ${notes.trim()}` : null,
      effectiveAttachmentCount
        ? `Photos attached: ${effectiveAttachmentCount}`
        : "Photos attached: 0",
    ].filter(Boolean);
    const categoryKeyCandidate = String(
      selectedCategory?.key ?? selectedCategory?.name ?? selectedCategoryLabel ?? selectedCategoryValue ?? "",
    )
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");

    const draft = {
      categoryKey: categoryKeyCandidate || "maintenance_repair",
      categoryLabel: selectedCategoryLabel || String(selectedCategory?.name ?? ""),
      urgency,
      location: intakeLocationLabel(),
      description: descriptionParts.join("\n"),
      attachmentsCount: effectiveAttachmentCount,
    };

    try {
      sessionStorage.setItem(CONSULTANCY_DRAFT_KEY, JSON.stringify(draft));
    } catch {
      // ignore storage errors
    }

    navigate("/checkout-diagnosis");
  };

  const draftSessionId = "draft-ordinary-flow";
  const draftSessions = useMemo(
    () => [
      {
        id: draftSessionId,
        title: selectedCategoryLabel || "New request",
        updatedAt: new Date().toISOString(),
        snippet: intakeLocationLabel(),
        status: "draft",
      },
    ],
    [selectedCategoryLabel, intakeLocationLabel],
  );

  const activeSessionId = activeRequestId || draftSessionId;

  const { data: serviceRequestMessages = [] } = useQuery<RequestMessage[]>({
    queryKey: ["resident-request-messages", activeRequestId],
    enabled: Boolean(activeRequestId),
    queryFn: async () => {
      return residentFetch<RequestMessage[]>(`/api/service-requests/${activeRequestId}/messages`);
    },
  });

  const sendResidentMessageMutation = useMutation({
    mutationFn: async (payload: { requestId: string; message: string; attachmentUrl?: string }) =>
      residentFetch<RequestMessage>(`/api/service-requests/${payload.requestId}/messages`, {
        method: "POST",
        json: payload.attachmentUrl
          ? { message: payload.message, attachmentUrl: payload.attachmentUrl }
          : { message: payload.message },
      }),
    onSuccess: (createdMessage) => {
      queryClient.setQueryData<RequestMessage[]>(
        ["resident-request-messages", createdMessage.requestId],
        (prev = []) => {
          if (prev.some((item) => item.id === createdMessage.id)) return prev;
          return [...prev, createdMessage];
        },
      );
    },
  });

  const declineJobPaymentMutation = useMutation({
    mutationFn: async (payload: { requestId: string; reason?: string }) =>
      residentFetch(`/api/service-requests/${payload.requestId}/payment/decline`, {
        method: "POST",
        json: payload.reason ? { reason: payload.reason } : {},
      }),
    onSuccess: async (_data, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["resident-active-request", variables.requestId] }),
        queryClient.invalidateQueries({ queryKey: ["admin.bridge.service-requests"] }),
      ]);
    },
  });

  useEffect(() => {
    if (!user?.id) return;

    const socket = io();
    socket.emit("join", user.id);

    socket.on("request-message:new", (payload: RequestMessageSocketPayload) => {
      if (!payload?.requestId || !payload?.message) return;
      queryClient.setQueryData<RequestMessage[]>(
        ["resident-request-messages", payload.requestId],
        (prev = []) => {
          if (prev.some((item) => item.id === payload.message.id)) return prev;
          return [...prev, payload.message];
        },
      );
    });

    socket.on("service-request:updated", (payload: ServiceRequestUpdateSocketPayload) => {
      if (!payload?.requestId) return;

      queryClient.invalidateQueries({ queryKey: ["resident-active-request", payload.requestId] });
      queryClient.invalidateQueries({ queryKey: ["resident-request-messages", payload.requestId] });

      queryClient.setQueryData<any[]>(["my-recent-requests"], (prev = []) =>
        prev.map((item) => {
          if (item?.id !== payload.requestId) return item;
          return {
            ...item,
            ...(payload.request || {}),
            id: item.id,
            updatedAt: (payload.request as any)?.updatedAt || payload.at || item.updatedAt,
          };
        }),
      );
    });

    return () => {
      socket.disconnect();
    };
  }, [queryClient, user?.id]);

  const orderedServiceMessages = useMemo(
    () =>
      [...serviceRequestMessages].sort((a, b) => {
        const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return aTime - bTime;
      }),
    [serviceRequestMessages],
  );

  const providerDisplayName = assignedProvider?.name || "CityConnect Assistant";
  const canMessageAssignedProvider = Boolean(activeRequestLive?.providerId);
  const activeRequestStatusLabel = activeRequestLive?.status
    ? formatServiceRequestStatusLabel(activeRequestLive.status, activeRequestLive?.category || selectedCategoryLabel)
    : "";
  const activeRequestStatusValue = String(activeRequestLive?.status || "").toLowerCase();
  const activeRequestPaymentStatusValue = String(activeRequestLive?.paymentStatus || "").toLowerCase();
  const activeConsultancyReport = useMemo(
    () => readConsultancyReport(activeRequestLive?.consultancyReport || null),
    [activeRequestLive?.consultancyReport],
  );
  const hasJobPaymentRequest = Boolean(activeRequestLive?.paymentRequestedAt) && Number(activeRequestLive?.billedAmount || 0) > 0;
  const canPayJobRequest =
    hasJobPaymentRequest && !["paid", "cancelled", "failed", "unpaid"].includes(activeRequestPaymentStatusValue);
  const paymentCardStatusLabel =
    activeRequestPaymentStatusValue === "paid"
      ? "Paid"
      : activeRequestPaymentStatusValue === "cancelled" || activeRequestPaymentStatusValue === "failed"
        ? "Declined"
        : canPayJobRequest
          ? "Pending payment"
          : "Pending";
  const parsedActiveRequestDetails = useMemo(
    () => parseRequestDescription(activeRequestLive?.description),
    [activeRequestLive?.description],
  );
  const summaryLocationValue = activeRequestLive?.location || intakeLocationLabel();
  const summaryUrgencyValue =
    URGENCY_OPTIONS.find(
      (opt) => opt.value.toLowerCase() === String(activeRequestLive?.urgency || "").toLowerCase(),
    )?.label ||
    parsedActiveRequestDetails.urgency ||
    urgency ||
    "Not set";
  const summaryProblemTypeValue = parsedActiveRequestDetails.issueType || wizardAnswers.issue_type || "Not set";
  const summaryQuantityValue = parsedActiveRequestDetails.quantity || wizardAnswers.quantity || "Not set";
  const summaryTimeWindowValue =
    parsedActiveRequestDetails.timeWindow || wizardAnswers.time_window || "Not set";
  const summaryAttachmentCount =
    parsedActiveRequestDetails.photosCount ?? persistedAttachmentCount ?? attachments.length;
  const consultancyAlreadyBooked = Boolean(activeRequestId) && (
    activeRequestPaymentStatusValue === "paid" ||
    ["pending_inspection", "assigned", "assigned_for_job", "in_progress", "completed", "cancelled"].includes(
      activeRequestStatusValue,
    )
  );
  const canBookConsultancy = !consultancyAlreadyBooked;
  const summaryItems = [
    {
      label: "Category",
      value: formatCategoryLabel(activeRequestLive?.category || selectedCategoryLabel) || "Not selected",
      onEdit: () => {
        setStage("intake");
        setWizardIndex(0);
      },
    },
    {
      label: "Location",
      value: summaryLocationValue,
      onEdit: () => jumpToWizard("location"),
    },
    {
      label: "Urgency",
      value: summaryUrgencyValue,
      onEdit: () => jumpToWizard("urgency"),
    },
    {
      label: "Problem type",
      value: summaryProblemTypeValue,
      onEdit: () => jumpToWizard("issue_type"),
    },
    {
      label: "Quantity",
      value: summaryQuantityValue,
      onEdit: () => jumpToWizard("quantity"),
    },
    {
      label: "Time window",
      value: summaryTimeWindowValue,
      onEdit: () => jumpToWizard("time_window"),
    },
    {
      label: "Attachments",
      value: `${summaryAttachmentCount} photo(s)`,
      onEdit: () => jumpToWizard("photos"),
    },
  ];
  const showWizardInteractiveStep = !activeRequestId || activeRequestStatusValue === "pending";

  const providerAvailabilityLabel = canMessageAssignedProvider
    ? "Assigned to this request"
    : "Awaiting assignment";
  const providerEtaLabel = assignedProvider?.scheduledAt
    ? `Scheduled ${assignedProvider.scheduledAt.toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })}`
      : "Schedule pending";

  const handlePayRequestedJob = async () => {
    if (!activeRequestId) return;
    const amount = Number(activeRequestLive?.billedAmount || 0);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast({
        title: "Payment amount missing",
        description: "No valid amount is set for this request yet.",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsStartingJobPayment(true);
      const session = await residentFetch<{ reference: string }>("/api/payments/paystack/session", {
        method: "POST",
        json: {
          amount,
          serviceRequestId: activeRequestId,
          description: `Job payment for ${formatCategoryLabel(activeRequestLive?.category || selectedCategoryLabel || "service request")}`,
        },
      });

      const init = await residentFetch<{ authorization_url?: string; authorizationUrl?: string }>(
        "/api/paystack/init",
        {
          method: "POST",
          json: {
            email: user?.email || "resident@example.com",
            amountInNaira: amount,
            metadata: {
              residentId: user?.id,
              serviceRequestId: activeRequestId,
              sessionReference: session.reference,
              paymentKind: "job_request_payment",
            },
            reference: session.reference,
            callbackUrl: `${window.location.origin}/payment-confirmation`,
          },
        },
      );

      const authUrl = init.authorization_url || init.authorizationUrl;
      if (!authUrl) {
        throw new Error("Missing authorization URL from Paystack initialization");
      }

      window.location.href = authUrl;
    } catch (error: any) {
      toast({
        title: "Payment error",
        description: error?.message || "Could not start payment.",
        variant: "destructive",
      });
      setIsStartingJobPayment(false);
    }
  };

  const handleDeclineRequestedPayment = async () => {
    if (!activeRequestId || declineJobPaymentMutation.isPending) return;
    const shouldDecline = window.confirm("Decline this payment request?");
    if (!shouldDecline) return;

    try {
      await declineJobPaymentMutation.mutateAsync({ requestId: activeRequestId });
      toast({
        title: "Payment declined",
        description: "The request has been marked as declined.",
      });
    } catch (error: any) {
      toast({
        title: "Could not decline payment",
        description: error?.message || "Please try again.",
        variant: "destructive",
      });
    }
  };

  const conversationItems = useMemo<ThreadItem[]>(() => {
    const items: ThreadItem[] = [];

    if (assignedProvider) {
      items.push({
        id: "provider-assigned-event",
        kind: "event",
        title: "We've assigned a consultant for your visit",
        body: `${assignedProvider.name} (${assignedProvider.role}) is now linked to your request.`,
        scheduleLabel: assignedProvider.scheduledAt
          ? assignedProvider.scheduledAt.toLocaleString(undefined, {
              weekday: "short",
              month: "short",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
            })
          : "Schedule to be confirmed",
        countdownLabel:
          assignedProvider.countdown === "Not scheduled"
            ? "Awaiting schedule"
            : `${assignedProvider.countdown} remaining`,
      });
    }

    historyBlocks.forEach((block, idx) => {
      items.push({
        id: `prompt-${idx}`,
        kind: "message",
        role: "provider",
        text: block.prompt,
      });
      items.push({
        id: `answer-${idx}`,
        kind: "message",
        role: "resident",
        text: block.answer,
      });
    });

    orderedServiceMessages.forEach((message) => {
      const consultancyReport = parseConsultancyReportMessage(message.message);
      if (consultancyReport) {
        items.push({
          id: `consultancy-report-${message.id}`,
          kind: "consultancy_report",
          inspectionDate: consultancyReport.inspectionDate,
          actualIssue: consultancyReport.actualIssue,
          causeOfIssue: consultancyReport.causeOfIssue,
          materialCostLabel: consultancyReport.materialCostLabel,
          serviceCostLabel: consultancyReport.serviceCostLabel,
          preventiveRecommendation: consultancyReport.preventiveRecommendation,
          timestamp: message.createdAt,
        });
        return;
      }

      items.push({
        id: `thread-${message.id}`,
        kind: "message",
        role: message.senderRole === "resident" ? "resident" : message.senderRole,
        text: message.message,
        attachmentUrl: message.attachmentUrl || undefined,
        timestamp: message.createdAt,
      });
    });

    if (hasJobPaymentRequest) {
      const reportNoteParts = activeConsultancyReport
        ? [
            activeConsultancyReport.inspectionDate
              ? `Inspection date: ${new Date(activeConsultancyReport.inspectionDate).toLocaleString()}`
              : "",
            activeConsultancyReport.actualIssue
              ? `Issue: ${activeConsultancyReport.actualIssue}`
              : "",
            activeConsultancyReport.causeOfIssue
              ? `Cause: ${activeConsultancyReport.causeOfIssue}`
              : "",
            activeConsultancyReport.materialCost >= 0
              ? `Material cost: NGN ${activeConsultancyReport.materialCost.toLocaleString()}`
              : "",
            activeConsultancyReport.serviceCost >= 0
              ? `Service cost: NGN ${activeConsultancyReport.serviceCost.toLocaleString()}`
              : "",
            activeConsultancyReport.totalRecommendation > 0
              ? `Total recommendation: NGN ${activeConsultancyReport.totalRecommendation.toLocaleString()}`
              : "",
            activeConsultancyReport.preventiveRecommendation
              ? `Prevention: ${activeConsultancyReport.preventiveRecommendation}`
              : "",
          ].filter(Boolean)
        : [];

      items.push({
        id: "payment-request-card",
        kind: "payment",
        amountLabel: formatNaira(activeRequestLive?.billedAmount),
        statusLabel: paymentCardStatusLabel,
        note:
          reportNoteParts.length > 0
            ? reportNoteParts.join("\n")
            : "Review the amount and complete payment to continue to job assignment.",
        requestedAt:
          typeof activeRequestLive?.paymentRequestedAt === "string"
            ? activeRequestLive.paymentRequestedAt
            : activeRequestLive?.paymentRequestedAt
              ? new Date(activeRequestLive.paymentRequestedAt).toISOString()
              : undefined,
        canPay: canPayJobRequest,
        onPay: handlePayRequestedJob,
        onDecline: handleDeclineRequestedPayment,
        isPaying: isStartingJobPayment,
        isDeclining: declineJobPaymentMutation.isPending,
      });
    }

    return items;
  }, [
    activeRequestLive?.billedAmount,
    activeConsultancyReport,
    activeRequestLive?.paymentRequestedAt,
    assignedProvider,
    canPayJobRequest,
    declineJobPaymentMutation.isPending,
    handleDeclineRequestedPayment,
    handlePayRequestedJob,
    hasJobPaymentRequest,
    historyBlocks,
    isStartingJobPayment,
    orderedServiceMessages,
    paymentCardStatusLabel,
  ]);
  const shouldPrioritizeInteractiveStep = showWizardInteractiveStep && conversationItems.length === 0;

  const handleComposerAttachFiles = (files: File[]) => {
    const supportedFiles = files.filter(
      (file) => file.type.startsWith("image/") || file.type.startsWith("audio/"),
    );
    const roomLeft = Math.max(0, 3 - composerAttachments.length);
    if (!roomLeft) return;

    supportedFiles.slice(0, roomLeft).forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = typeof reader.result === "string" ? reader.result : "";
        if (!result) return;
        const kind = file.type.startsWith("audio/") ? "audio" : "image";
        setComposerAttachments((prev) => [
          ...prev,
          {
            id: `${Date.now()}-${Math.random()}`,
            name: file.name,
            previewUrl: result,
            kind,
            mimeType: file.type,
          },
        ]);
      };
      reader.readAsDataURL(file);
    });
  };

  const handleRemoveComposerAttachment = (attachmentId: string) => {
    setComposerAttachments((prev) => prev.filter((attachment) => attachment.id !== attachmentId));
  };

  const handleShareLocationToComposer = () => {
    const locationSnippet = intakeLocationLabel();
    if (!locationSnippet || locationSnippet === "Not provided") return;
    setResidentMessageDraft((prev) =>
      prev.trim() ? `${prev}\nLocation: ${locationSnippet}` : `Location: ${locationSnippet}`,
    );
  };

  const handleSendComposerMessage = async () => {
    if (!activeRequestId) return;
    const trimmed = residentMessageDraft.trim();
    if (!trimmed && composerAttachments.length === 0) return;
    if (sendResidentMessageMutation.isPending) return;

    try {
      if (composerAttachments.length === 0) {
        await sendResidentMessageMutation.mutateAsync({
          requestId: activeRequestId,
          message: trimmed,
        });
      } else {
        for (let index = 0; index < composerAttachments.length; index += 1) {
          const attachment = composerAttachments[index];
          const attachmentLabel =
            attachment.kind === "audio" ? "Shared a voice note." : "Shared an attachment.";
          const messageText = index === 0 && trimmed ? trimmed : attachmentLabel;

          await sendResidentMessageMutation.mutateAsync({
            requestId: activeRequestId,
            message: messageText,
            attachmentUrl: attachment.previewUrl,
          });
        }
      }

      setResidentMessageDraft("");
      setComposerAttachments([]);
    } catch {
      // handled by mutation error state/UI
    }
  };

  useEffect(() => {
    if (stage !== "wizard") return;
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [
    canMessageAssignedProvider,
    conversationItems.length,
    historyBlocks.length,
    showWizardInteractiveStep,
    stage,
  ]);

  return (
    <div className="flex h-screen overflow-hidden bg-[#054f31]">
      <MobileNavDrawer
        onNavigateToHomepage={() => navigate("/resident")}
        onNavigateToMarketplace={() => navigate("/resident/citymart")}
        onNavigateToSettings={() => navigate("/resident/settings")}
        onNavigateToServiceRequests={() => navigate("/service-requests")}
        onBookServiceClick={() => navigate("/resident/requests/new")}
        onNavigateToOrdinaryFlow={() => navigate("/resident/requests/ordinary")}
        currentPage="ordinary_flow"
      />

      <div className="hidden lg:block h-full">
        <Nav
          onNavigateToHomepage={() => navigate("/resident")}
          onNavigateToMarketplace={() => navigate("/resident/citymart")}
          onNavigateToSettings={() => navigate("/resident/settings")}
          onNavigateToServiceRequests={() => navigate("/service-requests")}
          onBookServiceClick={() => navigate("/resident/requests/new")}
          onNavigateToOrdinaryFlow={() => navigate("/resident/requests/ordinary")}
          currentPage="ordinary_flow"
        />
      </div>

      <div className="flex h-full min-w-0 flex-1 gap-4 overflow-hidden lg:ml-[14px] lg:mt-[12px]">
        <div className="hidden h-full w-[340px] shrink-0 overflow-hidden lg:block">
          <RequestsSidebar
            onCreateNew={resetFlowForNewRequest}
            activeSessionId={activeSessionId}
            onSelectSession={handleOpenRecentRequest}
            loadingSessionId={loadingRequestId}
            draftSessions={draftSessions}
          />
        </div>
        <div className="flex h-full min-w-0 flex-1 flex-col overflow-hidden rounded-l-[40px] border border-[#E4E7EC]/60 bg-[#F8FAFC] shadow-[inset_0_1px_0_rgba(255,255,255,0.4)]">
          <div className="border-b border-[#EAECF0] bg-white px-5 py-2.5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[24px] font-semibold tracking-[-0.02em] text-[#101828]">
                  Request Assistant
                </p>
                {!isTopSectionCollapsed ? (
                  <p className="text-[12px] text-[#98A2B3]">
                    Location and urgency are captured first to reduce pricing errors. Then we guide you with quick chips.
                  </p>
                ) : null}
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center rounded-full border border-[#D1FADF] bg-[#ECFDF3] px-3 py-1 text-xs font-semibold text-[#027A48]">
                  {selectedCategoryLabel ? formatCategoryLabel(selectedCategoryLabel) : "No category selected"}
                </span>
                {stage === "wizard" ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={() => setIsTopSectionCollapsed((prev) => !prev)}
                    aria-label={isTopSectionCollapsed ? "Expand top section" : "Collapse top section"}
                  >
                    {isTopSectionCollapsed ? "Expand" : "Collapse"}
                  </Button>
                ) : null}
              </div>
            </div>
          </div>

          {stage === "wizard" ? (
            <div
              className={cn(
                "overflow-hidden transition-[max-height,opacity] duration-200 ease-out",
                isTopSectionCollapsed ? "max-h-0 opacity-0" : "max-h-[220px] opacity-100",
              )}
            >
              <ProviderHeader
                providerName={providerDisplayName}
                providerRole={assignedProvider?.role || "Service coordinator"}
                availabilityLabel={providerAvailabilityLabel}
                etaLabel={providerEtaLabel}
                coverageLabel={intakeLocationLabel()}
                onReviewSummary={() => setStage("summary")}
              />
              <RequestProgressTracker status={activeRequestLive?.status || (activeRequestId ? "pending" : "draft")} />
            </div>
          ) : null}

          <div className="min-h-0 flex-1 overflow-hidden">

          {stage === "intake" ? (
            <div className="h-full overflow-y-auto">
              <div className="mx-auto max-w-5xl space-y-4 p-6">
                <MainWrapSelectCategory
                  searchQuery={categorySelectSearch}
                  setSearchQuery={setCategorySelectSearch}
                  onCategorySelect={handleSelectCategoryFromGrid}
                  categoriesData={categories}
                  catsLoading={categoriesLoading}
                  myEstates={estates}
                  selectedEstateName={estateName || null}
                  setSelectedEstateName={(value) => setEstateName(value || "")}
                  isOutsideCityConnectEstate={false}
                  setIsOutsideCityConnectEstate={(outside) => setEstateResidenceMode(outside ? "outside" : "estate")}
                />
              </div>
            </div>
          ) : null}

          {stage === "wizard" ? (
            <div className="mx-auto flex h-full max-w-5xl min-h-0 flex-col gap-2 px-5 pb-3 pt-2">
              <div className="flex min-h-0 flex-1 flex-col">
                    <div
                      className={cn(
                        "city-scrollbar overflow-y-auto px-1 pb-1",
                        shouldPrioritizeInteractiveStep ? "hidden" : "min-h-0 flex-1",
                      )}
                    >
                      {conversationItems.length > 0 ? (
                        <ChatThread items={conversationItems} />
                      ) : (
                        <SystemMessage text="Conversation starts once the first response is captured." />
                      )}
                      <div ref={chatBottomRef} />
                    </div>

                    {showWizardInteractiveStep && currentStep ? (
                      <div
                        className={cn(
                          shouldPrioritizeInteractiveStep
                            ? "min-h-0 flex-1"
                            : "mt-1 shrink-0 border-t border-[#EAECF0] pt-2",
                        )}
                      >
                        <div
                          className={cn(
                            "space-y-4 pr-1",
                            shouldPrioritizeInteractiveStep
                              ? "city-scrollbar h-full min-h-0 overflow-y-auto"
                              : "city-scrollbar max-h-[32vh] overflow-y-auto",
                          )}
                        >
                        <ChatPrompt text={currentStep.prompt} />
                        {currentStep.kind === "location" ? (
                          <div className="space-y-3">
                            <div className="rounded-2xl border border-[#EAECF0] bg-[#f9fafb] p-4 space-y-3">
                              <input
                                value={estateSearch}
                                onChange={(event) => setEstateSearch(event.target.value)}
                                placeholder="Search estate"
                                className="w-full rounded-xl border border-[#D0D5DD] bg-white px-3 py-2 text-sm"
                              />
                              <div className="flex flex-wrap gap-2">
                                {filteredEstates.slice(0, 8).map((estate) => (
                                  <button
                                    key={estate.id}
                                    type="button"
                                    onClick={() => {
                                      setEstateResidenceMode("estate");
                                      setEstateName(estate.name);
                                      setResidentState("");
                                      setResidentLga("");
                                    }}
                                    className={cn(
                                      "rounded-xl border px-4 py-2 text-sm font-semibold transition",
                                      estateResidenceMode === "estate" && estateName === estate.name
                                        ? "border-[#039855] bg-[#ECFDF3] text-[#027A48]"
                                        : "border-[#D0D5DD] bg-white text-[#344054] hover:bg-[#f9fafb]",
                                    )}
                                  >
                                    {estate.name}
                                  </button>
                                ))}
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEstateResidenceMode("outside");
                                    setEstateName("");
                                    setUnit("");
                                  }}
                                  className={cn(
                                    "rounded-xl border px-4 py-2 text-sm font-semibold transition",
                                    estateResidenceMode === "outside"
                                      ? "border-[#039855] bg-[#ECFDF3] text-[#027A48]"
                                      : "border-[#D0D5DD] bg-white text-[#344054] hover:bg-[#f9fafb]",
                                  )}
                                >
                                  I don't stay in an estate
                                </button>
                              </div>
                            </div>

                            <ChatPrompt
                              text={
                                estateResidenceMode === "outside"
                                  ? "Where do you stay?"
                                  : "To not get lost, give me more specifics."
                              }
                            />

                            <div className="rounded-2xl border border-[#EAECF0] bg-[#f9fafb] p-4 space-y-3">
                              {estateResidenceMode === "outside" ? (
                                <div className="grid gap-3 md:grid-cols-2">
                                  <div>
                                    <p className="text-[12px] text-[#667085] mb-2">State</p>
                                    <Select
                                      value={residentState || ""}
                                      onValueChange={(value) => {
                                        setResidentState(value);
                                        setResidentLga("");
                                      }}
                                    >
                                      <SelectTrigger className="w-full bg-white">
                                        <SelectValue placeholder="Select state" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {STATE_OPTIONS.map((stateOption) => (
                                          <SelectItem key={stateOption} value={stateOption}>
                                            {stateOption}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  <div>
                                    <p className="text-[12px] text-[#667085] mb-2">LGA</p>
                                    <Select
                                      value={residentLga || ""}
                                      onValueChange={(value) => setResidentLga(value)}
                                      disabled={!residentState}
                                    >
                                      <SelectTrigger className="w-full bg-white">
                                        <SelectValue placeholder={residentState ? "Select LGA" : "Select state first"} />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {availableLgas.map((lga) => (
                                          <SelectItem key={lga} value={lga}>
                                            {lga}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  <div className="md:col-span-2">
                                    <p className="text-[12px] text-[#667085] mb-2">Address</p>
                                    <textarea
                                      value={address}
                                      onChange={(e) => setAddress(e.target.value)}
                                      placeholder="Enter your address"
                                      className="min-h-[110px] w-full rounded-xl border border-[#D0D5DD] bg-white px-3 py-2 text-sm"
                                    />
                                  </div>
                                </div>
                              ) : (
                                <div className="space-y-3">
                                  <div>
                                    <p className="text-[12px] text-[#667085] mb-2">Address</p>
                                    <textarea
                                      value={address}
                                      onChange={(e) => setAddress(e.target.value)}
                                      placeholder="Enter your address"
                                      className="min-h-[110px] w-full rounded-xl border border-[#D0D5DD] bg-white px-3 py-2 text-sm"
                                    />
                                  </div>
                                  <div>
                                    <p className="text-[12px] text-[#667085] mb-2">Unit / Apartment number</p>
                                    <input
                                      value={unit}
                                      onChange={(e) => setUnit(e.target.value)}
                                      placeholder="Enter unit/apartment number"
                                      className="w-full rounded-xl border border-[#D0D5DD] bg-white px-3 py-2 text-sm"
                                    />
                                  </div>
                                </div>
                              )}
                            </div>
                            {locationMissingHint ? (
                              <p className="text-[13px] text-[#667085]">{locationMissingHint}</p>
                            ) : null}
                            <div className="flex justify-start">
                              <Button
                                variant="outline"
                                className="rounded-full"
                                disabled={!isLocationComplete}
                                onClick={() => {
                                  if (!isLocationComplete) return;
                                  setWizardAnswers((prev) => ({ ...prev, [currentStep.id]: intakeLocationLabel() }));
                                  setWizardIndex((prev) => Math.min(prev + 1, wizardSteps.length - 1));
                                }}
                              >
                                Add location
                              </Button>
                            </div>
                          </div>
                        ) : null}
                        {currentStep.kind === "chips" ? (
                          <div className="flex flex-wrap gap-3">
                            {currentStep.options.map((opt) => (
                              <ChipButton
                                key={opt}
                                label={opt}
                                selected={wizardAnswers[currentStep.id] === opt}
                                onClick={() => handleSelectChip(currentStep.id, opt)}
                              />
                            ))}
                          </div>
                        ) : null}

                        {currentStep.kind === "photos" ? (
                          <div className="space-y-4">
                            {currentStep.helperText ? (
                              <p className="text-[13px] text-[#475467]">{currentStep.helperText}</p>
                            ) : null}
                            <div className="flex flex-wrap items-center gap-3">
                              <Button variant="outline" onClick={handleUploadClick}>
                                <UploadItem />
                                Add photo
                              </Button>
                              <Badge
                                className={cn(
                                  "rounded-full border",
                                  currentStep.required
                                    ? "bg-rose-50 text-rose-700 border-rose-200"
                                    : "bg-amber-50 text-amber-700 border-amber-200",
                                )}
                              >
                                {currentStep.required ? "Required" : "Recommended"}
                              </Badge>
                              <p className="text-[12px] text-[#667085]">Max 3 photos</p>
                            </div>
                            <input
                              ref={fileInputRef}
                              type="file"
                              accept="image/*"
                              multiple
                              className="hidden"
                              onChange={(event) => {
                                const files = Array.from(event.target.files || []);
                                files
                                  .slice(0, Math.max(0, 3 - attachments.length))
                                  .forEach(handleAddAttachment);
                                event.target.value = "";
                              }}
                            />
                            {attachments.length ? (
                              <div className="space-y-2">
                                {attachments.map((file) => (
                                  <div
                                    key={file.id}
                                    className="flex items-center justify-between rounded-xl border border-[#EAECF0] px-3 py-2"
                                  >
                                    <div className="flex items-center gap-2 text-sm text-[#344054]">
                                      <UploadItem />
                                      <span>{file.name}</span>
                                    </div>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleRemoveAttachment(file.id)}
                                    >
                                      Remove
                                    </Button>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-[13px] text-[#667085]">No photos added yet.</p>
                            )}
                            {photoGuard ? (
                              <p className="text-[13px] text-rose-600">{photoGuard}</p>
                            ) : null}
                            <div className="flex justify-start gap-2">
                              {!currentStep.required ? (
                                <Button
                                  variant="outline"
                                  onClick={() => setWizardIndex((prev) => Math.min(prev + 1, wizardSteps.length - 1))}
                                >
                                  Skip for now
                                </Button>
                              ) : null}
                              <Button
                                onClick={() => {
                                  if (currentStep.required && attachments.length === 0) return;
                                  setWizardIndex((prev) => Math.min(prev + 1, wizardSteps.length - 1));
                                }}
                                className="rounded-full"
                              >
                                Continue
                              </Button>
                            </div>
                          </div>
                        ) : null}

                        {currentStep.kind === "text" ? (
                          <div className="space-y-3">
                            <textarea
                              value={notes}
                              onChange={(event) => setNotes(event.target.value)}
                              placeholder={currentStep.placeholder}
                              className="min-h-[120px] w-full rounded-xl border border-[#D0D5DD] px-3 py-2 text-sm"
                            />
                            <div className="flex justify-start">
                              <Button variant="outline" onClick={handleFinishNotes}>
                                Continue to summary
                              </Button>
                            </div>
                          </div>
                        ) : null}
                        </div>
                      </div>
                    ) : null}
              </div>

            </div>
          ) : null}

          </div>
          {stage === "wizard" ? (
            canMessageAssignedProvider ? (
              <MessageComposer
                label={`Message ${providerDisplayName}`}
                value={residentMessageDraft}
                onChange={setResidentMessageDraft}
                onSend={handleSendComposerMessage}
                isSending={sendResidentMessageMutation.isPending}
                attachments={composerAttachments}
                onAttachFiles={handleComposerAttachFiles}
                onRemoveAttachment={handleRemoveComposerAttachment}
                onShareLocation={handleShareLocationToComposer}
              />
            ) : (
              <div className="border-t border-[#EAECF0] bg-white px-5 py-2.5">
                <div className="mx-auto max-w-5xl rounded-xl border border-[#EAECF0] bg-[#F9FAFB] p-2.5">
                  <p className="text-xs text-[#475467]">
                    Your provider has not been assigned yet. Chat opens immediately once assignment happens.
                  </p>
                </div>
              </div>
            )
          ) : null}
        </div>
      </div>

      {stage === "summary" ? (
        <div className="fixed inset-0 z-50">
          <style>{`
            @keyframes slideInFromRight {
              from { transform: translateX(100%); }
              to { transform: translateX(0); }
            }
          `}</style>
          <button
            type="button"
            aria-label="Close job summary"
            className="absolute inset-0 bg-black/40"
            onClick={() => setStage("wizard")}
          />
          <div
            className="absolute right-0 top-0 h-full w-full max-w-[520px] bg-white shadow-2xl overflow-y-auto"
            style={{ animation: "slideInFromRight 0.25s ease-out" }}
          >
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[18px] font-semibold text-[#101828]">Job summary</p>
                  <p className="text-[12px] text-[#667085]">Review and confirm before booking inspection.</p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setStage("wizard")}>
                  Close
                </Button>
              </div>

              <div className="grid gap-3">
                {summaryItems.map((item) => (
                  <div
                    key={item.label}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#EAECF0] px-4 py-3"
                  >
                    <div>
                      <p className="text-[12px] text-[#667085]">{item.label}</p>
                      <p className="text-[14px] font-semibold text-[#101828]">{item.value}</p>
                    </div>
                    <Button variant="ghost" size="sm" onClick={item.onEdit}>
                      Edit
                    </Button>
                  </div>
                ))}
              </div>

              <div className="rounded-2xl border border-[#EAECF0] bg-[#f9fafb] p-4">
                <p className="text-[13px] text-[#475467]">
                  Review these details before we match you to providers. You can edit any line above.
                </p>
              </div>

              <div className="rounded-2xl border border-[#EAECF0] overflow-hidden">
                <div className="px-4 py-3 border-b border-[#EAECF0]">
                  <p className="text-[14px] font-semibold text-[#101828]">Provider preview</p>
                  <p className="text-[12px] text-[#667085]">
                    {activeRequestId
                      ? "This preview reflects the latest backend assignment for your request."
                      : "Provider matching starts after you book consultancy."}
                  </p>
                  <div className="mt-2">
                    <span
                      className={cn(
                        "inline-flex items-center gap-[6px] rounded-full px-[10px] py-[4px] text-[12px] border",
                        providerCount > 0
                          ? "bg-[#ECFDF3] text-[#027A48] border-[#D1FADF]"
                          : "bg-[#FFFAEB] text-[#B54708] border-[#FEDF89]",
                      )}
                    >
                      {providerStatusLabel}
                    </span>
                  </div>
                </div>
                <div className="px-4 py-3 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[14px] font-semibold text-[#101828]">
                        {formatCategoryLabel(activeRequestLive?.category || selectedCategoryLabel || "General Provider")}
                      </p>
                      <p className="text-[12px] text-[#667085]">
                        Issue: {summaryProblemTypeValue}
                      </p>
                      <p className="text-[12px] text-[#667085] mt-1">
                        Coverage: {summaryLocationValue}
                      </p>
                    </div>
                    <span className="inline-flex items-center gap-[6px] text-[12px] text-[#475467] bg-[#f9fafb] border border-[#EAECF0] rounded-[999px] px-[10px] py-[4px]">
                      {activeRequestStatusLabel || urgency || "Draft"}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-[12px] text-[#667085]">Preferred time</p>
                      <p className="text-[12px] text-[#101828] font-semibold">
                        {summaryTimeWindowValue === "Not set" ? "Flexible" : summaryTimeWindowValue}
                      </p>
                    </div>
                    <div>
                      <p className="text-[12px] text-[#667085]">Photos</p>
                      <p className="text-[12px] text-[#101828] font-semibold">{summaryAttachmentCount} attached</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {[summaryQuantityValue, summaryUrgencyValue, summaryProblemTypeValue]
                      .filter(Boolean)
                      .filter((badge) => badge !== "Not set")
                      .map((badge, idx) => (
                        <span
                          key={`${badge}-${idx}`}
                          className="text-[12px] text-[#475467] bg-[#f9fafb] border border-[#EAECF0] rounded-[999px] px-[10px] py-[4px]"
                        >
                          {badge}
                        </span>
                      ))}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {canBookConsultancy ? (
                      <Button className="rounded-full" onClick={handleBookConsultancy}>
                        Book for consultancy · NGN 6,500
                      </Button>
                    ) : (
                      <Button className="rounded-full" variant="secondary" disabled>
                        Consultancy already booked
                      </Button>
                    )}
                    <Button variant="outline" onClick={() => setStage("wizard")}>
                      Change details
                    </Button>
                  </div>
                </div>
              </div>

              {assignedProvider ? (
                <div className="rounded-2xl border border-[#EAECF0] overflow-hidden">
                  <div className="px-4 py-3 border-b border-[#EAECF0] flex items-center justify-between">
                    <div>
                      <p className="text-[14px] font-semibold text-[#101828]">Assigned consultant</p>
                      <p className="text-[12px] text-[#667085]">You will receive reminders before the session starts.</p>
                    </div>
                    <span className="text-[12px] font-semibold text-[#027A48] bg-[#ECFDF3] border border-[#D1FADF] rounded-full px-3 py-1">
                      {assignedProvider.countdown === "Not scheduled"
                        ? "Awaiting schedule"
                        : `Starts in ${assignedProvider.countdown}`}
                    </span>
                  </div>
                  <div className="p-4">
                    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-amber-500 via-rose-500 to-emerald-600 text-white">
                      <img
                        src={assignedProvider.photo}
                        alt={assignedProvider.name}
                        className="w-full h-48 object-cover opacity-90"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-black/10" />
                      <div className="absolute bottom-4 left-4 right-4 space-y-2">
                        <div>
                          <p className="text-lg font-semibold">{assignedProvider.name}</p>
                          <p className="text-sm">{assignedProvider.role}</p>
                        </div>
                        <p className="text-sm font-semibold">{assignedProvider.company}</p>
                        <div className="flex flex-wrap gap-2 text-sm">
                          <span className="inline-flex items-center gap-2 bg-white/15 px-3 py-1 rounded-full">
                            Scheduled:{" "}
                            {assignedProvider.scheduledAt
                              ? assignedProvider.scheduledAt.toLocaleString(undefined, {
                                  weekday: "short",
                                  month: "short",
                                  day: "numeric",
                                  hour: "numeric",
                                  minute: "2-digit",
                                })
                              : "To be confirmed"}
                          </span>
                          <span className="inline-flex items-center gap-2 bg-white/15 px-3 py-1 rounded-full">
                            Countdown: {assignedProvider.countdown}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}

              <div className="flex flex-wrap items-center justify-between gap-3">
                <Button variant="outline" onClick={() => setStage("wizard")}>
                  Back to wizard
                </Button>
                {canBookConsultancy ? (
                  <Button className="rounded-full" onClick={handleBookConsultancy}>
                    Book for consultancy
                  </Button>
                ) : (
                  <Button className="rounded-full" variant="secondary" disabled>
                    Consultancy already booked
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}


