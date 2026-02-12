import { GoogleGenerativeAI } from "@google/generative-ai";

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

// Category-specific guidance to inject into prompts for tailored advice
const CATEGORY_SPECIFIC_GUIDANCE: Record<string, string> = {
  electrical: `CATEGORY FOCUS (Electrical):
- Ask about breakers, voltage, sparks, burning smells, or flickering lights if not mentioned.
- DIY is only safe for: resetting breakers, replacing bulbs/fuses, checking outlet connections.
- ESCALATE immediately for: exposed wires, burning smells, sparks, shock hazards, water near electricity.
- Key clarifying questions: "Is the breaker tripped?", "Do you see sparks or smell burning?"`,

  plumbing: `CATEGORY FOCUS (Plumbing):
- Ask about water source, leak severity, and whether water is shut off if not mentioned.
- DIY is safe for: unclogging drains, replacing washers, tightening connections.
- ESCALATE for: burst pipes, sewage backup, major flooding, no water at all.
- Key clarifying questions: "Can you turn off the water valve?", "Is it a slow drip or active leak?"`,

  appliance_repair: `CATEGORY FOCUS (Appliance Repair):
- Ask about appliance type, age, and specific symptoms if not mentioned.
- DIY is safe for: cleaning filters, resetting devices, checking power connections.
- ESCALATE for: gas appliances, refrigerant issues, electrical faults inside appliances.
- Key clarifying questions: "Is the appliance making unusual sounds?", "When did it last work properly?"`,

  hvac: `CATEGORY FOCUS (HVAC - Heating/Cooling):
- Ask about temperature readings, thermostat settings, and filter condition if not mentioned.
- DIY is safe for: changing filters, adjusting thermostat, clearing vents.
- ESCALATE for: gas furnace issues, refrigerant leaks, complete system failure.
- Key clarifying questions: "Is air flowing but not heating/cooling?", "When was the filter last changed?"`,

  carpentry: `CATEGORY FOCUS (Carpentry):
- For furniture requests (chairs, tables, shelves, cabinets), ask about:
  * Type/style (e.g., dining chair, office chair, stool, armchair, custom design)
  * Dimensions (height, width, depth) or reference size
  * Material preference (wood type: oak, pine, mahogany, plywood, etc.)
  * Finish (paint, stain, varnish, natural)
  * Timeline/deadline for completion
  * User's experience level with woodworking
- For repairs, ask about the type of wood, location, and extent of damage.
- DIY is safe for: minor repairs, simple builds with guidance, hanging items, fixing squeaky floors.
- ESCALATE for: structural damage, load-bearing walls, termite damage, complex custom furniture.
- Key clarifying questions: "What style/type of [item] do you have in mind?", "What dimensions are you looking for?", "Any preference for wood type or finish?", "When do you need this completed?"`,

  painting: `CATEGORY FOCUS (Painting):
- Ask about surface type, room size, and current paint condition if not mentioned.
- DIY is generally safe for most painting tasks.
- ESCALATE for: lead paint concerns (pre-1980 homes), exterior high areas.
- Key clarifying questions: "Interior or exterior?", "What's the surface condition?"`,

  cleaning: `CATEGORY FOCUS (Cleaning):
- Ask about cleaning type, area size, and any specific concerns if not mentioned.
- DIY is safe for most household cleaning.
- ESCALATE for: biohazard cleanup, mold remediation, hoarding situations.
- Key clarifying questions: "Is this a one-time or regular cleaning need?", "Any allergy concerns?"`,

  pest_control: `CATEGORY FOCUS (Pest Control):
- Ask about pest type, infestation severity, and location if not mentioned.
- DIY is safe for: minor ant/insect issues, basic prevention.
- ESCALATE for: termites, rodent infestations, bed bugs, wasps/bees.
- Key clarifying questions: "What type of pest did you see?", "How long has this been happening?"`,

  landscaping: `CATEGORY FOCUS (Landscaping):
- Ask about outdoor area size, type of work needed, and access if not mentioned.
- DIY is safe for: basic gardening, lawn care, planting.
- ESCALATE for: tree removal, irrigation systems, hardscaping.
- Key clarifying questions: "What's the approximate area size?", "Is this front or backyard?"`,

  roofing: `CATEGORY FOCUS (Roofing):
- Ask about leak location, roof age, and visible damage if not mentioned.
- DIY is generally NOT safe for roofing work due to fall hazards.
- ESCALATE for: any active leaks, missing shingles, structural concerns.
- Key clarifying questions: "Do you see water stains on the ceiling?", "When was roof last inspected?"`,

  security: `CATEGORY FOCUS (Security Systems):
- Ask about current system type, specific issue, and urgency if not mentioned.
- DIY is safe for: battery replacement, resetting keypads, testing sensors.
- ESCALATE for: wiring issues, camera installation, system upgrades.
- Key clarifying questions: "Is this an existing system malfunction or new installation?"`,

  moving: `CATEGORY FOCUS (Moving/Hauling):
- Ask about item types, volume, distance, and timeline if not mentioned.
- Consider whether professional movers or DIY with help is appropriate.
- ESCALATE for: piano/specialty items, long-distance moves, commercial moves.
- Key clarifying questions: "Approximate number of rooms/items?", "Any fragile or specialty items?"`,

  general_handyman: `CATEGORY FOCUS (General Handyman):
- Ask about the specific task type and complexity if not mentioned.
- DIY is safe for: minor repairs, assembly, basic maintenance.
- ESCALATE for: specialized trades (electrical, plumbing, HVAC).
- Key clarifying questions: "Can you describe the specific task?", "Have you attempted this before?"`,

  carpenter: `CATEGORY FOCUS (Carpenter - Furniture & Woodwork):
- For furniture requests (chairs, tables, shelves, cabinets, beds), gather these details:
  * Style/type (e.g., dining chair, office chair, stool, armchair, rustic, modern, custom)
  * Dimensions (height, width, depth) or reference ("standard dining height", "bar height")
  * Material preference (oak, pine, mahogany, plywood, MDF, reclaimed wood)
  * Finish (painted, stained, varnished, natural/unfinished)
  * Quantity needed
  * Timeline/deadline
  * Budget range (if they're open to sharing)
- For repairs: ask about damage type, wood condition, and whether it's structural.
- If user is inexperienced, offer to connect them with a professional carpenter.
- DIY is suitable for: simple repairs, basic shelving, following beginner plans.
- ESCALATE for: complex custom furniture, structural work, antique restoration.
- Key questions: "What style of [item] are you envisioning?", "Do you have specific dimensions in mind?", "Any wood or finish preferences?", "When do you need this by?"`,

  furniture: `CATEGORY FOCUS (Furniture - Building & Repair):
- Treat furniture requests like carpentry: ask about style, dimensions, materials, finish, and timeline.
- For repairs: understand what's broken, the material, and whether it's worth repairing vs replacing.
- Common furniture types: chairs, tables, desks, shelves, cabinets, beds, benches.
- Key questions: "What piece of furniture do you need?", "Can you describe the style you're looking for?", "What's your timeline and budget?"`,

  maintenance_repair: `CATEGORY FOCUS (Maintenance & Repair):
- This is a broad category. First identify the specific type of repair needed.
- Ask: "What specifically needs to be repaired or maintained?" then route to appropriate specialty.
- Common subcategories: appliances, fixtures, doors/windows, flooring, walls/ceilings.
- DIY is safe for: basic maintenance, cleaning, minor adjustments.
- ESCALATE for: anything involving electrical, plumbing, gas, or structural elements.`,

  tiling: `CATEGORY FOCUS (Tiling):
- Ask about tile type, area size, and current condition.
- DIY is safe for: replacing single broken tiles, regrouting small areas.
- ESCALATE for: full room tiling, waterproofing areas (bathrooms), heated floor tiles.
- Key questions: "What area needs tiling?", "Is this new installation or repair?", "What's the approximate size?"`,

  welding: `CATEGORY FOCUS (Welding):
- Ask about metal type, purpose of the weld, and structural requirements.
- DIY is NOT generally safe for welding without proper equipment and training.
- ESCALATE for: all welding work - this requires professional equipment and expertise.
- Key questions: "What metal needs welding?", "Is this decorative or structural?", "What's the purpose of the item?"`,
};

