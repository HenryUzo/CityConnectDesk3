// server/app-routes.ts
import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { storage } from "./storage";
import { db } from "./db";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import {
  aiConversationFlowSettings,
  aiSessionAttachments,
  aiSessionMessages,
  aiSessions,
  conversationMessages,
  conversations,
  insertServiceRequestSchema,
  memberships,
  requestConversationSettings,
  requestQuestions,
} from "@shared/schema";
import { requireAuth, requireResident } from "./auth-middleware";
import { ollamaChat } from "./ai/ollama";
import { safeParseJsonFromText } from "./ai/safe-json";
import { getProviderMatches } from "./providers/matching";
import { generateGeminiContent } from "./ai/geminiClient";
import { IMAGE_LIMITS, validateDataUrl } from "./utils/validate-dataurl";

const router = Router();

// Legacy dev-login endpoint - DEPRECATED - Use /api/auth/login instead
router.post("/dev-login", async (req: Request, res: Response) => {
  res.status(410).json({ 
    error: "This endpoint is deprecated. Please use /api/auth/login instead.",
    migration_guide: {
      old: "POST /api/app/dev-login",
      new: "POST /api/auth/login",
      body: {
        username: "email or access code",
        password: "password"
      }
    }
  });
});

// Legacy logout endpoint - DEPRECATED - Use /api/auth/logout instead
router.post("/logout", (req, res) => {
  res.status(410).json({ 
    error: "This endpoint is deprecated. Please use /api/auth/logout instead.",
    migration_guide: {
      old: "POST /api/app/logout",
      new: "POST /api/auth/logout",
      body: {
        refreshToken: "your refresh token"
      }
    }
  });
});

// Service request validation schema
const ResidentServiceRequestSchema = z.object({
  category: z.string().min(1),
  description: z.string().min(10),
  urgency: z.enum(["low", "medium", "high", "emergency"]),
  preferredTime: z.string().optional(),
  specialInstructions: z.string().optional(),
  budget: z.string().optional(),
  location: z.string().optional(),
  latitude: z.preprocess(
    (value) => (typeof value === "string" && value.length ? Number(value) : value),
    z.number().optional(),
  ),
  longitude: z.preprocess(
    (value) => (typeof value === "string" && value.length ? Number(value) : value),
    z.number().optional(),
  ),
});

const ConversationCreateSchema = z.object({
  category: z.string().min(1),
  forceNew: z.boolean().optional(),
});

const ConversationMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  type: z.enum(["text", "image"]).optional(),
  content: z.string().min(1),
  meta: z.any().optional(),
});

const ConversationUpdateSchema = z.object({
  status: z.enum(["active", "closed"]),
});

// Public endpoint: Get enabled categories for resident category selection
router.get("/categories", async (req: Request, res: Response) => {
  try {
    const categories = await db
      .select()
      .from(aiConversationFlowSettings)
      .where(eq(aiConversationFlowSettings.isEnabled, true))
      .orderBy(asc(aiConversationFlowSettings.displayOrder));

    res.json(categories);
  } catch (error: any) {
    console.error("GET /categories error", error);
    res.status(500).json({ error: error.message || "Failed to fetch categories" });
  }
});

// Resident chat config: request settings + questions
router.get("/request-config", requireAuth, requireResident, async (req: Request, res: Response) => {
  try {
    const [settings] = await db
      .select()
      .from(requestConversationSettings)
      .orderBy(desc(requestConversationSettings.updatedAt))
      .limit(1);

    const ordinaryQuestions = await db
      .select()
      .from(requestQuestions)
      .where(and(eq(requestQuestions.mode, "ordinary"), eq(requestQuestions.isEnabled, true)))
      .orderBy(asc(requestQuestions.order));

    const aiQuestions = await db
      .select()
      .from(requestQuestions)
      .where(and(eq(requestQuestions.mode, "ai"), eq(requestQuestions.isEnabled, true)))
      .orderBy(asc(requestQuestions.order));

    res.json({
      settings: settings || null,
      ordinaryQuestions,
      aiQuestions,
    });
  } catch (error: any) {
    console.error("GET /request-config error", error);
    res.status(500).json({ error: error.message || "Failed to load request config" });
  }
});

const AiSessionStartSchema = z.object({
  categoryKey: z.string().min(1),
});

const AiSessionMessageSchema = z.object({
  text: z.string().optional(),
  images: z.array(z.string()).optional(),
});

const AiSessionMessageWithIdSchema = AiSessionMessageSchema.extend({
  sessionId: z.string().min(1),
});

function normalizeCategoryKey(value: string): string {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[\s-]+/g, "_");
}

function filterQuestionsForCategory<T extends { scope: string; categoryKey?: string | null }>(
  questions: T[],
  categoryKey: string,
): T[] {
  const normalized = normalizeCategoryKey(categoryKey);
  return questions.filter((q: any) => {
    if (q.scope === "global") return true;
    if (q.scope === "category" && q.categoryKey) {
      return normalizeCategoryKey(String(q.categoryKey)) === normalized;
    }
    return false;
  });
}

async function getResidentEstateId(userId: string | null | undefined): Promise<string | null> {
  if (!userId) return null;
  try {
    const rows = await db
      .select({ estateId: memberships.estateId })
      .from(memberships)
      .where(eq(memberships.userId, userId))
      .limit(1);
    return rows.length ? rows[0].estateId : null;
  } catch {
    return null;
  }
}

