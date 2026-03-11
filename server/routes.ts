import type { Express } from "express";
import { createServer, type Server } from "http";
import { Server as SocketIOServer } from "socket.io";
import { z } from "zod";
import { setupAuth } from "./auth";
import { storage } from "./storage";
import { db } from "./db";
import {
  users,
  serviceRequests,
  insertServiceRequestSchema,
  estates,
  insertEstateSchema,
  auditLogs,
  memberships,
  insertMembershipSchema,
  categories,
  insertCategorySchema,
  stores,
  itemCategories,
  marketplaceItems,
  cityMartBanners,
  transactions,
  companies,
  providerRequests,
  aiPreparedRequests,
  pricingRules,
  providerMatchingSettings,
  orders,
  storeMembers,
  notifications,
  storeEstates,
  aiConversationFlowSettings,
  requestConversationSettings,
  requestQuestions,
  parentOrders,
} from "@shared/schema";
import appRoutes from "./app-routes";
import providerRoutes from "./provider-routes";
import marketplaceRoutes from "./marketplace-routes";
import { createHash, randomBytes, scrypt } from "crypto";
import { promisify } from "util";
import { and, count, desc, eq, ilike, inArray, or, sum, sql, gte, lte, isNotNull, isNull, asc } from "drizzle-orm";
import {
  createMarketplaceItemSchema,
  createProviderSchema,
  providerRequestSchema,
  updateMarketplaceItemSchema,
} from "@shared/admin-schema";
import { TransactionStatus, TransactionType } from "@prisma/client";
import type { Transaction as PrismaTransaction } from "@prisma/client";
import { Prisma } from "@prisma/client";
import {
  createPendingPaystackTransaction,
  verifyAndFinalizePaystackCharge,
} from "./payments";
import { validatePaystackSignature, verifyPaystackTransaction } from "./paystack";
import { initializePaystackTransaction } from "./paystackService";
import { normalizeCategoryKey, resolveServiceRequestCategory } from "./serviceCategoryResolver";
import {
  handlePaystackVerify,
  handlePaystackWebhook,
} from "./paystackHandlers";
import {
  requireAuth,
  requireResident,
  requireSuperAdmin,
  ensureDevAuth,
} from "./auth-middleware";

import { verifyOpenAI, getDiagnosisModel } from "./openaiClient";
import * as ai from "./ai";
import { runDiagnosis, GEMINI_FALLBACK_DIAGNOSIS, GEMINI_SAFETY_FALLBACK, getGeminiModel } from "./ai/diagnose";
import { generateGeminiContent } from "./ai/geminiClient";
import { ollamaChat } from "./ai/ollama";

function membershipIsActive(membership: { isActive?: boolean | null; status?: string | null } | undefined) {
  if (!membership) return false;
  const isActiveFlag = membership.isActive ?? true;
  if (!isActiveFlag) return false;
  const status = (membership.status ?? "").toLowerCase();
  if (status && status !== "active") return false;
  return status === "active" || status === "";
}

const isAdminOrSuper = (req: Express["request"]) => {
  const auth = ensureDevAuth(req as any);
  if (!auth) return false;

  return (
    auth.role === "admin" ||
    auth.role === "super_admin" ||
    auth.globalRole === "super_admin"
  );
};

const resolveCompanyForUser = async (userId?: string | null) => {
  if (!userId) return null;
  const user = await storage.getUser(userId).catch(() => undefined);
  const companyValue = String(user?.company || "").trim();

  if (companyValue) {
    const [byId] = await db
      .select()
      .from(companies)
      .where(eq(companies.id, companyValue))
      .limit(1 as any);
    if (byId) return byId;

    const [byName] = await db
      .select()
      .from(companies)
      .where(eq(companies.name, companyValue))
      .limit(1 as any);
    if (byName) return byName;
  }

  const [byOwner] = await db
    .select()
    .from(companies)
    .where(eq(companies.providerId, userId))
    .limit(1 as any);
  if (byOwner) return byOwner;

  return null;
};

const resolveCompanyAccess = async (req: Express["request"]) => {
  const userId = req.auth?.userId ?? req.user?.id;
  if (!userId) {
    return { userId: null, company: null, isOwner: false };
  }

  const company = await resolveCompanyForUser(userId);
  const isOwner = Boolean(company && company.providerId === userId);
  return { userId, company, isOwner };
};

const SERVICE_REQUEST_STATUS_KEYS = new Set([
  "pending",
  "pending_inspection",
  "assigned",
  "assigned_for_job",
  "in_progress",
  "completed",
  "cancelled",
]);

function normalizeServiceRequestStatusKey(value: unknown) {
  return String(value || "")
    .toLowerCase()
    .replace(/[\s-]+/g, "_")
    .trim();
}

const ConsultancyReportPayloadSchema = z.object({
  inspectionDate: z.string().min(1),
  actualIssue: z.string().trim().min(3).max(2000),
  causeOfIssue: z.string().trim().min(3).max(2000),
  materialCost: z.preprocess((val) => Number(val), z.number().min(0)),
  serviceCost: z.preprocess((val) => Number(val), z.number().min(0)),
  preventiveRecommendation: z.string().trim().min(3).max(2000),
});

// Accept flexible inputs, normalize output types
const CreateServiceRequest = insertServiceRequestSchema.extend({
  preferredTime: z
    .union([
      z.string().datetime().optional(),
      z.string().optional(),
      z.number().optional(),
      z.date().optional(),
      z.null().optional(),
    ])
    .transform((v) => {
      if (v == null || v === "") return null;
      const d = v instanceof Date ? v : new Date(v as any);
      return isNaN(d.getTime()) ? null : d;
    }),
  budget: z
    .preprocess(
      (v) => (v === undefined || v === null || v === "" ? "0" : v),
      z.union([z.string(), z.number()])
    )
    .transform((v) => (typeof v === "number" ? String(v) : v)),
});

const AIDiagnosisRequestSchema = z.object({
  category: z.string().min(1, "Category is required"),
  description: z.string().min(10, "Description must be at least 10 characters"),
  urgency: z.enum(["low", "medium", "high", "emergency"]).optional(),
  specialInstructions: z.string().optional(),
});

const AIDescriptionValidationRequestSchema = z.object({
  category: z.string().optional(),
  description: z.string().min(5, "Description is required").max(2000),
});

const AIDescriptionValidationResponseSchema = z.object({
  valid: z.boolean(),
  reason: z.string().default(""),
  improvedPrompt: z.string().default(""),
  suggestedRewriteExamples: z.array(z.string()).default([]),
});

export const AIDiagnosisResponseSchema = z.object({
  summary: z.string(),
  probableCauses: z
    .array(
      z.object({
        cause: z.string(),
        likelihood: z.enum(["low", "medium", "high"]),
      })
    )
    .default([]),
  severity: z.enum(["low", "medium", "high", "critical"]),
  shouldAvoidDIY: z.boolean(),
  safetyNotes: z.array(z.string()).default([]),
  suggestedChecks: z.array(z.string()).default([]),
  whenToCallPro: z.string(),
  suggestedCategory: z.string().nullable(),
});

const AiDiagnosisSchema = {
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
} as const;

const RequestConfigSettingsSchema = z.object({
  mode: z.enum(["ai", "ordinary"]).optional(),
  aiProvider: z.enum(["gemini", "ollama", "openai"]).optional(),
  aiModel: z.string().nullable().optional(),
  aiTemperature: z.number().nullable().optional(),
  aiSystemPrompt: z.string().nullable().optional(),
  ordinaryPresentation: z.enum(["chat", "form"]).optional(),
  adminWaitThresholdMs: z.number().int().positive().nullable().optional(),
});

const RequestQuestionSchema = z.object({
  mode: z.enum(["ai", "ordinary"]),
  scope: z.enum(["global", "category"]).optional(),
  categoryKey: z.string().nullable().optional(),
  key: z.string().min(1),
  label: z.string().min(1),
  type: z.enum([
    "text",
    "textarea",
    "select",
    "date",
    "datetime",
    "estate",
    "urgency",
    "image",
    "multi_image",
  ]),
  required: z.boolean().optional(),
  options: z.any().optional(),
  order: z.number().optional(),
  isEnabled: z.boolean().optional(),
});

