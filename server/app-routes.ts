// server/app-routes.ts
import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { storage } from "./storage";
import { db } from "./db";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import {
  assetSubscriptions,
  aiConversationFlowSettings,
  aiSessionAttachments,
  aiSessionMessages,
  aiSessions,
  conversationMessages,
  conversations,
  insertServiceRequestSchema,
  maintenanceCategories,
  maintenanceItemTypes,
  maintenancePlans,
  maintenanceSchedules,
  memberships,
  residentAssets,
  residentNotificationPreferences,
  residentSettings,
  requestConversationSettings,
  requestQuestions,
  serviceRequests,
  serviceRequestCancellationCases,
  userDeviceSessions,
  users,
} from "@shared/schema";
import { requireAuth, requireResident } from "./auth-middleware";
import { ollamaChat } from "./ai/ollama";
import { safeParseJsonFromText } from "./ai/safe-json";
import { getProviderMatches } from "./providers/matching";
import { generateGeminiContent } from "./ai/geminiClient";
import { IMAGE_LIMITS, validateDataUrl } from "./utils/validate-dataurl";
import { backfillApprovedCategoriesFromServiceCategories } from "./approvedCategorySync";
import { comparePasswords, hashPassword } from "./auth-utils";
import {
  completeOrdinaryFlowSession,
  getOrdinaryFlowSessionById,
  startOrGetOrdinaryFlowSession,
  writeOrdinaryFlowAnswer,
} from "./services/ordinaryFlowEngine";
import { getMaintenanceCatalog } from "./services/maintenanceCatalogService";
import {
  cancelMaintenanceSubscription,
  activateMaintenanceSubscriptionFromReference,
  createMaintenanceSubscriptionCheckout,
  pauseMaintenanceSubscription,
  resumeMaintenanceSubscription,
} from "./services/maintenanceSubscriptionService";
import { getMaintenanceSummaryForRequest } from "./services/maintenanceRequestIntegrationService";
import { verifyAndFinalizePaystackCharge } from "./payments";
import { rescheduleMaintenanceVisit } from "./services/maintenanceScheduleService";

const router = Router();

const CANCELLATION_REVIEW_REQUIRED_STATUSES = new Set([
  "assigned",
  "assigned_for_inspection",
  "assigned_for_job",
  "in_progress",
  "work_completed_pending_resident",
  "disputed",
  "rework_required",
  "completed",
]);

const SETTINGS_NOTIFICATION_EVENT_KEYS = [
  "provider_assigned",
  "inspection_scheduled",
  "report_ready",
  "payment_requested",
  "status_changed",
  "job_completed",
  "refund_update",
  "new_message",
  "system_announcements",
] as const;

const DIGEST_FREQUENCIES = ["off", "daily", "weekly"] as const;
const PROFILE_VISIBILITIES = ["private", "contacts", "public"] as const;

const NotificationEventPreferenceSchema = z
  .object({
    eventKey: z.enum(SETTINGS_NOTIFICATION_EVENT_KEYS),
    inApp: z.boolean(),
    email: z.boolean(),
    sms: z.boolean(),
  })
  .superRefine((value, ctx) => {
    if (!value.inApp && !value.email && !value.sms) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "At least one channel must be enabled for each event.",
      });
    }
  });

const SettingsProfilePatchSchema = z
  .object({
    firstName: z.string().trim().min(1).max(80).optional(),
    lastName: z.string().trim().min(1).max(80).optional(),
    username: z
      .string()
      .trim()
      .toLowerCase()
      .regex(/^[a-z0-9._-]{3,30}$/)
      .optional()
      .or(z.literal("").transform(() => null)),
    email: z.string().trim().email().toLowerCase().optional(),
    phone: z
      .string()
      .trim()
      .regex(/^\+[1-9]\d{7,14}$/)
      .optional(),
    profileImage: z
      .string()
      .trim()
      .max(10_000_000)
      .optional()
      .or(z.literal("").transform(() => null)),
    bio: z.string().trim().max(500).optional().or(z.literal("").transform(() => null)),
    website: z
      .string()
      .trim()
      .max(200)
      .url()
      .refine((value) => /^https?:\/\//i.test(value), "Website must start with http:// or https://")
      .optional()
      .or(z.literal("").transform(() => null)),
    countryCode: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z]{2}$/)
      .optional()
      .or(z.literal("").transform(() => null)),
    timezone: z
      .string()
      .trim()
      .optional()
      .or(z.literal("").transform(() => null)),
  })
  .strict();

const SettingsNotificationsPatchSchema = z
  .object({
    quietHoursEnabled: z.boolean().optional(),
    quietHoursStart: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
    quietHoursEnd: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
    digestFrequency: z.enum(DIGEST_FREQUENCIES).optional(),
    events: z.array(NotificationEventPreferenceSchema).optional(),
  })
  .strict();

const SettingsPrivacyPatchSchema = z
  .object({
    profileVisibility: z.enum(PROFILE_VISIBILITIES).optional(),
    showPhoneToProvider: z.boolean().optional(),
    showEmailToProvider: z.boolean().optional(),
    allowMarketing: z.boolean().optional(),
    allowAnalytics: z.boolean().optional(),
    allowPersonalization: z.boolean().optional(),
  })
  .strict();

const SettingsSecurityPatchSchema = z
  .object({
    loginAlertsEnabled: z.boolean(),
  })
  .strict();

const ChangePasswordSchema = z
  .object({
    currentPassword: z.string().min(1),
    newPassword: z
      .string()
      .min(8)
      .max(128)
      .regex(/[A-Z]/, "Password must include an uppercase letter")
      .regex(/[a-z]/, "Password must include a lowercase letter")
      .regex(/[0-9]/, "Password must include a number")
      .regex(/[^A-Za-z0-9]/, "Password must include a special character"),
  })
  .refine((value) => value.currentPassword !== value.newPassword, {
    message: "New password must be different from current password.",
    path: ["newPassword"],
  });

const MaintenanceAssetBaseSchema = z.object({
  maintenanceItemTypeId: z.string().trim().min(1).optional(),
  maintenanceItemId: z.string().trim().min(1).optional(),
  categoryId: z.string().trim().min(1).optional(),
  estateId: z.string().trim().optional().nullable(),
  customName: z.string().trim().max(120).optional().nullable(),
  nickname: z.string().trim().max(120).optional().nullable(),
  locationLabel: z.string().trim().max(160).optional().nullable(),
  brand: z.string().trim().max(120).optional().nullable(),
  model: z.string().trim().max(120).optional().nullable(),
  serialNumber: z.string().trim().max(120).optional().nullable(),
  purchaseDate: z.string().trim().max(40).optional().nullable(),
  installedAt: z.string().trim().max(40).optional().nullable(),
  lastServiceDate: z.string().trim().max(40).optional().nullable(),
  condition: z.enum(["new", "good", "fair", "poor"]).optional(),
  notes: z.string().trim().max(2000).optional().nullable(),
  metadata: z.record(z.any()).optional().nullable(),
  isActive: z.boolean().optional(),
});

const MaintenanceAssetUpsertSchema = MaintenanceAssetBaseSchema.superRefine((value, ctx) => {
  if (!value.maintenanceItemId && !value.maintenanceItemTypeId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Select an item type.",
      path: ["maintenanceItemId"],
    });
  }
});

const MaintenanceSubscriptionCreateSchema = z.object({
  residentAssetId: z.string().trim().min(1),
  maintenancePlanId: z.string().trim().min(1),
  startDate: z.string().datetime().optional().nullable(),
});

const MaintenanceSubscriptionVerifySchema = z.object({
  reference: z.string().trim().min(6),
});

const MaintenanceScheduleRescheduleSchema = z.object({
  scheduledDate: z.string().trim().min(1),
  notes: z.string().trim().max(1000).optional().nullable(),
});

function normalizeServiceRequestStatusKey(value: unknown) {
  return String(value || "")
    .toLowerCase()
    .replace(/[\s-]+/g, "_")
    .trim();
}

function normalizeDigestFrequency(value: unknown): (typeof DIGEST_FREQUENCIES)[number] {
  const normalized = String(value || "").toLowerCase().trim();
  if ((DIGEST_FREQUENCIES as readonly string[]).includes(normalized)) {
    return normalized as (typeof DIGEST_FREQUENCIES)[number];
  }
  return "off";
}

function normalizeProfileVisibility(value: unknown): (typeof PROFILE_VISIBILITIES)[number] {
  const normalized = String(value || "").toLowerCase().trim();
  if ((PROFILE_VISIBILITIES as readonly string[]).includes(normalized)) {
    return normalized as (typeof PROFILE_VISIBILITIES)[number];
  }
  return "private";
}

function normalizeOptionalMaintenanceDate(value: unknown) {
  if (value === undefined) return undefined;
  if (value === null) return null;

  const normalized = String(value || "").trim();
  if (!normalized) return null;

  const date = /^\d{4}-\d{2}-\d{2}$/.test(normalized)
    ? new Date(`${normalized}T00:00:00.000Z`)
    : new Date(normalized);

  if (Number.isNaN(date.getTime())) {
    const error = new Error("Invalid date value supplied.");
    (error as any).status = 400;
    throw error;
  }

  return date;
}

function buildResidentAssetPayload(parsed: z.infer<typeof MaintenanceAssetUpsertSchema>) {
  return {
    maintenanceItemId: parsed.maintenanceItemId ?? parsed.maintenanceItemTypeId,
    estateId: parsed.estateId ?? null,
    customName: parsed.customName ?? parsed.nickname ?? null,
    locationLabel: parsed.locationLabel ?? null,
    brand: parsed.brand ?? null,
    model: parsed.model ?? null,
    serialNumber: parsed.serialNumber ?? null,
    purchaseDate: normalizeOptionalMaintenanceDate(parsed.purchaseDate) ?? null,
    installedAt: normalizeOptionalMaintenanceDate(parsed.installedAt) ?? null,
    lastServiceDate: normalizeOptionalMaintenanceDate(parsed.lastServiceDate) ?? null,
    condition: parsed.condition ?? "good",
    notes: parsed.notes ?? null,
    metadata: parsed.metadata ?? null,
    isActive: parsed.isActive ?? true,
  };
}

function serializeMaintenanceCategoryForResident(category: typeof maintenanceCategories.$inferSelect, itemCount = 0) {
  return {
    id: category.id,
    name: category.name,
    slug: category.slug,
    icon: category.icon,
    description: category.description,
    isActive: category.isActive,
    createdAt: category.createdAt,
    itemCount,
  };
}

