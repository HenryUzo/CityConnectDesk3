import {
  assetSubscriptions,
  maintenancePlans,
  maintenanceSchedules,
  residentAssets,
} from "../../shared/schema";
import { and, asc, eq, inArray, isNotNull, isNull, lte, not } from "drizzle-orm";
import { db } from "../db";
import { storage } from "../storage";
import {
  calculateSubscriptionEndDate,
  generateScheduleDates,
  shouldMarkScheduleDue,
  type SupportedMaintenanceDuration,
} from "./maintenanceScheduleMath";
import {
  notifyExpiringMaintenanceSubscriptionsSoon,
  notifyMaintenanceProviderUpcomingReminder,
  notifyMaintenanceReminder,
  notifyMaintenanceVisitRescheduled,
} from "./maintenanceNotificationService";
import { getMaintenanceProviderReminderMilestonesForWindow } from "./maintenanceReminderMath";

function normalizeStatus(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

async function listSchedulesForSubscription(subscriptionId: string) {
  return await db
    .select()
    .from(maintenanceSchedules)
    .where(eq(maintenanceSchedules.subscriptionId, subscriptionId))
    .orderBy(asc(maintenanceSchedules.scheduledDate));
}

async function expireSubscriptionIfEnded(params: {
  subscription: typeof assetSubscriptions.$inferSelect;
  now: Date;
}) {
  const status = normalizeStatus(params.subscription.status);
  const endDate =
    params.subscription.endDate instanceof Date
      ? params.subscription.endDate
      : params.subscription.endDate
        ? new Date(params.subscription.endDate)
        : null;

  if (!endDate || endDate > params.now || status === "cancelled" || status === "expired") {
    return null;
  }

  return await storage.updateAssetSubscription(params.subscription.id, {
    status: "expired",
    expiredAt: params.subscription.expiredAt ?? params.now,
  } as any);
}

export async function syncSubscriptionNextScheduleAt(subscriptionId: string) {
  const [nextSchedule] = await db
    .select({
      scheduledDate: maintenanceSchedules.scheduledDate,
    })
    .from(maintenanceSchedules)
    .where(
      and(
        eq(maintenanceSchedules.subscriptionId, subscriptionId),
        isNull(maintenanceSchedules.completedAt),
        not(
          inArray(maintenanceSchedules.status, [
            "cancelled",
            "completed",
            "missed",
            "rescheduled",
          ] as any),
        ),
      ),
    )
    .orderBy(asc(maintenanceSchedules.scheduledDate))
    .limit(1);

  await storage.updateAssetSubscription(subscriptionId, {
    nextScheduleAt: nextSchedule?.scheduledDate ?? null,
  } as any);

  return nextSchedule?.scheduledDate ?? null;
}

export async function ensureScheduleHorizonForSubscription(subscriptionId: string) {
  const [row] = await db
    .select({
      subscription: assetSubscriptions,
      plan: maintenancePlans,
      asset: residentAssets,
    })
    .from(assetSubscriptions)
    .innerJoin(
      maintenancePlans,
      eq(assetSubscriptions.maintenancePlanId, maintenancePlans.id),
    )
    .innerJoin(
      residentAssets,
      eq(assetSubscriptions.residentAssetId, residentAssets.id),
    )
    .where(eq(assetSubscriptions.id, subscriptionId))
    .limit(1);

  if (!row) {
    throw new Error("Subscription not found");
  }
  const now = new Date();
  const status = normalizeStatus(row.subscription.status);

  const expired = await expireSubscriptionIfEnded({ subscription: row.subscription, now });
  if (expired || ["cancelled", "expired", "paused"].includes(status)) {
    await syncSubscriptionNextScheduleAt(subscriptionId);
    return await listSchedulesForSubscription(subscriptionId);
  }

  const duration = row.plan.durationType as SupportedMaintenanceDuration;
  const startDate = new Date(row.subscription.startDate);
  const endDate =
    row.subscription.endDate instanceof Date
      ? new Date(row.subscription.endDate)
      : calculateSubscriptionEndDate({
          startDate,
          duration,
        });

  if (!row.subscription.endDate) {
    await storage.updateAssetSubscription(subscriptionId, {
      endDate,
    } as any);
  }

  const dates = generateScheduleDates({
    startDate,
    duration,
    visitsIncluded: Number(row.plan.visitsIncluded ?? 1) || 1,
    endDate,
  });

  const existing = await db
    .select()
    .from(maintenanceSchedules)
    .where(eq(maintenanceSchedules.subscriptionId, subscriptionId));

  const existingKeys = new Set(
    existing.map((schedule: any) => new Date(schedule.scheduledDate).toISOString()),
  );

  for (const scheduledDate of dates) {
    if (scheduledDate > endDate) continue;
    const key = scheduledDate.toISOString();
    if (existingKeys.has(key)) continue;
    await storage.createMaintenanceSchedule({
      subscriptionId,
      scheduledDate,
      status: "upcoming",
      notes: `${row.plan.name} scheduled maintenance`,
    } as any);
    existingKeys.add(key);
  }

  await syncSubscriptionNextScheduleAt(subscriptionId);

  return await listSchedulesForSubscription(subscriptionId);
}

export async function rescheduleMaintenanceVisit(params: {
  scheduleId: string;
  scheduledDate: Date;
  notes?: string | null;
}) {
  const schedule = await storage.getMaintenanceSchedule(params.scheduleId);
  if (!schedule) {
    throw new Error("Maintenance schedule not found");
  }
  const subscription = await storage.getAssetSubscription(schedule.subscriptionId);
  if (!subscription) {
    throw new Error("Subscription not found for this maintenance schedule.");
  }
  const subscriptionStatus = normalizeStatus(subscription.status);
  if (["cancelled", "expired"].includes(subscriptionStatus)) {
    throw new Error("This maintenance schedule can no longer be rescheduled.");
  }
  if (["completed", "cancelled"].includes(normalizeStatus(schedule.status))) {
    throw new Error("This maintenance visit can no longer be rescheduled.");
  }

  const normalizedDate = new Date(params.scheduledDate);
  const existing = await db
    .select()
    .from(maintenanceSchedules)
    .where(eq(maintenanceSchedules.subscriptionId, schedule.subscriptionId));
  const existingMatch = existing.find(
    (row: any) =>
      row.id !== schedule.id &&
      new Date(row.scheduledDate).toISOString() === normalizedDate.toISOString(),
  );

  if (existingMatch) {
    await storage.updateMaintenanceSchedule(schedule.id, {
      status: "rescheduled",
      notes: params.notes ?? schedule.notes ?? null,
      skippedAt: schedule.skippedAt ?? new Date(),
    } as any);
    await syncSubscriptionNextScheduleAt(schedule.subscriptionId);
    return existingMatch;
  }

  const replacement = await storage.createMaintenanceSchedule({
    subscriptionId: schedule.subscriptionId,
    scheduledDate: normalizedDate,
    status: "upcoming",
    notes: params.notes ?? schedule.notes ?? null,
    rescheduledFrom: schedule.id,
  } as any);

  await storage.updateMaintenanceSchedule(schedule.id, {
    status: "rescheduled",
    notes: params.notes ?? schedule.notes ?? null,
    skippedAt: schedule.skippedAt ?? new Date(),
  } as any);
  await syncSubscriptionNextScheduleAt(schedule.subscriptionId);
  await notifyMaintenanceVisitRescheduled(replacement.id);

  return replacement;
}

export async function runMaintenanceScheduleSweep() {
  const now = new Date();
  const activeSubscriptions = await db
    .select()
    .from(assetSubscriptions)
    .where(eq(assetSubscriptions.status, "active"));
  let expiredCount = 0;
  for (const subscription of activeSubscriptions) {
    const expired = await expireSubscriptionIfEnded({ subscription, now });
    if (expired) {
      expiredCount += 1;
    }
  }

  const upcomingRows = await db
    .select({
      schedule: maintenanceSchedules,
      subscription: assetSubscriptions,
      plan: maintenancePlans,
      asset: residentAssets,
    })
    .from(maintenanceSchedules)
    .innerJoin(
      assetSubscriptions,
      eq(maintenanceSchedules.subscriptionId, assetSubscriptions.id),
    )
    .innerJoin(
      maintenancePlans,
      eq(assetSubscriptions.maintenancePlanId, maintenancePlans.id),
    )
    .innerJoin(
      residentAssets,
      eq(assetSubscriptions.residentAssetId, residentAssets.id),
    )
    .where(
      and(
        eq(maintenanceSchedules.status, "upcoming"),
        eq(assetSubscriptions.status, "active"),
      ),
    );

  let dueCount = 0;
  for (const row of upcomingRows) {
    const leadDays = Number(row.plan.requestLeadDays ?? 3) || 3;
    if (!shouldMarkScheduleDue({
      scheduledFor: new Date(row.schedule.scheduledDate),
      leadDays,
      now,
    })) continue;

    const updated = await storage.updateMaintenanceSchedule(row.schedule.id, {
      status: "due",
    } as any);
    if (!updated) continue;
    dueCount += 1;

    await notifyMaintenanceReminder(row.schedule.id);
  }

  const dueRows = await db
    .select({
      schedule: maintenanceSchedules,
    })
    .from(maintenanceSchedules)
    .innerJoin(
      assetSubscriptions,
      eq(maintenanceSchedules.subscriptionId, assetSubscriptions.id),
    )
    .where(
      and(
        eq(maintenanceSchedules.status, "due"),
        eq(assetSubscriptions.status, "active"),
        lte(maintenanceSchedules.scheduledDate, now),
      ),
    );

  let missedCount = 0;
  for (const row of dueRows) {
    if (row.schedule.sourceRequestId) continue;
    const updated = await storage.updateMaintenanceSchedule(row.schedule.id, {
      status: "missed",
    } as any);
    if (updated) {
      missedCount += 1;
    }
  }

  const expiringSoonCount = await notifyExpiringMaintenanceSubscriptionsSoon({
    thresholdDays: 7,
  });

  const assignedRows = await db
    .select({
      schedule: maintenanceSchedules,
    })
    .from(maintenanceSchedules)
    .innerJoin(
      assetSubscriptions,
      eq(maintenanceSchedules.subscriptionId, assetSubscriptions.id),
    )
    .where(
      and(
        eq(assetSubscriptions.status, "active"),
        inArray(maintenanceSchedules.status, ["assigned", "in_progress"] as any),
        isNotNull(maintenanceSchedules.sourceRequestId),
      ),
    );

  let providerReminderCount = 0;
  for (const row of assignedRows) {
    const milestones = getMaintenanceProviderReminderMilestonesForWindow({
      scheduledDate: new Date(row.schedule.scheduledDate),
      now,
      windowMs: 65 * 60 * 1000,
    });

    for (const milestone of milestones) {
      const notification = await notifyMaintenanceProviderUpcomingReminder({
        scheduleId: row.schedule.id,
        milestoneKey: milestone.key,
      });
      if (notification) {
        providerReminderCount += 1;
      }
    }
  }

  return {
    dueCount,
    missedCount,
    expiringSoonCount,
    expiredCount,
    providerReminderCount,
  };
}
