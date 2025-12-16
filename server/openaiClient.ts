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