function serializeMaintenanceItemForResident(
  item: typeof maintenanceItemTypes.$inferSelect,
  category?: typeof maintenanceCategories.$inferSelect | null,
) {
  return {
    id: item.id,
    categoryId: item.categoryId,
    name: item.name,
    slug: item.slug,
    description: item.description,
    defaultFrequency: item.defaultFrequency,
    recommendedTasks: item.recommendedTasks,
    imageUrl: item.imageUrl ?? null,
    isActive: item.isActive,
    createdAt: item.createdAt,
    category: category
      ? {
          id: category.id,
          name: category.name,
          icon: category.icon,
          description: category.description,
        }
      : null,
  };
}

function serializeResidentAssetRow(row: {
  asset: typeof residentAssets.$inferSelect;
  itemType: typeof maintenanceItemTypes.$inferSelect;
  category: typeof maintenanceCategories.$inferSelect;
}) {
  const displayName = row.asset.customName?.trim() || row.itemType.name;
  return {
    id: row.asset.id,
    displayName,
    customName: row.asset.customName,
    locationLabel: row.asset.locationLabel,
    purchaseDate: row.asset.purchaseDate,
    installedAt: row.asset.installedAt,
    lastServiceDate: row.asset.lastServiceDate,
    condition: row.asset.condition,
    notes: row.asset.notes,
    metadata: row.asset.metadata,
    isActive: row.asset.isActive,
    createdAt: row.asset.createdAt,
    updatedAt: row.asset.updatedAt,
    item: serializeMaintenanceItemForResident(row.itemType, row.category),
    category: {
      id: row.category.id,
      name: row.category.name,
      icon: row.category.icon,
      description: row.category.description,
      slug: row.category.slug,
    },
  };
}

function addMonths(baseDate: Date, months: number) {
  const next = new Date(baseDate);
  next.setMonth(next.getMonth() + months);
  return next;
}

function maintenanceDurationToMonths(value: unknown) {
  switch (String(value || "")) {
    case "monthly":
      return 1;
    case "quarterly_3m":
      return 3;
    case "halfyearly_6m":
      return 6;
    case "yearly":
      return 12;
    default:
      return 1;
  }
}

function formatMaintenanceDurationLabel(value: unknown) {
  switch (String(value || "")) {
    case "monthly":
      return "Monthly";
    case "quarterly_3m":
      return "3 months";
    case "halfyearly_6m":
      return "6 months";
    case "yearly":
      return "Yearly";
    default:
      return "Custom";
  }
}

function serializeResidentPlanRow(params: {
  plan: typeof maintenancePlans.$inferSelect;
  itemType: typeof maintenanceItemTypes.$inferSelect;
  category: typeof maintenanceCategories.$inferSelect;
  currentSubscription?: typeof assetSubscriptions.$inferSelect | null;
  nextScheduledDate?: Date | null;
}) {
  return {
    id: params.plan.id,
    name: params.plan.name,
    description: params.plan.description,
    durationType: params.plan.durationType,
    durationLabel: formatMaintenanceDurationLabel(params.plan.durationType),
    price: params.plan.price,
    currency: params.plan.currency,
    visitsIncluded: params.plan.visitsIncluded,
    includedTasks: params.plan.includedTasks,
    requestLeadDays: params.plan.requestLeadDays,
    isActive: params.plan.isActive,
    item: {
      id: params.itemType.id,
      name: params.itemType.name,
      imageUrl: params.itemType.imageUrl ?? null,
    },
    category: {
      id: params.category.id,
      name: params.category.name,
      icon: params.category.icon,
    },
    currentSubscription: params.currentSubscription
      ? {
          id: params.currentSubscription.id,
          status: params.currentSubscription.status,
          startDate: params.currentSubscription.startDate,
          endDate: params.currentSubscription.endDate,
          nextScheduledDate: params.nextScheduledDate ?? null,
        }
      : null,
  };
}

async function getNextScheduleForSubscription(subscriptionId: string) {
  const allRows = await db
    .select({
      scheduledDate: maintenanceSchedules.scheduledDate,
      status: maintenanceSchedules.status,
    })
    .from(maintenanceSchedules)
    .where(eq(maintenanceSchedules.subscriptionId, subscriptionId))
    .orderBy(asc(maintenanceSchedules.scheduledDate));

  return (
    allRows.find(
      (schedule: any) =>
        !["completed", "cancelled", "missed", "rescheduled"].includes(
          String(schedule.status || "").toLowerCase(),
        ),
    ) ||
    allRows[0] ||
    null
  );
}

async function getResidentSubscriptionRow(params: {
  userId: string;
  subscriptionId: string;
}) {
  const rows = await db
    .select({
      subscription: assetSubscriptions,
      asset: residentAssets,
      plan: maintenancePlans,
      itemType: maintenanceItemTypes,
      category: maintenanceCategories,
    })
    .from(assetSubscriptions)
    .innerJoin(
      residentAssets,
      eq(assetSubscriptions.residentAssetId, residentAssets.id),
    )
    .innerJoin(
      maintenancePlans,
      eq(assetSubscriptions.maintenancePlanId, maintenancePlans.id),
    )
    .innerJoin(
      maintenanceItemTypes,
      eq(residentAssets.maintenanceItemId, maintenanceItemTypes.id),
    )
    .innerJoin(
      maintenanceCategories,
      eq(maintenanceItemTypes.categoryId, maintenanceCategories.id),
    )
    .where(
      and(
        eq(assetSubscriptions.id, params.subscriptionId),
        eq(assetSubscriptions.userId, params.userId),
      ),
    )
    .limit(1);

  return rows[0] ?? null;
}

async function serializeResidentSubscriptionRow(params: {
  subscription: typeof assetSubscriptions.$inferSelect;
  asset: typeof residentAssets.$inferSelect;
  plan: typeof maintenancePlans.$inferSelect;
  itemType: typeof maintenanceItemTypes.$inferSelect;
  category: typeof maintenanceCategories.$inferSelect;
}) {
  const schedules = await db
    .select({
      id: maintenanceSchedules.id,
      scheduledDate: maintenanceSchedules.scheduledDate,
      status: maintenanceSchedules.status,
      sourceRequestId: maintenanceSchedules.sourceRequestId,
    })
    .from(maintenanceSchedules)
    .where(eq(maintenanceSchedules.subscriptionId, params.subscription.id))
    .orderBy(asc(maintenanceSchedules.scheduledDate));

  const nextSchedule =
    schedules.find((schedule: any) =>
      !["completed", "cancelled", "missed", "rescheduled"].includes(
        String(schedule.status || "").toLowerCase(),
      ),
    ) || schedules[0] || null;

  return {
    id: params.subscription.id,
    status: params.subscription.status,
    autoRenew: params.subscription.autoRenew,
    startDate: params.subscription.startDate,
    endDate: params.subscription.endDate,
    activatedAt: params.subscription.activatedAt,
    pausedAt: params.subscription.pausedAt,
    expiredAt: params.subscription.expiredAt,
    cancelledAt: params.subscription.cancelledAt,
    billingAmount: params.subscription.billingAmount,
    currency: params.subscription.currency,
    nextScheduleAt: params.subscription.nextScheduleAt,
    asset: {
      id: params.asset.id,
      displayName: params.asset.customName?.trim() || params.itemType.name,
      customName: params.asset.customName,
      locationLabel: params.asset.locationLabel,
      condition: params.asset.condition,
    },
    plan: {
      id: params.plan.id,
      name: params.plan.name,
      description: params.plan.description,
      durationType: params.plan.durationType,
      durationLabel: formatMaintenanceDurationLabel(params.plan.durationType),
      price: params.plan.price,
      currency: params.plan.currency,
      visitsIncluded: params.plan.visitsIncluded,
      includedTasks: params.plan.includedTasks,
    },
    item: {
      id: params.itemType.id,
      name: params.itemType.name,
      imageUrl: params.itemType.imageUrl ?? null,
    },
    category: {
      id: params.category.id,
      name: params.category.name,
      icon: params.category.icon,
    },
    scheduleSummary: {
      total: schedules.length,
      next: nextSchedule
        ? {
            id: nextSchedule.id,
            scheduledDate: nextSchedule.scheduledDate,
            status: nextSchedule.status,
            sourceRequestId: nextSchedule.sourceRequestId ?? null,
          }
        : null,
      preview: schedules.slice(0, 3).map((schedule: any) => ({
        id: schedule.id,
        scheduledDate: schedule.scheduledDate,
        status: schedule.status,
      })),
    },
  };
}

function serializeResidentScheduleRow(params: {
  schedule: typeof maintenanceSchedules.$inferSelect;
  subscription: typeof assetSubscriptions.$inferSelect;
  asset: typeof residentAssets.$inferSelect;
  plan: typeof maintenancePlans.$inferSelect;
  itemType: typeof maintenanceItemTypes.$inferSelect;
  category: typeof maintenanceCategories.$inferSelect;
  request?: typeof serviceRequests.$inferSelect | null;
  provider?: typeof users.$inferSelect | null;
}) {
  const providerName = params.provider
    ? [params.provider.firstName, params.provider.lastName].filter(Boolean).join(" ").trim() ||
      params.provider.name ||
      params.provider.email
    : null;

  return {
    id: params.schedule.id,
    scheduledDate: params.schedule.scheduledDate,
    status: params.schedule.status,
    completedAt: params.schedule.completedAt,
    skippedAt: params.schedule.skippedAt,
    rescheduledFrom: params.schedule.rescheduledFrom ?? null,
    notes: params.schedule.notes ?? null,
    asset: {
      id: params.asset.id,
      displayName: params.asset.customName?.trim() || params.itemType.name,
      itemType: params.itemType.name,
      locationLabel: params.asset.locationLabel ?? null,
      condition: params.asset.condition,
      category: {
        id: params.category.id,
        name: params.category.name,
        icon: params.category.icon,
      },
    },
    subscription: {
      id: params.subscription.id,
      status: params.subscription.status,
      startDate: params.subscription.startDate,
      endDate: params.subscription.endDate,
    },
    plan: {
      id: params.plan.id,
      name: params.plan.name,
      durationType: params.plan.durationType,
      durationLabel: formatMaintenanceDurationLabel(params.plan.durationType),
      price: params.plan.price,
      currency: params.plan.currency,
      visitsIncluded: params.plan.visitsIncluded,
    },
    request: params.request
      ? {
          id: params.request.id,
          status: params.request.status,
          providerId: params.request.providerId ?? null,
          provider: providerName
            ? {
                id: params.provider?.id ?? null,
                name: providerName,
                company: params.provider?.company ?? null,
              }
            : null,
        }
      : null,
  };
}

