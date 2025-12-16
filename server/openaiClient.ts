import OpenAI from "openai";

let cachedClient: OpenAI | null = null;

export function getOpenAI() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured. Set it in your environment to use AI diagnosis.");
  }

  if (!cachedClient) {
    cachedClient = new OpenAI({
      apiKey,
    });
  }

  return cachedClient;
}

export function getDiagnosisModel() {
  return process.env.OPENAI_DIAGNOSIS_MODEL || "gpt-4o-mini";
}

// Lightweight health check to verify API key and basic access work.
export async function verifyOpenAI() {
  const client = getOpenAI();
  const model = getDiagnosisModel();
  try {
    // Use the Responses API with a trivial prompt to confirm basic functionality
    const resp = await client.responses.create({
      model,
      input: [
        {
          role: "user",
          content: [{ type: "input_text", text: "ping" }],
        },
      ],
      text: { format: { type: "plain_text" } },
    });
    const output = (resp as any)?.output_text;
    const ok = typeof output === "string";
    return { ok, model, output: ok ? output : null };
  } catch (error: any) {
    return { ok: false, model, error: error?.message || String(error) };
  }
}