export async function registerRoutes(app: Express): Promise<Server> {
  // Debug endpoint (DEV ONLY): check Paystack secret key loading
  app.get("/api/debug/paystack-key", (req, res) => {
    const key = process.env.PAYSTACK_SECRET_KEY || "";
    const masked = key.length > 14 ? `${key.slice(0, 10)}...${key.slice(-4)}` : "[NOT SET]";
    res.json({
      keyLoaded: !!key,
      masked,
      length: key.length,
      envFileCheck: "Check .env.local in repo root",
    });
  });

  // Debug endpoint: check OpenAI configuration and basic access
  app.get("/api/debug/ai-health", async (_req, res) => {
    try {
      const result = await verifyOpenAI();
      res.json({ ok: result.ok, model: result.model, output: result.output ?? null, error: result.ok ? undefined : result.error });
    } catch (error: any) {
      res.status(500).json({ ok: false, model: getDiagnosisModel(), error: error?.message || String(error) });
    }
  });

  app.use("/api/app", appRoutes);
  app.use("/api/provider", providerRoutes);
  app.use("/api/marketplace", marketplaceRoutes);

  const emitServiceRequestUpdate = (
    expressApp: { get: (name: string) => unknown },
    serviceRequest: { id?: string; residentId?: string | null; providerId?: string | null } | null | undefined,
    updateType: "updated" | "assigned" | "advice" | "status" = "updated",
  ) => {
    if (!serviceRequest?.id) return;
    const io = expressApp.get("io") as SocketIOServer | undefined;
    if (!io) return;

    const participantIds = new Set<string>();
    if (serviceRequest.residentId) participantIds.add(serviceRequest.residentId);
    if (serviceRequest.providerId) participantIds.add(serviceRequest.providerId);

    for (const participantUserId of participantIds) {
      io.to(`user-${participantUserId}`).emit("service-request:updated", {
        type: updateType,
        requestId: serviceRequest.id,
        request: serviceRequest,
        at: new Date().toISOString(),
      });
    }
  };


  const finalizeServiceRequestAfterPayment = async (
    expressApp: { get: (name: string) => unknown },
    params: {
      serviceRequestId?: string | null;
      billedAmount?: string | number | null;
      paymentReference?: string | null;
    },
  ) => {
    const serviceRequestId = String(params.serviceRequestId || "").trim();
    if (!serviceRequestId) return null;

    const currentRequest = await storage.getServiceRequest(serviceRequestId);
    if (!currentRequest) return null;

    const currentStatus = normalizeServiceRequestStatusKey(currentRequest.status);
    const canAutoAssignForJob =
      Boolean(currentRequest.providerId) &&
      !["assigned_for_job", "in_progress", "completed", "cancelled"].includes(currentStatus);

    const updates: Record<string, unknown> = {};
    if (String(currentRequest.paymentStatus || "").toLowerCase() !== "paid") {
      updates.paymentStatus = "paid";
    }

    const billedAmountRaw = params.billedAmount;
    if (billedAmountRaw !== undefined && billedAmountRaw !== null && billedAmountRaw !== "") {
      const billedAmountNumber = Number(billedAmountRaw);
      if (Number.isFinite(billedAmountNumber) && billedAmountNumber > 0) {
        updates.billedAmount = billedAmountNumber.toString();
      }
    }

    if (canAutoAssignForJob) {
      updates.status = "assigned_for_job";
      updates.assignedAt = currentRequest.assignedAt || new Date();
      updates.approvedForJobAt = currentRequest.approvedForJobAt || new Date();
      updates.approvedForJobBy = currentRequest.approvedForJobBy || null;
    }

    if (Object.keys(updates).length === 0) {
      return currentRequest;
    }

    const updatedRequest = await storage.updateServiceRequest(serviceRequestId, updates as any);
    if (!updatedRequest) return null;

    const io = expressApp.get("io") as SocketIOServer | undefined;
    if (canAutoAssignForJob) {
      if (updatedRequest.residentId) {
        const residentNotification = await storage.createNotification({
          userId: updatedRequest.residentId,
          title: "Payment confirmed",
          message: "Payment is confirmed. Your request is now assigned for job execution.",
          type: "success",
          metadata: {
            requestId: updatedRequest.id,
            paymentReference: params.paymentReference || undefined,
            kind: "request_status",
          },
        });
        io?.to(`user-${updatedRequest.residentId}`).emit("notification:new", residentNotification);
      }

      if (updatedRequest.providerId) {
        const providerNotification = await storage.createNotification({
          userId: updatedRequest.providerId,
          title: "Job assigned after payment",
          message: "Resident payment is confirmed. You are the task owner for this job.",
          type: "info",
          metadata: {
            requestId: updatedRequest.id,
            paymentReference: params.paymentReference || undefined,
            kind: "request_status",
          },
        });
        io?.to(`user-${updatedRequest.providerId}`).emit("notification:new", providerNotification);
      }
    }

    emitServiceRequestUpdate(expressApp, updatedRequest, "status");
    return updatedRequest;
  };

  // ──────────────────────────────────────────────────────────────
  // CITYMART BANNERS ROUTES
  // ──────────────────────────────────────────────────────────────

  // Public: Get active banners
  app.get("/api/citymart/banners", async (req, res, next) => {
    try {
      const banners = await db
        .select()
        .from(cityMartBanners)
        .where(eq(cityMartBanners.isActive, true))
        .orderBy(asc(cityMartBanners.position), desc(cityMartBanners.createdAt));
      res.json(banners);
    } catch (error) {
      next(error);
    }
  });

  // Admin: List all banners (super admin only)
  app.get("/api/admin/citymart/banners", requireSuperAdmin, async (req, res, next) => {
    try {
      const banners = await db
        .select()
        .from(cityMartBanners)
        .orderBy(asc(cityMartBanners.position), desc(cityMartBanners.createdAt));
      res.json(banners);
    } catch (error) {
      next(error);
    }
  });

  // Admin: Create banner
  app.post("/api/admin/citymart/banners", requireSuperAdmin, async (req, res, next) => {
    try {
      const user = req.user as any;
      const [banner] = await db
        .insert(cityMartBanners)
        .values({
          ...req.body,
          createdBy: user?.id,
        })
        .returning();
      res.status(201).json(banner);
    } catch (error) {
      next(error);
    }
  });

  // Admin: Update banner
  app.patch("/api/admin/citymart/banners/:id", requireSuperAdmin, async (req, res, next) => {
    try {
      const { id } = req.params;
      const [updated] = await db
        .update(cityMartBanners)
        .set({ ...req.body, updatedAt: new Date() })
        .where(eq(cityMartBanners.id, id))
        .returning();
      if (!updated) return res.status(404).json({ message: "Banner not found" });
      res.json(updated);
    } catch (error) {
      next(error);
    }
  });

  // Admin: Delete banner
  app.delete("/api/admin/citymart/banners/:id", requireSuperAdmin, async (req, res, next) => {
    try {
      const { id } = req.params;
      const [deleted] = await db
        .delete(cityMartBanners)
        .where(eq(cityMartBanners.id, id))
        .returning();
      if (!deleted) return res.status(404).json({ message: "Banner not found" });
      res.json({ message: "Banner deleted", id });
    } catch (error) {
      next(error);
    }
  });

  // ──────────────────────────────────────────────────────────────

  const formatPaystackVerifySuccess = (tx?: PrismaTransaction | null) => ({
    status: "success" as const,
    serviceRequestId: tx?.serviceRequestId ?? null,
    transactionStatus: tx?.status ?? null,
  });

  // Password hashing helper (mirror of auth.ts)
  const scryptAsync = promisify(scrypt);
  async function hashPassword(password: string) {
    const salt = randomBytes(16).toString("hex");
    const buf = (await scryptAsync(password, salt, 64)) as Buffer;
    return `${buf.toString("hex")}.${salt}`;
  }

  // Service Requests Routes

  // Provider matching preview (resident-safe): a short preview list only — no assignment/booking.
  app.get("/api/providers/preview", requireAuth, async (req, res, next) => {
    try {
      const schema = z.object({
        category: z.string().min(1),
        urgency: z.string().optional(),
        limit: z
          .union([z.string(), z.number()])
          .optional()
          .transform((v) => {
            if (v == null || v === "") return 4;
            const n = typeof v === "number" ? v : Number(v);
            return Number.isFinite(n) ? Math.max(2, Math.min(4, Math.floor(n))) : 4;
          }),
        estateId: z.string().optional(),
      });

      const parsed = schema.parse(req.query);

      const requestedEstateId = typeof parsed.estateId === "string" && parsed.estateId.trim() ? parsed.estateId.trim() : undefined;
      let activeEstateId = requestedEstateId;
      if (!activeEstateId) {
        const membershipsForUser = await storage.getMembershipsForUser(req.auth!.userId);
        const primary = membershipsForUser.find((m) => m.isPrimary && m.isActive && m.status === "active");
        activeEstateId = primary?.estateId;
      }

      const providers = await storage.getProviders({
        approved: true,
        category: parsed.category,
      });

      const verifiedProviders = (providers || []).filter((p: any) => p?.isActive !== false && p?.isApproved === true);
      const providerIds = verifiedProviders.map((p: any) => p.id).filter(Boolean);

      if (providerIds.length === 0) {
        return res.json({
          providers: [],
          usedEstateId: activeEstateId ?? null,
          estateSpecificCount: 0,
        });
      }

      const completedJobRows = await db
        .select({ providerId: serviceRequests.providerId, completedJobs: count() })
        .from(serviceRequests)
        .where(and(inArray(serviceRequests.providerId, providerIds as any), eq(serviceRequests.status, "completed")))
        .groupBy(serviceRequests.providerId);

      const completedJobsByProvider = new Map<string, number>();
      for (const r of completedJobRows) {
        const pid = (r as any).providerId as string | null;
        if (!pid) continue;
        completedJobsByProvider.set(pid, Number((r as any).completedJobs ?? 0));
      }

      let estateMatchedIds = new Set<string>();
      if (activeEstateId) {
        const membershipRows = await db
          .select({ userId: memberships.userId })
          .from(memberships)
          .where(
            and(
              eq(memberships.estateId, activeEstateId),
              eq(memberships.isActive, true),
              eq(memberships.status, "active"),
              inArray(memberships.userId, providerIds as any),
            ),
          );
        estateMatchedIds = new Set(membershipRows.map((m: { userId: string }) => m.userId));
      }

      const preview = verifiedProviders
        .map((p: any) => {
          const ratingNum = Number(p.rating ?? 0);
          const completedJobs = completedJobsByProvider.get(p.id) ?? 0;
          const isEstateMatch = activeEstateId ? estateMatchedIds.has(p.id) : false;

          const badges: string[] = [];
          if (isEstateMatch) badges.push("Estate recommended");
          if (ratingNum >= 4.5) badges.push("Top rated");
          if (completedJobs >= 25) badges.push("Experienced");

          const fastResponder = Boolean((p.metadata as any)?.fastResponder);
          if (fastResponder) badges.push("Fast responder");

          return {
            id: String(p.id),
            name: String(p.name ?? ""),
            serviceCategory: String(p.serviceCategory ?? parsed.category),
            rating: Number.isFinite(ratingNum) ? ratingNum : 0,
            completedJobs,
            responseTime: "Response time not available",
            location: String(p.location ?? "City-wide"),
            badges,
            verificationStatus: "Verified" as const,
            image: (p.metadata as any)?.avatarUrl ? String((p.metadata as any).avatarUrl) : undefined,
            __estateMatch: isEstateMatch,
          };
        })
        .sort((a: any, b: any) => {
          // 1) Estate proximity
          if (a.__estateMatch !== b.__estateMatch) return a.__estateMatch ? -1 : 1;
          // 2) Rating
          if (b.rating !== a.rating) return b.rating - a.rating;
          // 3) Completed jobs
          return (b.completedJobs ?? 0) - (a.completedJobs ?? 0);
        });

      const limited = preview.slice(0, parsed.limit ?? 4).map(({ __estateMatch, ...rest }: any) => rest);
      const estateSpecificCount = activeEstateId ? preview.filter((p: any) => p.__estateMatch).length : 0;

      res.json({
        providers: limited,
        usedEstateId: activeEstateId ?? null,
        estateSpecificCount,
      });
    } catch (error) {
      next(error);
    }
  });

  // Provider availability (resident-only) - stable contract for chat recommendations
  app.get("/api/providers/available", requireAuth, requireResident, async (req, res, next) => {
    try {
      const schema = z.object({
        category: z.string().min(1),
        urgency: z.string().optional(),
        limit: z
          .union([z.string(), z.number()])
          .optional()
          .transform((v) => {
            if (v == null || v === "") return 4;
            const n = typeof v === "number" ? v : Number(v);
            return Number.isFinite(n) ? Math.max(2, Math.min(6, Math.floor(n))) : 4;
          }),
        estateId: z.string().optional(),
      });

      const parsed = schema.parse(req.query);

      const requestedEstateId = typeof parsed.estateId === "string" && parsed.estateId.trim() ? parsed.estateId.trim() : undefined;
      let activeEstateId = requestedEstateId;
      if (!activeEstateId) {
        const membershipsForUser = await storage.getMembershipsForUser(req.auth!.userId);
        const primary = membershipsForUser.find((m) => m.isPrimary && m.isActive && m.status === "active");
        activeEstateId = primary?.estateId;
      }

      const providers = await storage.getProviders({
        approved: true,
        category: parsed.category,
      });

      const verifiedProviders = (providers || []).filter((p: any) => p?.isActive !== false && p?.isApproved === true);
      const providerIds = verifiedProviders.map((p: any) => p.id).filter(Boolean);

      if (providerIds.length === 0) {
        return res.json({
          providers: [],
          usedEstateId: activeEstateId ?? null,
          estateSpecificCount: 0,
        });
      }

      const completedJobRows = await db
        .select({ providerId: serviceRequests.providerId, completedJobs: count() })
        .from(serviceRequests)
        .where(and(inArray(serviceRequests.providerId, providerIds as any), eq(serviceRequests.status, "completed")))
        .groupBy(serviceRequests.providerId);

      const completedJobsByProvider = new Map<string, number>();
      for (const r of completedJobRows) {
        const pid = (r as any).providerId as string | null;
        if (!pid) continue;
        completedJobsByProvider.set(pid, Number((r as any).completedJobs ?? 0));
      }

      let estateMatchedIds = new Set<string>();
      if (activeEstateId) {
        const membershipRows = await db
          .select({ userId: memberships.userId })
          .from(memberships)
          .where(
            and(
              eq(memberships.estateId, activeEstateId),
              eq(memberships.isActive, true),
              eq(memberships.status, "active"),
              inArray(memberships.userId, providerIds as any),
            ),
          );
        estateMatchedIds = new Set(membershipRows.map((m: { userId: string }) => m.userId));
      }

      const preview = verifiedProviders
        .map((p: any) => {
          const ratingNum = Number(p.rating ?? 0);
          const completedJobs = completedJobsByProvider.get(p.id) ?? 0;
          const isEstateMatch = activeEstateId ? estateMatchedIds.has(p.id) : false;

          const badges: string[] = [];
          if (isEstateMatch) badges.push("Estate recommended");
          if (ratingNum >= 4.5) badges.push("Top rated");
          if (completedJobs >= 25) badges.push("Experienced");

          const fastResponder = Boolean((p.metadata as any)?.fastResponder);
          if (fastResponder) badges.push("Fast responder");

          return {
            id: String(p.id),
            name: String(p.name ?? ""),
            serviceCategory: String(p.serviceCategory ?? parsed.category),
            rating: Number.isFinite(ratingNum) ? ratingNum : 0,
            completedJobs,
            responseTime: "Response time not available",
            location: String(p.location ?? "City-wide"),
            badges,
            verificationStatus: "Verified" as const,
            image: (p.metadata as any)?.avatarUrl ? String((p.metadata as any).avatarUrl) : undefined,
            __estateMatch: isEstateMatch,
          };
        })
        .sort((a: any, b: any) => {
          if (a.__estateMatch !== b.__estateMatch) return a.__estateMatch ? -1 : 1;
          if (b.rating !== a.rating) return b.rating - a.rating;
          return (b.completedJobs ?? 0) - (a.completedJobs ?? 0);
        });

      const limited = preview.slice(0, parsed.limit ?? 4).map(({ __estateMatch, ...rest }: any) => rest);
      const estateSpecificCount = activeEstateId ? preview.filter((p: any) => p.__estateMatch).length : 0;

      res.json({
        providers: limited,
        usedEstateId: activeEstateId ?? null,
        estateSpecificCount,
      });
    } catch (error) {
      next(error);
    }
  });

  app.post(
    "/api/service-requests",
    requireAuth,
    async (req, res, next) => {
      console.log("[DEBUG] Hit POST /api/service-requests", { 
        auth: !!req.auth, 
        user: !!req.user,
        authenticated: req.isAuthenticated ? req.isAuthenticated() : 'no-func'
      });
      try {
      const userId = req.auth!.userId;

      const headerEstate = typeof req.headers["x-estate-id"] === "string" ? req.headers["x-estate-id"].trim() : undefined;
      const queryEstate = typeof req.query.estateId === "string" ? req.query.estateId.trim() : undefined;
      const bodyEstate = typeof (req.body as any)?.estateId === "string" ? String((req.body as any).estateId).trim() : undefined;
      const requestedEstateId = headerEstate || queryEstate || bodyEstate || undefined;

      // estateId is optional in schema; only attach it when it is valid AND the user is an active member.
      let estateId: string | undefined;
      if (requestedEstateId) {
        const isAdminCheck = isAdminOrSuper(req);
        if (!isAdminCheck) {
          const membership = await storage.getMembershipByUserAndEstate(userId, requestedEstateId);
          if (!membershipIsActive(membership)) {
            console.log("[DEBUG-AUTH] Membership check failed", { userId, requestedEstateId, hasMembership: !!membership });
            return res.status(403).json({ message: "Your estate membership is not active." });
          }
        }
        estateId = requestedEstateId;
      }

      const parsed = CreateServiceRequest.parse({
        ...req.body,
        residentId: userId,
        estateId,
      });

      const created = await storage.createServiceRequest(parsed);
      
      // Broadcast new service request to SSE clients (for admin dashboard real-time updates)
      try {
        // @ts-ignore
        if (global.__serviceRequestSseClients && Array.isArray(global.__serviceRequestSseClients)) {
          const payload = { type: "created", request: created };
          const data = JSON.stringify(payload);
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
      
      return res.status(201).json(created);
    } catch (error: any) {
      if (error?.issues) {
        return res.status(400).json({
          error: "Validation error",
          details: error.issues.map((i: any) => ({
            path: i.path.join("."),
            message: i.message,
            expected: i.expected,
            received: i.received,
            code: i.code,
          })),
        });
      }
      next(error);
    }
  });

  app.get("/api/service-requests", requireAuth, async (req, res, next) => {
    try {
      const userId = req.auth!.userId;
      const userRole = req.auth!.role;

      const { status } = req.query;
      let requests;

      if (userRole === "resident") {
        requests = await storage.getServiceRequestsByResident(userId);
      } else if (userRole === "provider") {
        const user = await storage.getUser(userId);
        if (status === "available") {
          requests = await storage.getAvailableServiceRequests(user?.serviceCategory || undefined);
        } else {
          requests = await storage.getServiceRequestsByProvider(userId);
        }
      } else if (userRole === "admin" || userRole === "super_admin" || userRole === "estate_admin") {
        requests = await storage.getAllServiceRequests();
      }

      res.json(requests || []);
    } catch (error) {
      next(error);
    }
  });

  app.patch("/api/service-requests/:id", requireAuth, async (req, res, next) => {
    try {
      const { id } = req.params;
      const updates = { ...(req.body || {}) };
      const actorId = req.auth?.userId ?? req.user?.id;
      const actorRole = String(req.auth?.role ?? req.user?.role ?? "").toLowerCase();
      if (!actorId || !actorRole) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const currentRequest = await storage.getServiceRequest(id);
      if (!currentRequest) {
        return res.status(404).json({ message: "Service request not found" });
      }

      const isAdminActor =
        actorRole === "admin" || actorRole === "super_admin" || actorRole === "estate_admin";
      const isResidentOwner = currentRequest.residentId === actorId;
      const isAssignedProvider = currentRequest.providerId === actorId;

      if (!isAdminActor && !isResidentOwner && !isAssignedProvider) {
        return res.status(403).json({ message: "Forbidden" });
      }

      // Convert timestamp fields from ISO strings back to Date objects
      const timestampFields = [
        "assignedAt",
        "paymentRequestedAt",
        "approvedForJobAt",
        "closedAt",
        "createdAt",
        "updatedAt",
        "preferredTime",
      ];
      for (const field of timestampFields) {
        if (updates[field] && typeof updates[field] === "string") {
          updates[field] = new Date(updates[field]);
        }
      }

      const currentStatus = normalizeServiceRequestStatusKey(currentRequest.status);
      const nextStatus = updates.status
        ? normalizeServiceRequestStatusKey(updates.status)
        : currentStatus;
      if (updates.status && !SERVICE_REQUEST_STATUS_KEYS.has(nextStatus)) {
        return res.status(400).json({ message: "Invalid service request status" });
      }
      if (updates.status) {
        updates.status = nextStatus;
      }

      const changedKeys = new Set(Object.keys(updates));
      const adminOnlyKeys = new Set([
        "providerId",
        "adminNotes",
        "assignedAt",
        "paymentRequestedAt",
        "approvedForJobAt",
        "approvedForJobBy",
        "billedAmount",
        "paymentStatus",
      ]);
      const residentEditableKeys = new Set([
        "category",
        "description",
        "urgency",
        "location",
        "latitude",
        "longitude",
        "preferredTime",
        "specialInstructions",
        "status",
      ]);
      const providerEditableKeys = new Set(["status", "closeReason"]);

      if (!isAdminActor) {
        for (const key of changedKeys) {
          if (adminOnlyKeys.has(key)) {
            return res.status(403).json({ message: `Only admin can update ${key}` });
          }
        }
      }

      if (isResidentOwner && !isAdminActor) {
        for (const key of changedKeys) {
          if (!residentEditableKeys.has(key)) {
            return res.status(403).json({ message: `Residents cannot update ${key}` });
          }
        }
        if (updates.status && nextStatus !== "cancelled") {
          return res.status(403).json({ message: "Residents can only cancel their request" });
        }
      }

      if (isAssignedProvider && !isAdminActor && !isResidentOwner) {
        for (const key of changedKeys) {
          if (!providerEditableKeys.has(key)) {
            return res.status(403).json({ message: `Providers cannot update ${key}` });
          }
        }
        if (updates.status && !["in_progress", "completed"].includes(nextStatus)) {
          return res.status(403).json({ message: "Providers can only move requests to in_progress or completed" });
        }
      }

      if ((currentStatus === "completed" || currentStatus === "cancelled") && nextStatus !== currentStatus) {
        return res.status(409).json({ message: "Completed or cancelled requests cannot be reopened" });
      }

      if (updates.providerId !== undefined) {
        if (!isAdminActor) {
          return res.status(403).json({ message: "Only admin can change assigned provider" });
        }
        const lockedStatuses = new Set(["assigned_for_job", "in_progress", "completed", "cancelled"]);
        if (lockedStatuses.has(currentStatus) && nextStatus !== "assigned") {
          return res
            .status(400)
            .json({ message: "Provider can only be changed before the request is assigned for job" });
        }
      }

      if (updates.paymentStatus !== undefined) {
        if (!isAdminActor) {
          return res.status(403).json({ message: "Only admin can update payment status directly" });
        }
        const normalizedPaymentStatus = String(updates.paymentStatus || "").toLowerCase().trim();
        if (!["pending", "paid", "failed", "unpaid", "cancelled", "unset"].includes(normalizedPaymentStatus)) {
          return res.status(400).json({ message: "Invalid payment status value" });
        }
        updates.paymentStatus = normalizedPaymentStatus;
        if (normalizedPaymentStatus === "pending") {
          if (!currentRequest.consultancyReportSubmittedAt || !currentRequest.consultancyReport) {
            return res.status(400).json({
              message: "Provider consultancy report is required before requesting payment",
            });
          }
        }
        if (normalizedPaymentStatus === "pending" && !updates.paymentRequestedAt) {
          updates.paymentRequestedAt = new Date();
        }
      }

      if (nextStatus === "assigned") {
        if (!isAdminActor) {
          return res.status(403).json({ message: "Only admin can assign request for inspection" });
        }
        if (!updates.providerId && !currentRequest.providerId) {
          return res.status(400).json({ message: "Assign a provider before setting inspection assignment" });
        }
        updates.assignedAt = updates.assignedAt || currentRequest.assignedAt || new Date();
        updates.approvedForJobAt = null;
        updates.approvedForJobBy = null;
      }

      if (nextStatus === "assigned_for_job") {
        if (!isAdminActor) {
          return res.status(403).json({ message: "Only admin can assign a request for job" });
        }
        const providerIdForJob = String(updates.providerId || currentRequest.providerId || "").trim();
        if (!providerIdForJob) {
          return res.status(400).json({ message: "A provider must be selected before assigning for job" });
        }

        const paymentRequestedAt = updates.paymentRequestedAt || currentRequest.paymentRequestedAt;
        if (!paymentRequestedAt) {
          return res.status(400).json({
            message: "Payment must be requested from the resident before assigning for job",
          });
        }

        const effectivePaymentStatus = String(
          updates.paymentStatus ?? currentRequest.paymentStatus ?? "",
        ).toLowerCase();
        if (effectivePaymentStatus !== "paid") {
          return res.status(400).json({
            message: "Resident payment must be completed before assigning for job",
          });
        }

        updates.approvedForJobAt = new Date();
        updates.approvedForJobBy = actorId;
        updates.assignedAt = updates.assignedAt || currentRequest.assignedAt || new Date();
      }

      if (nextStatus === "in_progress") {
        const fromStatus = currentStatus;
        if (!["assigned_for_job", "in_progress"].includes(fromStatus)) {
          return res.status(400).json({
            message: "Request must be assigned for job before work can start",
          });
        }
      }

      if (nextStatus === "completed") {
        if (currentStatus !== "in_progress" && currentStatus !== "completed") {
          return res.status(400).json({
            message: "Only requests in progress can be marked as completed",
          });
        }
        if (!isAdminActor && isAssignedProvider && currentStatus !== "in_progress") {
          return res.status(400).json({
            message: "Provider can only complete a request that is already in progress",
          });
        }
        updates.closedAt = updates.closedAt || new Date();
      }

      if (nextStatus === "cancelled" && !isAdminActor && !isResidentOwner) {
        return res.status(403).json({ message: "Only admin or resident can cancel requests" });
      }

      const serviceRequest = await storage.updateServiceRequest(id, updates);
      if (!serviceRequest) {
        return res.status(404).json({ message: "Service request not found" });
      }

      if (isAdminActor && updates.paymentStatus === "pending" && currentRequest.residentId) {
        const notification = await storage.createNotification({
          userId: currentRequest.residentId,
          title: "Payment requested",
          message: "A job payment request has been raised for your service request.",
          type: "info",
          metadata: {
            requestId: currentRequest.id,
            kind: "job_payment_requested",
          },
        });
        const io = req.app.get("io") as SocketIOServer | undefined;
        io?.to(`user-${currentRequest.residentId}`).emit("notification:new", notification);

        const effectiveAmount = updates.billedAmount ?? currentRequest.billedAmount;
        const paymentMessage =
          effectiveAmount && Number.isFinite(Number(effectiveAmount))
            ? `Service payment requested: NGN ${Number(effectiveAmount).toLocaleString()}.`
            : "Service payment has been requested.";
        const inserted = await storage.addRequestMessage(
          currentRequest.id,
          actorId,
          "admin",
          paymentMessage,
        );
        const participantIds = new Set<string>();
        if (currentRequest.residentId) participantIds.add(currentRequest.residentId);
        if (updates.providerId || currentRequest.providerId) {
          participantIds.add(String(updates.providerId || currentRequest.providerId));
        }
        for (const participantUserId of participantIds) {
          io?.to(`user-${participantUserId}`).emit("request-message:new", {
            requestId: currentRequest.id,
            message: inserted,
          });
        }
      }

      if (nextStatus === "assigned_for_job") {
        const io = req.app.get("io") as SocketIOServer | undefined;

        if (serviceRequest.residentId) {
          const residentNotification = await storage.createNotification({
            userId: serviceRequest.residentId,
            title: "Provider assigned for job",
            message: "Your request has been approved and assigned for job execution.",
            type: "success",
            metadata: {
              requestId: serviceRequest.id,
              kind: "request_status",
            },
          });
          io?.to(`user-${serviceRequest.residentId}`).emit("notification:new", residentNotification);
        }

        if (serviceRequest.providerId) {
          const providerNotification = await storage.createNotification({
            userId: serviceRequest.providerId,
            title: "Job approved",
            message: "You can proceed with this service request.",
            type: "info",
            metadata: {
              requestId: serviceRequest.id,
              kind: "request_status",
            },
          });
          io?.to(`user-${serviceRequest.providerId}`).emit("notification:new", providerNotification);
        }
      }

      // Broadcast update to SSE clients
      try {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        if (global.__serviceRequestSseClients && Array.isArray(global.__serviceRequestSseClients)) {
          const payload = { type: "updated", request: serviceRequest };
          const data = JSON.stringify(payload);
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
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
        console.error("Failed to broadcast service-request updated event", e);
      }

      emitServiceRequestUpdate(req.app, serviceRequest, "status");

      res.json(serviceRequest);
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/service-requests/my", requireAuth, async (req, res, next) => {
    try {
      const userId = req.auth?.userId ?? req.user?.id;
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const estateId =
        (req.header("x-estate-id") as string | undefined)?.trim() ||
        (req.query.estateId as string | undefined);

      const requests = await storage.getServiceRequestsByResident(userId, {
        estateId: estateId ? estateId : undefined,
      });

      res.json({ data: requests });
    } catch (error) {
      console.error("Failed to fetch my service requests", error);
      res.status(500).json({ message: "Unable to load service requests" });
    }
  });

  app.delete("/api/service-requests/:id", requireAuth, async (req, res, next) => {
    try {
      const userId = req.auth?.userId ?? req.user?.id;
      if (!userId) return res.status(401).json({ message: "Unauthorized" });

      const { id } = req.params;
      const existing = await storage.getServiceRequest(id);
      if (!existing) return res.status(404).json({ message: "Service request not found" });
      if (existing.residentId !== userId) return res.status(403).json({ message: "Forbidden" });

      const cancelled = await storage.cancelServiceRequest(id, userId);
      if (!cancelled) return res.status(404).json({ message: "Service request not found" });

      res.json({ ok: true, status: cancelled.status });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/service-requests/:id/messages", requireAuth, async (req, res, next) => {
    try {
      const userId = req.auth?.userId ?? req.user?.id;
      const userRole = req.auth?.role ?? req.user?.role;
      if (!userId || !userRole) return res.status(401).json({ message: "Unauthorized" });

      const request = await storage.getServiceRequest(req.params.id);
      if (!request) return res.status(404).json({ message: "Service request not found" });

      const canAccess =
        userRole === "admin" ||
        userRole === "super_admin" ||
        request.residentId === userId ||
        request.providerId === userId;
      if (!canAccess) return res.status(403).json({ message: "Forbidden" });

      const messages = await storage.getRequestMessages(req.params.id);
      res.json(messages);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/service-requests/:id/messages", requireAuth, async (req, res, next) => {
    try {
      const userId = req.auth?.userId ?? req.user?.id;
      const userRole = req.auth?.role ?? req.user?.role;
      if (!userId || !userRole) return res.status(401).json({ message: "Unauthorized" });

      const request = await storage.getServiceRequest(req.params.id);
      if (!request) return res.status(404).json({ message: "Service request not found" });

      const canAccess =
        userRole === "admin" ||
        userRole === "super_admin" ||
        request.residentId === userId ||
        request.providerId === userId;
      if (!canAccess) return res.status(403).json({ message: "Forbidden" });

      const parsed = z
        .object({
          message: z.string().trim().min(1).max(2000),
          attachmentUrl: z.string().url().optional(),
        })
        .parse(req.body || {});

      const senderRole =
        userRole === "admin" || userRole === "super_admin"
          ? "admin"
          : userRole === "provider"
            ? "provider"
            : "resident";

      const inserted = await storage.addRequestMessage(
        req.params.id,
        userId,
        senderRole,
        parsed.message,
        parsed.attachmentUrl,
      );

      const io = req.app.get("io") as SocketIOServer | undefined;
      const participantIds = new Set<string>();
      if (request.residentId) participantIds.add(request.residentId);
      if (request.providerId) participantIds.add(request.providerId);
      for (const participantUserId of participantIds) {
        io?.to(`user-${participantUserId}`).emit("request-message:new", {
          requestId: req.params.id,
          message: inserted,
        });
      }

      const recipientIds = new Set<string>();
      if (request.residentId) recipientIds.add(request.residentId);
      if (request.providerId) recipientIds.add(request.providerId);
      recipientIds.delete(userId);

      if (recipientIds.size > 0) {
        const titleByRole = {
          provider: "New message from provider",
          resident: "New message from resident",
          admin: "New message from support",
        } as const;
        const notificationMessage = parsed.message.length > 140
          ? `${parsed.message.slice(0, 137)}...`
          : parsed.message;

        for (const recipientUserId of recipientIds) {
          const notification = await storage.createNotification({
            userId: recipientUserId,
            title: titleByRole[senderRole],
            message: notificationMessage,
            type: "info",
            metadata: {
              kind: "request_message",
              requestId: req.params.id,
              senderRole,
            } as any,
          });
          io?.to(`user-${recipientUserId}`).emit("notification:new", notification);
        }
      }

      res.status(201).json(inserted);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/provider/service-requests/:id/consultancy-report", requireAuth, async (req, res, next) => {
    try {
      const actorId = req.auth?.userId ?? req.user?.id;
      const actorRole = String(req.auth?.role ?? req.user?.role ?? "").toLowerCase();
      if (!actorId || !actorRole) return res.status(401).json({ message: "Unauthorized" });

      const request = await storage.getServiceRequest(req.params.id);
      if (!request) return res.status(404).json({ message: "Service request not found" });

      const isAdminActor = actorRole === "admin" || actorRole === "super_admin" || actorRole === "estate_admin";
      const isAssignedProvider = actorRole === "provider" && request.providerId === actorId;
      if (!isAdminActor && !isAssignedProvider) {
        return res.status(403).json({ message: "Forbidden" });
      }

      const statusKey = normalizeServiceRequestStatusKey(request.status);
      if (["completed", "cancelled"].includes(statusKey)) {
        return res.status(400).json({ message: "Cannot submit a consultancy report for a closed request" });
      }

      const payload = ConsultancyReportPayloadSchema.parse(req.body || {});
      const inspectionDate = new Date(payload.inspectionDate);
      if (Number.isNaN(inspectionDate.getTime())) {
        return res.status(400).json({ message: "Invalid inspection date" });
      }

      const totalRecommendation = payload.materialCost + payload.serviceCost;
      const report = {
        inspectionDate: inspectionDate.toISOString(),
        actualIssue: payload.actualIssue,
        causeOfIssue: payload.causeOfIssue,
        materialCost: payload.materialCost,
        serviceCost: payload.serviceCost,
        totalRecommendation,
        preventiveRecommendation: payload.preventiveRecommendation,
        submittedAt: new Date().toISOString(),
        submittedBy: actorId,
      };

      const updated = await storage.updateServiceRequest(req.params.id, {
        consultancyReport: report as any,
        consultancyReportSubmittedAt: new Date(),
        consultancyReportSubmittedBy: actorId,
      } as any);

      if (!updated) return res.status(404).json({ message: "Service request not found" });

      // Keep consultancy report internal until admin/company raises a payment request.
      emitServiceRequestUpdate(req.app, updated, "status");
      res.status(201).json({ success: true, report, request: updated });
    } catch (error) {
      next(error);
    }
  });

  // Server-Sent Events endpoint for streaming service-request events (created/updated/assigned)
  app.get("/api/service-requests/stream", requireAuth, (req, res) => {
    try {
      // set SSE headers
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache, no-transform");
      res.setHeader("Connection", "keep-alive");
      res.flushHeaders?.();

      // ensure global client list
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      global.__serviceRequestSseClients ||= [];
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      const id = Date.now() + Math.random();
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      global.__serviceRequestSseClients.push({ id, res });

      req.on("close", () => {
        try {
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          global.__serviceRequestSseClients = (global.__serviceRequestSseClients || []).filter((c: any) => c.id !== id);
        } catch (e) {
          // ignore
        }
      });
    } catch (e) {
      console.error("SSE setup failed", e);
      try { res.status(500).end(); } catch {}
    }
  });

  app.post("/api/service-requests/:id/accept", async (req, res, next) => {
    try {
      if (!req.isAuthenticated() || req.user?.role !== "provider") {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { id } = req.params;
      const serviceRequest = await storage.assignServiceRequest(id, req.user.id);

      if (!serviceRequest) {
        return res.status(404).json({ message: "Service request not found" });
      }

      // Broadcast assignment to SSE clients
      try {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        if (global.__serviceRequestSseClients && Array.isArray(global.__serviceRequestSseClients)) {
          const payload = { type: "assigned", request: serviceRequest };
          const data = JSON.stringify(payload);
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
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
        console.error("Failed to broadcast service-request assigned event", e);
      }

      emitServiceRequestUpdate(req.app, serviceRequest, "assigned");

      res.json(serviceRequest);
    } catch (error) {
      next(error);
    }
  });

  // Public: list estates/regions (supports open-access filter)
  app.get("/api/estates", async (req, res, next) => {
    try {
      const filter = String(req.query.filter || "");
      const whereParts: any[] = [eq(estates.isActive, true)];
      if (filter === "open-access") {
        whereParts.push(
          or(
            isNull(estates.accessType),
            ilike(estates.accessType, "open"),
            ilike(estates.accessType, "code"),
          ),
        );
      }

      const where = whereParts.length > 1 ? and(...whereParts) : whereParts[0];
      const rows = await db
        .select({
          id: estates.id,
          name: estates.name,
          address: estates.address,
          slug: estates.slug,
          accessType: estates.accessType,
        })
        .from(estates)
        .where(where)
        .orderBy(asc(estates.name));

      res.json(rows);
    } catch (error) {
      next(error);
    }
  });

  // Get estates the current user is a member of
  app.get("/api/my-estates", requireAuth, async (req, res, next) => {
    try {
      const userId = req.auth?.userId ?? req.user?.id;
      if (!userId) return res.status(401).json({ message: "Unauthorized" });

      const rows = await db
        .select({
          id: estates.id,
          name: estates.name,
          slug: estates.slug,
        })
        .from(memberships)
        .leftJoin(estates, eq(estates.id, memberships.estateId))
        .where(eq(memberships.userId, userId));

      // Filter out null joins
      const out = (rows || [])
        .map((r: any) => ({ id: r.id, name: r.name, slug: r.slug }))
        .filter((e: any) => e && e.id);

      res.json(out);
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/notifications", requireAuth, async (req, res, next) => {
    try {
      const userId = req.auth?.userId ?? req.user?.id;
      if (!userId) return res.status(401).json({ message: "Unauthorized" });
      const rows = await storage.listNotificationsForUser(userId);
      res.json(rows);
    } catch (error) {
      next(error);
    }
  });

  app.patch("/api/notifications/:id/read", requireAuth, async (req, res, next) => {
    try {
      const userId = req.auth?.userId ?? req.user?.id;
      if (!userId) return res.status(401).json({ message: "Unauthorized" });
      const updated = await storage.markNotificationRead(userId, req.params.id);
      if (!updated) return res.status(404).json({ message: "Notification not found" });
      res.json(updated);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/notifications/mark-all-read", requireAuth, async (req, res, next) => {
    try {
      const userId = req.auth?.userId ?? req.user?.id;
      if (!userId) return res.status(401).json({ message: "Unauthorized" });
      const result = await storage.markAllNotificationsRead(userId);
      res.json({ ok: true, updated: result.updated });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/ai/diagnose", requireAuth, async (req, res) => {
    const parsedBody = AIDiagnosisRequestSchema.safeParse(req.body);
    if (!parsedBody.success) {
      return res.status(400).json({
        error: "Invalid request body",
        details: parsedBody.error.flatten(),
      });
    }

    try {
      // Simple per-user/IP rate limiting (burst: 3 per minute)
      const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0] || req.socket.remoteAddress || "unknown";
      const userKey = `${req.user?.id ?? "anon"}:${ip}`;
      const now = Date.now();
      const windowMs = 60_000;
      const maxRequests = 3;
      // in-memory store
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      global.__aiRate ||= new Map<string, { count: number; windowStart: number }>();
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      const rate = global.__aiRate.get(userKey) || { count: 0, windowStart: now };
      if (now - rate.windowStart > windowMs) {
        rate.count = 0;
        rate.windowStart = now;
      }
      rate.count += 1;
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      global.__aiRate.set(userKey, rate);
      if (rate.count > maxRequests) {
        return res.status(429).json({ error: "Rate limit exceeded. Try again shortly." });
      }

      // Simple caching: key by user+description for 5 minutes
      const cacheKey = `${userKey}:${parsedBody.data.category}:${parsedBody.data.description}`;
      const ttlMs = 5 * 60_000;
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      global.__aiCache ||= new Map<string, { expires: number; data: unknown }>();
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      const cached = global.__aiCache.get(cacheKey);
      if (cached && cached.expires > now) {
        try {
          const normalized = AIDiagnosisResponseSchema.parse(cached.data);
          return res.json(normalized);
        } catch {
          // ignore parse errors and continue to live call
        }
      }

      const { category, description, urgency, specialInstructions } = parsedBody.data;
      const activeProvider = await ai.getActiveProvider();
        const useGeminiDirect = activeProvider.provider === "gemini";
      const geminiModel = getGeminiModel(activeProvider.model || process.env.GEMINI_MODEL);
      let normalized;
      if (useGeminiDirect) {
        try {
          normalized = await runDiagnosis({
            category,
            description,
            urgency,
            specialInstructions,
            model: geminiModel,
          });
        } catch (error) {
          console.error(`[AI][Gemini] model=${geminiModel} diagnosis failed. Returning fallback.`, error);
          return res.json(GEMINI_FALLBACK_DIAGNOSIS);
        }
      } else {
        normalized = await ai.diagnose({ category, description, urgency, specialInstructions });
      }

      if (normalized !== GEMINI_SAFETY_FALLBACK) {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        global.__aiCache.set(cacheKey, { expires: now + ttlMs, data: normalized });
      }
      return res.json(normalized);
    } catch (error) {
      // Optional fallback order: try other providers before failing
      try {
        const { provider } = await ai.getActiveProvider();
        const fallbacks = ai.availableProviders().filter((p) => p !== provider);
        const { category, description, urgency, specialInstructions } = parsedBody.data as any;
        for (const p of fallbacks) {
          try {
            ai.setActiveProvider(p);
            const normalized = await ai.diagnose({ category, description, urgency, specialInstructions });
            return res.json(normalized);
          } catch {
            // continue
          }
        }
      } catch {}
      console.error("[AI] Diagnosis generation failed:", error);
      return res.status(500).json({
        error: "Unable to generate AI diagnosis right now.",
      });
    }
  });

  app.post(
    "/api/ai/validate-description",
    requireAuth,
    async (req, res) => {
      const parsedBody = AIDescriptionValidationRequestSchema.safeParse(req.body);
      if (!parsedBody.success) {
        return res.status(400).json({
          error: "Invalid request body",
          details: parsedBody.error.flatten(),
        });
      }

      try {
        const { category, description } = parsedBody.data;

        const ip =
          (req.headers["x-forwarded-for"] as string)?.split(",")[0] ||
          req.socket.remoteAddress ||
          "unknown";
        const userKey = `${req.user?.id ?? "anon"}:${ip}`;
        const now = Date.now();
        const windowMs = 60_000;
        const maxRequests = 10;
        const rateMap: Map<string, { count: number; windowStart: number }> =
          ((global as any).__aiValidateRate ||= new Map<
            string,
            { count: number; windowStart: number }
          >());

        const rate =
          rateMap.get(userKey) ||
          ({ count: 0, windowStart: now } as {
            count: number;
            windowStart: number;
          });
        if (now - rate.windowStart > windowMs) {
          rate.count = 0;
          rate.windowStart = now;
        }
        rate.count += 1;
        rateMap.set(userKey, rate);
        if (rate.count > maxRequests) {
          return res
            .status(429)
            .json({ error: "Rate limit exceeded. Try again shortly." });
        }

        const model = getGeminiModel(
          process.env.GEMINI_MODEL || "gemini-1.5-flash"
        );

        const prompt = [
          "Return ONLY a single JSON object. No markdown, no code fences, no extra text.",
          "You validate whether a resident's service request description is sufficiently detailed to proceed to the next step (uploading an optional supporting image).",
          "Consider it VALID if it includes at least: (1) what is wrong, (2) location/area, and (3) timing or context. Otherwise INVALID.",
          "If INVALID, provide an improved prompt the user can paste, and 2-3 short example rewrites.",
          "Output must match this exact JSON shape:",
          '{"valid":true,"reason":"","improvedPrompt":"","suggestedRewriteExamples":[""]}',
          "",
          `Category: ${category || "(unknown)"}`,
          "Description:",
          description,
        ].join("\n");

        const { text, blocked } = await generateGeminiContent(model, prompt);
        if (blocked) {
          return res
            .status(503)
            .json({ error: "AI response was blocked." });
        }

        const raw = (text || "").trim();
        const tryParseJson = (s: string) => {
          try {
            return JSON.parse(s);
          } catch {
            return null;
          }
        };

        let obj = tryParseJson(raw);
        if (!obj) {
          const match = raw.match(/\{[\s\S]*\}/);
          if (match) obj = tryParseJson(match[0]);
        }

        if (!obj) {
          return res
            .status(502)
            .json({ error: "AI returned non-JSON output." });
        }

        const normalized = AIDescriptionValidationResponseSchema.parse(obj);
        return res.json(normalized);
      } catch (error) {
        console.error("[AI] validate-description failed:", error);
        return res
          .status(500)
          .json({ error: "Unable to validate description right now." });
      }
    }
  );

  app.get("/api/ai/health", async (req, res) => {
    const provider = "gemini";
    const configured = Boolean(process.env.GEMINI_API_KEY || process.env.GOOGLE_GEMINI_API_KEY);
    let model = process.env.GEMINI_MODEL || "gemini-1.5-flash";
    let ok = false;
    let error: string | undefined;
    try {
      model = getGeminiModel(model);
    } catch (e: any) {
      error = e?.message || "Invalid Gemini model configuration.";
      return res.json({ ok: false, provider, model, configured, error });
    }
    if (configured) {
      try {
        const { text, blocked } = await generateGeminiContent(model, "ping");
        ok = Boolean(text?.trim()) && !blocked;
        if (!ok) error = "Gemini returned no content.";
      } catch (e: any) {
        ok = false;
        error = e?.message || "Gemini health check failed.";
        console.error("[AI][Gemini] health check failed model=%s: %s", model, error);
      }
    } else {
      error = "GEMINI_API_KEY is not configured.";
    }
    res.json({ ok, provider, model, configured, ...(error ? { error } : {}) });
  });

  // Admin AI settings endpoints
  app.get("/api/admin/ai/settings", async (req, res) => {
    if (!isAdminOrSuper(req)) return res.status(401).json({ message: "Unauthorized - Admin only" });
    const active = await ai.getActiveProvider();
    const available = ai.availableProviders();
    const status = {
      openai: { configured: !!process.env.OPENAI_API_KEY },
      ollama: { configured: !!(process.env.OLLAMA_BASE_URL || process.env.OLLAMA_HOST) },
      gemini: { configured: !!(process.env.GEMINI_API_KEY || process.env.GOOGLE_GEMINI_API_KEY) },
    };
    res.json({ active, available, status });
  });

  app.patch("/api/admin/ai/settings", async (req, res) => {
    if (!isAdminOrSuper(req)) return res.status(401).json({ message: "Unauthorized - Admin only" });
    const provider = req.body?.provider as any;
    const model = req.body?.model as string | undefined;
    if (!provider || !ai.availableProviders().includes(provider)) {
      return res.status(400).json({ message: "Invalid provider" });
    }
    await ai.setActiveProvider(provider, model);
    res.json({ success: true, active: await ai.getActiveProvider() });
  });

  // --- AI prepared request snapshots (resident writes, super admin reads) ---
  // IMPORTANT: Store no raw chat messages and mask resident identity.
  app.post(
    "/api/ai/prepared-requests/snapshot",
    requireAuth,
    async (req, res, next) => {
      try {
        const userId = req.auth?.userId ?? req.user?.id;
        if (!userId) return res.status(401).json({ message: "Authentication required" });

        const body = (req.body ?? {}) as any;
        const sessionId = typeof body.sessionId === "string" ? body.sessionId.trim() : "";
        const rawCategory = typeof body.category === "string" ? body.category : null;
        // Normalize category to lowercase with underscores for database enum compatibility
        const category = rawCategory ? rawCategory.toLowerCase().trim().replace(/[\s-]+/g, '_') : null;
        const urgency = typeof body.urgency === "string" ? body.urgency : null;
        const recommendedApproach = typeof body.recommendedApproach === "string" ? body.recommendedApproach : "";
        const confidenceScore = Number.isFinite(Number(body.confidenceScore)) ? Number(body.confidenceScore) : 0;
        const requiresConsultancy = Boolean(body.requiresConsultancy);
        const readyToBook = Boolean(body.readyToBook);
        const estateId = typeof body.estateId === "string" ? body.estateId : undefined;

        if (!sessionId || !category || !urgency || !recommendedApproach) {
          return res.status(400).json({ message: "Invalid snapshot payload" });
        }

        const salt = process.env.APP_SECRET || process.env.SESSION_SECRET || "dev";
        const residentHash = createHash("sha256")
          .update(`${salt}:${userId}`)
          .digest("hex");

        const snapshot = typeof body.snapshot === "object" && body.snapshot ? body.snapshot : {};

        // Upsert by sessionId
        const existing = await db
          .select({ id: aiPreparedRequests.id })
          .from(aiPreparedRequests)
          .where(eq(aiPreparedRequests.sessionId, sessionId))
          .limit(1);

        if (existing.length) {
          await db
            .update(aiPreparedRequests)
            .set({
              residentHash,
              estateId: estateId ?? null,
              category: category as any,
              urgency: urgency as any,
              recommendedApproach,
              confidenceScore,
              requiresConsultancy,
              readyToBook,
              snapshot,
              updatedAt: new Date(),
            })
            .where(eq(aiPreparedRequests.sessionId, sessionId));
        } else {
          await db.insert(aiPreparedRequests).values({
            sessionId,
            residentHash,
            estateId: estateId ?? null,
            category: category as any,
            urgency: urgency as any,
            recommendedApproach,
            confidenceScore,
            requiresConsultancy,
            readyToBook,
            snapshot,
          });
        }

        return res.json({ ok: true });
      } catch (error) {
        // If the observability table does not exist yet, don't fail the resident flow.
        const msg = (error as any)?.message || "";
        if (typeof msg === "string" && msg.includes("ai_prepared_requests")) {
          console.warn("AI snapshot storage not available (ai_prepared_requests missing). Skipping snapshot.", msg);
          return res.json({ ok: false, warning: "ai_prepared_requests table not present" });
        }
        next(error);
      }
    }
  );

  const computePriceEstimate = async (params: {
    category: string;
    urgency: string;
    scope?: string | null;
  }): Promise<{ min: number; max: number; ruleId?: string } | null> => {
    const scope = (params.scope || "").trim() || null;

    const candidates = await db
      .select({
        id: pricingRules.id,
        category: pricingRules.category,
        urgency: pricingRules.urgency,
        scope: pricingRules.scope,
        minPrice: pricingRules.minPrice,
        maxPrice: pricingRules.maxPrice,
      })
      .from(pricingRules)
      .where(eq(pricingRules.isActive, true));

    const scoreRule = (r: any) => {
      let score = 0;
      if (r.category && r.category === params.category) score += 10;
      if (r.urgency && r.urgency === params.urgency) score += 5;
      if (r.scope && scope && String(r.scope).toLowerCase() === scope.toLowerCase()) score += 3;
      if (!r.category) score += 1;
      return score;
    };

    const best = (candidates || [])
      .filter((r: any) => !r.category || r.category === params.category)
      .filter((r: any) => !r.urgency || r.urgency === params.urgency)
      .filter((r: any) => !r.scope || (scope && String(r.scope).toLowerCase() === scope.toLowerCase()))
      .sort((a: any, b: any) => scoreRule(b) - scoreRule(a))[0];

    if (!best) return null;

    const min = Number(best.minPrice);
    const max = Number(best.maxPrice);
    if (!Number.isFinite(min) || !Number.isFinite(max)) return null;
    return { min, max, ruleId: best.id };
  };

  // --- SUPER_ADMIN-only AI observability ---
  app.get(
    "/api/admin/ai/conversations",
    requireAuth,
    requireSuperAdmin,
    async (req, res, next) => {
      try {
        const rows = await db
          .select({
            sessionId: aiPreparedRequests.sessionId,
            category: aiPreparedRequests.category,
            urgency: aiPreparedRequests.urgency,
            recommendedApproach: aiPreparedRequests.recommendedApproach,
            confidenceScore: aiPreparedRequests.confidenceScore,
            requiresConsultancy: aiPreparedRequests.requiresConsultancy,
            readyToBook: aiPreparedRequests.readyToBook,
            createdAt: aiPreparedRequests.createdAt,
            updatedAt: aiPreparedRequests.updatedAt,
          })
          .from(aiPreparedRequests)
          .orderBy(desc(aiPreparedRequests.updatedAt))
          .limit(200);

        return res.json(
          (rows || []).map((r: any) => ({
            conversationId: r.sessionId,
            category: r.category,
            urgency: r.urgency,
            recommendedApproach: r.recommendedApproach,
            confidenceScore: r.confidenceScore,
            requiresConsultancy: r.requiresConsultancy,
            status: r.readyToBook ? "ready_to_book" : "in_progress",
            createdAt: r.createdAt,
            updatedAt: r.updatedAt,
          }))
        );
      } catch (error) {
        next(error);
      }
    }
  );

  app.get(
    "/api/admin/ai/prepared-requests",
    requireAuth,
    requireSuperAdmin,
    async (req, res, next) => {
      try {
        const rows = await db
          .select({
            id: aiPreparedRequests.id,
            sessionId: aiPreparedRequests.sessionId,
            residentHash: aiPreparedRequests.residentHash,
            estateId: aiPreparedRequests.estateId,
            category: aiPreparedRequests.category,
            urgency: aiPreparedRequests.urgency,
            recommendedApproach: aiPreparedRequests.recommendedApproach,
            confidenceScore: aiPreparedRequests.confidenceScore,
            requiresConsultancy: aiPreparedRequests.requiresConsultancy,
            readyToBook: aiPreparedRequests.readyToBook,
            snapshot: aiPreparedRequests.snapshot,
            createdAt: aiPreparedRequests.createdAt,
            updatedAt: aiPreparedRequests.updatedAt,
          })
          .from(aiPreparedRequests)
          .orderBy(desc(aiPreparedRequests.updatedAt))
          .limit(200);

        const results = await Promise.all(
          (rows || []).map(async (r: any) => {
            const scope = r.snapshot?.scope ?? null;
            const estimate = await computePriceEstimate({
              category: r.category,
              urgency: r.urgency,
              scope,
            });

            return {
              id: r.id,
              conversationId: r.sessionId,
              resident: `resident_${String(r.residentHash || "").slice(0, 8)}`,
              estateId: r.estateId,
              category: r.category,
              urgency: r.urgency,
              recommendedApproach: r.recommendedApproach,
              confidenceScore: r.confidenceScore,
              requiresConsultancy: r.requiresConsultancy,
              readyToBook: r.readyToBook,
              headline: r.snapshot?.headline ?? null,
              imageCount: Number.isFinite(Number(r.snapshot?.imageCount)) ? Number(r.snapshot?.imageCount) : 0,
              scope: scope,
              priceEstimate: estimate,
              createdAt: r.createdAt,
              updatedAt: r.updatedAt,
            };
          })
        );

        return res.json(results);
      } catch (error) {
        next(error);
      }
    }
  );

  // --- SUPER_ADMIN-only Pricing Rules ---
  app.get("/api/admin/pricing-rules", requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      const rows = await db.select().from(pricingRules).orderBy(desc(pricingRules.updatedAt));
      return res.json(rows);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/admin/pricing-rules", requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      const body = (req.body ?? {}) as any;
      const name = typeof body.name === "string" ? body.name.trim() : "";
      if (!name) return res.status(400).json({ message: "Name is required" });

      const category = typeof body.category === "string" ? body.category : null;
      const urgency = typeof body.urgency === "string" ? body.urgency : null;
      const scope = typeof body.scope === "string" ? body.scope.trim() : null;
      const minPrice = Number.isFinite(Number(body.minPrice)) ? String(body.minPrice) : "0";
      const maxPrice = Number.isFinite(Number(body.maxPrice)) ? String(body.maxPrice) : "0";
      const isActive = body.isActive === undefined ? true : Boolean(body.isActive);

      const [created] = await db
        .insert(pricingRules)
        .values({
          name,
          category: (category as any) ?? null,
          urgency: (urgency as any) ?? null,
          scope,
          minPrice,
          maxPrice,
          isActive,
          updatedAt: new Date(),
        })
        .returning();

      return res.status(201).json(created);
    } catch (error) {
      next(error);
    }
  });

  app.patch("/api/admin/pricing-rules/:id", requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      const id = String(req.params.id || "");
      const body = (req.body ?? {}) as any;

      const patch: any = { updatedAt: new Date() };
      if (typeof body.name === "string") patch.name = body.name.trim();
      if (typeof body.category === "string" || body.category === null) patch.category = body.category as any;
      if (typeof body.urgency === "string" || body.urgency === null) patch.urgency = body.urgency as any;
      if (typeof body.scope === "string" || body.scope === null) patch.scope = body.scope;
      if (body.minPrice !== undefined && Number.isFinite(Number(body.minPrice))) patch.minPrice = String(body.minPrice);
      if (body.maxPrice !== undefined && Number.isFinite(Number(body.maxPrice))) patch.maxPrice = String(body.maxPrice);
      if (body.isActive !== undefined) patch.isActive = Boolean(body.isActive);

      const updated = await db
        .update(pricingRules)
        .set(patch)
        .where(eq(pricingRules.id, id))
        .returning();

      if (!updated.length) return res.status(404).json({ message: "Not found" });
      return res.json(updated[0]);
    } catch (error) {
      next(error);
    }
  });

  // --- SUPER_ADMIN-only Provider Matching ---
  app.get("/api/admin/providers/matching", requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      const providers = await db
        .select({
          id: users.id,
          name: users.name,
          email: users.email,
          phone: users.phone,
          categories: users.categories,
          serviceCategory: users.serviceCategory,
          isActive: users.isActive,
          isApproved: users.isApproved,
        })
        .from(users)
        .where(eq(users.role, "provider" as any));

      const settingsRows = await db
        .select({
          providerId: providerMatchingSettings.providerId,
          isEnabled: providerMatchingSettings.isEnabled,
          settings: providerMatchingSettings.settings,
          updatedAt: providerMatchingSettings.updatedAt,
        })
        .from(providerMatchingSettings);

      const settingsByProvider = new Map<string, any>();
      for (const row of settingsRows || []) settingsByProvider.set(row.providerId, row);

      return res.json(
        (providers || []).map((p: any) => ({
          ...p,
          matching: settingsByProvider.get(p.id) ?? { isEnabled: true, settings: {}, updatedAt: null },
        }))
      );
    } catch (error) {
      next(error);
    }
  });

  app.patch(
    "/api/admin/providers/:id/matching-settings",
    requireAuth,
    requireSuperAdmin,
    async (req, res, next) => {
      try {
        const providerId = String(req.params.id || "");
        const body = (req.body ?? {}) as any;
        const isEnabled = body.isEnabled === undefined ? undefined : Boolean(body.isEnabled);
        const settings = typeof body.settings === "object" && body.settings ? body.settings : undefined;

        const existing = await db
          .select({ id: providerMatchingSettings.id })
          .from(providerMatchingSettings)
          .where(eq(providerMatchingSettings.providerId, providerId))
          .limit(1);

        if (existing.length) {
          const patch: any = { updatedAt: new Date() };
          if (isEnabled !== undefined) patch.isEnabled = isEnabled;
          if (settings !== undefined) patch.settings = settings;
          const updated = await db
            .update(providerMatchingSettings)
            .set(patch)
            .where(eq(providerMatchingSettings.providerId, providerId))
            .returning();
          return res.json(updated[0]);
        }

        const [created] = await db
          .insert(providerMatchingSettings)
          .values({
            providerId,
            isEnabled: isEnabled ?? true,
            settings: settings ?? {},
            updatedAt: new Date(),
          })
          .returning();

        return res.status(201).json(created);
      } catch (error) {
        next(error);
      }
    }
  );

  // ========== AI Conversation Flow Settings ==========
  // GET all AI conversation flow settings
  app.get("/api/admin/ai-conversation-flow", requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      const settings = await db
        .select()
        .from(aiConversationFlowSettings)
        .orderBy(asc(aiConversationFlowSettings.displayOrder));
      return res.json(settings);
    } catch (error) {
      next(error);
    }
  });

  // POST create new AI conversation flow setting
  app.post("/api/admin/ai-conversation-flow", requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      const body = req.body ?? {};
      
      // Validate required fields
      if (!body.categoryKey || !body.categoryName) {
        return res.status(400).json({ message: "categoryKey and categoryName are required" });
      }

      // Check if category already exists
      const existing = await db
        .select({ id: aiConversationFlowSettings.id })
        .from(aiConversationFlowSettings)
        .where(eq(aiConversationFlowSettings.categoryKey, body.categoryKey))
        .limit(1);

      if (existing.length) {
        return res.status(400).json({ message: "Category with this key already exists" });
      }

      // Get next display order
      const maxOrderResult = await db
        .select({ maxOrder: sql<number>`COALESCE(MAX(${aiConversationFlowSettings.displayOrder}), 0)` })
        .from(aiConversationFlowSettings);
      const nextOrder = (maxOrderResult[0]?.maxOrder ?? 0) + 1;

      const [created] = await db
        .insert(aiConversationFlowSettings)
        .values({
          categoryKey: body.categoryKey.trim(),
          categoryName: body.categoryName.trim(),
          isEnabled: body.isEnabled ?? true,
          displayOrder: body.displayOrder ?? nextOrder,
          emoji: body.emoji || null,
          description: body.description || null,
          initialMessage: body.initialMessage || null,
          followUpSteps: body.followUpSteps || null,
          confidenceThreshold: body.confidenceThreshold ? String(body.confidenceThreshold) : null,
          visualsHelpful: body.visualsHelpful ?? true,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();

      return res.status(201).json(created);
    } catch (error) {
      next(error);
    }
  });

  // PATCH update AI conversation flow setting
  app.patch("/api/admin/ai-conversation-flow/:id", requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      const id = String(req.params.id || "");
      const body = req.body ?? {};

      const patch: any = { updatedAt: new Date() };
      
      if (typeof body.categoryName === "string") patch.categoryName = body.categoryName.trim();
      if (body.isEnabled !== undefined) patch.isEnabled = Boolean(body.isEnabled);
      if (body.displayOrder !== undefined && Number.isFinite(Number(body.displayOrder))) {
        patch.displayOrder = Number(body.displayOrder);
      }
      if (body.emoji !== undefined) patch.emoji = body.emoji || null;
      if (body.description !== undefined) patch.description = body.description || null;
      if (body.initialMessage !== undefined) patch.initialMessage = body.initialMessage || null;
      if (body.followUpSteps !== undefined) patch.followUpSteps = body.followUpSteps;
      if (body.confidenceThreshold !== undefined) {
        patch.confidenceThreshold = body.confidenceThreshold ? String(body.confidenceThreshold) : null;
      }
      if (body.visualsHelpful !== undefined) patch.visualsHelpful = Boolean(body.visualsHelpful);

      const updated = await db
        .update(aiConversationFlowSettings)
        .set(patch)
        .where(eq(aiConversationFlowSettings.id, id))
        .returning();

      if (!updated.length) return res.status(404).json({ message: "Not found" });
      return res.json(updated[0]);
    } catch (error) {
      next(error);
    }
  });

  // DELETE AI conversation flow setting
  app.delete("/api/admin/ai-conversation-flow/:id", requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      const id = String(req.params.id || "");
      
      const deleted = await db
        .delete(aiConversationFlowSettings)
        .where(eq(aiConversationFlowSettings.id, id))
        .returning();

      if (!deleted.length) return res.status(404).json({ message: "Not found" });
      return res.json({ success: true, message: "Deleted successfully" });
    } catch (error) {
      next(error);
    }
  });

  // PUT reorder AI conversation flow settings
  app.put("/api/admin/ai-conversation-flow/reorder", requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      const { orderedIds } = req.body ?? {};
      
      if (!Array.isArray(orderedIds)) {
        return res.status(400).json({ message: "orderedIds array is required" });
      }

      // Update each item's displayOrder
      for (let i = 0; i < orderedIds.length; i++) {
        await db
          .update(aiConversationFlowSettings)
          .set({ displayOrder: i + 1, updatedAt: new Date() })
          .where(eq(aiConversationFlowSettings.id, orderedIds[i]));
      }

      const updated = await db
        .select()
        .from(aiConversationFlowSettings)
        .orderBy(asc(aiConversationFlowSettings.displayOrder));

      return res.json(updated);
    } catch (error) {
      next(error);
    }
  });

  // Seed default categories if none exist
  app.post("/api/admin/ai-conversation-flow/seed", requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      const existing = await db.select({ id: aiConversationFlowSettings.id }).from(aiConversationFlowSettings).limit(1);
      
      if (existing.length) {
        return res.json({ message: "Categories already exist", seeded: false });
      }

      const defaultCategories = [
        { categoryKey: "plumber", categoryName: "Plumber", emoji: "🔧", description: "Plumbing repairs and installations", displayOrder: 1 },
        { categoryKey: "electrician", categoryName: "Electrician", emoji: "⚡", description: "Electrical repairs and installations", displayOrder: 2 },
        { categoryKey: "carpenter", categoryName: "Carpenter", emoji: "🪚", description: "Woodwork and furniture repairs", displayOrder: 3 },
        { categoryKey: "painter", categoryName: "Painter", emoji: "🎨", description: "Painting and wall treatments", displayOrder: 4 },
        { categoryKey: "cleaner", categoryName: "Cleaner", emoji: "🧹", description: "Cleaning and sanitation services", displayOrder: 5 },
        { categoryKey: "hvac", categoryName: "HVAC", emoji: "❄️", description: "Heating, ventilation, and air conditioning", displayOrder: 6 },
        { categoryKey: "landscaper", categoryName: "Landscaper", emoji: "🌳", description: "Garden and outdoor maintenance", displayOrder: 7 },
        { categoryKey: "pest_control", categoryName: "Pest Control", emoji: "🐜", description: "Pest removal and prevention", displayOrder: 8 },
        { categoryKey: "appliance_repair", categoryName: "Appliance Repair", emoji: "🔌", description: "Home appliance repairs", displayOrder: 9 },
        { categoryKey: "locksmith", categoryName: "Locksmith", emoji: "🔐", description: "Lock and key services", displayOrder: 10 },
        { categoryKey: "moving", categoryName: "Moving", emoji: "📦", description: "Moving and relocation services", displayOrder: 11 },
        { categoryKey: "security", categoryName: "Security", emoji: "🛡️", description: "Security systems and monitoring", displayOrder: 12 },
        { categoryKey: "store_owner", categoryName: "Store Owner", emoji: "🏪", description: "Store management and operations", displayOrder: 13 },
        { categoryKey: "market_runner", categoryName: "Market Runner", emoji: "🏃", description: "Errand and delivery services", displayOrder: 14 },
        { categoryKey: "item_vendor", categoryName: "Item Vendor", emoji: "🛒", description: "Product sales and vendors", displayOrder: 15 },
        { categoryKey: "alarm_system", categoryName: "Alarm System", emoji: "🚨", description: "Alarm installation and monitoring", displayOrder: 16 },
        { categoryKey: "packaging_solutions", categoryName: "Packaging Solutions", emoji: "📤", description: "Packaging and shipping services", displayOrder: 17 },
        { categoryKey: "general", categoryName: "General", emoji: "📋", description: "General inquiries and requests", displayOrder: 18 },
      ];

      const inserted = await db
        .insert(aiConversationFlowSettings)
        .values(defaultCategories.map(cat => ({
          ...cat,
          isEnabled: true,
          visualsHelpful: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        })))
        .returning();

      return res.status(201).json({ message: "Default categories seeded", seeded: true, categories: inserted });
    } catch (error) {
      next(error);
    }
  });

  // ========== Request Conversation Settings & Questions ==========
  app.get("/api/admin/request-config/settings", requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      const [settings] = await db
        .select()
        .from(requestConversationSettings)
        .orderBy(desc(requestConversationSettings.updatedAt))
        .limit(1);
      return res.json(settings || null);
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/admin/request-config/questions", requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      const mode = typeof req.query.mode === "string" ? req.query.mode : undefined;
      let query = db.select().from(requestQuestions);
      if (mode) {
        query = query.where(eq(requestQuestions.mode, mode as any));
      }
      const rows = await query.orderBy(asc(requestQuestions.order));
      return res.json(rows);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/admin/request-config/questions", requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      const parsed = RequestQuestionSchema.parse(req.body || {});
      const maxOrder = await db
        .select({ maxOrder: sql<number>`COALESCE(MAX(${requestQuestions.order}), 0)` })
        .from(requestQuestions)
        .where(eq(requestQuestions.mode, parsed.mode));
      const nextOrder = parsed.order ?? ((maxOrder[0]?.maxOrder ?? 0) + 1);

      const [created] = await db
        .insert(requestQuestions)
        .values({
          mode: parsed.mode,
          scope: parsed.scope ?? "global",
          categoryKey: parsed.categoryKey ?? null,
          key: parsed.key.trim(),
          label: parsed.label.trim(),
          type: parsed.type,
          required: parsed.required ?? false,
          options: parsed.options ?? null,
          order: nextOrder,
          isEnabled: parsed.isEnabled ?? true,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();

      return res.status(201).json(created);
    } catch (error) {
      next(error);
    }
  });

  app.patch("/api/admin/request-config/questions/:id", requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      const id = String(req.params.id || "");
      const parsed = RequestQuestionSchema.partial().parse(req.body || {});
      const patch: any = { updatedAt: new Date() };
      if (parsed.mode) patch.mode = parsed.mode;
      if (parsed.scope) patch.scope = parsed.scope;
      if (parsed.categoryKey !== undefined) patch.categoryKey = parsed.categoryKey ?? null;
      if (parsed.key) patch.key = parsed.key.trim();
      if (parsed.label) patch.label = parsed.label.trim();
      if (parsed.type) patch.type = parsed.type;
      if (parsed.required !== undefined) patch.required = parsed.required;
      if (parsed.options !== undefined) patch.options = parsed.options ?? null;
      if (parsed.order !== undefined && Number.isFinite(Number(parsed.order))) patch.order = Number(parsed.order);
      if (parsed.isEnabled !== undefined) patch.isEnabled = parsed.isEnabled;

      const updated = await db
        .update(requestQuestions)
        .set(patch)
        .where(eq(requestQuestions.id, id))
        .returning();

      if (!updated.length) return res.status(404).json({ message: "Not found" });
      return res.json(updated[0]);
    } catch (error) {
      next(error);
    }
  });

  app.delete("/api/admin/request-config/questions/:id", requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      const id = String(req.params.id || "");
      const deleted = await db
        .delete(requestQuestions)
        .where(eq(requestQuestions.id, id))
        .returning();
      if (!deleted.length) return res.status(404).json({ message: "Not found" });
      return res.json({ success: true });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/admin/request-config/questions/reorder", requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      const { orderedIds } = req.body ?? {};
      if (!Array.isArray(orderedIds)) {
        return res.status(400).json({ message: "orderedIds array is required" });
      }
      for (let i = 0; i < orderedIds.length; i++) {
        await db
          .update(requestQuestions)
          .set({ order: i + 1, updatedAt: new Date() })
          .where(eq(requestQuestions.id, orderedIds[i]));
      }
      const updated = await db.select().from(requestQuestions).orderBy(asc(requestQuestions.order));
      return res.json(updated);
    } catch (error) {
      next(error);
    }
  });

  app.patch("/api/admin/request-config/settings", requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      const parsed = RequestConfigSettingsSchema.parse(req.body || {});
      const [existing] = await db
        .select({ id: requestConversationSettings.id })
        .from(requestConversationSettings)
        .limit(1);

      if (!existing) {
        const [created] = await db
          .insert(requestConversationSettings)
          .values({
            mode: parsed.mode ?? "ai",
            aiProvider: parsed.aiProvider ?? "gemini",
            aiModel: parsed.aiModel ?? null,
            aiTemperature: parsed.aiTemperature ?? null,
            aiSystemPrompt: parsed.aiSystemPrompt ?? null,
            ordinaryPresentation: parsed.ordinaryPresentation ?? "chat",
            adminWaitThresholdMs: parsed.adminWaitThresholdMs ?? 300000,
            createdAt: new Date(),
            updatedAt: new Date(),
          })
          .returning();
        return res.status(201).json(created);
      }

      const patch: any = { updatedAt: new Date() };
      if (parsed.mode) patch.mode = parsed.mode;
      if (parsed.aiProvider) patch.aiProvider = parsed.aiProvider;
      if (parsed.aiModel !== undefined) patch.aiModel = parsed.aiModel ?? null;
      if (parsed.aiTemperature !== undefined) patch.aiTemperature = parsed.aiTemperature ?? null;
      if (parsed.aiSystemPrompt !== undefined) patch.aiSystemPrompt = parsed.aiSystemPrompt ?? null;
      if (parsed.ordinaryPresentation) patch.ordinaryPresentation = parsed.ordinaryPresentation;
      if (parsed.adminWaitThresholdMs !== undefined) patch.adminWaitThresholdMs = parsed.adminWaitThresholdMs ?? 300000;

      const updated = await db
        .update(requestConversationSettings)
        .set(patch)
        .where(eq(requestConversationSettings.id, existing.id))
        .returning();

      return res.json(updated[0]);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/admin/request-config/test-model", requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      const TestModelSchema = z.object({
        provider: z.enum(["gemini", "ollama", "openai"]),
        model: z.string().min(1),
      });
      const parsed = TestModelSchema.parse(req.body || {});
      const prompt = "Reply with: OK";
      const start = Date.now();

      if (parsed.provider === "ollama") {
        const out = await ollamaChat({
          model: parsed.model,
          temperature: 0,
          messages: [{ role: "user", content: prompt }],
        });
        const text = out?.message?.content || "";
        return res.json({ ok: true, provider: parsed.provider, model: parsed.model, elapsedMs: Date.now() - start, sample: text.slice(0, 80) });
      }

      if (parsed.provider === "gemini") {
        const result = await generateGeminiContent(parsed.model, prompt);
        const text = result.text || "";
        return res.json({ ok: true, provider: parsed.provider, model: parsed.model, elapsedMs: Date.now() - start, sample: text.slice(0, 80) });
      }

      if (parsed.provider === "openai") {
        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) {
          return res.status(400).json({ ok: false, error: "OpenAI API key is not configured." });
        }
        const response = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: parsed.model,
            temperature: 0,
            messages: [{ role: "user", content: prompt }],
          }),
        });
        if (!response.ok) {
          const text = await response.text();
          return res.status(502).json({ ok: false, error: text || "Failed to reach OpenAI" });
        }
        const json = await response.json();
        const text = json?.choices?.[0]?.message?.content || "";
        return res.json({ ok: true, provider: parsed.provider, model: parsed.model, elapsedMs: Date.now() - start, sample: text.slice(0, 80) });
      }

      return res.status(400).json({ ok: false, error: "Unsupported provider." });
    } catch (error) {
      next(error);
    }
  });

  // Admin: Send advice with inspection dates/times to resident
  app.post("/api/admin/service-requests/:id/advice", async (req, res, next) => {
    try {
      if (!req.isAuthenticated() || req.user?.role !== "admin") {
        return res.status(401).json({ message: "Unauthorized - Admin only" });
      }

      const { id } = req.params;
      const { message, inspectionDates, inspectionTimes } = req.body;

      if (!message || !inspectionDates || !Array.isArray(inspectionDates)) {
        return res.status(400).json({ message: "Message and inspection dates are required" });
      }

      // Update the service request with advice metadata
      const updated = await storage.updateServiceRequest(id, {
        adviceMessage: message,
        inspectionDates,
        inspectionTimes: inspectionTimes || [],
      });

      if (!updated) {
        return res.status(404).json({ message: "Service request not found" });
      }

      if (updated.residentId) {
        const notification = await storage.createNotification({
          userId: updated.residentId,
          title: "New Update on Your Request",
          message: "An admin left an update on your request.",
          type: "info",
        });
        const io = req.app.get("io") as SocketIOServer | undefined;
        io?.to(`user-${updated.residentId}`).emit("notification:new", notification);
      }

      emitServiceRequestUpdate(req.app, updated, "advice");

      // TODO: Send notification/email to the resident
      res.json({ success: true, message: "Advice sent successfully", request: updated });
    } catch (error) {
      next(error);
    }
  });

  // Admin: Assign provider to a service request
  app.post("/api/admin/service-requests/:id/assign", async (req, res, next) => {
    try {
      if (
        !req.isAuthenticated() ||
        (
          req.user?.role !== "admin" &&
          req.user?.role !== "estate_admin" &&
          req.user?.globalRole !== "super_admin"
        )
      ) {
        return res.status(401).json({ message: "Unauthorized - Admin only" });
      }

      const { id } = req.params;
      const { providerId } = req.body;

      if (!providerId) {
        return res.status(400).json({ message: "Provider ID is required" });
      }

      const serviceRequest = await storage.assignServiceRequest(id, providerId);

      if (!serviceRequest) {
        return res.status(404).json({ message: "Service request not found" });
      }

      if (serviceRequest.residentId) {
        const notification = await storage.createNotification({
          userId: serviceRequest.residentId,
          title: "Provider Assigned",
          message: "A provider has been assigned to your request.",
          type: "info",
        });
        const io = req.app.get("io") as SocketIOServer | undefined;
        io?.to(`user-${serviceRequest.residentId}`).emit("notification:new", notification);
      }

      emitServiceRequestUpdate(req.app, serviceRequest, "assigned");

      // TODO: Send notification to the assigned provider
      res.json({ success: true, message: "Provider assigned successfully", request: serviceRequest });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/admin/service-requests/:id/request-payment", async (req, res, next) => {
    try {
      if (
        !req.isAuthenticated() ||
        (
          req.user?.role !== "admin" &&
          req.user?.role !== "estate_admin" &&
          req.user?.globalRole !== "super_admin"
        )
      ) {
        return res.status(401).json({ message: "Unauthorized - Admin only" });
      }

      const { id } = req.params;
      const actorId = req.auth?.userId ?? req.user?.id;
      const payload = z
        .object({
          amount: z.union([z.string(), z.number()]).optional(),
          materialCost: z.preprocess(
            (value) => (value === "" || value === null || value === undefined ? undefined : Number(value)),
            z.number().nonnegative().optional(),
          ),
          serviceCost: z.preprocess(
            (value) => (value === "" || value === null || value === undefined ? undefined : Number(value)),
            z.number().nonnegative().optional(),
          ),
          note: z.string().trim().max(1000).optional(),
          providerId: z.string().trim().min(1).optional(),
        })
        .parse(req.body || {});

      const request = await storage.getServiceRequest(id);
      if (!request) {
        return res.status(404).json({ message: "Service request not found" });
      }

      const statusKey = normalizeServiceRequestStatusKey(request.status);
      if (["assigned_for_job", "in_progress", "completed", "cancelled"].includes(statusKey)) {
        return res.status(400).json({
          message: "Payment request can only be raised before the request is assigned for job",
        });
      }

      if (!request.consultancyReportSubmittedAt || !request.consultancyReport) {
        return res.status(400).json({
          message: "Provider consultancy report is required before requesting payment",
        });
      }

      const report =
        request.consultancyReport && typeof request.consultancyReport === "object"
          ? ({ ...(request.consultancyReport as any) } as Record<string, any>)
          : {};

      const reportMaterialCost = Number(report.materialCost || 0);
      const reportServiceCost = Number(report.serviceCost || 0);

      const materialCost =
        payload.materialCost ?? (Number.isFinite(reportMaterialCost) && reportMaterialCost >= 0 ? reportMaterialCost : 0);
      const serviceCost =
        payload.serviceCost ?? (Number.isFinite(reportServiceCost) && reportServiceCost >= 0 ? reportServiceCost : 0);

      if (!Number.isFinite(materialCost) || materialCost < 0 || !Number.isFinite(serviceCost) || serviceCost < 0) {
        return res.status(400).json({ message: "Material and service cost must be valid non-negative numbers" });
      }

      const totalFromBreakdown = materialCost + serviceCost;
      const requestedAmount =
        payload.amount === undefined || payload.amount === null || payload.amount === ""
          ? totalFromBreakdown
          : Number(payload.amount);
      if (!Number.isFinite(requestedAmount) || requestedAmount <= 0) {
        return res.status(400).json({ message: "Enter a valid amount greater than 0" });
      }

      const nextProviderId = payload.providerId || request.providerId || undefined;
      if (!nextProviderId) {
        return res.status(400).json({ message: "Assign a provider before requesting job payment" });
      }

      report.materialCost = materialCost;
      report.serviceCost = serviceCost;
      report.totalRecommendation = totalFromBreakdown;
      report.reviewedByAdminAt = new Date().toISOString();
      if (actorId) {
        report.reviewedByAdminId = actorId;
      }

      const amountText = requestedAmount.toString();
      const adminNote = payload.note
        ? `${request.adminNotes ? `${request.adminNotes}\n` : ""}[Payment request] ${payload.note}`
        : request.adminNotes;

      const updated = await storage.updateServiceRequest(id, {
        providerId: nextProviderId,
        status: "assigned",
        assignedAt: request.assignedAt || new Date(),
        paymentStatus: "pending",
        paymentRequestedAt: new Date(),
        billedAmount: amountText as any,
        consultancyReport: report as any,
        ...(adminNote ? { adminNotes: adminNote } : {}),
      } as any);

      if (!updated) {
        return res.status(404).json({ message: "Service request not found" });
      }

      if (actorId) {
        const paymentMessage =
          `Service payment requested: NGN ${Number(amountText).toLocaleString()}.` +
          (payload.note ? ` ${payload.note}` : "");
        const inserted = await storage.addRequestMessage(
          updated.id,
          actorId,
          "admin",
          paymentMessage,
        );
        const io = req.app.get("io") as SocketIOServer | undefined;
        const participantIds = new Set<string>();
        if (updated.residentId) participantIds.add(updated.residentId);
        if (updated.providerId) participantIds.add(updated.providerId);
        for (const participantUserId of participantIds) {
          io?.to(`user-${participantUserId}`).emit("request-message:new", {
            requestId: updated.id,
            message: inserted,
          });
        }
      }

      if (updated.residentId) {
        const notification = await storage.createNotification({
          userId: updated.residentId,
          title: "Payment requested",
          message: "A payment request has been sent for your service job.",
          type: "info",
          metadata: {
            requestId: updated.id,
            kind: "job_payment_requested",
          },
        });
        const io = req.app.get("io") as SocketIOServer | undefined;
        io?.to(`user-${updated.residentId}`).emit("notification:new", notification);
      }

      emitServiceRequestUpdate(req.app, updated, "status");
      res.json({ success: true, message: "Payment request sent", request: updated });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/admin/service-requests/:id/reassign-job-provider", async (req, res, next) => {
    try {
      if (
        !req.isAuthenticated() ||
        (
          req.user?.role !== "admin" &&
          req.user?.role !== "estate_admin" &&
          req.user?.globalRole !== "super_admin"
        )
      ) {
        return res.status(401).json({ message: "Unauthorized - Admin only" });
      }

      const actorId = req.auth?.userId ?? req.user?.id;
      if (!actorId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { id } = req.params;
      const payload = z
        .object({
          providerId: z.string().trim().min(1),
          reason: z.string().trim().min(5).max(1000),
          evidence: z.string().trim().min(3).max(2000),
        })
        .parse(req.body || {});

      const request = await storage.getServiceRequest(id);
      if (!request) {
        return res.status(404).json({ message: "Service request not found" });
      }

      const statusKey = normalizeServiceRequestStatusKey(request.status);
      if (!["assigned_for_job", "in_progress"].includes(statusKey)) {
        return res.status(400).json({
          message: "Provider change is only allowed after job assignment",
        });
      }

      const paymentStatus = String(request.paymentStatus || "").toLowerCase();
      if (paymentStatus !== "paid") {
        return res.status(400).json({
          message: "Resident payment must be completed before changing the job provider",
        });
      }

      const nextProviderId = String(payload.providerId || "").trim();
      if (!nextProviderId) {
        return res.status(400).json({ message: "A provider is required" });
      }

      const previousProviderId = request.providerId ? String(request.providerId) : "";
      if (previousProviderId && previousProviderId === nextProviderId) {
        return res.status(400).json({ message: "Select a different provider" });
      }

      const auditNote =
        `[Provider changed for job ${new Date().toISOString()}] ` +
        `From: ${previousProviderId || "unassigned"}; To: ${nextProviderId}; ` +
        `Reason: ${payload.reason}; Evidence: ${payload.evidence}`;

      const updated = await storage.updateServiceRequest(id, {
        providerId: nextProviderId,
        status: "assigned_for_job" as any,
        assignedAt: request.assignedAt || new Date(),
        approvedForJobAt: request.approvedForJobAt || new Date(),
        approvedForJobBy: request.approvedForJobBy || actorId,
        adminNotes: `${request.adminNotes ? `${request.adminNotes}\n` : ""}${auditNote}`,
      });

      if (!updated) {
        return res.status(404).json({ message: "Service request not found" });
      }

      const reassignMessage =
        `Provider changed for this job. Reason: ${payload.reason}. Evidence: ${payload.evidence}.`;
      const inserted = await storage.addRequestMessage(updated.id, actorId, "admin", reassignMessage);

      const io = req.app.get("io") as SocketIOServer | undefined;
      const participantIds = new Set<string>();
      if (updated.residentId) participantIds.add(updated.residentId);
      if (previousProviderId) participantIds.add(previousProviderId);
      if (updated.providerId) participantIds.add(updated.providerId);

      for (const participantUserId of participantIds) {
        io?.to(`user-${participantUserId}`).emit("request-message:new", {
          requestId: updated.id,
          message: inserted,
        });
      }

      if (updated.residentId) {
        const residentNotification = await storage.createNotification({
          userId: updated.residentId,
          title: "Provider updated",
          message: "The provider assigned to your job has been changed by admin.",
          type: "info",
          metadata: {
            requestId: updated.id,
            kind: "request_status",
          },
        });
        io?.to(`user-${updated.residentId}`).emit("notification:new", residentNotification);
      }

      if (updated.providerId) {
        const providerNotification = await storage.createNotification({
          userId: updated.providerId,
          title: "You were assigned to a paid job",
          message: "Admin has assigned this paid request to you for execution.",
          type: "info",
          metadata: {
            requestId: updated.id,
            kind: "request_status",
          },
        });
        io?.to(`user-${updated.providerId}`).emit("notification:new", providerNotification);
      }

      if (previousProviderId && previousProviderId !== updated.providerId) {
        const previousProviderNotification = await storage.createNotification({
          userId: previousProviderId,
          title: "Job reassigned",
          message: "This request has been reassigned to another provider.",
          type: "info",
          metadata: {
            requestId: updated.id,
            kind: "request_status",
          },
        });
        io?.to(`user-${previousProviderId}`).emit("notification:new", previousProviderNotification);
      }

      emitServiceRequestUpdate(req.app, updated, "status");
      return res.json({ success: true, message: "Provider changed for job", request: updated });
    } catch (error) {
      next(error);
    }
  });
  app.post("/api/service-requests/:id/payment/decline", requireAuth, async (req, res, next) => {
    try {
      const actorId = req.auth?.userId ?? req.user?.id;
      const actorRole = String(req.auth?.role ?? req.user?.role ?? "").toLowerCase();
      if (!actorId || !actorRole) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { id } = req.params;
      const request = await storage.getServiceRequest(id);
      if (!request) {
        return res.status(404).json({ message: "Service request not found" });
      }

      const isResidentOwner = request.residentId === actorId;
      const isAdminActor = actorRole === "admin" || actorRole === "super_admin" || actorRole === "estate_admin";
      if (!isResidentOwner && !isAdminActor) {
        return res.status(403).json({ message: "Forbidden" });
      }

      const statusKey = normalizeServiceRequestStatusKey(request.status);
      if (["assigned_for_job", "in_progress", "completed", "cancelled"].includes(statusKey)) {
        return res.status(400).json({ message: "Payment decline is no longer allowed for this request status" });
      }

      const payload = z
        .object({
          reason: z.string().trim().max(1000).optional(),
        })
        .parse(req.body || {});

      const paymentStatus = String(request.paymentStatus || "").toLowerCase();
      if (paymentStatus === "paid") {
        return res.status(400).json({ message: "Payment is already completed for this request" });
      }

      const note = payload.reason
        ? `[Payment declined] ${payload.reason}`
        : "[Payment declined] Resident declined the payment request.";
      const updated = await storage.updateServiceRequest(id, {
        paymentStatus: "cancelled",
        adminNotes: `${request.adminNotes ? `${request.adminNotes}\n` : ""}${note}`,
      } as any);

      if (!updated) {
        return res.status(404).json({ message: "Service request not found" });
      }

      const messageText = payload.reason
        ? `Payment request declined. Reason: ${payload.reason}`
        : "Payment request declined.";
      const senderRole = isAdminActor ? "admin" : "resident";
      const inserted = await storage.addRequestMessage(id, actorId, senderRole, messageText);

      const io = req.app.get("io") as SocketIOServer | undefined;
      const participantIds = new Set<string>();
      if (updated.residentId) participantIds.add(updated.residentId);
      if (updated.providerId) participantIds.add(updated.providerId);
      for (const participantUserId of participantIds) {
        io?.to(`user-${participantUserId}`).emit("request-message:new", {
          requestId: id,
          message: inserted,
        });
      }

      if (updated.providerId && isResidentOwner) {
        const providerNotification = await storage.createNotification({
          userId: updated.providerId,
          title: "Resident declined payment",
          message: "The resident declined the current payment request.",
          type: "info",
          metadata: {
            requestId: updated.id,
            kind: "job_payment_declined",
          },
        });
        io?.to(`user-${updated.providerId}`).emit("notification:new", providerNotification);
      }

      emitServiceRequestUpdate(req.app, updated, "status");
      return res.json({ success: true, message: "Payment request declined", request: updated });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/admin/service-requests/:id/approve-job", async (req, res, next) => {
    try {
      if (
        !req.isAuthenticated() ||
        (
          req.user?.role !== "admin" &&
          req.user?.role !== "estate_admin" &&
          req.user?.globalRole !== "super_admin"
        )
      ) {
        return res.status(401).json({ message: "Unauthorized - Admin only" });
      }

      const { id } = req.params;
      const payload = z
        .object({
          providerId: z.string().trim().min(1).optional(),
        })
        .parse(req.body || {});

      const request = await storage.getServiceRequest(id);
      if (!request) {
        return res.status(404).json({ message: "Service request not found" });
      }

      const providerId = payload.providerId || request.providerId;
      if (!providerId) {
        return res.status(400).json({ message: "Assign a provider before approving for job" });
      }

      if (!request.paymentRequestedAt) {
        return res.status(400).json({ message: "Payment has not been requested for this request yet" });
      }

      const paymentStatus = String(request.paymentStatus || "").toLowerCase();
      if (paymentStatus !== "paid") {
        return res.status(400).json({ message: "Resident payment is required before job approval" });
      }

      const updated = await storage.updateServiceRequest(id, {
        providerId,
        status: "assigned_for_job" as any,
        approvedForJobAt: new Date(),
        approvedForJobBy: req.user?.id,
        assignedAt: request.assignedAt || new Date(),
      });

      if (!updated) {
        return res.status(404).json({ message: "Service request not found" });
      }

      const io = req.app.get("io") as SocketIOServer | undefined;

      if (updated.residentId) {
        const residentNotification = await storage.createNotification({
          userId: updated.residentId,
          title: "Job approved",
          message: "Your request is approved and assigned for job execution.",
          type: "success",
          metadata: {
            requestId: updated.id,
            kind: "request_status",
          },
        });
        io?.to(`user-${updated.residentId}`).emit("notification:new", residentNotification);
      }

      if (updated.providerId) {
        const providerNotification = await storage.createNotification({
          userId: updated.providerId,
          title: "Proceed with service",
          message: "This request has been approved. You can start the job.",
          type: "info",
          metadata: {
            requestId: updated.id,
            kind: "request_status",
          },
        });
        io?.to(`user-${updated.providerId}`).emit("notification:new", providerNotification);
      }

      emitServiceRequestUpdate(req.app, updated, "status");
      res.json({ success: true, message: "Request approved for job", request: updated });
    } catch (error) {
      next(error);
    }
  });

  // Wallet Routes
  app.get("/api/wallet", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const wallet = await storage.getWalletByUserId(req.user.id);
      res.json(wallet);
    } catch (error) {
      next(error);
    }
  });

  // Paystack Payments
  app.post("/api/payments/paystack/session", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const payload = z
        .object({
          amount: z.preprocess((val) => Number(val), z.number().positive()),
          serviceRequestId: z.string().optional(),
          description: z.string().optional(),
          consultancyRequest: z
            .object({
              categoryKey: z.string().optional(),
              categoryLabel: z.string().optional(),
              urgency: z.string().optional(),
              location: z.string().optional(),
              description: z.string().optional(),
              attachmentsCount: z.number().optional(),
            })
            .optional(),
        })
        .parse(req.body || {});

      if (payload.serviceRequestId) {
        const request = await storage.getServiceRequest(payload.serviceRequestId);
        if (!request) {
          return res.status(404).json({ message: "Service request not found" });
        }
        const isOwner =
          req.user?.role === "admin" || request.residentId === req.user?.id;
        if (!isOwner) {
          return res.status(403).json({ message: "Forbidden" });
        }
      }

      let createdServiceRequestId: string | undefined;
      if (payload.consultancyRequest) {
        const category = resolveServiceRequestCategory(
          payload.consultancyRequest.categoryKey || "",
          payload.consultancyRequest.categoryLabel || "",
        );
        const urgencyInput = normalizeCategoryKey(payload.consultancyRequest.urgency || "");
        const urgency =
          urgencyInput === "emergency" || urgencyInput === "high" || urgencyInput === "medium" || urgencyInput === "low"
            ? urgencyInput
            : "medium";
        const location = String(payload.consultancyRequest.location || "Not specified");
        const description =
          String(payload.consultancyRequest.description || "Consultancy request").trim() ||
          "Consultancy request";

        const created = await storage.createServiceRequest({
          category: category as any,
          description,
          residentId: req.user.id,
          budget: "Consultancy",
          urgency: urgency as any,
          location,
          status: "pending_inspection" as any,
          paymentStatus: "pending",
        });
        createdServiceRequestId = created.id;
      }

      const session = await createPendingPaystackTransaction({
        userId: req.user.id,
        amount: payload.amount,
        serviceRequestId: payload.serviceRequestId ?? createdServiceRequestId,
        description: payload.description,
        meta: {
          initiatorId: req.user.id,
          serviceRequestId: payload.serviceRequestId ?? createdServiceRequestId,
          consultancyRequest: payload.consultancyRequest ?? null,
        },
      });

      res.json({
        reference: session.reference,
        amountKobo: session.amountKobo,
        amountFormatted: session.amountFormatted,
      });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/paystack/init", (req, res, next) => {
    if (!req.isAuthenticated?.() || !req.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    next();
  }, async (req, res, next) => {
    try {
      const payload = z.object({
        email: z.string().email().optional(),
        amountInNaira: z.number().positive(),
        metadata: z.record(z.any()).optional(),
        reference: z.string().optional(),
        callbackUrl: z.string().url().optional(),
      });

      const { email, amountInNaira, metadata, reference, callbackUrl } = payload.parse(req.body || {});
      const user = req.user as any;
      const resolvedEmail = (email || user?.email || "").toString().trim().toLowerCase();
      if (!resolvedEmail) {
        return res.status(400).json({ error: "Email is required to initialize Paystack." });
      }

      // Ensure wallet exists for the user
      let wallet = await storage.getWalletByUserId(user.id);
      if (!wallet) {
        wallet = await storage.createWallet({
          userId: user.id,
          balance: "0.00",
        });
      }

      // Create a transaction record in the database
      const txReference = reference || `CCD-${Date.now()}-${randomBytes(4).toString('hex')}`;
      const amountFormatted = (amountInNaira).toFixed(2);
      
      try {
        await storage.createTransaction({
          walletId: wallet.id,
          userId: user.id,
          amount: amountFormatted,
          type: TransactionType.DEBIT,
          status: TransactionStatus.PENDING,
          description: "Marketplace order payment",
          reference: txReference,
          meta: metadata as Prisma.InputJsonValue || null,
          gateway: "paystack",
        });
      } catch (txError: any) {
        console.error("Failed to create transaction:", {
          error: txError?.message,
          reference: txReference,
          userId: user.id,
        });
        // Continue anyway - the transaction creation isn't critical
      }

      // Initialize with Paystack using our reference
      console.log("Initializing Paystack with:", {
        email: resolvedEmail,
        amountInNaira,
        reference: txReference,
        hasCallbackUrl: !!callbackUrl,
      });

      const result = await initializePaystackTransaction({
        email: resolvedEmail,
        amountInNaira,
        metadata,
        reference: txReference,
        callbackUrl,
      });

      console.log("Paystack init successful:", { reference: txReference, hasAuthUrl: !!result.authorizationUrl });

      res.json({
        ...result,
        reference: txReference,
      });
    } catch (error: any) {
      console.error("Paystack init error:", {
        message: error?.message,
        status: error?.status,
        stack: error?.stack,
      });
      return res.status(500).json({ 
        error: error?.message || "Unable to initialize Paystack payment at this time.",
        details: process.env.NODE_ENV === "development" ? error?.message : undefined,
      });
    }
  });

  app.post("/api/paystack/webhook", async (req, res) => {
    const rawBody = req.body;
    if (!Buffer.isBuffer(rawBody)) {
      return res.status(400).json({ received: false });
    }

    const signature = req.header("x-paystack-signature");
    // Security: reject webhook immediately if the HMAC signature does not match.
    if (!validatePaystackSignature(rawBody, signature)) {
      return res.status(401).json({ received: false });
    }

    try {
      const payload = JSON.parse(rawBody.toString("utf8"));
      const event = payload?.event;
      const data = payload?.data;
      const reference = data?.reference;

      // Security: capture webhook metadata without storing secrets for auditing.
      await storage.createAuditLog({
        actorId: "system",
        estateId: null,
        action: "paystack:webhook",
        target: "transaction",
        targetId: reference || "unknown",
        meta: {
          event,
          reference,
          receivedAt: new Date().toISOString(),
        },
        ipAddress: req.ip,
        userAgent: req.get("user-agent"),
      });

      if (event !== "charge.success" || !reference) {
        return res.json({ received: true });
      }

      // TODO: replace this with the real payment/order lookup table keyed by reference.
      const tx = await storage.getTransactionByReference(reference);
      if (!tx) {
        console.warn("Paystack webhook: transaction not found", reference);
        return res.json({ received: true });
      }

      // Security: idempotency—if already paid, just acknowledge to avoid double credits.
      if (tx.status === TransactionStatus.COMPLETED) {
        await finalizeServiceRequestAfterPayment(req.app, {
          serviceRequestId: tx.serviceRequestId,
          billedAmount: tx.amount as any,
          paymentReference: reference,
        });
        return res.json({ received: true });
      }

      const amountFromGateway =
        typeof data.amount === "number" ? data.amount / 100 : null;

      // Security: fail closed when amount or currency differ from what we expect.
      if (
        data.currency !== "NGN" ||
        amountFromGateway === null ||
        Math.abs(amountFromGateway - Number(tx.amount)) > 0.001
      ) {
        return res.json({ received: true });
      }

      // Security: only now, after all checks pass, do we mark the transaction as paid.
      await storage.updateTransactionByReference(reference, {
        status: TransactionStatus.COMPLETED,
        description: `Paystack webhook ${data.channel || "charge"}`,
        meta: {
          ...((tx.meta as Prisma.JsonObject) || {}),
          paystackWebhook: data as any,
        } as Prisma.InputJsonObject,
      });

      await finalizeServiceRequestAfterPayment(req.app, {
        serviceRequestId: tx.serviceRequestId,
        billedAmount: tx.amount as any,
        paymentReference: reference,
      });
    } catch (error: any) {
      console.error("Paystack webhook handler failed", { message: error?.message });
    }

    return res.json({ received: true });
  });

  app.get("/api/paystack/verify", async (req, res, next) => {
    try {
      const reference = (req.query.reference as string | undefined)?.trim();
      // Security: refuse requests without a reference to avoid replay attacks.
      if (!reference) {
        return res.status(400).json({ status: "failed", message: "reference query param is required" });
      }

      // TODO: ensure this lookup uses the production payment table keyed by reference.
    const tx = await storage.getTransactionByReference(reference);
    if (!tx) {
      return res.status(404).json({ status: "failed", message: "Transaction not found" });
    }

    if (tx.status === TransactionStatus.COMPLETED) {
      await finalizeServiceRequestAfterPayment(req.app, {
        serviceRequestId: tx.serviceRequestId,
        billedAmount: tx.amount as any,
        paymentReference: reference,
      });
      return res.json(formatPaystackVerifySuccess(tx));
    }

      const verification = await verifyPaystackTransaction(reference);
      // Security: make sure Paystack is telling us the charge actually succeeded.
      const charge = verification.data;

      // Security: enforce currency and success state before touching any DB rows.
      if (!verification.status || charge?.status !== "success" || charge?.currency !== "NGN") {
        return res.json({ status: "failed" });
      }

      const amountFromGateway =
        typeof charge.amount === "number" ? charge.amount / 100 : null;
      const expectedAmount = Number(tx.amount);
      if (amountFromGateway === null || Number.isNaN(amountFromGateway)) {
        return res.json({ status: "failed" });
      }

      // Security: guard against tampered amounts by comparing gateway vs expected value.
      if (Math.abs(amountFromGateway - expectedAmount) > 0.001) {
        return res.json({ status: "failed" });
      }

    const updatedTx = await storage.updateTransactionByReference(reference, {
      status: TransactionStatus.COMPLETED,
      description: `Paystack ${charge.channel || "charge"}`,
      meta: {
        ...((tx.meta as Prisma.JsonObject) || {}),
        paystack: charge as any,
      } as Prisma.InputJsonObject,
    });

    await finalizeServiceRequestAfterPayment(req.app, {
      serviceRequestId: tx.serviceRequestId,
      billedAmount: tx.amount as any,
      paymentReference: reference,
    });

    const finalTx = updatedTx ?? tx;
    res.json(formatPaystackVerifySuccess(finalTx));
  } catch (error: any) {
      console.error("Paystack verify GET error", { message: error?.message });
      res.status(500).json({ status: "failed" });
    }
  });

  app.post("/api/payments/paystack/verify", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { reference } = z
        .object({
          reference: z.string().min(6),
        })
        .parse(req.body || {});

      const tx = await storage.getTransactionByReference(reference);
      if (!tx) {
        return res.status(404).json({ message: "Transaction not found" });
      }

      if (req.user?.role !== "admin") {
        const wallet = await storage.getWalletByUserId(req.user.id);
        if (!wallet || wallet.id !== tx.walletId) {
          return res.status(403).json({ message: "Forbidden" });
        }
      }

      const result = await handlePaystackVerify({
        reference,
        storage,
        transaction: tx,
      });

      let refreshed = await storage.getTransactionByReference(reference);
      let responseTx = refreshed ?? tx;

      if (!responseTx?.serviceRequestId) {
        const meta: any = responseTx?.meta as any;
        if (meta?.consultancyRequest && req.user?.id) {
          try {
            const category = resolveServiceRequestCategory(
              meta.consultancyRequest.categoryKey || "",
              meta.consultancyRequest.categoryLabel || "",
            );
            const urgencyInput = normalizeCategoryKey(meta.consultancyRequest.urgency || "");
            const urgency =
              urgencyInput === "emergency" ||
              urgencyInput === "high" ||
              urgencyInput === "medium" ||
              urgencyInput === "low"
                ? urgencyInput
                : "medium";
            const location = String(meta.consultancyRequest.location || "Not specified");
            const description =
              String(meta.consultancyRequest.description || "Consultancy request").trim() ||
              "Consultancy request";

            const created = await storage.createServiceRequest({
              category: category as any,
              description,
              residentId: req.user.id,
              budget: "Consultancy",
              urgency: urgency as any,
              location,
              status: "pending_inspection" as any,
              paymentStatus: "paid",
            });

            await storage.updateTransactionByReference(reference, {
              serviceRequestId: created.id,
            } as any);

            refreshed = await storage.getTransactionByReference(reference);
            responseTx = refreshed ?? responseTx;
          } catch {
            // ignore
          }
        }
      }

      if (result.status === "success" && responseTx?.serviceRequestId) {
        await finalizeServiceRequestAfterPayment(req.app, {
          serviceRequestId: responseTx.serviceRequestId,
          billedAmount: responseTx.amount as any,
          paymentReference: reference,
        });
      }

      res.json({
        reference,
        ...result,
        serviceRequestId: responseTx?.serviceRequestId ?? null,
        transactionStatus: responseTx?.status ?? null,
      });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/payments/paystack/webhook", async (req, res) => {
    try {
      const rawBody = req.body;
      if (!Buffer.isBuffer(rawBody)) {
        return res.status(400).json({ message: "Invalid payload" });
      }

      const signature = req.header("x-paystack-signature") || undefined;

      if (!validatePaystackSignature(rawBody, signature)) {
        // Security: reject unsigned requests to avoid spoofed credits.
        return res.status(400).json({ message: "Invalid signature" });
      }

      const payload = JSON.parse(rawBody.toString("utf8"));
      const reference = payload?.data?.reference;

      if (reference) {
        const finalized = await verifyAndFinalizePaystackCharge(reference);
        await finalizeServiceRequestAfterPayment(req.app, {
          serviceRequestId: finalized?.transaction?.serviceRequestId || null,
          billedAmount: finalized?.transaction?.amount as any,
          paymentReference: reference,
        });
      }

      res.json({ received: true });
    } catch (error) {
      console.error("Paystack webhook error", error);
      res.status(500).json({ message: "Webhook processing failed" });
    }
  });

  // Admin Routes
  app.get("/api/admin/users", async (req, res, next) => {
    try {
      if (!isAdminOrSuper(req)) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { role } = req.query;
      const users = await storage.getUsers(role as string);
      res.json(users);
    } catch (error) {
      next(error);
    }
  });

  // Unified list with search + role filter (used by admin dashboard)
  app.get("/api/admin/users/all", async (req, res, next) => {
    try {
      if (!isAdminOrSuper(req)) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { role, search } = req.query as { role?: string; search?: string };
      const list = await storage.getUsers(role);
      const filtered = search
        ? list.filter((u) => {
            const q = search.toLowerCase();
            return (
              u.name?.toLowerCase().includes(q) ||
              u.email?.toLowerCase().includes(q) ||
              u.phone?.toLowerCase().includes(q)
            );
          })
        : list;

      res.json(filtered);
    } catch (error) {
      next(error);
    }
  });

  // Create user
  app.post("/api/admin/users", async (req, res, next) => {
    try {
      if (!isAdminOrSuper(req)) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { name, email, phone, password, role, globalRole, isActive, isApproved, company } = req.body || {};
      const roleValue = role || globalRole;
      if (!name || !email || !phone || !password || !roleValue) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      const existing = await storage.getUserByEmail(email);
      if (existing) {
        return res.status(400).json({ message: "Email already exists" });
      }

      const hashedPassword = await hashPassword(password);
      const user = await storage.createUser({
        name,
        email,
        phone,
        password: hashedPassword,
        role: roleValue,
        globalRole,
        company,
        isActive: isActive ?? true,
        isApproved: isApproved ?? true,
      } as any);

      res.status(201).json(user);
    } catch (error) {
      next(error);
    }
  });

  // Update user
  app.patch("/api/admin/users/:id", async (req, res, next) => {
    try {
      if (!isAdminOrSuper(req)) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { id } = req.params;
      const updates: any = { ...req.body, updatedAt: new Date() };
      if (req.body?.password) {
        updates.password = await hashPassword(req.body.password);
      }

      const user = await storage.updateUser(id, updates);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      res.json(user);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/admin/impersonate/:userId", async (req, res, next) => {
    try {
      if (!isAdminOrSuper(req)) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      if (req.user?.globalRole !== "super_admin") {
        return res.status(403).json({ message: "Super admin only" });
      }

      const { userId } = req.params;
      const targetUser = await storage.getUser(userId);
      if (!targetUser) {
        return res.status(404).json({ message: "User not found" });
      }

      const session = req.session as any;
      if (!session.impersonatorId) {
        session.impersonatorId = req.user?.id;
        session.impersonatorEmail = req.user?.email;
      }

      req.login(targetUser, (err) => {
        if (err) return next(err);
        res.json({ success: true });
      });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/admin/impersonate/stop", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      const session = req.session as any;
      if (!session?.impersonatorId) {
        return res.status(400).json({ message: "Not impersonating" });
      }

      const adminUser = await storage.getUser(session.impersonatorId);
      if (!adminUser) {
        return res.status(404).json({ message: "Impersonator not found" });
      }

      delete session.impersonatorId;
      delete session.impersonatorEmail;

      req.login(adminUser, (err) => {
        if (err) return next(err);
        res.json({ success: true });
      });
    } catch (error) {
      next(error);
    }
  });

  // Admin: reset a user's password (admin-only)
  app.post("/api/admin/users/:id/reset-password", async (req, res, next) => {
    try {
      if (!isAdminOrSuper(req)) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { id } = req.params;
      if (!id) return res.status(400).json({ message: "User id is required" });

      const { password: providedPassword } = req.body || {};

      // If password not provided, generate a secure temporary password
      let plainPassword = providedPassword;
      if (!plainPassword) {
        // 12 bytes -> 24 hex chars (sufficiently random for temp password)
        plainPassword = randomBytes(12).toString("hex");
      }

      const hashed = await hashPassword(plainPassword);
      const user = await storage.updateUser(id, { password: hashed } as any);
      if (!user) return res.status(404).json({ message: "User not found" });

      // Return the plaintext only if we generated it (so admins can communicate it)
      const response: any = { success: true };
      if (!providedPassword) response.tempPassword = plainPassword;

      res.json(response);
    } catch (error) {
      next(error);
    }
  });

  app.delete("/api/admin/users/:id", async (req, res, next) => {
    try {
      if (!isAdminOrSuper(req)) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { id } = req.params;
      if (!id) {
        return res.status(400).json({ message: "User id is required" });
      }

      const targetId = (await storage.getUser(id))?.id ??
        (await storage.getPostgresIdFromMongoId("user", id)) ??
        null;

      if (!targetId) {
        return res.status(404).json({ message: "User not found" });
      }

      const deleted = await storage.deleteUser(targetId);
      if (!deleted) {
        return res.status(404).json({ message: "User not found" });
      }

      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  });

  // Get memberships for a specific user
  app.get("/api/admin/users/:id/memberships", async (req, res, next) => {
    try {
      if (!isAdminOrSuper(req)) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { id: userId } = req.params;
      const userMemberships = await db
        .select({
          id: memberships.id,
          userId: memberships.userId,
          estateId: memberships.estateId,
          role: memberships.role,
          status: memberships.status,
          isActive: memberships.isActive,
          permissions: memberships.permissions,
          createdAt: memberships.createdAt,
          updatedAt: memberships.updatedAt,
          estateName: estates.name,
        })
        .from(memberships)
        .where(eq(memberships.userId, userId))
        .leftJoin(estates, eq(estates.id, memberships.estateId))
        .orderBy(desc(memberships.createdAt));

      res.json(userMemberships);
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/admin/providers", async (req, res, next) => {
    try {
      const isAdmin = req.isAuthenticated() && (req.user?.role === "admin" || req.user?.globalRole === "super_admin");
      if (!isAdmin) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { search, approved, category } = req.query;

      const providers = await storage.getProviders({
        search: search as string,
        approved: approved !== undefined ? approved === "true" : undefined,
        category: category as string,
      });

      // Enrich providers with company details if they have a company association
      const enrichedProviders = await Promise.all(
        providers.map(async (p: typeof providers[0]) => {
          if (!p.company) return p;
          // p.company currently holds just the company name/ID string
          // In a full implementation, fetch the company record to get more details
          return { ...p, companyAssociation: p.company };
        })
      );

      res.json(enrichedProviders);
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/admin/providers/pending", async (req, res, next) => {
    try {
      const isAdmin = req.isAuthenticated() && (req.user?.role === "admin" || req.user?.globalRole === "super_admin");
      if (!isAdmin) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const providers = await storage.getPendingProviders();
      res.json(providers);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/admin/providers/:id/approve", async (req, res, next) => {
    try {
      const isAdmin = req.isAuthenticated() && (req.user?.role === "admin" || req.user?.globalRole === "super_admin");
      if (!isAdmin) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { id } = req.params;
      const provider = await storage.approveProvider(id);

      if (!provider) {
        return res.status(404).json({ message: "Provider not found" });
      }

      const notification = await storage.createNotification({
        userId: provider.id,
        title: "Provider Account Approved",
        message: "Your provider account has been verified. You can now access your dashboard.",
        type: "action",
        metadata: { kind: "provider_approved" },
      });
      const io = req.app.get("io") as SocketIOServer | undefined;
      io?.to(`user-${provider.id}`).emit("notification:new", notification);
      io?.to(`user-${provider.id}`).emit("provider:approved", { ok: true });

      await storage.deleteProviderRequestByProviderId(id);
      await storage.createAuditLog({
        actorId: req.user?.id ?? "system",
        action: "approve_provider",
        target: "provider_request",
        targetId: provider.id,
        meta: {
          providerEmail: provider.email,
          providerName: provider.name,
        },
        ipAddress: req.ip,
        userAgent: req.get("user-agent") ?? "",
      });

      res.json(provider);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/admin/provider-requests/:id/decline", async (req, res, next) => {
    try {
      if (!isAdminOrSuper(req)) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      const { id } = req.params;
      const { reason } = req.body as { reason?: string };
      const request = await storage.getProviderRequestById(id);
      if (!request) {
        return res.status(404).json({ message: "Provider request not found" });
      }
      const providerId = request.providerId;
      if (providerId) {
        await storage.deleteUser(providerId);
      }
      await storage.deleteProviderRequest(id);
      await storage.createAuditLog({
        actorId: req.user?.id ?? "system",
        action: "decline_provider_request",
        target: "provider_request",
        targetId: request.id,
        meta: {
          providerEmail: request.email,
          providerName: request.name,
          reason: reason ?? "",
        },
        ipAddress: req.ip,
        userAgent: req.get("user-agent") ?? "",
      });
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  });

  // POST /api/admin/providers/:providerId/assign-company - Link provider to a company
  app.post("/api/admin/providers/:providerId/assign-company", async (req, res, next) => {
    try {
      const isAdmin = req.isAuthenticated() && (req.user?.role === "admin" || req.user?.globalRole === "super_admin");
      if (!isAdmin) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { providerId } = req.params;
      const { companyId } = req.body as { companyId: string };

      if (!companyId) {
        return res.status(400).json({ error: "companyId is required" });
      }

      // Verify provider exists
      const provider = await storage.getUser(providerId);
      if (!provider) {
        return res.status(404).json({ error: "Provider not found" });
      }

      // Update the provider's company association
      const updatedProvider = await storage.updateUser(providerId, { company: companyId });

      await storage.createAuditLog({
        actorId: req.user?.id ?? "system",
        action: "assign_provider_to_company",
        target: "provider",
        targetId: providerId,
        meta: {
          providerEmail: provider.email,
          companyId,
        },
        ipAddress: req.ip,
        userAgent: req.get("user-agent") ?? "",
      });

      res.json({ success: true, provider: updatedProvider });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/admin/providers", async (req, res, next) => {
    try {
      const userId = req.auth?.userId ?? req.user?.id;
      const isAdmin = isAdminOrSuper(req);
      const companyForUser = isAdmin ? null : await resolveCompanyForUser(userId);
      if (!isAdmin && !companyForUser) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const parsed = createProviderSchema.parse(req.body);
      if (!parsed.password) {
        return res.status(400).json({ message: "Password is required" });
      }

      const existing = await storage.getUserByEmail(parsed.email);
      if (existing) {
        return res.status(409).json({ message: "Email already exists" });
      }

      const hashedPassword = await hashPassword(parsed.password);
      const combinedName = (parsed.name || `${parsed.firstName} ${parsed.lastName}`).trim();
      const normalizedCompany = parsed.company || (companyForUser?.id ? String(companyForUser.id) : "");
      if (!isAdmin && companyForUser) {
        const companyId = String(companyForUser.id || "");
        const companyName = String(companyForUser.name || "");
        if (normalizedCompany !== companyId && normalizedCompany !== companyName) {
          return res.status(401).json({ message: "Unauthorized" });
        }
      }

      const provider = await storage.createUser({
        firstName: parsed.firstName,
        lastName: parsed.lastName,
        name: combinedName,
        email: parsed.email,
        phone: parsed.phone || "",
        password: hashedPassword,
        role: "provider",
        company: normalizedCompany,
        categories: parsed.categories,
        experience: parsed.experience,
        isApproved: isAdmin ? (parsed.isApproved ?? true) : false,
        metadata: parsed.description ? { description: parsed.description } : undefined,
      } as any);

      res.status(201).json(provider);
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
      next(error);
    }
  });

  app.get("/api/admin/stats", async (req, res, next) => {
    try {
      if (!req.isAuthenticated() || req.user?.role !== "admin") {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const stats = await storage.getUserStats();
      res.json(stats);
    } catch (error) {
      next(error);
    }
  });

  // Admin: bridge stats (users + service requests from canonical Postgres tables)
  app.get("/api/admin/bridge/stats", async (req, res, next) => {
    try {
      if (!isAdminOrSuper(req)) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const [[residents], [providers], [pendingProviders]] = await Promise.all([
        db.select({ c: count() }).from(users).where(eq(users.role, "resident")),
        db.select({ c: count() }).from(users).where(eq(users.role, "provider")),
        db
          .select({ c: count() })
          .from(users)
          .where(and(eq(users.role, "provider"), eq(users.isApproved, false))),
      ]);

      const [
        [srTotal],
        [srPending],
        [srPendingInspection],
        [srAssignedInspection],
        [srAssignedForJob],
        [srInProgress],
        [srCompleted],
        [srCancelled],
      ] =
        await Promise.all([
          db.select({ c: count() }).from(serviceRequests),
          db
            .select({ c: count() })
            .from(serviceRequests)
            .where(eq(serviceRequests.status, "pending")),
          db
            .select({ c: count() })
            .from(serviceRequests)
            .where(eq(serviceRequests.status, "pending_inspection")),
          db
            .select({ c: count() })
            .from(serviceRequests)
            .where(eq(serviceRequests.status, "assigned")),
          db
            .select({ c: count() })
            .from(serviceRequests)
            .where(eq(serviceRequests.status, "assigned_for_job")),
          db
            .select({ c: count() })
            .from(serviceRequests)
            .where(eq(serviceRequests.status, "in_progress")),
          db
            .select({ c: count() })
            .from(serviceRequests)
            .where(eq(serviceRequests.status, "completed")),
          db
            .select({ c: count() })
            .from(serviceRequests)
            .where(eq(serviceRequests.status, "cancelled")),
        ]);

      res.json({
        source: "postgresql",
        timestamp: new Date().toISOString(),
        users: {
          totalResidents: Number(residents?.c ?? 0),
          totalProviders: Number(providers?.c ?? 0),
          pendingProviders: Number(pendingProviders?.c ?? 0),
        },
        serviceRequests: {
          total: Number(srTotal?.c ?? 0),
          pending: Number(srPending?.c ?? 0),
          pendingInspection: Number(srPendingInspection?.c ?? 0),
          assigned: Number(srAssignedInspection?.c ?? 0),
          assignedForJob: Number(srAssignedForJob?.c ?? 0),
          inProgress: Number(srInProgress?.c ?? 0),
          completed: Number(srCompleted?.c ?? 0),
          cancelled: Number(srCancelled?.c ?? 0),
        },
      });
    } catch (error) {
      next(error);
    }
  });

  // Database health check
  app.get("/api/admin/health/database", async (req, res, next) => {
    try {
      if (!isAdminOrSuper(req)) return res.status(401).json({ message: "Unauthorized" });

      // Test Postgres connection and get table sizes
      const [userCount] = await db.select({ count: count() }).from(users);
      const [srCount] = await db.select({ count: count() }).from(serviceRequests);
      const [estateCount] = await db.select({ count: count() }).from(estates);

      return res.json({
        status: "healthy",
        database: "postgresql",
        timestamp: new Date().toISOString(),
        tables: {
          users: { count: Number(userCount?.count ?? 0) },
          serviceRequests: { count: Number(srCount?.count ?? 0) },
          estates: { count: Number(estateCount?.count ?? 0) },
        },
      });
    } catch (error: any) {
      return res.status(503).json({
        status: "unhealthy",
        database: "postgresql",
        error: error?.message || "Database connection failed",
        timestamp: new Date().toISOString(),
      });
    }
  });

  // Diagnostic endpoint to show if migrations were applied
  app.get("/api/admin/diagnostics/migrations", async (req, res, next) => {
    try {
      if (!isAdminOrSuper(req)) return res.status(401).json({ message: "Unauthorized" });

      // Check if critical tables exist and have data
      const [userStats] = await db.select({ count: count(), minDate: sql`min(created_at)` }).from(users);
      const [srStats] = await db.select({ count: count(), minDate: sql`min(created_at)` }).from(serviceRequests);
      const [estateStats] = await db.select({ count: count(), minDate: sql`min(created_at)` }).from(estates);

      // Count by role
      const [roleBreakdown] = await db
        .select({
          role: users.role,
          count: count(),
        })
        .from(users)
        .groupBy(users.role);

      // Count by request status
      const [statusBreakdown] = await db
        .select({
          status: serviceRequests.status,
          count: count(),
        })
        .from(serviceRequests)
        .groupBy(serviceRequests.status);

      return res.json({
        timestamp: new Date().toISOString(),
        tables: {
          users: {
            total: Number(userStats?.count ?? 0),
            oldestRecord: userStats?.minDate ? new Date(userStats.minDate).toISOString() : null,
          },
          serviceRequests: {
            total: Number(srStats?.count ?? 0),
            oldestRecord: srStats?.minDate ? new Date(srStats.minDate).toISOString() : null,
          },
          estates: {
            total: Number(estateStats?.count ?? 0),
            oldestRecord: estateStats?.minDate ? new Date(estateStats.minDate).toISOString() : null,
          },
        },
        breakdowns: {
          usersByRole: roleBreakdown || [],
          requestsByStatus: statusBreakdown || [],
        },
        recommendation:
          Number(userStats?.count ?? 0) === 0
            ? "No users found in database. Run migrations with: npm run db:migrate"
            : "Database appears healthy with data.",
      });
    } catch (error: any) {
      return res.status(503).json({
        status: "error",
        error: error?.message || "Diagnostics query failed",
        timestamp: new Date().toISOString(),
        recommendation: "Check database connection and ensure migrations are applied.",
      });
    }
  });

  app.get("/api/admin/bridge/service-requests", async (req, res, next) => {
    try {
      const isAdmin =
        req.isAuthenticated() &&
        (req.user?.role === "admin" || req.user?.globalRole === "super_admin");

      if (!isAdmin) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const {
        status,
        q,
        estateId,
        residentId,
        providerId,
      } = req.query as {
        status?: string;
        q?: string;
        estateId?: string;
        residentId?: string;
        providerId?: string;
      };

      const all = await storage.getAllServiceRequests();

      const filtered = all.filter((request) => {
        let matches = true;

        if (status && status !== "all") {
          matches &&= request.status === status;
        }

        if (estateId) {
          matches &&= (request as any).estateId === estateId;
        }

        if (residentId) {
          matches &&= request.residentId === residentId;
        }

        if (providerId) {
          matches &&= request.providerId === providerId;
        }

        if (q) {
          const needle = q.toLowerCase();
          const haystack = [
            request.id,
            request.description,
            request.category,
            request.residentId,
            request.providerId,
            (request as any).location,
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();
          matches &&= haystack.includes(needle);
        }

        return matches;
      });

      res.json(filtered);
    } catch (error) {
      next(error);
    }
  });

  // Admin dashboard stats (front-end expects /api/admin/dashboard/stats)
  app.get("/api/admin/dashboard/stats", async (req, res, next) => {
    try {
      if (!isAdminOrSuper(req)) return res.status(401).json({ message: "Unauthorized" });
      const stats = await storage.getUserStats();
      res.json(stats);
    } catch (error) {
      next(error);
    }
  });

  // Estate performance for admin dashboard card
  app.get("/api/admin/dashboard/estate-performance", async (req, res, next) => {
    try {
      if (!isAdminOrSuper(req)) return res.status(401).json({ message: "Unauthorized" });

      const rows = await db
        .select({
          estateId: estates.id,
          name: estates.name,
          totalRequests: count(serviceRequests.id),
          completedRequests: sql<number>`coalesce(sum(case when ${serviceRequests.status} = 'completed' then 1 else 0 end), 0)`,
        })
        .from(estates)
        .leftJoin(serviceRequests, eq(serviceRequests.estateId, estates.id))
        .groupBy(estates.id)
        .orderBy(desc(count(serviceRequests.id)))
        .limit(5);

      const out = (rows || []).map((r: any) => {
        const total = Number(r.totalRequests ?? 0);
        const completed = Number(r.completedRequests ?? 0);
        const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
        return {
          estateId: r.estateId,
          name: r.name,
          totalRequests: total,
          completedRequests: completed,
          completionRate: pct,
        };
      });

      return res.json(out);
    } catch (error) {
      next(error);
    }
  });

  // Business overview data for company dashboard
    app.get("/api/business/overview", requireAuth, async (req, res, next) => {
      try {
        const userId = req.auth?.userId ?? req.user?.id;
        const isAdmin = isAdminOrSuper(req);
      const queryCompanyValue = (req.query.company || req.query.business || "").toString().trim();

      const companyForUser = await resolveCompanyForUser(userId);
      let companyScope = companyForUser;

      if (isAdmin && queryCompanyValue) {
        const [byId] = await db
          .select()
          .from(companies)
          .where(eq(companies.id, queryCompanyValue))
          .limit(1 as any);
        const [byName] = !byId
          ? await db
              .select()
              .from(companies)
              .where(eq(companies.name, queryCompanyValue))
              .limit(1 as any)
          : [null];
        companyScope = byId || byName || null;
      }

      const isOwner = Boolean(companyScope && companyScope.providerId === userId);
      const isTeamMember = Boolean(
        companyScope &&
          companyForUser &&
          String(companyForUser.id || "").trim() === String(companyScope.id || "").trim(),
      );

      if (!isAdmin && (!companyScope || (!isOwner && !isTeamMember))) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      if (!isAdmin && companyScope && companyScope.isActive === false) {
        return res.status(403).json({ message: "Company pending approval" });
      }

      const companyId = companyScope ? String(companyScope.id || "").trim() : "";
      const companyName = companyScope ? String(companyScope.name || "").trim() : "";
      const companyMatchers: any[] = [];
      if (companyId) companyMatchers.push(eq(users.company, companyId));
      if (companyName) companyMatchers.push(eq(users.company, companyName));

      const providerConditions = [
        eq(users.role, "provider"),
        ...(companyMatchers.length > 0 ? [or(...companyMatchers)] : []),
      ];

      const businessName = companyName || companyId || queryCompanyValue;

      const [
        [providerCount],
        [activeRequestsCount],
        [revenueRow],
        recentActivityRows,
      ] = await Promise.all([
        db.select({ c: count() }).from(users).where(and(...providerConditions)),
        db
          .select({ c: count() })
          .from(serviceRequests)
          .leftJoin(users, eq(users.id, serviceRequests.providerId))
          .where(
            and(
              eq(serviceRequests.status, "pending"),
              ...(companyMatchers.length > 0 ? [or(...companyMatchers)] : []),
            ),
          ),
        db
          .select({ total: sum(transactions.amount) })
          .from(transactions)
          .where(eq(transactions.status, "completed")),
        db
          .select({
            id: serviceRequests.id,
            status: serviceRequests.status,
            category: serviceRequests.category,
            createdAt: serviceRequests.createdAt,
          })
          .from(serviceRequests)
          .leftJoin(users, eq(users.id, serviceRequests.providerId))
          .where(and(...providerConditions))
          .orderBy(desc(serviceRequests.createdAt))
          .limit(5),
      ]);

      const latestTransactionRows = await db
        .select({
          id: transactions.id,
          amount: transactions.amount,
          status: transactions.status,
          description: transactions.description,
          createdAt: transactions.createdAt,
          category: serviceRequests.category,
          requestId: serviceRequests.id,
          providerName: users.name,
        })
        .from(transactions)
        .leftJoin(
          serviceRequests,
          eq(transactions.serviceRequestId, serviceRequests.id),
        )
        .leftJoin(users, eq(users.id, serviceRequests.providerId))
        .where(and(...providerConditions))
        .orderBy(desc(transactions.createdAt))
        .limit(5);

      let auditQuery = db
        .select({
          id: auditLogs.id,
          action: auditLogs.action,
          target: auditLogs.target,
          targetId: auditLogs.targetId,
          createdAt: auditLogs.createdAt,
        })
        .from(auditLogs);

      if (businessName) {
        auditQuery = auditQuery.where(
          sql`${auditLogs.meta} ->> 'company' = ${businessName}`,
        );
      }

      const recentAuditRows = await auditQuery
        .orderBy(desc(auditLogs.createdAt))
        .limit(5);

      const normalizedActivities = [
        ...recentActivityRows.map((row: any) => ({
          id: row.id,
          status: row.status ?? null,
          category: row.category ?? null,
          createdAt: row.createdAt ?? null,
        })),
        ...recentAuditRows.map((row: any) => ({
          id: row.id,
          status: row.action ?? null,
          category: row.target ?? null,
          createdAt: row.createdAt ?? null,
        })),
      ]
        .sort((a, b) => {
          const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return bTime - aTime;
        })
        .slice(0, 5)
        .map((activity) => ({
          id: activity.id,
          status: activity.status,
          category: activity.category,
          createdAt: activity.createdAt
            ? new Date(activity.createdAt).toISOString()
            : null,
        }));

      const normalizedLatestTransactions = latestTransactionRows.map((row: any) => ({
        id: row.id,
        amount: Number(row.amount ?? 0),
        status: row.status ?? null,
        description: row.description ?? null,
        category: row.category ?? null,
        requestId: row.requestId ?? null,
        providerName: row.providerName ?? null,
        createdAt: row.createdAt ? row.createdAt.toISOString() : null,
      }));

      res.json({
        totalProviders: Number(providerCount?.c ?? 0),
        activeRequests: Number(activeRequestsCount?.c ?? 0),
        totalRevenue: Number(revenueRow?.total ?? 0),
        recentActivity: normalizedActivities,
        latestTransactions: normalizedLatestTransactions,
      });
      } catch (error) {
        next(error);
      }
    });

    // Company-facing endpoints (owner + staff access)
    app.get("/api/company/staff", requireAuth, async (req, res, next) => {
      try {
        const { company } = await resolveCompanyAccess(req);
        if (!company) {
          return res.status(403).json({ message: "No company found for user" });
        }
        if (company.isActive === false) {
          return res.status(403).json({ message: "Company pending approval" });
        }

        const companyId = String(company.id || "").trim();
        const companyName = String(company.name || "").trim();
        const matchers = [];
        if (companyId) matchers.push(eq(users.company, companyId));
        if (companyName) matchers.push(eq(users.company, companyName));

        const rows = await db
          .select({
            id: users.id,
            name: users.name,
            email: users.email,
            phone: users.phone,
            role: users.role,
            isApproved: users.isApproved,
            isActive: users.isActive,
            company: users.company,
          })
          .from(users)
          .where(
            and(
              eq(users.role, "provider" as any),
              ...(matchers.length ? [or(...matchers)] : []),
            ),
          )
          .orderBy(asc(users.name));

        res.json(rows);
      } catch (error) {
        next(error);
      }
    });

    const companyStoreSchema = z.object({
      name: z.string().min(1, "Store name is required"),
      location: z.string().min(1, "Location is required"),
      description: z.string().optional().default(""),
      phone: z.string().optional().default(""),
      email: z.string().optional().default(""),
      estateId: z.string().optional(),
    });

    app.get("/api/company/stores", requireAuth, async (req, res, next) => {
      try {
        const { company } = await resolveCompanyAccess(req);
        if (!company) {
          return res.status(403).json({ message: "No company found for user" });
        }
        if (company.isActive === false) {
          return res.status(403).json({ message: "Company pending approval" });
        }

        const rows = await db
          .select()
          .from(stores)
          .where(eq(stores.companyId, company.id))
          .orderBy(desc(stores.createdAt));
        res.json(rows);
      } catch (error) {
        next(error);
      }
    });

    app.post("/api/company/stores", requireAuth, async (req, res, next) => {
      try {
        const { userId, company, isOwner } = await resolveCompanyAccess(req);
        if (!company || !userId) {
          return res.status(403).json({ message: "No company found for user" });
        }
        if (!isOwner) {
          return res.status(401).json({ message: "Unauthorized" });
        }
        if (company.isActive === false) {
          return res.status(403).json({ message: "Company pending approval" });
        }

        const parsed = companyStoreSchema.parse(req.body);

        const [created] = await db
          .insert(stores)
          .values({
            name: parsed.name,
            location: parsed.location,
            description: parsed.description,
            ownerId: userId,
            companyId: company.id,
            phone: parsed.phone,
            email: parsed.email,
            estateId: parsed.estateId,
          })
          .returning();

        if (created?.id) {
          await db
            .insert(storeMembers)
            .values({
              storeId: created.id,
              userId,
              role: "owner",
              canManageItems: true,
              canManageOrders: true,
            })
            .catch(() => undefined);
        }

        res.status(201).json(created);
      } catch (error) {
        next(error);
      }
    });

    const storeMemberSchema = z.object({
      userId: z.string().min(1, "User is required"),
      role: z.enum(["manager", "member"]).optional(),
      canManageItems: z.boolean().optional(),
      canManageOrders: z.boolean().optional(),
    });

    app.post("/api/company/stores/:storeId/members", requireAuth, async (req, res, next) => {
      try {
        const { userId, company, isOwner } = await resolveCompanyAccess(req);
        if (!company || !userId) {
          return res.status(403).json({ message: "No company found for user" });
        }
        if (!isOwner) {
          return res.status(401).json({ message: "Unauthorized" });
        }
        if (company.isActive === false) {
          return res.status(403).json({ message: "Company pending approval" });
        }

        const { storeId } = req.params;
        const parsed = storeMemberSchema.parse(req.body);

        const [store] = await db
          .select()
          .from(stores)
          .where(eq(stores.id, storeId))
          .limit(1 as any);

        if (!store || store.companyId !== company.id) {
          return res.status(403).json({ message: "Store not in your company" });
        }

        const companyId = String(company.id || "").trim();
        const companyName = String(company.name || "").trim();
        const [memberUser] = await db
          .select({ id: users.id })
          .from(users)
          .where(
            and(
              eq(users.id, parsed.userId),
              or(eq(users.company, companyId), eq(users.company, companyName)),
            ),
          )
          .limit(1 as any);

        if (!memberUser) {
          return res.status(400).json({ message: "User not in your company" });
        }

        const [ownedCompany] = await db
          .select({ id: companies.id })
          .from(companies)
          .where(eq(companies.providerId, parsed.userId))
          .limit(1 as any);
        if (ownedCompany && String(ownedCompany.id) !== companyId) {
          return res.status(400).json({ message: "This user already owns another company." });
        }

        const memberRecord = await storage.getUser(parsed.userId);
        const memberCompanyId = String(memberRecord?.company || "").trim();
        if (memberCompanyId && memberCompanyId !== companyId && memberCompanyId !== companyName) {
          return res.status(400).json({ message: "This user is already part of another company." });
        }

        const [otherCompanyMembership] = await db
          .select({ id: storeMembers.id })
          .from(storeMembers)
          .innerJoin(stores, eq(storeMembers.storeId, stores.id))
          .where(
            and(
              eq(storeMembers.userId, parsed.userId),
              eq(storeMembers.isActive, true),
              isNotNull(stores.companyId),
              sql`${stores.companyId} <> ${company.id}`,
            ),
          )
          .limit(1 as any);
        if (otherCompanyMembership) {
          return res.status(400).json({ message: "This user is already part of another company." });
        }

        const role = parsed.role ?? "member";
        const canManageItems = parsed.canManageItems ?? role === "manager";
        const canManageOrders = parsed.canManageOrders ?? true;

        const [created] = await db
          .insert(storeMembers)
          .values({
            storeId,
            userId: parsed.userId,
            role,
            canManageItems,
            canManageOrders,
          })
          .returning();

        res.status(201).json(created);
      } catch (error) {
        next(error);
      }
    });

    app.get("/api/stores/:storeId/members", requireAuth, async (req, res, next) => {
      try {
        const userId = req.auth?.userId;
        if (!userId) {
          return res.status(401).json({ message: "Unauthorized" });
        }

        const { storeId } = req.params;
        const [ownerMembership] = await db
          .select({ id: storeMembers.id })
          .from(storeMembers)
          .where(
            and(
              eq(storeMembers.storeId, storeId),
              eq(storeMembers.userId, userId),
              eq(storeMembers.role, "owner"),
              eq(storeMembers.isActive, true),
            ),
          )
          .limit(1 as any);

        if (!ownerMembership) {
          return res.status(403).json({ message: "Only the store owner can view members" });
        }

        const rows = await db
          .select({
            member: storeMembers,
            user: users,
          })
          .from(storeMembers)
          .innerJoin(users, eq(storeMembers.userId, users.id))
          .where(eq(storeMembers.storeId, storeId))
          .orderBy(desc(storeMembers.createdAt));

        res.json(
          rows.map((row: { member: typeof storeMembers.$inferSelect; user: typeof users.$inferSelect }) => ({
            ...row.member,
            user: {
              id: row.user.id,
              name: row.user.name,
              email: row.user.email,
              phone: row.user.phone,
              role: row.user.role,
              isActive: row.user.isActive,
            },
          })),
        );
      } catch (error) {
        next(error);
      }
    });

    const transferOwnershipSchema = z.object({
      newOwnerId: z.string().min(1, "New owner is required"),
    });

    app.patch("/api/stores/:storeId/transfer-ownership", requireAuth, async (req, res, next) => {
      try {
        const userId = req.auth?.userId;
        if (!userId) {
          return res.status(401).json({ message: "Unauthorized" });
        }

        const { storeId } = req.params;
        const { newOwnerId } = transferOwnershipSchema.parse(req.body);
        if (newOwnerId === userId) {
          return res.status(400).json({ message: "New owner must be different from current owner" });
        }

        const [store] = await db
          .select()
          .from(stores)
          .where(eq(stores.id, storeId))
          .limit(1 as any);

        if (!store) {
          return res.status(404).json({ message: "Store not found" });
        }

        const ownerRows = await db
          .select({ id: storeMembers.id })
          .from(storeMembers)
          .where(
            and(
              eq(storeMembers.storeId, storeId),
              eq(storeMembers.userId, userId),
              eq(storeMembers.role, "owner"),
              eq(storeMembers.isActive, true),
            ),
          )
          .limit(1 as any);

        const isOwner = store.ownerId === userId || Boolean(ownerRows[0]);

        if (!isOwner) {
          return res.status(403).json({ message: "Only the store owner can transfer ownership" });
        }

        const [managerMember] = await db
          .select({ id: storeMembers.id })
          .from(storeMembers)
          .where(
            and(
              eq(storeMembers.storeId, storeId),
              eq(storeMembers.userId, newOwnerId),
              eq(storeMembers.role, "manager"),
              eq(storeMembers.isActive, true),
            ),
          )
          .limit(1 as any);

        if (!managerMember) {
          return res.status(400).json({ message: "New owner must be a current manager" });
        }

        const oldOwnerId = store.ownerId || userId;

        await db.transaction(async (tx: typeof db) => {
          await tx
            .update(storeMembers)
            .set({
              role: "manager",
              canManageItems: true,
              canManageOrders: true,
              updatedAt: new Date(),
            })
            .where(
              and(
                eq(storeMembers.storeId, storeId),
                eq(storeMembers.userId, oldOwnerId),
              ),
            );

          await tx
            .update(storeMembers)
            .set({
              role: "owner",
              canManageItems: true,
              canManageOrders: true,
              updatedAt: new Date(),
            })
            .where(
              and(
                eq(storeMembers.storeId, storeId),
                eq(storeMembers.userId, newOwnerId),
              ),
            );

          await tx
            .update(stores)
            .set({
              ownerId: newOwnerId,
              updatedAt: new Date(),
            })
            .where(eq(stores.id, storeId));
        });

        res.json({
          success: true,
          storeId,
          oldOwnerId,
          newOwnerId,
        });
      } catch (error) {
        next(error);
      }
    });

    const companyInventoryCreateSchema = createMarketplaceItemSchema.extend({
      storeId: z.string().min(1, "Store ID is required"),
    });

    app.get("/api/company/stores/:storeId/inventory", requireAuth, async (req, res, next) => {
      try {
        const { userId, company } = await resolveCompanyAccess(req);
        if (!company || !userId) {
          return res.status(403).json({ message: "No company found for user" });
        }
        if (company.isActive === false) {
          return res.status(403).json({ message: "Company pending approval" });
        }

        const { storeId } = req.params;
        const [store] = await db
          .select()
          .from(stores)
          .where(eq(stores.id, storeId))
          .limit(1 as any);

        if (!store || store.companyId !== company.id) {
          return res.status(403).json({ message: "Store not in your company" });
        }
        if (store.approvalStatus === "pending") {
          return res.status(403).json({
            message: "Store awaiting approval. Inventory access is disabled until approved.",
          });
        }
        if (store.approvalStatus === "rejected") {
          return res.status(403).json({
            message: "Store was rejected. Inventory access is disabled.",
          });
        }

        const rows = await db
          .select()
          .from(marketplaceItems)
          .where(eq(marketplaceItems.storeId, storeId))
          .orderBy(desc(marketplaceItems.createdAt));
        res.json(rows);
      } catch (error) {
        next(error);
      }
    });

    app.post("/api/company/stores/:storeId/inventory", requireAuth, async (req, res, next) => {
      try {
        const { userId, company, isOwner } = await resolveCompanyAccess(req);
        if (!company || !userId) {
          return res.status(403).json({ message: "No company found for user" });
        }
        if (company.isActive === false) {
          return res.status(403).json({ message: "Company pending approval" });
        }

        const { storeId } = req.params;
        const [store] = await db
          .select()
          .from(stores)
          .where(eq(stores.id, storeId))
          .limit(1 as any);

        if (!store || store.companyId !== company.id) {
          return res.status(403).json({ message: "Store not in your company" });
        }
        if (store.approvalStatus === "pending") {
          return res.status(403).json({
            message: "Store awaiting approval. Items can be added once approved.",
          });
        }
        if (store.approvalStatus === "rejected") {
          return res.status(403).json({
            message: "Store was rejected. Items cannot be added.",
          });
        }

        const [membership] = await db
          .select({
            canManageItems: storeMembers.canManageItems,
            isActive: storeMembers.isActive,
          })
          .from(storeMembers)
          .where(
            and(
              eq(storeMembers.storeId, storeId),
              eq(storeMembers.userId, userId),
              eq(storeMembers.isActive, true),
            ),
          )
          .limit(1 as any);

        if (!isOwner && !membership?.canManageItems) {
          return res.status(401).json({ message: "Unauthorized" });
        }

        let [storeEstate] = await db
          .select()
          .from(storeEstates)
          .where(eq(storeEstates.storeId, storeId))
          .limit(1 as any);
        if (!storeEstate && store.estateId) {
          const allocatedBy = req.auth?.userId ?? req.user?.id ?? store.ownerId;
          await db
            .insert(storeEstates)
            .values({
              storeId,
              estateId: store.estateId,
              allocatedBy,
            })
            .onConflictDoNothing();
          storeEstate = { storeId, estateId: store.estateId } as typeof storeEstates.$inferSelect;
        }
        if (!storeEstate) {
          return res.status(403).json({
            message: "No estates allocated to this store yet.",
          });
        }

        const parsed = companyInventoryCreateSchema.parse({
          ...req.body,
          storeId,
        });

        const [created] = await db
          .insert(marketplaceItems)
          .values({
            vendorId: parsed.vendorId || userId,
            storeId: parsed.storeId,
            estateId: storeEstate.estateId,
            name: parsed.name,
            description: parsed.description,
            price: parsed.price as any,
            currency: parsed.currency,
            category: parsed.category,
            subcategory: parsed.subcategory,
            stock: parsed.stock as any,
            images: parsed.images,
            unitOfMeasure: parsed.unitOfMeasure,
            isActive: parsed.isActive ?? true,
          })
          .returning();

        res.status(201).json(created);
      } catch (error) {
        next(error);
      }
    });

    app.patch(
      "/api/company/stores/:storeId/inventory/:itemId",
      requireAuth,
      async (req, res, next) => {
        try {
          const { userId, company, isOwner } = await resolveCompanyAccess(req);
          if (!company || !userId) {
            return res.status(403).json({ message: "No company found for user" });
          }
          if (company.isActive === false) {
            return res.status(403).json({ message: "Company pending approval" });
          }

          const { storeId, itemId } = req.params;
          const [store] = await db
            .select()
            .from(stores)
            .where(eq(stores.id, storeId))
            .limit(1 as any);

          if (!store || store.companyId !== company.id) {
            return res.status(403).json({ message: "Store not in your company" });
          }
          if (store.approvalStatus === "pending") {
            return res.status(403).json({
              message: "Store awaiting approval. Items cannot be removed yet.",
            });
          }
          if (store.approvalStatus === "rejected") {
            return res.status(403).json({
              message: "Store was rejected. Items cannot be removed.",
            });
          }
          if (store.approvalStatus === "pending") {
            return res.status(403).json({
              message: "Store awaiting approval. Items can be updated once approved.",
            });
          }
          if (store.approvalStatus === "rejected") {
            return res.status(403).json({
              message: "Store was rejected. Items cannot be updated.",
            });
          }

          const [membership] = await db
            .select({
              canManageItems: storeMembers.canManageItems,
              isActive: storeMembers.isActive,
            })
            .from(storeMembers)
            .where(
              and(
                eq(storeMembers.storeId, storeId),
                eq(storeMembers.userId, userId),
                eq(storeMembers.isActive, true),
              ),
            )
            .limit(1 as any);

          if (!isOwner && !membership?.canManageItems) {
            return res.status(401).json({ message: "Unauthorized" });
          }

          const updates = updateMarketplaceItemSchema.partial().parse(req.body);
          const [updated] = await db
            .update(marketplaceItems)
            .set({ ...updates, updatedAt: new Date() })
            .where(eq(marketplaceItems.id, itemId))
            .returning();

          if (!updated) {
            return res.status(404).json({ message: "Marketplace item not found" });
          }

          res.json(updated);
        } catch (error) {
          next(error);
        }
      },
    );

    app.delete(
      "/api/company/stores/:storeId/inventory/:itemId",
      requireAuth,
      async (req, res, next) => {
        try {
          const { userId, company, isOwner } = await resolveCompanyAccess(req);
          if (!company || !userId) {
            return res.status(403).json({ message: "No company found for user" });
          }
          if (company.isActive === false) {
            return res.status(403).json({ message: "Company pending approval" });
          }

          const { storeId, itemId } = req.params;
          const [store] = await db
            .select()
            .from(stores)
            .where(eq(stores.id, storeId))
            .limit(1 as any);

          if (!store || store.companyId !== company.id) {
            return res.status(403).json({ message: "Store not in your company" });
          }

          const [membership] = await db
            .select({
              canManageItems: storeMembers.canManageItems,
              isActive: storeMembers.isActive,
            })
            .from(storeMembers)
            .where(
              and(
                eq(storeMembers.storeId, storeId),
                eq(storeMembers.userId, userId),
                eq(storeMembers.isActive, true),
              ),
            )
            .limit(1 as any);

          if (!isOwner && !membership?.canManageItems) {
            return res.status(401).json({ message: "Unauthorized" });
          }

          const deleted = await db
            .delete(marketplaceItems)
            .where(eq(marketplaceItems.id, itemId))
            .returning();

          if (!deleted || deleted.length === 0) {
            return res.status(404).json({ message: "Marketplace item not found" });
          }

          res.json({ success: true, item: deleted[0] });
        } catch (error) {
          next(error);
        }
      },
    );

  // Public categories endpoint - allow unauthenticated access for client-side lists.
  // Be defensive: if the DB query fails, return an empty list instead of a 500.
    app.get("/api/categories", async (req, res, next) => {
      try {
        const { scope } = req.query as { scope?: string };
        let query = db.select().from(categories);
      if (scope && scope !== "all" && (scope === "global" || scope === "estate")) {
        query = query.where(eq(categories.scope, scope as "global" | "estate"));
      }

      const rows = await query.orderBy(desc(categories.createdAt));
        return res.json(rows);
      } catch (error: any) {
        // Log and return a safe fallback so the front-end can use local defaults.
        console.error("/api/categories error:", error?.message || error);
        return res.json([]);
      }
    });

    // Public item categories endpoint for inventory forms.
    app.get("/api/item-categories", async (req, res, next) => {
      try {
        const rows = await db
          .select()
          .from(itemCategories)
          .where(eq(itemCategories.isActive, true))
          .orderBy(desc(itemCategories.createdAt));
        return res.json(rows);
      } catch (error: any) {
        console.error("/api/item-categories error:", error?.message || error);
        return res.json([]);
      }
    });

  // Simple Server-Sent Events endpoint for lightweight broadcasts (categories updates)
  // Clients can open an EventSource to receive category change notifications.
  const sseClients: Array<{
    id: number;
    res: any;
  }> = [];
  let sseId = 1;

  function sendSseEvent(name: string, data: any) {
    const payload = `event: ${name}\ndata: ${JSON.stringify(data)}\n\n`;
    for (let i = sseClients.length - 1; i >= 0; i--) {
      const c = sseClients[i];
      try {
        c.res.write(payload);
      } catch (err) {
        // remove dead client
        sseClients.splice(i, 1);
      }
    }
  }

  app.get('/api/events', (req, res) => {
    res.set({
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });
    res.flushHeaders?.();
    const id = sseId++;
    sseClients.push({ id, res });
    // send a greeting so clients know the stream is alive
    res.write(`event: ready\ndata: ${JSON.stringify({ time: Date.now() })}\n\n`);

    req.on('close', () => {
      for (let i = sseClients.length - 1; i >= 0; i--) {
        if (sseClients[i].id === id) sseClients.splice(i, 1);
      }
    });
  });

  app.get("/api/companies", async (req, res, next) => {
    try {
      const isPublic =
        String(req.query.public || "") === "true" ||
        String(req.query.public || "") === "1";
      const isAdmin = isAdminOrSuper(req);

      let query = db.select().from(companies);
      if (!isAdmin || isPublic) {
        query = query.where(eq(companies.isActive, true));
      }

      const rows = await query.orderBy(desc(companies.createdAt));
      res.json(rows);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/companies", requireAuth, async (req, res, next) => {
    try {
      const userId = req.auth?.userId;
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const user = await storage.getUser(userId);
      if (user?.role !== "provider") {
        return res.status(403).json({ message: "Only providers can create companies." });
      }
      if (user.company) {
        return res
          .status(403)
          .json({ message: "You must leave your current company to create a new one." });
      }

      const [ownedCompany] = await db
        .select({ id: companies.id })
        .from(companies)
        .where(eq(companies.providerId, userId))
        .limit(1 as any);
      if (ownedCompany) {
        return res
          .status(403)
          .json({ message: "You must leave your current company to create a new one." });
      }

      const [activeMembership] = await db
        .select({ id: storeMembers.id })
        .from(storeMembers)
        .where(
          and(
            eq(storeMembers.userId, userId),
            eq(storeMembers.isActive, true),
          ),
        )
        .limit(1 as any);
      if (activeMembership) {
        return res
          .status(403)
          .json({ message: "You must leave your current company to create a new one." });
      }

      const createCompanySchema = z.object({
        name: z.string().min(2, "Business name is required"),
        description: z.string().max(1000).optional(),
        contactEmail: z.string().email("Valid contact email is required").optional(),
        phone: z.string().min(7).max(20).optional(),
      });

      const validated = createCompanySchema.parse(req.body);
      const createdCompany = await storage.createCompany({
        name: validated.name,
        description: validated.description,
        contactEmail: validated.contactEmail,
        phone: validated.phone,
        details: {},
        isActive: false,
        providerId: userId,
        submittedAt: new Date(),
      });

      await storage.updateUser(userId, { company: createdCompany.id } as any);

      res.status(201).json(createdCompany);
    } catch (error) {
      next(error);
    }
  });

  // Audit log listing (limit/search/date filters)
  app.get("/api/admin/audit-logs", async (req, res, next) => {
    try {
      if (!isAdminOrSuper(req)) return res.status(401).json({ message: "Unauthorized" });

      const limit = Math.min(Math.max(Number(req.query.limit ?? 10), 1), 100) || 10;
      const search = (req.query.search ?? "").toString().trim();
      const dateFrom = (req.query.dateFrom ?? "").toString().trim();
      const dateTo = (req.query.dateTo ?? "").toString().trim();

      const whereParts: any[] = [];

      if (dateFrom) {
        const from = new Date(`${dateFrom}T00:00:00.000Z`);
        if (!Number.isNaN(from.getTime())) whereParts.push(sql`${auditLogs.createdAt} >= ${from}`);
      }
      if (dateTo) {
        const to = new Date(`${dateTo}T23:59:59.999Z`);
        if (!Number.isNaN(to.getTime())) whereParts.push(sql`${auditLogs.createdAt} <= ${to}`);
      }

      if (search) {
        const pattern = `%${search.toLowerCase()}%`;
        whereParts.push(
          sql`(
            lower(${auditLogs.action}) like ${pattern}
            or lower(${auditLogs.target}) like ${pattern}
            or lower(${auditLogs.targetId}) like ${pattern}
            or lower(coalesce(${users.name}, '')) like ${pattern}
            or lower(coalesce(${users.email}, '')) like ${pattern}
            or lower(cast(${auditLogs.meta} as text)) like ${pattern}
          )`
        );
      }

      const q = db
        .select({
          id: auditLogs.id,
          action: auditLogs.action,
          target: auditLogs.target,
          targetId: auditLogs.targetId,
          meta: auditLogs.meta,
          createdAt: auditLogs.createdAt,
          actorId: auditLogs.actorId,
          actorName: users.name,
          actorEmail: users.email,
        })
        .from(auditLogs)
        .leftJoin(users, eq(users.id, auditLogs.actorId))
        .where(whereParts.length ? and(...whereParts) : undefined)
        .orderBy(desc(auditLogs.createdAt))
        .limit(limit);

      const rows = await q;

      const normalized = (rows || []).map((r: any) => {
        const meta = (typeof r.meta === "object" && r.meta) ? r.meta : {};
        const details =
          typeof meta.details === "string" ? meta.details :
          typeof meta.message === "string" ? meta.message :
          typeof meta.reason === "string" ? meta.reason :
          Object.keys(meta).length ? JSON.stringify(meta) : null;

        return {
          id: r.id,
          action: r.action,
          target: r.target,
          targetId: r.targetId,
          createdAt: r.createdAt ? new Date(r.createdAt).toISOString() : null,
          details,
          user: {
            id: r.actorId,
            name: r.actorName ?? null,
            email: r.actorEmail ?? null,
          },
        };
      });

      return res.json(normalized);
    } catch (error) {
      next(error);
    }
  });

  // Admin: estates management
  app.get("/api/admin/estates", async (req, res, next) => {
    try {
      const isAdmin =
        req.isAuthenticated() &&
        (req.user?.role === "admin" || req.user?.globalRole === "super_admin");
      if (!isAdmin) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const rows = await db.select().from(estates);
      res.json(rows);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/admin/estates", async (req, res, next) => {
    try {
      const isAdmin =
        req.isAuthenticated() &&
        (req.user?.role === "admin" || req.user?.globalRole === "super_admin");
      if (!isAdmin) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const parsed = insertEstateSchema.parse({
        ...req.body,
        createdBy: req.user?.id,
      });

      const [created] = await db
        .insert(estates)
        .values({
          ...parsed,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();

      res.status(201).json(created);
    } catch (error) {
      next(error);
    }
  });

  // Admin: memberships (user-estate relationships)
  app.get("/api/admin/memberships", async (req, res, next) => {
    try {
      if (!isAdminOrSuper(req)) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const rows = await db
        .select({
          id: memberships.id,
          userId: memberships.userId,
          user_id: memberships.userId,
          estateId: memberships.estateId,
          estate_id: memberships.estateId,
          role: memberships.role,
          permissions: memberships.permissions,
          isActive: memberships.isActive,
          createdAt: memberships.createdAt,
          updatedAt: memberships.updatedAt,
          userName: users.name,
          estateName: estates.name,
        })
        .from(memberships)
        .leftJoin(users, eq(users.id, memberships.userId))
        .leftJoin(estates, eq(estates.id, memberships.estateId))
        .orderBy(desc(memberships.createdAt));

      res.json(rows);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/admin/memberships", async (req, res, next) => {
    try {
      if (!isAdminOrSuper(req)) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const parsed = insertMembershipSchema.parse(req.body);
      const [existing] = await db
        .select()
        .from(memberships)
        .where(
          and(
            eq(memberships.userId, parsed.userId),
            eq(memberships.estateId, parsed.estateId)
          )
        )
        .limit(1);

      if (existing) {
        return res.status(409).json({ message: "Membership already exists" });
      }

      const [created] = await db
        .insert(memberships)
        .values(parsed)
        .returning();

      res.status(201).json(created);
    } catch (error) {
      next(error);
    }
  });

  app.delete("/api/admin/memberships/:userId/:estateId", async (req, res, next) => {
    try {
      if (!isAdminOrSuper(req)) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { userId, estateId } = req.params;
      const deleted = await db
        .delete(memberships)
        .where(
          and(
            eq(memberships.userId, userId),
            eq(memberships.estateId, estateId)
          )
        )
        .returning();

      if (!deleted || deleted.length === 0) {
        return res.status(404).json({ message: "Membership not found" });
      }

      res.json({ success: true, membership: deleted[0] });
    } catch (error) {
      next(error);
    }
  });

  // Update a membership (allow changing estate, role, status, etc.)
  app.patch("/api/admin/memberships/:id", async (req, res, next) => {
    try {
      if (!isAdminOrSuper(req)) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { id } = req.params;
      const updates: any = {};
      const allowed = ["estateId", "role", "status", "isActive", "isPrimary", "permissions"];
      for (const k of allowed) {
        if (Object.prototype.hasOwnProperty.call(req.body, k)) {
          // map client keys to DB column names if necessary
          if (k === "estateId") updates.estateId = req.body[k];
          else updates[k] = req.body[k];
        }
      }

      if (Object.keys(updates).length === 0) {
        return res.status(400).json({ message: "No valid fields provided for update" });
      }

      const [updated] = await db
        .update(memberships)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(memberships.id, id))
        .returning();

      if (!updated) return res.status(404).json({ message: "Membership not found" });

      res.json(updated);
    } catch (error) {
      next(error);
    }
  });

  // Admin: categories management
  app.get("/api/admin/categories", async (req, res, next) => {
    try {
      if (!isAdminOrSuper(req)) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { scope, estateId } = req.query;
      let query = db.select().from(categories);
      if (scope && scope !== "all" && (scope === "global" || scope === "estate")) {
        query = query.where(eq(categories.scope, scope as "global" | "estate"));
      }
      if (estateId) {
        query = query.where(eq(categories.estateId, String(estateId)));
      }

      const rows = await query.orderBy(desc(categories.createdAt));
      res.json(rows);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/admin/categories", async (req, res, next) => {
    try {
      if (!isAdminOrSuper(req)) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const parsed = insertCategorySchema.parse(req.body);
      const [created] = await db.insert(categories).values(parsed).returning();
      // Broadcast category creation to SSE listeners
      try {
        // sendSseEvent is defined earlier in this file
        // @ts-ignore
        sendSseEvent('categories', { action: 'created', category: created });
      } catch (err) {
        // ignore
      }
      res.status(201).json(created);
    } catch (error) {
      next(error);
    }
  });

  app.patch("/api/admin/categories/:id", async (req, res, next) => {
    try {
      if (!isAdminOrSuper(req)) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { id } = req.params;
      const updates = {
        ...req.body,
        updatedAt: new Date(),
      };

      const [updated] = await db
        .update(categories)
        .set(updates)
        .where(eq(categories.id, id))
        .returning();

      if (!updated) {
        return res.status(404).json({ message: "Category not found" });
      }

      try {
        // notify clients of update
        // @ts-ignore
        sendSseEvent('categories', { action: 'updated', category: updated });
      } catch (err) {
        // ignore
      }
      res.json(updated);
    } catch (error) {
      next(error);
    }
  });

  app.delete("/api/admin/categories/:id", async (req, res, next) => {
    try {
      if (!isAdminOrSuper(req)) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { id } = req.params;
      const deleted = await db
        .delete(categories)
        .where(eq(categories.id, id))
        .returning();

      if (!deleted || deleted.length === 0) {
        return res.status(404).json({ message: "Category not found" });
      }

      try {
        // notify clients of deletion
        // @ts-ignore
        sendSseEvent('categories', { action: 'deleted', categoryId: id });
      } catch (err) {
        // ignore
      }

      res.json({ success: true, category: deleted[0] });
    } catch (error) {
      next(error);
    }
  });

  // Admin: item categories (for marketplace items)
  const ItemCategorySchema = z.object({
    name: z.string().min(1, "Name is required"),
    description: z.string().optional(),
    emoji: z.string().optional(),
    isActive: z.boolean().optional(),
  });

  app.get("/api/admin/item-categories", async (req, res, next) => {
    try {
      if (!isAdminOrSuper(req)) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const rows = await db
        .select()
        .from(itemCategories)
        .orderBy(desc(itemCategories.createdAt));

      res.json(rows);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/admin/item-categories", async (req, res, next) => {
    try {
      if (!isAdminOrSuper(req)) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const parsed = ItemCategorySchema.parse(req.body);
      const [created] = await db
        .insert(itemCategories)
        .values({
          name: parsed.name,
          description: parsed.description,
          emoji: parsed.emoji,
          isActive: parsed.isActive ?? true,
        })
        .returning();

      res.status(201).json(created);
    } catch (error) {
      next(error);
    }
  });

  app.patch("/api/admin/item-categories/:id", async (req, res, next) => {
    try {
      if (!isAdminOrSuper(req)) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { id } = req.params;
      const parsed = ItemCategorySchema.partial().parse(req.body);

      const [updated] = await db
        .update(itemCategories)
        .set({
          ...parsed,
          updatedAt: new Date(),
        })
        .where(eq(itemCategories.id, id))
        .returning();

      if (!updated) {
        return res.status(404).json({ message: "Item category not found" });
      }

      res.json(updated);
    } catch (error) {
      next(error);
    }
  });

  app.delete("/api/admin/item-categories/:id", async (req, res, next) => {
    try {
      if (!isAdminOrSuper(req)) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { id } = req.params;
      const deleted = await db
        .delete(itemCategories)
        .where(eq(itemCategories.id, id))
        .returning();

      if (!deleted || deleted.length === 0) {
        return res.status(404).json({ message: "Item category not found" });
      }

      res.json({ success: true, category: deleted[0] });
    } catch (error) {
      next(error);
    }
  });

  const StoreSchema = z.object({
    name: z.string().min(1, "Name is required"),
    description: z.string().optional(),
    location: z.string().min(1, "Location is required"),
    phone: z.string().optional(),
    email: z.string().email().optional(),
    ownerId: z.string().min(1, "Owner is required"),
    estateId: z.string().nullable().optional(),
    companyId: z.string().optional(),
    isActive: z.boolean().optional(),
  });

  app.get("/api/admin/stores", async (req, res, next) => {
    try {
      if (!isAdminOrSuper(req)) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { search, companyId, includeUnassigned } = req.query;
      let query = db.select().from(stores);

      if (typeof search === "string" && search.trim().length > 0) {
        const term = `%${search.trim()}%`;
        query = query.where(
          or(
            ilike(stores.name, term),
            ilike(stores.location, term),
            ilike(stores.phone, term),
            ilike(stores.email, term),
          ),
        );
      }

      const companyFilter = typeof companyId === "string" && companyId.trim().length > 0;
      const allowUnassigned = String(includeUnassigned || "").toLowerCase() === "true";
      if (companyFilter && !allowUnassigned) {
        query = query.where(eq(stores.companyId, companyId.trim()));
      }

      const rows = await query.orderBy(desc(stores.createdAt));
      res.json(rows);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/admin/stores", async (req, res, next) => {
    try {
      if (!isAdminOrSuper(req)) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const parsed = StoreSchema.parse(req.body);
      const insertData: any = {
        name: parsed.name,
        description: parsed.description,
        location: parsed.location,
        phone: parsed.phone,
        email: parsed.email,
        ownerId: parsed.ownerId,
        estateId: parsed.estateId ?? null,
        companyId: parsed.companyId,
        isActive: parsed.isActive ?? true,
      };
      
      const [created] = await db
        .insert(stores)
        .values(insertData)
        .returning({
          id: stores.id,
          estateId: stores.estateId,
          ownerId: stores.ownerId,
          companyId: stores.companyId,
          name: stores.name,
          description: stores.description,
          location: stores.location,
          latitude: stores.latitude,
          longitude: stores.longitude,
          phone: stores.phone,
          email: stores.email,
          logo: stores.logo,
          approvalStatus: stores.approvalStatus,
          approvedBy: stores.approvedBy,
          approvedAt: stores.approvedAt,
          isActive: stores.isActive,
          createdAt: stores.createdAt,
          updatedAt: stores.updatedAt,
        });
      
      // Automatically add store owner as a member with full permissions
      if (created.ownerId) {
        try {
          await db.insert(storeMembers).values({
            storeId: created.id,
            userId: created.ownerId,
            role: "owner",
            canManageItems: true,
            canManageOrders: true,
            isActive: true
          }).onConflictDoNothing();
        } catch (error) {
          // Log error but don't fail the response
          console.error("Failed to add store owner to members:", error);
        }
      }

      if (parsed.estateId) {
        const allocatedBy = req.auth?.userId ?? req.user?.id ?? created.ownerId;
        await db
          .insert(storeEstates)
          .values({
            storeId: created.id,
            estateId: parsed.estateId,
            allocatedBy,
          })
          .onConflictDoNothing();
      }
      
      res.status(201).json(created);
    } catch (error) {
      next(error);
    }
  });

  app.patch("/api/admin/stores/:id", async (req, res, next) => {
    try {
      if (!isAdminOrSuper(req)) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { id } = req.params;
      const updates = StoreSchema.partial().parse(req.body);
      const approvalPatch = z
        .object({ isApproved: z.boolean().optional() })
        .partial()
        .safeParse(req.body);
      
      const updateData: any = {
        ...updates,
        updatedAt: new Date(),
      };
      if (approvalPatch.success && approvalPatch.data.isApproved !== undefined) {
        const adminId = req.auth?.userId ?? req.user?.id;
        if (approvalPatch.data.isApproved) {
          updateData.approvalStatus = "approved";
          updateData.approvedBy = adminId;
          updateData.approvedAt = new Date();
        } else {
          updateData.approvalStatus = "rejected";
          updateData.approvedBy = adminId;
          updateData.approvedAt = new Date();
        }
      }

      const [updated] = await db
        .update(stores)
        .set(updateData)
        .where(eq(stores.id, id))
        .returning({
          id: stores.id,
          estateId: stores.estateId,
          ownerId: stores.ownerId,
          companyId: stores.companyId,
          name: stores.name,
          description: stores.description,
          location: stores.location,
          latitude: stores.latitude,
          longitude: stores.longitude,
          phone: stores.phone,
          email: stores.email,
          logo: stores.logo,
          approvalStatus: stores.approvalStatus,
          approvedBy: stores.approvedBy,
          approvedAt: stores.approvedAt,
          isActive: stores.isActive,
          createdAt: stores.createdAt,
          updatedAt: stores.updatedAt,
        });

      if (!updated) {
        return res.status(404).json({ message: "Store not found" });
      }

      if (updates.estateId !== undefined) {
        await db.delete(storeEstates).where(eq(storeEstates.storeId, id));
        if (updates.estateId) {
          const allocatedBy = req.auth?.userId ?? req.user?.id ?? updated.ownerId;
          await db
            .insert(storeEstates)
            .values({
              storeId: id,
              estateId: updates.estateId,
              allocatedBy,
            })
            .onConflictDoNothing();
        }
      }

      res.json(updated);
    } catch (error) {
      next(error);
    }
  });

  const StoreMemberSchema = z.object({
    userId: z.string().min(1, "User ID is required"),
    role: z.string().optional(),
    canManageItems: z.boolean().optional(),
    canManageOrders: z.boolean().optional(),
    isActive: z.boolean().optional(),
  });

  app.get("/api/admin/stores/:storeId/members", async (req, res, next) => {
    try {
      if (!isAdminOrSuper(req)) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { storeId } = req.params;
      const rows = await db
        .select({
          member: storeMembers,
          user: users,
        })
        .from(storeMembers)
        .innerJoin(users, eq(storeMembers.userId, users.id))
        .where(eq(storeMembers.storeId, storeId))
        .orderBy(desc(storeMembers.createdAt));

      res.json(
        rows.map(({ member, user }: { member: typeof storeMembers; user: typeof users }) => ({
          ...member,
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
            phone: user.phone,
            role: user.role,
            isActive: user.isActive,
          },
        })),
      );
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/admin/stores/:storeId/members", async (req, res, next) => {
    try {
      if (!isAdminOrSuper(req)) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { storeId } = req.params;
      const parsed = StoreMemberSchema.parse(req.body);
      const [store] = await db
        .select()
        .from(stores)
        .where(eq(stores.id, storeId))
        .limit(1 as any);
      if (!store) {
        return res.status(404).json({ message: "Store not found" });
      }

      const existing = await db
        .select()
        .from(storeMembers)
        .where(
          and(
            eq(storeMembers.storeId, storeId),
            eq(storeMembers.userId, parsed.userId),
          ),
        );
      if (existing.length > 0) {
        return res.status(409).json({ message: "Member already assigned to this store" });
      }
      if ((parsed.role || "").toLowerCase() === "owner") {
        const ownerExists = await db
          .select({ id: storeMembers.id })
          .from(storeMembers)
          .where(and(eq(storeMembers.storeId, storeId), eq(storeMembers.role, "owner")))
          .limit(1);
        if (ownerExists.length > 0) {
          return res.status(409).json({ message: "Store already has an owner" });
        }
      }

      const storeCompanyId = String(store.companyId || "").trim();
      if (storeCompanyId) {
        const [storeCompany] = await db
          .select({ id: companies.id, name: companies.name })
          .from(companies)
          .where(eq(companies.id, store.companyId as any))
          .limit(1 as any);
        const [ownedCompany] = await db
          .select({ id: companies.id })
          .from(companies)
          .where(eq(companies.providerId, parsed.userId))
          .limit(1 as any);
        if (ownedCompany && String(ownedCompany.id) !== storeCompanyId) {
          return res.status(400).json({ message: "This user already owns another company." });
        }

        const memberUser = await storage.getUser(parsed.userId);
        const memberCompanyId = String(memberUser?.company || "").trim();
        const storeCompanyName = String(storeCompany?.name || "").trim();
        if (
          memberCompanyId &&
          memberCompanyId !== storeCompanyId &&
          (!storeCompanyName || memberCompanyId !== storeCompanyName)
        ) {
          return res.status(400).json({ message: "This user is already part of another company." });
        }

        const [otherCompanyMembership] = await db
          .select({ id: storeMembers.id })
          .from(storeMembers)
          .innerJoin(stores, eq(storeMembers.storeId, stores.id))
          .where(
            and(
              eq(storeMembers.userId, parsed.userId),
              eq(storeMembers.isActive, true),
              isNotNull(stores.companyId),
              sql`${stores.companyId} <> ${store.companyId}`,
            ),
          )
          .limit(1 as any);
        if (otherCompanyMembership) {
          return res.status(400).json({ message: "This user is already part of another company." });
        }
      }

      const [created] = await db
        .insert(storeMembers)
        .values({
          storeId,
          userId: parsed.userId,
          role: parsed.role ?? "member",
          canManageItems: parsed.canManageItems ?? true,
          canManageOrders: parsed.canManageOrders ?? true,
          isActive: parsed.isActive ?? true,
        })
        .returning();

      res.status(201).json(created);
    } catch (error) {
      next(error);
    }
  });

  app.patch("/api/admin/stores/:storeId/members/:memberId", async (req, res, next) => {
    try {
      if (!isAdminOrSuper(req)) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { storeId, memberId } = req.params;
      const updates = StoreMemberSchema.partial().parse(req.body);
      if ((updates.role || "").toLowerCase() === "owner") {
        const ownerExists = await db
          .select({ id: storeMembers.id })
          .from(storeMembers)
          .where(
            and(
              eq(storeMembers.storeId, storeId),
              eq(storeMembers.role, "owner"),
              sql`${storeMembers.id} <> ${memberId}`,
            ),
          )
          .limit(1);
        if (ownerExists.length > 0) {
          return res.status(409).json({ message: "Store already has an owner" });
        }
      }

      const [updated] = await db
        .update(storeMembers)
        .set({ ...updates, updatedAt: new Date() })
        .where(and(eq(storeMembers.id, memberId), eq(storeMembers.storeId, storeId)))
        .returning();

      if (!updated) {
        return res.status(404).json({ message: "Store member not found" });
      }

      res.json(updated);
    } catch (error) {
      next(error);
    }
  });

  app.delete("/api/admin/stores/:storeId/members/:memberId", async (req, res, next) => {
    try {
      if (!isAdminOrSuper(req)) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { storeId, memberId } = req.params;
      const [deleted] = await db
        .delete(storeMembers)
        .where(and(eq(storeMembers.id, memberId), eq(storeMembers.storeId, storeId)))
        .returning();

      if (!deleted) {
        return res.status(404).json({ message: "Store member not found" });
      }

      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  });

  const MarketplaceItemAdminSchema = createMarketplaceItemSchema.extend({
    storeId: z.string().min(1, "Store ID is required"),
    estateId: z.string().optional(),
    isActive: z.boolean().optional(),
  });

  app.get("/api/admin/marketplace", async (req, res, next) => {
    try {
      if (!isAdminOrSuper(req)) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { storeId } = req.query;
      let query = db.select().from(marketplaceItems);
      if (typeof storeId === "string" && storeId.trim()) {
        query = query.where(eq(marketplaceItems.storeId, storeId.trim()));
      }

      const rows = await query.orderBy(desc(marketplaceItems.createdAt));
      res.json(rows);
    } catch (error) {
      console.error("/api/admin/marketplace GET error:", error);
      next(error);
    }
  });

  app.post("/api/admin/marketplace", async (req, res, next) => {
    try {
      if (!isAdminOrSuper(req)) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const parsed = MarketplaceItemAdminSchema.parse(req.body);
      const [created] = await db
        .insert(marketplaceItems)
        .values({
          vendorId: parsed.vendorId,
          storeId: parsed.storeId,
          estateId: parsed.estateId,
          name: parsed.name,
          description: parsed.description,
          price: parsed.price as any,
          currency: parsed.currency,
          category: parsed.category,
          subcategory: parsed.subcategory,
          stock: parsed.stock as any,
          images: parsed.images,
          isActive: parsed.isActive ?? true,
        })
        .returning();

      res.status(201).json(created);
    } catch (error) {
      console.error("/api/admin/marketplace POST error:", error);
      next(error);
    }
  });

  app.patch("/api/admin/marketplace/:id", async (req, res, next) => {
    try {
      if (!isAdminOrSuper(req)) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { id } = req.params;
      const updates = updateMarketplaceItemSchema.partial().parse(req.body);

      const [updated] = await db
        .update(marketplaceItems)
        .set({
          ...updates,
          updatedAt: new Date(),
        })
        .where(eq(marketplaceItems.id, id))
        .returning();

      if (!updated) {
        return res.status(404).json({ message: "Marketplace item not found" });
      }

      res.json(updated);
    } catch (error) {
      next(error);
    }
  });

  app.delete("/api/admin/marketplace/:id", async (req, res, next) => {
    try {
      if (!isAdminOrSuper(req)) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { id } = req.params;
      const deleted = await db
        .delete(marketplaceItems)
        .where(eq(marketplaceItems.id, id))
        .returning();

      if (!deleted || deleted.length === 0) {
        return res.status(404).json({ message: "Marketplace item not found" });
      }

      res.json({ success: true, item: deleted[0] });
    } catch (error) {
      next(error);
    }
  });

  // Admin: Companies (for providers)
  app.get("/api/admin/companies", async (req, res, next) => {
    try {
      if (!isAdminOrSuper(req)) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      const pendingOnly =
        String(req.query.pending || "") === "true" ||
        String(req.query.pending || "") === "1";
      const query = db
        .select()
        .from(companies)
        .where(pendingOnly ? eq(companies.isActive, false) : undefined)
        .orderBy(desc(companies.createdAt));
      const rows = await query;
      res.json(rows);
    } catch (error) {
      console.error("Error in GET /api/admin/companies:", error);
      console.error("Error message:", error instanceof Error ? error.message : String(error));
      console.error("Error stack:", error instanceof Error ? error.stack : "No stack");
      res.status(500).json({ 
        error: "Failed to fetch companies",
        message: error instanceof Error ? error.message : String(error)
      });
    }
  });

  app.post("/api/admin/companies", async (req, res, next) => {
    try {
      if (!isAdminOrSuper(req)) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const {
        name,
        description,
        contactEmail,
        phone,
        isActive,
        // Business Details
        businessAddress,
        businessCity,
        businessState,
        businessZipCode,
        businessCountry,
        businessType,
        // Registration & Compliance
        businessRegNumber,
        businessTaxId,
        // Bank Details
        bankAccountName,
        bankName,
        bankAccountNumber,
        bankRoutingNumber,
      } = req.body || {};

      if (!name) return res.status(400).json({ message: "Name is required" });

      // Structure the business details - filter out empty values
      const businessDetailsObj: any = {};
      if (businessAddress) businessDetailsObj.address = businessAddress;
      if (businessCity) businessDetailsObj.city = businessCity;
      if (businessState) businessDetailsObj.state = businessState;
      if (businessZipCode) businessDetailsObj.zipCode = businessZipCode;
      if (businessCountry) businessDetailsObj.country = businessCountry;
      if (businessType) businessDetailsObj.type = businessType;
      if (businessRegNumber) businessDetailsObj.registrationNumber = businessRegNumber;
      if (businessTaxId) businessDetailsObj.taxId = businessTaxId;

      const bankDetailsObj: any = {};
      if (bankAccountName) bankDetailsObj.accountName = bankAccountName;
      if (bankName) bankDetailsObj.bankName = bankName;
      if (bankAccountNumber) bankDetailsObj.accountNumber = bankAccountNumber;
      if (bankRoutingNumber) bankDetailsObj.routingNumber = bankRoutingNumber;

      const company = await storage.createCompany({
        name,
        description,
        contactEmail,
        phone,
        isActive: isActive === true,
        businessDetails: businessDetailsObj,
        bankDetails: bankDetailsObj,
        details: {}, // Ensure details is initialized
      } as any);

      res.status(201).json(company);
    } catch (error) {
      console.error("POST /api/admin/companies error:", error);
      console.error("Error details:", {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      next(error);
    }
  });

  app.put("/api/admin/companies/:id", async (req, res, next) => {
    try {
      if (!isAdminOrSuper(req)) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { id } = req.params;
      console.log("PUT /api/admin/companies/:id - ID:", id);
      console.log("Request body:", JSON.stringify(req.body, null, 2));
      
      // Accept structured fields for companies (partial updates allowed)
      const patchSchema = z.object({
        name: z.string().optional(),
        description: z.string().optional(),
        contactEmail: z.string().email().optional(),
        phone: z.string().optional(),
        providerId: z.string().optional().nullable(),
        businessDetails: z.any().optional(),
        bankDetails: z.any().optional(),
        locationDetails: z.any().optional(),
        submittedAt: z.preprocess((v) => {
          if (!v) return undefined; if (typeof v === 'string') return new Date(v); return v;
        }, z.date().optional()),
        isActive: z.boolean().optional(),
      }).partial();

      const payload = patchSchema.parse(req.body || {});
      console.log("Parsed payload:", JSON.stringify(payload, null, 2));

      // Build update object for flat structured fields
      const updates: any = {};
      if (payload.name !== undefined) updates.name = payload.name;
      if (payload.description !== undefined) updates.description = payload.description;
      if (payload.contactEmail !== undefined) updates.contactEmail = payload.contactEmail;
      if (payload.phone !== undefined) updates.phone = payload.phone;
      if (payload.providerId !== undefined) updates.providerId = payload.providerId;
      if (payload.isActive !== undefined) updates.isActive = payload.isActive;
      if (payload.businessDetails !== undefined) updates.businessDetails = payload.businessDetails;
      if (payload.bankDetails !== undefined) updates.bankDetails = payload.bankDetails;
      if (payload.locationDetails !== undefined) updates.locationDetails = payload.locationDetails;
      if (payload.submittedAt !== undefined) updates.submittedAt = payload.submittedAt;

      console.log("Updates to apply:", JSON.stringify(updates, null, 2));

      const company = await storage.updateCompany(id, updates as any);
      if (!company) return res.status(404).json({ message: "Company not found" });
      
      console.log("Company updated successfully:", JSON.stringify(company, null, 2));
      res.json(company);
    } catch (error) {
      console.error("Error in PUT /api/admin/companies/:id:", error);
      next(error);
    }
  });

  app.patch("/api/admin/companies/:id", async (req, res, next) => {
    try {
      if (!isAdminOrSuper(req)) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { id } = req.params;
      const payload = z
        .object({
          isActive: z.boolean(),
        })
        .parse(req.body || {});

      const [updated] = await db
        .update(companies)
        .set({ isActive: payload.isActive, updatedAt: new Date() })
        .where(eq(companies.id, id))
        .returning();

      if (!updated) {
        return res.status(404).json({ message: "Company not found" });
      }

      if (updated.providerId && payload.isActive === true) {
        const notification = await storage.createNotification({
          userId: updated.providerId,
          title: "Company Approved",
          message: `Your company "${updated.name}" has been verified and is now visible on the platform.`,
          type: "info",
          metadata: { kind: "company_approved", companyId: updated.id },
        });
        const io = req.app.get("io") as SocketIOServer | undefined;
        io?.to(`user-${updated.providerId}`).emit("notification:new", notification);
      }

      await storage.createAuditLog({
        actorId: req.user?.id ?? "system",
        action: payload.isActive ? "approve_company" : "reject_company",
        target: "company",
        targetId: updated.id,
        meta: {
          companyName: updated.name,
          providerId: updated.providerId,
        },
        ipAddress: req.ip,
        userAgent: req.get("user-agent") ?? "",
      });

      res.json(updated);
    } catch (error) {
      if ((error as any)?.issues) {
        return res.status(400).json({
          message: "Validation error",
          details: (error as any).issues,
        });
      }
      next(error);
    }
  });

  // GET single company with structured fields
  app.get("/api/admin/companies/:id", async (req, res, next) => {
    try {
      if (!isAdminOrSuper(req)) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { id } = req.params;
      const [row] = await db
        .select()
        .from(companies)
        .where(eq(companies.id, id))
        .limit(1 as any);

      if (!row) return res.status(404).json({ message: "Company not found" });
      res.json(row);
    } catch (error) {
      next(error);
    }
  });

  app.delete("/api/admin/companies/:id", async (req, res, next) => {
    try {
      if (!isAdminOrSuper(req)) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { id } = req.params;
      const deleted = await storage.deleteCompany(id);

      if (!deleted) {
        return res.status(404).json({ message: "Company not found" });
      }

      res.json({ message: "Company deleted successfully" });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/company/provider-requests", async (req, res, next) => {
    try {
      const parsed = providerRequestSchema.parse(req.body);
      const existingUser = await storage.getUserByEmail(parsed.email);
      if (existingUser) {
        return res
          .status(409)
          .json({ message: "A provider with that email already exists" });
      }

      const passwordToUse = parsed.password?.trim() || randomBytes(8).toString("hex");
      const hashedPassword = await hashPassword(passwordToUse);

        const combinedName = (parsed.name || `${parsed.firstName} ${parsed.lastName}`).trim();
        const wantsNewCompany =
          parsed.companyMode === "new" && typeof parsed.newCompanyName === "string" && parsed.newCompanyName.trim();
        let resolvedCompanyId = (parsed.companyId || parsed.company || "").trim();

        const user = await storage.createUser({
          firstName: parsed.firstName,
          lastName: parsed.lastName,
          name: combinedName,
          email: parsed.email,
          phone: parsed.phone || "",
          password: hashedPassword,
          role: "provider",
          company: wantsNewCompany ? "" : resolvedCompanyId,
          categories: parsed.categories,
          experience: parsed.experience,
          isApproved: false,
          metadata: parsed.description ? { description: parsed.description } : undefined,
        } as any);

        if (wantsNewCompany) {
          const createdCompany = await storage.createCompany({
            name: parsed.newCompanyName!.trim(),
            description: parsed.newCompanyDescription?.trim(),
            contactEmail: parsed.email,
            phone: parsed.phone || "",
            providerId: user.id,
            submittedAt: new Date(),
            isActive: false,
            details: {},
          } as any);
          resolvedCompanyId = createdCompany.id;
        }
        if (resolvedCompanyId) {
          await storage.updateUser(user.id, { company: resolvedCompanyId } as any);
        }
      const created = await storage.createProviderRequest({
        ...parsed,
        name: combinedName,
        providerId: user.id,
        company: resolvedCompanyId || parsed.company,
      });
      await storage.createAuditLog({
        actorId: user.id,
        action: "create_provider_request",
        target: "provider_request",
        targetId: created.id,
        meta: {
          providerEmail: parsed.email,
          company: parsed.company,
        },
        ipAddress: req.ip,
        userAgent: req.get("user-agent") ?? "",
      });
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
      next(error);
    }
  });

  app.get("/api/admin/provider-requests", async (req, res, next) => {
    try {
      if (!isAdminOrSuper(req)) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const rows = await db
        .select({
          id: providerRequests.id,
          name: providerRequests.name,
          email: providerRequests.email,
          company: providerRequests.company,
          categories: providerRequests.categories,
          experience: providerRequests.experience,
          description: providerRequests.description,
          createdAt: providerRequests.createdAt,
          providerId: sql`coalesce(${providerRequests.providerId}, ${users.id})`,
        })
        .from(providerRequests)
        .leftJoin(users, eq(users.email, providerRequests.email))
        .orderBy(desc(providerRequests.createdAt));

      res.json(rows);
    } catch (error) {
      next(error);
    }
  });

  // Admin: Get a specific service request by ID
  app.get("/api/admin/service-requests/:id", async (req, res, next) => {
    try {
      if (!req.isAuthenticated() || req.user?.role !== "admin") {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { id } = req.params;
      const request = await storage.getServiceRequest(id);

      if (!request) {
        return res.status(404).json({ message: "Service request not found" });
      }

      res.json(request);
    } catch (error) {
      console.error("Error fetching service request for admin:", error);
      next(error);
    }
  });

  // Access Code Generation Route (for testing)
  app.post("/api/generate-access-code", async (req, res, next) => {
    try {
      if (!req.isAuthenticated() || req.user?.role !== "admin") {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const accessCode = Math.floor(100000 + Math.random() * 900000).toString();
      res.json({ accessCode });
    } catch (error) {
      next(error);
    }
  });

  // Resident: Get a specific service request by ID
  app.get("/api/service-requests/:id", requireAuth, async (req, res, next) => {
    try {
      const { id } = req.params;
      if (!id || typeof id !== "string") {
        return res.status(400).json({ message: "Invalid service request ID" });
      }

      const request = await storage.getServiceRequest(id);

      if (!request) {
        return res.status(404).json({ message: "Service request not found" });
      }

      res.json(request);
    } catch (error) {
      console.error("Error fetching service request:", error);
      next(error);
    }
  });

  // ========== ORDERS MANAGEMENT ENDPOINTS ==========

  // Admin: Get all orders with pagination and filtering
  app.get("/api/admin/orders", async (req, res, next) => {
    try {
      if (!isAdminOrSuper(req)) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const {
        page = "1",
        limit = "20",
        sortBy = "createdAt",
        sortOrder = "desc",
        status,
        search,
        minTotal,
        maxTotal,
        startDate,
        endDate,
        hasDispute,
        orderType = "all", // "all", "legacy", "marketplace"
      } = req.query;

      const pageNum = Math.max(1, parseInt(page as string) || 1);
      const limitNum = Math.max(1, Math.min(100, parseInt(limit as string) || 20));
      const offset = (pageNum - 1) * limitNum;
      // Query both legacy orders and marketplace parent orders
      let allResults: any[] = [];

      // Fetch legacy orders
      if (orderType === "legacy" || orderType === "all") {
        let legacyQuery = db
          .select({
            id: orders.id,
            residentId: orders.buyerId,
            residentName: sql<string>`'Service/Item Order'`.as("residentName"),
            residentEmail: sql<string>`''`.as("residentEmail"),
            totalAmount: sql<number>`CAST(CAST(${orders.total} AS NUMERIC) * 100 AS INTEGER)`.as("totalAmount"),
            currency: orders.currency,
            status: orders.status,
            createdAt: orders.createdAt,
            updatedAt: orders.updatedAt,
            type: sql<string>`'legacy'`.as("type"),
            dispute: orders.dispute,
          })
          .from(orders);

        // Apply filters
        if (status && status !== "all") {
          legacyQuery = legacyQuery.where(eq(orders.status, status as any));
        }
        if (minTotal) {
          const minVal = Math.round(parseFloat(minTotal as string) * 100);
          legacyQuery = legacyQuery.where(
            sql`CAST(${orders.total} AS NUMERIC) * 100 >= ${minVal}`
          );
        }
        if (maxTotal) {
          const maxVal = Math.round(parseFloat(maxTotal as string) * 100);
          legacyQuery = legacyQuery.where(
            sql`CAST(${orders.total} AS NUMERIC) * 100 <= ${maxVal}`
          );
        }
        if (startDate) {
          const startDt = new Date(startDate as string);
          legacyQuery = legacyQuery.where(sql`${orders.createdAt} >= ${startDt}`);
        }
        if (endDate) {
          const endDt = new Date(endDate as string);
          legacyQuery = legacyQuery.where(sql`${orders.createdAt} <= ${endDt}`);
        }
        if (hasDispute === "true") {
          legacyQuery = legacyQuery.where(sql`${orders.dispute} IS NOT NULL`);
        } else if (hasDispute === "false") {
          legacyQuery = legacyQuery.where(sql`${orders.dispute} IS NULL`);
        }

        const legacyRows = await legacyQuery
          .orderBy(sortOrder === "desc" ? desc(orders.createdAt) : asc(orders.createdAt))
          .limit(limitNum)
          .offset(offset);
        allResults.push(...legacyRows);
      }

      // Fetch marketplace orders
      if (orderType === "marketplace" || orderType === "all") {
        let marketplaceQuery = db
          .select({
            id: parentOrders.id,
            residentId: parentOrders.residentId,
            residentName: users.name,
            residentEmail: users.email,
            totalAmount: parentOrders.totalAmount,
            currency: parentOrders.currency,
            status: parentOrders.status,
            createdAt: parentOrders.createdAt,
            updatedAt: parentOrders.updatedAt,
            type: sql<string>`'marketplace'`.as("type"),
            dispute: sql<any>`NULL`.as("dispute"),
          })
          .from(parentOrders)
          .innerJoin(users, eq(parentOrders.residentId, users.id));

        // Apply filters
        if (status && status !== "all") {
          marketplaceQuery = marketplaceQuery.where(eq(parentOrders.status, status as any));
        }
        if (minTotal) {
          const minVal = Math.round(parseFloat(minTotal as string) * 100);
          marketplaceQuery = marketplaceQuery.where(sql`${parentOrders.totalAmount} >= ${minVal}`);
        }
        if (maxTotal) {
          const maxVal = Math.round(parseFloat(maxTotal as string) * 100);
          marketplaceQuery = marketplaceQuery.where(sql`${parentOrders.totalAmount} <= ${maxVal}`);
        }
        if (startDate) {
          const startDt = new Date(startDate as string);
          marketplaceQuery = marketplaceQuery.where(sql`${parentOrders.createdAt} >= ${startDt}`);
        }
        if (endDate) {
          const endDt = new Date(endDate as string);
          marketplaceQuery = marketplaceQuery.where(sql`${parentOrders.createdAt} <= ${endDt}`);
        }
        if (search) {
          const searchPattern = `%${search}%`;
          marketplaceQuery = marketplaceQuery.where(
            or(
              ilike(users.name, searchPattern),
              ilike(users.email, searchPattern)
            )
          );
        }

        const marketplaceRows = await marketplaceQuery
          .orderBy(sortOrder === "desc" ? desc(parentOrders.createdAt) : asc(parentOrders.createdAt))
          .limit(limitNum)
          .offset(offset);
        allResults.push(...marketplaceRows);
      }

        // Deduplicate combined results by `id` to avoid showing the same order multiple times
        if (allResults.length > 1) {
          const seen = new Set<string>();
          const deduped: any[] = [];
          for (const r of allResults) {
            const key = String(r?.id || r?._id || "");
            if (!key) continue;
            if (!seen.has(key)) {
              seen.add(key);
              deduped.push(r);
            }
          }
          allResults = deduped;
        }

      // Calculate total
      let totalCount = 0;
      if (orderType === "all" || orderType === "legacy") {
        const [legacyCountResult] = await db
          .select({ count: sql`count(*)` })
          .from(orders)
          .where(status && status !== "all" ? eq(orders.status, status as any) : undefined);
        totalCount += parseInt((legacyCountResult?.count as number)?.toString() || "0");
      }
      if (orderType === "all" || orderType === "marketplace") {
        const [marketplaceCountResult] = await db
          .select({ count: sql`count(*)` })
          .from(parentOrders)
          .where(status && status !== "all" ? eq(parentOrders.status, status as any) : undefined);
        totalCount += parseInt((marketplaceCountResult?.count as number)?.toString() || "0");
      }

      res.json({
        orders: allResults,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: totalCount,
          totalPages: Math.ceil(totalCount / limitNum),
        },
      });
    } catch (error) {
      console.error("Error fetching orders:", error);
      next(error);
    }
  });

  // Admin: Get orders analytics/statistics
  app.get("/api/admin/orders/analytics/stats", async (req, res, next) => {
    try {
      if (!isAdminOrSuper(req)) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      // Get legacy orders stats
      const [legacyStatsResult] = await db
        .select({
          total: sql<number>`COUNT(*)`,
          delivered: sql<number>`COUNT(CASE WHEN ${eq(orders.status, "delivered")} THEN 1 END)`,
          pending: sql<number>`COUNT(CASE WHEN ${eq(orders.status, "pending")} THEN 1 END)`,
          cancelled: sql<number>`COUNT(CASE WHEN ${eq(orders.status, "cancelled")} THEN 1 END)`,
          processing: sql<number>`COUNT(CASE WHEN ${eq(orders.status, "processing")} THEN 1 END)`,
          totalRevenue: sql<string>`COALESCE(SUM(CAST(${orders.total} AS NUMERIC)), 0)`,
        })
        .from(orders);

      // Get marketplace orders stats
      const [marketplaceStatsResult] = await db
        .select({
          total: sql<number>`COUNT(*)`,
          paid: sql<number>`COUNT(CASE WHEN ${eq(parentOrders.status, "paid")} THEN 1 END)`,
          pending: sql<number>`COUNT(CASE WHEN ${eq(parentOrders.status, "pending_payment")} THEN 1 END)`,
          totalRevenue: sql<string>`COALESCE(SUM(${parentOrders.totalAmount}), 0)`,
        })
        .from(parentOrders);

      // Get recent orders (combine both types)
      const recentLegacyOrders = await db
        .select({
          id: orders.id,
          status: orders.status,
          totalAmount: orders.total,
          createdAt: orders.createdAt,
          residentId: orders.buyerId,
          type: sql<string>`'legacy'`,
        })
        .from(orders)
        .orderBy(desc(orders.createdAt))
        .limit(3);

      const recentMarketplaceOrders = await db
        .select({
          id: parentOrders.id,
          status: parentOrders.status,
          totalAmount: sql<string>`CAST(${parentOrders.totalAmount} / 100.0 AS VARCHAR)`,
          createdAt: parentOrders.createdAt,
          residentId: parentOrders.residentId,
          type: sql<string>`'marketplace'`,
        })
        .from(parentOrders)
        .orderBy(desc(parentOrders.createdAt))
        .limit(3);

      const recentOrders = [
        ...recentLegacyOrders.map((o: any) => ({
          id: o.id,
          resident: o.residentId,
          category: "Service/Item",
          status: o.status,
          totalAmount: parseFloat(o.totalAmount?.toString() || "0"),
          createdAt: o.createdAt,
          type: "legacy",
        })),
        ...recentMarketplaceOrders.map((o: any) => ({
          id: o.id,
          resident: o.residentId,
          category: "Marketplace",
          status: o.status,
          totalAmount: parseFloat(o.totalAmount?.toString() || "0") / 100, // Convert kobo to naira
          createdAt: o.createdAt,
          type: "marketplace",
        })),
      ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 5);

      const totalLegacy = parseInt(legacyStatsResult?.total?.toString() || "0");
      const totalMarketplace = parseInt(marketplaceStatsResult?.total?.toString() || "0");
      const legacyRevenue = parseFloat(legacyStatsResult?.totalRevenue?.toString() || "0");
      const marketplaceRevenue = parseFloat(marketplaceStatsResult?.totalRevenue?.toString() || "0") / 100; // Convert kobo to naira

      const stats = {
        totalOrders: totalLegacy + totalMarketplace,
        completedOrders: parseInt(legacyStatsResult?.delivered?.toString() || "0") + parseInt(marketplaceStatsResult?.paid?.toString() || "0"),
        pendingOrders: parseInt(legacyStatsResult?.pending?.toString() || "0") + parseInt(marketplaceStatsResult?.pending?.toString() || "0"),
        cancelledOrders: parseInt(legacyStatsResult?.cancelled?.toString() || "0"),
        processingOrders: parseInt(legacyStatsResult?.processing?.toString() || "0"),
        disputedOrders: 0,
        totalRevenue: legacyRevenue + marketplaceRevenue,
        averageOrderValue: (totalLegacy + totalMarketplace) > 0 ? (legacyRevenue + marketplaceRevenue) / (totalLegacy + totalMarketplace) : 0,
        byStatus: {
          delivered: parseInt(legacyStatsResult?.delivered?.toString() || "0"),
          pending: parseInt(legacyStatsResult?.pending?.toString() || "0"),
          cancelled: parseInt(legacyStatsResult?.cancelled?.toString() || "0"),
          processing: parseInt(legacyStatsResult?.processing?.toString() || "0"),
          paid: parseInt(marketplaceStatsResult?.paid?.toString() || "0"),
          confirmed: 0,
        },
        recentOrders,
      };

      res.json(stats);
    } catch (error) {
      console.error("Error fetching order stats:", error);
      next(error);
    }
  });

  // Admin: Update order status
  app.patch("/api/admin/orders/:orderId/status", async (req, res, next) => {
    try {
      if (!isAdminOrSuper(req)) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { orderId } = req.params;
      const { status } = req.body;

      if (!status || !["pending", "confirmed", "processing", "dispatched", "delivered", "cancelled", "disputed"].includes(status)) {
        return res.status(400).json({ message: "Invalid status" });
      }

      const [updated] = await db
        .update(orders)
        .set({
          status: status as any,
          updatedAt: new Date(),
        })
        .where(eq(orders.id, orderId))
        .returning();

      if (!updated) {
        return res.status(404).json({ message: "Order not found" });
      }

      res.json(updated);
    } catch (error) {
      console.error("Error updating order status:", error);
      next(error);
    }
  });

  // Admin: Create dispute for order
  app.post("/api/admin/orders/:orderId/dispute", async (req, res, next) => {
    try {
      if (!isAdminOrSuper(req)) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { orderId } = req.params;
      const { reason, description } = req.body;

      if (!reason) {
        return res.status(400).json({ message: "Dispute reason is required" });
      }

      const [updated] = await db
        .update(orders)
        .set({
          dispute: {
            reason,
            description: description || "",
            status: "open",
            createdAt: new Date().toISOString(),
          } as any,
          status: "disputed",
          updatedAt: new Date(),
        })
        .where(eq(orders.id, orderId))
        .returning();

      if (!updated) {
        return res.status(404).json({ message: "Order not found" });
      }

      res.json(updated);
    } catch (error) {
      console.error("Error creating dispute:", error);
      next(error);
    }
  });

  // Admin: Resolve dispute for order
  app.patch("/api/admin/orders/:orderId/dispute", async (req, res, next) => {
    try {
      if (!isAdminOrSuper(req)) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { orderId } = req.params;
      const { status, resolution, refundAmount } = req.body;

      if (!status || !["resolved", "rejected", "escalated"].includes(status)) {
        return res.status(400).json({ message: "Invalid dispute status" });
      }

      if (!resolution) {
        return res.status(400).json({ message: "Resolution is required" });
      }

      const [current] = await db
        .select()
        .from(orders)
        .where(eq(orders.id, orderId));

      if (!current) {
        return res.status(404).json({ message: "Order not found" });
      }

      const updatedDispute = {
        ...(current.dispute as Record<string, any> || {}),
        status,
        resolution,
        refundAmount: refundAmount || 0,
        resolvedAt: new Date().toISOString(),
      };

      const [updated] = await db
        .update(orders)
        .set({
          dispute: updatedDispute as any,
          updatedAt: new Date(),
        })
        .where(eq(orders.id, orderId))
        .returning();

      res.json(updated);
    } catch (error) {
      console.error("Error resolving dispute:", error);
      next(error);
    }
  });

  const httpServer = createServer(app);
  const io = new SocketIOServer(httpServer, {
    cors: { origin: "*", credentials: true },
  });
  app.set("io", io);
  io.on("connection", (socket) => {
    socket.on("join", (userId: string) => {
      if (!userId) return;
      socket.join(`user-${userId}`);
    });
  });
  return httpServer;}