async function getResidentScheduleRows(params: { userId: string; scheduleId?: string }) {
  const query = db
    .select({
      schedule: maintenanceSchedules,
      subscription: assetSubscriptions,
      asset: residentAssets,
      plan: maintenancePlans,
      itemType: maintenanceItemTypes,
      category: maintenanceCategories,
      request: serviceRequests,
      provider: users,
    })
    .from(maintenanceSchedules)
    .innerJoin(
      assetSubscriptions,
      eq(maintenanceSchedules.subscriptionId, assetSubscriptions.id),
    )
    .innerJoin(
      residentAssets,
      eq(assetSubscriptions.residentAssetId, residentAssets.id),
    )
    .innerJoin(
      maintenancePlans,
      eq(assetSubscriptions.maintenancePlanId, maintenancePlans.id),
    )
    .innerJoin(
      maintenanceItemTypes,
      eq(residentAssets.maintenanceItemId, maintenanceItemTypes.id),
    )
    .innerJoin(
      maintenanceCategories,
      eq(maintenanceItemTypes.categoryId, maintenanceCategories.id),
    )
    .leftJoin(
      serviceRequests,
      eq(maintenanceSchedules.sourceRequestId, serviceRequests.id),
    )
    .leftJoin(
      users,
      eq(serviceRequests.providerId, users.id),
    );

  if (params.scheduleId) {
    return await query
      .where(
        and(
          eq(assetSubscriptions.userId, params.userId),
          eq(maintenanceSchedules.id, params.scheduleId),
        ),
      )
      .limit(1);
  }

  return await query
    .where(eq(assetSubscriptions.userId, params.userId))
    .orderBy(asc(maintenanceSchedules.scheduledDate));
}

async function getResidentAssetRows(params: { userId: string; assetId?: string }) {
  const query = db
    .select({
      asset: residentAssets,
      itemType: maintenanceItemTypes,
      category: maintenanceCategories,
    })
    .from(residentAssets)
    .innerJoin(
      maintenanceItemTypes,
      eq(residentAssets.maintenanceItemId, maintenanceItemTypes.id),
    )
    .innerJoin(
      maintenanceCategories,
      eq(maintenanceItemTypes.categoryId, maintenanceCategories.id),
    );

  if (params.assetId) {
    return await query
      .where(and(eq(residentAssets.userId, params.userId), eq(residentAssets.id, params.assetId)))
      .limit(1);
  }

  return await query
    .where(eq(residentAssets.userId, params.userId))
    .orderBy(desc(residentAssets.createdAt));
}

