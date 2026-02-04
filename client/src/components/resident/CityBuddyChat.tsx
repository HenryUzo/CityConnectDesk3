import {
  useEffect,
  useState,
  useCallback,
  useMemo,
  useRef,
  type ReactNode,
  type RefObject,
} from "react";
import { useQuery } from "@tanstack/react-query";
import { svgPaths, AIAskBotIcon, UploadItem } from "@/components/ui/icon";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import {
  appendMessage,
  fetchConversations,
  fetchMessages,
  getOrCreateConversation,
  type ConversationMessage,
} from "@/lib/conversations";
import useCategories from "@/hooks/useCategories";
import { useAiConversationFlowSettings, buildCategoryMappings, type AiConversationFlowSetting } from "@/hooks/useAiConversationFlowSettings";
import CategorySkeleton from "@/components/ui/CategorySkeleton";
import { CategoryStatus, AIMessage, AIThinking, UserResponse, TicketMessage, formatTicketStatusLabel, buildProgressSteps } from "./CityBuddyMessage";
import {
  sendMessageToGemini,
  type CityBuddyAiResponse,
  type ChatMessage,
  type InlineImagePart,
} from "@/lib/citybuddy-gemini";
import { classifyCityBuddySituation } from "./citybuddySituation";
import { OutlineButton, SecButton } from "@/components/ui/buttons";
import { useAuth } from "@/hooks/use-auth";
import imgAvatar from "@/assets/avatars/7d14a8788ee6c5268d3404f8441329ce18972f60.png";
import imgAvatarCategory1 from "@/assets/categories/3f07877ff8aee95e57f4099fd99b093daed93bda.png";
import imgAvatarCategory2 from "@/assets/categories/feadbeeb812fbad9e5b2fa5b92cbb3cee02777e3.png";
import imgAvatarCategory3 from "@/assets/categories/d079ff17bdc5e51dc526bdf045274e8bc1678991.png";
import Nav from "@/components/layout/Nav";
import ProviderComparison, { ProviderComparisonItem } from "@/components/resident/ProviderComparison";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/NewSelectUi/src/components/ui/alert-dialog";
import MobileNavDrawer from "@/components/layout/MobileNavDrawer";
import {
  isUrgentOrDistressed,
} from "./citybuddyIntake";

import { useMyEstates } from "@/hooks/useMyEstates";
import { useToast } from "@/hooks/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";

type ConversationStep =
  | "FLOW"
  | "THINKING"
  | "AI_ANALYSING"
  | "AI_GUIDANCE";

type StepInputMode = "tags" | "dropdown" | "datetime" | "upload" | "none";

type StepOption = {
  value: string;
  label: string;
};

type StepConfig = {
  id: string;
  message: string;
  inputMode: StepInputMode;
  options?: StepOption[];
  allowManualInput: boolean;
  placeholder?: string;
  slotKey?: keyof InfoSlots;
};

type InfoSlots = {
  description: boolean;
  location: boolean;
  timing: boolean;
  urgency: boolean;
  imageProvided: boolean;
};

const INITIAL_INFO_SLOTS: InfoSlots = {
  description: false,
  location: false,
  timing: false,
  urgency: false,
  imageProvided: false,
};

// Dynamic category key - now accepts any string from the database
type ServiceCategoryKey = string;

// Fallback mappings - will be overridden by database settings when available
const DEFAULT_CATEGORY_TITLE_TO_KEY: Record<string, string> = {
  "Surveillance monitoring": "surveillance_monitoring",
  "Cleaning & janitorial": "cleaning_janitorial",
  "Catering Services": "catering_services",
  "IT Support": "it_support",
  "Maintenance & Repair": "maintenance_repair",
  "Marketing & Advertising": "marketing_advertising",
  "Home tutors": "home_tutors",
  "Furniture making": "furniture_making",
  "Store Owner": "store_owner",
  "Market Runner": "market_runner",
  "Item Vendor": "item_vendor",
  "Alarm System": "alarm_system",
  "Packaging Solutions": "packaging_solutions",
};

const DEFAULT_CONFIDENCE_THRESHOLDS: Record<string, number> = {
  cleaning_janitorial: 70,
  maintenance_repair: 75,
  it_support: 70,
  surveillance_monitoring: 80,
  catering_services: 65,
  marketing_advertising: 65,
  home_tutors: 70,
  furniture_making: 80,
  store_owner: 65,
  market_runner: 60,
  item_vendor: 65,
  alarm_system: 75,
  packaging_solutions: 65,
};

const DEFAULT_CATEGORY_VISUALS_HELPFUL: Record<string, boolean> = {
  surveillance_monitoring: true,
  cleaning_janitorial: true,
  catering_services: false,
  it_support: false,
  maintenance_repair: true,
  marketing_advertising: false,
  home_tutors: false,
  furniture_making: true,
  store_owner: false,
  market_runner: false,
  item_vendor: true,
  alarm_system: true,
  packaging_solutions: false,
};

// Dynamic context for category settings - will be populated from the hook
let DYNAMIC_CATEGORY_TITLE_TO_KEY: Record<string, string> = { ...DEFAULT_CATEGORY_TITLE_TO_KEY };
let DYNAMIC_CONFIDENCE_THRESHOLDS: Record<string, number> = { ...DEFAULT_CONFIDENCE_THRESHOLDS };
let DYNAMIC_CATEGORY_VISUALS_HELPFUL: Record<string, boolean> = { ...DEFAULT_CATEGORY_VISUALS_HELPFUL };
let DYNAMIC_INITIAL_MESSAGES: Record<string, string | null> = {};
let DYNAMIC_FOLLOW_UP_STEPS: Record<string, any[] | null> = {};

// Setter function to update dynamic mappings from the hook
function updateDynamicCategoryMappings(settings: AiConversationFlowSetting[]) {
  if (!settings || settings.length === 0) return;
  
  const mappings = buildCategoryMappings(settings);
  DYNAMIC_CATEGORY_TITLE_TO_KEY = { ...DEFAULT_CATEGORY_TITLE_TO_KEY, ...mappings.titleToKey };
  DYNAMIC_CONFIDENCE_THRESHOLDS = { ...DEFAULT_CONFIDENCE_THRESHOLDS, ...mappings.confidenceThresholds };
  DYNAMIC_CATEGORY_VISUALS_HELPFUL = { ...DEFAULT_CATEGORY_VISUALS_HELPFUL, ...mappings.visualsHelpful };
  DYNAMIC_INITIAL_MESSAGES = mappings.initialMessages;
  DYNAMIC_FOLLOW_UP_STEPS = mappings.followUpSteps;
}

function clampConfidence(score: number): number {
  return Math.max(0, Math.min(100, Math.round(score)));
}

function isGreetingOnlyResponse(text: string): boolean {
  const t = text.trim().toLowerCase();
  if (!t) return false;
  if (t.length > 24) return false;
  return /^(hi|hello|hey|good (morning|afternoon|evening)|thanks|thank you|ok|okay)\b/.test(t);
}

function isVagueResponse(text: string): boolean {
  const t = text.trim().toLowerCase();
  if (!t) return true;
  if (t.length > 22) return false;
  return /^(help me|please help|i need help|something is wrong|not working|it\s*'?s broken|issue|problem)$/.test(t);
}

function isNoImageResponse(text: string): boolean {
  const t = text.trim().toLowerCase();
  return (t.includes("don't have") && t.includes("image")) || t.includes("no image");
}

function hasSufficientConfidence(categoryKey: ServiceCategoryKey | null, confidenceScore: number): boolean {
  if (!categoryKey) return false;
  const threshold = DYNAMIC_CONFIDENCE_THRESHOLDS[categoryKey] ?? DEFAULT_CONFIDENCE_THRESHOLDS[categoryKey] ?? 70;
  return confidenceScore >= threshold;
}

function scoreResponseUpdate(params: {
  categoryKey: ServiceCategoryKey | null;
  prevConfidenceScore: number;
  prevSlots: InfoSlots;
  prevAnswers: Record<string, string>;
  step: StepConfig;
  answerText: string;
  source: "manual" | "structured" | "image";
  imageDeclined: boolean;
}): { nextConfidenceScore: number; nextSlots: InfoSlots; contradiction: boolean } {
  const {
    categoryKey,
    prevConfidenceScore,
    prevSlots,
    prevAnswers,
    step,
    answerText,
    source,
    imageDeclined,
  } = params;

  let score = prevConfidenceScore;
  const nextSlots: InfoSlots = { ...prevSlots };
  let contradiction = false;

  const trimmed = answerText.trim();
  const greetingOnly = isGreetingOnlyResponse(trimmed);
  if (greetingOnly) {
    score -= 20;
    return { nextConfidenceScore: clampConfidence(score), nextSlots, contradiction: false };
  }

  if (step.slotKey && trimmed) {
    // Detect contradiction only when a user changes a previously completed slot.
    if (prevSlots[step.slotKey] && prevAnswers[step.id] && prevAnswers[step.id].trim()) {
      const prev = prevAnswers[step.id].trim().toLowerCase();
      const next = trimmed.toLowerCase();
      const isCorrection = /(actually|sorry|correction|i mean)/.test(next);
      if (!isCorrection && prev !== next && !prev.includes(next) && !next.includes(prev)) {
        contradiction = true;
        score -= 15;
      }
    }

    nextSlots[step.slotKey] = true;
  }

  // Positive signals
  if (step.id === "issue") {
    if (trimmed && !isVagueResponse(trimmed) && trimmed.length >= 20) score += 10;
    if (isVagueResponse(trimmed)) score -= 10;
  }

  if (step.slotKey === "location") score += 10;
  if (step.slotKey === "timing") score += 10;
  if (step.slotKey === "urgency") score += 10;

  if (source === "structured") score += 10;
  if (source === "image") {
    // Do not penalize "no image" responses.
    if (!imageDeclined && !isNoImageResponse(trimmed)) score += 15;
  }

  // Visuals only help confidence meaningfully when the category benefits.
  const categoryVisualsHelpful = categoryKey 
    ? (DYNAMIC_CATEGORY_VISUALS_HELPFUL[categoryKey] ?? DEFAULT_CATEGORY_VISUALS_HELPFUL[categoryKey] ?? true) 
    : true;
  if (source === "image" && categoryKey && !categoryVisualsHelpful) {
    score -= 5;
  }

  return { nextConfidenceScore: clampConfidence(score), nextSlots, contradiction };
}

function getServiceCategoryKey(title: string | undefined): ServiceCategoryKey | null {
  if (!title) return null;
  return DYNAMIC_CATEGORY_TITLE_TO_KEY[title] ?? DEFAULT_CATEGORY_TITLE_TO_KEY[title] ?? null;
}

function buildUserDescriptionFromAnswers({
  issue,
  estate,
  timing,
  urgency,
  followups,
}: {
  issue: string;
  estate: string;
  timing: string;
  urgency: string;
  followups: Array<{ question: string; answer: string }>;
}): string {
  const lines: string[] = [];
  if (issue.trim()) lines.push(issue.trim());
  if (estate.trim()) lines.push(`Estate: ${estate.trim()}`);
  if (timing.trim()) lines.push(`Timing: ${timing.trim()}`);
  if (urgency.trim()) lines.push(`Urgency: ${urgency.trim()}`);

  for (const fu of followups) {
    const q = fu.question.trim();
    const a = fu.answer.trim();
    if (q && a) lines.push(`${q} ${a}`);
    else if (a) lines.push(a);
  }

  return lines.join("\n");
}

function parseQuickIntake(text: string): Partial<{
  issue: string;
  estate: string;
  timing: string;
  urgency: string;
  outsideEstate: boolean;
}> {
  const raw = text.trim();
  if (!raw) return {};

  const lower = raw.toLowerCase();
  const outsideEstate =
    lower.includes("not in a cityconnect estate") ||
    lower.includes("no estate") ||
    lower.includes("i don't have an estate") ||
    lower.includes("dont have an estate");

  const pickLabeled = (labels: string[]): string | null => {
    const lines = raw
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    for (const line of lines) {
      for (const label of labels) {
        const prefix = label.toLowerCase() + ":";
        if (line.toLowerCase().startsWith(prefix)) {
          const val = line.slice(prefix.length).trim();
          if (val) return val;
        }
      }
    }
    return null;
  };

  const estate = pickLabeled(["Estate", "Location"]) ?? (outsideEstate ? "Not in a CityConnect estate" : null);
  const timing = pickLabeled(["When", "Started", "Timing", "Date", "Time"]) ?? null;
  const urgency = pickLabeled(["Urgency", "Priority"]) ?? null;

  // If the user used labeled fields, try to use the remainder as the issue.
  const labeledIssue = pickLabeled(["Issue", "Problem", "Request"]) ?? null;
  const issue = labeledIssue ?? raw;

  return {
    issue: issue || undefined,
    estate: estate || undefined,
    timing: timing || undefined,
    urgency: urgency || undefined,
    outsideEstate,
  };
}

function buildCategoryFollowUpSteps(categoryKey: ServiceCategoryKey): StepConfig[] {
  switch (categoryKey) {
    case "surveillance_monitoring":
      return [
        {
          id: "surveillance_goal",
          message: "What do you need help with most?",
          inputMode: "tags",
          options: [
            { value: "install", label: "Install new cameras" },
            { value: "not_working", label: "Cameras not working" },
            { value: "access", label: "Need access/monitoring" },
            { value: "footage", label: "Review footage" },
            { value: "other", label: "Other" },
          ],
          allowManualInput: true,
          placeholder: "Add a short detail if needed",
          slotKey: "description",
        },
      ];
    case "cleaning_janitorial":
      return [
        {
          id: "cleaning_area",
          message: "Which area needs attention?",
          inputMode: "tags",
          options: [
            { value: "common", label: "Common areas" },
            { value: "apartment", label: "Apartment" },
            { value: "outdoor", label: "Outdoor" },
            { value: "after_event", label: "After-event" },
            { value: "other", label: "Other" },
          ],
          allowManualInput: true,
          placeholder: "Any specific spots or concerns",
          slotKey: "location",
        },
      ];
    case "catering_services":
      return [
        {
          id: "catering_details",
          message: "What’s the occasion and roughly how many people?",
          inputMode: "none",
          allowManualInput: true,
          placeholder: "e.g., birthday for ~25 people",
          slotKey: "description",
        },
      ];
    case "it_support":
      return [
        {
          id: "it_device",
          message: "What needs help right now?",
          inputMode: "tags",
          options: [
            { value: "wifi", label: "Wi‑Fi / Internet" },
            { value: "laptop", label: "Laptop" },
            { value: "phone", label: "Phone" },
            { value: "printer", label: "Printer" },
            { value: "other", label: "Other" },
          ],
          allowManualInput: true,
          placeholder: "Add device/OS details if you can",
          slotKey: "description",
        },
      ];
    case "maintenance_repair":
      return [
        {
          id: "maintenance_area",
          message: "What’s affected?",
          inputMode: "tags",
          options: [
            { value: "plumbing", label: "Plumbing" },
            { value: "electrical", label: "Electrical" },
            { value: "door_lock", label: "Door/Lock" },
            { value: "appliance", label: "Appliance" },
            { value: "other", label: "Other" },
          ],
          allowManualInput: true,
          placeholder: "Describe the issue briefly",
          slotKey: "location",
        },
      ];
    case "marketing_advertising":
      return [
        {
          id: "marketing_goal",
          message: "What outcome are you aiming for?",
          inputMode: "tags",
          options: [
            { value: "social", label: "Social media" },
            { value: "flyers", label: "Flyers / Posters" },
            { value: "branding", label: "Branding" },
            { value: "ads", label: "Paid ads" },
            { value: "other", label: "Other" },
          ],
          allowManualInput: true,
          placeholder: "Share your audience/location if helpful",
          slotKey: "description",
        },
      ];
    case "home_tutors":
      return [
        {
          id: "tutor_subject",
          message: "Which subject and level is this for?",
          inputMode: "none",
          allowManualInput: true,
          placeholder: "e.g., JSS2 Maths or WAEC English",
          slotKey: "description",
        },
      ];
    case "furniture_making":
      return [
        {
          id: "furniture_item",
          message: "What furniture item do you need, and what size?",
          inputMode: "none",
          allowManualInput: true,
          placeholder: "e.g., wardrobe 6ft x 3ft",
          slotKey: "description",
        },
      ];
    case "store_owner":
      return [
        {
          id: "store_service",
          message: "What do you need help with for your store?",
          inputMode: "tags",
          options: [
            { value: "inventory", label: "Inventory management" },
            { value: "sales", label: "Sales support" },
            { value: "delivery", label: "Delivery setup" },
            { value: "marketing", label: "Store marketing" },
            { value: "other", label: "Other" },
          ],
          allowManualInput: true,
          placeholder: "Describe your store needs",
          slotKey: "description",
        },
      ];
    case "market_runner":
      return [
        {
          id: "runner_task",
          message: "What do you need picked up or delivered?",
          inputMode: "none",
          allowManualInput: true,
          placeholder: "e.g., groceries from the market, documents",
          slotKey: "description",
        },
      ];
    case "item_vendor":
      return [
        {
          id: "vendor_item",
          message: "What items are you looking for?",
          inputMode: "none",
          allowManualInput: true,
          placeholder: "e.g., fresh vegetables, electronics",
          slotKey: "description",
        },
      ];
    case "alarm_system":
      return [
        {
          id: "alarm_need",
          message: "What do you need help with?",
          inputMode: "tags",
          options: [
            { value: "install", label: "Install new alarm" },
            { value: "repair", label: "Repair existing" },
            { value: "upgrade", label: "Upgrade system" },
            { value: "monitoring", label: "Monitoring service" },
            { value: "other", label: "Other" },
          ],
          allowManualInput: true,
          placeholder: "Describe your alarm needs",
          slotKey: "description",
        },
      ];
    case "packaging_solutions":
      return [
        {
          id: "packaging_need",
          message: "What kind of packaging do you need?",
          inputMode: "tags",
          options: [
            { value: "moving", label: "Moving boxes" },
            { value: "shipping", label: "Shipping supplies" },
            { value: "gift", label: "Gift wrapping" },
            { value: "custom", label: "Custom packaging" },
            { value: "other", label: "Other" },
          ],
          allowManualInput: true,
          placeholder: "Describe your packaging needs",
          slotKey: "description",
        },
      ];
    default:
      return [];
  }
}

function buildFlowStepsForCategory(categoryKey: ServiceCategoryKey): StepConfig[] {
  // Check for custom initial message from database settings
  const customInitialMessage = DYNAMIC_INITIAL_MESSAGES[categoryKey];
  const defaultMessage = "Tell me what you need help with - include estate (or 'no estate'), when it started, and urgency in one message if you can.";
  
  const base: StepConfig[] = [
    {
      id: "issue",
      message: customInitialMessage || defaultMessage,
      inputMode: "none",
      allowManualInput: true,
      placeholder: "Example: I need my house cleaned in Magodo since this morning (urgent).",
      slotKey: "description",
    },
    {
      id: "estate",
      message: "Which estate are you in?",
      inputMode: "dropdown",
      allowManualInput: true,
      placeholder: "Type your estate name",
      slotKey: "location",
    },
    {
      id: "timing",
      message: "When did it start?",
      inputMode: "datetime",
      allowManualInput: true,
      placeholder: "You can type it if you’re not sure",
      slotKey: "timing",
    },
    {
      id: "urgency",
      message: "How urgent is it?",
      inputMode: "tags",
      options: [
        { value: "Emergency", label: "Emergency" },
        { value: "High", label: "High" },
        { value: "Medium", label: "Medium" },
        { value: "Low", label: "Low" },
      ],
      allowManualInput: true,
      placeholder: "Optional: add one short detail",
      slotKey: "urgency",
    },
  ];

  const steps: StepConfig[] = [...base, ...buildCategoryFollowUpSteps(categoryKey)];
  const visualsHelpful = DYNAMIC_CATEGORY_VISUALS_HELPFUL[categoryKey] ?? DEFAULT_CATEGORY_VISUALS_HELPFUL[categoryKey] ?? true;
  if (visualsHelpful) {
    steps.push({
      id: "image",
      message: "Do you have a photo or screenshot?",
      inputMode: "upload",
      allowManualInput: false,
      slotKey: "imageProvided",
    });
  }
  return steps;
}

type AiDecision = {
  requiresConsultancy: boolean;
  consultancyCompleted: boolean;
};

type CityBuddyBookingEvent = {
  eventId: string;
  createdAtIso: string;
  citybuddySessionId?: string | null;
  serviceRequestId: string;
  title?: string | null;
  status?: string | null;
};

const CITYBUDDY_BOOKING_EVENTS_KEY = "citybuddy_booking_events_v1";

function safeReadBookingEvents(): CityBuddyBookingEvent[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(CITYBUDDY_BOOKING_EVENTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(Boolean) as CityBuddyBookingEvent[];
  } catch {
    return [];
  }
}

function safeWriteBookingEvents(next: CityBuddyBookingEvent[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CITYBUDDY_BOOKING_EVENTS_KEY, JSON.stringify(next.slice(-30)));
  } catch {
    // ignore
  }
}

type HistoryItem =
  | { id: string; type: "user_text"; text: string }
  | { id: string; type: "ai_message"; text: string }
  | { id: string; type: "image"; src: string }
  | {
      id: string;
      type: "ticket";
      serviceRequestId: string;
      title?: string | null;
      status: string;
      createdAtIso?: string | null;
    };

function mapConversationMessagesToHistory(
  messages: ConversationMessage[],
): { history: HistoryItem[]; latestAiMeta: CityBuddyAiResponse | null } {
  const history: HistoryItem[] = [];
  let latestAiMeta: CityBuddyAiResponse | null = null;

  messages.forEach((msg) => {
    if (msg.role === "user" && msg.type === "image") {
      history.push({ id: msg.id, type: "image", src: msg.content });
      return;
    }
    if (msg.role === "user") {
      history.push({ id: msg.id, type: "user_text", text: msg.content });
      return;
    }
    history.push({ id: msg.id, type: "ai_message", text: msg.content });
    if (msg.meta && typeof msg.meta === "object") {
      latestAiMeta = msg.meta as CityBuddyAiResponse;
    }
  });

  return { history, latestAiMeta };
}

type ConversationSummary = {
  headline: string;
  details: string[];
  urgency: "low" | "medium" | "high";
  category: string;
  recommendedApproach: "DIY" | "Professional" | "Hybrid";
  nextActions: string[];
  estimatedPriceRange?: {
    min: number;
    max: number;
    currency: "NGN";
  };
  priceConfidenceLevel?: "low" | "medium" | "high";
};

type PriceEstimationCard = {
  id: string;
  category: string;
  title: string;
  estimatedRange: {
    min: number;
    max: number;
    currency: "NGN";
  };
  pricingBasis: string[];
  confidenceLevel: "low" | "medium" | "high";
  notes?: string;
  disclaimer: string;
  callToActions: {
    primary: string;
    secondary?: string;
  };
};

type BookingCard = {
  id: string;
  category: string;
  title: string;
  summary: string;
  urgency: "low" | "medium" | "high";
  location?: string;
  estimatedScope: string;
  imagePreview?: string[];
  recommendedServiceType: "Estate Maintenance" | "Professional Provider" | "Consultancy";
  callToActions: {
    primary: string;
    secondary?: string;
  };
};

type ProviderPreview = {
  id: string;
  name: string;
  serviceCategory: string;
  rating: number;
  completedJobs: number;
  responseTime: string;
  location: string;
  badges: string[];
  verificationStatus: "Verified" | "Pending";
  image?: string;
};

type ProviderMatchingPreview = {
  providers: ProviderPreview[];
  usedEstateId?: string | null;
  estateSpecificCount?: number;
  note?: string;
  inputFingerprint: string;
  createdAtIso: string;
};

type ConversationSession = {
  id: string;
  category: string;
  title: string;
  summary: ConversationSummary;
  bookingCard?: BookingCard | null;
  priceEstimationCard?: PriceEstimationCard | null;
  providerMatchingPreview?: ProviderMatchingPreview | null;
  readyToBook?: boolean;
  lastUpdated: string; // ISO
  confidenceScore: number;
  isResolved: boolean;
  messages: HistoryItem[];
  infoSlots: InfoSlots;
  conversationState: {
    step: ConversationStep;
    flowIndex: number;
    flowAnswers: Record<string, string>;
    issueText: string;
    selectedEstateName: string | null;
    isOutsideCityConnectEstate: boolean;
    useManualEstate: boolean;
    startDate: string;
    startTime: string;
    startQuickTag: string | null;
    imageDeclined: boolean;
    uploadedImageSrc: string | null;
    aiResponse: CityBuddyAiResponse | null;
    aiDecision: AiDecision;
    isUserDistressed: boolean;
    earlyStopAcknowledged: boolean;
  };
  // Provider comparison tracking
  comparisonViewed?: boolean;
  selectedProviderId?: string | null;
};

function formatStarRating(rating: number) {
  const r = Number.isFinite(rating) ? Math.max(0, Math.min(5, rating)) : 0;
  const full = Math.floor(r + 1e-9);
  const empty = Math.max(0, 5 - full);
  return `${"★".repeat(full)}${"☆".repeat(empty)}`;
}

function buildProviderPreviewFingerprint(params: {
  categoryKey: string;
  urgency?: string | null;
  scope?: string | null;
}) {
  const urgency = (params.urgency ?? "").toLowerCase();
  const scope = (params.scope ?? "").toLowerCase();
  return `v1:${params.categoryKey}:${urgency}:${scope}`;
}

async function fetchProviderMatchingPreview(params: {
  category: string;
  urgency?: string | null;
  limit?: number;
}): Promise<{ providers: ProviderPreview[]; usedEstateId: string | null; estateSpecificCount: number } | null> {
  try {
    const qs = new URLSearchParams();
    qs.set("category", params.category);
    if (params.urgency) qs.set("urgency", params.urgency);
    qs.set("limit", String(params.limit ?? 4));
    const res = await apiRequest("GET", `/api/providers/preview?${qs.toString()}`);
    return (await res.json()) as any;
  } catch {
    return null;
  }
}

function normalizeHeadlineText(text: string): string {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (!cleaned) return "New request";
  const withoutPunctuationSpam = cleaned.replace(/[.!?]{2,}$/g, "");
  return withoutPunctuationSpam.length > 56 ? `${withoutPunctuationSpam.slice(0, 56).trim()}…` : withoutPunctuationSpam;
}

function inferUrgencyLevel(params: { issue: string; urgencyAnswer: string }): "low" | "medium" | "high" {
  const urgency = (params.urgencyAnswer || "").trim().toLowerCase();
  if (urgency === "emergency" || urgency === "high") return "high";
  if (urgency === "medium") return "medium";
  if (urgency === "low") return "low";

  const t = (params.issue || "").toLowerCase();
  const highSignals = [
    "urgent",
    "emergency",
    "danger",
    "dangerous",
    "smoke",
    "fire",
    "gas",
    "leak",
    "flood",
    "burst",
    "sparks",
    "electric",
    "shocked",
    "stuck",
    "not working",
  ];
  if (highSignals.some((k) => t.includes(k))) return "high";

  const mediumSignals = ["intermittent", "sometimes", "keeps", "disconnect", "slow", "unstable", "won't", "can’t", "cant"];
  if (mediumSignals.some((k) => t.includes(k))) return "medium";
  return "low";
}

function defaultApproachForCategory(categoryKey: ServiceCategoryKey | null): "DIY" | "Professional" | "Hybrid" {
  switch (categoryKey) {
    case "it_support":
      return "Hybrid";
    case "cleaning_janitorial":
      return "DIY";
    case "maintenance_repair":
      return "Hybrid";
    case "surveillance_monitoring":
      return "Professional";
    case "catering_services":
    case "marketing_advertising":
    case "home_tutors":
    case "furniture_making":
      return "Professional";
    default:
      return "Hybrid";
  }
}

function inferRecommendedApproach(params: {
  categoryKey: ServiceCategoryKey | null;
  urgency: "low" | "medium" | "high";
  aiDecision: AiDecision;
  aiResponse: CityBuddyAiResponse | null;
  issue: string;
}): "DIY" | "Professional" | "Hybrid" {
  if (params.aiDecision.requiresConsultancy || params.aiResponse?.intent === "escalate") return "Professional";

  const base = defaultApproachForCategory(params.categoryKey);
  if (params.urgency === "high") {
    if (params.categoryKey === "it_support") return "Hybrid";
    return "Professional";
  }

  const t = (params.issue || "").toLowerCase();
  const safetySignals = ["smoke", "fire", "gas", "electric", "sparks", "shock", "flood", "burst", "leak"];
  if (safetySignals.some((k) => t.includes(k))) return "Professional";

  return base;
}

function uniqueNonEmpty(items: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of items) {
    const t = raw.trim();
    if (!t) continue;
    const key = t.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t);
  }
  return out;
}