// Get category-specific guidance, with fallback to general
function getCategoryGuidance(category: string): string {
  const normalizedCategory = category.toLowerCase().replace(/[\s-]+/g, "_");
  return CATEGORY_SPECIFIC_GUIDANCE[normalizedCategory] || 
    CATEGORY_SPECIFIC_GUIDANCE["general_handyman"] || "";
}

// Single global system prompt for CityBuddy (all categories).
// Enforces: concise, non-repetitive, progressive, no headings/duplicated phrases, ONE follow-up question max.
const SYSTEM_PROMPT = `You are CityBuddy, a practical and calm assistant for CityConnect residents.

Goals:
- Be concise and helpful.
- Prefer DIY guidance when it is safe.
- Escalate only when justified by safety risk or complexity.
- Never repeat the same idea twice.

IMAGE VALIDATION (CRITICAL - if an image is attached):
- FIRST, identify what the image actually shows.
- THEN, check if the image is relevant to the described issue and selected service category.
- If the image does NOT match the described issue (e.g., user reports a burnt electrical meter but uploads a photo of a chair), you MUST:
  1. Clearly state what the image shows (e.g., "I can see this is a photo of a wooden chair").
  2. Clearly state it does NOT match the issue described (e.g., "This doesn't appear to show the burnt meter you mentioned").
  3. Ask the user to upload a relevant photo (e.g., "Could you please upload a photo of the actual burnt meter so I can better assess the situation?").
  4. Set intent to "clarify" so the user can respond.
  5. Do NOT proceed with service recommendations or booking summaries until a relevant image is provided.
- Only proceed with full analysis if the image clearly relates to the described issue.

Distress handling:
- If INTERNAL_SIGNALS indicate distressed=true, prioritize empathy and immediate stabilization over data collection.
- Start message with empathy.
- Summarize what you know (issue + any location/context).
- Provide 1\u20132 immediate safety/stabilizing steps when appropriate.
- Ask ONE focused practical question (only if needed), not a generic “describe what happened”.

Tone:
- Be friendly, warm, and conversational. Show genuine interest in helping.
- Use empathetic language ("I understand", "That makes sense", "Great choice").
- Feel free to elaborate when it helps the user understand their options.
- Avoid robotic or overly formal language.

Rules:
- Output MUST be a single JSON object. No markdown. No code fences. No extra text.
- Do NOT include headings, labels, or section titles in any strings.
- Stay on-platform: Do not send users to external stores, websites, marketplaces, or community platforms.
- When suggesting purchasing or sourcing items/services, prefer CityConnect flows:
  - CityConnect Marketplace (for buying items)
  - Book a Professional / provider booking (for hiring help)
- message: keep it concise but friendly (up to 3-4 sentences when needed for clarity).
- steps: optional, max 5 items, each item max ~15 words, actionable and helpful.
- Ask AT MOST ONE follow-up question and ONLY when intent is clarify.
- If intent is guide or escalate, omit followUpQuestion.
- Never ask for a description if the user already provided one.
- Do not over-escalate to maintenance/consultancy; only escalate if risk is high or DIY is unsafe.
- Never claim certainty; use practical, grounded language.
- If the user mentions lack of experience or being a beginner, adapt your guidance to be more educational and supportive.

JSON shape (exact keys):
{
  "intent": "clarify" | "guide" | "escalate",
  "message": string,
  "steps"?: string[],
  "followUpQuestion"?: string,
  "escalationNote"?: string
}`;