async function handleAiSessionMessage(
  req: Request,
  res: Response,
  sessionId: string,
  payload: { text?: string; images?: string[] },
) {
  try {
    const text = (payload.text || "").trim();
    const images = Array.isArray(payload.images) ? payload.images.filter(Boolean) : [];
    if (!text && images.length === 0) {
      return res.status(400).json({ error: "Message text or images are required." });
    }
    if (images.length > IMAGE_LIMITS.maxImagesPerMessage) {
      return res.status(400).json({ error: "Too many images attached." });
    }

    const [session] = await db
      .select()
      .from(aiSessions)
      .where(eq(aiSessions.id, sessionId))
      .limit(1);

    if (!session) {
      return res.status(404).json({ error: "Session not found." });
    }
    if (String(session.residentId) !== String(req.auth?.userId)) {
      return res.status(403).json({ error: "Forbidden." });
    }

    if (images.length) {
      try {
        const limitResult: any = await db.execute(sql`
          SELECT COUNT(*)::int AS count
          FROM ai_session_attachments a
          JOIN ai_sessions s ON a.session_id = s.id
          WHERE s.resident_id = ${req.auth?.userId ?? ""}
            AND a.created_at > NOW() - INTERVAL '1 hour'
        `);
        const rows = (limitResult as any)?.rows ?? limitResult ?? [];
        const used = rows?.[0]?.count ?? 0;
        const limit = 20;
        if (used + images.length > limit) {
          return res.status(429).json({ error: "Image upload limit reached. Please try again later." });
        }
      } catch {
        // If rate limit check fails, do not block the request.
      }
    }

    let validatedImages: Array<{ dataUrl: string; mimeType: string; byteSize: number }> = [];
    try {
      validatedImages = images.map((dataUrl) => {
        return {
          dataUrl,
          ...validateDataUrl(dataUrl, { maxBytes: IMAGE_LIMITS.maxImageBytes }),
        };
      });
    } catch (err: any) {
      const message = err?.message || "Invalid image data.";
      if (message.includes("size")) {
        return res.status(413).json({ error: "Image exceeds size limit." });
      }
      return res.status(400).json({ error: message });
    }

    let answerKey: string | null = null;
    const lastQuestion = await db
      .select({ meta: aiSessionMessages.meta })
      .from(aiSessionMessages)
      .where(and(eq(aiSessionMessages.sessionId, sessionId), eq(aiSessionMessages.role, "assistant")))
      .orderBy(desc(aiSessionMessages.createdAt))
      .limit(1);
    if (lastQuestion.length && lastQuestion[0]?.meta && typeof lastQuestion[0].meta === "object") {
      const meta: any = lastQuestion[0].meta;
      if (meta.questionKey) answerKey = String(meta.questionKey);
    }

    if (!answerKey && session.mode === "ordinary") {
      const ordinaryQuestions = await db
        .select()
        .from(requestQuestions)
        .where(and(eq(requestQuestions.mode, "ordinary"), eq(requestQuestions.isEnabled, true)))
        .orderBy(asc(requestQuestions.order));
      const scopedQuestions = filterQuestionsForCategory(ordinaryQuestions as any, session.categoryKey) as any[];
      const firstRequired = scopedQuestions.find((q: any) => q.required);
      if (firstRequired?.key) answerKey = String(firstRequired.key);
    }

    await db.transaction(async (tx: any) => {
      const [msg] = await tx
        .insert(aiSessionMessages)
        .values({
          sessionId,
          role: "user",
          content: text || "[image]",
          meta: {
            answerKey,
            imagesCount: validatedImages.length || 0,
          },
          createdAt: new Date(),
        })
        .returning();

      if (validatedImages.length) {
        await tx.insert(aiSessionAttachments).values(
          validatedImages.map((img) => ({
            sessionId,
            messageId: msg?.id ?? null,
            type: "image",
            dataUrl: img.dataUrl,
            mimeType: img.mimeType,
            byteSize: img.byteSize,
            createdAt: new Date(),
          })),
        );
      }
    });

    if (session.mode === "ordinary") {
      const ordinaryQuestions = await db
        .select()
        .from(requestQuestions)
        .where(and(eq(requestQuestions.mode, "ordinary"), eq(requestQuestions.isEnabled, true)))
        .orderBy(asc(requestQuestions.order));
      const scopedQuestions = filterQuestionsForCategory(ordinaryQuestions as any, session.categoryKey);

      const allMessages = await db
        .select()
        .from(aiSessionMessages)
        .where(eq(aiSessionMessages.sessionId, sessionId))
        .orderBy(asc(aiSessionMessages.createdAt));

      const answeredKeys = new Set<string>();
      const answerMap: Record<string, string> = {};
      for (const msg of allMessages) {
        if (msg.role !== "user") continue;
        const meta = msg.meta as any;
        const key = meta?.answerKey ? String(meta.answerKey) : null;
        if (!key) continue;
        answeredKeys.add(key);
        answerMap[key] = msg.content;
      }

      const required = scopedQuestions.filter((q: any) => q.required);
      const missing = required.filter((q: any) => !answeredKeys.has(String(q.key)));

      let replyText = "Thanks! I have enough details to proceed.";
      let replyMeta: any = {};
      let isComplete = true;
      if (missing.length) {
        const next = missing[0] as any;
        replyText = next.label || "Please share a bit more detail.";
        replyMeta = {
          questionKey: next.key,
          questionType: next.type,
          options: next.options ?? undefined,
          required: Boolean(next.required),
        };
        isComplete = false;
      }

      const estateId = await getResidentEstateId(req.auth?.userId ?? null);
      const urgency = answerMap.urgency ? String(answerMap.urgency).toLowerCase() : null;
      const suggestedProviders = isComplete
        ? await getProviderMatches({
            category: session.categoryKey,
            estateId,
            urgency,
            limit: 3,
            userId: req.auth?.userId ?? null,
          })
        : [];

      await db.insert(aiSessionMessages).values({
        sessionId,
        role: "assistant",
        content: replyText,
        meta: replyMeta,
        createdAt: new Date(),
      });

      return res.json({
        reply: { text: replyText, meta: replyMeta },
        state: { isComplete, missingKeys: missing.map((m: any) => String(m.key)) },
        suggestedProviders: (suggestedProviders || []).map((p: any) => ({
          id: p.id,
          name: p.businessName,
          rating: p.rating,
          jobs: p.jobs,
          badges: p.badges,
        })),
      });
    }

    // AI mode
    const [settings] = await db
      .select()
      .from(requestConversationSettings)
      .orderBy(desc(requestConversationSettings.updatedAt))
      .limit(1);

    const aiQuestionsRaw = await db
      .select({
        id: requestQuestions.id,
        mode: requestQuestions.mode,
        scope: requestQuestions.scope,
        categoryKey: requestQuestions.categoryKey,
        key: requestQuestions.key,
        label: requestQuestions.label,
        type: requestQuestions.type,
        required: requestQuestions.required,
        options: requestQuestions.options,
        order: requestQuestions.order,
        isEnabled: requestQuestions.isEnabled,
      })
      .from(requestQuestions)
      .where(and(eq(requestQuestions.mode, "ai"), eq(requestQuestions.isEnabled, true)))
      .orderBy(asc(requestQuestions.order));

    const provider = settings?.aiProvider ?? "gemini";
    const category = session.categoryKey;
    const scopedAiQuestions = filterQuestionsForCategory(aiQuestionsRaw as any, category);

    const historyRows = await db
      .select()
      .from(aiSessionMessages)
      .where(eq(aiSessionMessages.sessionId, sessionId))
      .orderBy(asc(aiSessionMessages.createdAt));

    const history = historyRows
      .filter((m: any) => m.role === "user" || m.role === "assistant")
      .map((m: any) => ({
        type: m.role === "user" ? "user_text" : "ai_message",
        text: m.content,
      }))
      .slice(-6);

    const estateId = await getResidentEstateId(req.auth?.userId ?? null);
    const providers = await getProviderMatches({
      category,
      estateId,
      urgency: null,
      limit: 3,
      userId: req.auth?.userId ?? null,
    });

    const PROVIDERS_CONTEXT = providers.map((p) => ({
      id: p.id,
      name: p.businessName,
      rating: p.rating,
      jobs: p.jobs,
      badges: p.badges,
    }));

    const summaryLines = history
      .slice(-4)
      .map((msg: any) => `${msg.type === "user_text" ? "User" : "Assistant"}: ${msg.text}`)
      .join("\n");

    const CATEGORY_GUIDANCE: Record<string, string> = {
      carpenter:
        "Ask about item type (chair, table), dimensions, material/wood preference, finish (paint/varnish), and timeline. Recommend booking a provider if user is beginner.",
      plumbing:
        "Ask leak location, whether water is off, severity, and access. If emergency, advise shutoff and urgent provider.",
      electrical:
        "Ask breaker status, smell/sparks, what stopped working, and safety. If sparks/burning smell, urgent provider.",
    };

    const guidance =
      CATEGORY_GUIDANCE[String(category || "").toLowerCase()] ||
      "Ask clarifying questions relevant to the category.";

    const baseSystem = `
You are CityBuddy for CityConnect.
Return VALID JSON ONLY. No markdown. No extra text.

Schema:
{
  "intent": "clarify" | "create_request" | "recommend_provider",
  "message": string,
  "followUpQuestions": Array<{
    "key": string,
    "label": string,
    "type": "text" | "textarea" | "select" | "date" | "datetime" | "urgency" | "estate" | "multi_image",
    "options"?: string[],
    "required": boolean
  }>,
  "extracted": {
    "urgency": "low" | "medium" | "high" | "emergency" | null,
    "estateId": string | null,
    "inspectionDate": string | null
  },
  "recommendedProviderIds": string[],
  "confidence": number
}

Rules:
- Be category-specific and practical.
- Ask 1-3 follow-up questions if key info is missing.
- Only recommend providers if enough info is collected.
- If images are attached, acknowledge them but DO NOT claim you can see them unless the context explicitly contains an "imageAnalysis" result.
- Keep "message" natural and helpful (2-4 sentences).
`.trim();

    const SYSTEM = settings?.aiSystemPrompt
      ? `${baseSystem}\n\n${settings.aiSystemPrompt}`.trim()
      : baseSystem;

    const USER = `
CONTEXT:
- category: ${category}
- categoryGuidance: ${guidance}
- slots: ${JSON.stringify({ estateId })}
- imagesAttached: ${images.length}
- providerCandidates: ${JSON.stringify(PROVIDERS_CONTEXT)}
- requiredQuestions: ${JSON.stringify(scopedAiQuestions)}
- conversationSummary: ${summaryLines || "N/A"}

CHAT_HISTORY:
${JSON.stringify(history)}
`.trim();

    let raw = "";
    if (provider === "ollama") {
      try {
        const out = await ollamaChat({
          model: settings?.aiModel || process.env.OLLAMA_MODEL,
          temperature: typeof settings?.aiTemperature === "number" ? settings.aiTemperature : 0.2,
          messages: [
            { role: "system", content: SYSTEM },
            { role: "user", content: USER },
          ],
        });
        raw = out?.message?.content || "";
      } catch (error: any) {
        const msg = error?.message || "Failed to reach Ollama";
        return res.status(502).json({
          error: msg,
          hint: "Ensure Ollama is running and OLLAMA_BASE_URL/OLLAMA_MODEL are correct.",
        });
      }
    } else if (provider === "gemini") {
      const model = settings?.aiModel || process.env.GEMINI_MODEL || "gemini-1.5-flash";
      const result = await generateGeminiContent(model, `${SYSTEM}\n\n${USER}`);
      raw = result.text || "";
    } else if (provider === "openai") {
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        return res.status(400).json({ error: "OpenAI API key is not configured." });
      }
      const model = settings?.aiModel || process.env.OPENAI_MODEL || "gpt-4o-mini";
      const temperature = typeof settings?.aiTemperature === "number" ? settings.aiTemperature : 0.2;
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          temperature,
          messages: [
            { role: "system", content: SYSTEM },
            { role: "user", content: USER },
          ],
        }),
      });

      if (!response.ok) {
        const text2 = await response.text();
        return res.status(502).json({ error: text2 || "Failed to reach OpenAI" });
      }
      const json = await response.json();
      raw = json?.choices?.[0]?.message?.content || "";
    } else {
      return res.status(400).json({ error: "AI provider is not supported." });
    }

    const parsedJson = safeParseJsonFromText(raw) as any;
    const followUps = Array.isArray(parsedJson?.followUpQuestions) ? parsedJson.followUpQuestions : [];
    const replyText = parsedJson?.message || "Here's what I recommend next.";
    const missingKeys = followUps.map((q: any) => String(q?.key || "")).filter(Boolean);

    await db.insert(aiSessionMessages).values({
      sessionId,
      role: "assistant",
      content: replyText,
      meta: parsedJson,
      createdAt: new Date(),
    });

    return res.json({
      reply: { text: replyText, meta: parsedJson },
      state: { isComplete: missingKeys.length === 0, missingKeys },
      suggestedProviders: PROVIDERS_CONTEXT,
    });
  } catch (error: any) {
    console.error("POST /ai/session/:id/message error", error);
    if (error?.issues) {
      return res.status(400).json({ error: "Validation error", details: error.issues });
    }
    res.status(500).json({ error: error.message || "Failed to process AI session message" });
  }
}