function getConversationImageSrcs(params: { uploadedImageSrc: string | null; history: HistoryItem[] }): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const add = (src: string | null) => {
    const safe = safeImageForStorage(src);
    if (!safe) return;
    if (seen.has(safe)) return;
    seen.add(safe);
    out.push(safe);
  };

  add(params.uploadedImageSrc);
  for (const h of params.history) {
    if (h.type === "image") add(h.src);
  }
  return out;
}

function mergeImagePreview(params: {
  previousPreview?: string[] | null;
  currentImages: string[];
  limit?: number;
}): string[] {
  const { previousPreview, currentImages } = params;
  const limit = params.limit ?? 4;
  if (!previousPreview || previousPreview.length === 0) return currentImages.slice(0, limit);

  // Respect user removals by treating previousPreview as the curated list.
  const curated = previousPreview.filter((src) => currentImages.includes(src));
  const extras = currentImages.filter((src) => !curated.includes(src));
  return [...curated, ...extras].slice(0, limit);
}

function estimateScope(params: {
  categoryKey: ServiceCategoryKey | null;
  recommendedApproach: ConversationSummary["recommendedApproach"];
  urgency: ConversationSummary["urgency"];
  requiresConsultancy: boolean;
}): string {
  if (params.requiresConsultancy) return "Inspection and troubleshooting required";

  switch (params.categoryKey) {
    case "cleaning_janitorial":
      return "Deep cleaning needed";
    case "it_support":
      return "Troubleshooting and configuration";
    case "maintenance_repair":
      return params.urgency === "high" ? "Urgent inspection and repair required" : "Inspection and repair required";
    case "surveillance_monitoring":
      return "Inspection and setup required";
    default:
      return params.recommendedApproach === "Professional"
        ? "Professional assessment required"
        : "Inspection and service required";
  }
}

function buildBookingCard(params: {
  sessionId: string;
  category: string;
  categoryKey: ServiceCategoryKey | null;
  summary: ConversationSummary;
  flowAnswers: Record<string, string>;
  isOutsideCityConnectEstate: boolean;
  selectedEstateName: string | null;
  aiDecision: AiDecision;
  uploadedImageSrc: string | null;
  history: HistoryItem[];
  existingPreview?: string[] | null;
}): BookingCard {
  const issueRaw = (params.flowAnswers.issue || "").trim();
  const timingText = (params.flowAnswers.timing || "").trim();

  const estateText = params.flowAnswers.estate
    ? params.flowAnswers.estate
    : params.isOutsideCityConnectEstate
      ? "Not in a CityConnect estate"
      : params.selectedEstateName || "";

  const titleCore = normalizeHeadlineText(params.summary.headline || "New request");
  const title = titleCore === "New request" ? `${params.category} request` : titleCore;

  const lines: string[] = [];
  if (issueRaw) {
    const whenBit = timingText ? ` (started ${timingText})` : "";
    lines.push(`${normalizeHeadlineText(issueRaw)}${whenBit}.`);
  }
  if (estateText && estateText !== "Unknown") {
    lines.push(`Location: ${estateText}.`);
  }
  if (params.summary.urgency === "high") {
    lines.push("Marked as urgent.");
  }

  const summaryText = uniqueNonEmpty(lines).slice(0, 3).join("\n");

  const currentImages = getConversationImageSrcs({ uploadedImageSrc: params.uploadedImageSrc, history: params.history });
  const imagePreview = mergeImagePreview({ previousPreview: params.existingPreview, currentImages, limit: 4 });

  const recommendedServiceType: BookingCard["recommendedServiceType"] = params.aiDecision.requiresConsultancy
    ? "Consultancy"
    : params.categoryKey === "maintenance_repair" || params.categoryKey === "cleaning_janitorial"
      ? "Estate Maintenance"
      : "Professional Provider";

  const primaryCta =
    recommendedServiceType === "Consultancy"
      ? "Make payment"
      : recommendedServiceType === "Estate Maintenance"
        ? "Schedule Maintenance"
        : "Request Professional Help";

  return {
    id: `${params.sessionId}:booking`,
    category: params.category,
    title,
    summary: summaryText || "I have enough information to help you move forward.",
    urgency: params.summary.urgency,
    location: estateText && estateText !== "Unknown" ? estateText : undefined,
    estimatedScope: estimateScope({
      categoryKey: params.categoryKey,
      recommendedApproach: params.summary.recommendedApproach,
      urgency: params.summary.urgency,
      requiresConsultancy: params.aiDecision.requiresConsultancy,
    }),
    imagePreview: imagePreview.length ? imagePreview : undefined,
    recommendedServiceType,
    callToActions: {
      primary: primaryCta,
      secondary: "Ask a follow-up question",
    },
  };
}

function clampMoneyNgn(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.round(value));
}

function roundToNearest(value: number, step: number): number {
  if (!Number.isFinite(value) || !Number.isFinite(step) || step <= 0) return Math.round(value);
  return Math.round(value / step) * step;
}

function formatNgn(value: number): string {
  const n = clampMoneyNgn(value);
  return `₦${n.toLocaleString("en-NG")}`;
}

function formatNgnRange(min: number, max: number): string {
  return `${formatNgn(min)} – ${formatNgn(max)}`;
}

type ServiceScope = "minor" | "moderate" | "major" | "unknown";

function inferServiceScope(params: {
  categoryKey: ServiceCategoryKey | null;
  issue: string;
  estimatedScopeText: string;
  timingText: string;
}): ServiceScope {
  const t = `${params.issue}\n${params.estimatedScopeText}`.toLowerCase();
  const timing = (params.timingText || "").toLowerCase();

  const hasAny = (keys: string[]) => keys.some((k) => t.includes(k));

  if (hasAny(["major", "severe", "burst", "flood", "fire", "smoke", "gas"])) return "major";
  if (timing.includes("immediately") || timing.includes("now") || timing.includes("today") || timing.includes("asap")) {
    // Time pressure often correlates with larger/complex jobs.
    if (hasAny(["replace", "rewire", "installation", "install", "custom build"])) return "major";
  }

  switch (params.categoryKey) {
    case "cleaning_janitorial": {
      if (hasAny(["deep", "bugs", "cockroach", "infestation", "mold", "post construction", "after event", "stain"])) return "major";
      return "minor";
    }
    case "maintenance_repair": {
      if (hasAny(["appliance", "fridge", "freezer", "washing", "dryer", "air conditioner", "ac ", "a/c"])) return "moderate";
      if (hasAny(["replace", "installation", "install", "rewire", "burst", "flood"])) return "major";
      if (hasAny(["leak", "blocked", "socket", "switch", "door", "lock", "plumbing", "electrical"])) return "moderate";
      return "minor";
    }
    case "it_support": {
      if (hasAny(["network", "router", "hardware", "server", "switch", "cable", "printer", "hardware"])) return "moderate";
      if (hasAny(["data loss", "won't boot", "boot", "replace", "motherboard"])) return "major";
      return "minor";
    }
    case "furniture_making": {
      if (hasAny(["custom", "build", "wardrobe", "kitchen", "cabinet", "table", "bedframe", "design"])) return "major";
      if (hasAny(["repair", "fix", "hinge", "drawer", "handle", "polish"])) return "minor";
      return "moderate";
    }
    case "catering_services": {
      const guestCountMatch = params.issue.match(/\b(\d{1,3})\b/);
      const guestCount = guestCountMatch ? Number(guestCountMatch[1]) : NaN;
      if (hasAny(["wedding", "event", "party", "reception"])) return "major";
      if (Number.isFinite(guestCount)) {
        if (guestCount >= 50) return "major";
        if (guestCount >= 10) return "moderate";
        return "minor";
      }
      return "moderate";
    }
    default:
      return hasAny(["install", "installation", "custom", "build"]) ? "major" : "moderate";
  }
}

function baseRangeForCategory(params: { categoryKey: ServiceCategoryKey | null; scope: ServiceScope }): { min: number; max: number } {
  const scope = params.scope;
  switch (params.categoryKey) {
    case "cleaning_janitorial": {
      if (scope === "major") return { min: 15000, max: 35000 };
      return { min: 5000, max: 10000 };
    }
    case "maintenance_repair": {
      if (scope === "major") return { min: 20000, max: 50000 };
      if (scope === "moderate") return { min: 12000, max: 25000 };
      return { min: 8000, max: 15000 };
    }
    case "it_support": {
      if (scope === "major") return { min: 15000, max: 40000 };
      if (scope === "moderate") return { min: 12000, max: 25000 };
      return { min: 5000, max: 12000 };
    }
    case "furniture_making": {
      if (scope === "major") return { min: 50000, max: 120000 };
      if (scope === "moderate") return { min: 30000, max: 60000 };
      return { min: 15000, max: 30000 };
    }
    case "catering_services": {
      if (scope === "major") return { min: 80000, max: 180000 };
      if (scope === "moderate") return { min: 50000, max: 90000 };
      return { min: 20000, max: 50000 };
    }
    default: {
      // Fallback for categories without explicit baselines.
      if (scope === "major") return { min: 60000, max: 150000 };
      if (scope === "minor") return { min: 10000, max: 25000 };
      return { min: 25000, max: 60000 };
    }
  }
}

function buildPriceEstimationCard(params: {
  sessionId: string;
  category: string;
  categoryKey: ServiceCategoryKey | null;
  bookingCard: BookingCard;
  summary: ConversationSummary;
  confidenceScore: number;
  thresholdReached: boolean;
  issueText: string;
  timingText: string;
  hasImage: boolean;
  existingCard?: PriceEstimationCard | null;
  memoryBaselineRange?: { min: number; max: number } | null;
}): PriceEstimationCard {
  const disclaimer = "This is an estimated range. Final pricing may vary after professional assessment.";

  const scope = inferServiceScope({
    categoryKey: params.categoryKey,
    issue: params.issueText,
    estimatedScopeText: params.bookingCard.estimatedScope,
    timingText: params.timingText,
  });

  const timingLower = (params.timingText || "").toLowerCase();
  const isTimeSensitive =
    timingLower.includes("today") ||
    timingLower.includes("now") ||
    timingLower.includes("immediately") ||
    timingLower.includes("asap") ||
    timingLower.includes("within") ||
    timingLower.includes("hour");

  const urgencyMultiplier =
    params.summary.urgency === "high" ? 1.25 : params.summary.urgency === "low" ? 0.95 : 1.0;
  const timeMultiplier = isTimeSensitive ? 1.1 : 1.0;

  const basis: string[] = ["Based on issue description"];
  if (scope !== "unknown") basis.push("Service scope");
  if (params.summary.urgency) basis.push("Urgency level");
  if (isTimeSensitive) basis.push("Time sensitivity");
  if (params.hasImage) basis.push("Image review");

  const scopeIsClear = scope !== "unknown";
  const confidenceLevel: PriceEstimationCard["confidenceLevel"] =
    params.hasImage && scopeIsClear ? "high" : scopeIsClear ? "medium" : "low";

  const base = baseRangeForCategory({ categoryKey: params.categoryKey, scope });
  const baselineFromMemory = !scopeIsClear && params.memoryBaselineRange ? params.memoryBaselineRange : null;

  const baseMin = baselineFromMemory ? baselineFromMemory.min : base.min;
  const baseMax = baselineFromMemory ? baselineFromMemory.max : base.max;
  if (baselineFromMemory) basis.push("Similar past requests (same category)");

  const adjustedMin = baseMin * urgencyMultiplier * timeMultiplier;
  const adjustedMax = baseMax * urgencyMultiplier * timeMultiplier;

  // Widen or tighten range based on confidence.
  const widen = confidenceLevel === "low" ? 1.25 : confidenceLevel === "medium" ? 1.12 : 1.05;
  const tighten = confidenceLevel === "low" ? 0.85 : confidenceLevel === "medium" ? 0.95 : 1.0;

  let min = roundToNearest(adjustedMin * tighten, 500);
  let max = roundToNearest(adjustedMax * widen, 500);
  min = clampMoneyNgn(min);
  max = clampMoneyNgn(max);
  if (max < min + 500) max = min + 500;

  let notes = "";
  if (params.summary.urgency === "high") {
    notes = "Urgent requests can cost ~25% more (after assessment).";
  }
  if (!params.hasImage) {
    notes = notes ? `${notes} A photo/screenshot can help tighten the estimate.` : "A photo/screenshot can help tighten the estimate.";
  }

  const titleCore = params.bookingCard.title || params.category;
  const title = `Estimated cost for ${titleCore}`;

  const primaryCta =
    params.summary.recommendedApproach === "Professional" || params.bookingCard.recommendedServiceType === "Consultancy"
      ? "Request professional assessment"
      : "Continue to booking";

  return {
    id: params.existingCard?.id ?? `${params.sessionId}:price-estimate`,
    category: params.category,
    title,
    estimatedRange: { min, max, currency: "NGN" },
    pricingBasis: uniqueNonEmpty(basis),
    confidenceLevel,
    notes: notes || undefined,
    disclaimer,
    callToActions: {
      primary: primaryCta,
      secondary: "Ask a question",
    },
  };
}

function buildConversationSummary(params: {
  category: string;
  categoryKey: ServiceCategoryKey | null;
  flowAnswers: Record<string, string>;
  infoSlots: InfoSlots;
  isOutsideCityConnectEstate: boolean;
  selectedEstateName: string | null;
  hasImage: boolean;
  aiDecision: AiDecision;
  aiResponse: CityBuddyAiResponse | null;
  confidenceScore: number;
  step: ConversationStep;
}): ConversationSummary {
  const issueRaw = (params.flowAnswers.issue || "").trim();
  const estateText = params.flowAnswers.estate
    ? params.flowAnswers.estate
    : params.isOutsideCityConnectEstate
      ? "Not in a CityConnect estate"
      : params.selectedEstateName || "";
  const timingText = (params.flowAnswers.timing || "").trim();
  const urgencyAnswer = (params.flowAnswers.urgency || "").trim();

  const urgency = inferUrgencyLevel({ issue: issueRaw, urgencyAnswer });
  const recommendedApproach = inferRecommendedApproach({
    categoryKey: params.categoryKey,
    urgency,
    aiDecision: params.aiDecision,
    aiResponse: params.aiResponse,
    issue: issueRaw,
  });

  const wherePhrase = estateText && estateText !== "Unknown" ? estateText : "";
  const baseHeadline = issueRaw ? issueRaw.split(/\r?\n/)[0] : "New request";
  const headlineCore = normalizeHeadlineText(baseHeadline);
  const headline = urgency === "high" && headlineCore !== "New request" ? `${headlineCore} (urgent)` : headlineCore;

  const details: string[] = [];
  if (params.infoSlots.description && issueRaw) details.push(`What: ${normalizeHeadlineText(issueRaw)}`);
  if (params.infoSlots.location && wherePhrase) details.push(`Where: ${wherePhrase}`);
  if (params.infoSlots.timing && timingText) details.push(`When: ${timingText}`);
  if (params.infoSlots.urgency && urgencyAnswer) details.push(`Urgency: ${urgencyAnswer}`);
  details.push(`Image provided: ${params.hasImage ? "Yes" : "No"}`);

  const categoryKey = params.categoryKey;
  const thresholdReached = Boolean(categoryKey) && hasSufficientConfidence(categoryKey!, params.confidenceScore);

  const nextActions: string[] = [];
  if (!thresholdReached || params.step === "FLOW") {
    nextActions.push("Continue conversation for clarification");
  } else {
    if (recommendedApproach === "DIY") {
      if (categoryKey === "it_support") nextActions.push("Try basic troubleshooting steps");
      else if (categoryKey === "cleaning_janitorial") nextActions.push("Try basic cleaning steps to reduce the issue");
      else nextActions.push("Try safe basic steps first");
    }

    if (recommendedApproach === "Hybrid") {
      if (categoryKey === "it_support") nextActions.push("Try basic troubleshooting steps");
      else if (categoryKey === "cleaning_janitorial") nextActions.push("Try basic cleaning steps to reduce the issue");
      else nextActions.push("Try safe basic steps first");
      nextActions.push("Book a service if it doesn’t improve");
    }

    if (recommendedApproach === "Professional") {
      nextActions.push("Book a professional service");
    }

    if (params.aiDecision.requiresConsultancy) {
      nextActions.push("Request a professional consultation");
    }

    if (categoryKey === "cleaning_janitorial" || categoryKey === "maintenance_repair" || categoryKey === "furniture_making") {
      nextActions.push("Buy recommended items if needed");
    }
  }

  return {
    headline,
    details: uniqueNonEmpty(details),
    urgency,
    category: params.category,
    recommendedApproach,
    nextActions: uniqueNonEmpty(nextActions),
  };
}

function deriveTitleFromIssue(issue: string): string {
  const first = issue.split(/\r?\n/)[0]?.trim() || "";
  if (!first) return "New request";
  if (isVagueResponse(first) || first.length < 10) return "New request";
  const cleaned = first.replace(/\s+/g, " ");
  return cleaned.length > 28 ? `${cleaned.slice(0, 28).trim()}…` : cleaned;
}

function formatRelativeTime(iso: string): string {
  const ts = new Date(iso).getTime();
  if (!Number.isFinite(ts)) return "";
  const diffMs = Date.now() - ts;
  const diffSec = Math.max(0, Math.floor(diffMs / 1000));
  if (diffSec < 10) return "Now";
  if (diffSec < 60) return `${diffSec} sec ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} min ago`;

  const d = new Date(ts);
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  if (sameDay) return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return d.toLocaleDateString([], { day: "2-digit", month: "short" });
}

function safeImageForStorage(src: string | null): string | null {
  if (!src) return null;
  // Avoid blowing up localStorage with huge base64 images.
  if (src.length > 250_000) return null;
  return src;
}

function buildMemorySummaryForGemini(params: {
  category: string;
  infoSlots: InfoSlots;
  flowAnswers: Record<string, string>;
  isOutsideCityConnectEstate: boolean;
  selectedEstateName: string | null;
  hasImage: boolean;
  confidenceScore: number;
}): string {
  const {
    category,
    infoSlots,
    flowAnswers,
    isOutsideCityConnectEstate,
    selectedEstateName,
    hasImage,
    confidenceScore,
  } = params;

  const estateText = flowAnswers.estate
    ? flowAnswers.estate
    : isOutsideCityConnectEstate
      ? "Not in a CityConnect estate"
      : selectedEstateName || "Unknown";

  const bits: string[] = [];
  bits.push(`Category: ${category}`);
  if (infoSlots.description && (flowAnswers.issue || "").trim()) bits.push(`Issue: ${(flowAnswers.issue || "").trim()}`);
  if (infoSlots.location && estateText.trim()) bits.push(`Location/Estate: ${estateText.trim()}`);
  if (infoSlots.timing && (flowAnswers.timing || "").trim()) bits.push(`Timing: ${(flowAnswers.timing || "").trim()}`);
  if (infoSlots.urgency && (flowAnswers.urgency || "").trim()) bits.push(`Urgency: ${(flowAnswers.urgency || "").trim()}`);
  bits.push(`Image available: ${hasImage ? "Yes" : "No"}`);
  bits.push(`Confidence: ${confidenceScore}/100`);

  return `Memory summary (do not repeat questions already answered):\n${bits.join("\n")}`;
}

function buildGeminiHistory(params: {
  items: HistoryItem[];
  currentUserMessage: string;
  priorAiResponse: CityBuddyAiResponse | null;
  memorySummary: string;
}): ChatMessage[] {
  const { items, currentUserMessage, priorAiResponse, memorySummary } = params;
  const mapped: ChatMessage[] = items
    .filter((i) => i.type === "user_text" || i.type === "ai_message")
    .map((i) => {
      const role: ChatMessage["role"] = i.type === "user_text" ? "user" : "assistant";
      const text = i.type === "user_text" ? i.text.trim() : i.text.trim();
      return { role, text };
    })
    .filter((m) => Boolean(m.text));

  // Summary-first context injection to avoid prompt bloat.
  const recent = mapped.slice(-2);
  const context: ChatMessage[] = [{ role: "assistant", text: memorySummary.trim() }];

  if (priorAiResponse?.message) {
    context.push({ role: "assistant", text: priorAiResponse.message.trim() });
  }
  if (priorAiResponse?.intent === "clarify" && priorAiResponse.followUpQuestion) {
    context.push({ role: "assistant", text: priorAiResponse.followUpQuestion.trim() });
  }

  // Avoid repeating the current user message in both history and `userMessage`.
  const trimmedCurrent = currentUserMessage.trim();
  const last = recent[recent.length - 1];
  const safeRecent =
    trimmedCurrent && last?.role === "user" && last.text === trimmedCurrent ? recent.slice(0, -1) : recent;

  return [...context, ...safeRecent].filter((m) => m.text.trim());
}

function makeHistoryId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }
}

function parseDataUrl(dataUrl: string): InlineImagePart | null {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;
  const mimeType = match[1];
  const data = match[2];
  return { mimeType, data };
}

function SectionCard({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="bg-white rounded-[8px] w-full overflow-clip">
      <div className="px-[24px] py-[16px]">
        <p className="font-['General_Sans:Semibold',sans-serif] text-[#101828] text-[14px] leading-[20px]">
          {title}
        </p>
      </div>
      <div className="px-[24px] pb-[20px]">
        <div className="bg-[#f5f6f6] rounded-[12px] px-[16px] py-[12px]">
          {children}
        </div>
      </div>
    </div>
  );
}

function DeleteIcon() {
  return (
    <div className="relative shrink-0 size-[16px]" data-name="Delete icon">
      <svg
        className="block size-full"
        fill="none"
        preserveAspectRatio="none"
        viewBox="0 0 16 16"
      >
        <path
          d={svgPaths.p940fa80}
          stroke="var(--stroke-0, #D92D20)"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
        />
      </svg>
    </div>
  );
}



function UploadedImagePreview({
  imageSrc,
  onDelete,
}: {
  imageSrc: string;
  onDelete: () => void;
}) {
  return (
    <div className="bg-white content-stretch flex flex-col items-start overflow-clip pb-[16px] pt-0 px-0 relative rounded-[8px] shrink-0 w-full">
      <div className="content-stretch flex gap-[12px] items-start relative shrink-0 w-full pt-[0px] pr-[0px] pb-[16px] pl-[0px]">
        <div className="content-stretch flex flex-col items-start overflow-clip px-px py-[4px] relative shrink-0">
          <AIAskBotIcon />
        </div>
        <div className="flex-1 min-w-0">
          <div className="h-[172px] relative rounded-[8px] shrink-0 w-[163px]">
            <img
              alt=""
              className="absolute inset-0 max-w-none object-center object-cover pointer-events-none rounded-[8px] size-full"
              src={imageSrc}
            />
            <button
              type="button"
              onClick={onDelete}
              className="absolute top-[8px] right-[8px] bg-[rgba(255,255,255,0.8)] content-stretch flex items-center overflow-clip p-[8px] rounded-[32px] hover:bg-white transition-colors"
              aria-label="Delete image"
            >
              <DeleteIcon />
            </button>
            <div
              aria-hidden="true"
              className="absolute border-4 border-[#039855] border-solid inset-[-4px] pointer-events-none rounded-[12px]"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function HistoryImageBubble({ src }: { src: string }) {
  return (
    <div className="w-full flex justify-end pb-[16px]">
      <div className="max-w-[260px]">
        <img
          alt="Uploaded"
          className="block w-full h-auto rounded-[12px] object-cover pointer-events-none"
          src={src}
        />
      </div>
    </div>
  );
}

// ============ Sub Navigation Components ============
function BackIcon() {
  return (
    <div
      className="relative shrink-0 size-[24px]"
      data-name="Back icon"
    >
      <svg
        className="block size-full"
        fill="none"
        preserveAspectRatio="none"
        viewBox="0 0 24 24"
      >
        <g id="Back icon">
          <path
            d="M15 18L9 12L15 6"
            id="Icon"
            stroke="var(--stroke-0, white)"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
          />
        </g>
      </svg>
    </div>
  );
}

function Header1({ onClick }: { onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className="content-stretch flex gap-[8px] items-start relative shrink-0 w-full cursor-pointer hover:opacity-80 transition-opacity bg-transparent border-none p-0"
      data-name="Header"
    >
      <BackIcon />
      <p className="font-['Inter:Medium',sans-serif] font-medium leading-[24px] not-italic relative shrink-0 text-[16px] text-nowrap text-white">
        My Requests
      </p>
    </button>
  );
}

function PlusIcon() {
  return (
    <div
      className="relative shrink-0 size-[16px]"
      data-name="Plus icon"
    >
      <svg
        className="block size-full"
        fill="none"
        preserveAspectRatio="none"
        viewBox="0 0 16 16"
      >
        <g id="Plus icon">
          <path
            d={svgPaths.p3b397100}
            id="Icon"
            stroke="var(--stroke-0, #6CE9A6)"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>
      </svg>
    </div>
  );
}

function Content1() {
  return (
    <div
      className="content-stretch flex gap-[12px] items-center relative shrink-0"
      data-name="Content"
    >
      <PlusIcon />
      <p className="font-['General_Sans:Medium',sans-serif] leading-[20px] not-italic relative shrink-0 text-[#d1fadf] text-[14px] text-nowrap">
        Create new request
      </p>
    </div>
  );
}

function NavItemBase({ onClick }: { onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="bg-[#027a48] hover:bg-[#027a48]/90 transition-colors relative rounded-[6px] shrink-0 w-full cursor-pointer"
      data-name="_Nav item base"
    >
      <div className="flex flex-row items-center overflow-clip rounded-[inherit] size-full">
        <div className="content-stretch flex items-center px-[12px] py-[8px] relative w-full">
          <Content1 />
        </div>
      </div>
    </button>
  );
}

function Content2({ title }: { title: string }) {
  return (
    <div
      className="content-stretch flex gap-[12px] items-center relative shrink-0"
      data-name="Content"
    >
      <p className="font-['General_Sans:Medium',sans-serif] leading-[20px] not-italic relative shrink-0 text-[#d0d5dd] text-[14px] text-nowrap">
        {title}
      </p>
    </div>
  );
}

function RecentConversationItem({
  isActive,
  title,
  timeLabel,
  onClick,
  onDelete,
}: {
  isActive?: boolean;
  title: string;
  timeLabel: string;
  onClick?: () => void;
  onDelete?: () => void;
}) {
  return (
    <div
      className={`${isActive ? "bg-[#027a48]" : "bg-transparent hover:bg-[#027a48]/50"} transition-colors relative rounded-[6px] shrink-0 w-full`}
      data-name="_Nav item base"
    >
      <div className="flex flex-row items-end overflow-clip rounded-[inherit] size-full">
        <button
          type="button"
          onClick={onClick}
          className="content-stretch flex items-end justify-between px-[12px] py-[16px] relative w-full cursor-pointer"
        >
          <Content2 title={title} />
          <p className="font-['General_Sans:Regular',sans-serif] leading-none not-italic relative shrink-0 text-[#12b76a] text-[12px] text-nowrap">
            {timeLabel}
          </p>
        </button>
        {onDelete ? (
          <div className="px-[10px] pb-[12px]">
            <button
              type="button"
              aria-label="Delete conversation"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onDelete();
              }}
              className="rounded-[6px] hover:bg-[#027a48]/50 transition-colors p-[6px]"
            >
              <DeleteIcon />
            </button>
          </div>
        ) : null}
      </div>
      {isActive && (
        <div
          aria-hidden="true"
          className="absolute border-[#027a48] border-[0px_0px_1px] border-solid inset-0 pointer-events-none rounded-[6px]"
        />
      )}
    </div>
  );
}

function RecentRequests({ 
  sessions,
  activeSessionId,
  onCreateNewRequest,
  onSelectSession,
  onDeleteSession,
  currentView,
}: { 
  sessions: ConversationSession[];
  activeSessionId: string | null;
  onCreateNewRequest?: () => void;
  onSelectSession?: (sessionId: string) => void;
  onDeleteSession?: (sessionId: string) => void;
  currentView: 'select-category' | 'conversation';
}) {
  return (
    <div
      className="content-stretch flex flex-col items-start relative shrink-0 w-full max-h-[260px] overflow-y-auto"
      data-name="Recent requests"
    >
      {(sessions || []).map((s) => (
        <div key={s.id} className="w-full">
          <RecentConversationItem
            isActive={currentView === 'conversation' && activeSessionId === s.id}
            title={(s.readyToBook && s.bookingCard?.title) ? s.bookingCard.title : (s.summary?.headline || s.title || "New request")}
            timeLabel={formatRelativeTime(s.lastUpdated)}
            onClick={() => onSelectSession?.(s.id)}
            onDelete={onDeleteSession ? () => onDeleteSession(s.id) : undefined}
          />
        </div>
      ))}

      {sessions.length === 0 ? (
        <RecentConversationItem
          isActive={false}
          title="New request"
          timeLabel=""
          onClick={onCreateNewRequest}
        />
      ) : null}
    </div>
  );
}

