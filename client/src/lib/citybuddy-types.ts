export type CityBuddyIntent = "clarify" | "guide" | "escalate";

export type CityBuddyAiResponse = {
  intent: CityBuddyIntent;
  message: string;
  steps?: string[];
  followUpQuestion?: string;
  escalationNote?: string;
  followUpQuestions?: Array<{
    key: string;
    label: string;
    type: string;
    options?: string[];
    required: boolean;
  }>;
  recommendedProviderIds?: string[];
  extracted?: {
    urgency?: string | null;
    estateId?: string | null;
    inspectionDate?: string | null;
  };
  confidence?: number;
};

export type CityBuddySituation = {
  clarity: "low" | "medium" | "high";
  risk: "low" | "medium" | "high";
  diySafe: boolean;
  /** User appears urgent/distressed (internal only). */
  distressed?: boolean;
};

export type InlineImagePart = {
  mimeType: string;
  /** Base64 content with no data-url prefix */
  data: string;
};
