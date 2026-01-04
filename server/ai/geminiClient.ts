const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_GEMINI_API_KEY;
const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models";
const LOG_PREFIX = "[AI][Gemini]";

export type GeminiGenerationResult = {
  text: string;
  blocked: boolean;
  raw: unknown;
};

export async function generateGeminiContent(
  model: string,
  prompt: string,
  signal?: AbortSignal
): Promise<GeminiGenerationResult> {
  if (!GEMINI_API_KEY) {
    throw new Error("Gemini API key is not configured.");
  }
  const url = `${GEMINI_BASE_URL}/${model}:generateContent`;
  const payload = {
    contents: [
      {
        role: "user",
        parts: [
          {
            text: prompt,
          },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 1024,
      topP: 0.95,
      topK: 40,
    },
  };

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": GEMINI_API_KEY,
    },
    body: JSON.stringify(payload),
    signal,
  });

  if (!response.ok) {
    const body = await response.text();
    const snippet = body?.slice(0, 350).replace(/\s+/g, " ").trim();
    throw new Error(
      `${LOG_PREFIX} model=${model} request failed ${response.status} ${response.statusText}${
        snippet ? `: ${snippet}` : ""
      }`
    );
  }

  const data = await response.json();
  const candidate = (data as any)?.candidates?.[0];
  const candidateParts = Array.isArray(candidate?.content?.parts)
    ? candidate.content.parts
    : Array.isArray(candidate?.content)
        ? candidate.content.flatMap((entry: any) => (Array.isArray(entry?.parts) ? entry.parts : []))
        : [];
  const parts = candidateParts.filter((part: any) => typeof part?.text === "string");
  let text = parts.map((part: any) => part.text).join("").trim();
  if (!text && typeof (data as any)?.outputText === "string") {
    text = (data as any).outputText.trim();
  }

  const blocked =
    Boolean(candidate?.finishReason === "SAFETY") ||
    Boolean((data as any)?.promptFeedback?.blockReason) ||
    Boolean(
      Array.isArray(candidate?.safetyAttributes) &&
        candidate.safetyAttributes.some((attr: any) => attr?.blocked === true)
    );

  if (!candidate || !parts.length || !text) {
    const snippet = JSON.stringify(candidate || data).slice(0, 350);
    throw new Error(`${LOG_PREFIX} model=${model} response missing text. Snippet: ${snippet}`);
  }

  return {
    text: (text ?? "").trim(),
    blocked,
    raw: data,
  };
}