export interface ChatMessage {
  role: "user" | "assistant";
  text: string;
}

export type MascotState = "idle" | "thinking" | "responding";

const DEFAULT_MODEL = "gemini-2.5-flash";

let genAI: GoogleGenerativeAI | null = null;

function getErrorMessage(error: unknown): string {
  if (!error) return "Unknown error";
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

function isModelNotFoundError(error: unknown): boolean {
  const message = getErrorMessage(error).toLowerCase();
  return (
    message.includes("404") &&
    (message.includes("not found") || message.includes("model"))
  );
}

async function generateWithModel(modelName: string, prompt: string): Promise<string> {
  const ai = getGenAI();
  const model = ai.getGenerativeModel({ model: modelName });
  const result = await model.generateContent(prompt);
  const response = result.response;
  return response.text().trim();
}

export interface InlineImagePart {
  mimeType: string;
  /** Base64 content with no data-url prefix */
  data: string;
}

function extractJsonObject(text: string): string | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  return text.slice(start, end + 1);
}

function sanitizePlainText(value: unknown): string {
  if (typeof value !== "string") return "";
  // Strip obvious section-style prefixes if the model misbehaves.
  return value
    .replace(/^\s*(recommended approach|approach|reasoning|explanation|understanding)\s*[:\-]\s*/i, "")
    .trim();
}

