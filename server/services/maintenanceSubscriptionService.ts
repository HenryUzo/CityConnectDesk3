import { db } from "../db";
import { storage } from "../storage";
import { createPendingPaystackTransaction } from "../payments";
import {
  maintenanceCategories,
  maintenanceItemTypes,
  maintenancePlans,
  maintenanceSchedules,
  residentAssets,
} from "../../shared/schema";
import { and, eq } from "drizzle-orm";
import {
  ensureScheduleHorizonForSubscription,
  syncSubscriptionNextScheduleAt,
} from "./maintenanceScheduleService";
import {
  calculateSubscriptionEndDate,
  type SupportedMaintenanceDuration,
} from "./maintenanceScheduleMath";
import { notifyMaintenanceSubscriptionActivated } from "./maintenanceNotificationService";

function toDate(value?: string | Date | null) {
  if (!value) return new Date();
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

function normalizeStatus(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

export async function createMaintenanceSubscriptionCheckout(params: {
  residentId: string;
  residentAssetId: string;
  maintenancePlanId: string;
  startDate?: string | Date | null;
}) {
  const [row] = await db
    .select({
      asset: residentAssets,
      plan: maintenancePlans,
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
    )
    .innerJoin(
      maintenancePlans,
      eq(maintenancePlans.id, params.maintenancePlanId),
    )
    .where(
      and(
        eq(residentAssets.id, params.residentAssetId),
        eq(residentAssets.userId, params.residentId),
      ),
    )
    .limit(1);

  if (!row) {
    throw new Error("Asset or maintenance plan not found");
  }
  if (!row.asset.isActive) {
    throw new Error("This asset is no longer available for subscription.");
  }
  if (!row.plan.isActive) {
    throw new Error("This maintenance plan is not available for purchase.");
  }
  if (!row.itemType.isActive || !row.category.isActive) {
    throw new Error("This asset type is not currently available for new maintenance subscriptions.");
  }
  if (row.plan.maintenanceItemId !== row.itemType.id) {
    throw new Error("Selected maintenance plan does not match the asset type.");
  }

  const existing = await storage.listAssetSubscriptionsByResident(params.residentId);
  const hasOpenSubscription = existing.some(
    (subscription) =>
      subscription.residentAssetId === params.residentAssetId &&
      subscription.maintenancePlanId === params.maintenancePlanId &&
      ["draft", "pending_payment", "active", "paused"].includes(
        normalizeStatus(subscription.status),
      ),
  );
  if (hasOpenSubscription) {
    throw new Error("A subscription already exists for this asset and plan");
  }

  const resolvedStartDate = toDate(params.startDate);
  const subscription = await storage.createAssetSubscription({
    endDate: calculateSubscriptionEndDate({
      startDate: resolvedStartDate,
      duration: row.plan.durationType as SupportedMaintenanceDuration,
    }),
    userId: params.residentId,
    residentAssetId: params.residentAssetId,
    maintenancePlanId: params.maintenancePlanId,
    status: "draft",
    startDate: resolvedStartDate,
    autoRenew: false,
    billingAmount: row.plan.price,
    currency: row.plan.currency,
  } as any);

  const amount = Number(row.plan.price || 0);
  if (!Number.isFinite(amount) || amount <= 0) {
    await activateMaintenanceSubscriptionFromReference(null, subscription.id);
    return { subscription: await storage.getAssetSubscription(subscription.id), payment: null };
  }

  const payment = await createPendingPaystackTransaction({
    userId: params.residentId,
    amount,
    description: `Maintenance subscription: ${row.plan.name}`,
    meta: {
      kind: "maintenance_subscription_activation",
      subscriptionId: subscription.id,
      residentAssetId: params.residentAssetId,
      maintenancePlanId: params.maintenancePlanId,
    },
  });

  const updatedSubscription = await storage.updateAssetSubscription(subscription.id, {
    status: "pending_payment",
  } as any);

  return {
    subscription: updatedSubscription ?? subscription,
    payment,
  };
}

export async function activateMaintenanceSubscriptionFromReference(
  reference?: string | null,
  fallbackSubscriptionId?: string | null,
) {
  const tx = reference
    ? await storage.getTransactionByReference(reference)
    : null;
  const meta =
    tx?.meta && typeof tx.meta === "object" ? (tx.meta as Record<string, unknown>) : {};
  const kind = String(meta?.kind || "");
  const subscriptionId =
    String(meta?.subscriptionId || fallbackSubscriptionId || "").trim();

  if (!subscriptionId) return null;
  if (tx && kind && kind !== "maintenance_subscription_activation") {
    return null;
  }

  const subscription = await storage.getAssetSubscription(subscriptionId);
  if (!subscription) return null;
  const status = normalizeStatus(subscription.status);
  const now = new Date();
  const endDate =
    subscription.endDate instanceof Date
      ? subscription.endDate
      : subscription.endDate
        ? new Date(subscription.endDate)
        : null;

  if (status === "cancelled") {
    return subscription;
  }
  if (status === "expired" || (endDate && endDate <= now)) {
    const expired =
      status === "expired"
        ? subscription
        : await storage.updateAssetSubscription(subscriptionId, {
            status: "expired",
            expiredAt: subscription.expiredAt ?? now,
          } as any);
    await syncSubscriptionNextScheduleAt(subscriptionId);
    return expired ?? subscription;
  }
  if (status === "active") {
    await ensureScheduleHorizonForSubscription(subscriptionId);
    await syncSubscriptionNextScheduleAt(subscriptionId);
    return await storage.getAssetSubscription(subscriptionId);
  }

  const activated = await storage.updateAssetSubscription(subscriptionId, {
    status: "active",
    activatedAt: subscription.activatedAt ?? now,
    pausedAt: null,
    cancelledAt: null,
    billingAmount: tx?.amount ? String(tx.amount) : subscription.billingAmount,
  } as any);
  if (!activated) return null;

  await ensureScheduleHorizonForSubscription(subscriptionId);
  const nextScheduleAt = await syncSubscriptionNextScheduleAt(subscriptionId);

  await notifyMaintenanceSubscriptionActivated(subscriptionId);

  return await storage.getAssetSubscription(subscriptionId);
}

export async function pauseMaintenanceSubscription(id: string) {
  const subscription = await storage.getAssetSubscription(id);
  if (!subscription) return null;
  const status = normalizeStatus(subscription.status);
  if (status === "cancelled" || status === "expired") {
    throw new Error("This subscription can no longer be paused.");
  }
  if (status === "paused") {
    return subscription;
  }
  if (status !== "active") {
    throw new Error("Only active subscriptions can be paused.");
  }
  return await storage.updateAssetSubscription(id, {
    status: "paused",
    pausedAt: new Date(),
  } as any);
}

export async function resumeMaintenanceSubscription(id: string) {
  const subscription = await storage.getAssetSubscription(id);
  if (!subscription) return null;
  const status = normalizeStatus(subscription.status);
  const now = new Date();
  const endDate =
    subscription.endDate instanceof Date
      ? subscription.endDate
      : subscription.endDate
        ? new Date(subscription.endDate)
        : null;
  if (status === "active") {
    await ensureScheduleHorizonForSubscription(id);
    return subscription;
  }
  if (status === "cancelled") {
    throw new Error("Cancelled subscriptions cannot be resumed.");
  }
  if (status === "expired" || (endDate && endDate <= now)) {
    const expired =
      status === "expired"
        ? subscription
        : await storage.updateAssetSubscription(id, {
            status: "expired",
            expiredAt: subscription.expiredAt ?? now,
          } as any);
    await syncSubscriptionNextScheduleAt(id);
    throw new Error(
      expired ? "This subscription has already expired and cannot be resumed." : "Subscription expired.",
    );
  }
  if (status !== "paused") {
    throw new Error("Only paused subscriptions can be resumed.");
  }
  const updated = await storage.updateAssetSubscription(id, {
    status: "active",
    pausedAt: null,
  } as any);
  if (updated) {
    await ensureScheduleHorizonForSubscription(id);
  }
  return updated;
}

export async function cancelMaintenanceSubscription(id: string) {
  const existing = await storage.getAssetSubscription(id);
  if (!existing) return null;
  if (normalizeStatus(existing.status) === "cancelled") {
    return existing;
  }
  const updated = await storage.updateAssetSubscription(id, {
    status: "cancelled",
    cancelledAt: new Date(),
  } as any);
  if (!updated) return null;

  const schedules = await db
    .select()
    .from(maintenanceSchedules)
    .where(eq(maintenanceSchedules.subscriptionId, id));
  for (const schedule of schedules) {
    if (["completed", "cancelled"].includes(String(schedule.status || "").toLowerCase())) {
      continue;
    }
    await storage.updateMaintenanceSchedule(schedule.id, {
      status: "cancelled",
    } as any);
  }
  await syncSubscriptionNextScheduleAt(id);

  return updated;
}
