import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { io } from "socket.io-client";
import { AIAskBotIcon, AIAnsweredBotIcon, UploadItem } from "@/components/ui/icon";
import Nav from "@/components/layout/Nav";
import MobileNavDrawer from "@/components/layout/MobileNavDrawer";
import { useMyEstates } from "@/hooks/useMyEstates";
import useCategories from "@/hooks/useCategories";
import { useAiConversationFlowSettings } from "@/hooks/useAiConversationFlowSettings";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { MainWrapSelectCategory } from "@/components/resident/CityBuddyChat";
import PaystackRedirectDialog from "@/components/resident/PaystackRedirectDialog";
import { RequestsSidebar } from "@/components/resident/RequestsSidebar";
import { ProviderHeader } from "@/components/resident/ordinary-flow/ProviderHeader";
import { RequestProgressTracker } from "@/components/resident/ordinary-flow/RequestProgressTracker";
import { MaintenanceContextCard } from "@/components/resident/ordinary-flow/MaintenanceContextCard";
import { ChatThread, type ThreadItem } from "@/components/resident/ordinary-flow/ChatThread";
import { TypingPresenceIndicator } from "@/components/resident/ordinary-flow/TypingPresenceIndicator";
import { SystemMessage } from "@/components/resident/ordinary-flow/SystemMessage";
import {
  MessageComposer,
  type ComposerAttachment,
} from "@/components/resident/ordinary-flow/MessageComposer";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { residentFetch } from "@/lib/residentApi";
import { formatServiceRequestStatusLabel } from "@/lib/serviceRequestStatus";
import {
  buildCategoryProfile,
  buildEditableLegacyQuestions,
  DEFAULT_QUANTITY_OPTIONS,
  DEFAULT_TIME_WINDOWS,
  normalizeCategoryKey,
  type CategoryProfile,
} from "@/lib/ordinaryLegacyFlow";

type FlowStage = "intake" | "wizard" | "summary";

type WizardStep =
  | {
      id: string;
      kind: "location";
      prompt: string;
    }
  | {
      id: string;
      kind: "chips";
      prompt: string;
      options: string[];
    }
  | {
      id: string;
      kind: "photos";
      prompt: string;
      required: boolean;
      helperText?: string;
    }
  | {
      id: string;
      kind: "text";
      prompt: string;
      placeholder: string;
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

type CancellationCaseSummary = {
  id: string;
  status?: string | null;
  reasonCode?: string | null;
  reasonDetail?: string | null;
  preferredResolution?: string | null;
  adminDecision?: string | null;
  adminNote?: string | null;
  refundDecision?: string | null;
  refundAmount?: string | number | null;
  resolvedAt?: string | Date | null;
  createdAt?: string | Date | null;
  updatedAt?: string | Date | null;
};

type ActiveServiceRequest = {
  id: string;
  residentId?: string | null;
  category?: string;
  categoryLabel?: string | null;
  description?: string | null;
  location?: string | null;
  urgency?: string | null;
  status?: string;
  paymentStatus?: string | null;
  billedAmount?: string | number | null;
  paymentRequestedAt?: string | Date | null;
  consultancyReport?: {
    inspectionDate?: string;
    completionDeadline?: string;
    actualIssue?: string;
    causeOfIssue?: string;
    materialCost?: number;
    serviceCost?: number;
    totalRecommendation?: number;
    preventiveRecommendation?: string;
    evidence?: string[];
    submittedAt?: string;
  } | null;
  consultancyReportSubmittedAt?: string | Date | null;
  providerId?: string | null;
  preferredTime?: string | Date | null;
  assignedAt?: string | Date | null;
  updatedAt?: string | Date | null;
  provider?: RequestProvider | null;
  maintenance?: {
    source?: string;
    scheduleId?: string;
    subscriptionId?: string;
    title?: string;
    introTitle?: string;
    introMessage?: string;
    nextStep?: string;
    asset?: {
      id: string;
      label: string;
      customName?: string | null;
      itemTypeName?: string | null;
      locationLabel?: string | null;
      condition?: string | null;
      notes?: string | null;
    } | null;
    plan?: {
      id: string;
      name: string;
      description?: string | null;
      durationType?: "monthly" | "quarterly_3m" | "halfyearly_6m" | "yearly" | null;
      visitsIncluded?: number | null;
      includedTasks?: string[];
    } | null;
    schedule?: {
      id: string;
      scheduledFor?: string | Date | null;
      status?: string | null;
    } | null;
  } | null;
  cancellationCase?: CancellationCaseSummary | null;
};

type ParsedRequestDetails = {
  issueType?: string;
  otherIssueDetails?: string;
  quantity?: string;
  timeWindow?: string;
  photosCount?: number;
  notes?: string;
  additionalInformation?: string;
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

type RequestTypingSocketPayload = {
  requestId: string;
  userId: string;
  senderRole: "resident" | "provider" | "admin";
  isTyping: boolean;
  at?: string;
};

type OrdinaryConversationDraftSnapshot = {
  version: 1;
  updatedAt: string;
  draftRequestSeed: string;
  stage: FlowStage;
  selectedCategoryValue: string;
  categorySelectSearch: string;
  estateName: string;
  estateResidenceMode: "estate" | "outside";
  hasConfirmedEstateResidence: boolean;
  estateSearch: string;
  residentState: string;
  residentLga: string;
  address: string;
  unit: string;
  urgency: string;
  wizardIndex: number;
  wizardAnswers: Record<string, string>;
  notes: string;
};

type DynamicFlowOption = {
  id: string;
  optionKey: string;
  label: string;
  value: string;
  icon?: string | null;
  orderIndex?: number;
};

type DynamicFlowQuestion = {
  id: string;
  questionKey: string;
  prompt: string;
  description?: string | null;
  inputType:
    | "single_select"
    | "multi_select"
    | "text"
    | "number"
    | "date"
    | "time"
    | "datetime"
    | "location"
    | "file"
    | "yes_no"
    | "urgency"
    | "estate";
  isRequired: boolean;
  isTerminal: boolean;
  options: DynamicFlowOption[];
  answer?: any;
};

type DynamicFlowSessionView = {
  sessionId: string;
  stateRevision: number;
  history: DynamicFlowQuestion[];
  currentQuestion: DynamicFlowQuestion | null;
  activePath: DynamicFlowQuestion[];
  answers: Record<string, any>;
  isComplete: boolean;
};

const ORDINARY_FLOW_DRAFT_STORAGE_PREFIX = "ordinary_flow_draft_v1";

function createOrdinaryDraftRequestSeed() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function parseOrdinaryConversationDraftSnapshot(
  raw: string | null,
): OrdinaryConversationDraftSnapshot | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<OrdinaryConversationDraftSnapshot> | null;
    if (!parsed || typeof parsed !== "object") return null;

    const stageValue: FlowStage =
      parsed.stage === "wizard" || parsed.stage === "summary" ? parsed.stage : "intake";
    const estateResidenceMode = parsed.estateResidenceMode === "outside" ? "outside" : "estate";
    const wizardAnswers =
      parsed.wizardAnswers && typeof parsed.wizardAnswers === "object" && !Array.isArray(parsed.wizardAnswers)
        ? Object.entries(parsed.wizardAnswers).reduce<Record<string, string>>((acc, [key, value]) => {
            if (!key) return acc;
            acc[key] = String(value ?? "");
            return acc;
          }, {})
        : {};
    const hasLocationAnswer = Boolean(String(wizardAnswers.location || "").trim());
    const parsedResidenceMode = parsed.estateResidenceMode === "outside" ? "outside" : "estate";
    const inferredResidenceMode =
      hasLocationAnswer &&
      (String(parsed.residentState || "").trim() || String(parsed.residentLga || "").trim())
        ? "outside"
        : parsedResidenceMode;

    return {
      version: 1,
      updatedAt: String(parsed.updatedAt || new Date().toISOString()),
      draftRequestSeed: String(parsed.draftRequestSeed || createOrdinaryDraftRequestSeed()),
      stage: stageValue,
      selectedCategoryValue: String(parsed.selectedCategoryValue || ""),
      categorySelectSearch: String(parsed.categorySelectSearch || ""),
      estateName: String(parsed.estateName || ""),
      estateResidenceMode: inferredResidenceMode,
      hasConfirmedEstateResidence:
        Boolean(parsed.hasConfirmedEstateResidence) || hasLocationAnswer,
      estateSearch: String(parsed.estateSearch || ""),
      residentState: String(parsed.residentState || ""),
      residentLga: String(parsed.residentLga || ""),
      address: String(parsed.address || ""),
      unit: String(parsed.unit || ""),
      urgency: String(parsed.urgency || ""),
      wizardIndex: Math.max(0, Number(parsed.wizardIndex || 0)),
      wizardAnswers,
      notes: String(parsed.notes || ""),
    };
  } catch {
    return null;
  }
}

const URGENCY_OPTIONS = [
  {
    value: "emergency",
    label: "Emergency",
    timeframe: "Within 24 hrs",
    tone: "border-rose-200 text-rose-700 bg-rose-50",
  },
  {
    value: "high",
    label: "High",
    timeframe: "24 - 48 hrs",
    tone: "border-amber-200 text-amber-700 bg-amber-50",
  },
  {
    value: "medium",
    label: "Medium",
    timeframe: "3 - 4 days",
    tone: "border-slate-200 text-slate-700 bg-slate-50",
  },
  {
    value: "low",
    label: "Low",
    timeframe: "In a week",
    tone: "border-emerald-200 text-emerald-700 bg-emerald-50",
  },
];
type UrgencyValue = (typeof URGENCY_OPTIONS)[number]["value"];

const STATE_OPTIONS = ["Lagos", "Ogun", "Abuja (FCT)", "Oyo"];
const BOT_PROMPT_DELAY_MS = 3000;

const LGA_BY_STATE: Record<string, string[]> = {
  Lagos: ["Alimosho", "Ikeja", "Eti-Osa", "Surulere", "Yaba", "Kosofe"],
  Ogun: ["Abeokuta North", "Abeokuta South", "Ijebu Ode", "Ado-Odo/Ota"],
  "Abuja (FCT)": ["Abuja Municipal", "Bwari", "Gwagwalada", "Kuje"],
  Oyo: ["Ibadan North", "Ibadan South-West", "Ogbomosho North", "Egbeda"],
};

const CANCELLATION_REVIEW_REQUIRED_STATUSES = new Set([
  "assigned",
  "assigned_for_inspection",
  "assigned_for_job",
  "in_progress",
  "work_completed_pending_resident",
  "disputed",
  "rework_required",
  "completed",
]);

const CHIP_STYLES =
  "rounded-full border px-4 py-2 text-sm font-medium transition shadow-sm hover:shadow";

function normalizeStatusKey(value: unknown) {
  return String(value || "")
    .toLowerCase()
    .replace(/[\s-]+/g, "_")
    .trim();
}

function formatMaintenanceDurationLabel(value?: string | null) {
  switch (String(value || "").toLowerCase()) {
    case "monthly":
      return "Monthly";
    case "quarterly_3m":
      return "Every 3 months";
    case "halfyearly_6m":
      return "Every 6 months";
    case "yearly":
      return "Yearly";
    default:
      return "";
  }
}

function formatMaintenanceConditionLabel(value?: string | null) {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) return "";
  return normalized.replace(/_/g, " ").replace(/\b\w/g, (match) => match.toUpperCase());
}

function normalizeUrgencyLabel(value: string): string {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "emergency") return "Emergency";
  if (normalized === "high") return "High";
  if (normalized === "medium") return "Medium";
  if (normalized === "low") return "Low";
  return value;
}

function mapDynamicQuestionToStep(question: DynamicFlowQuestion): WizardStep {
  const key = String(question.questionKey || "").trim();
  const prompt = String(question.prompt || "Continue");
  if (question.inputType === "location") {
    return {
      id: key || "location",
      kind: "location",
      prompt: "Do you live in an estate registered with CityConnect?",
    };
  }
  if (question.inputType === "file") {
    return {
      id: key || "photos",
      kind: "photos",
      prompt,
      required: Boolean(question.isRequired),
      helperText: question.description || "Upload image evidence if available.",
    };
  }
  if (
    question.inputType === "text" ||
    question.inputType === "number" ||
    question.inputType === "date" ||
    question.inputType === "time" ||
    question.inputType === "datetime"
  ) {
    return {
      id: key || "notes",
      kind: "text",
      prompt,
      placeholder: question.description || "Type your answer.",
    };
  }

  const optionLabels =
    Array.isArray(question.options) && question.options.length
      ? question.options.map((option) => String(option.label || option.value || option.optionKey))
      : question.inputType === "urgency"
        ? URGENCY_OPTIONS.map((opt) => opt.label)
        : ["Yes", "No"];

  return {
    id: key || "dynamic_option",
    kind: "chips",
    prompt,
    options: optionLabels,
  };
}

function toDisplayDynamicAnswer(question: DynamicFlowQuestion, answer: any): string {
  if (!answer) return "";
  if (typeof answer === "string") return answer;
  if (question.questionKey === "urgency" && typeof answer === "object") {
    return normalizeUrgencyLabel(String(answer.value || ""));
  }
  if (question.inputType === "location" && typeof answer === "object") {
    const estateMode = String(answer.estateMode || "estate");
    const unitValue = String(answer.unit || "").trim();
    if (estateMode === "outside") {
      const base = [answer.address, answer.lga, answer.state].filter(Boolean).join(", ");
      return unitValue ? `${base} - Unit ${unitValue}` : base;
    }
    const base = [answer.estateName, answer.address].filter(Boolean).join(", ");
    return unitValue ? `${base} - Unit ${unitValue}` : base;
  }
  if (question.inputType === "file" && typeof answer === "object") {
    const files = Array.isArray(answer.files) ? answer.files : [];
    return files.length ? `${files.length} photo(s) added` : "Skipped";
  }
  if (typeof answer === "object") {
    const optionKey = String(answer.optionKey || "");
    if (optionKey) {
      const option = (question.options || []).find(
        (entry) => String(entry.optionKey || "").trim() === optionKey,
      );
      if (option) return String(option.label || option.value || option.optionKey);
    }
    const text = String(answer.text || "").trim();
    if (text) return text;
  }
  return String(answer ?? "");
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
      <div className="flex items-center gap-2.5 text-[14px] leading-[20px] font-semibold text-[#475467]">
        <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[#F2F4F7] text-[#667085]">
          <span className="origin-center scale-[0.52]">
            <AIAnsweredBotIcon />
          </span>
        </span>
        <span>{text}</span>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-2.5 sm:gap-3">
      <div className="relative mt-0.5 flex h-10 w-12 shrink-0 items-center justify-center overflow-visible">
        <AIAskBotIcon />
      </div>
      <div className="max-w-[680px] rounded-[999px] bg-[#ECFDF3] px-4 py-2.5 text-[14px] leading-[20px] text-[#065F46] font-semibold">
        {text}
      </div>
    </div>
  );
}

function WizardTypingIndicator() {
  return (
    <div className="flex items-center gap-2.5 sm:gap-3">
      <div className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-visible">
        <AIAskBotIcon />
      </div>
      <div className="inline-flex items-center gap-1.5 rounded-[999px] bg-[#ECFDF3] px-4 py-2.5">
        <span className="h-2 w-2 rounded-full bg-[#12B76A] animate-bounce [animation-delay:-0.3s]" />
        <span className="h-2 w-2 rounded-full bg-[#12B76A] animate-bounce [animation-delay:-0.15s]" />
        <span className="h-2 w-2 rounded-full bg-[#12B76A] animate-bounce" />
      </div>
    </div>
  );
}

function WizardAnswerBubble({ text }: { text: string }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[78%] rounded-2xl rounded-br-[8px] bg-[#039855] px-4 py-2 text-[14px] font-semibold leading-[20px] text-white shadow-[0_10px_20px_-14px_rgba(3,152,85,0.8)]">
        {text}
      </div>
    </div>
  );
}