router.post("/ai/session/start", requireAuth, requireResident, async (req: Request, res: Response) => {
  try {
    const parsed = AiSessionStartSchema.parse(req.body || {});
    const [settings] = await db
      .select()
      .from(requestConversationSettings)
      .orderBy(desc(requestConversationSettings.updatedAt))
      .limit(1);
    const mode = settings?.mode ?? "ai";
    const normalizedCategoryKey = normalizeCategoryKey(parsed.categoryKey);
    const [session] = await db
      .insert(aiSessions)
      .values({
        residentId: req.auth?.userId ?? null,
        categoryKey: normalizedCategoryKey,
        mode,
        status: "active",
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    let greetingText = "";
    let greetingMeta: any = null;
    try {
      const questions = await db
        .select()
        .from(requestQuestions)
        .where(and(eq(requestQuestions.mode, mode), eq(requestQuestions.isEnabled, true)))
        .orderBy(asc(requestQuestions.order));
      const scoped = filterQuestionsForCategory(questions as any, normalizedCategoryKey) as any[];
      const firstQuestion = scoped.find((q: any) => q.required) ?? scoped[0];
      if (firstQuestion) {
        greetingText = firstQuestion.label || "Tell me about the issue so I can help.";
        greetingMeta = {
          questionKey: firstQuestion.key,
          questionType: firstQuestion.type,
          options: firstQuestion.options ?? undefined,
          required: Boolean(firstQuestion.required),
        };
      } else {
        greetingText = "Tell me about the issue so I can help.";
      }
    } catch {
      greetingText = "Tell me about the issue so I can help.";
    }

    if (greetingText) {
      await db.insert(aiSessionMessages).values({
        sessionId: session.id,
        role: "assistant",
        content: greetingText,
        meta: greetingMeta,
        createdAt: new Date(),
      });
    }

    res.json({ sessionId: session.id, mode: session.mode, greeting: greetingText ? { text: greetingText, meta: greetingMeta } : null });
  } catch (error: any) {
    console.error("POST /ai/session/start error", error);
    if (error?.issues) {
      return res.status(400).json({ error: "Validation error", details: error.issues });
    }
    res.status(500).json({ error: error.message || "Failed to start AI session" });
  }
});

router.post("/ai/session/message", requireAuth, requireResident, async (req: Request, res: Response) => {
  try {
    const parsed = AiSessionMessageWithIdSchema.parse(req.body || {});
    return await handleAiSessionMessage(req, res, parsed.sessionId, {
      text: parsed.text,
      images: parsed.images,
    });
  } catch (error: any) {
    console.error("POST /ai/session/message error", error);
    if (error?.issues) {
      return res.status(400).json({ error: "Validation error", details: error.issues });
    }
    res.status(500).json({ error: error.message || "Failed to send AI message" });
  }
});

router.post("/ai/session/:sessionId/message", requireAuth, requireResident, async (req: Request, res: Response) => {
  const sessionId = String(req.params.sessionId || "");
  const parsed = AiSessionMessageSchema.parse(req.body || {});
  return handleAiSessionMessage(req, res, sessionId, parsed);
});

router.get("/ai/session/:sessionId", requireAuth, requireResident, async (req: Request, res: Response) => {
  try {
    const sessionId = String(req.params.sessionId || "");
    const [session] = await db
      .select()
      .from(aiSessions)
      .where(eq(aiSessions.id, sessionId))
      .limit(1);

    if (!session) {
      return res.status(404).json({ error: "Session not found." });
    }
    if (String(session.residentId) !== String(req.auth?.userId)) {
      return res.status(403).json({ error: "Forbidden." });
    }

    const messages = await db
      .select()
      .from(aiSessionMessages)
      .where(eq(aiSessionMessages.sessionId, sessionId))
      .orderBy(asc(aiSessionMessages.createdAt));

    return res.json({
      sessionId: session.id,
      categoryKey: session.categoryKey,
      mode: session.mode,
      status: session.status,
      messages,
    });
  } catch (error: any) {
    console.error("GET /ai/session/:id error", error);
    res.status(500).json({ error: error.message || "Failed to load AI session" });
  }
});

router.get("/ai/session/:sessionId/attachments", requireAuth, requireResident, async (req: Request, res: Response) => {
  try {
    const sessionId = String(req.params.sessionId || "");
    const [session] = await db
      .select()
      .from(aiSessions)
      .where(eq(aiSessions.id, sessionId))
      .limit(1);
    if (!session) {
      return res.status(404).json({ error: "Session not found." });
    }
    if (String(session.residentId) !== String(req.auth?.userId)) {
      return res.status(403).json({ error: "Forbidden." });
    }

    const attachments = await db
      .select({
        id: aiSessionAttachments.id,
        messageId: aiSessionAttachments.messageId,
        mimeType: aiSessionAttachments.mimeType,
        byteSize: aiSessionAttachments.byteSize,
        createdAt: aiSessionAttachments.createdAt,
      })
      .from(aiSessionAttachments)
      .where(eq(aiSessionAttachments.sessionId, sessionId))
      .orderBy(asc(aiSessionAttachments.createdAt));

    return res.json({ attachments });
  } catch (error: any) {
    console.error("GET /ai/session/:id/attachments error", error);
    res.status(500).json({ error: error.message || "Failed to load attachments" });
  }
});

router.get(
  "/ai/session/:sessionId/attachments/:attachmentId",
  requireAuth,
  requireResident,
  async (req: Request, res: Response) => {
    try {
      const sessionId = String(req.params.sessionId || "");
      const attachmentId = String(req.params.attachmentId || "");
      const [session] = await db
        .select()
        .from(aiSessions)
        .where(eq(aiSessions.id, sessionId))
        .limit(1);
      if (!session) {
        return res.status(404).json({ error: "Session not found." });
      }
      if (String(session.residentId) !== String(req.auth?.userId)) {
        return res.status(403).json({ error: "Forbidden." });
      }

      const [attachment] = await db
        .select({
          id: aiSessionAttachments.id,
          dataUrl: aiSessionAttachments.dataUrl,
        })
        .from(aiSessionAttachments)
        .where(and(eq(aiSessionAttachments.sessionId, sessionId), eq(aiSessionAttachments.id, attachmentId)))
        .limit(1);

      if (!attachment) {
        return res.status(404).json({ error: "Attachment not found." });
      }

      return res.json({ dataUrl: attachment.dataUrl });
    } catch (error: any) {
      console.error("GET /ai/session/:id/attachments/:attachmentId error", error);
      res.status(500).json({ error: error.message || "Failed to load attachment" });
    }
  },
);

// Centralized AI router (Gemini/Ollama/OpenAI)
router.post("/ai/chat", requireAuth, requireResident, async (req: Request, res: Response) => {
  const endpointStartTime = Date.now();
  const requestSize = JSON.stringify(req.body).length;
  console.log(`\n[AI CHAT] 🎯 New AI chat request received`);
  console.log(`[AI CHAT] Request size: ${requestSize} chars`);
  console.log(`[AI CHAT] User: ${req.auth?.userId ?? "unknown"}`);
  
  try {
    const bodySchema = z.object({
      category: z.string().min(1),
      history: z
        .array(
          z.object({
            type: z.string(),
            text: z.string(),
          }),
        )
        .optional(),
      messages: z
        .array(
          z.object({
            role: z.string(),
            content: z.string(),
          }),
        )
        .optional(),
      slots: z.record(z.any()).optional(),
      images: z.array(z.string()).optional(),
    });
    const parseStartTime = Date.now();
    const parsed = bodySchema.parse(req.body || {});
    console.log(`[AI CHAT] ✅ Request parsed in ${Date.now() - parseStartTime}ms`);

    const dbStartTime = Date.now();
    const [settings] = await db
      .select()
      .from(requestConversationSettings)
      .orderBy(desc(requestConversationSettings.updatedAt))
      .limit(1);

    const aiQuestionsRaw = await db
      .select({
        id: requestQuestions.id,
        mode: requestQuestions.mode,
        scope: requestQuestions.scope,
        categoryKey: requestQuestions.categoryKey,
        key: requestQuestions.key,
        label: requestQuestions.label,
        type: requestQuestions.type,
        required: requestQuestions.required,
        options: requestQuestions.options,
        order: requestQuestions.order,
        isEnabled: requestQuestions.isEnabled,
      })
      .from(requestQuestions)
      .where(
        and(eq(requestQuestions.mode, "ai"), eq(requestQuestions.isEnabled, true)),
      )
      .orderBy(asc(requestQuestions.order));
    
    const dbEndTime = Date.now();
    console.log(`[AI CHAT] 🗄️  Database queries completed in ${dbEndTime - dbStartTime}ms`);

    const provider = settings?.aiProvider ?? "gemini";
    console.log(`[AI CHAT] Database settings provider: ${settings?.aiProvider}, Using: ${provider}`);
    const category = parsed.category;
    const slots = parsed.slots || {};
    const history =
      parsed.history && parsed.history.length
        ? parsed.history
        : (parsed.messages || []).map((msg) => ({
            type: msg.role === "user" ? "user_text" : "ai_message",
            text: msg.content,
          }));

    const normalizedCategory = String(category || "")
      .toLowerCase()
      .trim()
      .replace(/[\s-]+/g, "_");
    const aiQuestions = (aiQuestionsRaw || []).filter((q: any) => {
      if (q.scope === "global") return true;
      if (q.scope === "category" && q.categoryKey) {
        return String(q.categoryKey).toLowerCase() === normalizedCategory;
      }
      return false;
    });

    const CATEGORY_GUIDANCE: Record<string, string> = {
      carpenter:
        "Ask about item type (chair, table), dimensions, material/wood preference, finish (paint/varnish), and timeline. Recommend booking a provider if user is beginner.",
      plumbing:
        "Ask leak location, whether water is off, severity, and access. If emergency, advise shutoff and urgent provider.",
      electrical:
        "Ask breaker status, smell/sparks, what stopped working, and safety. If sparks/burning smell, urgent provider.",
    };

    const guidance =
      CATEGORY_GUIDANCE[String(category || "").toLowerCase()] ||
      "Ask clarifying questions relevant to the category.";

    const providers = await getProviderMatches({
      category,
      estateId: slots?.estateId ?? null,
      urgency: slots?.urgency ?? null,
      limit: 3,
      userId: req.auth?.userId ?? null,
    });

    const PROVIDERS_CONTEXT = providers.map((p) => ({
      id: p.id,
      name: p.businessName,
      rating: p.rating,
      jobs: p.jobs,
      badges: p.badges,
    }));

    const summaryLines = history
      .slice(-4)
      .map((msg) => `${msg.type === "user_text" ? "User" : "Assistant"}: ${msg.text}`)
      .join("\n");

    const baseSystem = `
You are CityBuddy for CityConnect.
Return VALID JSON ONLY. No markdown. No extra text.

Schema:
{
  "intent": "clarify" | "create_request" | "recommend_provider",
  "message": string,
  "followUpQuestions": Array<{
    "key": string,
    "label": string,
    "type": "text" | "textarea" | "select" | "date" | "datetime" | "urgency" | "estate" | "multi_image",
    "options"?: string[],
    "required": boolean
  }>,
  "extracted": {
    "urgency": "low" | "medium" | "high" | "emergency" | null,
    "estateId": string | null,
    "inspectionDate": string | null
  },
  "recommendedProviderIds": string[],
  "confidence": number
}

Rules:
- Be category-specific and practical.
- Ask 1-3 follow-up questions if key info is missing.
- Only recommend providers if enough info is collected.
- If images are attached, acknowledge them but DO NOT claim you can see them unless the context explicitly contains an "imageAnalysis" result.
- Keep "message" natural and helpful (2-4 sentences).
`.trim();

    const SYSTEM = settings?.aiSystemPrompt
      ? `${baseSystem}\n\n${settings.aiSystemPrompt}`.trim()
      : baseSystem;

    const USER = `
CONTEXT:
- category: ${category}
- categoryGuidance: ${guidance}
- slots: ${JSON.stringify(slots || {})}
- imagesAttached: ${parsed.images?.length ? parsed.images.length : 0}
- providerCandidates: ${JSON.stringify(PROVIDERS_CONTEXT)}
- requiredQuestions: ${JSON.stringify(aiQuestions)}
- conversationSummary: ${summaryLines || "N/A"}

CHAT_HISTORY:
${JSON.stringify((history || []).slice(-6))}
`.trim();

    console.log(`[AI CHAT] 📋 Prompt details:`);
    console.log(`[AI CHAT]   - System prompt size: ${SYSTEM.length} chars`);
    console.log(`[AI CHAT]   - User prompt size: ${USER.length} chars`);
    console.log(`[AI CHAT]   - Total prompt size: ${SYSTEM.length + USER.length} chars`);
    console.log(`[AI CHAT]   - History items: ${history.length}`);
    console.log(`[AI CHAT]   - Category: ${category}`);

    let raw = "";
    console.log(`[AI CHAT] 🤖 Using provider: ${provider} | Model: ${provider === "ollama" ? (settings?.aiModel || process.env.OLLAMA_MODEL) : "N/A"}`);
    
    const aiProviderStartTime = Date.now();
    if (provider === "ollama") {
      try {
        console.log(`[AI CHAT] ⏳ Waiting for Ollama response...`);
        const out = await ollamaChat({
          model: settings?.aiModel || process.env.OLLAMA_MODEL,
          temperature: typeof settings?.aiTemperature === "number" ? settings.aiTemperature : 0.2,
          messages: [
            { role: "system", content: SYSTEM },
            { role: "user", content: USER },
          ],
        });
        raw = out?.message?.content || "";
        const providerTime = Date.now() - aiProviderStartTime;
        console.log(`[AI CHAT] ✅ Ollama response received in ${providerTime}ms (${raw.length} chars)`);
      } catch (error: any) {
        const msg = error?.message || "Failed to reach Ollama";
        return res.status(502).json({
          error: msg,
          hint: "Ensure Ollama is running and OLLAMA_BASE_URL/OLLAMA_MODEL are correct.",
        });
      }
    } else if (provider === "gemini") {
      const model = settings?.aiModel || process.env.GEMINI_MODEL || "gemini-1.5-flash";
      console.log(`[AI CHAT] ⏳ Waiting for Gemini response (model: ${model})...`);
      const result = await generateGeminiContent(model, `${SYSTEM}\n\n${USER}`);
      raw = result.text || "";
      const providerTime = Date.now() - aiProviderStartTime;
      console.log(`[AI CHAT] ✅ Gemini response received in ${providerTime}ms`);
    } else if (provider === "openai") {
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        return res.status(400).json({ error: "OpenAI API key is not configured." });
      }
      const model = settings?.aiModel || process.env.OPENAI_MODEL || "gpt-4o-mini";
      const temperature = typeof settings?.aiTemperature === "number" ? settings.aiTemperature : 0.2;
      console.log(`[AI CHAT] ⏳ Waiting for OpenAI response (model: ${model})...`);
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          temperature,
          messages: [
            { role: "system", content: SYSTEM },
            { role: "user", content: USER },
          ],
        }),
      });

      if (!response.ok) {
        const text = await response.text();
        return res.status(502).json({ error: text || "Failed to reach OpenAI" });
      }
      const json = await response.json();
      raw = json?.choices?.[0]?.message?.content || "";
      const providerTime = Date.now() - aiProviderStartTime;
      console.log(`[AI CHAT] ✅ OpenAI response received in ${providerTime}ms`);
    } else {
      return res.status(400).json({ error: "AI provider is not supported." });
    }

    const jsonParseStartTime = Date.now();
    const parsedJson = safeParseJsonFromText(raw);
    console.log(`[AI CHAT] 📦 JSON parsing took ${Date.now() - jsonParseStartTime}ms`);
    
    const totalTime = Date.now() - endpointStartTime;
    console.log(`[AI CHAT] 🎉 Request completed in ${totalTime}ms`);
    console.log(`[AI CHAT] ⏱️  Breakdown: DB=${(dbEndTime - dbStartTime)}ms, AI Provider=${(Date.now() - aiProviderStartTime)}ms, Total=${totalTime}ms\n`);
    
    res.json(parsedJson);
  } catch (error: any) {
    console.error("POST /ai/chat error", error);
    if (error?.issues) {
      return res.status(400).json({ error: "Validation error", details: error.issues });
    }
    res.status(500).json({ error: error.message || "Failed to process AI chat" });
  }
});

