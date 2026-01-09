import { GoogleGenerativeAI } from "@google/generative-ai";

export type CityBuddyIntent = "clarify" | "guide" | "escalate";

export type CityBuddyAiResponse = {
  intent: CityBuddyIntent;
  message: string;
  steps?: string[];
  followUpQuestion?: string;
  escalationNote?: string;
};

export type CityBuddySituation = {
  clarity: "low" | "medium" | "high";
  risk: "low" | "medium" | "high";
  diySafe: boolean;
  /** User appears urgent/distressed (internal only). */
  distressed?: boolean;
};

// Single global system prompt for CityBuddy (all categories).
// Enforces: concise, non-repetitive, progressive, no headings/duplicated phrases, ONE follow-up question max.
const SYSTEM_PROMPT = `You are CityBuddy, a practical and calm assistant for CityConnect residents.

Goals:
- Be concise and helpful.
- Prefer DIY guidance when it is safe.
- Escalate only when justified by safety risk or complexity.
- Never repeat the same idea twice.

Distress handling:
- If INTERNAL_SIGNALS indicate distressed=true, prioritize empathy and immediate stabilization over data collection.
- Start message with empathy.
- Summarize what you know (issue + any location/context).
- Provide 1–2 immediate safety/stabilizing steps when appropriate.
- Ask ONE focused practical question (only if needed), not a generic “describe what happened”.

Rules:
- Output MUST be a single JSON object. No markdown. No code fences. No extra text.
- Do NOT include headings, labels, or section titles in any strings.
- Stay on-platform: Do not send users to external stores, websites, marketplaces, or community platforms.
- When suggesting purchasing or sourcing items/services, prefer CityConnect flows:
  - CityConnect Marketplace (for buying items)
  - Book a Professional / provider booking (for hiring help)
- message: max 2 short sentences.
- steps: optional, max 5 items, each item max ~12 words, actionable.
- Ask AT MOST ONE follow-up question and ONLY when intent is clarify.
- If intent is guide or escalate, omit followUpQuestion.
- Never ask for a description if the user already provided one.
- Do not over-escalate to maintenance/consultancy; only escalate if risk is high or DIY is unsafe.
- Never claim certainty; use practical, grounded language.

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

export async function sendMessageToGemini({
  category,
  estate = "VGC",
  history,
  userMessage,
  images,
  situation,
}: {
  category: string;
  estate?: string;
  history: ChatMessage[];
  userMessage: string;
  images?: InlineImagePart[];
  situation?: CityBuddySituation;
}): Promise<CityBuddyAiResponse> {
  // Use a modern default model, or read from env if available
  const configuredModel = import.meta.env.VITE_GEMINI_MODEL;
  const modelName = configuredModel || DEFAULT_MODEL;

  // Build context
  const contextBlock = `
CONTEXT:
- Estate: ${estate}
- Service Category: ${category}
${situation ? `- INTERNAL_SIGNALS (do not repeat): clarity=${situation.clarity}, risk=${situation.risk}, diySafe=${situation.diySafe}${typeof situation.distressed === "boolean" ? `, distressed=${situation.distressed}` : ""}` : ""}
`;

  // Build conversation history for the prompt
  const historyText = history
    .map((msg) => `${msg.role === "user" ? "User" : "CityBuddy"}: ${msg.text}`)
    .join("\n\n");

  // Full prompt
  const fullPrompt = `${SYSTEM_PROMPT}

${contextBlock}

${historyText ? `CONVERSATION SO FAR:\n${historyText}\n\n` : ""}User: ${userMessage}

CityBuddy:`;

  try {
    if (images && images.length > 0) {
      const text = await generateWithModelAndImages(modelName, fullPrompt, images);
      return parseCityBuddyAiResponse(text);
    }
    const text = await generateWithModel(modelName, fullPrompt);
    return parseCityBuddyAiResponse(text);
  } catch (error) {
    // If a non-default model is configured but not available, retry once with the default model.
    if (modelName !== DEFAULT_MODEL && isModelNotFoundError(error)) {
      try {
        if (images && images.length > 0) {
          const text = await generateWithModelAndImages(DEFAULT_MODEL, fullPrompt, images);
          return parseCityBuddyAiResponse(text);
        }
        const text = await generateWithModel(DEFAULT_MODEL, fullPrompt);
        return parseCityBuddyAiResponse(text);
      } catch (fallbackError) {
        const details = getErrorMessage(fallbackError);
        console.error(`Gemini API error (fallback ${DEFAULT_MODEL}):`, fallbackError);
        throw new Error(
          `Gemini request failed using model "${modelName}" and fallback "${DEFAULT_MODEL}": ${details}`
        );
      }
    }

    const details = getErrorMessage(error);
    console.error("Gemini API error:", error);
    throw new Error(`Gemini request failed using model "${modelName}": ${details}`);
  }
}
