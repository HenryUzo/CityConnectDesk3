import { getOpenAI } from "../../openaiClient";
import type { DiagnosisInput } from "../types";
import type { AiDiagnosis } from "../schema";

export async function diagnose(input: DiagnosisInput & { model?: string }): Promise<AiDiagnosis> {
  const client = getOpenAI();
  const model = input.model || process.env.OPENAI_DIAGNOSIS_MODEL || "gpt-4o-mini";
  const prompt = `Resident repair request details:\nCategory: ${input.category}\nUrgency: ${input.urgency ?? "not specified"}\nDescription: ${input.description}\nSpecial instructions: ${input.specialInstructions || "None"}.`;

  const resp = await client.responses.create({
    model,
    text: {
      format: {
        type: "json_schema",
        name: "AiDiagnosis",
        schema: {
          type: "object",
          additionalProperties: false,
          properties: {
            summary: { type: "string" },
            probableCauses: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                properties: {
                  cause: { type: "string" },
                  likelihood: { type: "string", enum: ["low", "medium", "high"] },
                },
                required: ["cause", "likelihood"],
              },
            },
            severity: { type: "string", enum: ["low", "medium", "high", "critical"] },
            shouldAvoidDIY: { type: "boolean" },
            safetyNotes: { type: "array", items: { type: "string" } },
            suggestedChecks: { type: "array", items: { type: "string" } },
            whenToCallPro: { type: "string" },
            suggestedCategory: { anyOf: [{ type: "string" }, { type: "null" }] },
          },
          required: [
            "summary",
            "probableCauses",
            "severity",
            "shouldAvoidDIY",
            "safetyNotes",
            "suggestedChecks",
            "whenToCallPro",
            "suggestedCategory",
          ],
        },
        strict: true,
      },
    },
    input: [
      { role: "user", content: [{ type: "input_text", text: prompt }] },
    ],
  });

  const outputText = (resp as any)?.output_text;
  const raw = typeof outputText === "string" && outputText.trim().length
    ? outputText
    : (resp as any)?.output?.[0]?.content?.[0]?.text;
  if (!raw || typeof raw !== "string") throw new Error("Invalid AI output");
  return JSON.parse(raw);
}