// Create a service request - requires authentication
router.post("/service-requests", requireAuth, async (req: Request, res: Response) => {
  try {
    // Get user ID from JWT auth
    const userId = req.auth?.userId;
    if (!userId) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const parsed = ResidentServiceRequestSchema.parse(req.body || {});
    const user = await storage.getUser(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Get user's estate if they have one
    let userEstateId: string | null = null;
    try {
      const userMemberships = await db
        .select({ estateId: memberships.estateId })
        .from(memberships)
        .where(eq(memberships.userId, userId))
        .limit(1);
      if (userMemberships.length > 0) {
        userEstateId = userMemberships[0].estateId;
      }
    } catch (e) {
      // silently fail if memberships table doesn't exist or query fails
    }

    const payload = insertServiceRequestSchema.parse({
      category: parsed.category,
      description: parsed.description,
      residentId: userId,
      urgency: parsed.urgency,
      status: "pending",
      budget: parsed.budget || "Not provided",
      location: parsed.location || user.location || "Not specified",
      latitude: parsed.latitude ?? null,
      longitude: parsed.longitude ?? null,
      preferredTime: parsed.preferredTime
        ? new Date(parsed.preferredTime)
        : null,
      specialInstructions: parsed.specialInstructions || null,
      estateId: userEstateId || undefined,
    });

    const created = await storage.createServiceRequest(payload);
    
    // Broadcast new service request to SSE clients (for admin dashboard real-time updates)
    try {
      // @ts-ignore
      if (global.__serviceRequestSseClients && Array.isArray(global.__serviceRequestSseClients)) {
        const ssePayload = { type: "created", request: created };
        const data = JSON.stringify(ssePayload);
        // @ts-ignore
        for (const c of global.__serviceRequestSseClients) {
          try {
            c.res.write(`event: service-request\n`);
            c.res.write(`data: ${data}\n\n`);
          } catch (e) {
            // ignore
          }
        }
      }
    } catch (e) {
      console.error("Failed to broadcast service-request created event", e);
    }
    
    res.status(201).json(created);
  } catch (error: any) {
    if (error?.issues) {
      return res.status(400).json({
        error: "Validation error",
        details: error.issues.map((issue: any) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      });
    }
    console.error("POST /service-requests error", error);
    res.status(500).json({ error: error.message || "Failed to create service request" });
  }
});

// Get user's own service requests
router.get("/service-requests/mine", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.auth?.userId;
    if (!userId) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const all = await storage.getAllServiceRequests();
    const mine = all.filter((r: any) => r.residentId === userId);

    console.log(`[app] /service-requests/mine -> userId=${userId} count=${mine.length}`);
    return res.json(mine);
  } catch (e: any) {
    console.error("GET /service-requests/mine error", e);
    res.status(500).json({ error: e.message });
  }
});

