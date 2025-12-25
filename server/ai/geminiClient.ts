const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_GEMINI_API_KEY;
const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models";

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
    const snippet = body?.slice(0, 250).replace(/\s+/g, " ").trim();
    throw new Error(
      `Gemini request failed ${response.status} ${response.statusText}${snippet ? `: ${snippet}` : ""}`
    );
  }

  const data = await response.json();
  const candidate = (data as any)?.candidates?.[0];
  const parts = Array.isArray(candidate?.content)
    ? candidate.content
        .flatMap((contentEntry: any) => (Array.isArray(contentEntry.parts) ? contentEntry.parts : []))
        .filter((part: any) => typeof part?.text === "string")
    : [];
  let text = parts.map((part: any) => part.text).join("").trim();
  if (!text && typeof (data as any)?.outputText === "string") {
    text = (data as any).outputText.trim();
  }

  const blocked = Boolean(
    Array.isArray(candidate?.safetyAttributes) &&
      candidate.safetyAttributes.some((attr: any) => attr?.blocked === true)
  );

  return {
    text: (text ?? "").trim(),
    blocked,
    raw: data,
  };
}