function UrgencyIcon({ value }: { value: UrgencyValue }) {
  if (value === "emergency") {
    return (
      <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[#D92D20] text-[15px] font-bold leading-none text-white">
        !
      </span>
    );
  }

  if (value === "high") {
    return (
      <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[#F79009] text-[15px] font-bold leading-none text-white">
        !
      </span>
    );
  }

  if (value === "medium") {
    return <span className="inline-flex h-7 w-7 rounded-full border border-[#FEC84B] bg-[#FDB022]" />;
  }

  return <span className="inline-flex h-7 w-7 rounded-full border border-[#3CCB7F] bg-[#17B26A]" />;
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
    completionDeadline: String((report as any).completionDeadline || ""),
    actualIssue: String((report as any).actualIssue || ""),
    causeOfIssue: String((report as any).causeOfIssue || ""),
    materialCost: Number.isFinite(materialCost) ? materialCost : 0,
    serviceCost: Number.isFinite(serviceCost) ? serviceCost : 0,
    totalRecommendation: Number.isFinite(totalRecommendation) ? totalRecommendation : 0,
    preventiveRecommendation: String((report as any).preventiveRecommendation || ""),
    evidence: Array.isArray((report as any).evidence)
      ? (report as any).evidence.map((entry: unknown) => String(entry || "").trim()).filter(Boolean)
      : [],
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

function formatElapsedDuration(startedAt: Date | null) {
  if (!startedAt) return "00:00:00";
  const diffMs = Math.max(Date.now() - startedAt.getTime(), 0);
  const totalSeconds = Math.floor(diffMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const hh = String(hours).padStart(2, "0");
  const mm = String(minutes).padStart(2, "0");
  const ss = String(seconds).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
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
    "Issue|Other issue details|Additional information|Quantity|Preferred time|Time window|Urgency|Location|Notes|Photos attached|Attachments|Photos";

  const pick = (labelPattern: string) => {
    const regex = new RegExp(
      `${labelPattern}:\\s*([\\s\\S]*?)(?=\\n|\\s(?:${boundaryLabels}):|$)`,
      "i",
    );
    const value = source.match(regex)?.[1]?.trim();
    return value || undefined;
  };

  const issueType = pick("Issue");
  const otherIssueDetails = pick("Other issue details");
  const quantity = pick("Quantity");
  const timeWindow = pick("(?:Preferred time|Time window)");
  const additionalInformation = pick("Additional information");
  const notes = pick("Notes");
  const urgency = pick("Urgency");
  const location = pick("Location");
  const photoChunk = pick("(?:Photos attached|Attachments|Photos)");
  const photosMatch = photoChunk?.match(/(\d+)/);
  const photosCount = photosMatch ? Number(photosMatch[1]) : undefined;

  if (
    !issueType &&
    !otherIssueDetails &&
    !quantity &&
    !timeWindow &&
    !additionalInformation &&
    !notes &&
    !urgency &&
    !location &&
    photosCount === undefined
  ) {
    return { notes: source };
  }

  return {
    issueType,
    otherIssueDetails,
    quantity,
    timeWindow,
    photosCount,
    additionalInformation,
    notes,
    urgency,
    location,
  };
}

function parseConsultancyReportMessage(text: string) {
  const source = String(text || "").trim();
  const hasConsultancyPrefix = /^consultancy report (submitted|approved)\./i.test(source);
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
    completionDeadline: pick("Completion deadline") || undefined,
    actualIssue: pick("Issue") || "Not provided",
    causeOfIssue: pick("Cause") || "Not provided",
    materialCostLabel: pick("Recommended material cost") || "Not provided",
    serviceCostLabel: pick("Recommended service cost") || "Not provided",
    preventiveRecommendation: pick("Preventive recommendation") || "Not provided",
    evidenceCount: Number(pick("Evidence attachments").match(/(\d+)/)?.[1] || 0) || undefined,
  };
}

export default function OrdinaryConversationFlow() {
  const [location, navigate] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: estates = [], loading: estatesLoading, error: estatesError } = useMyEstates();
  const { settings: approvedCategorySettings, isLoading: approvedCategoriesLoading } =
    useAiConversationFlowSettings();
  const { categories: fallbackCategories, isLoading: fallbackCategoriesLoading } = useCategories({
    scope: "global",
    kind: "service",
  });
  const CONSULTANCY_DRAFT_KEY = "citybuddy_consultancy_draft";
  const ordinaryDraftStorageKey = useMemo(
    () => `${ORDINARY_FLOW_DRAFT_STORAGE_PREFIX}:${user?.id || "anonymous"}`,
    [user?.id],
  );

  const categories = useMemo(() => {
    if (approvedCategorySettings.length > 0) {
      return approvedCategorySettings
        .filter((setting) => setting.isEnabled)
        .sort((a, b) => a.displayOrder - b.displayOrder)
        .map((setting) => ({
          id: setting.id,
          key: setting.categoryKey,
          name: setting.categoryName,
          emoji: setting.emoji || "",
          description: setting.description || undefined,
          providerCount: 0,
        }));
    }
    return fallbackCategories;
  }, [approvedCategorySettings, fallbackCategories]);

  const categoriesLoading = approvedCategoriesLoading || fallbackCategoriesLoading;
  const { data: requestConfig } = useQuery<{ ordinaryQuestions?: Array<any> }>({
    queryKey: ["/api/app/request-config", "ordinary-flow"],
    queryFn: async () => residentFetch("/api/app/request-config"),
    staleTime: 5 * 60 * 1000,
  });
  const ordinaryQuestions = requestConfig?.ordinaryQuestions ?? [];

  const queryParams = useMemo(() => {
    const search = typeof window !== "undefined" ? window.location.search : "";
    const queryString = search ? search.slice(1) : location.includes("?") ? location.split("?")[1] : "";
    return new URLSearchParams(queryString);
  }, [location]);

  const categoryFromSearch = queryParams.get("category") || "";
  const conversationIdFromSearch = queryParams.get("conversationId") || "";
  const requestIdFromSearch =
    queryParams.get("requestId") || queryParams.get("serviceRequestId") || conversationIdFromSearch;

  const [stage, setStage] = useState<FlowStage>("intake");
  const [isSummaryManuallyDismissed, setIsSummaryManuallyDismissed] = useState(false);
  const openJobSummary = useCallback(() => {
    setIsSummaryManuallyDismissed(false);
    setStage("summary");
  }, []);
  const returnToWizardFromSummary = useCallback(() => {
    setIsSummaryManuallyDismissed(true);
    setStage("wizard");
  }, []);

  const [estateName, setEstateName] = useState("");
  const [estateResidenceMode, setEstateResidenceMode] = useState<"estate" | "outside">("estate");
  const [hasConfirmedEstateResidence, setHasConfirmedEstateResidence] = useState(false);
  const [estateSearch, setEstateSearch] = useState("");
  const [residentState, setResidentState] = useState("");
  const [residentLga, setResidentLga] = useState("");
  const [address, setAddress] = useState("");
  const [unit, setUnit] = useState("");
  const [selectedCategoryValue, setSelectedCategoryValue] = useState(categoryFromSearch);
  const [categorySelectSearch, setCategorySelectSearch] = useState("");
  const [urgency, setUrgency] = useState("");

  const [wizardIndex, setWizardIndex] = useState(0);
  const [isWizardBotThinking, setIsWizardBotThinking] = useState(false);
  const [wizardAnswers, setWizardAnswers] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState("");
  const [attachments, setAttachments] = useState<Array<{ id: string; name: string; dataUrl: string }>>([]);
  const [persistedAttachmentCount, setPersistedAttachmentCount] = useState<number | null>(null);
  const [localWrapUpCompleted, setLocalWrapUpCompleted] = useState<Record<string, boolean>>({});
  const wizardPromptTimerRef = useRef<number | null>(null);
  const legacyAdvanceRetryTimerRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const openedRequestFromQueryRef = useRef<string | null>(null);
  const skipCategoryResetRef = useRef(false);
  const chatScrollContainerRef = useRef<HTMLDivElement | null>(null);
  const lastAutoScrollSessionRef = useRef<string>("");
  const wizardInteractiveScrollRef = useRef<HTMLDivElement | null>(null);
  const latestWizardPromptRef = useRef<HTMLDivElement | null>(null);
  const chatBottomRef = useRef<HTMLDivElement | null>(null);
  const estateSearchInputRef = useRef<HTMLInputElement | null>(null);
  const stateSelectTriggerRef = useRef<HTMLButtonElement | null>(null);
  const addressTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const addressSectionRef = useRef<HTMLDivElement | null>(null);
  const [activeRequestId, setActiveRequestId] = useState<string | null>(null);
  const [loadingRequestId, setLoadingRequestId] = useState<string | null>(null);
  const [pendingPrefill, setPendingPrefill] = useState(false);
  const [isProviderDetailsCollapsed, setIsProviderDetailsCollapsed] = useState(true);
  const [isProgressTrackerCollapsed, setIsProgressTrackerCollapsed] = useState(false);
  const [residentMessageDraft, setResidentMessageDraft] = useState("");
  const [composerAttachments, setComposerAttachments] = useState<ComposerAttachment[]>([]);
  const [isPeerTyping, setIsPeerTyping] = useState(false);
  const [isStartingJobPayment, setIsStartingJobPayment] = useState(false);
  const [paystackRedirectUrl, setPaystackRedirectUrl] = useState<string | null>(null);
  const [showPaystackRedirectModal, setShowPaystackRedirectModal] = useState(false);
  const [isCategoryRequiredDialogOpen, setIsCategoryRequiredDialogOpen] = useState(false);
  const [isCancelRequestDialogOpen, setIsCancelRequestDialogOpen] = useState(false);
  const [cancelReasonCode, setCancelReasonCode] = useState("");
  const [cancelReasonDetail, setCancelReasonDetail] = useState("");
  const [cancelPreferredResolution, setCancelPreferredResolution] = useState<
    "full_refund" | "partial_refund" | "cancel_without_refund"
  >("full_refund");
  const [isConfirmDeliveryDialogOpen, setIsConfirmDeliveryDialogOpen] = useState(false);
  const [isRaiseIssueDialogOpen, setIsRaiseIssueDialogOpen] = useState(false);
  const [raiseIssueReason, setRaiseIssueReason] = useState("");
  const [previewAttachment, setPreviewAttachment] = useState<{ name: string; url: string } | null>(null);
  const [draftSavedAt, setDraftSavedAt] = useState<string>(() => new Date().toISOString());
  const [draftRequestSeed, setDraftRequestSeed] = useState<string>(() => createOrdinaryDraftRequestSeed());
  const [storedDraftSnapshot, setStoredDraftSnapshot] = useState<OrdinaryConversationDraftSnapshot | null>(null);
  const [dynamicFlowSession, setDynamicFlowSession] = useState<DynamicFlowSessionView | null>(null);
  const [dynamicFlowFallback, setDynamicFlowFallback] = useState(false);
  const [isDynamicFlowLoading, setIsDynamicFlowLoading] = useState(false);
  const restoreStageAfterCategorySelectionRef = useRef<FlowStage | null>(null);
  const restoreWizardIndexAfterCategorySelectionRef = useRef<number | null>(null);
  const draftHydratedRef = useRef(false);
  const socketRef = useRef<ReturnType<typeof io> | null>(null);
  const selfTypingRef = useRef(false);
  const selfTypingStopTimerRef = useRef<number | null>(null);
  const peerTypingClearTimerRef = useRef<number | null>(null);

  const clearWizardPromptTimer = useCallback(() => {
    if (wizardPromptTimerRef.current !== null) {
      window.clearTimeout(wizardPromptTimerRef.current);
      wizardPromptTimerRef.current = null;
    }
  }, []);

  const clearLegacyAdvanceRetryTimer = useCallback(() => {
    if (legacyAdvanceRetryTimerRef.current !== null) {
      window.clearTimeout(legacyAdvanceRetryTimerRef.current);
      legacyAdvanceRetryTimerRef.current = null;
    }
  }, []);

  const commitLegacyStepAdvance = useCallback((nextIndex: number) => {
    clearLegacyAdvanceRetryTimer();
    clearWizardPromptTimer();
    setIsWizardBotThinking(false);
    setWizardIndex(nextIndex);
    legacyAdvanceRetryTimerRef.current = window.setTimeout(() => {
      setWizardIndex((prev) => (prev < nextIndex ? nextIndex : prev));
      legacyAdvanceRetryTimerRef.current = null;
    }, 250);
  }, [clearLegacyAdvanceRetryTimer, clearWizardPromptTimer]);

  const queueWizardStepAdvance = useCallback(
    (nextIndex: number) => {
      if (nextIndex === wizardIndex) return;
      clearLegacyAdvanceRetryTimer();
      clearWizardPromptTimer();
      setIsWizardBotThinking(true);
      wizardPromptTimerRef.current = window.setTimeout(() => {
        setWizardIndex(nextIndex);
        setIsWizardBotThinking(false);
        wizardPromptTimerRef.current = null;
      }, BOT_PROMPT_DELAY_MS);
    },
    [clearLegacyAdvanceRetryTimer, clearWizardPromptTimer, wizardIndex],
  );

  const clearSelfTypingStopTimer = useCallback(() => {
    if (selfTypingStopTimerRef.current !== null) {
      window.clearTimeout(selfTypingStopTimerRef.current);
      selfTypingStopTimerRef.current = null;
    }
  }, []);

  const clearPeerTypingClearTimer = useCallback(() => {
    if (peerTypingClearTimerRef.current !== null) {
      window.clearTimeout(peerTypingClearTimerRef.current);
      peerTypingClearTimerRef.current = null;
    }
  }, []);

  const emitTypingState = useCallback(
    (requestId: string, isTyping: boolean) => {
      if (!requestId) return;
      const socket = socketRef.current;
      if (socket) {
        socket.emit("request-typing", {
          requestId,
          userId: String(user?.id || ""),
          senderRole: "resident",
          isTyping,
        });
      }
      void residentFetch(`/api/service-requests/${requestId}/typing`, {
        method: "POST",
        json: { isTyping },
      }).catch(() => undefined);
    },
    [user?.id],
  );

  const stopSelfTyping = useCallback(
    (requestId?: string | null) => {
      clearSelfTypingStopTimer();
      const targetRequestId = String(requestId || activeRequestId || "").trim();
      if (!targetRequestId) return;
      if (!selfTypingRef.current) return;
      selfTypingRef.current = false;
      emitTypingState(targetRequestId, false);
    },
    [activeRequestId, clearSelfTypingStopTimer, emitTypingState],
  );

  const handleResidentComposerChange = useCallback(
    (nextValue: string) => {
      setResidentMessageDraft(nextValue);
      if (!activeRequestId) return;

      if (!nextValue.trim()) {
        stopSelfTyping(activeRequestId);
        return;
      }

      if (!selfTypingRef.current) {
        selfTypingRef.current = true;
        emitTypingState(activeRequestId, true);
      }

      clearSelfTypingStopTimer();
      selfTypingStopTimerRef.current = window.setTimeout(() => {
        stopSelfTyping(activeRequestId);
      }, 1800);
    },
    [
      activeRequestId,
      clearSelfTypingStopTimer,
      emitTypingState,
      stopSelfTyping,
    ],
  );

  const readOrdinaryDraftSnapshot = (): OrdinaryConversationDraftSnapshot | null => {
    try {
      const raw = localStorage.getItem(ordinaryDraftStorageKey);
      return parseOrdinaryConversationDraftSnapshot(raw);
    } catch {
      return null;
    }
  };

  const clearOrdinaryDraftSnapshot = useCallback(() => {
    try {
      localStorage.removeItem(ordinaryDraftStorageKey);
    } catch {
      // ignore storage errors
    }
    setStoredDraftSnapshot(null);
  }, [ordinaryDraftStorageKey]);

  const applyOrdinaryDraftSnapshot = (snapshot: OrdinaryConversationDraftSnapshot) => {
    clearWizardPromptTimer();
    setIsWizardBotThinking(false);
    skipCategoryResetRef.current = true;
    setActiveRequestId(null);
    setDraftRequestSeed(String(snapshot.draftRequestSeed || createOrdinaryDraftRequestSeed()));
    setStage(snapshot.selectedCategoryValue ? snapshot.stage : "intake");
    setSelectedCategoryValue(snapshot.selectedCategoryValue || "");
    setCategorySelectSearch(snapshot.categorySelectSearch || "");
    setWizardIndex(Math.max(0, snapshot.wizardIndex || 0));
    setWizardAnswers(snapshot.wizardAnswers || {});
    setNotes(snapshot.notes || "");
    setAttachments([]);
    setPersistedAttachmentCount(null);
    setUrgency(snapshot.urgency || "");
    setAddress(snapshot.address || "");
    setUnit(snapshot.unit || "");
    setEstateName(snapshot.estateName || "");
    setEstateResidenceMode(snapshot.estateResidenceMode === "outside" ? "outside" : "estate");
    setHasConfirmedEstateResidence(Boolean(snapshot.hasConfirmedEstateResidence));
    setEstateSearch(snapshot.estateSearch || "");
    setResidentState(snapshot.residentState || "");
    setResidentLga(snapshot.residentLga || "");
    setPendingPrefill(false);
    setDraftSavedAt(snapshot.updatedAt || new Date().toISOString());
    setStoredDraftSnapshot(snapshot);
  };

  useEffect(() => {
    draftHydratedRef.current = false;
    setStoredDraftSnapshot(null);
  }, [ordinaryDraftStorageKey]);

  useEffect(() => {
    return () => {
      clearWizardPromptTimer();
      clearLegacyAdvanceRetryTimer();
    };
  }, [clearLegacyAdvanceRetryTimer, clearWizardPromptTimer]);

  useEffect(() => {
    return () => {
      stopSelfTyping(activeRequestId);
      clearPeerTypingClearTimer();
      setIsPeerTyping(false);
    };
  }, [activeRequestId, clearPeerTypingClearTimer, stopSelfTyping]);

  useEffect(() => {
    if (draftHydratedRef.current) return;
    if (requestIdFromSearch) {
      draftHydratedRef.current = true;
      return;
    }

    const snapshot = readOrdinaryDraftSnapshot();
    if (snapshot) {
      applyOrdinaryDraftSnapshot(snapshot);
    } else {
      setStoredDraftSnapshot(null);
    }
    draftHydratedRef.current = true;
  }, [ordinaryDraftStorageKey, requestIdFromSearch]);

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
        setSelectedCategoryValue(String(match.key ?? match.id ?? match.name));
        return;
      }
    }
  }, [categories, selectedCategoryValue, categoryFromSearch]);

  useEffect(() => {
    if (skipCategoryResetRef.current) {
      skipCategoryResetRef.current = false;
      return;
    }
    clearWizardPromptTimer();
    setIsWizardBotThinking(false);
    setWizardIndex(0);
    setWizardAnswers({});
    setNotes("");
    setAttachments([]);
    setPersistedAttachmentCount(null);
    setHasConfirmedEstateResidence(false);
    setDynamicFlowSession(null);
  }, [clearWizardPromptTimer, selectedCategoryValue]);

  useEffect(() => {
    if (selectedCategoryValue && stage === "intake") {
      clearWizardPromptTimer();
      setIsWizardBotThinking(false);
      setStage("wizard");
      setWizardIndex(0);
    }
  }, [clearWizardPromptTimer, selectedCategoryValue, stage]);

  const selectedCategory = useMemo<any | null>(() => {
    if (!selectedCategoryValue) return null;
    const match = categories.find((cat: any) => {
      const id = String(cat?.id ?? "");
      const key = String(cat?.key ?? "");
      const name = String(cat?.name ?? "");
      return selectedCategoryValue === id || selectedCategoryValue === key || selectedCategoryValue === name;
    });
    return match || null;
  }, [categories, selectedCategoryValue]);

  const selectedCategoryLabel = useMemo(() => {
    if (!selectedCategoryValue) return "";
    return String(selectedCategory?.name ?? selectedCategory?.key ?? selectedCategoryValue);
  }, [selectedCategory, selectedCategoryValue]);

  const selectedCategoryKey = useMemo(() => {
    return normalizeCategoryKey(
      String(selectedCategory?.key ?? selectedCategoryValue ?? selectedCategoryLabel),
    );
  }, [selectedCategory, selectedCategoryValue, selectedCategoryLabel]);

  const legacyEditableQuestions = useMemo(
    () =>
      buildEditableLegacyQuestions({
        categoryKey: selectedCategoryKey,
        categoryName: selectedCategoryLabel || "General",
        ordinaryQuestions,
      }),
    [ordinaryQuestions, selectedCategoryKey, selectedCategoryLabel],
  );
  const legacyQuestionByKey = useMemo(
    () => new Map(legacyEditableQuestions.map((question) => [question.key, question])),
    [legacyEditableQuestions],
  );
  const sortedLegacyFallbackQuestions = useMemo(
    () =>
      legacyEditableQuestions
        .slice()
        .filter((question) => question.isEnabled)
        .sort((a, b) => Number(a.order || 0) - Number(b.order || 0)),
    [legacyEditableQuestions],
  );

  const isDynamicFlowCategory = useMemo(() => Boolean(selectedCategoryKey), [selectedCategoryKey]);

  const dynamicFlowRequestId = useMemo(() => {
    if (activeRequestId) return activeRequestId;
    return `draft:${String(user?.id || "resident")}:${draftRequestSeed}:${selectedCategoryKey || "ordinary"}`;
  }, [activeRequestId, draftRequestSeed, selectedCategoryKey, user?.id]);

  const applyDynamicFlowSession = useCallback((session: DynamicFlowSessionView | null) => {
    setDynamicFlowSession(session);
    if (!session) return;

    const displayAnswers: Record<string, string> = {};
    const questionMap = new Map<string, DynamicFlowQuestion>();
    [...(session.activePath || []), ...(session.history || [])].forEach((question) => {
      questionMap.set(String(question.questionKey || ""), question);
    });

    for (const [questionKey, answer] of Object.entries(session.answers || {})) {
      const question = questionMap.get(String(questionKey)) || (session.currentQuestion as any);
      if (!question) continue;
      const displayValue = toDisplayDynamicAnswer(question, answer);
      if (displayValue) {
        displayAnswers[String(questionKey)] = displayValue;
      }

      if (String(questionKey) === "urgency" && answer && typeof answer === "object") {
        const urgencyValue = String((answer as any).value || "").trim().toLowerCase();
        if (urgencyValue) setUrgency(normalizeUrgencyLabel(urgencyValue));
      }

      if (String(questionKey) === "location" && answer && typeof answer === "object") {
        const estateMode = String((answer as any).estateMode || "estate");
        const isOutside = estateMode === "outside";
        setHasConfirmedEstateResidence(true);
        setEstateResidenceMode(isOutside ? "outside" : "estate");
        setEstateName(String((answer as any).estateName || ""));
        setResidentState(String((answer as any).state || ""));
        setResidentLga(String((answer as any).lga || ""));
        setAddress(String((answer as any).address || ""));
        setUnit(String((answer as any).unit || ""));
      }

      if (String(questionKey) === "photos" && answer && typeof answer === "object") {
        const files = Array.isArray((answer as any).files) ? (answer as any).files : [];
        setPersistedAttachmentCount(files.length);
      }

      if (String(questionKey) === "notes" && answer && typeof answer === "object") {
        setNotes(String((answer as any).text || ""));
      }
    }

    setWizardAnswers((prev) => ({ ...prev, ...displayAnswers }));
    const currentIndex = Array.isArray(session.activePath)
      ? session.activePath.findIndex(
          (question) => String(question.questionKey || "") === String(session.currentQuestion?.questionKey || ""),
        )
      : -1;
    if (currentIndex >= 0) {
      setWizardIndex(currentIndex);
    }
    if (session.isComplete && stage !== "summary") {
      const questionKeys = new Set(
        [...(session.activePath || []), ...(session.history || [])].map((question) =>
          String(question.questionKey || ""),
        ),
      );
      const activePathLength = Array.isArray(session.activePath) ? session.activePath.length : 0;
      const shouldAskLocalPhotos =
        !questionKeys.has("photos") &&
        !localWrapUpCompleted.photos &&
        !persistedAttachmentCount &&
        attachments.length === 0;
      const shouldAskLocalNotes = !questionKeys.has("notes") && !localWrapUpCompleted.notes && !notes.trim();

      if (shouldAskLocalPhotos || shouldAskLocalNotes) {
        setWizardIndex(activePathLength + (shouldAskLocalPhotos ? 0 : 1));
        setStage("wizard");
        return;
      }
      if (!isSummaryManuallyDismissed) {
        openJobSummary();
      }
    }
  }, [
    attachments.length,
    isSummaryManuallyDismissed,
    localWrapUpCompleted,
    notes,
    openJobSummary,
    persistedAttachmentCount,
    stage,
  ]);

  useEffect(() => {
    let cancelled = false;
    if (!selectedCategoryValue || !selectedCategoryKey) {
      setDynamicFlowSession(null);
      setDynamicFlowFallback(false);
      return;
    }
    if (!isDynamicFlowCategory) {
      setDynamicFlowSession(null);
      setDynamicFlowFallback(true);
      return;
    }
    if (stage !== "wizard") return;

    const run = async () => {
      setIsDynamicFlowLoading(true);
      try {
        const response = await residentFetch<{
          fallback: boolean;
          session?: DynamicFlowSessionView;
        }>("/api/app/ordinary-flow/sessions", {
          method: "POST",
          json: {
            requestId: dynamicFlowRequestId,
            categoryKey: selectedCategoryKey,
          },
        });
        if (cancelled) return;
        if (response?.fallback || !response?.session) {
          setDynamicFlowFallback(true);
          setDynamicFlowSession(null);
          return;
        }
        setDynamicFlowFallback(false);
        applyDynamicFlowSession(response.session);
      } catch {
        if (cancelled) return;
        setDynamicFlowFallback(true);
        setDynamicFlowSession(null);
      } finally {
        if (!cancelled) setIsDynamicFlowLoading(false);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [
    applyDynamicFlowSession,
    dynamicFlowRequestId,
    isDynamicFlowCategory,
    selectedCategoryKey,
    selectedCategoryValue,
    stage,
  ]);

  const handleSelectCategoryFromGrid = (categoryName: string) => {
    const match = categories.find((cat: any) => {
      const name = String(cat?.name ?? "");
      const key = String(cat?.key ?? "");
      return (
        name.toLowerCase() === categoryName.toLowerCase() ||
        key.toLowerCase() === categoryName.toLowerCase()
      );
    });
    const value = String(match?.key ?? match?.id ?? match?.name ?? categoryName);
    const label = String(match?.name ?? match?.key ?? categoryName);
    const restoreStage = restoreStageAfterCategorySelectionRef.current;
    const restoreWizardIndex = restoreWizardIndexAfterCategorySelectionRef.current;
    restoreStageAfterCategorySelectionRef.current = null;
    restoreWizardIndexAfterCategorySelectionRef.current = null;

    clearWizardPromptTimer();
    setIsWizardBotThinking(false);
    setSelectedCategoryValue(value);
    setWizardAnswers((prev) => ({ ...prev, category_select: label }));
    if (restoreStage === "summary") {
      openJobSummary();
      return;
    }
    if (typeof restoreWizardIndex === "number" && Number.isFinite(restoreWizardIndex)) {
      setWizardIndex(Math.max(0, restoreWizardIndex));
      setStage("wizard");
      return;
    }
    setWizardIndex(0);
    setStage("wizard");
  };

  const categoryProfile = useMemo(() => {
    if (isDynamicFlowCategory && dynamicFlowSession && !dynamicFlowFallback) {
      const allQuestions = [...(dynamicFlowSession.activePath || []), ...(dynamicFlowSession.history || [])];
      const issueQuestion = allQuestions.find(
        (question) => String(question.questionKey || "") === "issue_type",
      );
      return {
        issueChips:
          issueQuestion?.options?.map((option) => String(option.label || option.value || option.optionKey)) ||
          ["Install", "Repair", "Inspection", "Replace", "Other"],
        followUps: [],
        quantityPrompt: "How many items or areas?",
        quantityOptions: DEFAULT_QUANTITY_OPTIONS,
        timeWindowPrompt: "When should we come?",
        timeWindowOptions: DEFAULT_TIME_WINDOWS,
        photoRequired: false,
        photoRecommended: true,
        photoHelper: "Upload photos if available.",
      } satisfies CategoryProfile;
    }
    return buildCategoryProfile(selectedCategoryLabel || "General");
  }, [dynamicFlowFallback, dynamicFlowSession, isDynamicFlowCategory, selectedCategoryLabel]);

  const filteredEstates = useMemo(() => {
    const query = estateSearch.trim().toLowerCase();
    if (!query) return estates;
    return estates.filter((estate) => estate.name.toLowerCase().includes(query));
  }, [estates, estateSearch]);

  const availableLgas = useMemo(() => {
    return residentState ? LGA_BY_STATE[residentState] || [] : [];
  }, [residentState]);

  const isLocationComplete = useMemo(() => {
    if (!hasConfirmedEstateResidence) return false;
    if (estateResidenceMode === "outside") {
      return Boolean(residentState && residentLga && address.trim());
    }
    return Boolean(estateName && address.trim());
  }, [
    hasConfirmedEstateResidence,
    estateResidenceMode,
    residentState,
    residentLga,
    estateName,
    address,
  ]);

  const locationMissingHint = useMemo(() => {
    if (isLocationComplete) return "";
    if (!hasConfirmedEstateResidence) return "Select yes or no to continue";
    if (estateResidenceMode === "outside") {
      if (!residentState) return "Select your state";
      if (!residentLga) return "Select your LGA";
      if (!address.trim()) return "Enter your address";
    } else {
      if (!estateName) return "Select your estate";
      if (!address.trim()) return "Enter your address";
    }
    return "Complete the fields above to continue";
  }, [
    isLocationComplete,
    hasConfirmedEstateResidence,
    estateResidenceMode,
    residentState,
    residentLga,
    address,
    estateName,
  ]);

  const wizardSteps = useMemo<WizardStep[]>(() => {
    if (isDynamicFlowCategory && dynamicFlowSession && !dynamicFlowFallback) {
      const pathSteps = (dynamicFlowSession.activePath || []).map(mapDynamicQuestionToStep);
      if (pathSteps.length) {
        const pathStepIds = new Set(pathSteps.map((step) => step.id));
        const localWrapUpSteps: WizardStep[] = [];
        if (!pathStepIds.has("photos")) {
          localWrapUpSteps.push({
            id: "photos",
            kind: "photos",
            prompt: "Upload photo evidence (optional).",
            required: false,
            helperText: "Photos help the provider prepare tools before arrival.",
          });
        }
        if (!pathStepIds.has("notes")) {
          localWrapUpSteps.push({
            id: "notes",
            kind: "text",
            prompt: "Anything else we should know?",
            placeholder: "Type your answer.",
          });
        }
        return [...pathSteps, ...localWrapUpSteps];
      }
    }

    const question = (key: string) => legacyQuestionByKey.get(key);
    const isEnabled = (key: string, fallback = true) => question(key)?.isEnabled ?? fallback;
    const promptFor = (key: string, fallback: string) => String(question(key)?.label || fallback);
    const optionsFor = (key: string, fallback: string[]) => {
      const options = question(key)?.options;
      return Array.isArray(options) && options.length ? options.map((option) => String(option)) : fallback;
    };

    const isPlumberOtherIssueSelected =
      selectedCategoryKey === "plumber" &&
      String(wizardAnswers.issue_type || "").trim().toLowerCase() === "other";

    const knownFallbackOptions: Record<string, string[]> = {
      urgency: URGENCY_OPTIONS.map((opt) => opt.label),
      issue_type: categoryProfile.issueChips,
      quantity: categoryProfile.quantityOptions,
      time_window: categoryProfile.timeWindowOptions,
    };

    const steps: WizardStep[] = [];

    sortedLegacyFallbackQuestions.forEach((legacyQuestion) => {
      if (!legacyQuestion.isEnabled) return;
      if (legacyQuestion.key === "issue_other_details" && !isPlumberOtherIssueSelected) return;

      if (legacyQuestion.key === "location" || legacyQuestion.type === "estate") {
        steps.push({
          id: legacyQuestion.key,
          kind: "location",
          prompt: legacyQuestion.label || "Do you live in an estate registered with CityConnect?",
        });
        return;
      }

      if (
        legacyQuestion.key === "photos" ||
        legacyQuestion.type === "multi_image" ||
        legacyQuestion.type === "image"
      ) {
        steps.push({
          id: legacyQuestion.key,
          kind: "photos",
          prompt:
            legacyQuestion.label ||
            (categoryProfile.photoRequired ? "Please upload at least one photo." : "Upload a photo if available."),
          required: legacyQuestion.required ?? categoryProfile.photoRequired,
          helperText: legacyQuestion.helperText ?? categoryProfile.photoHelper,
        });
        return;
      }

      if (legacyQuestion.type === "select" || legacyQuestion.type === "urgency") {
        const fallbackOptions = knownFallbackOptions[legacyQuestion.key] ?? [];
        const options = Array.isArray(legacyQuestion.options) && legacyQuestion.options.length
          ? legacyQuestion.options
          : fallbackOptions;
        steps.push({
          id: legacyQuestion.key,
          kind: "chips",
          prompt: legacyQuestion.label || promptFor(legacyQuestion.key, legacyQuestion.key),
          options,
        });
        return;
      }

      steps.push({
        id: legacyQuestion.key,
        kind: "text",
        prompt: legacyQuestion.label || promptFor(legacyQuestion.key, legacyQuestion.key),
        placeholder:
          legacyQuestion.placeholder ||
          (legacyQuestion.key === "notes" ? "Add any extra details here." : "Type the resident response."),
      });
    });

    const stepIds = new Set(steps.map((step) => step.id));
    if (!stepIds.has("photos")) {
      steps.push({
        id: "photos",
        kind: "photos",
        prompt: "Upload photo evidence (optional).",
        required: false,
        helperText: "Photos help the provider prepare tools before arrival.",
      });
    }
    if (!stepIds.has("notes")) {
      steps.push({
        id: "notes",
        kind: "text",
        prompt: "Anything else we should know?",
        placeholder: "Type your answer.",
      });
    }

    return steps;
  }, [
    categoryProfile,
    dynamicFlowFallback,
    dynamicFlowSession,
    isDynamicFlowCategory,
    legacyQuestionByKey,
    sortedLegacyFallbackQuestions,
    selectedCategoryKey,
    wizardAnswers.issue_type,
  ]);

  useEffect(() => {
    if (!wizardSteps.length) {
      clearWizardPromptTimer();
      setIsWizardBotThinking(false);
      if (wizardIndex !== 0) setWizardIndex(0);
      return;
    }
    if (wizardIndex > wizardSteps.length - 1) {
      setWizardIndex(wizardSteps.length - 1);
    }
  }, [clearWizardPromptTimer, wizardSteps, wizardIndex]);

  const focusAddressField = () => {
    requestAnimationFrame(() => {
      if (addressSectionRef.current) {
        addressSectionRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
      }
      addressTextareaRef.current?.focus();
    });
  };

  const focusNextLocationField = (mode: "estate" | "outside") => {
    requestAnimationFrame(() => {
      if (mode === "estate") {
        estateSearchInputRef.current?.focus();
      } else {
        stateSelectTriggerRef.current?.focus();
      }
    });
  };

  const intakeLocationLabel = () => {
    const base =
      estateResidenceMode === "outside"
        ? [address, residentLga, residentState].filter(Boolean).join(", ") || "Not provided"
        : [estateName, address].filter(Boolean).join(", ") || "Not provided";
    if (!unit.trim()) return base;
    return `${base} - Unit ${unit.trim()}`;
  };

  const currentStep = wizardSteps[wizardIndex];
  const effectiveAttachmentCount = persistedAttachmentCount ?? attachments.length;
  const isDynamicBackendStep = useCallback(
    (stepId?: string | null) => {
      if (!stepId || !isDynamicFlowCategory || !dynamicFlowSession || dynamicFlowFallback) return false;
      return [...(dynamicFlowSession.activePath || []), ...(dynamicFlowSession.history || [])].some(
        (question) => String(question.questionKey || "") === String(stepId),
      );
    },
    [dynamicFlowFallback, dynamicFlowSession, isDynamicFlowCategory],
  );

  useEffect(() => {
    if (stage !== "summary" || activeRequestId) {
      return;
    }

    const photosIndex = wizardSteps.findIndex((step) => step.id === "photos");
    const notesIndex = wizardSteps.findIndex((step) => step.id === "notes");
    const shouldAskLocalPhotos =
      photosIndex >= 0 && !localWrapUpCompleted.photos && effectiveAttachmentCount === 0;
    const shouldAskLocalNotes = notesIndex >= 0 && !localWrapUpCompleted.notes && !notes.trim();

    if (shouldAskLocalPhotos) {
      setWizardIndex(photosIndex);
      setStage("wizard");
      return;
    }

    if (shouldAskLocalNotes) {
      setWizardIndex(notesIndex);
      setStage("wizard");
    }
  }, [
    activeRequestId,
    effectiveAttachmentCount,
    localWrapUpCompleted,
    notes,
    stage,
    wizardSteps,
  ]);

  const historyBlocks = wizardSteps
    .slice(0, Math.max(0, wizardIndex))
    .filter((step) => {
      if (step.kind === "photos") return effectiveAttachmentCount > 0 || wizardAnswers[step.id];
      if (step.kind === "text") {
        if (step.id === "notes") return Boolean(notes.trim());
        return Boolean(String(wizardAnswers[step.id] || "").trim());
      }
      return Boolean(wizardAnswers[step.id]);
    })
    .map((step) => {
      let answer = wizardAnswers[step.id] || "";
      if (step.kind === "photos") {
        answer = effectiveAttachmentCount ? `${effectiveAttachmentCount} photo(s) added` : "Skipped";
      }
      if (step.kind === "text") {
        answer = step.id === "notes" ? notes.trim() : String(wizardAnswers[step.id] || "").trim();
      }
      return { id: step.id, kind: step.kind, prompt: step.prompt, answer };
    });

  const persistCurrentDraftSnapshot = useCallback(() => {
    const hasDraftData = Boolean(
      selectedCategoryValue ||
        categorySelectSearch.trim() ||
        hasConfirmedEstateResidence ||
        estateName.trim() ||
        estateSearch.trim() ||
        residentState.trim() ||
        residentLga.trim() ||
        address.trim() ||
        unit.trim() ||
        urgency.trim() ||
        notes.trim() ||
        Object.keys(wizardAnswers).length,
    );

    if (!hasDraftData) {
      clearOrdinaryDraftSnapshot();
      return null;
    }

    const nowIso = new Date().toISOString();
    const sanitizedAnswers = Object.entries(wizardAnswers).reduce<Record<string, string>>(
      (acc, [key, value]) => {
        if (!key) return acc;
        const normalized = String(value ?? "");
        if (!normalized.trim()) return acc;
        acc[key] = normalized;
        return acc;
      },
      {},
    );

    const snapshot: OrdinaryConversationDraftSnapshot = {
      version: 1,
      updatedAt: nowIso,
      draftRequestSeed,
      stage: selectedCategoryValue ? stage : "intake",
      selectedCategoryValue: String(selectedCategoryValue || ""),
      categorySelectSearch: String(categorySelectSearch || ""),
      estateName: String(estateName || ""),
      estateResidenceMode,
      hasConfirmedEstateResidence:
        hasConfirmedEstateResidence || Boolean(String(sanitizedAnswers.location || "").trim()),
      estateSearch: String(estateSearch || ""),
      residentState: String(residentState || ""),
      residentLga: String(residentLga || ""),
      address: String(address || ""),
      unit: String(unit || ""),
      urgency: String(urgency || ""),
      wizardIndex: Math.max(0, Number(wizardIndex || 0)),
      wizardAnswers: sanitizedAnswers,
      notes: String(notes || ""),
    };

    try {
      localStorage.setItem(ordinaryDraftStorageKey, JSON.stringify(snapshot));
    } catch {
      // ignore storage errors
    }
    setStoredDraftSnapshot(snapshot);
    setDraftSavedAt(nowIso);
    return snapshot;
  }, [
    address,
    categorySelectSearch,
    clearOrdinaryDraftSnapshot,
    draftRequestSeed,
    estateName,
    estateResidenceMode,
    estateSearch,
    hasConfirmedEstateResidence,
    notes,
    ordinaryDraftStorageKey,
    residentLga,
    residentState,
    selectedCategoryValue,
    stage,
    unit,
    urgency,
    wizardAnswers,
    wizardIndex,
  ]);

  useEffect(() => {
    if (!draftHydratedRef.current) return;
    if (activeRequestId) return;
    persistCurrentDraftSnapshot();
  }, [
    activeRequestId,
    address,
    categorySelectSearch,
    estateName,
    estateResidenceMode,
    estateSearch,
    hasConfirmedEstateResidence,
    notes,
    ordinaryDraftStorageKey,
    residentLga,
    residentState,
    selectedCategoryValue,
    stage,
    unit,
    urgency,
    wizardAnswers,
    wizardIndex,
    persistCurrentDraftSnapshot,
  ]);

  useEffect(() => {
    const persistDraftOnVisibilityChange = () => {
      if (document.visibilityState !== "hidden") return;
      if (!draftHydratedRef.current) return;
      if (activeRequestId) return;
      persistCurrentDraftSnapshot();
    };

    const persistDraftOnPageExit = () => {
      if (!draftHydratedRef.current) return;
      if (activeRequestId) return;
      persistCurrentDraftSnapshot();
    };

    document.addEventListener("visibilitychange", persistDraftOnVisibilityChange);
    window.addEventListener("beforeunload", persistDraftOnPageExit);
    window.addEventListener("pagehide", persistDraftOnPageExit);
    return () => {
      document.removeEventListener("visibilitychange", persistDraftOnVisibilityChange);
      window.removeEventListener("beforeunload", persistDraftOnPageExit);
      window.removeEventListener("pagehide", persistDraftOnPageExit);
    };
  }, [activeRequestId, persistCurrentDraftSnapshot]);

  const submitDynamicAnswer = useCallback(
    async (questionKey: string, answerPayload: any) => {
      if (!dynamicFlowSession?.sessionId) return false;
      try {
        setIsWizardBotThinking(true);
        await new Promise((resolve) => window.setTimeout(resolve, BOT_PROMPT_DELAY_MS));
        const response = await residentFetch<{
          session?: DynamicFlowSessionView;
          error?: string;
          stateRevision?: number;
          currentQuestion?: DynamicFlowQuestion | null;
        }>(`/api/app/ordinary-flow/sessions/${dynamicFlowSession.sessionId}/answers`, {
          method: "POST",
          json: {
            questionKey,
            answer: answerPayload,
            expectedRevision: Number(dynamicFlowSession.stateRevision || 0),
          },
        });
        if (response?.session) {
          applyDynamicFlowSession(response.session);
          return true;
        }
        return false;
      } catch (error: any) {
        const message = String(error?.message || "");
        if (/409/.test(message)) {
          try {
            const conflictStart = message.indexOf("{");
            const conflictPayload =
              conflictStart >= 0 ? JSON.parse(message.slice(conflictStart)) : null;
            if (conflictPayload?.session) {
              applyDynamicFlowSession(conflictPayload.session);
            }
          } catch {
            // ignore parse failure
          }
          toast({
            title: "Conversation updated",
            description: "Please continue from the latest question.",
          });
          return false;
        }
        toast({
          title: "Could not save answer",
          description: "Please try again.",
          variant: "destructive",
        });
        return false;
      } finally {
        setIsWizardBotThinking(false);
      }
    },
    [applyDynamicFlowSession, dynamicFlowSession, toast],
  );

  const handleSelectChip = (stepId: string, value: string) => {
    if (isWizardBotThinking) return;
    if (isDynamicFlowCategory && dynamicFlowSession && !dynamicFlowFallback) {
      const question = (dynamicFlowSession.activePath || []).find(
        (entry) => String(entry.questionKey || "") === String(stepId),
      );
      if (question) {
        const matchedOption = (question.options || []).find(
          (option) =>
            String(option.label || "").toLowerCase() === String(value || "").toLowerCase() ||
            String(option.value || "").toLowerCase() === String(value || "").toLowerCase(),
        );
        let payload: any = {};
        if (question.inputType === "urgency") {
          const normalized = String(value || "").trim().toLowerCase();
          payload = { value: normalized };
          setUrgency(normalizeUrgencyLabel(normalized));
        } else if (matchedOption) {
          payload = { optionKey: matchedOption.optionKey };
        } else {
          payload = { text: value };
        }
        setWizardAnswers((prev) => ({ ...prev, [stepId]: value }));
        void submitDynamicAnswer(stepId, payload);
        return;
      }
    }
    if (stepId === "urgency") {
      setUrgency(value);
    }
    setWizardAnswers((prev) => ({ ...prev, [stepId]: value }));
    const nextIndex = Math.min(wizardIndex + 1, wizardSteps.length - 1);
    queueWizardStepAdvance(nextIndex);
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
    setAttachments((prev) => {
      const removed = prev.find((att) => att.id === id);
      if (removed && previewAttachment?.url === removed.dataUrl) {
        setPreviewAttachment(null);
      }
      return prev.filter((att) => att.id !== id);
    });
  };

  const handleFinishNotes = async () => {
    if (
      currentStep &&
      isDynamicFlowCategory &&
      dynamicFlowSession &&
      !dynamicFlowFallback &&
      isDynamicBackendStep(currentStep.id)
    ) {
      const answerText =
        currentStep.id === "notes"
          ? notes.trim()
          : String(wizardAnswers[currentStep.id] || "").trim();
      await submitDynamicAnswer(
        currentStep.id,
        currentStep.id === "notes" ? { text: answerText } : answerText,
      );
      return;
    }

    if (currentStep?.kind === "text" && currentStep.id !== "notes") {
      const value = String(wizardAnswers[currentStep.id] || "").trim();
      setWizardAnswers((prev) => ({ ...prev, [currentStep.id]: value }));
    }

    const isLastStep = wizardIndex >= wizardSteps.length - 1;
    if (!isLastStep) {
      if (currentStep?.id === "notes") {
        setLocalWrapUpCompleted((prev) => ({ ...prev, notes: true }));
      }
      const nextIndex = Math.min(wizardIndex + 1, wizardSteps.length - 1);
      queueWizardStepAdvance(nextIndex);
      return;
    }

    if (!notes.trim()) {
      setNotes("");
    }
    if (currentStep?.id === "notes") {
      setLocalWrapUpCompleted((prev) => ({ ...prev, notes: true }));
    }
    openJobSummary();
  };

  const resetFlowForNewRequest = () => {
    clearWizardPromptTimer();
    setIsWizardBotThinking(false);
    clearOrdinaryDraftSnapshot();
    setIsSummaryManuallyDismissed(false);
    setDraftRequestSeed(createOrdinaryDraftRequestSeed());
    setStage("intake");
    setSelectedCategoryValue("");
    setCategorySelectSearch("");
    setWizardIndex(0);
    setWizardAnswers({});
    setNotes("");
    setAttachments([]);
    setPersistedAttachmentCount(null);
    setLocalWrapUpCompleted({});
    setUrgency("");
    setAddress("");
    setUnit("");
    setEstateName("");
    setResidentState("");
    setResidentLga("");
    setEstateResidenceMode("estate");
    setHasConfirmedEstateResidence(false);
    setDynamicFlowSession(null);
    setActiveRequestId(null);
    setDraftSavedAt(new Date().toISOString());
  };

  const handleCancelRequest = async () => {
    if (!activeRequestId) {
      resetFlowForNewRequest();
      return;
    }

    const statusKey = normalizeStatusKey(activeRequestLive?.status || "");
    if (CANCELLATION_REVIEW_REQUIRED_STATUSES.has(statusKey)) {
      if (hasOpenCancellationReview) {
        toast({
          title: "Already under review",
          description: "Your cancellation request is already waiting for admin decision.",
        });
        return;
      }
      setIsCancelRequestDialogOpen(true);
      return;
    }

    try {
      await residentFetch(`/api/service-requests/${activeRequestId}`, {
        method: "DELETE",
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["my-recent-requests"] }),
        queryClient.invalidateQueries({ queryKey: ["resident-active-request", activeRequestId] }),
        queryClient.invalidateQueries({ queryKey: ["admin.bridge.service-requests"] }),
      ]);
      toast({
        title: "Request cancelled",
        description: "Your request has been cancelled.",
      });
      resetFlowForNewRequest();
    } catch (error: any) {
      const message = String(error?.message || "");
      if (/requiresCancellationReview|assigned or active|under review|409/i.test(message)) {
        setIsCancelRequestDialogOpen(true);
        return;
      }
      toast({
        title: "Cancel failed",
        description: message || "Could not cancel request",
        variant: "destructive",
      });
    }
  };

  const handleChangeCategory = () => {
    clearWizardPromptTimer();
    setIsWizardBotThinking(false);
    clearOrdinaryDraftSnapshot();
    setIsSummaryManuallyDismissed(false);
    setStage("intake");
    setSelectedCategoryValue("");
    setCategorySelectSearch("");
    setWizardIndex(0);
    setWizardAnswers({});
    setNotes("");
    setAttachments([]);
    setPersistedAttachmentCount(null);
    setLocalWrapUpCompleted({});
    setUrgency("");
    setDynamicFlowSession(null);
    setActiveRequestId(null);
    setDraftSavedAt(new Date().toISOString());
  };

  const jumpToWizard = (stepId: string) => {
    const idx = wizardSteps.findIndex((s) => s.id === stepId);
    if (idx >= 0) {
      clearWizardPromptTimer();
      setIsWizardBotThinking(false);
      setIsSummaryManuallyDismissed(true);
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

    clearWizardPromptTimer();
    setIsWizardBotThinking(false);
    setActiveRequestId(request?.id || null);
    skipCategoryResetRef.current = true;
    setSelectedCategoryValue(request?.categoryLabel || request?.category || "");
    setUrgency(urgencyLabel);
    setWizardAnswers((prev) => ({
      ...prev,
      location: request?.location || parsedDetails.location || "",
      urgency: urgencyLabel,
      issue_type:
        parsedDetails.issueType ||
        (request?.categoryLabel || request?.category
          ? formatCategoryLabel(request?.categoryLabel || request?.category || "")
          : prev.issue_type),
      quantity: parsedDetails.quantity || prev.quantity,
      time_window:
        parsedDetails.timeWindow ||
        (request?.preferredTime ? new Date(request.preferredTime).toLocaleString() : prev.time_window),
    }));
    setNotes(parsedDetails.notes || "");
    setAddress(request?.location || parsedDetails.location || "");
    setHasConfirmedEstateResidence(true);
    const locationSource = String(request?.location || parsedDetails.location || "");
    const matchedEstate = estates.find((estate: any) => locationSource.includes(String(estate?.name || "")));
    if (matchedEstate) {
      setEstateResidenceMode("estate");
      setEstateName(String(matchedEstate.name || ""));
    } else {
      setEstateResidenceMode("outside");
      setEstateName("");
    }
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
      const snapshot = storedDraftSnapshot ?? readOrdinaryDraftSnapshot();
      if (snapshot) {
        applyOrdinaryDraftSnapshot(snapshot);
      } else {
        resetFlowForNewRequest();
      }
      return true;
    }
    if (!activeRequestId) {
      persistCurrentDraftSnapshot();
    }
    try {
      setLoadingRequestId(requestId);
      const data = await residentFetch(`/api/app/service-requests/${requestId}`);
      hydrateFromRequest(data);
      return true;
    } catch (error) {
      console.error("Failed to load request", error);
      return false;
    } finally {
      setLoadingRequestId(null);
    }
  };

  useEffect(() => {
    if (!requestIdFromSearch) return;
    if (openedRequestFromQueryRef.current === requestIdFromSearch) return;
    let cancelled = false;
    let retries = 0;

    const openFromQuery = async () => {
      if (cancelled) return;
      const success = await handleOpenRecentRequest(requestIdFromSearch);
      if (success) {
        openedRequestFromQueryRef.current = requestIdFromSearch;
        return;
      }
      if (!cancelled && retries < 4) {
        retries += 1;
        window.setTimeout(() => {
          void openFromQuery();
        }, 600);
      }
    };

    void openFromQuery();
    return () => {
      cancelled = true;
    };
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
    const timer = window.setInterval(() => setCountdownTick(Date.now()), 1000);
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
        activeRequestLive.categoryLabel ||
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
    clearWizardPromptTimer();
    setIsWizardBotThinking(false);
    setWizardIndex(targetIdx);
    setPendingPrefill(false);
  }, [clearWizardPromptTimer, pendingPrefill, wizardSteps, wizardAnswers, notes, effectiveAttachmentCount]);

  const handleBookConsultancy = async () => {
    let normalizedDynamicIntake: Record<string, any> | null = null;
    if (isDynamicFlowCategory && dynamicFlowSession && !dynamicFlowFallback) {
      if (!dynamicFlowSession.isComplete) {
        toast({
          title: "Complete the required prompts",
          description: "Please answer all required dynamic flow questions before booking.",
        });
        return;
      }
      try {
        const completion = await residentFetch<{
          ok: boolean;
          normalizedIntake?: Record<string, any>;
          session?: DynamicFlowSessionView;
          error?: string;
        }>(`/api/app/ordinary-flow/sessions/${dynamicFlowSession.sessionId}/complete`, {
          method: "POST",
        });
        if (!completion?.ok || !completion?.normalizedIntake) {
          toast({
            title: "Conversation incomplete",
            description: "Please answer all required prompts before continuing.",
            variant: "destructive",
          });
          return;
        }
        normalizedDynamicIntake = completion.normalizedIntake;
        if (completion.session) {
          applyDynamicFlowSession(completion.session);
        }
      } catch {
        toast({
          title: "Could not finalize conversation",
          description: "Please answer all required prompts, then try again.",
          variant: "destructive",
        });
        return;
      }
    }

    const requestStatus = String(activeRequestLive?.status || "").toLowerCase();
    const paymentStatus = String(activeRequestLive?.paymentStatus || "").toLowerCase();
    const alreadyBooked =
      Boolean(activeRequestId) &&
      (paymentStatus === "paid" ||
        [
          "pending_inspection",
          "assigned",
          "assigned_for_job",
          "in_progress",
          "work_completed_pending_resident",
          "disputed",
          "rework_required",
          "completed",
          "cancelled",
        ].includes(
          requestStatus,
        ));
    if (alreadyBooked) {
      return;
    }

    const dynamicDescriptionParts =
      isDynamicFlowCategory && dynamicFlowSession && !dynamicFlowFallback
        ? (dynamicFlowSession.history || [])
            .map((question) => {
              const answer = wizardAnswers[String(question.questionKey || "")];
              if (!answer) return null;
              return `${question.prompt}: ${answer}`;
            })
            .filter(Boolean)
        : [];

    const readDynamicLabel = (value: any): string => {
      if (!value) return "";
      if (typeof value === "string") return value;
      if (typeof value === "object") {
        const optionKey = String(value.optionKey || "").trim();
        if (optionKey) {
          const issueQuestion = (dynamicFlowSession?.activePath || []).find(
            (question) => String(question.questionKey || "") === "issue_type",
          );
          const matched = issueQuestion?.options?.find(
            (option) => String(option.optionKey || "").trim() === optionKey,
          );
          return String(matched?.label || matched?.value || optionKey);
        }
        const text = String(value.text || value.value || "").trim();
        if (text) return text;
      }
      return "";
    };

    const resolvedIssueType = normalizedDynamicIntake
      ? readDynamicLabel(normalizedDynamicIntake.issueType)
      : wizardAnswers.issue_type;
    const resolvedQuantity = normalizedDynamicIntake
      ? readDynamicLabel(normalizedDynamicIntake.quantity)
      : wizardAnswers.quantity;
    const resolvedTimeWindow = normalizedDynamicIntake
      ? readDynamicLabel(normalizedDynamicIntake.timeWindow)
      : wizardAnswers.time_window;
    const resolvedUrgency = normalizedDynamicIntake
      ? normalizeUrgencyLabel(readDynamicLabel(normalizedDynamicIntake.urgency))
      : urgency;

    const descriptionParts = [
      resolvedIssueType ? `Issue: ${resolvedIssueType}` : null,
      wizardAnswers.issue_other_details
        ? `Other issue details: ${wizardAnswers.issue_other_details}`
        : null,
      ...(dynamicDescriptionParts.length
        ? dynamicDescriptionParts
        : categoryProfile.followUps.map((f) =>
            wizardAnswers[f.id] ? `${f.prompt}: ${wizardAnswers[f.id]}` : null,
          )),
      resolvedQuantity ? `Quantity: ${resolvedQuantity}` : null,
      resolvedTimeWindow ? `Preferred time: ${resolvedTimeWindow}` : null,
      resolvedUrgency ? `Urgency: ${resolvedUrgency}` : null,
      `Location: ${intakeLocationLabel()}`,
      notes.trim() ? `Additional information: ${notes.trim()}` : null,
      effectiveAttachmentCount
        ? `Photos attached: ${effectiveAttachmentCount}`
        : "Photos attached: 0",
    ].filter(Boolean);
    const categoryKeyCandidate =
      selectedCategoryKey || normalizeCategoryKey(String(selectedCategoryLabel || selectedCategoryValue || ""));
    if (!categoryKeyCandidate) {
      restoreStageAfterCategorySelectionRef.current = stage;
      restoreWizardIndexAfterCategorySelectionRef.current = wizardIndex;
      setIsCategoryRequiredDialogOpen(true);
      return;
    }

    const primaryFollowUpId = categoryProfile.followUps[0]?.id;
    const primaryFollowUpAnswer = primaryFollowUpId ? wizardAnswers[primaryFollowUpId] : "";

    const draft = {
      categoryKey: categoryKeyCandidate,
      categoryLabel: selectedCategoryLabel || String(selectedCategory?.name ?? ""),
      urgency: resolvedUrgency,
      issueType: resolvedIssueType || "",
      areaAffected: primaryFollowUpAnswer || "",
      quantityLabel: resolvedQuantity || "",
      timeWindowLabel: resolvedTimeWindow || "",
      notes: notes.trim(),
      location: intakeLocationLabel(),
      addressLine: address.trim(),
      estateName: estateResidenceMode === "estate" ? estateName : "",
      stateName: estateResidenceMode === "outside" ? residentState : "",
      lgaName: estateResidenceMode === "outside" ? residentLga : "",
      unit: unit.trim(),
      residenceMode: estateResidenceMode,
      description: descriptionParts.join("\n"),
      attachmentsCount: effectiveAttachmentCount,
      ordinaryFlowSessionId: dynamicFlowSession?.sessionId || null,
      ordinaryFlowIntakeSnapshot: normalizedDynamicIntake || null,
    };

    try {
      sessionStorage.setItem(CONSULTANCY_DRAFT_KEY, JSON.stringify(draft));
    } catch {
      // ignore storage errors
    }

    navigate("/checkout-diagnosis");
  };

  const draftSessionId = "draft-ordinary-flow";
  const liveDraftHasContent = Boolean(
    selectedCategoryValue ||
      Object.keys(wizardAnswers).length ||
      notes.trim() ||
      attachments.length ||
      urgency.trim() ||
      address.trim() ||
      unit.trim() ||
      estateName.trim() ||
      residentState.trim() ||
      residentLga.trim(),
  );
  const liveDraftSnippet = useMemo(() => {
    const lastAnswered = historyBlocks.length
      ? String(historyBlocks[historyBlocks.length - 1]?.answer || "").trim()
      : "";
    if (lastAnswered) return lastAnswered;

    const locationDraft =
      estateResidenceMode === "outside"
        ? [address, residentLga, residentState].filter(Boolean).join(", ")
        : [estateName, address].filter(Boolean).join(", ");
    return locationDraft || "Not provided";
  }, [address, estateName, estateResidenceMode, historyBlocks, residentLga, residentState]);
  const storedDraftTitle = useMemo(() => {
    const draftCategory = String(storedDraftSnapshot?.selectedCategoryValue || "");
    if (!draftCategory) return "New request";
    const match = categories.find((cat: any) => {
      const id = String(cat?.id ?? "");
      const key = String(cat?.key ?? "");
      const name = String(cat?.name ?? "");
      return draftCategory === id || draftCategory === key || draftCategory === name;
    });
    return String(match?.name ?? match?.key ?? draftCategory ?? "New request");
  }, [categories, storedDraftSnapshot]);
  const storedDraftSnippet = useMemo(() => {
    if (!storedDraftSnapshot) return "Not provided";

    const answers = Object.values(storedDraftSnapshot.wizardAnswers || {})
      .map((value) => String(value || "").trim())
      .filter(Boolean);
    const lastAnswered = answers.length ? answers[answers.length - 1] : "";
    if (lastAnswered) return lastAnswered;

    const locationDraft =
      storedDraftSnapshot.estateResidenceMode === "outside"
        ? [storedDraftSnapshot.address, storedDraftSnapshot.residentLga, storedDraftSnapshot.residentState]
            .filter(Boolean)
            .join(", ")
        : [storedDraftSnapshot.estateName, storedDraftSnapshot.address].filter(Boolean).join(", ");
    return locationDraft || "Not provided";
  }, [storedDraftSnapshot]);
  const draftSessionPreview = useMemo(() => {
    if (stage === "summary") return null;
    if (!activeRequestId && liveDraftHasContent) {
      return {
        id: draftSessionId,
        title: selectedCategoryLabel || "New request",
        updatedAt: draftSavedAt || new Date().toISOString(),
        snippet: liveDraftSnippet,
        status: "draft",
      };
    }
    if (!storedDraftSnapshot) return null;
    return {
      id: draftSessionId,
      title: storedDraftTitle || "New request",
      updatedAt: storedDraftSnapshot.updatedAt || draftSavedAt || new Date().toISOString(),
      snippet: storedDraftSnippet,
      status: "draft",
    };
  }, [
    activeRequestId,
    draftSavedAt,
    liveDraftHasContent,
    liveDraftSnippet,
    selectedCategoryLabel,
    stage,
    storedDraftSnapshot,
    storedDraftSnippet,
    storedDraftTitle,
  ]);
  const draftSessions = useMemo(
    () => (draftSessionPreview ? [draftSessionPreview] : []),
    [draftSessionPreview],
  );

  const activeSessionId =
    activeRequestId ||
    loadingRequestId ||
    (requestIdFromSearch ? null : draftSessions.length ? draftSessionId : null);

  const handleOpenCategorySelectionFromModal = () => {
    clearWizardPromptTimer();
    setIsWizardBotThinking(false);
    setIsCategoryRequiredDialogOpen(false);
    skipCategoryResetRef.current = true;
    setStage("intake");
  };

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

  const confirmDeliveryMutation = useMutation({
    mutationFn: async (payload: { requestId: string }) =>
      residentFetch(`/api/service-requests/${payload.requestId}/confirm-delivery`, {
        method: "POST",
      }),
    onSuccess: async (_data, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["resident-active-request", variables.requestId] }),
        queryClient.invalidateQueries({ queryKey: ["admin.bridge.service-requests"] }),
      ]);
    },
  });

  const disputeDeliveryMutation = useMutation({
    mutationFn: async (payload: { requestId: string; reason: string }) =>
      residentFetch(`/api/service-requests/${payload.requestId}/dispute-delivery`, {
        method: "POST",
        json: { reason: payload.reason },
      }),
    onSuccess: async (_data, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["resident-active-request", variables.requestId] }),
        queryClient.invalidateQueries({ queryKey: ["admin.bridge.service-requests"] }),
      ]);
    },
  });

  const requestCancellationReviewMutation = useMutation({
    mutationFn: async (payload: {
      requestId: string;
      reasonCode: string;
      reasonDetail: string;
      preferredResolution: "full_refund" | "partial_refund" | "cancel_without_refund";
    }) =>
      residentFetch(`/api/service-requests/${payload.requestId}/cancellation-cases`, {
        method: "POST",
        json: {
          reasonCode: payload.reasonCode,
          reasonDetail: payload.reasonDetail,
          preferredResolution: payload.preferredResolution,
        },
      }),
    onSuccess: async (_data, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["resident-active-request", variables.requestId] }),
        queryClient.invalidateQueries({ queryKey: ["my-recent-requests"] }),
        queryClient.invalidateQueries({ queryKey: ["admin.bridge.service-requests"] }),
      ]);
      setIsCancelRequestDialogOpen(false);
      setCancelReasonCode("");
      setCancelReasonDetail("");
      setCancelPreferredResolution("full_refund");
      toast({
        title: "Cancellation request submitted",
        description: "Admin will review your reason and update you.",
      });
    },
    onError: (error: any) => {
      const message = error?.message || "Unable to submit cancellation request";
      toast({
        title: "Could not submit request",
        description: message,
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    const socket = io();
    socketRef.current = socket;
    const joinIdentity = String(user?.id || activeRequestLive?.residentId || "").trim();
    if (joinIdentity) {
      socket.emit("join", joinIdentity);
    }

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

    socket.on("request-typing", (payload: RequestTypingSocketPayload) => {
      if (!payload?.requestId) return;
      if (payload.userId === user?.id) return;
      if (payload.senderRole !== "provider" && payload.senderRole !== "admin") return;

      if (!payload.isTyping) {
        clearPeerTypingClearTimer();
        setIsPeerTyping(false);
        return;
      }

      setIsPeerTyping(true);
      clearPeerTypingClearTimer();
      peerTypingClearTimerRef.current = window.setTimeout(() => {
        setIsPeerTyping(false);
      }, 4500);
    });

    return () => {
      socketRef.current = null;
      clearPeerTypingClearTimer();
      socket.disconnect();
    };
  }, [activeRequestId, activeRequestLive?.residentId, clearPeerTypingClearTimer, queryClient, user?.id]);

  const orderedServiceMessages = useMemo(
    () =>
      [...serviceRequestMessages].sort((a, b) => {
        const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return aTime - bTime;
      }),
    [serviceRequestMessages],
  );

  const activeRequestStatusValue = normalizeStatusKey(activeRequestLive?.status || "");
  const isScheduledMaintenanceRequest = Boolean(activeRequestLive?.maintenance?.scheduleId);
  const maintenanceContext = activeRequestLive?.maintenance || null;
  const providerDisplayName =
    assignedProvider?.name ||
    (isScheduledMaintenanceRequest ? "CityConnect Care Desk" : "CityConnect Assistant");
  const activeCancellationCase = activeRequestLive?.cancellationCase || null;
  const activeCancellationCaseStatus = normalizeStatusKey(activeCancellationCase?.status || "");
  const hasOpenCancellationReview = ["requested", "under_review"].includes(activeCancellationCaseStatus);
  const canRequestCancellationReview =
    Boolean(activeRequestId) &&
    CANCELLATION_REVIEW_REQUIRED_STATUSES.has(activeRequestStatusValue) &&
    !hasOpenCancellationReview;
  const isAwaitingResidentConfirmation = [
    "work_completed_pending_resident",
    "awaiting_resident_confirmation",
    "awaiting_confirmation",
  ].includes(activeRequestStatusValue);
  const canMessageAssignedProvider =
    Boolean(activeRequestLive?.providerId) &&
    !["cancelled", "completed"].includes(activeRequestStatusValue);
  const canMessageScheduledMaintenance =
    Boolean(activeRequestId) &&
    isScheduledMaintenanceRequest &&
    !["cancelled", "completed"].includes(activeRequestStatusValue);
  const canUseConversationComposer = canMessageAssignedProvider || canMessageScheduledMaintenance;
  const maintenanceScheduledFor = toDate(
    maintenanceContext?.schedule?.scheduledFor || activeRequestLive?.preferredTime,
  );
  const maintenanceScheduledForLabel = maintenanceScheduledFor
    ? maintenanceScheduledFor.toLocaleString(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : "To be confirmed";
  const maintenanceIntroTitle =
    maintenanceContext?.introTitle ||
    maintenanceContext?.title ||
    "Scheduled maintenance";
  const maintenanceIntroBody = [
    maintenanceContext?.plan?.name ? `Plan: ${maintenanceContext.plan.name}.` : "",
    maintenanceContext?.nextStep ? `Next step: ${maintenanceContext.nextStep}.` : "",
  ]
    .filter(Boolean)
    .join(" ");
  const inProgressStartedAt =
    activeRequestStatusValue === "in_progress"
      ? toDate(activeRequestLive?.updatedAt) || toDate(activeRequestLive?.assignedAt)
      : null;
  const inProgressElapsedLabel = formatElapsedDuration(inProgressStartedAt);

  useEffect(() => {
    if (canMessageAssignedProvider && activeRequestId) return;
    stopSelfTyping(activeRequestId);
    clearPeerTypingClearTimer();
    setIsPeerTyping(false);
  }, [activeRequestId, canMessageAssignedProvider, clearPeerTypingClearTimer, stopSelfTyping]);

  useEffect(() => {
    if (!activeRequestId || !canMessageAssignedProvider) return;

    let cancelled = false;
    const syncTypingState = async () => {
      try {
        const typingState = await residentFetch<{
          provider?: boolean;
          admin?: boolean;
        }>(`/api/service-requests/${activeRequestId}/typing`);
        if (cancelled) return;
        setIsPeerTyping(Boolean(typingState?.provider || typingState?.admin));
      } catch {
        if (!cancelled) {
          setIsPeerTyping(false);
        }
      }
    };

    void syncTypingState();
    const interval = window.setInterval(() => {
      void syncTypingState();
    }, 1500);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [activeRequestId, canMessageAssignedProvider]);

  const activeRequestCategoryDisplay =
    activeRequestLive?.categoryLabel || activeRequestLive?.category || selectedCategoryLabel;
  const activeRequestStatusLabel = activeRequestLive?.status
    ? formatServiceRequestStatusLabel(activeRequestLive.status, activeRequestLive?.category || selectedCategoryLabel)
    : "";
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
  const summaryOtherIssueDetailsValue =
    parsedActiveRequestDetails.otherIssueDetails ||
    String(wizardAnswers.issue_other_details || "").trim() ||
    "";
  const summaryProblemTypeDisplay =
    String(summaryProblemTypeValue || "").trim().toLowerCase() === "other" && summaryOtherIssueDetailsValue
      ? `Other - ${summaryOtherIssueDetailsValue}`
      : summaryProblemTypeValue;
  const summaryQuantityValue = parsedActiveRequestDetails.quantity || wizardAnswers.quantity || "Not set";
  const summaryTimeWindowValue =
    parsedActiveRequestDetails.timeWindow || wizardAnswers.time_window || "Not set";
  const summaryAdditionalInformationValue =
    parsedActiveRequestDetails.additionalInformation ||
    parsedActiveRequestDetails.notes ||
    notes.trim() ||
    "Not provided";
  const summaryAttachmentCount =
    parsedActiveRequestDetails.photosCount ?? persistedAttachmentCount ?? attachments.length;
  const consultancyAlreadyBooked = Boolean(activeRequestId) && (
    activeRequestPaymentStatusValue === "paid" ||
    [
      "pending_inspection",
      "assigned",
      "assigned_for_job",
      "in_progress",
      "work_completed_pending_resident",
      "awaiting_resident_confirmation",
      "awaiting_confirmation",
      "disputed",
      "rework_required",
      "completed",
      "cancelled",
    ].includes(
      activeRequestStatusValue,
    )
  );
  const canBookConsultancy = !consultancyAlreadyBooked;
  const summaryItems = [
    {
      label: "Category",
      value: formatCategoryLabel(activeRequestCategoryDisplay) || "Not selected",
      onEdit: () => {
        clearWizardPromptTimer();
        setIsWizardBotThinking(false);
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
      value: summaryProblemTypeDisplay,
      onEdit: () => jumpToWizard("issue_type"),
    },
    ...(String(summaryProblemTypeValue || "").trim().toLowerCase() === "other"
      ? [
          {
            label: "Other issue details",
            value: summaryOtherIssueDetailsValue || "Not provided",
            onEdit: () => jumpToWizard("issue_other_details"),
          },
        ]
      : []),
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
    {
      label: "Additional information",
      value: summaryAdditionalInformationValue,
      onEdit: () => jumpToWizard("notes"),
    },
  ];
  const showWizardInteractiveStep =
    (!activeRequestId || activeRequestStatusValue === "pending") &&
    !isScheduledMaintenanceRequest;
  const isConversationStage = stage === "wizard" || stage === "summary";
  const showInProgressCounter =
    isConversationStage && !showWizardInteractiveStep && activeRequestStatusValue === "in_progress";

  useEffect(() => {
    if (stage === "wizard" && showWizardInteractiveStep) return;
    clearWizardPromptTimer();
    setIsWizardBotThinking(false);
  }, [clearWizardPromptTimer, showWizardInteractiveStep, stage]);

  const providerAvailabilityLabel = canMessageAssignedProvider
    ? "Assigned to this request"
    : isScheduledMaintenanceRequest
      ? "Care brief ready"
      : "Awaiting assignment";
  const providerEtaLabel = assignedProvider?.scheduledAt
    ? `Scheduled ${assignedProvider.scheduledAt.toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })}`
      : isScheduledMaintenanceRequest
        ? `Visit target ${maintenanceScheduledForLabel}`
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
          description: `Job payment for ${formatCategoryLabel(activeRequestCategoryDisplay || "service request")}`,
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
            callbackUrl: `${window.location.origin}/payment-confirmation?source=ordinary&conversationId=${encodeURIComponent(activeRequestId)}&requestId=${encodeURIComponent(activeRequestId)}&serviceRequestId=${encodeURIComponent(activeRequestId)}`,
          },
        },
      );

      const authUrl = init.authorization_url || init.authorizationUrl;
      if (!authUrl) {
        throw new Error("Missing authorization URL from Paystack initialization");
      }

      setPaystackRedirectUrl(authUrl);
      setShowPaystackRedirectModal(true);
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

  const handleSubmitCancellationReview = async () => {
    if (!activeRequestId || requestCancellationReviewMutation.isPending) return;

    const reasonCode = cancelReasonCode.trim();
    const reasonDetail = cancelReasonDetail.trim();
    if (!reasonCode) {
      toast({
        title: "Reason category required",
        description: "Select a reason category before submitting.",
        variant: "destructive",
      });
      return;
    }
    if (reasonDetail.length < 10) {
      toast({
        title: "Add more detail",
        description: "Please provide a clear reason (at least 10 characters).",
        variant: "destructive",
      });
      return;
    }

    await requestCancellationReviewMutation.mutateAsync({
      requestId: activeRequestId,
      reasonCode,
      reasonDetail,
      preferredResolution: cancelPreferredResolution,
    });
  };

  const handleConfirmDelivery = async () => {
    if (!activeRequestId || confirmDeliveryMutation.isPending) return;
    try {
      await confirmDeliveryMutation.mutateAsync({ requestId: activeRequestId });
      setIsConfirmDeliveryDialogOpen(false);
      toast({
        title: "Delivery confirmed",
        description: "This request has been marked as completed.",
      });
    } catch (error: any) {
      toast({
        title: "Could not confirm delivery",
        description: error?.message || "Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleDisputeDelivery = async () => {
    if (!activeRequestId || disputeDeliveryMutation.isPending) return;
    const trimmedReason = raiseIssueReason.trim();
    if (!trimmedReason) return;

    try {
      await disputeDeliveryMutation.mutateAsync({ requestId: activeRequestId, reason: trimmedReason });
      setRaiseIssueReason("");
      setIsRaiseIssueDialogOpen(false);
      toast({
        title: "Issue submitted",
        description: "Your dispute was sent to admin for review.",
      });
    } catch (error: any) {
      toast({
        title: "Could not submit issue",
        description: error?.message || "Please try again.",
        variant: "destructive",
      });
    }
  };

  const openConfirmDeliveryDialog = () => {
    if (!activeRequestId || confirmDeliveryMutation.isPending) return;
    setIsConfirmDeliveryDialogOpen(true);
  };

  const openRaiseIssueDialog = () => {
    if (!activeRequestId || disputeDeliveryMutation.isPending) return;
    setIsRaiseIssueDialogOpen(true);
  };

  const conversationItems = useMemo<ThreadItem[]>(() => {
    const items: ThreadItem[] = [];

    if (isScheduledMaintenanceRequest && maintenanceContext) {
      items.push({
        id: "scheduled-maintenance-context",
        kind: "event",
        title: maintenanceIntroTitle,
        body:
          maintenanceIntroBody ||
          "This request already includes your asset and plan context, so you do not need to start from scratch.",
        scheduleLabel: maintenanceScheduledForLabel,
      });
    }

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

    if (activeRequestStatusValue === "assigned_for_job") {
      const jobTimerScheduleAt =
        toDate(activeRequestLive?.preferredTime) ||
        assignedProvider?.scheduledAt ||
        toDate(activeRequestLive?.assignedAt);
      const jobTimerCountdownRaw = assignedProvider?.countdown || formatCountdown(jobTimerScheduleAt);
      const jobTimerCountdownLabel =
        jobTimerCountdownRaw === "Not scheduled"
          ? "Awaiting agreed date"
          : jobTimerCountdownRaw === "Starting soon"
            ? "Starting soon"
            : `${jobTimerCountdownRaw} remaining`;

      items.push({
        id: "assigned-for-job-timer-event",
        kind: "event",
        title: "Assigned for job timer is active",
        body: jobTimerScheduleAt
          ? "Countdown is running to the agreed job date."
          : "Waiting for the agreed job date to start the countdown.",
        scheduleLabel: jobTimerScheduleAt
          ? jobTimerScheduleAt.toLocaleString(undefined, {
              weekday: "short",
              month: "short",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
            })
          : "Agreed date pending",
        countdownLabel: jobTimerCountdownLabel,
      });
    }

    const deliveryConfirmationItem: ThreadItem | null = isAwaitingResidentConfirmation
      ? {
          id: "delivery-confirmation-card",
          kind: "delivery_confirmation",
          statusLabel: activeRequestStatusLabel || "Awaiting confirmation",
          note: "Provider marked this job as done. Confirm delivery if satisfied or raise an issue for admin review.",
          requestedAt:
            typeof activeRequestLive?.updatedAt === "string"
              ? activeRequestLive.updatedAt
              : activeRequestLive?.updatedAt
                ? new Date(activeRequestLive.updatedAt).toISOString()
                : undefined,
          canConfirm: true,
          onConfirm: openConfirmDeliveryDialog,
          onDispute: openRaiseIssueDialog,
          isConfirming: confirmDeliveryMutation.isPending,
          isDisputing: disputeDeliveryMutation.isPending,
        }
      : null;

    if (activeRequestStatusValue === "disputed") {
      items.push({
        id: "delivery-disputed-event",
        kind: "event",
        title: "Delivery issue under review",
        body: "Your dispute is currently being reviewed by admin.",
      });
    }

    if (activeRequestStatusValue === "rework_required") {
      items.push({
        id: "delivery-rework-event",
        kind: "event",
        title: "Rework approved",
        body: "Admin requested provider rework. Progress updates will continue in this chat.",
      });
    }

    if (!showWizardInteractiveStep) {
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
    }


    const shouldShowProviderDivider = Boolean(assignedProvider && orderedServiceMessages.length > 0);
    if (shouldShowProviderDivider) {
      items.push({
        id: "provider-chat-divider",
        kind: "divider",
        text: "Conversation with your provider",
      });
    }

    orderedServiceMessages.forEach((message) => {
      const consultancyReport = parseConsultancyReportMessage(message.message);
      if (consultancyReport) {
        items.push({
          id: `consultancy-report-${message.id}`,
          kind: "consultancy_report",
          inspectionDate: consultancyReport.inspectionDate,
          completionDeadline: consultancyReport.completionDeadline || activeConsultancyReport?.completionDeadline || undefined,
          actualIssue: consultancyReport.actualIssue,
          causeOfIssue: consultancyReport.causeOfIssue,
          materialCostLabel: consultancyReport.materialCostLabel,
          serviceCostLabel: consultancyReport.serviceCostLabel,
          preventiveRecommendation: consultancyReport.preventiveRecommendation,
          evidenceUrls: activeConsultancyReport?.evidence || [],
          evidenceCount: consultancyReport.evidenceCount,
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
            activeConsultancyReport.completionDeadline
              ? `Completion deadline: ${new Date(activeConsultancyReport.completionDeadline).toLocaleString()}`
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
            activeConsultancyReport.evidence?.length
              ? `Evidence attachments: ${activeConsultancyReport.evidence.length}`
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

    // Keep delivery confirmation CTA near the latest thread content.
    if (deliveryConfirmationItem) {
      items.push(deliveryConfirmationItem);
    }

    return items;
  }, [
    activeRequestLive?.billedAmount,
    activeRequestLive?.assignedAt,
    activeRequestLive?.updatedAt,
    isScheduledMaintenanceRequest,
    maintenanceContext,
    maintenanceIntroBody,
    maintenanceIntroTitle,
    maintenanceScheduledForLabel,
    activeConsultancyReport,
    activeRequestLive?.preferredTime,
    activeRequestLive?.paymentRequestedAt,
    activeRequestStatusLabel,
    activeRequestStatusValue,
    assignedProvider,
    canPayJobRequest,
    confirmDeliveryMutation.isPending,
    declineJobPaymentMutation.isPending,
    disputeDeliveryMutation.isPending,
    handleDeclineRequestedPayment,
    openConfirmDeliveryDialog,
    openRaiseIssueDialog,
    handlePayRequestedJob,
    hasJobPaymentRequest,
    historyBlocks,
    isAwaitingResidentConfirmation,
    isStartingJobPayment,
    orderedServiceMessages,
    paymentCardStatusLabel,
    showWizardInteractiveStep,
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
    stopSelfTyping(activeRequestId);

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
    if (!isConversationStage) return;
    const container = chatScrollContainerRef.current;
    if (!container) return;
    const sessionKey = activeRequestId || "draft";
    const isFirstForSession = lastAutoScrollSessionRef.current !== sessionKey;
    lastAutoScrollSessionRef.current = sessionKey;
    const frame = window.requestAnimationFrame(() => {
      container.scrollTo({
        top: container.scrollHeight,
        behavior: isFirstForSession ? "auto" : "smooth",
      });
      chatBottomRef.current?.scrollIntoView({
        behavior: isFirstForSession ? "auto" : "smooth",
        block: "end",
      });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [
    activeRequestId,
    isConversationStage,
    canMessageAssignedProvider,
    conversationItems.length,
    historyBlocks.length,
    showWizardInteractiveStep,
  ]);

  useEffect(() => {
    if (!isConversationStage || !showWizardInteractiveStep) return;
    const container = wizardInteractiveScrollRef.current;
    if (!container) return;

    const frame = window.requestAnimationFrame(() => {
      latestWizardPromptRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      container.scrollTo({
        top: container.scrollHeight,
        behavior: "smooth",
      });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [
    currentStep?.id,
    historyBlocks.length,
    isConversationStage,
    isWizardBotThinking,
    showWizardInteractiveStep,
    wizardIndex,
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
        <div
          className={cn(
            "flex h-full min-w-0 flex-1 flex-col overflow-hidden rounded-l-[40px]",
            stage === "intake"
              ? "bg-[#F2F4F7]"
              : "border border-[#E4E7EC]/60 bg-[#F8FAFC] shadow-[inset_0_1px_0_rgba(255,255,255,0.4)]",
          )}
        >
          {stage !== "intake" ? (
            <>
              <div className="border-b border-[#EAECF0] bg-white px-4 py-3 sm:px-6 lg:px-10">
                <div className="mx-auto flex max-w-[1100px] flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0 flex items-center gap-3">
                    <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[#D0D5DD] bg-[#F9FAFB] text-[12px] font-semibold text-[#344054]">
                      R
                    </span>
                    <p className="truncate text-[16px] font-semibold text-[#101828]">
                      {selectedCategoryLabel
                        ? `You selected ${formatCategoryLabel(selectedCategoryLabel)}.`
                        : "Select a category to continue."}
                    </p>
                  </div>

                  {isConversationStage ? (
                    showWizardInteractiveStep ? (
                      <div className="flex items-center gap-4 text-[14px] font-semibold">
                        <button
                          type="button"
                          onClick={handleCancelRequest}
                          className="text-[#667085] transition hover:text-[#344054]"
                        >
                          Cancel Request
                        </button>
                        <button
                          type="button"
                          onClick={handleChangeCategory}
                          className="text-[#027A48] transition hover:text-[#039855]"
                        >
                          Change category
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        {showInProgressCounter ? (
                          <div
                            className="inline-flex h-8 items-center rounded-full border border-[#12B76A]/30 bg-[#ECFDF3] px-3 text-[12px] font-semibold text-[#027A48]"
                            title={
                              inProgressStartedAt
                                ? `Tracking since ${inProgressStartedAt.toLocaleString()}`
                                : "Tracking in-progress duration"
                            }
                          >
                            In progress: {inProgressElapsedLabel}
                          </div>
                        ) : null}
                        {activeRequestId && !["cancelled"].includes(activeRequestStatusValue) ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-8 rounded-full border-[#D0D5DD] bg-white px-3 text-[13px] font-semibold text-[#344054] hover:bg-[#F9FAFB]"
                            onClick={handleCancelRequest}
                            disabled={requestCancellationReviewMutation.isPending}
                          >
                            {hasOpenCancellationReview ? "Cancellation under review" : "Cancel Request"}
                          </Button>
                        ) : null}
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8 rounded-full border-[#D0D5DD] bg-white px-3 text-[13px] font-semibold text-[#344054] hover:bg-[#F9FAFB]"
                          onClick={() => setIsProviderDetailsCollapsed((prev) => !prev)}
                          aria-label={isProviderDetailsCollapsed ? "Show provider details" : "Hide provider details"}
                        >
                          {isProviderDetailsCollapsed ? "Show Provider Details" : "Hide Provider Details"}
                        </Button>
                      </div>
                    )
                  ) : null}
                </div>
              </div>

              {isConversationStage && !showWizardInteractiveStep ? (
                <div>
                  {!isProviderDetailsCollapsed ? (
                    <ProviderHeader
                      providerName={providerDisplayName}
                      providerRole={
                        assignedProvider?.role ||
                        (isScheduledMaintenanceRequest ? "Maintenance coordinator" : "Service coordinator")
                      }
                      availabilityLabel={providerAvailabilityLabel}
                      etaLabel={providerEtaLabel}
                      coverageLabel={
                        maintenanceContext?.asset?.locationLabel ||
                        maintenanceContext?.asset?.label ||
                        intakeLocationLabel()
                      }
                      onReviewSummary={openJobSummary}
                    />
                  ) : null}
                  <RequestProgressTracker
                    status={activeRequestLive?.status || (activeRequestId ? "pending" : "draft")}
                    collapsed={isProgressTrackerCollapsed}
                    onToggleCollapsed={() => setIsProgressTrackerCollapsed((prev) => !prev)}
                  />
                </div>
              ) : null}
            </>
          ) : null}

          <div className="min-h-0 flex-1 overflow-hidden">

          {stage === "intake" ? (
            <div className="h-full overflow-y-auto">
              <MainWrapSelectCategory
                searchQuery={categorySelectSearch}
                setSearchQuery={setCategorySelectSearch}
                onCategorySelect={handleSelectCategoryFromGrid}
                categoriesData={categories}
                catsLoading={categoriesLoading}
              />
            </div>
          ) : null}

          {isConversationStage ? (
            <div className="mx-auto flex h-full max-w-[1100px] min-h-0 w-full flex-col gap-1.5 px-4 sm:px-6 lg:px-10 pb-2 pt-1.5">
              <div className="flex min-h-0 flex-1 flex-col">
                    {isScheduledMaintenanceRequest && maintenanceContext ? (
                      <div className="mb-2 shrink-0">
                        <MaintenanceContextCard
                          title={maintenanceIntroTitle}
                          assetLabel={maintenanceContext.asset?.label || "Protected asset"}
                          itemTypeLabel={maintenanceContext.asset?.itemTypeName || "Maintenance asset"}
                          locationLabel={maintenanceContext.asset?.locationLabel || null}
                          conditionLabel={formatMaintenanceConditionLabel(
                            maintenanceContext.asset?.condition || null,
                          )}
                          planName={maintenanceContext.plan?.name || "Maintenance plan"}
                          durationLabel={formatMaintenanceDurationLabel(
                            maintenanceContext.plan?.durationType || null,
                          )}
                          scheduledForLabel={maintenanceScheduledForLabel}
                          nextStep={
                            maintenanceContext.nextStep ||
                            "Confirm preferred time and access instructions"
                          }
                          includedTasks={maintenanceContext.plan?.includedTasks || []}
                        />
                      </div>
                    ) : null}
                    <div
                      ref={chatScrollContainerRef}
                      className={cn(
                        "city-scrollbar overflow-y-auto overscroll-contain px-1 pb-2 pr-2 scroll-smooth",
                        shouldPrioritizeInteractiveStep ? "hidden" : "min-h-0 flex-1",
                      )}
                    >
                      {conversationItems.length > 0 ? (
                        <ChatThread items={conversationItems} />
                      ) : (
                        <SystemMessage text="Conversation starts once the first response is captured." />
                      )}
                      {isPeerTyping && canMessageAssignedProvider ? (
                        <TypingPresenceIndicator label={`${providerDisplayName} is typing...`} className="mt-2" />
                      ) : null}
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
                          ref={wizardInteractiveScrollRef}
                          className={cn(
                            "space-y-4 pr-1",
                            shouldPrioritizeInteractiveStep
                              ? "city-scrollbar h-full min-h-0 overflow-y-auto"
                              : "city-scrollbar max-h-[32vh] overflow-y-auto",
                          )}
                        >
                        {showWizardInteractiveStep ? (
                          <div className="space-y-3">
                            {historyBlocks.map((block, idx) => (
                              <div key={`wizard-history-${idx}`} className="space-y-2.5">
                                <ChatPrompt text={block.prompt} status="answered" />
                                <WizardAnswerBubble text={block.answer} />
                                {block.kind === "photos" && attachments.length > 0 ? (
                                  <div className="flex justify-end">
                                    <div className="grid max-w-[260px] grid-cols-3 gap-2">
                                      {attachments.map((file) => (
                                        <div
                                          key={`history-photo-${file.id}`}
                                          className="relative overflow-hidden rounded-lg border border-[#D0D5DD] bg-white"
                                        >
                                          <button
                                            type="button"
                                            className="block w-full"
                                            onClick={() => setPreviewAttachment({ name: file.name, url: file.dataUrl })}
                                          >
                                            <img
                                              src={file.dataUrl}
                                              alt={file.name}
                                              className="h-16 w-full object-cover"
                                            />
                                          </button>
                                          <button
                                            type="button"
                                            aria-label={`Remove ${file.name}`}
                                            className="absolute right-1 top-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-black/70 text-[11px] font-semibold text-white transition hover:bg-black"
                                            onClick={(event) => {
                                              event.preventDefault();
                                              event.stopPropagation();
                                              handleRemoveAttachment(file.id);
                                            }}
                                          >
                                            x
                                          </button>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                ) : null}
                              </div>
                            ))}
                          </div>
                        ) : null}

                        {isWizardBotThinking ? (
                          <WizardTypingIndicator />
                        ) : (
                          <>
                            <div ref={latestWizardPromptRef}>
                              <ChatPrompt text={currentStep.prompt} />
                            </div>
                        {currentStep.kind === "location" ? (
                          <div className="space-y-3">
                            <div className="rounded-2xl border border-[#EAECF0] bg-[#f9fafb] p-4 space-y-3">
                              <div className="flex flex-wrap gap-2">
                                <ChipButton
                                  label="Yes"
                                  selected={hasConfirmedEstateResidence && estateResidenceMode === "estate"}
                                  selectedClassName="border-[#039855] bg-[#ECFDF3] text-[#027A48]"
                                  onClick={() => {
                                    setHasConfirmedEstateResidence(true);
                                    setEstateResidenceMode("estate");
                                    setResidentState("");
                                    setResidentLga("");
                                    focusNextLocationField("estate");
                                  }}
                                />
                                <ChipButton
                                  label="No"
                                  selected={hasConfirmedEstateResidence && estateResidenceMode === "outside"}
                                  selectedClassName="border-[#039855] bg-[#ECFDF3] text-[#027A48]"
                                  onClick={() => {
                                    setHasConfirmedEstateResidence(true);
                                    setEstateResidenceMode("outside");
                                    setEstateName("");
                                    setUnit("");
                                    focusNextLocationField("outside");
                                  }}
                                />
                              </div>
                            </div>

                            {hasConfirmedEstateResidence ? (
                              <>
                                <ChatPrompt
                                  text={estateResidenceMode === "outside" ? "Select state/LGA" : "Select your estate"}
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
                                          <SelectTrigger ref={stateSelectTriggerRef} className="w-full bg-white">
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
                                          onValueChange={(value) => {
                                            setResidentLga(value);
                                            focusAddressField();
                                          }}
                                          disabled={!residentState}
                                        >
                                          <SelectTrigger ref={stateSelectTriggerRef} className="w-full bg-white">
                                            <SelectValue
                                              placeholder={residentState ? "Select LGA" : "Select state first"}
                                            />
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
                                    </div>
                                  ) : (
                                    <>
                                      <input
                                        ref={estateSearchInputRef}
                                        value={estateSearch}
                                        onChange={(event) => setEstateSearch(event.target.value)}
                                        placeholder="Search estate"
                                        className="w-full rounded-xl border border-[#D0D5DD] bg-white px-3 py-2 text-sm"
                                      />
                                      <div className="flex flex-wrap gap-2">
                                        {estatesLoading ? (
                                          <p className="text-sm text-[#667085]">Loading estates...</p>
                                        ) : filteredEstates.length > 0 ? (
                                          filteredEstates.slice(0, 8).map((estate) => (
                                            <button
                                              key={estate.id}
                                              type="button"
                                              onClick={() => {
                                                setEstateResidenceMode("estate");
                                                setEstateName(estate.name);
                                                setResidentState("");
                                                setResidentLga("");
                                                focusAddressField();
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
                                          ))
                                        ) : (
                                          <p className="text-sm text-[#667085]">
                                            {estatesError
                                              ? "Could not load estates. Try refreshing."
                                              : estateSearch.trim()
                                                ? "No estates match your search."
                                                : "No estates available."}
                                          </p>
                                        )}
                                      </div>
                                    </>
                                  )}
                                </div>
                                {(estateResidenceMode === "outside"
                                  ? Boolean(residentState && residentLga)
                                  : Boolean(estateName)) ? (
                                  <>
                                    <ChatPrompt
                                      text={
                                        estateResidenceMode === "outside"
                                          ? "Enter your address."
                                          : "Enter your address/unit."
                                      }
                                    />
                                    <div ref={addressSectionRef} className="rounded-2xl border border-[#EAECF0] bg-[#f9fafb] p-4 space-y-3">
                                      {estateResidenceMode === "outside" ? (
                                        <div>
                                          <p className="text-[12px] text-[#667085] mb-2">Address</p>
                                          <textarea
                                            ref={addressTextareaRef}
                                            value={address}
                                            onChange={(e) => setAddress(e.target.value)}
                                            placeholder="Enter your address"
                                            className="min-h-[110px] w-full rounded-xl border border-[#D0D5DD] bg-white px-3 py-2 text-sm"
                                          />
                                        </div>
                                      ) : (
                                        <div className="space-y-3">
                                          <div>
                                            <p className="text-[12px] text-[#667085] mb-2">Address</p>
                                            <textarea
                                              ref={addressTextareaRef}
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
                                  </>
                                ) : null}
                              </>
                            ) : null}
                            {locationMissingHint ? (
                              <p className="text-[13px] text-[#667085]">{locationMissingHint}</p>
                            ) : null}
                            <div className="flex justify-start">
                              <Button
                                variant="outline"
                                className="rounded-full"
                                disabled={!isLocationComplete || isWizardBotThinking}
                                onClick={async () => {
                                  if (isWizardBotThinking || !isLocationComplete) return;
                                  if (isDynamicFlowCategory && dynamicFlowSession && !dynamicFlowFallback) {
                                    const locationPayload =
                                      estateResidenceMode === "outside"
                                        ? {
                                            estateMode: "outside",
                                            state: residentState,
                                            lga: residentLga,
                                            address: address.trim(),
                                            unit: unit.trim() || null,
                                          }
                                        : {
                                            estateMode: "estate",
                                            estateName,
                                            address: address.trim(),
                                            unit: unit.trim() || null,
                                          };
                                    setWizardAnswers((prev) => ({ ...prev, [currentStep.id]: intakeLocationLabel() }));
                                    await submitDynamicAnswer(currentStep.id, locationPayload);
                                    return;
                                  }
                                  setWizardAnswers((prev) => ({ ...prev, [currentStep.id]: intakeLocationLabel() }));
                                  const nextIndex = Math.min(wizardIndex + 1, wizardSteps.length - 1);
                                  commitLegacyStepAdvance(nextIndex);
                                }}
                              >
                                Add location
                              </Button>
                            </div>
                          </div>
                        ) : null}
                        {currentStep.kind === "chips" ? (
                          currentStep.id === "urgency" ? (
                            <div className="rounded-2xl border border-[#E4E7EC] bg-[#F2F4F7] p-4">
                              <div className="flex flex-wrap gap-3">
                                {URGENCY_OPTIONS.map((opt) => {
                                  const selected = wizardAnswers[currentStep.id] === opt.label;
                                  return (
                                    <button
                                      key={opt.value}
                                      type="button"
                                      onClick={() => handleSelectChip(currentStep.id, opt.label)}
                                      className={cn(
                                        "flex min-w-[124px] items-center gap-3 rounded-2xl border px-4 py-3 text-left transition",
                                        selected
                                          ? "border-[#039855] bg-white shadow-sm"
                                          : "border-[#D0D5DD] bg-white hover:border-[#98A2B3]",
                                      )}
                                    >
                                      <UrgencyIcon value={opt.value} />
                                      <span className="space-y-0.5">
                                        <span className="block text-[16px] font-semibold leading-[20px] text-[#101828]">
                                          {opt.label}
                                        </span>
                                        <span className="block text-[11px] leading-[14px] text-[#667085]">
                                          {opt.timeframe}
                                        </span>
                                      </span>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          ) : (
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
                          )
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
                              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                                {attachments.map((file) => (
                                  <div key={file.id} className="space-y-1.5">
                                    <div className="relative overflow-hidden rounded-xl border border-[#D0D5DD] bg-white">
                                      <button
                                        type="button"
                                        className="block w-full"
                                        onClick={() => setPreviewAttachment({ name: file.name, url: file.dataUrl })}
                                      >
                                        <img src={file.dataUrl} alt={file.name} className="h-24 w-full object-cover" />
                                      </button>
                                      <button
                                        type="button"
                                        aria-label={`Remove ${file.name}`}
                                        className="absolute right-1.5 top-1.5 inline-flex h-6 w-6 items-center justify-center rounded-full bg-black/70 text-sm font-semibold text-white transition hover:bg-black"
                                        onClick={(event) => {
                                          event.preventDefault();
                                          event.stopPropagation();
                                          handleRemoveAttachment(file.id);
                                        }}
                                      >
                                        x
                                      </button>
                                    </div>
                                    <p className="truncate text-[11px] text-[#475467]" title={file.name}>
                                      {file.name}
                                    </p>
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
                                  disabled={isWizardBotThinking}
                                  onClick={async () => {
                                    if (isWizardBotThinking) return;
                                    if (
                                      isDynamicFlowCategory &&
                                      dynamicFlowSession &&
                                      !dynamicFlowFallback &&
                                      isDynamicBackendStep(currentStep.id)
                                    ) {
                                      await submitDynamicAnswer(currentStep.id, { files: [] });
                                      return;
                                    }
                                    setLocalWrapUpCompleted((prev) => ({ ...prev, [currentStep.id]: true }));
                                    if (wizardIndex >= wizardSteps.length - 1) {
                                      openJobSummary();
                                      return;
                                    }
                                    const nextIndex = Math.min(wizardIndex + 1, wizardSteps.length - 1);
                                    queueWizardStepAdvance(nextIndex);
                                  }}
                                >
                                  Skip for now
                                </Button>
                              ) : null}
                              <Button
                                disabled={isWizardBotThinking}
                                onClick={async () => {
                                  if (isWizardBotThinking) return;
                                  if (currentStep.required && attachments.length === 0) return;
                                  if (
                                    isDynamicFlowCategory &&
                                    dynamicFlowSession &&
                                    !dynamicFlowFallback &&
                                    isDynamicBackendStep(currentStep.id)
                                  ) {
                                    const files = attachments.map((file) => {
                                      const mimeMatch = String(file.dataUrl || "").match(/^data:([^;]+);/i);
                                      return {
                                        dataUrl: file.dataUrl,
                                        mimeType: mimeMatch?.[1] || "image/*",
                                        byteSize: Math.round((file.dataUrl.length * 3) / 4),
                                      };
                                    });
                                    setPersistedAttachmentCount(files.length);
                                    await submitDynamicAnswer(currentStep.id, { files });
                                    return;
                                  }
                                  setLocalWrapUpCompleted((prev) => ({ ...prev, [currentStep.id]: true }));
                                  if (wizardIndex >= wizardSteps.length - 1) {
                                    openJobSummary();
                                    return;
                                  }
                                  const nextIndex = Math.min(wizardIndex + 1, wizardSteps.length - 1);
                                  queueWizardStepAdvance(nextIndex);
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
                              value={
                                currentStep.id === "notes"
                                  ? notes
                                  : String(wizardAnswers[currentStep.id] || "")
                              }
                              onChange={(event) => {
                                if (currentStep.id === "notes") {
                                  setNotes(event.target.value);
                                  return;
                                }
                                setWizardAnswers((prev) => ({
                                  ...prev,
                                  [currentStep.id]: event.target.value,
                                }));
                              }}
                              placeholder={currentStep.placeholder}
                              className="min-h-[120px] w-full rounded-xl border border-[#D0D5DD] px-3 py-2 text-sm"
                            />
                            <div className="flex justify-start">
                              <Button variant="outline" onClick={handleFinishNotes}>
                                {wizardIndex >= wizardSteps.length - 1 ? "Continue to summary" : "Next"}
                              </Button>
                            </div>
                          </div>
                        ) : null}
                          </>
                        )}
                        </div>
                      </div>
                    ) : null}
              </div>

            </div>
          ) : null}

          </div>
          {isConversationStage ? (
            canUseConversationComposer ? (
              <MessageComposer
                variant="citybuddy"
                label={
                  canMessageAssignedProvider
                    ? `Message ${providerDisplayName}`
                    : "Share preferred time and access notes"
                }
                value={residentMessageDraft}
                onChange={handleResidentComposerChange}
                onSend={handleSendComposerMessage}
                isSending={sendResidentMessageMutation.isPending}
                attachments={composerAttachments}
                onAttachFiles={handleComposerAttachFiles}
                onRemoveAttachment={handleRemoveComposerAttachment}
                onShareLocation={handleShareLocationToComposer}
                placeholder={
                  canMessageAssignedProvider
                    ? undefined
                    : "Share your preferred time, gate or access instructions, and anything the maintenance provider should know."
                }
              />
            ) : (
              <div className="border-t border-[#EAECF0] bg-white px-5 py-2.5">
                <div className="mx-auto max-w-[1100px] rounded-xl border border-[#EAECF0] bg-[#F9FAFB] p-2.5">
                  <p className="text-xs text-[#475467]">
                    Your provider has not been assigned yet. Chat opens immediately once assignment happens.
                  </p>
                </div>
              </div>
            )
          ) : null}
        </div>
      </div>

      <Dialog open={isCategoryRequiredDialogOpen} onOpenChange={setIsCategoryRequiredDialogOpen}>
        <DialogContent className="sm:max-w-[460px]">
          <DialogHeader>
            <DialogTitle>Select category first</DialogTitle>
            <DialogDescription>
              You need to select a service category before booking for consultancy.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCategoryRequiredDialogOpen(false)}>
              Continue editing
            </Button>
            <Button onClick={handleOpenCategorySelectionFromModal}>Select category</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isCancelRequestDialogOpen}
        onOpenChange={(open) => {
          if (!open && !requestCancellationReviewMutation.isPending) {
            setCancelReasonCode("");
            setCancelReasonDetail("");
            setCancelPreferredResolution("full_refund");
          }
          setIsCancelRequestDialogOpen(open);
        }}
      >
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle>Request cancellation review</DialogTitle>
            <DialogDescription>
              This request is already assigned/active. Tell us why you want to cancel so admin can review and decide.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-1">
              <p className="text-sm font-medium text-[#101828]">Reason category</p>
              <Select value={cancelReasonCode} onValueChange={setCancelReasonCode}>
                <SelectTrigger>
                  <SelectValue placeholder="Select reason" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="wrong_provider">Wrong provider assigned</SelectItem>
                  <SelectItem value="quality_concern">Quality concern</SelectItem>
                  <SelectItem value="delay_no_show">Delay or no-show</SelectItem>
                  <SelectItem value="pricing_dispute">Pricing dispute</SelectItem>
                  <SelectItem value="safety_issue">Safety issue</SelectItem>
                  <SelectItem value="duplicate_request">Duplicate request</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <p className="text-sm font-medium text-[#101828]">Details</p>
              <textarea
                value={cancelReasonDetail}
                onChange={(event) => setCancelReasonDetail(event.target.value)}
                placeholder="Explain what happened and why cancellation is needed."
                className="min-h-[120px] w-full rounded-xl border border-[#D0D5DD] px-3 py-2 text-sm text-[#344054]"
              />
            </div>

            <div className="space-y-1">
              <p className="text-sm font-medium text-[#101828]">Preferred resolution</p>
              <Select
                value={cancelPreferredResolution}
                onValueChange={(value: "full_refund" | "partial_refund" | "cancel_without_refund") =>
                  setCancelPreferredResolution(value)
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="full_refund">Full refund</SelectItem>
                  <SelectItem value="partial_refund">Partial refund</SelectItem>
                  <SelectItem value="cancel_without_refund">Cancel without refund</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsCancelRequestDialogOpen(false)}
              disabled={requestCancellationReviewMutation.isPending}
            >
              Close
            </Button>
            <Button
              onClick={handleSubmitCancellationReview}
              disabled={requestCancellationReviewMutation.isPending}
            >
              {requestCancellationReviewMutation.isPending ? "Submitting..." : "Submit for admin review"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isConfirmDeliveryDialogOpen} onOpenChange={setIsConfirmDeliveryDialogOpen}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle>Confirm job delivery</DialogTitle>
            <DialogDescription>
              Confirm that this job was delivered satisfactorily. This will mark the request as completed.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsConfirmDeliveryDialogOpen(false)}
              disabled={confirmDeliveryMutation.isPending}
            >
              Cancel
            </Button>
            <Button onClick={handleConfirmDelivery} disabled={confirmDeliveryMutation.isPending}>
              {confirmDeliveryMutation.isPending ? "Confirming..." : "Confirm delivery"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isRaiseIssueDialogOpen}
        onOpenChange={(open) => {
          setIsRaiseIssueDialogOpen(open);
          if (!open && !disputeDeliveryMutation.isPending) {
            setRaiseIssueReason("");
          }
        }}
      >
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>Raise delivery issue</DialogTitle>
            <DialogDescription>
              Tell admin what should be reviewed before this request can be completed.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <p className="text-sm font-medium text-[#344054]">Issue details</p>
            <textarea
              value={raiseIssueReason}
              onChange={(event) => setRaiseIssueReason(event.target.value)}
              placeholder="Describe what is incomplete or incorrect."
              className="min-h-[120px] w-full rounded-xl border border-[#D0D5DD] px-3 py-2 text-sm"
              disabled={disputeDeliveryMutation.isPending}
            />
            <p className="text-xs text-[#667085]">Required to submit dispute.</p>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                if (disputeDeliveryMutation.isPending) return;
                setIsRaiseIssueDialogOpen(false);
                setRaiseIssueReason("");
              }}
              disabled={disputeDeliveryMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={handleDisputeDelivery}
              disabled={disputeDeliveryMutation.isPending || raiseIssueReason.trim().length === 0}
            >
              {disputeDeliveryMutation.isPending ? "Submitting..." : "Submit issue"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
            onClick={returnToWizardFromSummary}
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
                <Button variant="ghost" size="sm" onClick={returnToWizardFromSummary}>
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

              <div className="rounded-2xl border border-[#D1FADF] bg-[#ECFDF3] p-4 space-y-1.5">
                <p className="text-[14px] font-semibold text-[#027A48]">Why consultancy comes first</p>
                <p className="text-[13px] leading-[20px] text-[#065F46]">
                  CityConnect policy requires a consultancy inspection before job execution so scope, safety checks,
                  timeline, and cost are verified before provider dispatch.
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
                        {formatCategoryLabel(activeRequestCategoryDisplay || "General Provider")}
                      </p>
                      <p className="text-[12px] text-[#667085]">
                        Issue: {summaryProblemTypeDisplay}
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
                    {[summaryQuantityValue, summaryUrgencyValue, summaryProblemTypeDisplay]
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
                    <Button variant="outline" onClick={returnToWizardFromSummary}>
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
                <Button variant="outline" onClick={returnToWizardFromSummary}>
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

      <Dialog
        open={Boolean(previewAttachment)}
        onOpenChange={(open) => {
          if (!open) setPreviewAttachment(null);
        }}
      >
        <DialogContent className="max-w-[720px]">
          <DialogHeader>
            <DialogTitle>{previewAttachment?.name || "Attachment preview"}</DialogTitle>
            <DialogDescription>Preview uploaded image.</DialogDescription>
          </DialogHeader>
          {previewAttachment?.url ? (
            <div className="overflow-hidden rounded-xl border border-[#EAECF0]">
              <img
                src={previewAttachment.url}
                alt={previewAttachment.name || "Uploaded attachment"}
                className="max-h-[70vh] w-full object-contain bg-[#F9FAFB]"
              />
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <PaystackRedirectDialog
        open={showPaystackRedirectModal}
        redirectUrl={paystackRedirectUrl}
        onOpenChange={(open) => {
          setShowPaystackRedirectModal(open);
          if (!open) {
            setPaystackRedirectUrl(null);
            setIsStartingJobPayment(false);
          }
        }}
      />
    </div>
  );
}