function Navigation2({ 
  sessions,
  activeSessionId,
  onCreateNewRequest,
  onSelectSession,
  onDeleteSession,
  onClearAllSessions,
  currentView,
}: { 
  sessions: ConversationSession[];
  activeSessionId: string | null;
  onCreateNewRequest?: () => void;
  onSelectSession?: (sessionId: string) => void;
  onDeleteSession?: (sessionId: string) => void;
  onClearAllSessions?: () => void;
  currentView: 'select-category' | 'conversation';
}) {
  return (
    <div
      className="content-stretch flex flex-col gap-[32px] items-start relative shrink-0 w-full"
      data-name="Navigation"
    >
      <NavItemBase onClick={onCreateNewRequest} />
      <div className="content-stretch flex items-center justify-between relative shrink-0 w-full">
        <p className="font-['General_Sans:Medium',sans-serif] leading-[20px] not-italic relative shrink-0 text-[14px] text-nowrap text-white">
          Recents
        </p>
        {sessions.length > 0 ? (
          <button
            type="button"
            onClick={onClearAllSessions}
            className="font-['General_Sans:Regular',sans-serif] text-[12px] text-[#d1fadf] underline hover:opacity-90"
          >
            Clear all
          </button>
        ) : null}
      </div>
      <RecentRequests
        sessions={sessions}
        activeSessionId={activeSessionId}
        onCreateNewRequest={onCreateNewRequest}
        onSelectSession={onSelectSession}
        onDeleteSession={onDeleteSession}
        currentView={currentView}
      />
    </div>
  );
}

// Unified Content5 component for both views
function Content5({
  sessions,
  activeSessionId,
  onCreateNewRequest,
  onSelectSession,
  onDeleteSession,
  onClearAllSessions,
  onBackClick,
  currentView,
}: {
  sessions: ConversationSession[];
  activeSessionId: string | null;
  onCreateNewRequest?: () => void;
  onSelectSession?: (sessionId: string) => void;
  onDeleteSession?: (sessionId: string) => void;
  onClearAllSessions?: () => void;
  onBackClick?: () => void;
  currentView: 'select-category' | 'conversation';
}) {
  return (
    <div
      className="relative shrink-0 w-full"
      data-name="Content"
    >
      <div className="size-full">
        <div className="content-stretch flex flex-col gap-[32px] items-start pb-0 pt-[36px] px-[16px] relative w-full">
          <Header1 onClick={onBackClick} />
          <Navigation2
            sessions={sessions}
            activeSessionId={activeSessionId}
            onCreateNewRequest={onCreateNewRequest}
            onSelectSession={onSelectSession}
            onDeleteSession={onDeleteSession}
            onClearAllSessions={onClearAllSessions}
            currentView={currentView}
          />
        </div>
      </div>
    </div>
  );
}

function Content14() {
  return (
    <div
      className="content-stretch flex gap-[12px] items-center relative shrink-0 w-full"
      data-name="Content"
    >
      <p className="basis-0 font-['General_Sans:Medium',sans-serif] grow leading-[20px] min-h-px min-w-px not-italic relative shrink-0 text-[#d0d5dd] text-[14px]">{`You have 300 city coins left. Subscribe to get more coins. `}</p>
    </div>
  );
}

function SubscriptionLinks() {
  return (
    <div
      className="content-stretch flex gap-[16px] items-start leading-none not-italic relative shrink-0 text-[12px] text-nowrap underline"
      data-name="Subscription links"
    >
      <p className="[text-decoration-skip-ink:none] [text-underline-position:from-font] decoration-solid font-['General_Sans:Regular',sans-serif] relative shrink-0 text-[#d1fadf]">
        See benefits
      </p>
      <p className="[text-decoration-skip-ink:none] [text-underline-position:from-font] decoration-solid font-['General_Sans:Semibold',sans-serif] relative shrink-0 text-white">
        Subscribe now.
      </p>
    </div>
  );
}

function NavItemBase4() {
  return (
    <div
      className="bg-[#027a48] relative rounded-[6px] shrink-0 w-full"
      data-name="_Nav item base"
    >
      <div className="overflow-clip rounded-[inherit] size-full">
        <div className="content-stretch flex flex-col gap-[24px] items-start px-[12px] py-[16px] relative w-full">
          <Content14 />
          <SubscriptionLinks />
        </div>
      </div>
      <div
        aria-hidden="true"
        className="absolute border-[#027a48] border-[0px_0px_1px] border-solid inset-0 pointer-events-none rounded-[6px]"
      />
    </div>
  );
}

// Unified Account component - always shows subscription card
function Account() {
  return (
    <div
      className="relative shrink-0 w-full"
      data-name="Account"
    >
      <div className="size-full">
        <div className="content-stretch flex flex-col items-start pb-[24px] pt-0 px-[20px] relative w-full">
          <NavItemBase4 />
        </div>
      </div>
    </div>
  );
}

// Unified SubNav component for both views
function SubNav({
  onNavigateToAppointment,
  isActive,
  onBackClick,
  currentView,
  sessions,
  activeSessionId,
  onCreateNewRequest,
  onSelectSession,
  onDeleteSession,
  onClearAllSessions,
}: {
  onNavigateToAppointment?: () => void;
  isActive?: boolean;
  onBackClick?: () => void;
  currentView: 'select-category' | 'conversation';
  sessions?: ConversationSession[];
  activeSessionId?: string | null;
  onCreateNewRequest?: () => void;
  onSelectSession?: (sessionId: string) => void;
  onDeleteSession?: (sessionId: string) => void;
  onClearAllSessions?: () => void;
}) {
  const safeSessions = sessions ?? [];
  const safeActiveSessionId = activeSessionId ?? null;
  return (
    <div
      className="bg-[#05603a] content-stretch flex flex-col items-start justify-between relative size-full"
      data-name="Sub nav"
    >
      <Content5
        onBackClick={onBackClick}
        currentView={currentView}
        sessions={safeSessions}
        activeSessionId={safeActiveSessionId}
        onCreateNewRequest={onCreateNewRequest}
        onSelectSession={onSelectSession}
        onDeleteSession={onDeleteSession}
        onClearAllSessions={onClearAllSessions}
      />
      <Account />
    </div>
  );
}

// Unified SidebarNavigation component for both views
export type SidebarNavigationProps = {
  onNavigateToAppointment?: () => void;
  isActive?: boolean;
  onBackClick?: () => void;
  currentView: "select-category" | "conversation";
  onNavigateToHomepage?: () => void;
  onNavigateToMarketplace?: () => void;
  onNavigateToSettings?: () => void;
  onNavigateToServiceRequests?: () => void;
  navCurrentPage?: "homepage" | "chat" | "requests" | "settings" | "marketplace" | "playground";
};

export function SidebarNavigation({
  onNavigateToAppointment,
  isActive,
  onBackClick,
  currentView,
  onNavigateToHomepage,
  onNavigateToMarketplace,
  onNavigateToSettings,
  onNavigateToServiceRequests,
  navCurrentPage = "chat",
}: SidebarNavigationProps) {
  const [, navigate] = useLocation();

  const handleNavigateToHomepage = () => {
    if (onNavigateToHomepage) {
      onNavigateToHomepage();
      return;
    }
    navigate("/resident");
  };

  const handleNavigateToMarketplace = () => {
    if (onNavigateToMarketplace) {
      onNavigateToMarketplace();
      return;
    }
    navigate("/resident/citymart");
  };

  const handleNavigateToSettings = () => {
    if (onNavigateToSettings) {
      onNavigateToSettings();
      return;
    }
    navigate("/resident/settings");
  };

  const handleNavigateToServiceRequests = () => {
    if (onNavigateToServiceRequests) {
      onNavigateToServiceRequests();
      return;
    }
    navigate("/service-requests");
  };

  return (
    <div
      className="bg-[#054f31] content-stretch flex h-full isolate items-start overflow-clip relative shrink-0 w-[362px]"
      data-name="Sidebar navigation"
    >
      <Nav
        onBookServiceClick={onNavigateToAppointment}
        onNavigateToHomepage={handleNavigateToHomepage}
        onNavigateToSettings={handleNavigateToSettings}
        onNavigateToMarketplace={handleNavigateToMarketplace}
        onNavigateToServiceRequests={handleNavigateToServiceRequests}
        currentPage={navCurrentPage}
      />
      <SubNav
        onNavigateToAppointment={onNavigateToAppointment}
        isActive={isActive}
        onBackClick={onBackClick}
        currentView={currentView}
      />
    </div>
  );
}

// ============ SELECT CATEGORY VIEW COMPONENTS ============
function TextAndSupportingText() {
  return (
    <div
      className="basis-0 content-stretch flex flex-col gap-[4px] grow items-start min-h-px min-w-px not-italic relative shrink-0 text-center"
      data-name="Text and supporting text"
    >
      <p className="font-['General_Sans:Medium',sans-serif] leading-[38px] relative shrink-0 text-[#054f31] text-[30px] w-full">
        Select Categories
      </p>
      <p className="font-['General_Sans:Regular',sans-serif] leading-[24px] relative shrink-0 text-[#667085] text-[16px] w-full">
        Choose what type of services you need rendered
      </p>
    </div>
  );
}

function Content7() {
  return (
    <div
      className="content-stretch flex gap-[16px] items-start justify-center relative shrink-0 w-full"
      data-name="Content"
    >
      <TextAndSupportingText />
    </div>
  );
}

function Search() {
  return (
    <div
      className="relative shrink-0 size-[16px]"
      data-name="search"
    >
      <svg
        className="block size-full"
        fill="none"
        preserveAspectRatio="none"
        viewBox="0 0 16 16"
      >
        <g id="search">
          <path
            d={svgPaths.p24e04a80}
            id="Icon"
            stroke="var(--stroke-0, #667085)"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.66667"
          />
        </g>
      </svg>
    </div>
  );
}

function Content8({
  searchQuery,
  setSearchQuery,
}: {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
}) {
  return (
    <div
      className="basis-0 content-stretch flex gap-[8px] grow items-center min-h-px min-w-px relative shrink-0"
      data-name="Content"
    >
      <Search />
      <input
        type="text"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        placeholder="Search Categories"
        className="font-['General_Sans:Regular',sans-serif] leading-[24px] not-italic flex-1 text-[#667085] text-[12px] bg-transparent outline-none border-none"
      />
    </div>
  );
}

function InputWithLabel({
  searchQuery,
  setSearchQuery,
}: {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
}) {
  return (
    <div
      className="basis-0 grow min-h-px min-w-px relative shrink-0 w-full"
      data-name="Input with label"
    >
      <div className="size-full">
        <div className="content-stretch flex flex-col gap-[6px] items-start relative size-full">
          <div
            className="bg-[#f2f4f7] relative rounded-[8px] shrink-0 w-full"
            data-name="_Input"
          >
            <div className="flex flex-row items-center size-full">
              <div className="content-stretch flex items-center px-[12px] py-[6px] relative w-full">
                <Content8
                  searchQuery={searchQuery}
                  setSearchQuery={setSearchQuery}
                />
              </div>
            </div>
            <div
              aria-hidden="true"
              className="absolute border border-[#f2f4f7] border-solid inset-0 pointer-events-none rounded-[8px] shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function InputDropdown({
  searchQuery,
  setSearchQuery,
}: {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
}) {
  return (
    <div
      className="h-[44px] relative shrink-0 w-full"
      data-name="Input dropdown"
    >
      <div
        className="absolute content-stretch flex flex-col items-stretch left-0 right-0 top-0 w-full"
        data-name="_Input dropdown base"
      >
        <InputWithLabel
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
        />
      </div>
    </div>
  );
}