function isValidTimeZone(value: string) {
  try {
    Intl.DateTimeFormat("en-US", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

function createProfilePayload(user: any) {
  return {
    firstName: user?.firstName ?? "",
    lastName: user?.lastName ?? "",
    username: user?.username ?? null,
    email: user?.email ?? "",
    phone: user?.phone ?? "",
    profileImage: user?.profileImage ?? null,
    bio: user?.bio ?? null,
    website: user?.website ?? null,
    countryCode: user?.countryCode ?? null,
    timezone: user?.timezone ?? null,
    lastUpdatedAt: user?.updatedAt ?? null,
  };
}

function normalizeSettingsEventMap(
  rows: Array<{
    eventKey: string;
    inAppEnabled: boolean;
    emailEnabled: boolean;
    smsEnabled: boolean;
  }>,
) {
  const byKey = new Map(
    rows.map((row) => [
      row.eventKey,
      {
        eventKey: row.eventKey,
        inApp: Boolean(row.inAppEnabled),
        email: Boolean(row.emailEnabled),
        sms: Boolean(row.smsEnabled),
      },
    ]),
  );

  return SETTINGS_NOTIFICATION_EVENT_KEYS.map((eventKey) => {
    const existing = byKey.get(eventKey);
    if (existing) return existing;
    return {
      eventKey,
      inApp: true,
      email: false,
      sms: false,
    };
  });
}

async function getResidentSettingsData(userId: string, currentSessionId?: string) {
  const [user, settingsRow, prefsRows, sessionRows] = await Promise.all([
    db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1)
      .then((rows: any[]) => rows[0] || null),
    db
      .select()
      .from(residentSettings)
      .where(eq(residentSettings.userId, userId))
      .limit(1)
      .then((rows: any[]) => rows[0] || null),
    db
      .select({
        eventKey: residentNotificationPreferences.eventKey,
        inAppEnabled: residentNotificationPreferences.inAppEnabled,
        emailEnabled: residentNotificationPreferences.emailEnabled,
        smsEnabled: residentNotificationPreferences.smsEnabled,
      })
      .from(residentNotificationPreferences)
      .where(eq(residentNotificationPreferences.userId, userId)),
    db
      .select()
      .from(userDeviceSessions)
      .where(
        and(eq(userDeviceSessions.userId, userId), sql`${userDeviceSessions.revokedAt} IS NULL`),
      )
      .orderBy(desc(userDeviceSessions.lastSeenAt)),
  ]);

  if (!user) return null;

  const notificationsPayload = {
    quietHoursEnabled: Boolean(settingsRow?.quietHoursEnabled ?? false),
    quietHoursStart: settingsRow?.quietHoursStart ?? null,
    quietHoursEnd: settingsRow?.quietHoursEnd ?? null,
    digestFrequency: normalizeDigestFrequency(settingsRow?.digestFrequency),
    events: normalizeSettingsEventMap(prefsRows),
  };

  const privacyPayload = {
    profileVisibility: normalizeProfileVisibility(settingsRow?.profileVisibility),
    showPhoneToProvider: Boolean(settingsRow?.showPhoneToProvider ?? false),
    showEmailToProvider: Boolean(settingsRow?.showEmailToProvider ?? false),
    allowMarketing: Boolean(settingsRow?.allowMarketing ?? false),
    allowAnalytics: Boolean(settingsRow?.allowAnalytics ?? true),
    allowPersonalization: Boolean(settingsRow?.allowPersonalization ?? true),
  };

  const sessionsPayload = sessionRows.map((row: any) => ({
    id: row.id,
    isCurrent: row.sessionId === currentSessionId,
    userAgent: row.userAgent || "Unknown device",
    ipAddress: row.ipAddress || "",
    lastSeenAt: row.lastSeenAt ? new Date(row.lastSeenAt).toISOString() : null,
    createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : null,
  }));

  return {
    profile: createProfilePayload(user),
    notifications: notificationsPayload,
    privacy: privacyPayload,
    security: {
      loginAlertsEnabled: Boolean(settingsRow?.loginAlertsEnabled ?? true),
      sessions: sessionsPayload,
    },
  };
}

async function updateProfileSettings(userId: string, payload: Record<string, unknown>) {
  const parsed = SettingsProfilePatchSchema.safeParse(payload);
  if (!parsed.success) {
    return {
      ok: false as const,
      status: 400,
      error: parsed.error.flatten(),
    };
  }

  const body = parsed.data;
  const normalizedProfileImage =
    typeof body.profileImage === "string"
      ? (body.profileImage.trim() ? body.profileImage.trim() : null)
      : body.profileImage;

  if (body.timezone && !isValidTimeZone(body.timezone)) {
    return {
      ok: false as const,
      status: 400,
      error: { fieldErrors: { timezone: ["Invalid IANA timezone"] } },
    };
  }
  if (typeof normalizedProfileImage === "string" && normalizedProfileImage) {
    const profileImageValue = normalizedProfileImage;
    if (profileImageValue.startsWith("data:")) {
      try {
        validateDataUrl(profileImageValue, { maxBytes: IMAGE_LIMITS.maxImageBytes });
      } catch (error) {
        return {
          ok: false as const,
          status: 400,
          error: {
            fieldErrors: {
              profileImage: [String((error as Error)?.message || "Invalid profile image")],
            },
          },
        };
      }
    }
  }

  const updates: Record<string, unknown> = {};
  if (body.firstName !== undefined) updates.firstName = body.firstName;
  if (body.lastName !== undefined) updates.lastName = body.lastName;
  if (body.username !== undefined) updates.username = body.username;
  if (body.email !== undefined) updates.email = body.email;
  if (body.phone !== undefined) updates.phone = body.phone;
  if (body.profileImage !== undefined) updates.profileImage = normalizedProfileImage;
  if (body.bio !== undefined) updates.bio = body.bio;
  if (body.website !== undefined) updates.website = body.website;
  if (body.countryCode !== undefined) updates.countryCode = body.countryCode;
  if (body.timezone !== undefined) updates.timezone = body.timezone;

  if (Object.keys(updates).length === 0) {
    const existing = await storage.getUser(userId);
    if (!existing) {
      return { ok: false as const, status: 404, error: { message: "User not found" } };
    }
    return { ok: true as const, user: existing };
  }

  if (typeof updates.email === "string") {
    const normalizedEmail = String(updates.email).toLowerCase().trim();
    const emailCollision = await db
      .select({ id: users.id })
      .from(users)
      .where(and(sql`lower(${users.email}) = ${normalizedEmail}`, sql`${users.id} <> ${userId}`))
      .limit(1);
    if (emailCollision.length > 0) {
      return {
        ok: false as const,
        status: 409,
        error: { fieldErrors: { email: ["Email is already in use"] } },
      };
    }
    updates.email = normalizedEmail;
  }

  if (typeof updates.username === "string" && updates.username.trim()) {
    const normalizedUsername = String(updates.username).toLowerCase().trim();
    const usernameCollision = await db
      .select({ id: users.id })
      .from(users)
      .where(and(sql`lower(${users.username}) = ${normalizedUsername}`, sql`${users.id} <> ${userId}`))
      .limit(1);
    if (usernameCollision.length > 0) {
      return {
        ok: false as const,
        status: 409,
        error: { fieldErrors: { username: ["Username is already taken"] } },
      };
    }
    updates.username = normalizedUsername;
  }

  if (updates.firstName !== undefined || updates.lastName !== undefined) {
    const existing = await storage.getUser(userId);
    const combinedFirstName =
      updates.firstName !== undefined ? String(updates.firstName || "").trim() : String(existing?.firstName || "");
    const combinedLastName =
      updates.lastName !== undefined ? String(updates.lastName || "").trim() : String(existing?.lastName || "");
    const name = `${combinedFirstName} ${combinedLastName}`.trim() || String(existing?.name || "").trim();
    updates.name = name || "User";
  }

  try {
    const updated = await storage.updateUser(userId, updates as any);
    if (!updated) {
      return { ok: false as const, status: 404, error: { message: "User not found" } };
    }
    return { ok: true as const, user: updated };
  } catch (error) {
    const message = String((error as Error)?.message || "");
    if (message.includes("idx_users_email_lower_unique")) {
      return {
        ok: false as const,
        status: 409,
        error: { fieldErrors: { email: ["Email is already in use"] } },
      };
    }
    if (message.includes("idx_users_username_lower_unique")) {
      return {
        ok: false as const,
        status: 409,
        error: { fieldErrors: { username: ["Username is already taken"] } },
      };
    }
    throw error;
  }
}

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

function maskConsultancyReportUntilApproved<T extends Record<string, any>>(request: T): T {
  const paymentStatus = String(request?.paymentStatus || "").toLowerCase();
  const canRevealReport =
    Boolean(request?.paymentRequestedAt) ||
    ["paid", "cancelled", "failed", "unpaid"].includes(paymentStatus);

  if (canRevealReport) return request;

  return {
    ...request,
    consultancyReport: null,
    consultancyReportSubmittedAt: null,
    consultancyReportSubmittedBy: null,
  };
}

// Public endpoint: Get enabled categories for resident category selection
router.get("/categories", async (req: Request, res: Response) => {
  try {
    await backfillApprovedCategoriesFromServiceCategories();
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

router.post("/ordinary-flow/sessions", requireAuth, requireResident, async (req: Request, res: Response) => {
  try {
    const parsed = OrdinaryFlowSessionStartSchema.parse(req.body || {});
    const residentId = String(req.auth?.userId || "");
    if (!residentId) {
      return res.status(401).json({ error: "Authentication required." });
    }

    const estateId = await getResidentEstateId(residentId);
    const result = await startOrGetOrdinaryFlowSession({
      requestId: parsed.requestId,
      residentId,
      categoryKey: parsed.categoryKey,
      estateId,
    });
    return res.json(result);
  } catch (error: any) {
    console.error("POST /ordinary-flow/sessions error", error);
    if (error?.issues) {
      return res.status(400).json({ error: "Validation error", details: error.issues });
    }
    return res.status(Number(error?.status || 500)).json({
      error: error?.message || "Failed to start ordinary flow session.",
    });
  }
});

router.get("/ordinary-flow/sessions/:sessionId", requireAuth, requireResident, async (req: Request, res: Response) => {
  try {
    const residentId = String(req.auth?.userId || "");
    const sessionId = String(req.params.sessionId || "");
    const session = await getOrdinaryFlowSessionById(sessionId, residentId);
    if (!session) return res.status(404).json({ error: "Session not found." });
    return res.json({ fallback: false, session });
  } catch (error: any) {
    console.error("GET /ordinary-flow/sessions/:sessionId error", error);
    return res.status(Number(error?.status || 500)).json({
      error: error?.message || "Failed to load ordinary flow session.",
    });
  }
});

router.post(
  "/ordinary-flow/sessions/:sessionId/answers",
  requireAuth,
  requireResident,
  async (req: Request, res: Response) => {
    try {
      const parsed = OrdinaryFlowAnswerWriteSchema.parse(req.body || {});
      const result = await writeOrdinaryFlowAnswer({
        sessionId: String(req.params.sessionId || ""),
        residentId: String(req.auth?.userId || ""),
        questionKey: parsed.questionKey,
        answer: parsed.answer,
        expectedRevision: parsed.expectedRevision,
        answeredBy: "resident",
      });
      if (result.stale) {
        return res.status(409).json({
          error: "stale_revision",
          stateRevision: result.stateRevision,
          currentQuestion: result.currentQuestion,
          session: result.session,
        });
      }
      return res.json({ session: result.session });
    } catch (error: any) {
      console.error("POST /ordinary-flow/sessions/:sessionId/answers error", error);
      if (error?.issues) {
        return res.status(400).json({ error: "Validation error", details: error.issues });
      }
      return res.status(Number(error?.status || 500)).json({
        error: error?.message || "Failed to save answer.",
      });
    }
  },
);

router.patch(
  "/ordinary-flow/sessions/:sessionId/answers/:questionKey",
  requireAuth,
  requireResident,
  async (req: Request, res: Response) => {
    try {
      const parsed = z
        .object({
          answer: z.any(),
          expectedRevision: z.coerce.number().int().min(0),
        })
        .parse(req.body || {});
      const result = await writeOrdinaryFlowAnswer({
        sessionId: String(req.params.sessionId || ""),
        residentId: String(req.auth?.userId || ""),
        questionKey: String(req.params.questionKey || ""),
        answer: parsed.answer,
        expectedRevision: parsed.expectedRevision,
        answeredBy: "resident",
      });
      if (result.stale) {
        return res.status(409).json({
          error: "stale_revision",
          stateRevision: result.stateRevision,
          currentQuestion: result.currentQuestion,
          session: result.session,
        });
      }
      return res.json({ session: result.session });
    } catch (error: any) {
      console.error("PATCH /ordinary-flow/sessions/:sessionId/answers/:questionKey error", error);
      if (error?.issues) {
        return res.status(400).json({ error: "Validation error", details: error.issues });
      }
      return res.status(Number(error?.status || 500)).json({
        error: error?.message || "Failed to update answer.",
      });
    }
  },
);

router.post(
  "/ordinary-flow/sessions/:sessionId/complete",
  requireAuth,
  requireResident,
  async (req: Request, res: Response) => {
    try {
      const result = await completeOrdinaryFlowSession({
        sessionId: String(req.params.sessionId || ""),
        residentId: String(req.auth?.userId || ""),
      });
      if (!result.ok) return res.status(422).json(result);
      return res.json(result);
    } catch (error: any) {
      console.error("POST /ordinary-flow/sessions/:sessionId/complete error", error);
      return res.status(Number(error?.status || 500)).json({
        error: error?.message || "Failed to complete ordinary flow session.",
      });
    }
  },
);

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

const AiSessionSnapshotSchema = z.object({
  title: z.string().optional(),
  snippet: z.string().optional(),
  snapshot: z.record(z.any()),
});

const OrdinaryFlowSessionStartSchema = z.object({
  requestId: z.string().trim().min(1),
  categoryKey: z.string().trim().min(1),
});

const OrdinaryFlowAnswerWriteSchema = z.object({
  questionKey: z.string().trim().min(1),
  answer: z.any(),
  expectedRevision: z.coerce.number().int().min(0),
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

router.get("/ai/session", requireAuth, requireResident, async (req: Request, res: Response) => {
  try {
    const mode = String(req.query.mode || "").trim();
    const limit = Math.min(Number(req.query.limit || 20) || 20, 50);

    const conditions = [eq(aiSessions.residentId, String(req.auth?.userId || ""))];
    if (mode === "ai" || mode === "ordinary") {
      conditions.push(eq(aiSessions.mode, mode as "ai" | "ordinary"));
    }

    const sessions = await db
      .select()
      .from(aiSessions)
      .where(and(...conditions))
      .orderBy(desc(aiSessions.updatedAt), desc(aiSessions.createdAt))
      .limit(limit);

    const enriched = await Promise.all(
      sessions.map(async (session: any) => {
        const [latestSnapshot] = await db
          .select({ meta: aiSessionMessages.meta })
          .from(aiSessionMessages)
          .where(
            and(
              eq(aiSessionMessages.sessionId, session.id),
              eq(aiSessionMessages.role, "system"),
              eq(aiSessionMessages.content, "ordinary_snapshot"),
            ),
          )
          .orderBy(desc(aiSessionMessages.createdAt))
          .limit(1);

        const [latestMessage] = await db
          .select({ content: aiSessionMessages.content })
          .from(aiSessionMessages)
          .where(
            and(
              eq(aiSessionMessages.sessionId, session.id),
              eq(aiSessionMessages.role, "assistant"),
            ),
          )
          .orderBy(desc(aiSessionMessages.createdAt))
          .limit(1);

        const snapshotMeta: any = latestSnapshot?.meta || null;

        return {
          id: session.id,
          categoryKey: session.categoryKey,
          mode: session.mode,
          status: session.status,
          createdAt: session.createdAt,
          updatedAt: session.updatedAt,
          title: snapshotMeta?.title || session.categoryKey || "New request",
          snippet: snapshotMeta?.snippet || latestMessage?.content || "Continue this conversation",
          snapshot: snapshotMeta?.snapshot || null,
        };
      }),
    );

    return res.json({ sessions: enriched });
  } catch (error: any) {
    console.error("GET /ai/session error", error);
    res.status(500).json({ error: error.message || "Failed to load AI sessions" });
  }
});

router.post("/ai/session/:sessionId/snapshot", requireAuth, requireResident, async (req: Request, res: Response) => {
  try {
    const sessionId = String(req.params.sessionId || "");
    const parsed = AiSessionSnapshotSchema.parse(req.body || {});

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

    await db.insert(aiSessionMessages).values({
      sessionId,
      role: "system",
      content: "ordinary_snapshot",
      meta: {
        kind: "ordinary_snapshot",
        title: parsed.title || null,
        snippet: parsed.snippet || null,
        snapshot: parsed.snapshot,
      },
      createdAt: new Date(),
    });

    await db
      .update(aiSessions)
      .set({ updatedAt: new Date() })
      .where(eq(aiSessions.id, sessionId));

    return res.json({ ok: true });
  } catch (error: any) {
    console.error("POST /ai/session/:sessionId/snapshot error", error);
    if (error?.issues) {
      return res.status(400).json({ error: "Validation error", details: error.issues });
    }
    res.status(500).json({ error: error.message || "Failed to save session snapshot" });
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

router.delete("/ai/session/:sessionId", requireAuth, requireResident, async (req: Request, res: Response) => {
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

    await db.transaction(async (tx: any) => {
      await tx.delete(aiSessionAttachments).where(eq(aiSessionAttachments.sessionId, sessionId));
      await tx.delete(aiSessionMessages).where(eq(aiSessionMessages.sessionId, sessionId));
      await tx.delete(aiSessions).where(eq(aiSessions.id, sessionId));
    });

    return res.json({ ok: true });
  } catch (error: any) {
    console.error("DELETE /ai/session/:sessionId error", error);
    return res.status(500).json({ error: error.message || "Failed to delete AI session" });
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
    const mine = all
      .filter((r: any) => r.residentId === userId)
      .sort((a: any, b: any) => {
        const left = new Date(b.updatedAt || b.createdAt || 0).getTime();
        const right = new Date(a.updatedAt || a.createdAt || 0).getTime();
        return left - right;
      });
    const limitRaw = Number(req.query.limit);
    const limited =
      Number.isFinite(limitRaw) && limitRaw > 0 ? mine.slice(0, Math.floor(limitRaw)) : mine;

    const requestIds = limited.map((item: any) => String(item.id || "").trim()).filter(Boolean);
    const openCases = requestIds.length
      ? await db
          .select({
            id: serviceRequestCancellationCases.id,
            requestId: serviceRequestCancellationCases.requestId,
            status: serviceRequestCancellationCases.status,
            reasonCode: serviceRequestCancellationCases.reasonCode,
            createdAt: serviceRequestCancellationCases.createdAt,
            updatedAt: serviceRequestCancellationCases.updatedAt,
          })
          .from(serviceRequestCancellationCases)
          .where(
            and(
              inArray(serviceRequestCancellationCases.requestId, requestIds as any),
              inArray(serviceRequestCancellationCases.status, ["requested", "under_review"] as any),
            ),
          )
      : [];
    const caseByRequestId = new Map<string, (typeof openCases)[number]>();
    for (const cancellationCase of openCases) {
      const key = String(cancellationCase.requestId || "");
      if (!key || caseByRequestId.has(key)) continue;
      caseByRequestId.set(key, cancellationCase);
    }

    console.log(`[app] /service-requests/mine -> userId=${userId} count=${limited.length}`);
    return res.json(
      limited.map((item: any) => {
        const cancellationCase = caseByRequestId.get(String(item.id || ""));
        return {
          ...maskConsultancyReportUntilApproved(item),
          cancellationCase: cancellationCase || null,
          isCancellationUnderReview: Boolean(cancellationCase),
        };
      }),
    );
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
    const providerUser = row.providerId ? await storage.getUser(row.providerId) : null;
    const providerName =
      [providerUser?.firstName, providerUser?.lastName].filter(Boolean).join(" ").trim() ||
      providerUser?.name ||
      null;
    const providerMetadata =
      providerUser?.metadata && typeof providerUser.metadata === "object"
        ? (providerUser.metadata as Record<string, unknown>)
        : null;
    const providerAvatarUrl =
      (typeof providerMetadata?.avatarUrl === "string" && providerMetadata.avatarUrl) ||
      (typeof providerMetadata?.profileImageUrl === "string" && providerMetadata.profileImageUrl) ||
      (typeof providerMetadata?.profilePicture === "string" && providerMetadata.profilePicture) ||
      null;
    const provider = providerUser
      ? {
          id: providerUser.id,
          name: providerName,
          company: providerUser.company || null,
          serviceCategory: providerUser.serviceCategory || null,
          avatarUrl: providerAvatarUrl,
        }
      : null;
    const latestCancellationCase = await storage.getLatestCancellationCaseForRequest(row.id);
    const maintenance = await getMaintenanceSummaryForRequest(row.id);

    return res.json({
      ...maskConsultancyReportUntilApproved(row),
      provider,
      maintenance,
      cancellationCase: latestCancellationCase
        ? {
            id: latestCancellationCase.id,
            status: latestCancellationCase.status,
            reasonCode: latestCancellationCase.reasonCode,
            reasonDetail: latestCancellationCase.reasonDetail,
            preferredResolution: latestCancellationCase.preferredResolution,
            adminDecision: latestCancellationCase.adminDecision,
            adminNote: latestCancellationCase.adminNote,
            refundDecision: latestCancellationCase.refundDecision,
            refundAmount: latestCancellationCase.refundAmount,
            resolvedAt: latestCancellationCase.resolvedAt,
            createdAt: latestCancellationCase.createdAt,
            updatedAt: latestCancellationCase.updatedAt,
          }
        : null,
    });
  } catch (e: any) {
    console.error("GET /service-requests/:id error", e);
    res.status(500).json({ error: e.message });
  }
});

// Delete (cancel) a service request belonging to the authenticated resident
router.delete("/service-requests/:id", requireAuth, requireResident, async (req: Request, res: Response) => {
  try {
    const userId = req.auth?.userId;
    if (!userId) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const existing = await storage.getServiceRequest(req.params.id);
    if (!existing) return res.status(404).json({ error: "Service request not found" });
    if (existing.residentId !== userId) return res.status(403).json({ error: "Forbidden" });
    const statusKey = normalizeServiceRequestStatusKey(existing.status);
    if (CANCELLATION_REVIEW_REQUIRED_STATUSES.has(statusKey)) {
      return res.status(409).json({
        error:
          "This request is assigned or active. Submit a cancellation request with reason for admin review.",
        requiresCancellationReview: true,
      });
    }

    const cancelled = await storage.cancelServiceRequest(req.params.id, userId);
    if (!cancelled) return res.status(404).json({ error: "Service request not found" });

    return res.json({ ok: true, status: cancelled.status });
  } catch (error: any) {
    console.error("DELETE /service-requests/:id error", error);
    res.status(500).json({ error: error.message || "Failed to delete service request" });
  }
});

router.get("/maintenance/catalog", requireAuth, requireResident, async (_req: Request, res: Response) => {
  try {
    const catalog = await getMaintenanceCatalog({ activeOnly: true });
    return res.json(catalog);
  } catch (error: any) {
    console.error("GET /maintenance/catalog error", error);
    return res.status(500).json({ error: error.message || "Failed to load maintenance catalog" });
  }
});

router.get("/maintenance/catalog/categories", requireAuth, requireResident, async (_req: Request, res: Response) => {
  try {
    const catalog = await getMaintenanceCatalog({ activeOnly: true });
    return res.json(
      catalog.map((category: any) =>
        serializeMaintenanceCategoryForResident(category, Array.isArray(category.itemTypes) ? category.itemTypes.length : 0),
      ),
    );
  } catch (error: any) {
    console.error("GET /maintenance/catalog/categories error", error);
    return res.status(500).json({ error: error.message || "Failed to load maintenance categories" });
  }
});

router.get("/maintenance/catalog/items", requireAuth, requireResident, async (req: Request, res: Response) => {
  try {
    const categoryId =
      typeof req.query.categoryId === "string" && req.query.categoryId.trim()
        ? req.query.categoryId.trim()
        : undefined;

    const rows = await db
      .select({
        item: maintenanceItemTypes,
        category: maintenanceCategories,
      })
      .from(maintenanceItemTypes)
      .innerJoin(
        maintenanceCategories,
        eq(maintenanceItemTypes.categoryId, maintenanceCategories.id),
      )
      .where(
        and(
          eq(maintenanceItemTypes.isActive, true),
          eq(maintenanceCategories.isActive, true),
          ...(categoryId ? [eq(maintenanceItemTypes.categoryId, categoryId)] : []),
        ),
      )
      .orderBy(asc(maintenanceItemTypes.name));

    return res.json(
      rows.map((row: { item: typeof maintenanceItemTypes.$inferSelect; category: typeof maintenanceCategories.$inferSelect }) =>
        serializeMaintenanceItemForResident(row.item, row.category),
      ),
    );
  } catch (error: any) {
    console.error("GET /maintenance/catalog/items error", error);
    return res.status(500).json({ error: error.message || "Failed to load maintenance items" });
  }
});

router.get(["/maintenance/assets", "/resident/maintenance/assets"], requireAuth, requireResident, async (req: Request, res: Response) => {
  try {
    const userId = req.auth?.userId;
    if (!userId) return res.status(401).json({ error: "Authentication required" });

    const rows = await getResidentAssetRows({ userId });
    return res.json(rows.map(serializeResidentAssetRow));
  } catch (error: any) {
    console.error("GET /maintenance/assets error", error);
    return res.status(500).json({ error: error.message || "Failed to load assets" });
  }
});

router.get(["/maintenance/assets/:id", "/resident/maintenance/assets/:id"], requireAuth, requireResident, async (req: Request, res: Response) => {
  try {
    const userId = req.auth?.userId;
    if (!userId) return res.status(401).json({ error: "Authentication required" });

    const rows = await getResidentAssetRows({
      userId,
      assetId: String(req.params.id || ""),
    });
    const row = rows[0];
    if (!row) return res.status(404).json({ error: "Asset not found" });

    return res.json(serializeResidentAssetRow(row));
  } catch (error: any) {
    console.error("GET /maintenance/assets/:id error", error);
    return res.status(500).json({ error: error.message || "Failed to load asset details" });
  }
});

router.post(["/maintenance/assets", "/resident/maintenance/assets"], requireAuth, requireResident, async (req: Request, res: Response) => {
  try {
    const userId = req.auth?.userId;
    if (!userId) return res.status(401).json({ error: "Authentication required" });

    const parsed = MaintenanceAssetUpsertSchema.parse(req.body || {});
    const maintenanceItemId = parsed.maintenanceItemId ?? parsed.maintenanceItemTypeId;
    const [itemType] = await db
      .select()
      .from(maintenanceItemTypes)
      .where(eq(maintenanceItemTypes.id, String(maintenanceItemId || "")))
      .limit(1);
    if (!itemType) {
      return res.status(404).json({ error: "Maintenance item type not found" });
    }
    if (!itemType.isActive) {
      return res.status(400).json({ error: "This maintenance item is not available for new assets." });
    }

    const [category] = await db
      .select()
      .from(maintenanceCategories)
      .where(eq(maintenanceCategories.id, itemType.categoryId))
      .limit(1);
    if (!category || !category.isActive) {
      return res.status(400).json({ error: "This maintenance category is not available for new assets." });
    }
    if (parsed.categoryId && parsed.categoryId !== itemType.categoryId) {
      return res.status(400).json({ error: "Selected item does not belong to the chosen category." });
    }

    const payload = buildResidentAssetPayload(parsed);

    const asset = await storage.createResidentAsset({
      userId,
      ...payload,
    } as any);

    const rows = await getResidentAssetRows({ userId, assetId: asset.id });
    return res.status(201).json(rows[0] ? serializeResidentAssetRow(rows[0]) : asset);
  } catch (error: any) {
    if (error?.issues) {
      return res.status(400).json({ error: "Validation error", details: error.issues });
    }
    if (error?.status === 400) {
      return res.status(400).json({ error: error.message || "Invalid asset data" });
    }
    console.error("POST /maintenance/assets error", error);
    return res.status(500).json({ error: error.message || "Failed to create asset" });
  }
});

router.patch("/maintenance/assets/:id", requireAuth, requireResident, async (req: Request, res: Response) => {
  try {
    const userId = req.auth?.userId;
    if (!userId) return res.status(401).json({ error: "Authentication required" });

    const parsed = MaintenanceAssetBaseSchema.partial().parse(req.body || {});
    const maintenanceItemId = parsed.maintenanceItemId ?? parsed.maintenanceItemTypeId;
    const updates: Record<string, unknown> = {};

    if (maintenanceItemId !== undefined) updates.maintenanceItemId = maintenanceItemId;
    if (parsed.estateId !== undefined) updates.estateId = parsed.estateId;
    if (parsed.customName !== undefined || parsed.nickname !== undefined) {
      updates.customName = parsed.customName ?? parsed.nickname ?? null;
    }
    if (parsed.locationLabel !== undefined) updates.locationLabel = parsed.locationLabel;
    if (parsed.brand !== undefined) updates.brand = parsed.brand;
    if (parsed.model !== undefined) updates.model = parsed.model;
    if (parsed.serialNumber !== undefined) updates.serialNumber = parsed.serialNumber;
    if (parsed.purchaseDate !== undefined) {
      updates.purchaseDate = normalizeOptionalMaintenanceDate(parsed.purchaseDate);
    }
    if (parsed.installedAt !== undefined) {
      updates.installedAt = normalizeOptionalMaintenanceDate(parsed.installedAt);
    }
    if (parsed.lastServiceDate !== undefined) {
      updates.lastServiceDate = normalizeOptionalMaintenanceDate(parsed.lastServiceDate);
    }
    if (parsed.condition !== undefined) updates.condition = parsed.condition;
    if (parsed.notes !== undefined) updates.notes = parsed.notes;
    if (parsed.metadata !== undefined) updates.metadata = parsed.metadata;
    if (parsed.isActive !== undefined) updates.isActive = parsed.isActive;

    if (updates.maintenanceItemId) {
      const [itemType] = await db
        .select()
        .from(maintenanceItemTypes)
        .where(eq(maintenanceItemTypes.id, String(updates.maintenanceItemId)))
        .limit(1);
      if (!itemType) {
        return res.status(404).json({ error: "Maintenance item type not found" });
      }
      if (parsed.categoryId && parsed.categoryId !== itemType.categoryId) {
        return res.status(400).json({ error: "Selected item does not belong to the chosen category." });
      }
    }

    const updated = await storage.updateResidentAsset(req.params.id, userId, updates as any);
    if (!updated) return res.status(404).json({ error: "Asset not found" });

    const rows = await getResidentAssetRows({ userId, assetId: updated.id });
    return res.json(rows[0] ? serializeResidentAssetRow(rows[0]) : updated);
  } catch (error: any) {
    if (error?.issues) {
      return res.status(400).json({ error: "Validation error", details: error.issues });
    }
    if (error?.status === 400) {
      return res.status(400).json({ error: error.message || "Invalid asset data" });
    }
    console.error("PATCH /maintenance/assets/:id error", error);
    return res.status(500).json({ error: error.message || "Failed to update asset" });
  }
});

router.get(
  ["/maintenance/assets/:id/plans", "/resident/maintenance/assets/:id/plans"],
  requireAuth,
  requireResident,
  async (req: Request, res: Response) => {
    try {
      const userId = req.auth?.userId;
      if (!userId) return res.status(401).json({ error: "Authentication required" });

      const rows = await getResidentAssetRows({
        userId,
        assetId: String(req.params.id || ""),
      });
      const assetRow = rows[0];
      if (!assetRow) {
        return res.status(404).json({ error: "Asset not found" });
      }

      const plans = await db
        .select({
          plan: maintenancePlans,
          itemType: maintenanceItemTypes,
          category: maintenanceCategories,
        })
        .from(maintenancePlans)
        .innerJoin(
          maintenanceItemTypes,
          eq(maintenancePlans.maintenanceItemId, maintenanceItemTypes.id),
        )
        .innerJoin(
          maintenanceCategories,
          eq(maintenanceItemTypes.categoryId, maintenanceCategories.id),
        )
        .where(
          and(
            eq(maintenancePlans.maintenanceItemId, assetRow.itemType.id),
            eq(maintenancePlans.isActive, true),
            eq(maintenanceItemTypes.isActive, true),
            eq(maintenanceCategories.isActive, true),
          ),
        )
        .orderBy(asc(maintenancePlans.price), asc(maintenancePlans.durationType));

      const subscriptions = await db
        .select()
        .from(assetSubscriptions)
        .where(eq(assetSubscriptions.residentAssetId, assetRow.asset.id));

      const planRows = await Promise.all(
        plans.map(async (row: any) => {
          const currentSubscription =
            subscriptions.find(
              (subscription: any) =>
                subscription.maintenancePlanId === row.plan.id &&
                ["draft", "pending_payment", "active", "paused"].includes(
                  String(subscription.status || "").toLowerCase(),
                ),
            ) || null;
          const nextSchedule = currentSubscription
            ? await getNextScheduleForSubscription(currentSubscription.id)
            : null;

          return serializeResidentPlanRow({
            plan: row.plan,
            itemType: row.itemType,
            category: row.category,
            currentSubscription,
            nextScheduledDate: nextSchedule?.scheduledDate ?? null,
          });
        }),
      );

      return res.json({
        asset: serializeResidentAssetRow(assetRow),
        plans: planRows,
      });
    } catch (error: any) {
      console.error("GET /maintenance/assets/:id/plans error", error);
      return res.status(500).json({ error: error.message || "Failed to load plans" });
    }
  },
);

router.get(["/maintenance/subscriptions", "/resident/maintenance/subscriptions"], requireAuth, requireResident, async (req: Request, res: Response) => {
  try {
    const userId = req.auth?.userId;
    if (!userId) return res.status(401).json({ error: "Authentication required" });

    const rows = await db
      .select({
        subscription: assetSubscriptions,
        asset: residentAssets,
        plan: maintenancePlans,
        itemType: maintenanceItemTypes,
        category: maintenanceCategories,
      })
      .from(assetSubscriptions)
      .innerJoin(
        residentAssets,
        eq(assetSubscriptions.residentAssetId, residentAssets.id),
      )
      .innerJoin(
        maintenancePlans,
        eq(assetSubscriptions.maintenancePlanId, maintenancePlans.id),
      )
      .innerJoin(
        maintenanceItemTypes,
        eq(residentAssets.maintenanceItemId, maintenanceItemTypes.id),
      )
      .innerJoin(
        maintenanceCategories,
        eq(maintenanceItemTypes.categoryId, maintenanceCategories.id),
      )
      .where(eq(assetSubscriptions.userId, userId))
      .orderBy(desc(assetSubscriptions.createdAt));

    return res.json(
      await Promise.all(
        rows.map((row: any) =>
          serializeResidentSubscriptionRow({
            subscription: row.subscription,
            asset: row.asset,
            plan: row.plan,
            itemType: row.itemType,
            category: row.category,
          }),
        ),
      ),
    );
  } catch (error: any) {
    console.error("GET /maintenance/subscriptions error", error);
    return res.status(500).json({ error: error.message || "Failed to load subscriptions" });
  }
});

router.get(
  ["/maintenance/subscriptions/:id", "/resident/maintenance/subscriptions/:id"],
  requireAuth,
  requireResident,
  async (req: Request, res: Response) => {
    try {
      const userId = req.auth?.userId;
      if (!userId) return res.status(401).json({ error: "Authentication required" });

      const row = await getResidentSubscriptionRow({
        userId,
        subscriptionId: String(req.params.id || ""),
      });
      if (!row) return res.status(404).json({ error: "Subscription not found" });

      return res.json(
        await serializeResidentSubscriptionRow({
          subscription: row.subscription,
          asset: row.asset,
          plan: row.plan,
          itemType: row.itemType,
          category: row.category,
        }),
      );
    } catch (error: any) {
      console.error("GET /maintenance/subscriptions/:id error", error);
      return res.status(500).json({ error: error.message || "Failed to load subscription" });
    }
  },
);

router.post("/maintenance/subscriptions", requireAuth, requireResident, async (req: Request, res: Response) => {
  try {
    const userId = req.auth?.userId;
    if (!userId) return res.status(401).json({ error: "Authentication required" });

    const parsed = MaintenanceSubscriptionCreateSchema.parse(req.body || {});
    const result = await createMaintenanceSubscriptionCheckout({
      residentId: userId,
      residentAssetId: parsed.residentAssetId,
      maintenancePlanId: parsed.maintenancePlanId,
      startDate: parsed.startDate ?? null,
    });

    return res.status(201).json(result);
  } catch (error: any) {
    if (error?.issues) {
      return res.status(400).json({ error: "Validation error", details: error.issues });
    }
    console.error("POST /maintenance/subscriptions error", error);
    return res.status(400).json({ error: error.message || "Failed to create subscription" });
  }
});

router.post(
  ["/maintenance/subscriptions/initiate", "/resident/maintenance/subscriptions/initiate"],
  requireAuth,
  requireResident,
  async (req: Request, res: Response) => {
    try {
      const userId = req.auth?.userId;
      if (!userId) return res.status(401).json({ error: "Authentication required" });

      const parsed = MaintenanceSubscriptionCreateSchema.parse(req.body || {});
      const assetRows = await getResidentAssetRows({
        userId,
        assetId: parsed.residentAssetId,
      });
      const assetRow = assetRows[0];
      if (!assetRow) {
        return res.status(404).json({ error: "Asset not found" });
      }

      const [plan] = await db
        .select()
        .from(maintenancePlans)
        .where(eq(maintenancePlans.id, parsed.maintenancePlanId))
        .limit(1);
      if (!plan || !plan.isActive) {
        return res.status(404).json({ error: "Maintenance plan not found" });
      }
      if (plan.maintenanceItemId !== assetRow.itemType.id) {
        return res.status(400).json({ error: "Selected plan does not belong to this asset type." });
      }

      const checkout = await createMaintenanceSubscriptionCheckout({
        residentId: userId,
        residentAssetId: parsed.residentAssetId,
        maintenancePlanId: parsed.maintenancePlanId,
        startDate: parsed.startDate ?? null,
      });

      const refreshed = checkout.subscription
        ? await getResidentSubscriptionRow({
            userId,
            subscriptionId: checkout.subscription.id,
          })
        : null;

      if (checkout.payment) {
        const host = req.get("host");
        const callbackOrigin = host ? `${req.protocol}://${host}` : "";
        return res.status(201).json({
          status: "pending_payment",
          reference: checkout.payment.reference,
          amountKobo: checkout.payment.amountKobo,
          amountFormatted: checkout.payment.amountFormatted,
          subscriptionId: checkout.subscription?.id ?? null,
          paystack: {
            reference: checkout.payment.reference,
            amountInNaira: Number(checkout.payment.amountFormatted),
            callbackUrl: callbackOrigin
              ? `${callbackOrigin}/payment-confirmation?source=maintenance_subscription`
              : null,
          },
          subscription: refreshed
            ? await serializeResidentSubscriptionRow({
                subscription: refreshed.subscription,
                asset: refreshed.asset,
                plan: refreshed.plan,
                itemType: refreshed.itemType,
                category: refreshed.category,
              })
            : checkout.subscription,
        });
      }

      return res.status(201).json({
        status: "active",
        subscriptionId: checkout.subscription?.id ?? null,
        subscription: refreshed
          ? await serializeResidentSubscriptionRow({
              subscription: refreshed.subscription,
              asset: refreshed.asset,
              plan: refreshed.plan,
              itemType: refreshed.itemType,
              category: refreshed.category,
            })
          : checkout.subscription,
      });
    } catch (error: any) {
      if (error?.issues) {
        return res.status(400).json({ error: "Validation error", details: error.issues });
      }
      console.error("POST /maintenance/subscriptions/initiate error", error);
      return res.status(400).json({ error: error.message || "Failed to initiate subscription" });
    }
  },
);

router.post(
  ["/maintenance/subscriptions/verify", "/resident/maintenance/subscriptions/verify"],
  requireAuth,
  requireResident,
  async (req: Request, res: Response) => {
    try {
      const userId = req.auth?.userId;
      if (!userId) return res.status(401).json({ error: "Authentication required" });

      const { reference } = MaintenanceSubscriptionVerifySchema.parse(req.body || {});
      const tx = await storage.getTransactionByReference(reference);
      if (!tx) return res.status(404).json({ error: "Transaction not found" });

      const wallet = await storage.getWalletByUserId(userId);
      if (!wallet || wallet.id !== tx.walletId) {
        return res.status(403).json({ error: "Forbidden" });
      }

      await verifyAndFinalizePaystackCharge(reference);
      const subscription = await activateMaintenanceSubscriptionFromReference(reference);
      if (!subscription) {
        return res.status(404).json({ error: "Subscription not found for payment reference" });
      }

      const row = await getResidentSubscriptionRow({
        userId,
        subscriptionId: subscription.id,
      });
      if (!row) {
        return res.status(404).json({ error: "Subscription not found" });
      }

      return res.json({
        status: "success",
        reference,
        subscriptionId: subscription.id,
        subscription: await serializeResidentSubscriptionRow({
          subscription: row.subscription,
          asset: row.asset,
          plan: row.plan,
          itemType: row.itemType,
          category: row.category,
        }),
      });
    } catch (error: any) {
      if (error?.issues) {
        return res.status(400).json({ error: "Validation error", details: error.issues });
      }
      console.error("POST /maintenance/subscriptions/verify error", error);
      return res.status(400).json({ error: error.message || "Failed to verify subscription payment" });
    }
  },
);

router.post("/maintenance/subscriptions/:id/pause", requireAuth, requireResident, async (req: Request, res: Response) => {
  try {
    const userId = req.auth?.userId;
    if (!userId) return res.status(401).json({ error: "Authentication required" });
    const subscription = await storage.getAssetSubscription(req.params.id);
    if (!subscription) return res.status(404).json({ error: "Subscription not found" });
    const asset = await storage.getResidentAsset(subscription.residentAssetId);
    if (!asset || asset.userId !== userId) return res.status(403).json({ error: "Forbidden" });
    return res.json(await pauseMaintenanceSubscription(subscription.id));
  } catch (error: any) {
    console.error("POST /maintenance/subscriptions/:id/pause error", error);
    return res.status(400).json({ error: error.message || "Failed to pause subscription" });
  }
});

router.post("/maintenance/subscriptions/:id/resume", requireAuth, requireResident, async (req: Request, res: Response) => {
  try {
    const userId = req.auth?.userId;
    if (!userId) return res.status(401).json({ error: "Authentication required" });
    const subscription = await storage.getAssetSubscription(req.params.id);
    if (!subscription) return res.status(404).json({ error: "Subscription not found" });
    const asset = await storage.getResidentAsset(subscription.residentAssetId);
    if (!asset || asset.userId !== userId) return res.status(403).json({ error: "Forbidden" });
    return res.json(await resumeMaintenanceSubscription(subscription.id));
  } catch (error: any) {
    console.error("POST /maintenance/subscriptions/:id/resume error", error);
    return res.status(400).json({ error: error.message || "Failed to resume subscription" });
  }
});

router.post("/maintenance/subscriptions/:id/cancel", requireAuth, requireResident, async (req: Request, res: Response) => {
  try {
    const userId = req.auth?.userId;
    if (!userId) return res.status(401).json({ error: "Authentication required" });
    const subscription = await storage.getAssetSubscription(req.params.id);
    if (!subscription) return res.status(404).json({ error: "Subscription not found" });
    const asset = await storage.getResidentAsset(subscription.residentAssetId);
    if (!asset || asset.userId !== userId) return res.status(403).json({ error: "Forbidden" });
    return res.json(await cancelMaintenanceSubscription(subscription.id));
  } catch (error: any) {
    console.error("POST /maintenance/subscriptions/:id/cancel error", error);
    return res.status(400).json({ error: error.message || "Failed to cancel subscription" });
  }
});

router.get(
  ["/maintenance/schedules", "/resident/maintenance/schedules"],
  requireAuth,
  requireResident,
  async (req: Request, res: Response) => {
  try {
    const userId = req.auth?.userId;
    if (!userId) return res.status(401).json({ error: "Authentication required" });

    const rows = await getResidentScheduleRows({ userId });
    return res.json(rows.map((row: any) => serializeResidentScheduleRow(row)));
  } catch (error: any) {
    console.error("GET /maintenance/schedules error", error);
    return res.status(500).json({ error: error.message || "Failed to load schedules" });
  }
  },
);

router.post(
  ["/maintenance/schedules/:id/reschedule", "/resident/maintenance/schedules/:id/reschedule"],
  requireAuth,
  requireResident,
  async (req: Request, res: Response) => {
    try {
      const userId = req.auth?.userId;
      if (!userId) return res.status(401).json({ error: "Authentication required" });

      const existingRows = await getResidentScheduleRows({
        userId,
        scheduleId: String(req.params.id || ""),
      });
      const existingRow = existingRows[0];
      if (!existingRow) {
        return res.status(404).json({ error: "Maintenance schedule not found" });
      }

      const parsed = MaintenanceScheduleRescheduleSchema.parse(req.body || {});
      const replacement = await rescheduleMaintenanceVisit({
        scheduleId: existingRow.schedule.id,
        scheduledDate: normalizeOptionalMaintenanceDate(parsed.scheduledDate) ?? new Date(parsed.scheduledDate),
        notes: parsed.notes ?? null,
      });

      const replacementRows = await getResidentScheduleRows({
        userId,
        scheduleId: replacement.id,
      });
      const replacementRow = replacementRows[0];

      return res.json(
        replacementRow ? serializeResidentScheduleRow(replacementRow as any) : replacement,
      );
    } catch (error: any) {
      if (error?.issues) {
        return res.status(400).json({ error: "Validation error", details: error.issues });
      }
      console.error("POST /maintenance/schedules/:id/reschedule error", error);
      return res.status(400).json({ error: error.message || "Failed to reschedule maintenance" });
    }
  },
);

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
      r.status === "in_progress" ||
      r.status === "assigned" ||
      r.status === "assigned_for_job" ||
      r.status === "work_completed_pending_resident" ||
      r.status === "disputed" ||
      r.status === "rework_required"
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

    const maintenanceRows = await db
      .select({
        schedule: maintenanceSchedules,
        plan: maintenancePlans,
      })
      .from(maintenanceSchedules)
      .innerJoin(
        assetSubscriptions,
        eq(maintenanceSchedules.subscriptionId, assetSubscriptions.id),
      )
      .innerJoin(
        residentAssets,
        eq(assetSubscriptions.residentAssetId, residentAssets.id),
      )
      .innerJoin(
        maintenancePlans,
        eq(assetSubscriptions.maintenancePlanId, maintenancePlans.id),
      )
      .where(eq(assetSubscriptions.userId, userId))
      .orderBy(asc(maintenanceSchedules.scheduledDate));

    const activeMaintenance = maintenanceRows.filter((row: any) =>
      !["completed", "cancelled"].includes(String(row.schedule.status || "").toLowerCase()),
    );

    const nextMaintenanceRow = activeMaintenance.find(
      (row: any) => new Date(row.schedule.scheduledDate) >= now,
    );
    const nextMaintenance = nextMaintenanceRow?.plan.name ?? null;
    const nextMaintenanceCost = nextMaintenanceRow?.plan.price
      ? parseFloat(String(nextMaintenanceRow.plan.price)) || null
      : null;

    res.json({
      maintenanceScheduleCount: activeMaintenance.length,
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

router.get("/settings", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.auth?.userId;
    if (!userId) return res.status(401).json({ error: "Authentication required" });
    const data = await getResidentSettingsData(userId, (req as any).sessionID);
    if (!data) return res.status(404).json({ error: "User not found" });
    return res.json(data);
  } catch (error: any) {
    console.error("GET /settings error", error);
    return res.status(500).json({ error: error.message || "Failed to load settings" });
  }
});

router.patch("/settings/profile", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.auth?.userId;
    if (!userId) return res.status(401).json({ error: "Authentication required" });

    const result = await updateProfileSettings(userId, req.body || {});
    if (!result.ok) {
      return res.status(result.status).json({ error: result.error });
    }

    return res.json({
      profile: createProfilePayload(result.user),
    });
  } catch (error: any) {
    console.error("PATCH /settings/profile error", error);
    return res.status(500).json({ error: error.message || "Failed to update profile settings" });
  }
});

router.patch("/settings/notifications", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.auth?.userId;
    if (!userId) return res.status(401).json({ error: "Authentication required" });

    const parsed = SettingsNotificationsPatchSchema.safeParse(req.body || {});
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }

    const payload = parsed.data;
    if (payload.quietHoursEnabled && (!payload.quietHoursStart || !payload.quietHoursEnd)) {
      return res.status(400).json({
        error: {
          fieldErrors: {
            quietHoursStart: ["Quiet hours start and end are required when quiet hours are enabled."],
          },
        },
      });
    }

    const settingsPatch: Record<string, unknown> = {};
    if (payload.quietHoursEnabled !== undefined) settingsPatch.quietHoursEnabled = payload.quietHoursEnabled;
    if (payload.quietHoursStart !== undefined) settingsPatch.quietHoursStart = payload.quietHoursStart;
    if (payload.quietHoursEnd !== undefined) settingsPatch.quietHoursEnd = payload.quietHoursEnd;
    if (payload.digestFrequency !== undefined) settingsPatch.digestFrequency = payload.digestFrequency;

    if (Object.keys(settingsPatch).length > 0) {
      await db
        .insert(residentSettings)
        .values({
          userId,
          ...(settingsPatch as any),
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: residentSettings.userId,
          set: {
            ...(settingsPatch as any),
            updatedAt: new Date(),
          },
        });
    }

    if (payload.events && payload.events.length > 0) {
      const seen = new Set<string>();
      for (const event of payload.events) {
        if (seen.has(event.eventKey)) {
          return res.status(400).json({
            error: { fieldErrors: { events: [`Duplicate eventKey '${event.eventKey}'`] } },
          });
        }
        seen.add(event.eventKey);
      }

      for (const event of payload.events) {
        await db
          .insert(residentNotificationPreferences)
          .values({
            userId,
            eventKey: event.eventKey,
            inAppEnabled: event.inApp,
            emailEnabled: event.email,
            smsEnabled: event.sms,
            updatedAt: new Date(),
          })
          .onConflictDoUpdate({
            target: [
              residentNotificationPreferences.userId,
              residentNotificationPreferences.eventKey,
            ],
            set: {
              inAppEnabled: event.inApp,
              emailEnabled: event.email,
              smsEnabled: event.sms,
              updatedAt: new Date(),
            },
          });
      }
    }

    const next = await getResidentSettingsData(userId, (req as any).sessionID);
    return res.json({ notifications: next?.notifications ?? null });
  } catch (error: any) {
    console.error("PATCH /settings/notifications error", error);
    return res.status(500).json({ error: error.message || "Failed to update notification settings" });
  }
});

router.patch("/settings/privacy", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.auth?.userId;
    if (!userId) return res.status(401).json({ error: "Authentication required" });

    const parsed = SettingsPrivacyPatchSchema.safeParse(req.body || {});
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }

    const payload = parsed.data;
    const patch: Record<string, unknown> = {};
    if (payload.profileVisibility !== undefined) patch.profileVisibility = payload.profileVisibility;
    if (payload.showPhoneToProvider !== undefined) patch.showPhoneToProvider = payload.showPhoneToProvider;
    if (payload.showEmailToProvider !== undefined) patch.showEmailToProvider = payload.showEmailToProvider;
    if (payload.allowMarketing !== undefined) patch.allowMarketing = payload.allowMarketing;
    if (payload.allowAnalytics !== undefined) patch.allowAnalytics = payload.allowAnalytics;
    if (payload.allowPersonalization !== undefined) patch.allowPersonalization = payload.allowPersonalization;

    await db
      .insert(residentSettings)
      .values({
        userId,
        ...(patch as any),
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: residentSettings.userId,
        set: {
          ...(patch as any),
          updatedAt: new Date(),
        },
      });

    const next = await getResidentSettingsData(userId, (req as any).sessionID);
    return res.json({ privacy: next?.privacy ?? null });
  } catch (error: any) {
    console.error("PATCH /settings/privacy error", error);
    return res.status(500).json({ error: error.message || "Failed to update privacy settings" });
  }
});

router.post("/settings/privacy/request-data-export", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.auth?.userId;
    if (!userId) return res.status(401).json({ error: "Authentication required" });
    await storage.createAuditLog({
      actorId: userId,
      action: "resident_data_export_requested",
      target: "resident_settings",
      targetId: userId,
      meta: {},
      ipAddress: req.ip || "",
      userAgent: req.get("user-agent") || "",
    } as any);
    return res.status(202).json({ ok: true });
  } catch (error: any) {
    console.error("POST /settings/privacy/request-data-export error", error);
    return res.status(500).json({ error: error.message || "Failed to request data export" });
  }
});