// Conversation endpoints (resident only)
router.get("/conversations/mine", requireAuth, requireResident, async (req: Request, res: Response) => {
  try {
    const userId = req.auth?.userId;
    if (!userId) return res.status(401).json({ error: "Authentication required" });

    const category = (req.query.category || "").toString().trim();
    let query = db
      .select({
        id: conversations.id,
        category: conversations.category,
        status: conversations.status,
        createdAt: conversations.createdAt,
        updatedAt: conversations.updatedAt,
      })
      .from(conversations)
      .where(eq(conversations.residentId, userId));

    if (category) {
      query = query.where(and(eq(conversations.residentId, userId), eq(conversations.category, category)));
    }

    const rows = await query.orderBy(desc(conversations.updatedAt));
    res.json(rows);
  } catch (error: any) {
    console.error("GET /conversations/mine error", error);
    res.status(500).json({ error: error.message || "Failed to load conversations" });
  }
});

router.post("/conversations", requireAuth, requireResident, async (req: Request, res: Response) => {
  try {
    const userId = req.auth?.userId;
    if (!userId) return res.status(401).json({ error: "Authentication required" });

    const parsed = ConversationCreateSchema.parse(req.body || {});
    const existing = await db
      .select()
      .from(conversations)
      .where(and(
        eq(conversations.residentId, userId),
        eq(conversations.category, parsed.category),
        eq(conversations.status, "active"),
      ))
      .limit(1);

    if (existing.length > 0 && !parsed.forceNew) return res.json(existing[0]);
    if (existing.length > 0 && parsed.forceNew) {
      await db
        .update(conversations)
        .set({ status: "closed", updatedAt: new Date() })
        .where(eq(conversations.id, existing[0].id));
    }

    const inserted = await db
      .insert(conversations)
      .values({
        residentId: userId,
        category: parsed.category,
        status: "active",
      })
      .returning();

    return res.status(201).json(inserted[0]);
  } catch (error: any) {
    if (error?.issues) {
      return res.status(400).json({ error: "Validation error", details: error.issues });
    }
    console.error("POST /conversations error", error);
    res.status(500).json({ error: error.message || "Failed to create conversation" });
  }
});