function Container1({
  searchQuery,
  setSearchQuery,
}: {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
}) {
  return (
    <div
      className="relative shrink-0 w-full"
      data-name="Container"
    >
      <div className="flex flex-col items-center size-full">
        <div className="content-stretch flex flex-col gap-[24px] items-center px-[32px] py-0 relative w-full">
          <Content7 />
          <div className="w-full flex justify-center">
            <div className="w-full lg:max-w-[720px] lg:min-w-[500px]">
              <InputDropdown
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Extended Container that supports an estate selector. Kept separate
// to minimize disruption to existing layout for other callers.
function ContainerWithEstate({
  searchQuery,
  setSearchQuery,
  myEstates,
  selectedEstateName,
  setSelectedEstateName,
  isOutsideCityConnectEstate,
  setIsOutsideCityConnectEstate,
}: {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  myEstates?: any[];
  selectedEstateName: string | null;
  setSelectedEstateName: (s: string | null) => void;
  isOutsideCityConnectEstate: boolean;
  setIsOutsideCityConnectEstate: (b: boolean) => void;
}) {
  const { user } = useAuth();
  const [adminEstates, setAdminEstates] = useState<any[] | null>(null);
  const [adminLoading, setAdminLoading] = useState(false);
  const [adminError, setAdminError] = useState<string | null>(null);

  useEffect(() => {
    let canceled = false;
    // Prefer the caller-provided `myEstates` for resident users.
    if (myEstates && myEstates.length) {
      setAdminEstates(myEstates);
      setAdminError(null);
      setAdminLoading(false);
      return;
    }

    // Only call the admin endpoint when the current user is an admin/estate admin.
    const isAdminUser = Boolean(
      user && (user.role === "admin" || user.role === "estate_admin" || user.globalRole === "super_admin"),
    );
    if (!isAdminUser) {
      // Do not attempt admin fetch for non-admin users to avoid 401s.
      setAdminEstates(null);
      setAdminError(null);
      setAdminLoading(false);
      return;
    }

    setAdminLoading(true);
    fetch("/api/admin/estates")
      .then((res) => {
        if (!res.ok) throw new Error(`status:${res.status}`);
        return res.json();
      })
      .then((rows: any[]) => {
        if (!canceled) {
          setAdminEstates(rows || []);
          setAdminError(null);
        }
      })
      .catch((err: any) => {
        if (!canceled) {
          setAdminEstates(null);
          setAdminError(err?.message || String(err));
        }
      })
      .finally(() => {
        if (!canceled) setAdminLoading(false);
      });
    return () => {
      canceled = true;
    };
  }, [myEstates, user]);

  const estatesToShow = (adminEstates && adminEstates.length > 0) ? adminEstates : (myEstates || []);
  return (
    <div
      className="relative shrink-0 w-full"
      data-name="Container"
    >
      <div className="flex flex-col items-center size-full">
        <div className="content-stretch flex flex-col gap-[12px] items-center px-[32px] py-0 relative w-full">
          <Content7 />

          <div className="w-full flex justify-center">
            <div className="w-full lg:max-w-[720px] lg:min-w-[500px]">
              <div className="flex items-center gap-3">
                <div className="w-44">
                  <label className="sr-only">Estate</label>
                  <select
                    value={selectedEstateName ?? "__none__"}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v === "__none__") {
                        setSelectedEstateName(null);
                        setIsOutsideCityConnectEstate(false);
                      } else {
                        setSelectedEstateName(v);
                        setIsOutsideCityConnectEstate(false);
                      }
                    }}
                    className="w-full rounded border border-gray-200 p-2 bg-white"
                    aria-label="Select estate"
                  >
                    <option value="__none__">Not Estate specific</option>
                    {estatesToShow.map((es: any) => (
                      <option key={es.id || es._id || es.name} value={es.name || es.id}>
                        {es.name || es.id}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex-1">
                  <InputDropdown
                    searchQuery={searchQuery}
                    setSearchQuery={setSearchQuery}
                  />
                </div>
              </div>

              {/* Debug panel removed */}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function HeaderSection({
  searchQuery,
  setSearchQuery,
}: {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
}) {
  return (
    <div
      className="content-stretch flex flex-col items-start relative shrink-0 w-full"
      data-name="Header section"
    >
      <Container1
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
      />
    </div>
  );
}

function HeaderSectionWithEstate({
  searchQuery,
  setSearchQuery,
  myEstates,
  selectedEstateName,
  setSelectedEstateName,
  isOutsideCityConnectEstate,
  setIsOutsideCityConnectEstate,
}: {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  myEstates?: any[];
  selectedEstateName: string | null;
  setSelectedEstateName: (s: string | null) => void;
  isOutsideCityConnectEstate: boolean;
  setIsOutsideCityConnectEstate: (b: boolean) => void;
}) {
  return (
    <div
      className="content-stretch flex flex-col items-start relative shrink-0 w-full"
      data-name="Header section"
    >
      <ContainerWithEstate
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        myEstates={myEstates}
        selectedEstateName={selectedEstateName}
        setSelectedEstateName={setSelectedEstateName}
        isOutsideCityConnectEstate={isOutsideCityConnectEstate}
        setIsOutsideCityConnectEstate={setIsOutsideCityConnectEstate}
      />
    </div>
  );
}

// Category Cards
function Avatar1() {
  return (
    <div
      className="mr-[-4px] pointer-events-none relative rounded-[200px] shrink-0 size-[24px]"
      data-name="Avatar"
    >
      <div
        aria-hidden="true"
        className="absolute inset-0 rounded-[200px]"
      >
        <div className="absolute bg-[#ccc0dd] inset-0 rounded-[200px]" />
        <img
          alt=""
          className="absolute max-w-none object-50%-50% object-cover rounded-[200px] size-full"
          src={imgAvatarCategory1}
        />
      </div>
      <div
        aria-hidden="true"
        className="absolute border-[1.5px] border-solid border-white inset-[-1.5px] rounded-[201.5px]"
      />
    </div>
  );
}

function Avatar3() {
  return (
    <div
      className="mr-[-4px] pointer-events-none relative rounded-[200px] shrink-0 size-[24px]"
      data-name="Avatar"
    >
      <div
        aria-hidden="true"
        className="absolute inset-0 rounded-[200px]"
      >
        <div className="absolute bg-[#abb677] inset-0 rounded-[200px]" />
        <img
          alt=""
          className="absolute max-w-none object-50%-50% object-cover rounded-[200px] size-full"
          src={imgAvatarCategory2}
        />
      </div>
      <div
        aria-hidden="true"
        className="absolute border-[1.5px] border-solid border-white inset-[-1.5px] rounded-[201.5px]"
      />
    </div>
  );
}

function Avatar4() {
  return (
    <div
      className="mr-[-4px] pointer-events-none relative rounded-[200px] shrink-0 size-[24px]"
      data-name="Avatar"
    >
      <div
        aria-hidden="true"
        className="absolute inset-0 rounded-[200px]"
      >
        <div className="absolute bg-[#a36ddb] inset-0 rounded-[200px]" />
        <img
          alt=""
          className="absolute max-w-none object-50%-50% object-cover rounded-[200px] size-full"
          src={imgAvatarCategory3}
        />
      </div>
      <div
        aria-hidden="true"
        className="absolute border-[1.5px] border-solid border-white inset-[-1.5px] rounded-[201.5px]"
      />
    </div>
  );
}

function AvatarLabelGroup({ count }: { count: string }) {
  return (
    <div
      className="content-stretch flex gap-[8px] items-center relative shrink-0"
      data-name="Avatar label group"
    >
      <div
        className="content-stretch flex items-start relative shrink-0"
        data-name="Avatar group"
      >
        <Avatar1 />
        <Avatar3 />
        <Avatar4 />
      </div>
      <p className="font-['General_Sans:Regular',sans-serif] leading-[20px] not-italic relative shrink-0 text-[#027a48] text-[14px] text-nowrap">
        {count}
      </p>
    </div>
  );
}

interface CategoryCardProps {
  icon: string;
  title: string;
  count: string;
  onClick?: () => void;
}

function MetricItem({
  icon,
  title,
  count,
  onClick,
}: CategoryCardProps) {
  return (
    <button
      className="bg-white border border-border hover:shadow-md active:shadow-sm transition-shadow cursor-pointer relative rounded-[12px] w-full h-full text-left"
      onClick={onClick}
    >
      <div className="flex flex-col justify-between size-full">
        <div className="content-stretch flex flex-col gap-[20px] items-start px-[24px] py-[20px] relative w-full">
          <div className="text-[40px]">{icon}</div>
          <div className="content-stretch flex flex-col gap-[8px] items-start relative shrink-0 w-full">
            <p className="font-['General_Sans:Medium',sans-serif] leading-[24px] not-italic relative shrink-0 text-[#054f31] text-[16px] text-nowrap">
              {title}
            </p>
            <AvatarLabelGroup count={count} />
          </div>
        </div>
      </div>
      <div
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none rounded-[12px]"
      />
    </button>
  );
}

// `useCategories` must be called inside a React component. The hook is
// invoked in `ChatInterface` and the resulting data is passed down to
// the select-category components as props.

function Content11({
  searchQuery,
  onCategorySelect,
  categoriesData,
  catsLoading,
}: {
  searchQuery: string;
  onCategorySelect?: (categoryName: string) => void;
  categoriesData?: any[];
  catsLoading?: boolean;
}) {
  const mapped = (categoriesData || []).map((c: any) => ({
    icon: (c.emoji as string) || "🛠️",
    title: c.name || c.key || String(c.id || c),
    count: c.providerCount ? `+${c.providerCount} Providers` : "",
  }));
  const filteredCategories = mapped.filter((cat) =>
    cat.title.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  return (
    <div
      className="relative shrink-0 w-full"
      data-name="Content"
    >
      <div className="size-full">
        <div className="content-stretch flex flex-col gap-[24px] items-start p-[24px] relative w-full">
          {(catsLoading) ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-[16px] w-full auto-rows-fr">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="animate-pulse bg-gray-100 dark:bg-gray-800 rounded p-6 h-28" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-[16px] w-full auto-rows-fr">
              {filteredCategories.map((category, index) => (
                <MetricItem
                  key={index}
                  icon={category.icon}
                  title={category.title}
                  count={category.count}
                  onClick={() => onCategorySelect?.(category.title)}
                />
              ))}
            </div>
          )}
          {(!catsLoading && filteredCategories.length === 0) && (
            <div className="w-full text-center py-8">
              <p className="font-['General_Sans:Regular',sans-serif] text-[#667085] text-[16px]">
                No categories found matching "{searchQuery}"
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Form({
  searchQuery,
  onCategorySelect,
  categoriesData,
  catsLoading,
}: {
  searchQuery: string;
  onCategorySelect?: (categoryName: string) => void;
  categoriesData?: any[];
  catsLoading?: boolean;
}) {
  return (
    <div
      className="bg-white content-stretch flex flex-col items-start overflow-clip relative rounded-[8px] self-stretch shadow-sm w-full"
      data-name="Form"
    >
      <Content11
        searchQuery={searchQuery}
        onCategorySelect={onCategorySelect}
        categoriesData={categoriesData}
        catsLoading={catsLoading}
      />
    </div>
  );
}

function Content12({
  searchQuery,
  onCategorySelect,
  categoriesData,
  catsLoading,
}: {
  searchQuery: string;
  onCategorySelect?: (categoryName: string) => void;
  categoriesData?: any[];
  catsLoading?: boolean;
}) {
  return (
    <div className="flex-1 min-h-0 overflow-y-auto w-full" data-name="Content">
      <div className="flex flex-row justify-center w-full">
        <div className="w-full max-w-6xl px-[32px] pb-[32px]">
          <Form searchQuery={searchQuery} onCategorySelect={onCategorySelect} categoriesData={categoriesData} catsLoading={catsLoading} />
        </div>
      </div>
    </div>
  );
}

function MainSelectCategory({
  searchQuery,
  setSearchQuery,
  onCategorySelect,
  categoriesData,
  catsLoading,
  myEstates,
  selectedEstateName,
  setSelectedEstateName,
  isOutsideCityConnectEstate,
  setIsOutsideCityConnectEstate,
}: {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  onCategorySelect?: (categoryName: string) => void;
  categoriesData?: any[];
  catsLoading?: boolean;
  myEstates?: any[];
  selectedEstateName?: string | null;
  setSelectedEstateName?: (s: string | null) => void;
  isOutsideCityConnectEstate?: boolean;
  setIsOutsideCityConnectEstate?: (b: boolean) => void;
}) {
  return (
    <div
      className="bg-white content-stretch flex flex-col gap-[32px] items-start h-full min-h-0 w-full pb-[0px] pt-[16px] px-0 relative rounded-bl-[40px] rounded-tl-[40px]"
      data-name="Main"
    >
      {setSelectedEstateName ? (
        <HeaderSectionWithEstate
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          myEstates={myEstates}
          selectedEstateName={selectedEstateName ?? null}
          setSelectedEstateName={setSelectedEstateName!}
          isOutsideCityConnectEstate={!!isOutsideCityConnectEstate}
          setIsOutsideCityConnectEstate={setIsOutsideCityConnectEstate!}
        />
      ) : (
        <HeaderSection
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
        />
      )}
      <Content12
        searchQuery={searchQuery}
        onCategorySelect={onCategorySelect}
        categoriesData={categoriesData}
        catsLoading={catsLoading}
      />
    </div>
  );
}

function MainWrapSelectCategory({
  searchQuery,
  setSearchQuery,
  onCategorySelect,
  categoriesData,
  catsLoading,
  myEstates,
  selectedEstateName,
  setSelectedEstateName,
  isOutsideCityConnectEstate,
  setIsOutsideCityConnectEstate,
}: {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  onCategorySelect?: (categoryName: string) => void;
  categoriesData?: any[];
  catsLoading?: boolean;
  myEstates?: any[];
  selectedEstateName?: string | null;
  setSelectedEstateName?: (s: string | null) => void;
  isOutsideCityConnectEstate?: boolean;
  setIsOutsideCityConnectEstate?: (b: boolean) => void;
}) {
  return (
    <div
      className="basis-0 grow h-full min-h-px min-w-px relative shrink-0"
      data-name="Main wrap"
    >
      <div className="size-full">
        <div className="content-stretch flex flex-col items-start pb-0 pl-[14px] pr-0 pt-[12px] relative size-full">
          <MainSelectCategory
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            onCategorySelect={onCategorySelect}
            categoriesData={categoriesData}
            catsLoading={catsLoading}
            myEstates={myEstates}
            selectedEstateName={selectedEstateName}
            setSelectedEstateName={setSelectedEstateName}
            isOutsideCityConnectEstate={isOutsideCityConnectEstate}
            setIsOutsideCityConnectEstate={setIsOutsideCityConnectEstate}
          />
        </div>
      </div>
    </div>
  );
}

// ============ CHAT VIEW COMPONENTS ============
function Frame30NewMain({ 
  step,
  history,
  isHistoryLoading,
  selectedCategory,
  onChangeCategory,
  onViewServiceRequest,
  bookingCard,
  priceEstimationCard,
  providerMatchingPreview,
  onPrimaryBookingAction,
  onSecondaryBookingAction,
  onAskFollowUp,
  onProfessionalConsultancy,
  onViewMoreProviders,
  onAdjustDetails,
  onRemoveBookingImage,
  onOpenProviderComparison,
  selectedProviderId,
  onViewSelectedProvider,
}: { 
  step: ConversationStep;
  history: HistoryItem[];
  isHistoryLoading?: boolean;
  selectedCategory?: string;
  onChangeCategory?: () => void;
  onViewServiceRequest?: (id: string) => void;
  bookingCard?: BookingCard | null;
  priceEstimationCard?: PriceEstimationCard | null;
  providerMatchingPreview?: ProviderMatchingPreview | null;
  onPrimaryBookingAction?: () => void;
  onSecondaryBookingAction?: () => void;
  onAskFollowUp?: () => void;
  onProfessionalConsultancy?: () => void;
  onViewMoreProviders?: () => void;
  onOpenProviderComparison?: (providers: ProviderComparisonItem[]) => void;
  onAdjustDetails?: () => void;
  onRemoveBookingImage?: (src: string) => void;
  selectedProviderId?: string | null;
  onViewSelectedProvider?: (id?: string) => void;
}) {
  return (
    <div className="content-stretch flex flex-col items-start overflow-x-clip relative shrink-0 w-full pt-[0px] pr-[0px] pb-[24px] pl-[0px] mt-[0px] mr-[0px] mb-[0px] ml-[0px]">
      {isHistoryLoading ? (
        <div className="w-full space-y-3 pb-[12px]">
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-5 w-2/3" />
          <Skeleton className="h-5 w-1/2" />
        </div>
      ) : null}
      {history.map((item) => {
        switch (item.type) {
          case "user_text":
            return <UserResponse key={item.id} text={item.text} />;
          case "ai_message":
            return <AIMessage key={item.id} text={item.text} />;
          case "image":
            return <HistoryImageBubble key={item.id} src={item.src} />;
          case "ticket":
            return (
              <TicketMessage
                key={item.id}
                requestId={item.serviceRequestId}
                title={item.title}
                status={item.status}
                createdAtIso={item.createdAtIso}
                onViewRequest={() => {
                  if (!item.serviceRequestId) return;
                  onViewServiceRequest?.(item.serviceRequestId);
                }}
              />
            );
          default:
            return null;
        }
      })}

      {bookingCard ? (
        <div className="w-full">
          <AIMessage
            text={
              "I have enough information to help you move forward. Here’s a summary of what this would look like if you decide to book a service."
            }
          />
          <div className="bg-white rounded-[12px] border border-[#EAECF0] overflow-hidden w-full">
            <div className="px-[20px] py-[16px]">
              <p className="text-[16px] text-[#101828] font-['General_Sans:Semibold',sans-serif]">Payment summary</p>
              <p className="text-[12px] text-[#667085]">Preview only — nothing will be submitted automatically</p>
            </div>

            <div className="px-[20px] pb-[16px]">
              <p className="text-[14px] text-[#101828] font-['General_Sans:Medium',sans-serif]">{bookingCard.title}</p>
              <p className="text-[12px] text-[#667085] whitespace-pre-line mt-[6px]">{bookingCard.summary}</p>

              <div className="mt-[14px] space-y-[12px]">
                <div className="flex items-start justify-between gap-[12px] pb-[12px] border-b border-[#EAECF0]">
                  <div className="flex items-start gap-[12px]">
                    <div className="relative mt-[2px]">
                      <div className="w-[18px] h-[18px] rounded-full border-[2px] border-[#101828] flex items-center justify-center">
                        <div className="w-[6px] h-[6px] rounded-full bg-[#101828]" />
                      </div>
                    </div>
                    <div>
                      <p className="text-[13px] text-[#101828] font-['General_Sans:Medium',sans-serif]">
                        {bookingCard.recommendedServiceType}
                      </p>
                      <p className="text-[12px] text-[#667085]">{bookingCard.estimatedScope}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p
                      className={
                        bookingCard.urgency === "high"
                          ? "text-[12px] text-[#D92D20] font-['General_Sans:Medium',sans-serif]"
                          : "text-[12px] text-[#667085]"
                      }
                    >
                      Urgency: {bookingCard.urgency}
                    </p>
                    {bookingCard.location ? (
                      <p className="text-[12px] text-[#667085] mt-[4px]">{bookingCard.location}</p>
                    ) : null}
                  </div>
                </div>

                {bookingCard.recommendedServiceType === "Consultancy" ? (
                  <div className="bg-[#f9fafb] border border-[#EAECF0] rounded-[12px] px-[12px] py-[10px]">
                    <div className="flex items-center justify-between">
                      <p className="text-[12px] text-[#667085]">Consultancy</p>
                      <p className="text-[12px] text-[#101828] font-['General_Sans:Medium',sans-serif]">₦ 4,500</p>
                    </div>
                    <div className="flex items-center justify-between mt-[6px]">
                      <p className="text-[12px] text-[#667085]">Tax</p>
                      <p className="text-[12px] text-[#101828] font-['General_Sans:Medium',sans-serif]">₦ 2,000</p>
                    </div>
                    <div className="flex items-center justify-between mt-[10px] pt-[10px] border-t border-[#EAECF0]">
                      <p className="text-[12px] text-[#667085]">Total</p>
                      <p className="text-[14px] text-[#101828] font-['General_Sans:Semibold',sans-serif]">₦ 6,500</p>
                    </div>
                  </div>
                ) : null}

                {Array.isArray(bookingCard.imagePreview) && bookingCard.imagePreview.length > 0 ? (
                  <div className="pt-[4px]">
                    <p className="text-[12px] text-[#667085] mb-[8px]">Images (remove any before booking)</p>
                    <div className="flex flex-wrap gap-[10px]">
                      {bookingCard.imagePreview.map((src) => (
                        <div key={src} className="relative w-[72px] h-[72px] rounded-[10px] overflow-hidden border border-[#EAECF0]">
                          <img src={src} alt="Uploaded" className="w-full h-full object-cover" />
                          {onRemoveBookingImage ? (
                            <button
                              type="button"
                              aria-label="Remove image from booking preview"
                              onClick={() => onRemoveBookingImage(src)}
                              className="absolute top-[6px] right-[6px] bg-white/90 border border-[#EAECF0] rounded-[8px] px-[6px] py-[2px] text-[12px]"
                            >
                              ×
                            </button>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="mt-[16px] flex flex-wrap gap-[10px]">
                {onSecondaryBookingAction && bookingCard.callToActions.secondary ? (
                  <OutlineButton onClick={onSecondaryBookingAction}>{bookingCard.callToActions.secondary}</OutlineButton>
                ) : null}
                {onPrimaryBookingAction ? (
                  <SecButton onClick={onPrimaryBookingAction}>{bookingCard.callToActions.primary}</SecButton>
                ) : null}
              </div>
            </div>
          </div>

          {priceEstimationCard ? (
            <div className="mt-[16px] w-full">
              <AIMessage text="Based on what you’ve shared, here’s a rough estimate so you know what to expect." />

              <div className="bg-white rounded-[12px] border border-[#EAECF0] overflow-hidden w-full">
                <div className="px-[20px] py-[16px] border-b border-[#EAECF0]">
                  <p className="text-[16px] text-[#101828] font-['General_Sans:Semibold',sans-serif]">
                    Price estimate
                  </p>
                  <p className="text-[12px] text-[#667085]">Estimate only — no charges, no automatic booking</p>
                </div>

                <div className="px-[20px] py-[16px]">
                  <div className="flex items-start justify-between gap-[12px]">
                    <div className="min-w-0">
                      <p className="text-[14px] text-[#101828] font-['General_Sans:Medium',sans-serif]">
                        {priceEstimationCard.title}
                      </p>
                      <p className="text-[12px] text-[#667085] mt-[4px]">
                        Confidence: {priceEstimationCard.confidenceLevel}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-[16px] text-[#101828] font-['General_Sans:Semibold',sans-serif]">
                        {formatNgnRange(priceEstimationCard.estimatedRange.min, priceEstimationCard.estimatedRange.max)}
                      </p>
                      {bookingCard.urgency === "high" ? (
                        <p className="text-[12px] text-[#D92D20] mt-[2px]">Includes urgency uplift (~25%)</p>
                      ) : null}
                    </div>
                  </div>

                  {Array.isArray(priceEstimationCard.pricingBasis) && priceEstimationCard.pricingBasis.length > 0 ? (
                    <div className="mt-[12px]">
                      <p className="text-[12px] text-[#667085]">Pricing basis</p>
                      <ul className="list-disc pl-[18px] text-[12px] text-[#475467] mt-[6px] space-y-[4px]">
                        {priceEstimationCard.pricingBasis.map((b) => (
                          <li key={b}>{b}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  <div className="mt-[12px] bg-[#f9fafb] border border-[#EAECF0] rounded-[12px] px-[12px] py-[10px]">
                    <p className="text-[12px] text-[#667085]">Disclaimer</p>
                    <p className="text-[12px] text-[#475467] mt-[4px]">{priceEstimationCard.disclaimer}</p>
                  </div>

                  {priceEstimationCard.notes ? (
                    <p className="text-[12px] text-[#667085] mt-[10px]">{priceEstimationCard.notes}</p>
                  ) : null}

                  <div className="mt-[14px] flex flex-wrap gap-[10px]">
                    {priceEstimationCard.callToActions.secondary ? (
                      <OutlineButton onClick={onAskFollowUp ?? onSecondaryBookingAction}>
                        {priceEstimationCard.callToActions.secondary}
                      </OutlineButton>
                    ) : null}
                    {priceEstimationCard.callToActions.primary ? (
                      <SecButton
                        onClick={
                          priceEstimationCard.callToActions.primary === "Request professional assessment"
                            ? (onProfessionalConsultancy ?? onPrimaryBookingAction)
                            : onPrimaryBookingAction
                        }
                      >
                        {priceEstimationCard.callToActions.primary}
                      </SecButton>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          ) : null}
          {priceEstimationCard ? (
            <div className="mt-[16px] w-full">
              <AIMessage
                text="Based on what you’ve shared, here are professionals who typically handle requests like this. You can review them before deciding."
              />

              <div className="bg-white rounded-[12px] border border-[#EAECF0] overflow-hidden w-full">
                <div className="px-[20px] py-[16px] border-b border-[#EAECF0]">
                  <p className="text-[16px] text-[#101828] font-['General_Sans:Semibold',sans-serif]">
                    Provider matching preview
                  </p>
                  <p className="text-[12px] text-[#667085]">Preview only — no assignment, no guaranteed availability</p>
                </div>

                <div className="px-[20px] py-[16px]">
                  {providerMatchingPreview?.note ? (
                    <div className="bg-[#f9fafb] border border-[#EAECF0] rounded-[12px] px-[12px] py-[10px] mb-[12px]">
                      <p className="text-[12px] text-[#475467]">{providerMatchingPreview.note}</p>
                    </div>
                  ) : null}

                  {Array.isArray(providerMatchingPreview?.providers) && providerMatchingPreview!.providers.length > 0 ? (
                    <div className="space-y-[12px]">
                      {providerMatchingPreview!.providers.map((p) => (
                        <div key={p.id} className="border border-[#EAECF0] rounded-[12px] px-[12px] py-[12px]">
                          <div className="flex items-start justify-between gap-[12px]">
                            <div className="min-w-0">
                              <p className="text-[14px] text-[#101828] font-['General_Sans:Medium',sans-serif] truncate">
                                {p.name}
                              </p>
                              <p className="text-[12px] text-[#667085] mt-[2px]">
                                {formatStarRating(p.rating)} · {Number(p.rating || 0).toFixed(1)}
                              </p>
                            </div>
                            <div className="shrink-0">
                              <span className="inline-flex items-center gap-[6px] text-[12px] text-[#475467] bg-[#f9fafb] border border-[#EAECF0] rounded-[999px] px-[10px] py-[4px]">
                                {p.verificationStatus === "Verified" ? "Verified" : "Pending"}
                              </span>
                            </div>
                          </div>

                          <div className="mt-[10px] grid grid-cols-1 sm:grid-cols-2 gap-[10px]">
                            <div>
                              <p className="text-[12px] text-[#667085]">Completed jobs</p>
                              <p className="text-[12px] text-[#101828] font-['General_Sans:Medium',sans-serif]">{p.completedJobs}</p>
                            </div>
                            <div>
                              <p className="text-[12px] text-[#667085]">Estimated response</p>
                              <p className="text-[12px] text-[#101828] font-['General_Sans:Medium',sans-serif]">{p.responseTime}</p>
                            </div>
                            <div className="sm:col-span-2">
                              <p className="text-[12px] text-[#667085]">Coverage / location</p>
                              <p className="text-[12px] text-[#101828] font-['General_Sans:Medium',sans-serif]">{p.location}</p>
                            </div>
                          </div>

                          {Array.isArray(p.badges) && p.badges.length > 0 ? (
                            <div className="mt-[10px] flex flex-wrap gap-[8px]">
                              {p.badges.slice(0, 3).map((b) => (
                                <span
                                  key={b}
                                  className="text-[12px] text-[#475467] bg-[#f9fafb] border border-[#EAECF0] rounded-[999px] px-[10px] py-[4px]"
                                >
                                  {b}
                                </span>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="bg-[#f9fafb] border border-[#EAECF0] rounded-[12px] px-[12px] py-[10px]">
                      <p className="text-[12px] text-[#475467]">
                        I couldn’t find any verified providers to preview right now. You can still continue, schedule for later, or request a consultation.
                      </p>
                    </div>
                  )}

                  <div className="mt-[14px] flex flex-wrap gap-[10px]">
                    {onViewMoreProviders ? (
                      <OutlineButton onClick={onViewMoreProviders}>View more providers</OutlineButton>
                    ) : null}
                    {Array.isArray(providerMatchingPreview?.providers) && providerMatchingPreview.providers.length >= 2 ? (
                      <OutlineButton onClick={() => {
                        const mapped = providerMatchingPreview.providers.map((p: any) => ({
                          id: String(p.id),
                          name: String(p.name ?? "Unknown"),
                          rating: Number(p.rating ?? 0),
                          completedJobs: Number(p.completedJobs ?? 0),
                          responseTime: String(p.responseTime ?? "Not available"),
                          locationCoverage: String(p.location ?? "Not available"),
                          verificationStatus: (p.verificationStatus === "Verified" ? "Verified" : "Pending") as ProviderComparisonItem["verificationStatus"],
                          yearsExperience: (p.metadata && p.metadata.yearsExperience) ? Number(p.metadata.yearsExperience) : undefined,
                          badges: Array.isArray(p.badges) ? p.badges.map((b: any) => String(b)) : [],
                          estimatedStartingPrice: (p.metadata && p.metadata.estimatedStartingPrice) ? Number(p.metadata.estimatedStartingPrice) : undefined,
                          availability: (p.metadata && p.metadata.availability) ? String(p.metadata.availability) : undefined,
                        }));
                        onOpenProviderComparison?.(mapped);
                      }}>Compare providers</OutlineButton>
                    ) : null}
                    {onAskFollowUp ? (
                      <OutlineButton onClick={onAskFollowUp}>Ask a question</OutlineButton>
                    ) : null}
                    {onAdjustDetails ? (
                      <OutlineButton onClick={onAdjustDetails}>Adjust details</OutlineButton>
                    ) : null}
                    {onPrimaryBookingAction ? (
                      <SecButton onClick={onPrimaryBookingAction}>Proceed to booking</SecButton>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function RequestDetailsNewMain({ 
  step,
  history,
  isHistoryLoading,
  selectedCategory,
  onChangeCategory,
  onViewServiceRequest,
  bookingCard,
  priceEstimationCard,
  providerMatchingPreview,
  onPrimaryBookingAction,
  onSecondaryBookingAction,
  onAskFollowUp,
  onProfessionalConsultancy,
  onViewMoreProviders,
  onAdjustDetails,
  onRemoveBookingImage,
  onOpenProviderComparison,
  selectedProviderId,
  onViewSelectedProvider,
}: { 
  step: ConversationStep;
  history: HistoryItem[];
  isHistoryLoading?: boolean;
  selectedCategory?: string;
  onChangeCategory?: () => void;
  onViewServiceRequest?: (id: string) => void;
  bookingCard?: BookingCard | null;
  priceEstimationCard?: PriceEstimationCard | null;
  providerMatchingPreview?: ProviderMatchingPreview | null;
  onPrimaryBookingAction?: () => void;
  onSecondaryBookingAction?: () => void;
  onAskFollowUp?: () => void;
  onProfessionalConsultancy?: () => void;
  onViewMoreProviders?: () => void;
  onAdjustDetails?: () => void;
  onRemoveBookingImage?: (src: string) => void;
  onOpenProviderComparison?: (providers: ProviderComparisonItem[]) => void;
  selectedProviderId?: string | null;
  onViewSelectedProvider?: (id?: string) => void;
}) {
  return (
    <div
      className="content-stretch flex flex-col items-start relative shrink-0 w-full"
      data-name="Request details"
    >
      <Frame30NewMain 
        step={step}
        history={history}
        isHistoryLoading={isHistoryLoading}
        selectedCategory={selectedCategory}
        onChangeCategory={onChangeCategory}
        onViewServiceRequest={onViewServiceRequest}
        bookingCard={bookingCard}
        priceEstimationCard={priceEstimationCard}
        providerMatchingPreview={providerMatchingPreview}
        onPrimaryBookingAction={onPrimaryBookingAction}
        onSecondaryBookingAction={onSecondaryBookingAction}
        onAskFollowUp={onAskFollowUp}
        onProfessionalConsultancy={onProfessionalConsultancy}
        onViewMoreProviders={onViewMoreProviders}
        onOpenProviderComparison={onOpenProviderComparison}
        selectedProviderId={selectedProviderId}
        onViewSelectedProvider={onViewSelectedProvider}
        onAdjustDetails={onAdjustDetails}
        onRemoveBookingImage={onRemoveBookingImage}
      />
    </div>
  );
}

function ActiveStepBlock({
  step,
  activeFlowStep,
  flowAnswers,
  onSetFlowAnswer,
  onAnswerAndAdvance,
  myEstates,
  selectedEstateName,
  isOutsideCityConnectEstate,
  useManualEstate,
  onToggleManualEstate,
  onSelectEstate,
  startDate,
  startTime,
  startQuickTag,
  onStartDateChange,
  onStartTimeChange,
  onSelectStartQuickTag,
  onContinueTiming,
  onAskForImageUpload,
  onSkipImage,
  onImageSelected,
  fileInputRef,
  aiResponse,
  canBookProfessional,
  onBookProfessional,
  showProfessionalConsultancy,
  onProfessionalConsultancy,
  onBuyOnCityMart,
  onAskFollowUp,
}: {
  step: ConversationStep;
  activeFlowStep: StepConfig | null;
  flowAnswers: Record<string, string>;
  onSetFlowAnswer: (stepId: string, value: string) => void;
  onAnswerAndAdvance: (stepId: string, answerText: string) => void;
  myEstates: Array<{ id: string; name: string }>;
  selectedEstateName: string | null;
  isOutsideCityConnectEstate: boolean;
  useManualEstate: boolean;
  onToggleManualEstate: () => void;
  onSelectEstate: (value: string) => void;
  startDate: string;
  startTime: string;
  startQuickTag: string | null;
  onStartDateChange: (value: string) => void;
  onStartTimeChange: (value: string) => void;
  onSelectStartQuickTag: (tag: string) => void;
  onContinueTiming: () => void;
  onAskForImageUpload: () => void;
  onSkipImage: () => void;
  onImageSelected: (file: File) => void;
  fileInputRef: RefObject<HTMLInputElement>;
  aiResponse: CityBuddyAiResponse | null;
  canBookProfessional: boolean;
  onBookProfessional: () => void;
  showProfessionalConsultancy: boolean;
  onProfessionalConsultancy: () => void;
  onBuyOnCityMart: () => void;
  onAskFollowUp: () => void;
}) {

  const showFlow = step === "FLOW" && activeFlowStep;

  return (
    <div className="w-full flex flex-col gap-[12px]">
      {showFlow && activeFlowStep?.inputMode === "dropdown" && activeFlowStep.id === "estate" && !useManualEstate ? (
        <SectionCard title="Estate">
          <div className="flex flex-col gap-[12px]">
            <Select value={selectedEstateName || ""} onValueChange={onSelectEstate}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select your estate" />
              </SelectTrigger>
              <SelectContent>
                {myEstates.map((e) => (
                  <SelectItem key={e.id} value={e.name}>
                    {e.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="flex flex-col gap-[8px]">
              <SecButton onClick={() => onSelectEstate("__not_in_cityconnect__")}>
                Not in a CityConnect estate
              </SecButton>

              <div className="flex items-center justify-between">
                <p className="text-[12px] text-[#667085]">Or type it manually if needed.</p>
                <SecButton onClick={onToggleManualEstate}>Type manually</SecButton>
              </div>
            </div>

            {isOutsideCityConnectEstate ? (
              <p className="text-[12px] text-[#667085]">That's okay — you can still get guidance.</p>
            ) : null}
          </div>
        </SectionCard>
      ) : null}

      {showFlow && activeFlowStep?.inputMode === "dropdown" && activeFlowStep.id !== "estate" ? (
        <SectionCard title="Choose one">
          <div className="flex flex-col gap-[12px]">
            <Select
              value={flowAnswers[activeFlowStep.id] || ""}
              onValueChange={(v) => {
                const opt = activeFlowStep.options?.find((o) => o.value === v);
                const answerText = opt?.label ?? v;
                onSetFlowAnswer(activeFlowStep.id, answerText);
                onAnswerAndAdvance(activeFlowStep.id, answerText);
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select an option" />
              </SelectTrigger>
              <SelectContent>
                {(activeFlowStep.options || []).map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </SectionCard>
      ) : null}

      {showFlow && activeFlowStep?.inputMode === "datetime" ? (
        <SectionCard title={activeFlowStep.message}>
          <div className="flex flex-col gap-[12px]">
            <div className="flex flex-wrap gap-[12px]">
              <div className="flex flex-col gap-[6px]">
                <p className="text-[12px] text-[#667085]">Date</p>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => onStartDateChange(e.target.value)}
                  className="date-time-input bg-white border border-[#d0d5dd] rounded-[8px] px-[12px] py-[10px] text-[14px]"
                />
              </div>

              <div className="flex flex-col gap-[6px]">
                <p className="text-[12px] text-[#667085]">Time</p>
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => onStartTimeChange(e.target.value)}
                  className="date-time-input bg-white border border-[#d0d5dd] rounded-[8px] px-[12px] py-[10px] text-[14px]"
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-[8px]">
              {["Today", "Yesterday", "This morning", "This afternoon", "This evening", "Not sure"].map((t) => (
                <SecButton key={t} onClick={() => onSelectStartQuickTag(t)}>
                  {t}
                </SecButton>
              ))}
            </div>

            {startQuickTag ? (
              <p className="text-[12px] text-[#667085]">Selected: {startQuickTag}</p>
            ) : null}

            <div className="flex justify-end">
              <SecButton onClick={onContinueTiming}>Continue</SecButton>
            </div>
          </div>
        </SectionCard>
      ) : null}

      {showFlow && activeFlowStep?.inputMode === "tags" ? (
        <SectionCard title={activeFlowStep.message}>
          <div className="flex flex-col gap-[12px]">
            <div className="flex flex-wrap gap-[8px]">
              {(activeFlowStep.options || []).map((o) => (
                <SecButton
                  key={o.value}
                  onClick={() => {
                    onSetFlowAnswer(activeFlowStep.id, o.label);
                    onAnswerAndAdvance(activeFlowStep.id, o.label);
                  }}
                >
                  {o.label}
                </SecButton>
              ))}
            </div>
          </div>
        </SectionCard>
      ) : null}

      {step === "AI_GUIDANCE" ? (
        <SectionCard title="CityBuddy">
          <div className="flex flex-col gap-[12px]">
            <p className="font-['General_Sans:Regular',sans-serif] leading-[24px] text-[#475467] text-[16px] whitespace-pre-wrap">
              {aiResponse?.message || ""}
            </p>

            {aiResponse?.steps?.length ? (
              <ul className="list-disc pl-[18px] text-[#475467] text-[14px] leading-[20px]">
                {aiResponse.steps.map((s, idx) => (
                  <li key={idx}>{s}</li>
                ))}
              </ul>
            ) : null}

            {aiResponse?.intent === "clarify" && aiResponse.followUpQuestion ? (
              <p className="font-['General_Sans:Semibold',sans-serif] leading-[22px] text-[#101828] text-[14px] whitespace-pre-wrap">
                {aiResponse.followUpQuestion}
              </p>
            ) : null}

            {aiResponse?.intent === "escalate" && aiResponse.escalationNote ? (
              <p className="font-['General_Sans:Regular',sans-serif] leading-[20px] text-[#475467] text-[14px] whitespace-pre-wrap">
                {aiResponse.escalationNote}
              </p>
            ) : null}

            {/* Clear next actions (always available) */}
            <div className="flex flex-wrap gap-[12px]">
              <SecButton onClick={onBookProfessional}>Book a service</SecButton>
              <SecButton onClick={onProfessionalConsultancy}>Request consultation</SecButton>
              <SecButton onClick={onBuyOnCityMart}>Buy items on CityMart</SecButton>
              {!(aiResponse?.intent === "clarify" && aiResponse.followUpQuestion) ? (
                <SecButton onClick={onAskFollowUp}>Ask a follow-up question</SecButton>
              ) : null}
            </div>
          </div>
        </SectionCard>
      ) : null}

      {step === "THINKING" || step === "AI_ANALYSING" ? (
        <div className="w-full">
          <AIThinking />
        </div>
      ) : null}

      {showFlow && activeFlowStep?.inputMode === "upload" ? (
        <div className="w-full">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              onImageSelected(file);
              e.currentTarget.value = "";
            }}
          />

          <div className="pl-[36px] pb-[16px]">
            <div className="flex flex-wrap gap-[12px]">
              <SecButton
                onClick={onAskForImageUpload}
              >
                <span className="inline-flex items-center gap-[8px]">
                  <UploadItem />
                  <span>Upload image</span>
                </span>
              </SecButton>
              <SecButton onClick={onSkipImage}>I don't have any image</SecButton>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

// Input field components
function Content18InputField({ 
  value, 
  onChange 
}: { 
  value: string; 
  onChange: (value: string) => void;
}) {
  return (
    <div
      className="content-stretch flex gap-[8px] items-center relative shrink-0 w-full"
      data-name="Content"
    >
      <input
        type="text"
        data-citybuddy-input="true"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Add any special instructions..."
        className="basis-0 font-['General_Sans:Regular',sans-serif] grow leading-[24px] min-h-px min-w-px not-italic relative shrink-0 text-[#667085] text-[16px] bg-transparent border-none outline-none placeholder:text-[#667085]"
      />
    </div>
  );
}

function Send() {
  return (
    <div
      className="relative shrink-0 size-[20px]"
      data-name="send"
    >
      <svg
        className="block size-full"
        fill="none"
        preserveAspectRatio="none"
        viewBox="0 0 20 20"
      >
        <g clipPath="url(#clip0_155_7519)" id="send">
          <path
            d={svgPaths.p12740880}
            id="Icon"
            stroke="var(--stroke-0, white)"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.67"
          />
        </g>
        <defs>
          <clipPath id="clip0_155_7519">
            <rect fill="white" height="20" width="20" />
          </clipPath>
        </defs>
      </svg>
    </div>
  );
}

function ButtonBase2() {
  return (
    <div
      className="bg-[#039855] relative rounded-[48px] shrink-0"
      data-name="_Button base"
    >
      <div className="content-stretch flex items-center justify-center overflow-clip p-[10px] relative rounded-[inherit]">
        <Send />
      </div>
      <div
        aria-hidden="true"
        className="absolute border border-[#039855] border-solid inset-0 pointer-events-none rounded-[48px] shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]"
      />
    </div>
  );
}

function Button2() {
  return (
    <div
      className="content-stretch flex items-start relative rounded-[4px] shrink-0"
      data-name="Button"
    >
      <ButtonBase2 />
    </div>
  );
}

function Frame22({ onClick }: { onClick?: () => void }) {
  return (
    <div className="content-stretch flex flex-col items-end relative shrink-0 w-full">
      <div onClick={onClick} className="cursor-pointer">
        <Button2 />
      </div>
    </div>
  );
}

function Input({ 
  value, 
  onChange, 
  onSend 
}: { 
  value: string; 
  onChange: (value: string) => void;
  onSend: () => void;
}) {
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  };

  return (
    <div
      className="basis-0 bg-white grow min-h-px min-w-[200px] relative rounded-[8px] shrink-0 w-full"
      data-name="Input"
    >
      <div className="min-w-[inherit] overflow-clip rounded-[inherit] size-full">
        <div 
          className="content-stretch flex flex-col items-start justify-between min-w-[inherit] p-[16px] relative size-full"
          onKeyPress={handleKeyPress}
        >
          <Content18InputField value={value} onChange={onChange} />
          <Frame22 onClick={onSend} />
        </div>
      </div>
      <div
        aria-hidden="true"
        className="absolute border border-[#eaecf0] border-solid inset-[-1px] pointer-events-none rounded-[9px] shadow-[0px_1px_3px_0px_rgba(16,24,40,0.1),0px_1px_2px_0px_rgba(16,24,40,0.06)]"
      />
    </div>
  );
}

function InputWithLabelChat({ 
  value, 
  onChange, 
  onSend 
}: { 
  value: string; 
  onChange: (value: string) => void;
  onSend: () => void;
}) {
  return (
    <div
      className="basis-0 content-stretch flex flex-col gap-[6px] grow items-start min-h-px min-w-px relative shrink-0 w-full"
      data-name="Input with label"
    >
      <Input value={value} onChange={onChange} onSend={onSend} />
    </div>
  );
}

function InputFieldBase({ 
  value, 
  onChange, 
  onSend 
}: { 
  value: string; 
  onChange: (value: string) => void;
  onSend: () => void;
}) {
  return (
    <div
      className="basis-0 content-stretch flex flex-col gap-[6px] grow items-start min-h-px min-w-px relative shrink-0 w-full"
      data-name="_Input field base"
    >
      <InputWithLabelChat value={value} onChange={onChange} onSend={onSend} />
    </div>
  );
}

function InputFieldNewMain({ 
  value, 
  onChange, 
  onSend 
}: { 
  value: string; 
  onChange: (value: string) => void;
  onSend: () => void;
}) {
  return (
    <div
      className="content-stretch flex flex-col h-[167px] items-start min-w-[200px] relative shrink-0 w-[694px]"
      data-name="Input field"
    >
      <InputFieldBase value={value} onChange={onChange} onSend={onSend} />
    </div>
  );
}

function Content19NewMain({
  step,
  activeFlowStep,
  history,
  isHistoryLoading,
  inputValue,
  onInputChange,
  onSend,
  flowAnswers,
  onSetFlowAnswer,
  onAnswerAndAdvance,
  myEstates,
  selectedEstateName,
  isOutsideCityConnectEstate,
  useManualEstate,
  onToggleManualEstate,
  onSelectEstate,
  startDate,
  startTime,
  startQuickTag,
  onStartDateChange,
  onStartTimeChange,
  onSelectStartQuickTag,
  onContinueTiming,
  selectedCategory,
  onChangeCategory,
  onDeleteConversation,
  onAskForImageUpload,
  onSkipImage,
  onImageSelected,
  fileInputRef,
  aiResponse,
  canBookProfessional,
  onBookProfessional,
  showProfessionalConsultancy,
  onProfessionalConsultancy,
  onBuyOnCityMart,
  onAskFollowUp,
  conversationSummary,
  bookingCard,
  priceEstimationCard,
  providerMatchingPreview,
  onPrimaryBookingAction,
  onSecondaryBookingAction,
  onViewServiceRequest,
  onViewMoreProviders,
  onAdjustDetails,
  onRemoveBookingImage,
  onOpenProviderComparison,
  selectedProviderId,
  onViewSelectedProvider,
}: {
  step: ConversationStep;
  activeFlowStep: StepConfig | null;
  history: HistoryItem[];
  isHistoryLoading?: boolean;
  inputValue: string;
  onInputChange: (value: string) => void;
  onSend: () => void;
  flowAnswers: Record<string, string>;
  onSetFlowAnswer: (stepId: string, value: string) => void;
  onAnswerAndAdvance: (stepId: string, answerText: string) => void;
  myEstates: Array<{ id: string; name: string }>;
  selectedEstateName: string | null;
  isOutsideCityConnectEstate: boolean;
  useManualEstate: boolean;
  onToggleManualEstate: () => void;
  onSelectEstate: (value: string) => void;
  startDate: string;
  startTime: string;
  startQuickTag: string | null;
  onStartDateChange: (value: string) => void;
  onStartTimeChange: (value: string) => void;
  onSelectStartQuickTag: (tag: string) => void;
  onContinueTiming: () => void;
  selectedCategory?: string;
  onChangeCategory?: () => void;
  onDeleteConversation?: () => void;
  onAskForImageUpload: () => void;
  onSkipImage: () => void;
  onImageSelected: (file: File) => void;
  fileInputRef: RefObject<HTMLInputElement>;
  aiResponse: CityBuddyAiResponse | null;
  canBookProfessional: boolean;
  onBookProfessional: () => void;
  showProfessionalConsultancy: boolean;
  onProfessionalConsultancy: () => void;
  onBuyOnCityMart: () => void;
  onAskFollowUp: () => void;
  conversationSummary?: ConversationSummary | null;
  bookingCard?: BookingCard | null;
  priceEstimationCard?: PriceEstimationCard | null;
  providerMatchingPreview?: ProviderMatchingPreview | null;
  onPrimaryBookingAction?: () => void;
  onSecondaryBookingAction?: () => void;
  onViewServiceRequest?: (id: string) => void;
  onViewMoreProviders?: () => void;
  onAdjustDetails?: () => void;
  onRemoveBookingImage?: (src: string) => void;
  onOpenProviderComparison?: (providers: ProviderComparisonItem[]) => void;
  selectedProviderId?: string | null;
  onViewSelectedProvider?: (providerId: string) => void;
}) {
  const [showSummaryDetails, setShowSummaryDetails] = useState(false);
  const hasUserMessage = history.some((h) => h.type === "user_text" && h.text.trim());
  const hasMeaningfulDetail =
    Array.isArray(conversationSummary?.details) &&
    conversationSummary.details.some(
      (d) =>
        d.startsWith("What:") ||
        d.startsWith("Where:") ||
        d.startsWith("When:") ||
        d.startsWith("Urgency:"),
    );
  const showSummaryHeader = Boolean(conversationSummary?.headline) && (hasUserMessage || hasMeaningfulDetail);
  const isDockedChatbox =
    (step === "FLOW" && Boolean(activeFlowStep?.allowManualInput)) ||
    (step === "AI_GUIDANCE" && aiResponse?.intent === "clarify" && Boolean(aiResponse.followUpQuestion));

  const [dockedPadding, setDockedPadding] = useState(() => {
    if (typeof window === "undefined") return 160;
    // Use ~18% of viewport height but never less than 120px
    return Math.max(120, Math.round(window.innerHeight * 0.18));
  });

  useEffect(() => {
    const handleResize = () => setDockedPadding(Math.max(120, Math.round(window.innerHeight * 0.18)));
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const headerTitle = conversationSummary?.headline || "New request";
  const headerUrgency = conversationSummary?.urgency;
  const urgencyLabel = headerUrgency ? `${headerUrgency.charAt(0).toUpperCase()}${headerUrgency.slice(1)}` : null;
  const urgencyValueClass =
    headerUrgency === "high"
      ? "text-[#d92d20]"
      : headerUrgency === "low"
        ? "text-[#039855]"
        : "text-[#667085]";
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);

  const scrollToLatest = useCallback((smooth = true) => {
    if (!scrollRef.current) return;
    const top = scrollRef.current.scrollHeight - scrollRef.current.clientHeight;
    scrollRef.current.scrollTo({ top, behavior: smooth ? "smooth" : "auto" });
  }, []);

  useEffect(() => {
    if (isAtBottom) scrollToLatest(false);
  }, [history.length, isAtBottom, scrollToLatest]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      window.requestAnimationFrame(() => {
        const threshold = 80;
        const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight <= threshold;
        setIsAtBottom(atBottom);
        ticking = false;
      });
      ticking = true;
    };

    el.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div
      className="relative shrink-0 w-full h-full min-h-0"
      data-name="Content"
    >
      <div className="flex flex-col items-center rounded-[inherit] size-full">
        <div className="content-stretch flex flex-col items-center pb-[32px] pt-[0px] px-[32px] relative w-full h-full min-h-0 pr-[32px] pl-[32px]">
          <div className="w-full">
            <div className="flex items-start justify-between gap-[16px] w-full">
              <div className="min-w-0 flex-1 pt-[6px]">
                <p className="text-[18px] text-[#1D2939] font-['General_Sans',sans-serif] font-[600] truncate">
                  {headerTitle}
                </p>

                {urgencyLabel ? (
                  <div className="flex items-center gap-[12px] mt-[2px]">
                    <p className="text-[12px] text-[#667085]">
                      Urgency:{" "}
                      <span className={urgencyValueClass}>{urgencyLabel}</span>
                    </p>
                    {showSummaryHeader &&
                    Array.isArray(conversationSummary?.details) &&
                    conversationSummary.details.length > 0 ? (
                      <button
                        type="button"
                        aria-expanded={showSummaryDetails}
                        onClick={() => setShowSummaryDetails((v) => !v)}
                        className="text-[12px] text-[#039855] underline hover:opacity-90"
                      >
                        {showSummaryDetails ? "Hide summary" : "View summary"}
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </div>

              <div className="pt-[6px]">
                <CategoryStatus
                  categoryName={selectedCategory}
                  onChangeCategory={onChangeCategory}
                  onDeleteConversation={onDeleteConversation}
                />
              </div>
            </div>

            {showSummaryHeader &&
            showSummaryDetails &&
            Array.isArray(conversationSummary?.details) &&
            conversationSummary.details.length > 0 ? (
              <div className="mt-[8px] bg-[#f5f6f6] rounded-[12px] px-[12px] py-[10px]">
                <ul className="list-disc pl-[18px] text-[12px] text-[#667085] space-y-[4px]">
                  {conversationSummary.details.map((d, idx) => (
                    <li key={`${idx}-${d}`}>{d}</li>
                  ))}
                </ul>

                {/* Ticket progress summary: list each ticket in the conversation */}
                {history && Array.isArray(history) && history.some((m) => m.type === "ticket") ? (
                  <div className="mt-[10px]">
                    <p className="text-[12px] text-[#667085]">Tickets</p>
                    <div className="mt-[6px] space-y-[8px]">
                      {history
                        .filter((m): m is Extract<HistoryItem, { type: "ticket" }> => m.type === "ticket")
                        .map((t) => {
                          const { steps, activeIndex } = buildProgressSteps(t.status || "");
                          const statusLabel = formatTicketStatusLabel(t.status || "");
                          return (
                            <div key={`summary-ticket-${t.serviceRequestId}`} className="bg-white border border-[#EAECF0] rounded-[8px] px-[10px] py-[8px]">
                              <div className="flex items-center justify-between">
                                <div className="min-w-0">
                                  <p className="text-[13px] text-[#101828] font-['General_Sans:Medium',sans-serif] truncate">{t.title || `Request ${t.serviceRequestId}`}</p>
                                  <p className="text-[12px] text-[#475467]">ID: {t.serviceRequestId}</p>
                                </div>
                                <div className="shrink-0">
                                  <span className="inline-flex items-center text-[12px] text-[#475467] bg-[#f9fafb] border border-[#EAECF0] rounded-[999px] px-[10px] py-[4px]">{statusLabel}</span>
                                </div>
                              </div>

                              <div className="mt-[8px] text-[12px] text-[#475467]">
                                {steps.map((s: string, i: number) => (
                                  <span key={s} className={i === activeIndex ? "text-[#101828] font-['General_Sans:Medium',sans-serif]" : "text-[#667085]"}>
                                    {s}{i < steps.length - 1 ? " → " : ""}
                                  </span>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                ) : null}
                {/* Selected provider quick action */}
                {selectedProviderId ? (
                  <div className="mt-[8px] flex items-center justify-between">
                    <div className="text-[12px] text-[#475467]">
                      Selected provider saved for this conversation.
                    </div>
                    <div>
                      <button
                        type="button"
                        onClick={() => onViewSelectedProvider?.(selectedProviderId ?? undefined)}
                        className="text-[12px] text-[#039855] underline"
                      >
                        View provider
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>

          <div
            ref={scrollRef}
            className="flex flex-col flex-1 min-h-0 w-full overflow-x-clip overflow-y-auto mt-[16px] pt-[0px] pr-[0px] pl-[0px] [&::-webkit-scrollbar]:w-[3px] [&::-webkit-scrollbar-track]:bg-[#D0D5DD] [&::-webkit-scrollbar-thumb]:bg-gray-400 [&::-webkit-scrollbar-thumb]:rounded-full"
            style={{ paddingBottom: isDockedChatbox ? dockedPadding : 24 }}
          >
            <RequestDetailsNewMain 
              step={step}
              history={history}
              isHistoryLoading={isHistoryLoading}
              selectedCategory={selectedCategory}
              onChangeCategory={onChangeCategory}
              onViewServiceRequest={onViewServiceRequest}
              bookingCard={bookingCard}
              priceEstimationCard={priceEstimationCard}
              providerMatchingPreview={providerMatchingPreview}
              onPrimaryBookingAction={onPrimaryBookingAction}
              onSecondaryBookingAction={onSecondaryBookingAction}
              onAskFollowUp={onAskFollowUp}
              onProfessionalConsultancy={onProfessionalConsultancy}
              onViewMoreProviders={onViewMoreProviders}
              onAdjustDetails={onAdjustDetails}
              onRemoveBookingImage={onRemoveBookingImage}
            />

            <ActiveStepBlock
              step={step}
              activeFlowStep={activeFlowStep}
              flowAnswers={flowAnswers}
              onSetFlowAnswer={onSetFlowAnswer}
              onAnswerAndAdvance={onAnswerAndAdvance}
              myEstates={myEstates}
              selectedEstateName={selectedEstateName}
              isOutsideCityConnectEstate={isOutsideCityConnectEstate}
              useManualEstate={useManualEstate}
              onToggleManualEstate={onToggleManualEstate}
              onSelectEstate={onSelectEstate}
              startDate={startDate}
              startTime={startTime}
              startQuickTag={startQuickTag}
              onStartDateChange={onStartDateChange}
              onStartTimeChange={onStartTimeChange}
              onSelectStartQuickTag={onSelectStartQuickTag}
              onContinueTiming={onContinueTiming}
              onAskForImageUpload={onAskForImageUpload}
              onSkipImage={onSkipImage}
              onImageSelected={onImageSelected}
              fileInputRef={fileInputRef}
              aiResponse={aiResponse}
              canBookProfessional={canBookProfessional}
              onBookProfessional={onBookProfessional}
              showProfessionalConsultancy={showProfessionalConsultancy}
              onProfessionalConsultancy={onProfessionalConsultancy}
              onBuyOnCityMart={onBuyOnCityMart}
              onAskFollowUp={onAskFollowUp}
            />
          </div>

          {!isAtBottom ? (
            <div
              className="absolute right-[24px] z-50"
              style={{ bottom: isDockedChatbox ? 96 : 24 }}
            >
              <SecButton type="button" onClick={() => scrollToLatest(true)}>
                Jump to latest
              </SecButton>
            </div>
          ) : null}

          {/* Docked chatbox (bottom-center) */}
          {isDockedChatbox && (
            <div className="absolute bottom-0 left-0 right-0 pb-[0px] px-[32px]">
              <div className="w-full flex justify-center">
                <InputFieldNewMain
                  value={inputValue}
                  onChange={onInputChange}
                  onSend={onSend}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function MainChat({ 
  step,
  activeFlowStep,
  history,
  isHistoryLoading,
  inputValue,
  onInputChange,
  onSend,
  flowAnswers,
  onSetFlowAnswer,
  onAnswerAndAdvance,
  myEstates,
  selectedEstateName,
  isOutsideCityConnectEstate,
  useManualEstate,
  onToggleManualEstate,
  onSelectEstate,
  startDate,
  startTime,
  startQuickTag,
  onStartDateChange,
  onStartTimeChange,
  onSelectStartQuickTag,
  onContinueTiming,
  selectedCategory,
  onChangeCategory,
  onDeleteConversation,
  onAskForImageUpload,
  onSkipImage,
  onImageSelected,
  fileInputRef,
  aiResponse,
  canBookProfessional,
  onBookProfessional,
  showProfessionalConsultancy,
  onProfessionalConsultancy,
  onBuyOnCityMart,
  onAskFollowUp,
  conversationSummary,
  bookingCard,
  priceEstimationCard,
  providerMatchingPreview,
  onPrimaryBookingAction,
  onSecondaryBookingAction,
  onViewServiceRequest,
  onViewMoreProviders,
  onAdjustDetails,
  onRemoveBookingImage,
  onOpenProviderComparison,
  selectedProviderId,
  onViewSelectedProvider,
}: {
  step: ConversationStep;
  activeFlowStep: StepConfig | null;
  history: HistoryItem[];
  isHistoryLoading?: boolean;
  inputValue: string;
  onInputChange: (value: string) => void;
  onSend: () => void;
  flowAnswers: Record<string, string>;
  onSetFlowAnswer: (stepId: string, value: string) => void;
  onAnswerAndAdvance: (stepId: string, answerText: string) => void;
  myEstates: Array<{ id: string; name: string }>;
  selectedEstateName: string | null;
  isOutsideCityConnectEstate: boolean;
  useManualEstate: boolean;
  onToggleManualEstate: () => void;
  onSelectEstate: (value: string) => void;
  startDate: string;
  startTime: string;
  startQuickTag: string | null;
  onStartDateChange: (value: string) => void;
  onStartTimeChange: (value: string) => void;
  onSelectStartQuickTag: (tag: string) => void;
  onContinueTiming: () => void;
  selectedCategory?: string;
  onChangeCategory?: () => void;
  onDeleteConversation?: () => void;
  onAskForImageUpload: () => void;
  onSkipImage: () => void;
  onImageSelected: (file: File) => void;
  fileInputRef: RefObject<HTMLInputElement>;
  aiResponse: CityBuddyAiResponse | null;
  canBookProfessional: boolean;
  onBookProfessional: () => void;
  showProfessionalConsultancy: boolean;
  onProfessionalConsultancy: () => void;
  onBuyOnCityMart: () => void;
  onAskFollowUp: () => void;
  conversationSummary?: ConversationSummary | null;
  bookingCard?: BookingCard | null;
  priceEstimationCard?: PriceEstimationCard | null;
  providerMatchingPreview?: ProviderMatchingPreview | null;
  onPrimaryBookingAction?: () => void;
  onSecondaryBookingAction?: () => void;
  onViewServiceRequest?: (id: string) => void;
  onViewMoreProviders?: () => void;
  onAdjustDetails?: () => void;
  onRemoveBookingImage?: (src: string) => void;
  onOpenProviderComparison?: (providers: ProviderComparisonItem[]) => void;
  selectedProviderId?: string | null;
  onViewSelectedProvider?: (id?: string) => void;
}) {
  return (
    <div
      className="basis-0 bg-white content-stretch flex flex-col gap-[32px] grow items-start min-h-px min-w-px pb-[32px] pt-[16px] px-0 relative rounded-bl-[40px] rounded-tl-[40px] shrink-0 w-full h-full"
      data-name="Main"
    >
      <Content19NewMain 
        step={step}
        activeFlowStep={activeFlowStep}
        history={history}
        isHistoryLoading={isHistoryLoading}
        inputValue={inputValue} 
        onInputChange={onInputChange} 
        onSend={onSend}
        flowAnswers={flowAnswers}
        onSetFlowAnswer={onSetFlowAnswer}
        onAnswerAndAdvance={onAnswerAndAdvance}
        myEstates={myEstates}
        selectedEstateName={selectedEstateName}
        isOutsideCityConnectEstate={isOutsideCityConnectEstate}
        useManualEstate={useManualEstate}
        onToggleManualEstate={onToggleManualEstate}
        onSelectEstate={onSelectEstate}
        startDate={startDate}
        startTime={startTime}
        startQuickTag={startQuickTag}
        onStartDateChange={onStartDateChange}
        onStartTimeChange={onStartTimeChange}
        onSelectStartQuickTag={onSelectStartQuickTag}
        onContinueTiming={onContinueTiming}
        selectedCategory={selectedCategory}
        onChangeCategory={onChangeCategory}
        onDeleteConversation={onDeleteConversation}
        onAskForImageUpload={onAskForImageUpload}
        onSkipImage={onSkipImage}
        onImageSelected={onImageSelected}
        fileInputRef={fileInputRef}
        aiResponse={aiResponse}
        canBookProfessional={canBookProfessional}
        onBookProfessional={onBookProfessional}
        showProfessionalConsultancy={showProfessionalConsultancy}
        onProfessionalConsultancy={onProfessionalConsultancy}
        onBuyOnCityMart={onBuyOnCityMart}
        onAskFollowUp={onAskFollowUp}
        conversationSummary={conversationSummary}
        bookingCard={bookingCard}
        priceEstimationCard={priceEstimationCard}
        providerMatchingPreview={providerMatchingPreview}
        onPrimaryBookingAction={onPrimaryBookingAction}
        onSecondaryBookingAction={onSecondaryBookingAction}
        onViewServiceRequest={onViewServiceRequest}
        onViewMoreProviders={onViewMoreProviders}
        onAdjustDetails={onAdjustDetails}
        onRemoveBookingImage={onRemoveBookingImage}
        onOpenProviderComparison={onOpenProviderComparison}
        selectedProviderId={selectedProviderId}
        onViewSelectedProvider={onViewSelectedProvider}
      />
    </div>
  );
}

function MainWrapChat({ 
  step,
  activeFlowStep,
  history,
  isHistoryLoading,
  inputValue,
  onInputChange,
  onSend,
  flowAnswers,
  onSetFlowAnswer,
  onAnswerAndAdvance,
  myEstates,
  selectedEstateName,
  isOutsideCityConnectEstate,
  useManualEstate,
  onToggleManualEstate,
  onSelectEstate,
  startDate,
  startTime,
  startQuickTag,
  onStartDateChange,
  onStartTimeChange,
  onSelectStartQuickTag,
  onContinueTiming,
  selectedCategory,
  onChangeCategory,
  onDeleteConversation,
  onAskForImageUpload,
  onSkipImage,
  onImageSelected,
  fileInputRef,
  aiResponse,
  canBookProfessional,
  onBookProfessional,
  showProfessionalConsultancy,
  onProfessionalConsultancy,
  onBuyOnCityMart,
  onAskFollowUp,
  conversationSummary,
  bookingCard,
  priceEstimationCard,
  providerMatchingPreview,
  onPrimaryBookingAction,
  onSecondaryBookingAction,
  onViewServiceRequest,
  onViewMoreProviders,
  onAdjustDetails,
  onRemoveBookingImage,
  onOpenProviderComparison,
  selectedProviderId,
  onViewSelectedProvider,
}: {
  step: ConversationStep;
  activeFlowStep: StepConfig | null;
  history: HistoryItem[];
  isHistoryLoading?: boolean;
  inputValue: string;
  onInputChange: (value: string) => void;
  onSend: () => void;
  flowAnswers: Record<string, string>;
  onSetFlowAnswer: (stepId: string, value: string) => void;
  onAnswerAndAdvance: (stepId: string, answerText: string) => void;
  myEstates: Array<{ id: string; name: string }>;
  selectedEstateName: string | null;
  isOutsideCityConnectEstate: boolean;
  useManualEstate: boolean;
  onToggleManualEstate: () => void;
  onSelectEstate: (value: string) => void;
  startDate: string;
  startTime: string;
  startQuickTag: string | null;
  onStartDateChange: (value: string) => void;
  onStartTimeChange: (value: string) => void;
  onSelectStartQuickTag: (tag: string) => void;
  onContinueTiming: () => void;
  selectedCategory?: string;
  onChangeCategory?: () => void;
  onDeleteConversation?: () => void;
  onAskForImageUpload: () => void;
  onSkipImage: () => void;
  onImageSelected: (file: File) => void;
  fileInputRef: RefObject<HTMLInputElement>;
  aiResponse: CityBuddyAiResponse | null;
  canBookProfessional: boolean;
  onBookProfessional: () => void;
  showProfessionalConsultancy: boolean;
  onProfessionalConsultancy: () => void;
  onBuyOnCityMart: () => void;
  onAskFollowUp: () => void;
  conversationSummary?: ConversationSummary | null;
  bookingCard?: BookingCard | null;
  priceEstimationCard?: PriceEstimationCard | null;
  providerMatchingPreview?: ProviderMatchingPreview | null;
  onPrimaryBookingAction?: () => void;
  onSecondaryBookingAction?: () => void;
  onViewServiceRequest?: (id: string) => void;
  onViewMoreProviders?: () => void;
  onAdjustDetails?: () => void;
  onRemoveBookingImage?: (src: string) => void;
  onOpenProviderComparison?: (providers: ProviderComparisonItem[]) => void;
  selectedProviderId?: string | null;
  onViewSelectedProvider?: (id?: string) => void;
}) {
  return (
    <div
      className="basis-0 grow h-full min-h-px min-w-px relative shrink-0"
      data-name="Main wrap"
    >
      <div className="size-full">
        <div className="content-stretch flex flex-col items-start pb-0 pl-[14px] pr-0 pt-[12px] relative size-full">
          <MainChat 
            step={step}
            activeFlowStep={activeFlowStep}
            history={history}
            isHistoryLoading={isHistoryLoading}
            inputValue={inputValue} 
            onInputChange={onInputChange} 
            onSend={onSend}
            flowAnswers={flowAnswers}
            onSetFlowAnswer={onSetFlowAnswer}
            onAnswerAndAdvance={onAnswerAndAdvance}
            myEstates={myEstates}
            selectedEstateName={selectedEstateName}
            isOutsideCityConnectEstate={isOutsideCityConnectEstate}
            useManualEstate={useManualEstate}
            onToggleManualEstate={onToggleManualEstate}
            onSelectEstate={onSelectEstate}
            startDate={startDate}
            startTime={startTime}
            startQuickTag={startQuickTag}
            onStartDateChange={onStartDateChange}
            onStartTimeChange={onStartTimeChange}
            onSelectStartQuickTag={onSelectStartQuickTag}
            onContinueTiming={onContinueTiming}
            selectedCategory={selectedCategory}
            onChangeCategory={onChangeCategory}
            onDeleteConversation={onDeleteConversation}
            onAskForImageUpload={onAskForImageUpload}
            onSkipImage={onSkipImage}
            onImageSelected={onImageSelected}
            fileInputRef={fileInputRef}
            aiResponse={aiResponse}
            canBookProfessional={canBookProfessional}
            onBookProfessional={onBookProfessional}
            showProfessionalConsultancy={showProfessionalConsultancy}
            onProfessionalConsultancy={onProfessionalConsultancy}
            onBuyOnCityMart={onBuyOnCityMart}
            onAskFollowUp={onAskFollowUp}
            conversationSummary={conversationSummary}
            bookingCard={bookingCard}
            priceEstimationCard={priceEstimationCard}
            providerMatchingPreview={providerMatchingPreview}
            onPrimaryBookingAction={onPrimaryBookingAction}
            onSecondaryBookingAction={onSecondaryBookingAction}
            onViewServiceRequest={onViewServiceRequest}
            onViewMoreProviders={onViewMoreProviders}
            onAdjustDetails={onAdjustDetails}
            onRemoveBookingImage={onRemoveBookingImage}
            onOpenProviderComparison={onOpenProviderComparison}
            selectedProviderId={selectedProviderId}
            onViewSelectedProvider={onViewSelectedProvider}
          />
        </div>
      </div>
    </div>
  );
}

// ============ Main Export Component with View Switching ============
export default function ChatInterface({
  onBack,
  initialView = 'select-category',
  initialSelectedCategory,
  onCategorySelected,
}: {
  onBack?: () => void;
  initialView?: 'select-category' | 'conversation';
  initialSelectedCategory?: string;
  onCategorySelected?: (categoryName: string) => void;
}) {
  const { user } = useAuth();
  const [currentView, setCurrentView] = useState<'select-category' | 'conversation'>(initialView);
  const [selectedCategory, setSelectedCategory] = useState<string | undefined>(initialSelectedCategory);
  const [searchQuery, setSearchQuery] = useState("");
  const [inputValue, setInputValue] = useState<string>("");
  const [step, setStep] = useState<ConversationStep>("FLOW");
  const [flowSteps, setFlowSteps] = useState<StepConfig[]>([]);
  const [flowIndex, setFlowIndex] = useState(0);
  const [flowAnswers, setFlowAnswers] = useState<Record<string, string>>({});
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [uploadedImageSrc, setUploadedImageSrc] = useState<string | null>(null);
  const [uploadedImages, setUploadedImages] = useState<InlineImagePart[]>([]);
  const [userDescription, setUserDescription] = useState<string>("");
  const [issueText, setIssueText] = useState<string>("");
  const { data: myEstates } = useMyEstates();
  const { toast } = useToast();
  const { categories: fetchedCategories = [], isLoading: catsLoading } = useCategories({ scope: "global" });
  
  // Load AI conversation flow settings from database
  const { settings: aiFlowSettings, isLoading: aiFlowLoading } = useAiConversationFlowSettings();
  
  // Update dynamic category mappings when settings load
  useEffect(() => {
    if (aiFlowSettings && aiFlowSettings.length > 0) {
      updateDynamicCategoryMappings(aiFlowSettings);
    }
  }, [aiFlowSettings]);

  // Transform AI flow settings to category format for display
  // Prioritize AI flow settings over fetchedCategories when available
  const displayCategories = useMemo(() => {
    if (aiFlowSettings && aiFlowSettings.length > 0) {
      return aiFlowSettings
        .filter(s => s.isEnabled)
        .sort((a, b) => a.displayOrder - b.displayOrder)
        .map(s => ({
          id: s.id,
          name: s.categoryName,
          key: s.categoryKey,
          emoji: s.emoji || "🛠️",
          description: s.description,
          providerCount: 0, // Could be enhanced to fetch provider count
        }));
    }
    return fetchedCategories;
  }, [aiFlowSettings, fetchedCategories]);

  const categoriesLoading = catsLoading || aiFlowLoading;
  
  const [useManualEstate, setUseManualEstate] = useState(false);
  const [selectedEstateName, setSelectedEstateName] = useState<string | null>(null);
  const [isOutsideCityConnectEstate, setIsOutsideCityConnectEstate] = useState(false);
  const [startDate, setStartDate] = useState<string>("");
  const [startTime, setStartTime] = useState<string>("");
  const [startQuickTag, setStartQuickTag] = useState<string | null>(null);
  const [aiResponse, setAiResponse] = useState<CityBuddyAiResponse | null>(null);
  const [aiDecision, setAiDecision] = useState<AiDecision>({
    requiresConsultancy: false,
    consultancyCompleted: false,
  });
  const [confidenceScore, setConfidenceScore] = useState(0);
  const [infoSlots, setInfoSlots] = useState<InfoSlots>(INITIAL_INFO_SLOTS);
  const [imageDeclined, setImageDeclined] = useState(false);
  const [earlyStopAcknowledged, setEarlyStopAcknowledged] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [isUserDistressed, setIsUserDistressed] = useState(false);
  const [hasChosenAction, setHasChosenAction] = useState(false);
  const [conversationSyncAvailable, setConversationSyncAvailable] = useState(true);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [historyLoadError, setHistoryLoadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const sessionsStorageKey = `citybuddy_conversation_sessions_v1:${user?.id ?? "anonymous"}`;
  const [conversationSessions, setConversationSessions] = useState<ConversationSession[]>([]);
  const [activeConversationSessionId, setActiveConversationSessionId] = useState<string | null>(null);
  const [showComparison, setShowComparison] = useState(false);
  const [comparisonProviders, setComparisonProviders] = useState<ProviderComparisonItem[]>([]);
  const [showBookingConfirm, setShowBookingConfirm] = useState(false);
  const [pendingBookingProviderId, setPendingBookingProviderId] = useState<string | null>(null);
  const lastNewSessionAtRef = useRef<number>(0);
  const suppressSessionAutosaveRef = useRef(false);
  const sessionActivityRef = useRef(false);
  const isChangingCategoryRef = useRef(false);
  const lastPreparedSnapshotFingerprintRef = useRef<Record<string, string>>({});
  const savedHistoryIdsRef = useRef<Set<string>>(new Set());
  const lastSavedAiResponseRef = useRef<string | null>(null);

  const markSessionActivity = useCallback(() => {
    sessionActivityRef.current = true;
  }, []);

  const buildSlotsFromAnswers = useCallback(
    (answers: Record<string, string>, hasImage: boolean): InfoSlots => {
      const next: InfoSlots = { ...INITIAL_INFO_SLOTS };
      if ((answers.issue || "").trim()) next.description = true;
      if ((answers.estate || "").trim()) next.location = true;
      if ((answers.timing || "").trim()) next.timing = true;
      if ((answers.urgency || "").trim()) next.urgency = true;
      if (hasImage) next.imageProvided = true;
      return next;
    },
    [],
  );

  const applyCategoryChangeToActiveSession = useCallback(
    (categoryName: string) => {
      if (!activeConversationSessionId) return;
      const categoryKey = getServiceCategoryKey(categoryName);
      if (!categoryKey) return;

      markSessionActivity();

      const steps = buildFlowStepsForCategory(categoryKey);
      const allowedIds = new Set(steps.map((s) => s.id));

      const preservedAnswers: Record<string, string> = {};
      for (const k of Object.keys(flowAnswers)) {
        if (allowedIds.has(k) && (flowAnswers[k] || "").trim()) preservedAnswers[k] = flowAnswers[k];
      }
      for (const core of ["issue", "estate", "timing", "urgency", "image"] as const) {
        const v = (flowAnswers[core] || "").trim();
        if (v) preservedAnswers[core] = v;
      }

      const hasImage = Boolean(uploadedImageSrc) || history.some((h) => h.type === "image");
      const nextSlots = buildSlotsFromAnswers(preservedAnswers, hasImage);
      const nextConfidence = 0;

      const nextIndex = (() => {
        if (nextSlots.description && hasSufficientConfidence(categoryKey, nextConfidence)) {
          return steps.length;
        }

        const issue = (preservedAnswers.issue || issueText || "").trim();
        const descriptionHighQuality = issue.length >= 30 && !isVagueResponse(issue);

        for (let i = 0; i < steps.length; i++) {
          const s = steps[i];

          if (s.slotKey && nextSlots[s.slotKey]) continue;
          if (preservedAnswers[s.id] && preservedAnswers[s.id].trim()) continue;

          if (s.id === "image") {
            if (imageDeclined) continue;
            const catVisualsHelpful = DYNAMIC_CATEGORY_VISUALS_HELPFUL[categoryKey] ?? DEFAULT_CATEGORY_VISUALS_HELPFUL[categoryKey] ?? true;
            if (!catVisualsHelpful) continue;
            if (hasSufficientConfidence(categoryKey, nextConfidence)) continue;
            if (!descriptionHighQuality) continue;
          }

          return i;
        }

        return steps.length;
      })();

      setSelectedCategory(categoryName);
      setCurrentView('conversation');
      setFlowSteps(steps);
      setFlowAnswers(preservedAnswers);
      if ((preservedAnswers.issue || "").trim()) {
        setIssueText(preservedAnswers.issue);
      }
      setFlowIndex(nextIndex);
      setStep("FLOW");

      // Reset AI outputs to ensure we re-analyze under the new category.
      setAiResponse(null);
      setAiDecision({ requiresConsultancy: false, consultancyCompleted: false });
      setConfidenceScore(0);
      setInfoSlots(nextSlots);
      setEarlyStopAcknowledged(false);
      setHasChosenAction(false);
      setSendError(null);

      setHistory((prev) => {
        const next: HistoryItem[] = [...prev];
        next.push({ id: makeHistoryId(), type: "ai_message", text: `Okay — switching this request to ${categoryName}.` });
        const prompt = steps[nextIndex]?.message;
        if (prompt) {
          next.push({ id: makeHistoryId(), type: "ai_message", text: prompt });
        }
        return next;
      });
    },
    [
      activeConversationSessionId,
      buildSlotsFromAnswers,
      flowAnswers,
      history,
      imageDeclined,
      issueText,
      markSessionActivity,
      uploadedImageSrc,
    ],
  );

  const handleChangeCategoryInConversation = useCallback(() => {
    isChangingCategoryRef.current = true;
    setSearchQuery("");
    setCurrentView('select-category');
  }, []);

  const openProviderComparison = useCallback((providers: ProviderComparisonItem[]) => {
    if (!providers || providers.length < 2) return;
    setComparisonProviders(providers);
    setShowComparison(true);

    // mark conversation session as viewed
    if (activeConversationSessionId) {
      setConversationSessions((prev) =>
        prev.map((s) => (s.id === activeConversationSessionId ? { ...s, comparisonViewed: true } : s)),
      );
    }

    // Add CityBuddy intro message
    setHistory((prev) => [...prev, { id: makeHistoryId(), type: "ai_message", text: "Here’s a side-by-side comparison to help you choose what works best for you." }]);
  }, [activeConversationSessionId]);

  const closeProviderComparison = useCallback(() => {
    setShowComparison(false);
  }, []);

  const handleSelectProviderFromComparison = useCallback((providerId: string) => {
    if (!activeConversationSessionId) return;
    setConversationSessions((prev) =>
      prev.map((s) => (s.id === activeConversationSessionId ? { ...s, selectedProviderId: providerId } : s)),
    );
    // keep comparison open so user can confirm; selection toggles booking CTA in UI
    setConversationSessions((prev) => prev);
  }, [activeConversationSessionId]);

  const viewSelectedProvider = useCallback((providerId: string, providerName?: string) => {
    if (!activeConversationSessionId) return;
    // ensure session records selection
    setConversationSessions((prev) =>
      prev.map((s) => (s.id === activeConversationSessionId ? { ...s, selectedProviderId: providerId } : s)),
    );
    // close comparison panel
    setShowComparison(false);
    // add a gentle CityBuddy message to focus the session
    setHistory((prev) => [
      ...prev,
      { id: makeHistoryId(), type: "ai_message", text: providerName ? `${providerName} selected. You can proceed to booking when ready.` : `Provider selected. You can proceed to booking when ready.` },
    ]);
  }, [activeConversationSessionId]);

  const isSessionEmptyPlaceholder = useCallback((session: ConversationSession) => {
    const issue =
      (session.conversationState.flowAnswers.issue || session.conversationState.issueText || "").trim();
    const hasUserText = session.messages.some((m) => m.type === "user_text" && m.text.trim());
    const hasImage =
      session.messages.some((m) => m.type === "image") || Boolean(session.conversationState.uploadedImageSrc);
    const hasAnySlots = Object.values(session.infoSlots || {}).some(Boolean);
    const hasProgress = hasUserText || hasImage || issue.length >= 10 || (session.confidenceScore || 0) > 0 || hasAnySlots;
    return !hasProgress;
  }, []);

  const dedupeConversationSessions = useCallback(
    (sessions: ConversationSession[]): ConversationSession[] => {
      if (!sessions.length) return sessions;

      // Keep most-recent first for deterministic preservation.
      const sorted = [...sessions].sort((a, b) => {
        const at = new Date(a.lastUpdated).getTime();
        const bt = new Date(b.lastUpdated).getTime();
        return (Number.isFinite(bt) ? bt : 0) - (Number.isFinite(at) ? at : 0);
      });

      // 1) Remove exact duplicates (same content, different id).
      const seenContent = new Set<string>();
      const contentUnique: ConversationSession[] = [];
      for (const s of sorted) {
        try {
          const signature = JSON.stringify({
            category: s.category,
            title: s.title,
            confidenceScore: s.confidenceScore,
            isResolved: s.isResolved,
            infoSlots: s.infoSlots,
            messages: s.messages.map((m) =>
              m.type === "image" ? { type: "image", src: "[image]" } : m,
            ),
            conversationState: {
              ...s.conversationState,
              uploadedImageSrc: s.conversationState.uploadedImageSrc ? "[image]" : null,
            },
          });
          if (seenContent.has(signature)) continue;
          seenContent.add(signature);
          contentUnique.push(s);
        } catch {
          contentUnique.push(s);
        }
      }

      // 2) Collapse multiple empty placeholders per category into just one.
      const seenEmptyCategory = new Set<string>();
      const finalList: ConversationSession[] = [];
      for (const s of contentUnique) {
        if (isSessionEmptyPlaceholder(s)) {
          const key = `empty:${s.category}`;
          if (seenEmptyCategory.has(key)) continue;
          seenEmptyCategory.add(key);
          finalList.push(s);
          continue;
        }
        finalList.push(s);
      }

      return finalList;
    },
    [isSessionEmptyPlaceholder],
  );

  const INSPECTION_DRAFT_KEY = "citybuddy_inspection_draft";

  const buildEmptyConversationSession = useCallback(
    (categoryName: string, sessionId: string, updatedAtIso?: string) => {
      const categoryKey = getServiceCategoryKey(categoryName);
      const steps = categoryKey ? buildFlowStepsForCategory(categoryKey) : [];
      const firstPrompt = steps[0]?.message || "";
      const initialHistory: HistoryItem[] = firstPrompt
        ? [{ id: makeHistoryId(), type: "ai_message", text: firstPrompt }]
        : [];

      const summary = buildConversationSummary({
        category: categoryName,
        categoryKey,
        flowAnswers: {},
        infoSlots: INITIAL_INFO_SLOTS,
        isOutsideCityConnectEstate: false,
        selectedEstateName: null,
        hasImage: false,
        aiDecision: { requiresConsultancy: false, consultancyCompleted: false },
        aiResponse: null,
        confidenceScore: 0,
        step: "FLOW",
      });

      return {
        id: sessionId,
        category: categoryName,
        title: summary.headline,
        summary,
        bookingCard: null,
        priceEstimationCard: null,
        providerMatchingPreview: null,
        readyToBook: false,
        lastUpdated: updatedAtIso || new Date().toISOString(),
        confidenceScore: 0,
        isResolved: false,
        messages: initialHistory,
        infoSlots: INITIAL_INFO_SLOTS,
        conversationState: {
          step: "FLOW",
          flowIndex: 0,
          flowAnswers: {},
          issueText: "",
          selectedEstateName: null,
          isOutsideCityConnectEstate: false,
          useManualEstate: false,
          startDate: "",
          startTime: "",
          startQuickTag: null,
          imageDeclined: false,
          uploadedImageSrc: null,
          aiResponse: null,
          aiDecision: { requiresConsultancy: false, consultancyCompleted: false },
          isUserDistressed: false,
          earlyStopAcknowledged: false,
        },
      } as ConversationSession;
    },
    [],
  );

  const hydrateConversationMessages = useCallback(
    async (conversationId: string, categoryName: string) => {
      try {
        setIsHistoryLoading(true);
        setHistoryLoadError(null);
        const messages = await fetchMessages(conversationId);
        if (!messages.length) return;
        const { history: hydratedHistory, latestAiMeta } = mapConversationMessagesToHistory(messages);
        setHistory(hydratedHistory);
        savedHistoryIdsRef.current = new Set(hydratedHistory.map((item) => item.id));
        if (latestAiMeta) {
          setAiResponse(latestAiMeta);
          setStep("AI_GUIDANCE");
          lastSavedAiResponseRef.current = `${conversationId}:${latestAiMeta.message}`;
        }
        setConversationSessions((prev) =>
          prev.map((s) => (s.id === conversationId ? { ...s, messages: hydratedHistory } : s)),
        );
      } catch (error) {
        setHistoryLoadError("Unable to load previous conversation.");
        setConversationSyncAvailable(false);
      } finally {
        setIsHistoryLoading(false);
      }
    },
    [],
  );

  const activeConversationSession =
    (activeConversationSessionId
      ? conversationSessions.find((s) => s.id === activeConversationSessionId)
      : null) ?? null;

  const activeConversationSummary =
    (activeConversationSessionId
      ? conversationSessions.find((s) => s.id === activeConversationSessionId)?.summary
      : null) ?? null;

  const activeBookingCard = activeConversationSession?.bookingCard ?? null;
  const activePriceEstimationCard = activeConversationSession?.priceEstimationCard ?? null;
  const activeProviderMatchingPreview = activeConversationSession?.providerMatchingPreview ?? null;

  const pendingBookingProviderName = useMemo(() => {
    if (!pendingBookingProviderId) return null;
    const fromComparison = comparisonProviders.find((p) => p.id === pendingBookingProviderId)?.name;
    const fromPreview = activeProviderMatchingPreview?.providers?.find(
      (pp: any) => String(pp.id) === pendingBookingProviderId,
    )?.name;
    return (fromComparison || fromPreview || null) as string | null;
  }, [activeProviderMatchingPreview, comparisonProviders, pendingBookingProviderId]);

  useEffect(() => {
    setCurrentView(initialView);
  }, [initialView]);

  useEffect(() => {
    setSelectedCategory(initialSelectedCategory);
  }, [initialSelectedCategory]);

  useEffect(() => {
    let cancelled = false;

    const loadFromLocalStorage = () => {
      try {
        const raw = localStorage.getItem(sessionsStorageKey);
        if (!raw) {
          setConversationSessions([]);
          setActiveConversationSessionId(null);
          return;
        }
        const parsed = JSON.parse(raw) as unknown;
        if (!Array.isArray(parsed)) {
          setConversationSessions([]);
          setActiveConversationSessionId(null);
          return;
        }
        const sessions = parsed.filter(
          (s): s is any => Boolean(s && typeof s === "object" && "id" in (s as any)),
        );

        const normalized: ConversationSession[] = sessions.map((rawSession: any) => {
          const category = typeof rawSession.category === "string" ? rawSession.category : "";
          const categoryKey = getServiceCategoryKey(category);
          const flowAnswers = (rawSession.conversationState?.flowAnswers ?? {}) as Record<string, string>;
          const infoSlots: InfoSlots = rawSession.infoSlots ?? INITIAL_INFO_SLOTS;
          const isOutsideCityConnectEstate = Boolean(rawSession.conversationState?.isOutsideCityConnectEstate);
          const selectedEstateName =
            typeof rawSession.conversationState?.selectedEstateName === "string"
              ? rawSession.conversationState.selectedEstateName
              : null;
          const hasImage =
            Boolean(rawSession.conversationState?.uploadedImageSrc) ||
            Array.isArray(rawSession.messages) && rawSession.messages.some((m: any) => m?.type === "image");

          const aiDecision: AiDecision = rawSession.conversationState?.aiDecision ?? {
            requiresConsultancy: false,
            consultancyCompleted: false,
          };
          const aiResponse: CityBuddyAiResponse | null = rawSession.conversationState?.aiResponse ?? null;
          const confidenceScore = typeof rawSession.confidenceScore === "number" ? rawSession.confidenceScore : 0;
          const step: ConversationStep = rawSession.conversationState?.step ?? "FLOW";

          const fallbackSummary: ConversationSummary = buildConversationSummary({
            category,
            categoryKey,
            flowAnswers,
            infoSlots,
            isOutsideCityConnectEstate,
            selectedEstateName,
            hasImage,
            aiDecision,
            aiResponse,
            confidenceScore,
            step,
          });

          const summary: ConversationSummary = rawSession.summary ?? fallbackSummary;
          const title = typeof rawSession.title === "string" && rawSession.title.trim() ? rawSession.title : summary.headline;

          const readyToBook = Boolean(rawSession.readyToBook);
          const bookingCard = rawSession.bookingCard && typeof rawSession.bookingCard === "object" ? (rawSession.bookingCard as BookingCard) : null;

          const rawPriceCard = rawSession.priceEstimationCard && typeof rawSession.priceEstimationCard === "object"
            ? (rawSession.priceEstimationCard as PriceEstimationCard)
            : null;

          const thresholdReached = Boolean(categoryKey) && hasSufficientConfidence(categoryKey!, confidenceScore);
          const shouldShowPricing =
            thresholdReached &&
            (summary.recommendedApproach === "Professional" || summary.recommendedApproach === "Hybrid") &&
            Boolean(bookingCard);

          const issueTextForPricing = (flowAnswers.issue || rawSession.conversationState?.issueText || "").trim();
          const timingTextForPricing = (flowAnswers.timing || "").trim();

          const computedPriceCard =
            shouldShowPricing && bookingCard
              ? buildPriceEstimationCard({
                  sessionId: rawSession.id,
                  category,
                  categoryKey,
                  bookingCard,
                  summary,
                  confidenceScore,
                  thresholdReached,
                  issueText: issueTextForPricing,
                  timingText: timingTextForPricing,
                  hasImage,
                  existingCard: rawPriceCard,
                })
              : null;

          const priceLine = computedPriceCard
            ? `Estimated cost: ${formatNgnRange(computedPriceCard.estimatedRange.min, computedPriceCard.estimatedRange.max)} (estimate)`
            : "";

          const summaryWithPrice: ConversationSummary = computedPriceCard
            ? {
                ...summary,
                estimatedPriceRange: computedPriceCard.estimatedRange,
                priceConfidenceLevel: computedPriceCard.confidenceLevel,
                details: uniqueNonEmpty(priceLine ? [...(summary.details || []), priceLine] : (summary.details || [])),
              }
            : summary;

          return {
            ...rawSession,
            title,
            summary: summaryWithPrice,
            bookingCard,
            priceEstimationCard: computedPriceCard,
            readyToBook,
            infoSlots,
          } as ConversationSession;
        });

        const deduped = dedupeConversationSessions(normalized);
        setConversationSessions(deduped);
        setActiveConversationSessionId((prev) => prev ?? deduped[0]?.id ?? null);
      } catch {
        setConversationSessions([]);
        setActiveConversationSessionId(null);
      }
    };

    (async () => {
      if (!user?.id) {
        loadFromLocalStorage();
        return;
      }
      try {
        const remote = await fetchConversations();
        if (cancelled) return;
        setConversationSyncAvailable(true);
        if (!remote.length) {
          setConversationSessions([]);
          setActiveConversationSessionId(null);
          return;
        }
        const sessions = remote.map((conversation) =>
          buildEmptyConversationSession(
            conversation.category,
            conversation.id,
            conversation.updatedAt || conversation.createdAt || new Date().toISOString(),
          ),
        );
        const deduped = dedupeConversationSessions(sessions);
        setConversationSessions(deduped);
        setActiveConversationSessionId((prev) => prev ?? deduped[0]?.id ?? null);
      } catch {
        if (cancelled) return;
        setConversationSyncAvailable(false);
        loadFromLocalStorage();
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [buildEmptyConversationSession, dedupeConversationSessions, sessionsStorageKey, user?.id]);

  useEffect(() => {
    if (conversationSyncAvailable) return;
    try {
      localStorage.setItem(sessionsStorageKey, JSON.stringify(conversationSessions));
    } catch {
      // ignore localStorage quota/blocked errors
    }
  }, [conversationSessions, conversationSyncAvailable, sessionsStorageKey]);

  const applySessionToState = useCallback(
    (session: ConversationSession, steps: StepConfig[], options?: { includeResumeMessage?: boolean }) => {
      // Selecting a conversation should not reorder it.
      suppressSessionAutosaveRef.current = true;
      window.setTimeout(() => {
        suppressSessionAutosaveRef.current = false;
      }, 0);

      setActiveConversationSessionId(session.id);
      setSelectedCategory(session.category);
      setCurrentView('conversation');
      setFlowSteps(steps);
      setFlowIndex(session.conversationState.flowIndex);
      setFlowAnswers(session.conversationState.flowAnswers);

      const resumeAck: HistoryItem = {
        id: makeHistoryId(),
        type: "ai_message",
        text: "Welcome back - let's continue where we left off.",
      };
      setHistory(() => {
        const base = session.messages;
        if (!options?.includeResumeMessage) return base;
        const last = base[base.length - 1];
        const shouldAppend = last?.type !== "ai_message" || last.text !== resumeAck.text;
        return shouldAppend ? [...base, resumeAck] : base;
      });

      setInputValue("");
      setStep(session.conversationState.step);
      setIssueText(session.conversationState.issueText);
      setUseManualEstate(session.conversationState.useManualEstate);
      setSelectedEstateName(session.conversationState.selectedEstateName);
      setIsOutsideCityConnectEstate(session.conversationState.isOutsideCityConnectEstate);
      setStartDate(session.conversationState.startDate);
      setStartTime(session.conversationState.startTime);
      setStartQuickTag(session.conversationState.startQuickTag);
      setAiResponse(session.conversationState.aiResponse);
      setAiDecision(session.conversationState.aiDecision);
      setIsUserDistressed(session.conversationState.isUserDistressed);
      setEarlyStopAcknowledged(session.conversationState.earlyStopAcknowledged);
      setImageDeclined(session.conversationState.imageDeclined);
      setUploadedImageSrc(session.conversationState.uploadedImageSrc);
      const parsed = session.conversationState.uploadedImageSrc
        ? parseDataUrl(session.conversationState.uploadedImageSrc)
        : null;
      setUploadedImages(parsed ? [parsed] : []);

      setUserDescription("");
      setConfidenceScore(session.confidenceScore);
      setInfoSlots(session.infoSlots);
      savedHistoryIdsRef.current = new Set(session.messages.map((item) => item.id));
      lastSavedAiResponseRef.current = session.conversationState.aiResponse?.message
        ? `${session.id}:${session.conversationState.aiResponse.message}`
        : null;
    },
    [],
  );

  useEffect(() => {
    if (!historyLoadError) return;
    toast({
      title: "Unable to load previous conversation",
      description: historyLoadError,
      variant: "destructive",
    });
    setHistoryLoadError(null);
  }, [historyLoadError, toast]);

  const startNewConversationSession = useCallback(
    (categoryName: string, options?: { preserveView?: boolean }) => {
      void (async () => {
        const now = Date.now();
        if (now - lastNewSessionAtRef.current < 600) return;
        lastNewSessionAtRef.current = now;

        const categoryKey = getServiceCategoryKey(categoryName);
        if (!categoryKey) return;

        const existing = conversationSessions.find((s) => s.category === categoryName);
        if (existing) {
          const steps = buildFlowStepsForCategory(categoryKey);
          applySessionToState(existing, steps, { includeResumeMessage: false });
          if (conversationSyncAvailable) {
            await hydrateConversationMessages(existing.id, categoryName);
          }
          return;
        }

        let sessionId = makeHistoryId();
        let updatedAt = new Date().toISOString();
        if (conversationSyncAvailable) {
          try {
            const conversation = await getOrCreateConversation(categoryName);
            sessionId = conversation.id;
            updatedAt = conversation.updatedAt || conversation.createdAt || updatedAt;
          } catch {
            setConversationSyncAvailable(false);
          }
        }

        const steps = buildFlowStepsForCategory(categoryKey);
        const newSession = buildEmptyConversationSession(categoryName, sessionId, updatedAt);

        setConversationSessions((prev) => [newSession, ...prev]);
        setActiveConversationSessionId(sessionId);

        if (!options?.preserveView) {
          setSelectedCategory(categoryName);
          setCurrentView('conversation');
          setFlowSteps(steps);
          setFlowIndex(0);
          setFlowAnswers({});

          setInputValue("");
          setStep("FLOW");
          setHistory(newSession.messages);
          setUploadedImageSrc(null);
          setUploadedImages([]);
          setUserDescription("");
          setIssueText("");
          setUseManualEstate(false);
          setSelectedEstateName(null);
          setIsOutsideCityConnectEstate(false);
          setStartDate("");
          setStartTime("");
          setStartQuickTag(null);
          setAiResponse(null);
          setAiDecision({ requiresConsultancy: false, consultancyCompleted: false });
          setConfidenceScore(0);
          setInfoSlots(INITIAL_INFO_SLOTS);
          setImageDeclined(false);
          setEarlyStopAcknowledged(false);
          setSendError(null);
          setIsUserDistressed(false);
          setHasChosenAction(false);
          lastSavedAiResponseRef.current = null;
          savedHistoryIdsRef.current = new Set(newSession.messages.map((item) => item.id));
        }

        if (conversationSyncAvailable) {
          await hydrateConversationMessages(sessionId, categoryName);
        }
      })();
    },
    [
      applySessionToState,
      buildEmptyConversationSession,
      conversationSessions,
      conversationSyncAvailable,
      hydrateConversationMessages,
    ],
  );

  const handleSelectConversationSession = useCallback(
    (sessionId: string) => {
      const session = conversationSessions.find((s) => s.id === sessionId);
      if (!session) return;

      const categoryKey = getServiceCategoryKey(session.category);
      if (!categoryKey) return;
      const steps = buildFlowStepsForCategory(categoryKey);

      applySessionToState(session, steps, { includeResumeMessage: true });
      setSendError(null);
      setHasChosenAction(false);

      if (conversationSyncAvailable) {
        void hydrateConversationMessages(session.id, session.category);
      }
    },
    [applySessionToState, conversationSessions, conversationSyncAvailable, hydrateConversationMessages],
  );

  useEffect(() => {
    if (!conversationSyncAvailable) return;
    if (!activeConversationSessionId) return;
    if (!history.length) return;

    const pending = history.filter((item) => !savedHistoryIdsRef.current.has(item.id));
    if (!pending.length) return;

    void (async () => {
      try {
        for (const item of pending) {
          if (item.type === "ticket") continue;
          const payload = {
            role: item.type === "user_text" || item.type === "image" ? "user" : "assistant",
            type: item.type === "image" ? "image" : "text",
            content: item.type === "image" ? item.src : item.text,
          } as const;

          const saved = await appendMessage(activeConversationSessionId, payload);
          savedHistoryIdsRef.current.add(item.id);
          // Use server ids for hydration, but keep local ids for UI continuity.
          if (saved?.id) {
            savedHistoryIdsRef.current.add(saved.id);
          }
        }
      } catch (error: any) {
        setConversationSyncAvailable(false);
        toast({
          title: "Unable to save message",
          description: error?.message || "Please check your connection.",
          variant: "destructive",
        });
      }
    })();
  }, [activeConversationSessionId, conversationSyncAvailable, history, toast]);

  useEffect(() => {
    if (!conversationSyncAvailable) return;
    if (!activeConversationSessionId) return;
    if (!aiResponse?.message) return;

    const fingerprint = `${activeConversationSessionId}:${aiResponse.message}`;
    if (lastSavedAiResponseRef.current === fingerprint) return;
    lastSavedAiResponseRef.current = fingerprint;

    void (async () => {
      try {
        await appendMessage(activeConversationSessionId, {
          role: "assistant",
          type: "text",
          content: aiResponse.message,
          meta: aiResponse,
        });
      } catch (error: any) {
        setConversationSyncAvailable(false);
        toast({
          title: "Unable to save AI response",
          description: error?.message || "Please check your connection.",
          variant: "destructive",
        });
      }
    })();
  }, [activeConversationSessionId, aiResponse, conversationSyncAvailable, toast]);

  useEffect(() => {
    if (!activeConversationSessionId) return;
    if (!selectedCategory) return;
    if (suppressSessionAutosaveRef.current) return;

    const categoryKey = getServiceCategoryKey(selectedCategory);
    const isResolvedNow =
      Boolean(categoryKey) && step === "AI_GUIDANCE" && hasSufficientConfidence(categoryKey!, confidenceScore);

    const nextTitle = deriveTitleFromIssue((flowAnswers.issue || issueText || "").trim());
    const shouldMoveToTop = sessionActivityRef.current;
    const nowIso = shouldMoveToTop ? new Date().toISOString() : "";

    setConversationSessions((prev) => {
      const existing = prev.find((s) => s.id === activeConversationSessionId);
      if (!existing) return prev;

      const confidenceDelta = confidenceScore - (existing.confidenceScore || 0);
      const categoryChanged = existing.category !== selectedCategory;
      const majorSlotKeys: Array<keyof InfoSlots> = ["description", "location", "timing", "urgency", "imageProvided"];
      const majorSlotCompleted = majorSlotKeys.some(
        (k) => Boolean(infoSlots[k]) && !Boolean(existing.infoSlots?.[k]),
      );
      const reachedThresholdNow =
        Boolean(categoryKey) && hasSufficientConfidence(categoryKey!, confidenceScore) &&
        !hasSufficientConfidence(categoryKey!, existing.confidenceScore || 0);

      const shouldUpdateSummary =
        !existing.summary ||
        categoryChanged ||
        confidenceDelta >= 10 ||
        majorSlotCompleted ||
        reachedThresholdNow ||
        (!existing.isResolved && isResolvedNow);

      const computedSummary = buildConversationSummary({
        category: selectedCategory,
        categoryKey,
        flowAnswers,
        infoSlots,
        isOutsideCityConnectEstate,
        selectedEstateName,
        hasImage: Boolean(uploadedImageSrc) || history.some((h) => h.type === "image"),
        aiDecision,
        aiResponse,
        confidenceScore,
        step,
      });

      const thresholdReached = Boolean(categoryKey) && hasSufficientConfidence(categoryKey!, confidenceScore);
      const showBookingCard =
        thresholdReached &&
        (computedSummary.recommendedApproach === "Professional" || computedSummary.recommendedApproach === "Hybrid");

      const nextBookingCard = showBookingCard
        ? buildBookingCard({
            sessionId: existing.id,
            category: selectedCategory,
            categoryKey,
            summary: computedSummary,
            flowAnswers,
            isOutsideCityConnectEstate,
            selectedEstateName,
            aiDecision,
            uploadedImageSrc,
            history,
            existingPreview: existing.bookingCard?.imagePreview ?? null,
          })
        : null;

      // Price estimation card: only after booking card is generated + confidence threshold reached
      const shouldShowPriceCard = Boolean(nextBookingCard) && showBookingCard;

      // Provider matching preview eligibility is computed after nextPriceEstimationCard is available.

      // Memory baseline: last known estimate for same category (never cross-category)
      const memoryBaseline = (() => {
        const matches = prev
          .filter((s) => s.id !== activeConversationSessionId)
          .filter((s) => s.category === selectedCategory)
          .filter((s) => s.summary?.estimatedPriceRange && typeof s.summary.estimatedPriceRange.min === "number" && typeof s.summary.estimatedPriceRange.max === "number")
          .sort((a, b) => {
            const at = new Date(a.lastUpdated).getTime();
            const bt = new Date(b.lastUpdated).getTime();
            return (Number.isFinite(bt) ? bt : 0) - (Number.isFinite(at) ? at : 0);
          });
        const last = matches[0]?.summary?.estimatedPriceRange;
        return last ? { min: last.min, max: last.max } : null;
      })();

      const nextPriceEstimationCard =
        shouldShowPriceCard && nextBookingCard
          ? buildPriceEstimationCard({
              sessionId: existing.id,
              category: selectedCategory,
              categoryKey,
              bookingCard: nextBookingCard,
              summary: computedSummary,
              confidenceScore,
              thresholdReached,
              issueText: (flowAnswers.issue || issueText || "").trim(),
              timingText: (flowAnswers.timing || "").trim(),
              hasImage: Boolean(uploadedImageSrc) || history.some((h) => h.type === "image"),
              existingCard: existing.priceEstimationCard ?? null,
              memoryBaselineRange: memoryBaseline,
            })
          : null;

          // Provider matching preview: show as soon as booking card is available.
          // (Price estimate may be unavailable, but provider preview can still help users decide next steps.)
          const shouldShowProviderPreview = Boolean(nextBookingCard) && showBookingCard;

      const priceLine = nextPriceEstimationCard
        ? `Estimated cost: ${formatNgnRange(nextPriceEstimationCard.estimatedRange.min, nextPriceEstimationCard.estimatedRange.max)} (estimate)`
        : "";

      const summaryWithPrice: ConversationSummary = nextPriceEstimationCard
        ? {
            ...computedSummary,
            estimatedPriceRange: nextPriceEstimationCard.estimatedRange,
            priceConfidenceLevel: nextPriceEstimationCard.confidenceLevel,
            details: uniqueNonEmpty(priceLine ? [...computedSummary.details, priceLine] : computedSummary.details),
          }
        : computedSummary;

      const baseSummaryForPrice: ConversationSummary = existing.summary ?? computedSummary;
      const summaryWithPriceOnly: ConversationSummary = nextPriceEstimationCard
        ? {
            ...baseSummaryForPrice,
            estimatedPriceRange: nextPriceEstimationCard.estimatedRange,
            priceConfidenceLevel: nextPriceEstimationCard.confidenceLevel,
            details: uniqueNonEmpty(
              priceLine ? [...(baseSummaryForPrice.details ?? []), priceLine] : (baseSummaryForPrice.details ?? []),
            ),
          }
        : baseSummaryForPrice;

      const shouldUpdatePriceInSummary = Boolean(nextPriceEstimationCard) &&
        (!existing.summary?.estimatedPriceRange ||
          existing.summary.estimatedPriceRange.min !== nextPriceEstimationCard!.estimatedRange.min ||
          existing.summary.estimatedPriceRange.max !== nextPriceEstimationCard!.estimatedRange.max ||
          existing.summary.priceConfidenceLevel !== nextPriceEstimationCard!.confidenceLevel);

      const updated: ConversationSession = {
        ...existing,
        category: selectedCategory,
        title: shouldUpdateSummary ? summaryWithPrice.headline : existing.title,
        summary: shouldUpdateSummary ? summaryWithPrice : shouldUpdatePriceInSummary ? summaryWithPriceOnly : existing.summary,
        bookingCard: nextBookingCard,
        priceEstimationCard: nextPriceEstimationCard,
        providerMatchingPreview: shouldShowProviderPreview ? (existing.providerMatchingPreview ?? null) : null,
        readyToBook: Boolean(nextBookingCard),
        lastUpdated: shouldMoveToTop ? nowIso : existing.lastUpdated,
        confidenceScore,
        isResolved: existing.isResolved || isResolvedNow,
        messages: history,
        infoSlots,
        conversationState: {
          step,
          flowIndex,
          flowAnswers,
          issueText,
          selectedEstateName,
          isOutsideCityConnectEstate,
          useManualEstate,
          startDate,
          startTime,
          startQuickTag,
          imageDeclined,
          uploadedImageSrc: safeImageForStorage(uploadedImageSrc),
          aiResponse,
          aiDecision,
          isUserDistressed,
          earlyStopAcknowledged,
        },
      };

      if (shouldMoveToTop) {
        const without = prev.filter((s) => s.id !== activeConversationSessionId);
        return [updated, ...without];
      }

      return prev.map((s) => (s.id === activeConversationSessionId ? updated : s));
    });

    if (shouldMoveToTop) {
      sessionActivityRef.current = false;
    }
  }, [
    activeConversationSessionId,
    aiDecision,
    aiResponse,
    confidenceScore,
    flowAnswers,
    flowIndex,
    history,
    imageDeclined,
    infoSlots,
    isOutsideCityConnectEstate,
    isUserDistressed,
    issueText,
    selectedCategory,
    selectedEstateName,
    startDate,
    startQuickTag,
    startTime,
    step,
    earlyStopAcknowledged,
    uploadedImageSrc,
    useManualEstate,
  ]);

  // Fetch/refresh provider preview when the session becomes eligible.
  useEffect(() => {
    if (!activeConversationSessionId) return;
    if (!activeConversationSession) return;
    if (!activeConversationSession.bookingCard) return;
    const categoryKey = getServiceCategoryKey(activeConversationSession.category);
    if (!categoryKey) return;

    const thresholdReached = hasSufficientConfidence(categoryKey, activeConversationSession.confidenceScore || 0);
    const approach = activeConversationSession.summary?.recommendedApproach;
    // Debug logging removed

    const eligible =
      thresholdReached &&
      (approach === "Professional" || approach === "Hybrid") &&
      Boolean(activeConversationSession.bookingCard) &&
      Boolean(activeConversationSession.bookingCard);

    // Fire-and-forget snapshot for SUPER_ADMIN observability.
    // This is intentionally non-blocking and safe to fail.
    try {
      const imageCount = Array.isArray(activeConversationSession.bookingCard?.imagePreview)
        ? activeConversationSession.bookingCard!.imagePreview!.length
        : 0;
      const snapshotFingerprint = JSON.stringify({
        sessionId: activeConversationSessionId,
        category: activeConversationSession.category,
        urgency: activeConversationSession.summary?.urgency ?? null,
        recommendedApproach: activeConversationSession.summary?.recommendedApproach ?? null,
        confidenceScore: activeConversationSession.confidenceScore ?? 0,
        requiresConsultancy: Boolean(aiDecision?.requiresConsultancy),
        readyToBook: Boolean(activeConversationSession.readyToBook),
        headline: activeConversationSession.summary?.headline ?? null,
        scope: activeConversationSession.bookingCard?.estimatedScope ?? null,
        imageCount,
      });

      const last = lastPreparedSnapshotFingerprintRef.current[activeConversationSessionId];
      if (last !== snapshotFingerprint) {
        lastPreparedSnapshotFingerprintRef.current[activeConversationSessionId] = snapshotFingerprint;
        void apiRequest("POST", "/api/ai/prepared-requests/snapshot", {
          sessionId: activeConversationSessionId,
          category: activeConversationSession.category,
          urgency: activeConversationSession.summary?.urgency ?? "medium",
          recommendedApproach: activeConversationSession.summary?.recommendedApproach ?? "Hybrid",
          confidenceScore: activeConversationSession.confidenceScore ?? 0,
          requiresConsultancy: Boolean(aiDecision?.requiresConsultancy),
          readyToBook: Boolean(activeConversationSession.readyToBook),
          snapshot: {
            headline: activeConversationSession.summary?.headline ?? null,
            scope: activeConversationSession.bookingCard?.estimatedScope ?? null,
            imageCount,
          },
        }).catch(() => {
          // ignore snapshot errors
        });
      }
    } catch (e) {
      // ignore snapshot errors
    }

    if (!eligible) return;

    const fingerprint = buildProviderPreviewFingerprint({
      categoryKey,
      urgency: activeConversationSession.summary?.urgency ?? null,
      scope: activeConversationSession.bookingCard?.estimatedScope ?? null,
    });

    const existingPreview = activeConversationSession.providerMatchingPreview;
    if (existingPreview && existingPreview.inputFingerprint === fingerprint && Array.isArray(existingPreview.providers)) {
      return;
    }

    let cancelled = false;
    (async () => {
      const result = await fetchProviderMatchingPreview({
        category: activeConversationSession.category,
        urgency: activeConversationSession.summary?.urgency ?? null,
        limit: 4,
      });

      if (cancelled) return;

      const note = result
        ? result.usedEstateId
          ? result.estateSpecificCount > 0
            ? "Showing providers with estate proximity preference. Availability is not guaranteed."
            : "No estate-specific providers found — showing nearby/city-wide verified providers instead. Availability is not guaranteed."
          : "Showing city-wide verified providers. Availability is not guaranteed."
        : "Provider preview is temporarily unavailable.";

      const preview: ProviderMatchingPreview = {
        providers: result?.providers ?? [],
        usedEstateId: result?.usedEstateId ?? null,
        estateSpecificCount: result?.estateSpecificCount ?? 0,
        note,
        inputFingerprint: fingerprint,
        createdAtIso: new Date().toISOString(),
      };

      markSessionActivity();
      setConversationSessions((prev) =>
        prev.map((s) => (s.id === activeConversationSessionId ? { ...s, providerMatchingPreview: preview } : s)),
      );
    })();

    return () => {
      cancelled = true;
    };
  }, [activeConversationSession, activeConversationSessionId, markSessionActivity]);

  useEffect(() => {
    // When routed directly into the conversation view (e.g. /chat?category=...),
    // ensure we seed the initial AI prompt and create a session if needed.
    if (currentView !== 'conversation') return;
    if (!selectedCategory) return;
    if (history.length > 0) return;

    if (!activeConversationSessionId) {
      startNewConversationSession(selectedCategory);
      return;
    }

    const categoryKey = getServiceCategoryKey(selectedCategory);
    if (!categoryKey) return;

    const steps = buildFlowStepsForCategory(categoryKey);
    setFlowSteps(steps);
    setFlowIndex(0);
    setFlowAnswers({});

    setInputValue("");
    setStep("FLOW");
    setHistory([{ id: makeHistoryId(), type: "ai_message", text: steps[0]?.message || "" }]);
    setUploadedImageSrc(null);
    setUploadedImages([]);
    setUserDescription("");
    setIssueText("");
    setUseManualEstate(false);
    setSelectedEstateName(null);
    setIsOutsideCityConnectEstate(false);
    setStartDate("");
    setStartTime("");
    setStartQuickTag(null);
    setAiResponse(null);
    setAiDecision({ requiresConsultancy: false, consultancyCompleted: false });
    setConfidenceScore(0);
    setInfoSlots(INITIAL_INFO_SLOTS);
    setImageDeclined(false);
    setEarlyStopAcknowledged(false);
    setSendError(null);
    setIsUserDistressed(false);
    setHasChosenAction(false);
  }, [currentView, history.length, selectedCategory]);

  const handleCategorySelect = (categoryName: string) => {
    if (onCategorySelected) {
      // When an external navigation callback is provided, let the destination
      // page create the session. Calling startNewConversationSession here
      // would create a session that isn't persisted before navigation,
      // leading to duplicate sessions when the new page also creates one.
      onCategorySelected(categoryName);
      return;
    }

    if (isChangingCategoryRef.current && activeConversationSessionId) {
      isChangingCategoryRef.current = false;
      applyCategoryChangeToActiveSession(categoryName);
      return;
    }

    const categoryKey = getServiceCategoryKey(categoryName);
    if (!categoryKey) return;
    const steps = buildFlowStepsForCategory(categoryKey);

    startNewConversationSession(categoryName);
  };

  const getNextFlowIndex = useCallback(
    (fromIndex: number, nextAnswers: Record<string, string>, nextSlots: InfoSlots, nextConfidence: number) => {
      const categoryKey = getServiceCategoryKey(selectedCategory);
      if (categoryKey && nextSlots.description && hasSufficientConfidence(categoryKey, nextConfidence)) {
        return flowSteps.length;
      }

      const issue = (nextAnswers.issue || issueText || "").trim();
      const descriptionHighQuality = issue.length >= 30 && !isVagueResponse(issue);

      for (let i = fromIndex + 1; i < flowSteps.length; i++) {
        const s = flowSteps[i];

        // Never ask for a slot that is already completed.
        if (s.slotKey && nextSlots[s.slotKey]) continue;

        // Never re-ask a step already answered.
        if (nextAnswers[s.id] && nextAnswers[s.id].trim()) continue;

        // Intelligent image request gating.
        if (s.id === "image") {
          if (imageDeclined) continue;
          const catVisualsHelpful = categoryKey ? (DYNAMIC_CATEGORY_VISUALS_HELPFUL[categoryKey] ?? DEFAULT_CATEGORY_VISUALS_HELPFUL[categoryKey] ?? true) : true;
          if (categoryKey && !catVisualsHelpful) continue;
          if (categoryKey && hasSufficientConfidence(categoryKey, nextConfidence)) continue;
          if (!descriptionHighQuality) continue;
        }

        return i;
      }

      return flowSteps.length;
    },
    [flowSteps, imageDeclined, issueText, selectedCategory],
  );

  const handleBackToSelectCategory = () => {
    setCurrentView('select-category');
    setSearchQuery("");
  };

  const resetConversationStateToFresh = useCallback(() => {
    setCurrentView('select-category');
    setSelectedCategory(undefined);
    setSearchQuery("");
    setInputValue("");
    setStep("FLOW");
    setFlowSteps([]);
    setFlowIndex(0);
    setFlowAnswers({});
    setHistory([]);
    setUploadedImageSrc(null);
    setUploadedImages([]);
    setUserDescription("");
    setIssueText("");
    setUseManualEstate(false);
    setSelectedEstateName(null);
    setIsOutsideCityConnectEstate(false);
    setStartDate("");
    setStartTime("");
    setStartQuickTag(null);
    setAiResponse(null);
    setAiDecision({ requiresConsultancy: false, consultancyCompleted: false });
    setConfidenceScore(0);
    setInfoSlots(INITIAL_INFO_SLOTS);
    setImageDeclined(false);
    setEarlyStopAcknowledged(false);
    setSendError(null);
    setIsUserDistressed(false);
    setHasChosenAction(false);
  }, []);

  const handleClearAllConversations = useCallback(() => {
    setConversationSessions([]);
    setActiveConversationSessionId(null);
    try {
      localStorage.removeItem(sessionsStorageKey);
    } catch {
      // ignore
    }
    resetConversationStateToFresh();
  }, [resetConversationStateToFresh, sessionsStorageKey]);

  const handleDeleteConversationSession = useCallback(
    (sessionId: string) => {
      setConversationSessions((prev) => prev.filter((s) => s.id !== sessionId));
      setActiveConversationSessionId((prev) => {
        if (prev !== sessionId) return prev;
        return null;
      });

      if (activeConversationSessionId === sessionId) {
        resetConversationStateToFresh();
      }
    },
    [activeConversationSessionId, resetConversationStateToFresh],
  );

  const handleCreateNewRequest = useCallback(() => {
    setActiveConversationSessionId(null);
    resetConversationStateToFresh();
  }, [resetConversationStateToFresh]);

  const handleSend = useCallback(async () => {
    const activeFlowStep = step === "FLOW" ? flowSteps[flowIndex] ?? null : null;
    const canSendFromStep =
      (step === "FLOW" && Boolean(activeFlowStep?.allowManualInput)) ||
      (step === "AI_GUIDANCE" && aiResponse?.intent === "clarify" && Boolean(aiResponse.followUpQuestion));
    if (!canSendFromStep) return;
    if (!inputValue.trim() || isSending || !selectedCategory) return;

    const userMessage = inputValue.trim();
    setInputValue("");

    setSendError(null);

    markSessionActivity();

    // AI clarify follow-up
    if (step === "AI_GUIDANCE" && aiResponse?.intent === "clarify") {
      setHistory((prev) => [...prev, { id: makeHistoryId(), type: "user_text", text: userMessage }]);
      await new Promise((r) => window.setTimeout(r, 250));
      setUserDescription((prev) => {
        const base = prev?.trim() ? prev.trim() : "";
        const addition = userMessage;
        return base ? `${base}\n\nUpdate: ${addition}` : addition;
      });
      setStep("AI_ANALYSING");
      return;
    }

    if (step !== "FLOW" || !activeFlowStep) return;

    setHistory((prev) => [...prev, { id: makeHistoryId(), type: "user_text", text: userMessage }]);

    // Distress: prioritize immediate guidance over data collection.
    if (activeFlowStep.id === "issue") {
      const distressed = isUrgentOrDistressed(userMessage);
      const quick = parseQuickIntake(userMessage);
      const issue = (quick.issue || userMessage).trim();

      setIssueText(issue);

      // Prefill answers from a single detailed message to speed up the flow.
      const prefilled: Record<string, string> = { issue };
      if (quick.estate) prefilled.estate = quick.estate;
      if (quick.timing) prefilled.timing = quick.timing;
      if (quick.urgency) prefilled.urgency = quick.urgency;

      if (quick.outsideEstate) {
        setIsOutsideCityConnectEstate(true);
        setSelectedEstateName(null);
        setUseManualEstate(false);
        prefilled.estate = "Not in a CityConnect estate";
      } else if (quick.estate && quick.estate !== "Not in a CityConnect estate") {
        setIsOutsideCityConnectEstate(false);
        setSelectedEstateName(quick.estate);
        setUseManualEstate(false);
      }

      const nextAnswers = { ...flowAnswers, ...prefilled };
      setFlowAnswers(nextAnswers);

      // Confidence/slot updates for the first message.
      const categoryKey = getServiceCategoryKey(selectedCategory);
      let nextSlots = { ...infoSlots };
      let nextConfidence = confidenceScore;

      const update = scoreResponseUpdate({
        categoryKey,
        prevConfidenceScore: nextConfidence,
        prevSlots: nextSlots,
        prevAnswers: flowAnswers,
        step: activeFlowStep,
        answerText: issue,
        source: "manual",
        imageDeclined,
      });
      nextConfidence = update.nextConfidenceScore;
      nextSlots = update.nextSlots;

      // Credit extra context if the user included it in the first message.
      if (quick.estate && !nextSlots.location) {
        nextSlots.location = true;
        nextConfidence += 10;
      }
      if (quick.timing && !nextSlots.timing) {
        nextSlots.timing = true;
        nextConfidence += 10;
      }
      if (quick.urgency && !nextSlots.urgency) {
        nextSlots.urgency = true;
        nextConfidence += 10;
      }

      nextConfidence = clampConfidence(nextConfidence);
      setConfidenceScore(nextConfidence);
      setInfoSlots(nextSlots);

      if (distressed) {
        setIsUserDistressed(true);
        setUserDescription(issue);
        setStep("AI_ANALYSING");
        return;
      }

      if (categoryKey && nextSlots.description && hasSufficientConfidence(categoryKey, nextConfidence)) {
        if (!earlyStopAcknowledged) {
          setEarlyStopAcknowledged(true);
          setHistory((prev) => [
            ...prev,
            { id: makeHistoryId(), type: "ai_message", text: "Thanks — I have a clear picture of the issue now." },
          ]);
        }
        setStep("AI_ANALYSING");
        return;
      }

      const nextIndex = getNextFlowIndex(flowIndex, { ...flowAnswers, ...prefilled }, nextSlots, nextConfidence);
      if (nextIndex >= flowSteps.length) {
        setStep("AI_ANALYSING");
        return;
      }
      setFlowIndex(nextIndex);
      setHistory((prev) => [
        ...prev,
        { id: makeHistoryId(), type: "ai_message", text: flowSteps[nextIndex]?.message || "" },
      ]);
      return;
    }

    const categoryKey = getServiceCategoryKey(selectedCategory);
    const nextAnswers = { ...flowAnswers, [activeFlowStep.id]: userMessage };

    if (activeFlowStep.id === "estate") {
      setSelectedEstateName(userMessage);
      setIsOutsideCityConnectEstate(false);
      setUseManualEstate(false);
      nextAnswers.estate = userMessage;
    }

    setFlowAnswers(nextAnswers);

    const update = scoreResponseUpdate({
      categoryKey,
      prevConfidenceScore: confidenceScore,
      prevSlots: infoSlots,
      prevAnswers: flowAnswers,
      step: activeFlowStep,
      answerText: userMessage,
      source: "manual",
      imageDeclined,
    });
    setConfidenceScore(update.nextConfidenceScore);
    setInfoSlots(update.nextSlots);

    if (categoryKey && update.nextSlots.description && hasSufficientConfidence(categoryKey, update.nextConfidenceScore)) {
      if (!earlyStopAcknowledged) {
        setEarlyStopAcknowledged(true);
        setHistory((prev) => [
          ...prev,
          { id: makeHistoryId(), type: "ai_message", text: "Thanks, I have a clear picture of the issue now." },
        ]);
      }
      setStep("AI_ANALYSING");
      return;
    }

    const nextIndex = getNextFlowIndex(flowIndex, nextAnswers, update.nextSlots, update.nextConfidenceScore);
    if (nextIndex >= flowSteps.length) {
      setStep("AI_ANALYSING");
      return;
    }
    setFlowIndex(nextIndex);
    setHistory((prev) => [...prev, { id: makeHistoryId(), type: "ai_message", text: flowSteps[nextIndex]?.message || "" }]);
    return;
  }, [
    aiResponse,
    confidenceScore,
    earlyStopAcknowledged,
    flowAnswers,
    flowIndex,
    flowSteps,
    getNextFlowIndex,
    imageDeclined,
    infoSlots,
    inputValue,
    isSending,
    issueText,
    markSessionActivity,
    selectedCategory,
    step,
  ]);

  const onToggleManualEstate = () => {
    const activeFlowStep = step === "FLOW" ? flowSteps[flowIndex] ?? null : null;
    if (!activeFlowStep || activeFlowStep.id !== "estate") return;
    setUseManualEstate((prev) => {
      const next = !prev;
      if (next) {
        setHistory((h) => [...h, { id: makeHistoryId(), type: "ai_message", text: "Okay — type your estate name." }]);
      }
      return next;
    });
  };

  const onSelectEstate = (value: string) => {
    const activeFlowStep = step === "FLOW" ? flowSteps[flowIndex] ?? null : null;
    if (!activeFlowStep || activeFlowStep.id !== "estate") return;

    markSessionActivity();

    const isNotInCityConnect = value === "__not_in_cityconnect__";
    setUseManualEstate(false);
    setSelectedEstateName(isNotInCityConnect ? null : value);
    setIsOutsideCityConnectEstate(isNotInCityConnect);

    const answerText = isNotInCityConnect ? "Not in a CityConnect estate" : value;
    const categoryKey = getServiceCategoryKey(selectedCategory);
    const nextAnswers = { ...flowAnswers, estate: answerText };
    setFlowAnswers(nextAnswers);

    const update = scoreResponseUpdate({
      categoryKey,
      prevConfidenceScore: confidenceScore,
      prevSlots: infoSlots,
      prevAnswers: flowAnswers,
      step: activeFlowStep,
      answerText,
      source: "structured",
      imageDeclined,
    });
    setConfidenceScore(update.nextConfidenceScore);
    setInfoSlots(update.nextSlots);

    if (categoryKey && update.nextSlots.description && hasSufficientConfidence(categoryKey, update.nextConfidenceScore)) {
      if (!earlyStopAcknowledged) {
        setEarlyStopAcknowledged(true);
        setHistory((prev) => [
          ...prev,
          { id: makeHistoryId(), type: "user_text", text: answerText },
          { id: makeHistoryId(), type: "ai_message", text: "Thanks — I have a clear picture of the issue now." },
        ]);
      } else {
        setHistory((prev) => [...prev, { id: makeHistoryId(), type: "user_text", text: answerText }]);
      }
      setStep("AI_ANALYSING");
      return;
    }

    const nextIndex = getNextFlowIndex(flowIndex, nextAnswers, update.nextSlots, update.nextConfidenceScore);
    if (nextIndex >= flowSteps.length) {
      setHistory((prev) => [...prev, { id: makeHistoryId(), type: "user_text", text: answerText }]);
      setStep("AI_ANALYSING");
      return;
    }
    setHistory((prev) => [
      ...prev,
      { id: makeHistoryId(), type: "user_text", text: answerText },
      { id: makeHistoryId(), type: "ai_message", text: flowSteps[nextIndex]?.message || "" },
    ]);
    setFlowIndex(nextIndex);
  };

  const onStartDateChange = (value: string) => {
    const activeFlowStep = step === "FLOW" ? flowSteps[flowIndex] ?? null : null;
    if (!activeFlowStep || activeFlowStep.id !== "timing") return;
    setStartDate(value);
    if (value) setStartQuickTag(null);
  };

  const onStartTimeChange = (value: string) => {
    const activeFlowStep = step === "FLOW" ? flowSteps[flowIndex] ?? null : null;
    if (!activeFlowStep || activeFlowStep.id !== "timing") return;
    setStartTime(value);
  };

  const onSelectStartQuickTag = (tag: string) => {
    const activeFlowStep = step === "FLOW" ? flowSteps[flowIndex] ?? null : null;
    if (!activeFlowStep || activeFlowStep.id !== "timing") return;
    setStartQuickTag(tag);

    // Compute date and time based on the selected quick tag
    const now = new Date();
    const formatDate = (d: Date) => d.toISOString().split("T")[0]; // YYYY-MM-DD
    const formatTime = (d: Date) => {
      const h = String(d.getHours()).padStart(2, "0");
      const m = String(d.getMinutes()).padStart(2, "0");
      return `${h}:${m}`;
    };

    switch (tag) {
      case "Today": {
        setStartDate(formatDate(now));
        setStartTime(formatTime(now));
        break;
      }
      case "Yesterday": {
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        setStartDate(formatDate(yesterday));
        setStartTime(formatTime(now));
        break;
      }
      case "This morning": {
        setStartDate(formatDate(now));
        setStartTime(formatTime(now));
        break;
      }
      case "This afternoon": {
        setStartDate(formatDate(now));
        setStartTime(formatTime(now));
        break;
      }
      case "This evening": {
        setStartDate(formatDate(now));
        setStartTime(formatTime(now));
        break;
      }
      case "Not sure":
      default: {
        setStartDate("");
        setStartTime("");
        break;
      }
    }
  };

  const onContinueTiming = () => {
    const activeFlowStep = step === "FLOW" ? flowSteps[flowIndex] ?? null : null;
    if (!activeFlowStep || activeFlowStep.id !== "timing") return;

    markSessionActivity();
    const timingText =
      startQuickTag ||
      [startDate, startTime].filter(Boolean).join(" ") ||
      "Not sure";

    const categoryKey = getServiceCategoryKey(selectedCategory);
    const nextAnswers = { ...flowAnswers, timing: timingText };
    setFlowAnswers(nextAnswers);

    const update = scoreResponseUpdate({
      categoryKey,
      prevConfidenceScore: confidenceScore,
      prevSlots: infoSlots,
      prevAnswers: flowAnswers,
      step: activeFlowStep,
      answerText: timingText,
      source: "structured",
      imageDeclined,
    });
    setConfidenceScore(update.nextConfidenceScore);
    setInfoSlots(update.nextSlots);

    if (categoryKey && update.nextSlots.description && hasSufficientConfidence(categoryKey, update.nextConfidenceScore)) {
      if (!earlyStopAcknowledged) {
        setEarlyStopAcknowledged(true);
        setHistory((prev) => [
          ...prev,
          { id: makeHistoryId(), type: "user_text", text: timingText },
          { id: makeHistoryId(), type: "ai_message", text: "Thanks — I have a clear picture of the issue now." },
        ]);
      } else {
        setHistory((prev) => [...prev, { id: makeHistoryId(), type: "user_text", text: timingText }]);
      }
      setStep("AI_ANALYSING");
      return;
    }

    const nextIndex = getNextFlowIndex(flowIndex, nextAnswers, update.nextSlots, update.nextConfidenceScore);
    if (nextIndex >= flowSteps.length) {
      setHistory((prev) => [...prev, { id: makeHistoryId(), type: "user_text", text: timingText }]);
      setStep("AI_ANALYSING");
      return;
    }
    setHistory((prev) => [
      ...prev,
      { id: makeHistoryId(), type: "user_text", text: timingText },
      { id: makeHistoryId(), type: "ai_message", text: flowSteps[nextIndex]?.message || "" },
    ]);
    setFlowIndex(nextIndex);
  };

  const onAnswerAndAdvance = (stepId: string, answerText: string) => {
    if (step !== "FLOW") return;
    const active = flowSteps[flowIndex] ?? null;
    if (!active || active.id !== stepId) return;

    markSessionActivity();

    const categoryKey = getServiceCategoryKey(selectedCategory);
    const nextAnswers = { ...flowAnswers, [stepId]: answerText };
    setFlowAnswers(nextAnswers);
    if (stepId === "issue") {
      setIssueText(answerText);
    }

    const update = scoreResponseUpdate({
      categoryKey,
      prevConfidenceScore: confidenceScore,
      prevSlots: infoSlots,
      prevAnswers: flowAnswers,
      step: active,
      answerText,
      source: active.inputMode === "upload" ? "image" : "structured",
      imageDeclined,
    });
    setConfidenceScore(update.nextConfidenceScore);
    setInfoSlots(update.nextSlots);

    if (categoryKey && update.nextSlots.description && hasSufficientConfidence(categoryKey, update.nextConfidenceScore)) {
      if (!earlyStopAcknowledged) {
        setEarlyStopAcknowledged(true);
        setHistory((prev) => [
          ...prev,
          { id: makeHistoryId(), type: "user_text", text: answerText },
          { id: makeHistoryId(), type: "ai_message", text: "Thanks — I have a clear picture of the issue now." },
        ]);
      } else {
        setHistory((prev) => [...prev, { id: makeHistoryId(), type: "user_text", text: answerText }]);
      }
      setStep("AI_ANALYSING");
      return;
    }

    const nextIndex = getNextFlowIndex(flowIndex, nextAnswers, update.nextSlots, update.nextConfidenceScore);
    setHistory((prev) => {
      const nextMsg = flowSteps[nextIndex]?.message;
      const base: HistoryItem[] = [
        ...prev,
        { id: makeHistoryId(), type: "user_text", text: answerText },
      ];
      if (nextMsg) {
        base.push({ id: makeHistoryId(), type: "ai_message", text: nextMsg });
      }
      return base;
    });

    if (nextIndex >= flowSteps.length) {
      setStep("AI_ANALYSING");
      return;
    }
    setFlowIndex(nextIndex);
  };

  const handleAskForImageUpload = () => {
    const activeFlowStep = step === "FLOW" ? flowSteps[flowIndex] ?? null : null;
    if (!activeFlowStep || activeFlowStep.inputMode !== "upload") return;
    fileInputRef.current?.click();
  };

  const handleSkipImage = () => {
    const activeFlowStep = step === "FLOW" ? flowSteps[flowIndex] ?? null : null;
    if (!activeFlowStep || activeFlowStep.inputMode !== "upload") return;

    markSessionActivity();
    setImageDeclined(true);
    setUploadedImageSrc(null);
    setUploadedImages([]);
    setHistory((prev) => [
      ...prev,
      { id: makeHistoryId(), type: "user_text", text: "I don't have any image." },
    ]);
    setFlowAnswers((prev) => ({ ...prev, [activeFlowStep.id]: "no_image" }));
    setStep("AI_ANALYSING");
  };

  const handleImageSelected = (file: File) => {
    const activeFlowStep = step === "FLOW" ? flowSteps[flowIndex] ?? null : null;
    if (!activeFlowStep || activeFlowStep.inputMode !== "upload") return;

    markSessionActivity();
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : null;
      setUploadedImageSrc(result);
      const parsed = result ? parseDataUrl(result) : null;
      setUploadedImages(parsed ? [parsed] : []);
      if (result) {
        setHistory((prev) => [...prev, { id: makeHistoryId(), type: "image", src: result }]);
      }
      setFlowAnswers((prev) => ({ ...prev, [activeFlowStep.id]: "image_uploaded" }));

      const categoryKey = getServiceCategoryKey(selectedCategory);
      const update = scoreResponseUpdate({
        categoryKey,
        prevConfidenceScore: confidenceScore,
        prevSlots: infoSlots,
        prevAnswers: flowAnswers,
        step: activeFlowStep,
        answerText: "image_uploaded",
        source: "image",
        imageDeclined: false,
      });
      setConfidenceScore(update.nextConfidenceScore);
      setInfoSlots(update.nextSlots);
      setImageDeclined(false);

      setStep("AI_ANALYSING");
    };
    reader.readAsDataURL(file);
  };

  useEffect(() => {
    if (currentView !== 'conversation') return;
    if (step !== "AI_ANALYSING") return;
    if (!selectedCategory) return;
    if (!flowSteps.length) return;

    const categoryKey = getServiceCategoryKey(selectedCategory);
    if (!categoryKey) return;

    const followups: Array<{ question: string; answer: string }> = [];
    for (const s of flowSteps) {
      if (s.id === "issue" || s.id === "estate" || s.id === "timing" || s.id === "urgency" || s.id === "image") {
        continue;
      }
      const answer = flowAnswers[s.id];
      if (answer && answer.trim()) {
        followups.push({ question: s.message, answer });
      }
    }

    const estateText = flowAnswers.estate
      ? flowAnswers.estate
      : isOutsideCityConnectEstate
        ? "Not in a CityConnect estate"
        : selectedEstateName || "Unknown";

    const built = buildUserDescriptionFromAnswers({
      issue: flowAnswers.issue || issueText,
      estate: estateText,
      timing: flowAnswers.timing || "",
      urgency: flowAnswers.urgency || "",
      followups,
    });

    if (!built.trim()) return;
    if (userDescription.trim() !== built.trim()) {
      setUserDescription(built);
    }

    let cancelled = false;
    setIsSending(true);
    setSendError(null);

    (async () => {
      try {
        const situation = classifyCityBuddySituation({
          categoryId: selectedCategory,
          description: built,
        });

        const memorySummary = buildMemorySummaryForGemini({
          category: selectedCategory,
          infoSlots,
          flowAnswers,
          isOutsideCityConnectEstate,
          selectedEstateName,
          hasImage: Boolean(uploadedImageSrc),
          confidenceScore,
        });

        const geminiHistory = buildGeminiHistory({
          items: history,
          currentUserMessage: built,
          priorAiResponse: aiResponse,
          memorySummary,
        });

        const response = await sendMessageToGemini({
          category: selectedCategory,
          estate: isOutsideCityConnectEstate
            ? "Not in a CityConnect estate"
            : selectedEstateName || "Unknown",
          history: geminiHistory,
          userMessage: built,
          images: uploadedImages.length ? uploadedImages : undefined,
          situation: {
            ...situation,
            distressed: isUserDistressed,
          },
        });

        if (cancelled) return;

        setAiResponse(response);
        setAiDecision((prev) => ({
          ...prev,
          requiresConsultancy: response.intent === "escalate",
        }));

        setStep("AI_GUIDANCE");
      } catch (error) {
        console.error("Failed to analyse issue:", error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        setSendError(errorMessage);
        setStep("AI_GUIDANCE");
      } finally {
        if (!cancelled) setIsSending(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    aiResponse,
    confidenceScore,
    currentView,
    flowAnswers,
    flowSteps,
    history,
    infoSlots,
    isOutsideCityConnectEstate,
    isUserDistressed,
    issueText,
    selectedCategory,
    selectedEstateName,
    step,
    uploadedImageSrc,
    uploadedImages,
    userDescription,
  ]);

  const [, navigate] = useLocation();

  const canBookProfessional = aiResponse?.intent === "escalate";
  const showProfessionalConsultancy =
    aiDecision.consultancyCompleted === true || aiDecision.requiresConsultancy === false;

  const handleBookProfessional = () => {
    if (!selectedCategory) return;
    setHasChosenAction(true);
    sessionStorage.setItem(
      INSPECTION_DRAFT_KEY,
      JSON.stringify({
        selectedCategory,
        description: userDescription,
        aiSummary: aiResponse?.message || null,
      }),
    );
    const qs = new URLSearchParams();
    if (activeConversationSessionId) qs.set("citybuddySessionId", activeConversationSessionId);
    const url = qs.toString()
      ? `/resident/book-a-service/inspection?${qs.toString()}`
      : "/resident/book-a-service/inspection";
    navigate(url);
  };

  const handleProfessionalConsultancy = () => {
    setHasChosenAction(true);
    // Navigational only; no auto-execution.
    navigate("/checkout-diagnosis");
  };

  const handleBuyOnCityMart = () => {
    setHasChosenAction(true);
    navigate("/resident/citymart");
  };

  const handleAskFollowUp = () => {
    setAiResponse({
      intent: "clarify",
      message: "Sure — ask me anything about this issue.",
      followUpQuestion: "What would you like to ask or clarify?",
    });
    setStep("AI_GUIDANCE");
  };

  const handlePrimaryBookingAction = useCallback(() => {
    if (!activeBookingCard) return;
    if (activeBookingCard.recommendedServiceType === "Consultancy") {
      handleProfessionalConsultancy();
      return;
    }
    if (activeBookingCard.recommendedServiceType === "Professional Provider") {
      setHasChosenAction(true);
      const selectedProviderId = conversationSessions.find((s) => s.id === activeConversationSessionId)?.selectedProviderId;
      if (selectedProviderId) {
        // Show confirmation modal instead of immediate navigation
        setPendingBookingProviderId(String(selectedProviderId));
        setShowBookingConfirm(true);
        return;
      }
      const qs = new URLSearchParams();
      if (activeConversationSessionId) qs.set("citybuddySessionId", activeConversationSessionId);
      const url = qs.toString() ? `/book-artisan?${qs.toString()}` : "/book-artisan";
      navigate(url);
      return;
    }
    handleBookProfessional();
  }, [activeBookingCard, activeConversationSessionId, conversationSessions, handleBookProfessional, handleProfessionalConsultancy, navigate]);

  const proceedToBookingConfirmed = useCallback(() => {
    const qs = new URLSearchParams();
    if (activeConversationSessionId) qs.set("citybuddySessionId", activeConversationSessionId);
    if (pendingBookingProviderId) qs.set("providerId", pendingBookingProviderId);
    if (pendingBookingProviderName) qs.set("providerName", String(pendingBookingProviderName));
    const url = qs.toString() ? `/book-artisan?${qs.toString()}` : "/book-artisan";
    setShowBookingConfirm(false);
    setPendingBookingProviderId(null);
    navigate(url);
  }, [activeConversationSessionId, navigate, pendingBookingProviderId, pendingBookingProviderName]);

  const cancelBookingConfirm = useCallback(() => {
    setShowBookingConfirm(false);
    setPendingBookingProviderId(null);
  }, []);

  // Consume cross-page booking events and append a ticket to the right conversation.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (currentView !== "conversation") return;

    const pending = safeReadBookingEvents();
    if (!pending.length) return;

    let changed = false;
    const remaining: CityBuddyBookingEvent[] = [];

    for (const evt of pending) {
      if (!evt?.serviceRequestId) {
        changed = true;
        continue;
      }

      const targetSessionId = evt.citybuddySessionId || activeConversationSessionId;
      if (!targetSessionId) {
        remaining.push(evt);
        continue;
      }

      const ticketItem: HistoryItem = {
        id: `ticket:${evt.serviceRequestId}`,
        type: "ticket",
        serviceRequestId: evt.serviceRequestId,
        title: evt.title ?? null,
        status: (evt.status ?? "pending").toLowerCase(),
        createdAtIso: evt.createdAtIso ?? null,
      };

      const applyToSession = (items: HistoryItem[]) => {
        const already = items.some(
          (m) => m.type === "ticket" && m.serviceRequestId === evt.serviceRequestId,
        );
        return already ? items : [...items, ticketItem];
      };

      if (targetSessionId === activeConversationSessionId) {
        setHistory((prev) => {
          const next = applyToSession(prev);
          if (next !== prev) changed = true;
          return next;
        });
      } else {
        setConversationSessions((prev) =>
          prev.map((s) =>
            s.id === targetSessionId
              ? {
                  ...s,
                  messages: applyToSession(s.messages),
                }
              : s,
          ),
        );
        changed = true;
      }
    }

    if (changed) {
      safeWriteBookingEvents(remaining);
    }
  }, [activeConversationSessionId, currentView]);

  const historyRef = useRef<HistoryItem[]>([]);
  useEffect(() => {
    historyRef.current = history;
  }, [history]);

  // Poll open tickets to keep progress up-to-date while the chat is open.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (currentView !== "conversation") return;

    const getOpenTicketIds = (items: HistoryItem[]) => {
      return items
        .filter((m): m is Extract<HistoryItem, { type: "ticket" }> => m.type === "ticket")
        .filter((t) => {
          const s = (t.status || "").toLowerCase();
          return s !== "completed" && s !== "cancelled";
        })
        .map((t) => t.serviceRequestId)
        .filter(Boolean);
    };

    let cancelled = false;

    // SSE (EventSource) for real-time updates
    let es: EventSource | null = null;
    try {
      es = new EventSource('/api/service-requests/stream', { withCredentials: true });
      es.addEventListener('service-request', (ev: MessageEvent) => {
        try {
          const payload = JSON.parse(ev.data || '{}');
          const req = payload?.request ?? payload?.data ?? null;
          if (!req || !req.id) return;
          const id = String(req.id);
          const nextStatus = String(req.status ?? '').toLowerCase();
          const nextTitle = req.title ?? null;
          const nextCreatedAtIso = req.createdAt ? String(req.createdAt) : null;

          let changed = false;

          setHistory((prev) =>
            prev.map((m) => {
              if (m.type !== 'ticket') return m;
              if (m.serviceRequestId !== id) return m;
              if (m.status === nextStatus && m.title === nextTitle && m.createdAtIso === nextCreatedAtIso) return m;
              changed = true;
              return { ...m, status: nextStatus, title: nextTitle, createdAtIso: nextCreatedAtIso };
            }),
          );

          if (!changed) {
            // Also update sessions elsewhere
            setConversationSessions((prev) =>
              prev.map((s) => {
                let updated = false;
                const messages = s.messages.map((m) => {
                  if (m.type !== 'ticket') return m;
                  if (m.serviceRequestId !== id) return m;
                  if (m.status === nextStatus && m.title === nextTitle && m.createdAtIso === nextCreatedAtIso) return m;
                  updated = true;
                  return { ...m, status: nextStatus, title: nextTitle, createdAtIso: nextCreatedAtIso };
                });
                return updated ? { ...s, messages } : s;
              }),
            );
          }

          // Show a brief toast for status changes
          if (nextTitle) {
            try {
              toast({
                title: "Request updated",
                description: `${nextTitle} — ${formatTicketStatusLabel(nextStatus)}`,
              });
            } catch (e) {
              // ignore
            }
          }
        } catch (e) {
          // ignore invalid events
        }
      });
    } catch (e) {
      // EventSource not available or failed — fallback to polling only
    }

    const tick = async () => {
      const ids = getOpenTicketIds(historyRef.current);
      if (!ids.length) return;

      const updates = await Promise.all(
        ids.map(async (id) => {
          try {
            const tryFetch = async (path: string) => {
              const res = await apiRequest("GET", path);
              return (await res.json().catch(() => null)) as any;
            };

            let data: any = null;
            try {
              data = await tryFetch(`/api/service-requests/${encodeURIComponent(id)}`);
            } catch {
              data = await tryFetch(`/api/app/service-requests/${encodeURIComponent(id)}`);
            }

            const nextStatus = String(data?.status ?? "").toLowerCase();
            const nextTitle = data?.title ?? null;
            const createdAtIso = data?.createdAt ? String(data.createdAt) : null;
            return { id, nextStatus, nextTitle, createdAtIso };
          } catch {
            return null;
          }
        }),
      );

      if (cancelled) return;

      const filtered = updates.filter(Boolean) as Array<{
        id: string;
        nextStatus: string;
        nextTitle: string | null;
        createdAtIso: string | null;
      }>;
      if (!filtered.length) return;

      setHistory((prev) =>
        prev.map((m) => {
          if (m.type !== "ticket") return m;
          const u = filtered.find((x) => x.id === m.serviceRequestId);
          if (!u) return m;
          const nextStatus = u.nextStatus || m.status;
          const nextTitle = u.nextTitle ?? m.title;
          const nextCreatedAtIso = u.createdAtIso ?? m.createdAtIso ?? null;
          if (nextStatus === m.status && nextTitle === m.title && nextCreatedAtIso === m.createdAtIso) return m;
          return {
            ...m,
            status: nextStatus,
            title: nextTitle,
            createdAtIso: nextCreatedAtIso,
          };
        }),
      );
    };

    const interval = window.setInterval(() => {
      void tick();
    }, 20_000);

    // run once quickly
    void tick();

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      try {
        if (es) es.close();
      } catch (e) {
        // ignore
      }
    };
  }, [currentView, toast]);

  const handleSecondaryBookingAction = useCallback(() => {
    handleAskFollowUp();
  }, [handleAskFollowUp]);

  const handleRemoveBookingImage = useCallback(
    (src: string) => {
      if (!activeConversationSessionId) return;
      markSessionActivity();
      setConversationSessions((prev) =>
        prev.map((s) => {
          if (s.id !== activeConversationSessionId) return s;
          if (!s.bookingCard || !Array.isArray(s.bookingCard.imagePreview)) return s;
          const nextPreview = s.bookingCard.imagePreview.filter((p) => p !== src);
          return {
            ...s,
            bookingCard: {
              ...s.bookingCard,
              imagePreview: nextPreview,
            },
          };
        }),
      );
    },
    [activeConversationSessionId, markSessionActivity],
  );

  const handleNavigateToHomepage = () => {
    if (onBack) {
      onBack();
      return;
    }
    navigate("/resident");
  };

  const handleNavigateToMarketplace = () => {
    navigate("/resident/citymart");
  };

  const handleNavigateToSettings = () => {
    navigate("/resident/settings");
  };

  if (currentView === 'conversation') {
    return (
      <div
        className="flex h-screen overflow-hidden bg-[#054f31]"
        data-name="chat interface"
      >
        <MobileNavDrawer
          onBookServiceClick={() => setCurrentView('conversation')}
          onNavigateToHomepage={handleNavigateToHomepage}
          onNavigateToSettings={handleNavigateToSettings}
          onNavigateToMarketplace={handleNavigateToMarketplace}
          onNavigateToServiceRequests={() => navigate("/service-requests")}
          currentPage="chat"
        />

        {/* Primary sidebar (desktop only) */}
        <div className="hidden lg:block h-full">
          <Nav
            onBookServiceClick={() => setCurrentView('conversation')}
            onNavigateToHomepage={handleNavigateToHomepage}
            onNavigateToSettings={handleNavigateToSettings}
            onNavigateToMarketplace={handleNavigateToMarketplace}
            onNavigateToServiceRequests={() => navigate("/service-requests")}
            currentPage="chat"
          />
        </div>

        {/* Secondary context sidebar (fixed width, never collapses) */}
        <div className="hidden lg:block w-[320px] flex-shrink-0 h-full">
          <SubNav
            onNavigateToAppointment={() => setCurrentView('conversation')}
            isActive={true}
            onBackClick={handleBackToSelectCategory}
            currentView={currentView}
            sessions={conversationSessions}
            activeSessionId={activeConversationSessionId}
            onCreateNewRequest={handleCreateNewRequest}
            onSelectSession={handleSelectConversationSession}
            onDeleteSession={handleDeleteConversationSession}
            onClearAllSessions={handleClearAllConversations}
          />
        </div>

        {/* Main content */}
        <div className="flex-1 min-w-0 h-full">
          <MainWrapChat
            step={step}
            activeFlowStep={flowSteps[flowIndex] ?? null}
            history={history}
            isHistoryLoading={isHistoryLoading}
            inputValue={inputValue}
            onInputChange={setInputValue}
            onSend={handleSend}
            flowAnswers={flowAnswers}
            onSetFlowAnswer={(stepId, value) => setFlowAnswers((prev) => ({ ...prev, [stepId]: value }))}
            onAnswerAndAdvance={onAnswerAndAdvance}
            myEstates={myEstates}
            selectedEstateName={selectedEstateName}
            isOutsideCityConnectEstate={isOutsideCityConnectEstate}
            useManualEstate={useManualEstate}
            onToggleManualEstate={onToggleManualEstate}
            onSelectEstate={onSelectEstate}
            startDate={startDate}
            startTime={startTime}
            startQuickTag={startQuickTag}
            onStartDateChange={onStartDateChange}
            onStartTimeChange={onStartTimeChange}
            onSelectStartQuickTag={onSelectStartQuickTag}
            onContinueTiming={onContinueTiming}
            selectedCategory={selectedCategory}
            onChangeCategory={handleChangeCategoryInConversation}
            onDeleteConversation={
              activeConversationSessionId
                ? () => handleDeleteConversationSession(activeConversationSessionId)
                : undefined
            }
            onAskForImageUpload={handleAskForImageUpload}
            onSkipImage={handleSkipImage}
            onImageSelected={handleImageSelected}
            fileInputRef={fileInputRef}
            aiResponse={aiResponse}
            canBookProfessional={canBookProfessional}
            onBookProfessional={handleBookProfessional}
            showProfessionalConsultancy={showProfessionalConsultancy}
            onProfessionalConsultancy={handleProfessionalConsultancy}
            onBuyOnCityMart={handleBuyOnCityMart}
            onAskFollowUp={handleAskFollowUp}
            conversationSummary={activeConversationSummary}
            bookingCard={activeBookingCard}
            priceEstimationCard={activePriceEstimationCard}
            providerMatchingPreview={activeProviderMatchingPreview}
            onPrimaryBookingAction={activeBookingCard ? handlePrimaryBookingAction : undefined}
            onSecondaryBookingAction={activeBookingCard ? handleSecondaryBookingAction : undefined}
            onViewServiceRequest={(id) => navigate(`/service-requests?id=${encodeURIComponent(id)}`)}
            onViewMoreProviders={() => {
              const qs = new URLSearchParams();
              if (activeConversationSessionId) qs.set("citybuddySessionId", activeConversationSessionId);
              const url = qs.toString() ? `/book-artisan?${qs.toString()}` : "/book-artisan";
              navigate(url);
            }}
            onOpenProviderComparison={openProviderComparison}
            onAdjustDetails={() => {
              setHasChosenAction(false);
              setStep("FLOW");
            }}
            onRemoveBookingImage={activeBookingCard ? handleRemoveBookingImage : undefined}
            selectedProviderId={conversationSessions.find((s) => s.id === activeConversationSessionId)?.selectedProviderId ?? null}
            onViewSelectedProvider={(id?: string) => {
              if (id) {
                const p = comparisonProviders.find((x) => x.id === id) || activeProviderMatchingPreview?.providers?.find((pp: any) => String(pp.id) === id);
                viewSelectedProvider(id, p?.name ?? undefined);
              }
            }}
          />
          {/* Booking confirmation modal: show when a provider is selected for this conversation */}
          <AlertDialog open={showBookingConfirm} onOpenChange={(open) => { if (!open) cancelBookingConfirm(); setShowBookingConfirm(open); }}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Pre-select provider</AlertDialogTitle>
                <AlertDialogDescription>
                  We'll pre-select <strong>{pendingBookingProviderName ?? "the selected provider"}</strong> on the booking page. This will not automatically book — you'll still confirm the booking on the next page.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel onClick={cancelBookingConfirm}>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={proceedToBookingConfirmed}>Proceed to booking</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          {showComparison && comparisonProviders && comparisonProviders.length > 0 ? (
            <div className="fixed inset-0 z-50 flex items-end lg:items-center justify-center p-4 pointer-events-none">
              <div className="w-full lg:w-11/12 xl:w-10/12 pointer-events-auto">
                <ProviderComparison
                  providers={comparisonProviders}
                  selectedProviderId={conversationSessions.find((s) => s.id === activeConversationSessionId)?.selectedProviderId ?? null}
                  onSelect={(id) => {
                    // store selection and offer a toast with 'View provider' action
                    handleSelectProviderFromComparison(id);
                    try {
                      const provider = comparisonProviders.find((p) => p.id === id);
                      toast({
                        title: "Provider selected",
                        description: provider ? provider.name : "Provider selected",
                        action: (
                          <button
                            onClick={() => viewSelectedProvider(id, provider?.name)}
                            className="underline text-xs text-white bg-transparent"
                          >
                            View provider
                          </button>
                        ),
                      });
                    } catch (e) {
                      // ignore toast errors
                    }
                  }}
                  onClose={() => closeProviderComparison()}
                />
              </div>
            </div>
          ) : null}
          {sendError && (
            <div className="px-[32px] pb-[24px]">
              <p className="text-[14px] text-[#D92D20] whitespace-pre-wrap">
                {sendError}
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex h-screen overflow-hidden bg-[#054f31]"
      data-name="Select Category"
    >
      <MobileNavDrawer
        onBookServiceClick={() => setCurrentView('conversation')}
        onNavigateToHomepage={handleNavigateToHomepage}
        onNavigateToSettings={handleNavigateToSettings}
        onNavigateToMarketplace={handleNavigateToMarketplace}
        onNavigateToServiceRequests={() => navigate("/service-requests")}
        currentPage="chat"
      />

      {/* Primary sidebar (desktop only) */}
      <div className="hidden lg:block h-full">
        <Nav
          onBookServiceClick={() => setCurrentView('conversation')}
          onNavigateToHomepage={handleNavigateToHomepage}
          onNavigateToSettings={handleNavigateToSettings}
          onNavigateToMarketplace={handleNavigateToMarketplace}
          onNavigateToServiceRequests={() => navigate("/service-requests")}
          currentPage="chat"
        />
      </div>

      {/* Secondary context sidebar (fixed width, never collapses) */}
      <div className="hidden lg:block w-[320px] flex-shrink-0 h-full">
        <SubNav
          onNavigateToAppointment={() => setCurrentView('conversation')}
          isActive={false}
          onBackClick={onBack || handleBackToSelectCategory}
          currentView={currentView}
          sessions={conversationSessions}
          activeSessionId={activeConversationSessionId}
          onCreateNewRequest={handleCreateNewRequest}
          onSelectSession={handleSelectConversationSession}
          onDeleteSession={handleDeleteConversationSession}
          onClearAllSessions={handleClearAllConversations}
        />
      </div>

      {/* Main content */}
      <div className="flex-1 min-w-0 h-full">
        <MainWrapSelectCategory
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            onCategorySelect={handleCategorySelect}
            categoriesData={displayCategories}
            catsLoading={categoriesLoading}
            myEstates={myEstates}
            selectedEstateName={selectedEstateName}
            setSelectedEstateName={setSelectedEstateName}
            isOutsideCityConnectEstate={isOutsideCityConnectEstate}
            setIsOutsideCityConnectEstate={setIsOutsideCityConnectEstate}
          />
      </div>
    </div>
  );
}