router.post("/settings/privacy/request-account-deletion", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.auth?.userId;
    if (!userId) return res.status(401).json({ error: "Authentication required" });
    const reason = String(req.body?.reason || "").trim().slice(0, 1000);
    await storage.createAuditLog({
      actorId: userId,
      action: "resident_account_deletion_requested",
      target: "resident_settings",
      targetId: userId,
      meta: reason ? { reason } : {},
      ipAddress: req.ip || "",
      userAgent: req.get("user-agent") || "",
    } as any);
    return res.status(202).json({ ok: true });
  } catch (error: any) {
    console.error("POST /settings/privacy/request-account-deletion error", error);
    return res.status(500).json({ error: error.message || "Failed to request account deletion" });
  }
});

router.patch("/settings/security", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.auth?.userId;
    if (!userId) return res.status(401).json({ error: "Authentication required" });

    const parsed = SettingsSecurityPatchSchema.safeParse(req.body || {});
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }

    await db
      .insert(residentSettings)
      .values({
        userId,
        loginAlertsEnabled: parsed.data.loginAlertsEnabled,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: residentSettings.userId,
        set: {
          loginAlertsEnabled: parsed.data.loginAlertsEnabled,
          updatedAt: new Date(),
        },
      });

    const next = await getResidentSettingsData(userId, (req as any).sessionID);
    return res.json({ security: next?.security ?? null });
  } catch (error: any) {
    console.error("PATCH /settings/security error", error);
    return res.status(500).json({ error: error.message || "Failed to update security settings" });
  }
});

