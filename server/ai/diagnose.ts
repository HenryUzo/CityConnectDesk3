import { AIDiagnosisResponseSchema, AiDiagnosis } from "./schema";
import type { DiagnosisInput } from "./types";
import { generateGeminiContent } from "./geminiClient";

const DEFAULT_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

const BASE_FALLBACK: AiDiagnosis = {
  summary:
    "CityConnect's AI diagnosis is temporarily unavailable. Please keep the system safe and consult a trusted professional before acting.",
  probableCauses: [],
  severity: "medium",
  shouldAvoidDIY: true,
  safetyNotes: [
    "AI could not analyze the request right now. Document the issue, then let a qualified technician review it.",
  ],
  suggestedChecks: ["Capture photos/videos of the problem so a pro can assess the situation quickly."],
  whenToCallPro: "Contact the appropriate professional to investigate and resolve this issue safely.",
  suggestedCategory: null,
};

export const GEMINI_FALLBACK_DIAGNOSIS: AiDiagnosis = { ...BASE_FALLBACK };

export const GEMINI_SAFETY_FALLBACK: AiDiagnosis = {
  ...BASE_FALLBACK,
  summary:
    "Google Gemini blocked the request for safety reasons. Keep the area secure and involve a licensed expert.",
  severity: "high",
  safetyNotes: [
    "Gemini's safety filters marked this content as potentially risky. Do not attempt repairs yourself.",
    "Escalate the incident to a licensed professional instead of DIY fixes.",
  ],
  suggestedChecks: [
    "Document the issue with photos and exact conditions so a pro can assess it offsite.",
    "Avoid touching the affected components until a professional arrives.",
  ],
};

function buildPrompt(input: DiagnosisInput): string {
  const urgency = input.urgency ?? "not specified";
  const specialInstructions = input.specialInstructions?.trim() || "None";
  return [
    "You are CityConnect's trusted maintenance analyst. The resident provided the following situation:",
    `Category: ${input.category}`,
    `Urgency: ${urgency}`,
    `Description: ${input.description.trim()}`,
    `Special Instructions: ${specialInstructions}`,
    "",
    "Respond with STRICT JSON matching this schema (no markdown, no explanations, no surrounding text):",
    JSON.stringify({
      summary: "string",
      probableCauses: [
        {
          cause: "string",
          likelihood: "low|medium|high",
        },
      ],
      severity: "low|medium|high|critical",
      shouldAvoidDIY: "boolean",
      safetyNotes: ["string"],
      suggestedChecks: ["string"],
      whenToCallPro: "string",
      suggestedCategory: "string|null",
    }),
    "Ensure the output keys and value types exactly match the schema. Do not add markdown, code fences, or extra commentary.",
  ].join("\n");
}

function extractJsonObject(text: string): string | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    return null;
  }
  return text.slice(start, end + 1);
}

function parseDiagnosisText(raw: string): unknown {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new Error("Gemini response was empty.");
  }
  try {
    return JSON.parse(trimmed);
  } catch (error) {
    const extracted = extractJsonObject(trimmed);
    if (extracted) {
      try {
        return JSON.parse(extracted);
      } catch {
        // fall through
      }
    }
    const snippet = trimmed.slice(0, 200).replace(/\s+/g, " ");
    throw new Error(
      `Unable to parse Gemini JSON response. Snippet: ${snippet}. ${error instanceof Error ? error.message : ""}`
    );
  }
}

export async function runDiagnosis(input: DiagnosisInput & { model?: string }): Promise<AiDiagnosis> {
  const model = input.model || DEFAULT_MODEL;
  const prompt = buildPrompt(input);
  const { text, blocked } = await generateGeminiContent(model, prompt);
  if (blocked) {
    return GEMINI_SAFETY_FALLBACK;
  }
  if (!text) {
    throw new Error("Gemini returned an empty response.");
  }
  const parsed = parseDiagnosisText(text);
  return AIDiagnosisResponseSchema.parse(parsed);
}