function sanitizeSteps(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((v) => sanitizePlainText(v))
    .filter(Boolean)
    .slice(0, 5);
}

export function parseCityBuddyAiResponse(raw: string): CityBuddyAiResponse {
  const trimmed = raw.trim();
  let parsed: any = null;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    const extracted = extractJsonObject(trimmed);
    if (!extracted) {
      return {
        intent: "guide",
        message: "I can help. Share what happened and what you see right now.",
      };
    }
    try {
      parsed = JSON.parse(extracted);
    } catch {
      return {
        intent: "guide",
        message: "I can help. Share what happened and what you see right now.",
      };
    }
  }

  const intent: CityBuddyIntent =
    parsed?.intent === "clarify" || parsed?.intent === "guide" || parsed?.intent === "escalate"
      ? parsed.intent
      : "guide";

  const message = sanitizePlainText(parsed?.message) || "I can help. Tell me what you’re seeing.";
  const steps = sanitizeSteps(parsed?.steps);
  const followUpQuestion = sanitizePlainText(parsed?.followUpQuestion);
  const escalationNote = sanitizePlainText(parsed?.escalationNote);

  const normalized: CityBuddyAiResponse = {
    intent,
    message,
  };

  if (steps.length) normalized.steps = steps;

  // Enforce: follow-up question only for clarify intent.
  if (intent === "clarify" && followUpQuestion) {
    normalized.followUpQuestion = followUpQuestion;
  }

  if (intent === "escalate" && escalationNote) {
    normalized.escalationNote = escalationNote;
  }

  if (Array.isArray(parsed?.followUpQuestions)) {
    normalized.followUpQuestions = parsed.followUpQuestions;
  }
  if (Array.isArray(parsed?.recommendedProviderIds)) {
    normalized.recommendedProviderIds = parsed.recommendedProviderIds.map((id: any) => String(id));
  }
  if (parsed?.extracted && typeof parsed.extracted === "object") {
    normalized.extracted = parsed.extracted;
  }
  if (typeof parsed?.confidence === "number") {
    normalized.confidence = parsed.confidence;
  }

  return normalized;
}

async function generateWithModelAndImages(
  modelName: string,
  prompt: string,
  images: InlineImagePart[]
): Promise<string> {
  const ai = getGenAI();
  const model = ai.getGenerativeModel({ model: modelName });

  const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [
    { text: prompt },
    ...images.map((img) => ({
      inlineData: {
        mimeType: img.mimeType,
        data: img.data,
      },
    })),
  ];

  const result = await model.generateContent(parts);
  const response = result.response;
  return response.text().trim();
}

function getGenAI(): GoogleGenerativeAI {
  if (!genAI) {
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error(
        "VITE_GEMINI_API_KEY is not set. Please add it to your .env file."
      );
    }
    genAI = new GoogleGenerativeAI(apiKey);
  }
  return genAI;
}