router.post("/settings/security/change-password", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.auth?.userId;
    if (!userId) return res.status(401).json({ error: "Authentication required" });

    const parsed = ChangePasswordSchema.safeParse(req.body || {});
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }

    const user = await storage.getUser(userId);
    if (!user) return res.status(404).json({ error: "User not found" });

    const passwordMatches = await comparePasswords(parsed.data.currentPassword, String(user.password || ""));
    if (!passwordMatches) {
      return res.status(422).json({
        error: {
          fieldErrors: {
            currentPassword: ["Current password is incorrect."],
          },
        },
      });
    }

    const newHashedPassword = await hashPassword(parsed.data.newPassword);
    await storage.updateUser(userId, { password: newHashedPassword } as any);
    return res.status(204).send();
  } catch (error: any) {
    console.error("POST /settings/security/change-password error", error);
    return res.status(500).json({ error: error.message || "Failed to change password" });
  }
});

router.get("/settings/security/sessions", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.auth?.userId;
    if (!userId) return res.status(401).json({ error: "Authentication required" });
    const data = await getResidentSettingsData(userId, (req as any).sessionID);
    if (!data) return res.status(404).json({ error: "User not found" });
    return res.json({ sessions: data.security.sessions, loginAlertsEnabled: data.security.loginAlertsEnabled });
  } catch (error: any) {
    console.error("GET /settings/security/sessions error", error);
    return res.status(500).json({ error: error.message || "Failed to load active sessions" });
  }
});

