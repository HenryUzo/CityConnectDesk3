import type { DiagnosisInput } from "../types";
import type { AiDiagnosis } from "../schema";

export async function diagnose(input: DiagnosisInput & { model?: string }): Promise<AiDiagnosis> {
  const baseUrl = process.env.OLLAMA_BASE_URL || process.env.OLLAMA_HOST || "http://localhost:11434";
  const model = input.model || process.env.OLLAMA_MODEL || "llama3.1";

  const prompt = `You are a home maintenance assistant. Respond ONLY with a JSON object matching this schema with no extra text:\n\n{
    "summary": string,
    "probableCauses": [{ "cause": string, "likelihood": "low"|"medium"|"high" }],
    "severity": "low"|"medium"|"high"|"critical",
    "shouldAvoidDIY": boolean,
    "safetyNotes": string[],
    "suggestedChecks": string[],
    "whenToCallPro": string,
    "suggestedCategory": string|null
  }\n\nResident repair request details:\nCategory: ${input.category}\nUrgency: ${input.urgency ?? "not specified"}\nDescription: ${input.description}\nSpecial instructions: ${input.specialInstructions || "None"}.`; 

  const resp = await fetch(`${baseUrl.replace(/\/$/, "")}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      prompt,
      stream: false,
      options: { temperature: 0.1 },
    }),
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(`Ollama error ${resp.status}: ${text.slice(0, 300)}`);
  }

  const data = await resp.json().catch(() => ({}));
  const raw = typeof data?.response === "string" ? data.response : null;
  if (!raw) throw new Error("Invalid Ollama output");
  // Some models wrap JSON in code fences
  const cleaned = raw.trim().replace(/^```(json)?/i, "").replace(/```$/i, "").trim();
  return JSON.parse(cleaned);
}