router.get("/conversations/:conversationId/messages", requireAuth, requireResident, async (req: Request, res: Response) => {
  try {
    const userId = req.auth?.userId;
    if (!userId) return res.status(401).json({ error: "Authentication required" });

    const conversationId = req.params.conversationId;
    const convo = await db
      .select()
      .from(conversations)
      .where(eq(conversations.id, conversationId))
      .limit(1);

    if (convo.length === 0) return res.status(404).json({ error: "Conversation not found" });
    if (convo[0].residentId !== userId) return res.status(403).json({ error: "Forbidden" });

    const rows = await db
      .select()
      .from(conversationMessages)
      .where(eq(conversationMessages.conversationId, conversationId))
      .orderBy(asc(conversationMessages.createdAt));

    res.json(rows);
  } catch (error: any) {
    console.error("GET /conversations/:id/messages error", error);
    res.status(500).json({ error: error.message || "Failed to load messages" });
  }
});

router.post("/conversations/:conversationId/messages", requireAuth, requireResident, async (req: Request, res: Response) => {
  try {
    const userId = req.auth?.userId;
    if (!userId) return res.status(401).json({ error: "Authentication required" });

    const conversationId = req.params.conversationId;
    const convo = await db
      .select()
      .from(conversations)
      .where(eq(conversations.id, conversationId))
      .limit(1);

    if (convo.length === 0) return res.status(404).json({ error: "Conversation not found" });
    if (convo[0].residentId !== userId) return res.status(403).json({ error: "Forbidden" });

    const parsed = ConversationMessageSchema.parse(req.body || {});
    const inserted = await db
      .insert(conversationMessages)
      .values({
        conversationId,
        role: parsed.role,
        type: parsed.type || "text",
        content: parsed.content,
        meta: parsed.meta ?? null,
      })
      .returning();

    await db
      .update(conversations)
      .set({ updatedAt: new Date() })
      .where(eq(conversations.id, conversationId));

    res.status(201).json(inserted[0]);
  } catch (error: any) {
    if (error?.issues) {
      return res.status(400).json({ error: "Validation error", details: error.issues });
    }
    console.error("POST /conversations/:id/messages error", error);
    res.status(500).json({ error: error.message || "Failed to save message" });
  }
});