router.delete("/settings/security/sessions/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.auth?.userId;
    if (!userId) return res.status(401).json({ error: "Authentication required" });
    const currentSessionId = String((req as any).sessionID || "");
    const targetId = String(req.params.id || "");
    if (!targetId) return res.status(400).json({ error: "Session id is required" });

    const [target] = await db
      .select()
      .from(userDeviceSessions)
      .where(and(eq(userDeviceSessions.id, targetId), eq(userDeviceSessions.userId, userId)))
      .limit(1);

    if (!target) return res.status(404).json({ error: "Session not found" });
    if (target.sessionId === currentSessionId) {
      return res.status(400).json({ error: "Current session cannot be revoked from this endpoint." });
    }

    await db
      .update(userDeviceSessions)
      .set({ revokedAt: new Date(), lastSeenAt: new Date() })
      .where(eq(userDeviceSessions.id, target.id));

    await new Promise<void>((resolve) => {
      storage.sessionStore.destroy(target.sessionId, () => resolve());
    });

    return res.status(204).send();
  } catch (error: any) {
    console.error("DELETE /settings/security/sessions/:id error", error);
    return res.status(500).json({ error: error.message || "Failed to revoke session" });
  }
});

router.post("/settings/security/sessions/revoke-others", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.auth?.userId;
    if (!userId) return res.status(401).json({ error: "Authentication required" });
    const currentSessionId = String((req as any).sessionID || "");

    const rows = await db
      .select()
      .from(userDeviceSessions)
      .where(
        and(
          eq(userDeviceSessions.userId, userId),
          sql`${userDeviceSessions.revokedAt} IS NULL`,
          sql`${userDeviceSessions.sessionId} <> ${currentSessionId}`,
        ),
      );

    if (rows.length === 0) {
      return res.json({ revokedCount: 0 });
    }

    const sessionIds = rows.map((row: any) => row.sessionId);
    await db
      .update(userDeviceSessions)
      .set({ revokedAt: new Date(), lastSeenAt: new Date() })
      .where(inArray(userDeviceSessions.sessionId, sessionIds));

    await Promise.all(
      sessionIds.map(
        (sessionId: string) =>
          new Promise<void>((resolve) => {
            storage.sessionStore.destroy(sessionId, () => resolve());
          }),
      ),
    );

    return res.json({ revokedCount: rows.length });
  } catch (error: any) {
    console.error("POST /settings/security/sessions/revoke-others error", error);
    return res.status(500).json({ error: error.message || "Failed to revoke other sessions" });
  }
});