export type ImageRelevanceResult = {
  isRelevant: boolean;
  confidence: "high" | "medium" | "low";
  feedback: string;
  suggestion?: string;
};

/**
 * DEPRECATED: Image validation is now integrated into the main Gemini call
 * to avoid exceeding API quotas. This function is kept for backwards compatibility
 * but should not be used. Instead, rely on Gemini's built-in image understanding
 * as part of the sendMessageToGemini call.
 */
export async function checkImageRelevance({
  category,
  issueDescription,
  images,
}: {
  category: string;
  issueDescription: string;
  images: InlineImagePart[];
}): Promise<ImageRelevanceResult> {
  // Image validation now happens in Gemini's main analysis
  // This function is deprecated and kept only for backwards compatibility
  return {
    isRelevant: true,
    confidence: "low",
    feedback: "Image validation integrated into main analysis",
    suggestion: undefined,
  };
}

export async function sendMessageToGemini({
  category,
  estate = "VGC",
  history,
  userMessage,
  images,
  situation,
  memorySummary,
  urgency,
  timing,
  location,
  systemPrompt,
  model,
}: {
  category: string;
  estate?: string;
  history: ChatMessage[];
  userMessage: string;
  images?: InlineImagePart[];
  situation?: CityBuddySituation;
  memorySummary?: string;
  urgency?: string;
  timing?: string;
  location?: string;
  systemPrompt?: string | null;
  model?: string | null;
}): Promise<CityBuddyAiResponse> {
  try {
    // Call server's /api/ai/chat endpoint instead of Gemini directly
    // This allows using Ollama, OpenAI, or Gemini based on server configuration
    const clientStartTime = performance.now();
    console.log(`[CLIENT] 🚀 Sending AI chat request for category: ${category}`);
    
    const requestPayload = {
      category,
      history: history.map((msg) => ({
        type: msg.role === "user" ? "user_text" : "ai_message",
        text: msg.text,
      })),
      slots: {
        estate,
        urgency,
        timing,
        location,
        memorySummary,
        situation: situation ? JSON.stringify(situation) : undefined,
        userMessage,
      },
      images: images?.map((img) => img.data),
    };
    
    console.log(`[CLIENT] 📦 Request payload size: ${JSON.stringify(requestPayload).length} chars`);
    console.log(`[CLIENT] 📝 History items: ${history.length}`);
    
    const response = await fetch("/api/ai/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestPayload),
    });
    
    const responseTime = performance.now() - clientStartTime;
    console.log(`[CLIENT] ⏱️  Response received from server in ${responseTime.toFixed(0)}ms`);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Server error: ${response.status}`);
    }

    const data = await response.json();

    // Validate and normalize the response
    const aiResponse: CityBuddyAiResponse = {
      intent: (data.intent === "clarify" || data.intent === "escalate" ? data.intent : "guide") as CityBuddyIntent,
      message: data.message || "I'm here to help. Can you provide more details?",
      steps: Array.isArray(data.steps) ? data.steps : undefined,
      followUpQuestion: data.followUpQuestion,
      escalationNote: data.escalationNote,
      followUpQuestions: Array.isArray(data.followUpQuestions) ? data.followUpQuestions : undefined,
      recommendedProviderIds: Array.isArray(data.recommendedProviderIds) ? data.recommendedProviderIds : undefined,
      extracted: data.extracted,
      confidence: typeof data.confidence === "number" ? data.confidence : undefined,
    };

    const totalTime = performance.now() - clientStartTime;
    console.log(`[CLIENT] ✅ AI response processed successfully in ${totalTime.toFixed(0)}ms`);
    console.log(`[CLIENT] Intent: ${aiResponse.intent}, Confidence: ${aiResponse.confidence}\n`);

    return aiResponse;
  } catch (error) {
    const details = getErrorMessage(error);
    console.error("[CLIENT] ❌ AI chat API error:", error);
    throw new Error(`AI request failed: ${details}`);
  }
}