router.patch("/conversations/:conversationId", requireAuth, requireResident, async (req: Request, res: Response) => {
  try {
    const userId = req.auth?.userId;
    if (!userId) return res.status(401).json({ error: "Authentication required" });

    const conversationId = req.params.conversationId;
    const convo = await db
      .select()
      .from(conversations)
      .where(eq(conversations.id, conversationId))
      .limit(1);

    if (convo.length === 0) return res.status(404).json({ error: "Conversation not found" });
    if (convo[0].residentId !== userId) return res.status(403).json({ error: "Forbidden" });

    const parsed = ConversationUpdateSchema.parse(req.body || {});
    const updated = await db
      .update(conversations)
      .set({ status: parsed.status, updatedAt: new Date() })
      .where(eq(conversations.id, conversationId))
      .returning();

    res.json(updated[0]);
  } catch (error: any) {
    if (error?.issues) {
      return res.status(400).json({ error: "Validation error", details: error.issues });
    }
    console.error("PATCH /conversations/:id error", error);
    res.status(500).json({ error: error.message || "Failed to update conversation" });
  }
});

// Get single service request
router.get("/service-requests/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.auth?.userId;
    if (!userId) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const all = await storage.getAllServiceRequests();
    const row = all.find((r: any) => r.id === req.params.id);
    if (!row) return res.status(404).json({ error: "Not found" });
    if (row.residentId !== userId) return res.status(403).json({ error: "Forbidden" });

    return res.json(row);
  } catch (e: any) {
    console.error("GET /service-requests/:id error", e);
    res.status(500).json({ error: e.message });
  }
});

