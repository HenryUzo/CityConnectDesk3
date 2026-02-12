type OllamaMsg = { role: "system" | "user" | "assistant"; content: string };

export async function ollamaChat(opts: {
  messages: OllamaMsg[];
  model?: string;
  temperature?: number;
}) {
  const baseUrl = process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434";
  const model = opts.model || process.env.OLLAMA_MODEL || "qwen2.5:7b";
  
  // Calculate message sizes for diagnostic logging
  const systemMsg = opts.messages.find(m => m.role === "system");
  const userMsg = opts.messages.find(m => m.role === "user");
  const systemSize = systemMsg ? systemMsg.content.length : 0;
  const userSize = userMsg ? userMsg.content.length : 0;
  
  const startTime = Date.now();
  console.log(`[OLLAMA] 🚀 Starting Ollama chat request`);
  console.log(`[OLLAMA] Model: ${model}`);
  console.log(`[OLLAMA] Base URL: ${baseUrl}`);
  console.log(`[OLLAMA] Temperature: ${opts.temperature ?? "default"}`);
  console.log(`[OLLAMA] Message sizes - System: ${systemSize} chars, User: ${userSize} chars`);
  console.log(`[OLLAMA] Total message size: ${systemSize + userSize} chars`);

  let res: Response;
  let fetchStartTime = Date.now();
  try {
    // Create an AbortController with a 3-minute timeout for Ollama responses
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 180000); // 3 minutes
    
    try {
      console.log(`[OLLAMA] ⏱️  Sending request to ${baseUrl}/api/chat...`);
      res = await fetch(`${baseUrl}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          messages: opts.messages,
          stream: false,
          options:
            typeof opts.temperature === "number"
              ? { temperature: opts.temperature }
              : undefined,
        }),
        signal: controller.signal,
      });
      const fetchEndTime = Date.now();
      console.log(`[OLLAMA] ✅ Got response from Ollama in ${fetchEndTime - fetchStartTime}ms (status: ${res.status})`);
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (error: any) {
    const elapsed = Date.now() - fetchStartTime;
    const msg = error?.message || "fetch failed";
    if (error?.name === "AbortError") {
      console.error(`[OLLAMA] ❌ Request timeout after ${elapsed}ms. Model may be too slow or not loaded.`);
      throw new Error(`Ollama request timeout after 3 minutes. The model may be too slow for your hardware or not loaded in memory.`);
    }
    console.error(`[OLLAMA] ❌ Fetch failed after ${elapsed}ms: ${msg}`);
    throw new Error(`Ollama chat failed to reach ${baseUrl} (${msg})`);
  }

  if (!res.ok) {
    const txt = await res.text();
    console.error(`[OLLAMA] ❌ Ollama returned error (${res.status}): ${txt.slice(0, 200)}`);
    throw new Error(`Ollama chat failed (${res.status}): ${txt}`);
  }

  const parseStartTime = Date.now();
  const data = await res.json();
  const parseEndTime = Date.now();
  const responseSize = JSON.stringify(data).length;
  const totalTime = parseEndTime - startTime;
  
  console.log(`[OLLAMA] 📦 Response parsing took ${parseEndTime - parseStartTime}ms`);
  console.log(`[OLLAMA] Response size: ${responseSize} chars`);
  console.log(`[OLLAMA] ⏱️  Total Ollama request time: ${totalTime}ms`);
  
  return data;
}