// Backward-compatible profile endpoint mapped to settings profile contract
router.patch("/profile", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.auth?.userId;
    if (!userId) return res.status(401).json({ error: "Authentication required" });

    const result = await updateProfileSettings(userId, req.body || {});
    if (!result.ok) return res.status(result.status).json({ error: result.error });

    const user = result.user;
    return res.json({
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      name: user.name,
      email: user.email,
      phone: user.phone,
      location: user.location,
      role: user.role,
      profileImage: (user as any).profileImage ?? null,
      bio: (user as any).bio ?? null,
      website: (user as any).website ?? null,
      username: (user as any).username ?? null,
      countryCode: (user as any).countryCode ?? null,
      timezone: (user as any).timezone ?? null,
      lastUpdatedAt: user.updatedAt ?? null,
    });
  } catch (error: any) {
    console.error("PATCH /profile error", error);
    return res.status(500).json({ error: error.message || "Failed to update profile" });
  }
});

router.get("/profile", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.auth?.userId;
    if (!userId) return res.status(401).json({ error: "Authentication required" });

    const data = await getResidentSettingsData(userId, (req as any).sessionID);
    if (!data) return res.status(404).json({ error: "User not found" });

    const user = await storage.getUser(userId);

    return res.json({
      id: userId,
      name:
        user?.name ||
        [data.profile.firstName, data.profile.lastName].filter(Boolean).join(" ").trim() ||
        null,
      ...data.profile,
      location: user?.location ?? null,
      role: user?.role ?? req.auth?.role ?? null,
    });
  } catch (error: any) {
    console.error("GET /profile error", error);
    return res.status(500).json({ error: error.message || "Failed to load profile" });
  }
});

export default router;

