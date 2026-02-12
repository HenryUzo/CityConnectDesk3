import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import { UploadItem } from "@/components/ui/icon";
import Nav from "@/components/layout/Nav";
import MobileNavDrawer from "@/components/layout/MobileNavDrawer";
import { useMyEstates } from "@/hooks/useMyEstates";
import useCategories from "@/hooks/useCategories";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AIMessage, UserResponse } from "@/components/resident/CityBuddyMessage";
import { cn } from "@/lib/utils";

type FlowStage = "intake" | "wizard" | "summary";

type WizardStep =
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

const URGENCY_OPTIONS = [
  { value: "emergency", label: "Emergency", tone: "border-rose-200 text-rose-700 bg-rose-50" },
  { value: "high", label: "High", tone: "border-amber-200 text-amber-700 bg-amber-50" },
  { value: "medium", label: "Medium", tone: "border-slate-200 text-slate-700 bg-slate-50" },
  { value: "low", label: "Low", tone: "border-emerald-200 text-emerald-700 bg-emerald-50" },
];

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

function StepHeader({
  step,
  title,
  subtitle,
  isActive,
}: {
  step: number;
  title: string;
  subtitle?: string;
  isActive?: boolean;
}) {
  return (
    <div className="flex items-center gap-3">
      <div
        className={cn(
          "flex h-8 w-8 items-center justify-center rounded-full border text-sm font-semibold",
          isActive ? "border-[#039855] text-[#039855] bg-[#ECFDF3]" : "border-[#d0d5dd] text-[#667085]",
        )}
      >
        {step}
      </div>
      <div>
        <p className="text-[14px] font-semibold text-[#101828]">{title}</p>
        {subtitle ? (
          <p className="text-[12px] text-[#667085]">{subtitle}</p>
        ) : null}
      </div>
    </div>
  );
}