// Wallet endpoints
router.get("/wallet", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.auth?.userId;
    if (!userId) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const wallet = await storage.getWalletByUserId(userId);
    if (!wallet) {
      // Create wallet with default 300 coins if not exists
      const newWallet = await storage.createWallet({
        userId,
        balance: "300",
        currency: "NGN"
      });
      return res.json({ coins: 300 });
    }

    res.json({ coins: Number(wallet.balance) });
  } catch (error: any) {
    console.error("GET /wallet error", error);
    res.status(500).json({ error: error.message });
  }
});

router.post("/wallet/spend", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.auth?.userId;
    if (!userId) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const { amount, reason } = req.body;
    if (typeof amount !== "number" || amount !== 100) {
      return res.status(400).json({ error: "Invalid amount. Must be 100 coins." });
    }

    const wallet = await storage.getWalletByUserId(userId);
    if (!wallet) {
      return res.status(404).json({ error: "Wallet not found" });
    }

    const currentBalance = Number(wallet.balance);
    if (currentBalance < amount) {
      return res.status(400).json({ error: "Insufficient coins", coins: currentBalance });
    }

    const newBalance = currentBalance - amount;
    await storage.updateWalletBalance(userId, newBalance.toString());

    res.json({ ok: true, coins: newBalance, reason });
  } catch (error: any) {
    console.error("POST /wallet/spend error", error);
    res.status(500).json({ error: error.message });
  }
});

// Get recent service requests for resident
router.get("/service-requests/mine", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.auth?.userId;
    if (!userId) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const limit = parseInt(req.query.limit as string) || 5;
    const requests = await storage.getServiceRequestsByResident(userId);
    res.json(requests.slice(0, limit));
  } catch (error: any) {
    console.error("GET /service-requests/mine error", error);
    res.status(500).json({ error: error.message });
  }
});

// Resident dashboard stats endpoint
router.get("/dashboard/stats", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.auth?.userId;
    if (!userId) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const requests = await storage.getServiceRequestsByResident(userId);
    
    // Calculate stats from service requests
    const completedRequests = requests.filter((r: any) => r.status === "completed");
    const activeContracts = requests.filter((r: any) => 
      r.status === "in_progress" || r.status === "assigned"
    );
    const pendingRequests = requests.filter((r: any) => r.status === "pending");
    
    // Calculate change percentages (comparing last 30 days vs previous 30 days)
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
    
    const recentCompleted = completedRequests.filter((r: any) => 
      new Date(r.createdAt) >= thirtyDaysAgo
    );
    const previousCompleted = completedRequests.filter((r: any) => {
      const created = new Date(r.createdAt);
      return created >= sixtyDaysAgo && created < thirtyDaysAgo;
    });
    
    const completedChangePercent = previousCompleted.length > 0 
      ? Math.round(((recentCompleted.length - previousCompleted.length) / previousCompleted.length) * 100)
      : recentCompleted.length > 0 ? 100 : 0;

    const recentActive = activeContracts.filter((r: any) => 
      new Date(r.createdAt) >= thirtyDaysAgo
    );
    const previousActive = activeContracts.filter((r: any) => {
      const created = new Date(r.createdAt);
      return created >= sixtyDaysAgo && created < thirtyDaysAgo;
    });
    
    const contractsChangePercent = previousActive.length > 0 
      ? Math.round(((recentActive.length - previousActive.length) / previousActive.length) * 100)
      : recentActive.length > 0 ? 100 : 0;

    // Find next scheduled maintenance (pending requests with preferredTime in future)
    const scheduledMaintenance = requests
      .filter((r: any) => 
        r.status === "pending" && 
        r.preferredTime && 
        new Date(r.preferredTime) > now
      )
      .sort((a: any, b: any) => 
        new Date(a.preferredTime).getTime() - new Date(b.preferredTime).getTime()
      );

    const nextMaintenance = scheduledMaintenance.length > 0 
      ? scheduledMaintenance[0].category || "Scheduled maintenance"
      : null;
    
    const nextMaintenanceCost = scheduledMaintenance.length > 0 && scheduledMaintenance[0].budget
      ? parseFloat(scheduledMaintenance[0].budget) || null
      : null;

    res.json({
      maintenanceScheduleCount: scheduledMaintenance.length,
      nextMaintenance,
      nextMaintenanceCost,
      activeContractsCount: activeContracts.length,
      contractsChangePercent,
      completedRequestsCount: completedRequests.length,
      completedChangePercent,
      pendingRequestsCount: pendingRequests.length,
      totalRequestsCount: requests.length,
    });
  } catch (error: any) {
    console.error("GET /dashboard/stats error", error);
    res.status(500).json({ error: error.message || "Failed to load dashboard stats" });
  }
});

// Update resident profile
router.patch("/profile", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.auth?.userId;
    if (!userId) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const { firstName, lastName, email, phone, profileImage, bio, website, username } = req.body;
    
    const updates: any = {};
    if (firstName !== undefined) updates.firstName = firstName;
    if (lastName !== undefined) updates.lastName = lastName;
    if (email !== undefined) updates.email = email;
    if (phone !== undefined) updates.phone = phone;
    if (profileImage !== undefined) updates.profileImage = profileImage;
    if (bio !== undefined) updates.bio = bio;
    if (website !== undefined) updates.website = website;
    if (username !== undefined) updates.username = username;
    
    // Also update name as combined first + last
    if (firstName !== undefined || lastName !== undefined) {
      const user = await storage.getUser(userId);
      const newFirst = firstName ?? user?.firstName ?? "";
      const newLast = lastName ?? user?.lastName ?? "";
      updates.name = `${newFirst} ${newLast}`.trim();
    }

    const updated = await storage.updateUser(userId, updates);
    if (!updated) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({
      id: updated.id,
      firstName: updated.firstName,
      lastName: updated.lastName,
      name: updated.name,
      email: updated.email,
      phone: updated.phone,
      profileImage: (updated as any).profileImage ?? null,
    });
  } catch (error: any) {
    console.error("PATCH /profile error", error);
    res.status(500).json({ error: error.message || "Failed to update profile" });
  }
});

// Get resident profile
router.get("/profile", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.auth?.userId;
    if (!userId) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const user = await storage.getUser(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      name: user.name,
      email: user.email,
      phone: user.phone,
      location: user.location,
      profileImage: (user as any).profileImage ?? null,
      role: user.role,
    });
  } catch (error: any) {
    console.error("GET /profile error", error);
    res.status(500).json({ error: error.message || "Failed to load profile" });
  }
});

export default router;
