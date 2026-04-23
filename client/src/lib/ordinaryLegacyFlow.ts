export type RequestQuestionLike = {
  id?: string;
  mode?: "ai" | "ordinary";
  scope?: "global" | "category";
  categoryKey?: string | null;
  key?: string;
  label?: string;
  type?:
    | "text"
    | "textarea"
    | "select"
    | "date"
    | "datetime"
    | "estate"
    | "urgency"
    | "image"
    | "multi_image";
  required?: boolean;
  options?: any;
  order?: number;
  isEnabled?: boolean;
};

export type CategoryProfile = {
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

export type LegacyQuestionBlueprint = {
  key: string;
  label: string;
  type: RequestQuestionLike["type"];
  required: boolean;
  options?: string[];
  order: number;
  kind: "location" | "chips" | "photos" | "text";
  helperText?: string;
  placeholder?: string;
  conditionalValue?: string;
};

export type EditableLegacyQuestion = LegacyQuestionBlueprint & {
  persistedId: string | null;
  inheritedId: string | null;
  isEnabled: boolean;
  source: "category" | "global" | "default";
};

export const DEFAULT_QUANTITY_OPTIONS = ["1", "2-3", "4-6", "7+"];
export const DEFAULT_TIME_WINDOWS = ["Today", "Within 3 days", "This week", "Flexible"];
export const URGENCY_LABELS = ["Emergency", "High", "Medium", "Low"];

const LEGACY_BLUEPRINT_KEY_ALIASES: Record<string, string[]> = {
  location: ["estate"],
  photos: ["images"],
};

const SUPPRESSED_EXTRA_QUESTION_KEYS = new Set(["inspectiondate"]);
const CANONICAL_BLUEPRINT_LABEL_KEYS = new Set([
  "location",
  "urgency",
  "issue_type",
  "quantity",
  "time_window",
  "photos",
  "notes",
]);

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

function normalizeKey(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function normalizeCategoryKey(value: string) {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function buildCategoryProfile(categoryIdentity: string): CategoryProfile {
  const key = normalizeKey(categoryIdentity);
  const matches = (token: string) => key.includes(token);

  const photoRequired = REQUIRED_PHOTO_KEYWORDS.some(matches);
  const photoRecommended = photoRequired || RECOMMENDED_PHOTO_KEYWORDS.some(matches);

  if (matches("electrical") || matches("electric")) {
    return {
      issueChips: ["No power", "Flickering", "Breaker trips", "Burning smell", "Sparks"],
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
      issueChips: ["Leak", "Blocked drain", "Low pressure", "Burst pipe", "No water", "Other"],
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

  if (matches("hvac") || matches("cooling") || matches("heating")) {
    return {
      issueChips: ["No cooling", "Water leak", "Strange noise", "Service", "Installation"],
      followUps: [
        {
          id: "hvac_unit_count",
          prompt: "How many units are involved?",
          options: ["1 unit", "2-3 units", "4+ units"],
        },
      ],
      quantityPrompt: "How many rooms or spaces are affected?",
      quantityOptions: DEFAULT_QUANTITY_OPTIONS,
      timeWindowPrompt: "Preferred visit time?",
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

export function buildLegacyQuestionBlueprints(params: {
  categoryKey: string;
  categoryName: string;
}): LegacyQuestionBlueprint[] {
  const normalizedCategoryKey = normalizeCategoryKey(params.categoryKey || params.categoryName);
  const categoryProfile = buildCategoryProfile(`${params.categoryKey} ${params.categoryName}`);
  const blueprints: LegacyQuestionBlueprint[] = [
    {
      key: "location",
      label: "Do you live in an estate registered with CityConnect?",
      type: "estate",
      required: true,
      order: 1,
      kind: "location",
    },
    {
      key: "urgency",
      label: "How urgent is this?",
      type: "urgency",
      required: true,
      options: URGENCY_LABELS,
      order: 2,
      kind: "chips",
    },
    {
      key: "issue_type",
      label: "Pick the closest issue type.",
      type: "select",
      required: true,
      options: categoryProfile.issueChips,
      order: 3,
      kind: "chips",
    },
  ];

  if (normalizedCategoryKey === "plumber") {
    blueprints.push({
      key: "issue_other_details",
      label: "Please describe the plumbing issue not listed above.",
      type: "textarea",
      required: false,
      order: 4,
      kind: "text",
      placeholder: "Type the exact plumbing issue.",
      conditionalValue: "other",
    });
  }

  categoryProfile.followUps.forEach((followUp, index) => {
    blueprints.push({
      key: followUp.id,
      label: followUp.prompt,
      type: "select",
      required: true,
      options: followUp.options,
      order: blueprints.length + index + 1,
      kind: "chips",
    });
  });

  blueprints.push(
    {
      key: "quantity",
      label: categoryProfile.quantityPrompt,
      type: "select",
      required: true,
      options: categoryProfile.quantityOptions,
      order: blueprints.length + 1,
      kind: "chips",
    },
    {
      key: "time_window",
      label: categoryProfile.timeWindowPrompt,
      type: "select",
      required: true,
      options: categoryProfile.timeWindowOptions,
      order: blueprints.length + 2,
      kind: "chips",
    },
    {
      key: "photos",
      label: categoryProfile.photoRequired
        ? "Please upload at least one photo."
        : "Upload a photo if available.",
      type: "multi_image",
      required: categoryProfile.photoRequired,
      order: blueprints.length + 3,
      kind: "photos",
      helperText: categoryProfile.photoHelper,
    },
    {
      key: "notes",
      label: "Any additional information you want to share?",
      type: "textarea",
      required: false,
      order: blueprints.length + 4,
      kind: "text",
      placeholder: "Add any extra details here.",
    },
  );

  return blueprints.map((blueprint, index) => ({
    ...blueprint,
    order: index + 1,
  }));
}

export function buildEditableLegacyQuestions(params: {
  categoryKey: string;
  categoryName: string;
  ordinaryQuestions: RequestQuestionLike[];
}): EditableLegacyQuestion[] {
  const normalizedCategoryKey = normalizeCategoryKey(params.categoryKey || params.categoryName);
  const blueprints = buildLegacyQuestionBlueprints({
    categoryKey: params.categoryKey,
    categoryName: params.categoryName,
  });
  const categoryQuestions = params.ordinaryQuestions.filter(
    (question) =>
      question.mode === "ordinary" &&
      question.scope === "category" &&
      normalizeCategoryKey(String(question.categoryKey || "")) === normalizedCategoryKey,
  );
  const globalQuestions = params.ordinaryQuestions.filter(
    (question) => question.mode === "ordinary" && question.scope === "global",
  );

  const resolvedBlueprintQuestions = blueprints.map((blueprint) => {
    const categoryQuestion =
      categoryQuestions.find((question) => String(question.key || "") === blueprint.key) ?? null;
    const globalQuestion =
      globalQuestions.find((question) => String(question.key || "") === blueprint.key) ?? null;
    const source: EditableLegacyQuestion["source"] = categoryQuestion
      ? "category"
      : globalQuestion
        ? "global"
        : "default";
    const resolved = categoryQuestion || globalQuestion;
    const options = Array.isArray(resolved?.options)
      ? (resolved?.options as string[])
      : blueprint.options ?? undefined;

    return {
      ...blueprint,
      persistedId: String(categoryQuestion?.id || "") || null,
      inheritedId: String(globalQuestion?.id || "") || null,
      label: CANONICAL_BLUEPRINT_LABEL_KEYS.has(blueprint.key)
        ? blueprint.label
        : String(resolved?.label || blueprint.label),
      type: (resolved?.type as EditableLegacyQuestion["type"]) || blueprint.type,
      required: resolved?.required ?? blueprint.required,
      options,
      order: Number(resolved?.order ?? blueprint.order),
      isEnabled: resolved?.isEnabled ?? true,
      source,
    };
  });

  const aliasedBlueprintKeys = new Set(
    blueprints.flatMap((blueprint) => [
      blueprint.key,
      ...(LEGACY_BLUEPRINT_KEY_ALIASES[blueprint.key] || []),
    ]).map((key) => String(key || "").trim().toLowerCase()),
  );
  const extraQuestionMap = new Map<
    string,
    { categoryQuestion: RequestQuestionLike | null; globalQuestion: RequestQuestionLike | null }
  >();

  globalQuestions.forEach((question) => {
    const key = String(question.key || "").trim();
    const normalizedKey = key.toLowerCase();
    if (!key || aliasedBlueprintKeys.has(normalizedKey) || SUPPRESSED_EXTRA_QUESTION_KEYS.has(normalizedKey)) return;
    extraQuestionMap.set(key, {
      categoryQuestion: null,
      globalQuestion: question,
    });
  });

  categoryQuestions.forEach((question) => {
    const key = String(question.key || "").trim();
    const normalizedKey = key.toLowerCase();
    if (!key || aliasedBlueprintKeys.has(normalizedKey) || SUPPRESSED_EXTRA_QUESTION_KEYS.has(normalizedKey)) return;
    const existing = extraQuestionMap.get(key);
    extraQuestionMap.set(key, {
      categoryQuestion: question,
      globalQuestion: existing?.globalQuestion ?? null,
    });
  });

  const resolvedExtraQuestions = Array.from(extraQuestionMap.entries()).map(([key, questionPair]) => {
    const resolved = questionPair.categoryQuestion || questionPair.globalQuestion;
    const source: EditableLegacyQuestion["source"] = questionPair.categoryQuestion
      ? "category"
      : questionPair.globalQuestion
        ? "global"
        : "default";
    const type = (resolved?.type as EditableLegacyQuestion["type"]) || "textarea";
    return {
      key,
      label: String(resolved?.label || "New question"),
      type,
      required: resolved?.required ?? false,
      options: Array.isArray(resolved?.options) ? (resolved?.options as string[]) : undefined,
      order: Number(resolved?.order ?? resolvedBlueprintQuestions.length + 1),
      kind:
        type === "select" || type === "urgency"
          ? "chips"
          : type === "image" || type === "multi_image"
            ? "photos"
            : "text",
      helperText: undefined,
      placeholder: type === "text" || type === "textarea" ? "Type the resident response." : undefined,
      conditionalValue: undefined,
      persistedId: String(questionPair.categoryQuestion?.id || "") || null,
      inheritedId: String(questionPair.globalQuestion?.id || "") || null,
      isEnabled: resolved?.isEnabled ?? true,
      source,
    } as EditableLegacyQuestion;
  });

  return [...resolvedBlueprintQuestions, ...resolvedExtraQuestions].sort(
    (a, b) => Number(a.order || 0) - Number(b.order || 0),
  );
}