export default function OrdinaryConversationFlow() {
  const [, navigate] = useLocation();
  const { data: estates } = useMyEstates();
  const { categories } = useCategories({ scope: "global" });
  const CONSULTANCY_DRAFT_KEY = "citybuddy_consultancy_draft";

  const categoryFromSearch = (() => {
    if (typeof window === "undefined") return "";
    const params = new URLSearchParams(window.location.search);
    return params.get("category") || "";
  })();

  const [stage, setStage] = useState<FlowStage>("intake");
  const [focusedIntake, setFocusedIntake] = useState<"location" | "category" | "urgency" | null>(null);

  const [estateName, setEstateName] = useState("");
  const [address, setAddress] = useState("");
  const [unit, setUnit] = useState("");
  const [selectedCategoryValue, setSelectedCategoryValue] = useState(categoryFromSearch);
  const [urgency, setUrgency] = useState("");

  const [wizardIndex, setWizardIndex] = useState(0);
  const [wizardAnswers, setWizardAnswers] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState("");
  const [attachments, setAttachments] = useState<Array<{ id: string; name: string; dataUrl: string }>>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

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

    const fallback = categories[0];
    if (fallback) {
      setSelectedCategoryValue(String(fallback.id ?? fallback.key ?? fallback.name ?? ""));
    }
  }, [categories, selectedCategoryValue, categoryFromSearch]);

  useEffect(() => {
    setWizardIndex(0);
    setWizardAnswers({});
    setNotes("");
    setAttachments([]);
  }, [selectedCategoryValue]);

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

  const categoryProfile = useMemo(
    () => buildCategoryProfile(selectedCategoryLabel || "General"),
    [selectedCategoryLabel],
  );

  const wizardSteps = useMemo<WizardStep[]>(() => {
    const followUps: WizardStep[] = categoryProfile.followUps.map((f) => ({
      id: f.id,
      kind: "chips",
      prompt: f.prompt,
      options: f.options,
    }));
    return [
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
    const base = estateName || address || "Not provided";
    if (!unit.trim()) return base;
    return `${base} - Unit ${unit.trim()}`;
  };

  const canContinueIntake =
    Boolean((estateName || address).trim()) &&
    Boolean(selectedCategoryLabel.trim()) &&
    Boolean(urgency.trim());

  const currentStep = wizardSteps[wizardIndex];

  const historyBlocks = wizardSteps
    .filter((step) => {
      if (step.kind === "photos") return attachments.length > 0 || wizardAnswers[step.id];
      if (step.kind === "text") return Boolean(notes.trim());
      return Boolean(wizardAnswers[step.id]);
    })
    .map((step) => {
      let answer = wizardAnswers[step.id] || "";
      if (step.kind === "photos") {
        answer = attachments.length ? `${attachments.length} photo(s) added` : "Skipped";
      }
      if (step.kind === "text") {
        answer = notes.trim();
      }
      return { prompt: step.prompt, answer };
    });

  const goToSummary = () => setStage("summary");

  const handleSelectChip = (stepId: string, value: string) => {
    setWizardAnswers((prev) => ({ ...prev, [stepId]: value }));
    const nextIndex = Math.min(wizardIndex + 1, wizardSteps.length - 1);
    setWizardIndex(nextIndex);
  };

  const handleUploadClick = () => fileInputRef.current?.click();

  const handleAddAttachment = (file: File) => {
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
    setAttachments((prev) => prev.filter((att) => att.id !== id));
  };

  const handleFinishNotes = () => {
    if (!notes.trim()) {
      setNotes("");
    }
    goToSummary();
  };

  const jumpToIntake = (focus: "location" | "category" | "urgency") => {
    setStage("intake");
    setFocusedIntake(focus);
  };

  const jumpToWizard = (stepId: string) => {
    const idx = wizardSteps.findIndex((s) => s.id === stepId);
    if (idx >= 0) {
      setStage("wizard");
      setWizardIndex(idx);
    }
  };

  const summaryItems = [
    {
      label: "Category",
      value: selectedCategoryLabel || "Not selected",
      onEdit: () => jumpToIntake("category"),
    },
    {
      label: "Location",
      value: intakeLocationLabel(),
      onEdit: () => jumpToIntake("location"),
    },
    {
      label: "Urgency",
      value: urgency || "Not set",
      onEdit: () => jumpToIntake("urgency"),
    },
    {
      label: "Problem type",
      value: wizardAnswers.issue_type || "Not set",
      onEdit: () => jumpToWizard("issue_type"),
    },
    {
      label: "Quantity",
      value: wizardAnswers.quantity || "Not set",
      onEdit: () => jumpToWizard("quantity"),
    },
    {
      label: "Time window",
      value: wizardAnswers.time_window || "Not set",
      onEdit: () => jumpToWizard("time_window"),
    },
    {
      label: "Attachments",
      value: `${attachments.length} photo(s)`,
      onEdit: () => jumpToWizard("photos"),
    },
  ];

  const photoGuard =
    categoryProfile.photoRequired && attachments.length === 0
      ? "This category needs at least one photo before continuing."
      : "";

  const handleBookConsultancy = () => {
    const selectedCategory = categories.find((cat: any) => {
      const id = String(cat?.id ?? "");
      const key = String(cat?.key ?? "");
      const name = String(cat?.name ?? "");
      return selectedCategoryValue === id || selectedCategoryValue === key || selectedCategoryValue === name;
    });

    const descriptionParts = [
      wizardAnswers.issue_type ? `Issue: ${wizardAnswers.issue_type}` : null,
      ...categoryProfile.followUps.map((f) =>
        wizardAnswers[f.id] ? `${f.prompt} ${wizardAnswers[f.id]}` : null,
      ),
      wizardAnswers.quantity ? `Quantity: ${wizardAnswers.quantity}` : null,
      wizardAnswers.time_window ? `Time window: ${wizardAnswers.time_window}` : null,
      notes.trim() ? `Notes: ${notes.trim()}` : null,
    ].filter(Boolean);

    const draft = {
      categoryKey: String(selectedCategory?.key ?? selectedCategory?.id ?? selectedCategoryLabel ?? "maintenance_repair"),
      categoryLabel: selectedCategoryLabel || String(selectedCategory?.name ?? ""),
      urgency,
      location: intakeLocationLabel(),
      description: descriptionParts.join("\n"),
      attachmentsCount: attachments.length,
    };

    try {
      sessionStorage.setItem(CONSULTANCY_DRAFT_KEY, JSON.stringify(draft));
    } catch {
      // ignore storage errors
    }

    navigate("/checkout-diagnosis");
  };

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

      <div className="flex-1 min-w-0 h-full bg-white rounded-bl-[40px] rounded-tl-[40px] lg:ml-[14px] lg:mt-[12px] overflow-y-auto">
        <div className="max-w-5xl mx-auto p-[32px] space-y-[20px]">
          <div>
            <p className="text-[20px] font-semibold text-[#101828]">Smart Intake (Ordinary Mode)</p>
            <p className="text-[14px] text-[#667085]">
              Location and urgency are captured first to reduce pricing errors. Then we guide you with quick chips.
            </p>
          </div>

          {stage === "intake" ? (
            <Card className="rounded-3xl border border-[#EAECF0] shadow-sm">
              <CardHeader>
                <CardTitle className="text-[18px]">3-step intake</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className={cn("rounded-2xl border p-4", focusedIntake === "location" ? "border-[#039855]" : "border-[#EAECF0]")}>
                  <StepHeader
                    step={1}
                    title="Where?"
                    subtitle="Estate or address, plus unit"
                    isActive={focusedIntake === "location"}
                  />
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <div>
                      <p className="text-[12px] text-[#667085] mb-2">Estate (if applicable)</p>
                      <Select
                        value={estateName || ""}
                        onValueChange={(value) => {
                          setEstateName(value);
                        }}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select estate" />
                        </SelectTrigger>
                        <SelectContent>
                          {estates.map((estate) => (
                            <SelectItem key={estate.id} value={estate.name}>
                              {estate.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <p className="text-[12px] text-[#667085] mb-2">Address</p>
                      <input
                        value={address}
                        onChange={(e) => {
                          setAddress(e.target.value);
                        }}
                        placeholder="Street, area, landmark"
                        className="w-full rounded-md border border-[#D0D5DD] px-3 py-2 text-sm"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <p className="text-[12px] text-[#667085] mb-2">Unit / Apartment number</p>
                      <input
                        value={unit}
                        onChange={(e) => setUnit(e.target.value)}
                        placeholder="e.g. Flat 12B"
                        className="w-full rounded-md border border-[#D0D5DD] px-3 py-2 text-sm"
                      />
                    </div>
                  </div>
                </div>

                <div className={cn("rounded-2xl border p-4", focusedIntake === "category" ? "border-[#039855]" : "border-[#EAECF0]")}>
                  <StepHeader
                    step={2}
                    title="What category?"
                    subtitle="Already chosen, but you can change it"
                    isActive={focusedIntake === "category"}
                  />
                  <div className="mt-4 flex flex-wrap gap-3 items-center">
                    <Select value={selectedCategoryValue} onValueChange={setSelectedCategoryValue}>
                      <SelectTrigger className="w-[280px]">
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map((cat: any) => (
                          <SelectItem key={cat.id || cat.key || cat.name} value={String(cat.id ?? cat.key ?? cat.name ?? "")}>
                            {cat.name || cat.key || cat.id}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {selectedCategoryLabel ? (
                      <Badge className="rounded-full bg-[#ECFDF3] text-[#039855] border border-[#D1FADF]">
                        Selected: {selectedCategoryLabel}
                      </Badge>
                    ) : null}
                  </div>
                </div>

                <div className={cn("rounded-2xl border p-4", focusedIntake === "urgency" ? "border-[#039855]" : "border-[#EAECF0]")}>
                  <StepHeader
                    step={3}
                    title="Urgency?"
                    subtitle="Quick pick"
                    isActive={focusedIntake === "urgency"}
                  />
                  <div className="mt-4 flex flex-wrap gap-3">
                    {URGENCY_OPTIONS.map((opt) => (
                      <ChipButton
                        key={opt.value}
                        label={opt.label}
                        selected={urgency === opt.label}
                        className={urgency === opt.label ? "" : opt.tone}
                        selectedClassName={opt.value === "emergency" ? "border-rose-600 bg-rose-600 text-white" : undefined}
                        onClick={() => setUrgency(opt.label)}
                      />
                    ))}
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button
                    onClick={() => {
                      if (!canContinueIntake) {
                        setFocusedIntake(!estateName && !address ? "location" : !selectedCategoryLabel ? "category" : "urgency");
                        return;
                      }
                      setFocusedIntake(null);
                      setStage("wizard");
                    }}
                    className="rounded-full"
                  >
                    Continue to chat wizard
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : null}

          {stage === "wizard" ? (
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
              <Card className="rounded-3xl border border-[#EAECF0] shadow-sm">
                <CardHeader>
                  <CardTitle className="text-[18px]">Chat wizard</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between rounded-2xl border border-[#EAECF0] bg-[#f9fafb] px-4 py-3">
                    <div>
                      <p className="text-[12px] uppercase tracking-[0.08em] text-[#98A2B3]">Step</p>
                      <p className="text-[16px] font-semibold text-[#101828]">
                        {wizardIndex + 1} of {wizardSteps.length}
                      </p>
                    </div>
                      <Badge className="rounded-full bg-[#ECFDF3] text-[#039855] border border-[#D1FADF]">
                        {selectedCategoryLabel || "General"}
                      </Badge>
                  </div>

                  <div className="space-y-4">
                    {historyBlocks.map((block, idx) => (
                      <div key={`${idx}-${block.prompt}`} className="space-y-2">
                        <AIMessage text={block.prompt} />
                        <UserResponse text={block.answer} />
                      </div>
                    ))}

                    {currentStep ? (
                      <div className="space-y-4">
                        <AIMessage text={currentStep.prompt} />
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
                            <div className="flex justify-end">
                              <Button
                                onClick={() => {
                                  if (currentStep.required && attachments.length === 0) return;
                                  setWizardIndex((prev) => Math.min(prev + 1, wizardSteps.length - 1));
                                }}
                                className="rounded-full"
                              >
                                {currentStep.required || attachments.length ? "Continue" : "Skip for now"}
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
                            <div className="flex justify-end">
                              <Button onClick={handleFinishNotes} className="rounded-full">
                                Review job summary
                              </Button>
                            </div>
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </CardContent>
              </Card>

              <div className="space-y-4">
                <Card className="rounded-3xl border border-[#EAECF0] shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-[16px]">Session snapshot</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="rounded-2xl border border-[#EAECF0] p-3">
                      <p className="text-[12px] text-[#667085]">Location</p>
                      <p className="text-[14px] font-semibold text-[#101828]">{intakeLocationLabel()}</p>
                    </div>
                    <div className="rounded-2xl border border-[#EAECF0] p-3">
                      <p className="text-[12px] text-[#667085]">Urgency</p>
                      <p className="text-[14px] font-semibold text-[#101828]">{urgency || "Not set"}</p>
                    </div>
                    <div className="rounded-2xl border border-[#EAECF0] p-3">
                      <p className="text-[12px] text-[#667085]">Selected issue</p>
                      <p className="text-[14px] font-semibold text-[#101828]">
                        {wizardAnswers.issue_type || "Pending"}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-[#EAECF0] p-3">
                      <p className="text-[12px] text-[#667085]">Photos</p>
                      <p className="text-[14px] font-semibold text-[#101828]">{attachments.length} attached</p>
                    </div>
                    <Button
                      variant="outline"
                      className="w-full rounded-full"
                      onClick={() => setStage("summary")}
                    >
                      Go to job summary
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </div>
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
                    Placeholder card until backend matching is wired.
                  </p>
                </div>
                <div className="px-4 py-3 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[14px] font-semibold text-[#101828]">PrimeFix Electricals</p>
                      <p className="text-[12px] text-[#667085]">★★★★☆ · 4.6</p>
                      <p className="text-[12px] text-[#667085] mt-1">Coverage: {intakeLocationLabel()}</p>
                    </div>
                    <span className="inline-flex items-center gap-[6px] text-[12px] text-[#475467] bg-[#f9fafb] border border-[#EAECF0] rounded-[999px] px-[10px] py-[4px]">
                      Verified
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-[12px] text-[#667085]">Completed jobs</p>
                      <p className="text-[12px] text-[#101828] font-semibold">320+</p>
                    </div>
                    <div>
                      <p className="text-[12px] text-[#667085]">Response time</p>
                      <p className="text-[12px] text-[#101828] font-semibold">Within 2 hours</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {["Fast response", "Licensed", "Tools included"].map((badge) => (
                      <span
                        key={badge}
                        className="text-[12px] text-[#475467] bg-[#f9fafb] border border-[#EAECF0] rounded-[999px] px-[10px] py-[4px]"
                      >
                        {badge}
                      </span>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button className="rounded-full" onClick={handleBookConsultancy}>
                      Book for consultancy · NGN 6,500
                    </Button>
                    <Button variant="outline" onClick={() => setStage("wizard")}>
                      Change details
                    </Button>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <Button variant="outline" onClick={() => setStage("wizard")}>
                  Back to wizard
                </Button>
                <Button className="rounded-full" onClick={handleBookConsultancy}>
                  Book for consultancy
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
