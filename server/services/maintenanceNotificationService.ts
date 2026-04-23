import { and, asc, eq, gte, lte, sql } from "drizzle-orm";
import {
  assetSubscriptions,
  maintenancePlans,
  maintenanceSchedules,
  notifications,
  residentAssets,
  serviceRequests,
  users,
} from "../../shared/schema";
import { db } from "../db";
import { storage } from "../storage";
import {
  MAINTENANCE_PROVIDER_REMINDER_MILESTONES,
  type MaintenanceProviderReminderMilestone,
} from "./maintenanceReminderMath";

type DedupeMatch = Record<string, string>;

function residentMaintenancePath() {
  return "/resident/maintenance";
}

function residentRequestPath(requestId: string) {
  return `/resident/requests/ordinary?requestId=${encodeURIComponent(
    requestId,
  )}&serviceRequestId=${encodeURIComponent(requestId)}`;
}

async function notificationExists(params: {
  userId: string;
  match: DedupeMatch;
}) {
  const clauses: any[] = [eq(notifications.userId, params.userId)];
  for (const [key, value] of Object.entries(params.match)) {
    clauses.push(sql`(${notifications.metadata} ->> ${key}) = ${String(value)}`);
  }

  const [row] = await db
    .select({ id: notifications.id })
    .from(notifications)
    .where(and(...clauses))
    .limit(1);

  return row ?? null;
}

async function createResidentMaintenanceNotification(params: {
  userId: string;
  title: string;
  message: string;
  metadata: Record<string, unknown>;
  dedupeMatch?: DedupeMatch;
}) {
  if (params.dedupeMatch) {
    const existing = await notificationExists({
      userId: params.userId,
      match: params.dedupeMatch,
    });
    if (existing) return null;
  }

  return await storage.createNotification({
    userId: params.userId,
    title: params.title,
    message: params.message,
    type: "info",
    metadata: params.metadata as any,
  });
}

async function createProviderMaintenanceNotification(params: {
  userId: string;
  title: string;
  message: string;
  metadata: Record<string, unknown>;
  dedupeMatch?: DedupeMatch;
}) {
  if (params.dedupeMatch) {
    const existing = await notificationExists({
      userId: params.userId,
      match: params.dedupeMatch,
    });
    if (existing) return null;
  }

  return await storage.createNotification({
    userId: params.userId,
    title: params.title,
    message: params.message,
    type: "info",
    metadata: params.metadata as any,
  });
}

function providerJobsPath(requestId?: string | null) {
  const base = "/provider/jobs";
  const normalizedRequestId = String(requestId || "").trim();
  return normalizedRequestId
    ? `${base}?requestId=${encodeURIComponent(normalizedRequestId)}`
    : base;
}

async function getSubscriptionContext(subscriptionId: string) {
  const [row] = await db
    .select({
      subscription: assetSubscriptions,
      asset: residentAssets,
      plan: maintenancePlans,
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
    .where(eq(assetSubscriptions.id, subscriptionId))
    .limit(1);

  return row ?? null;
}

async function getScheduleContext(scheduleId: string) {
  const [row] = await db
    .select({
      schedule: maintenanceSchedules,
      subscription: assetSubscriptions,
      asset: residentAssets,
      plan: maintenancePlans,
      request: serviceRequests,
      provider: users,
      previousScheduledDate: sql<Date | null>`(
        select ms2.scheduled_date
        from maintenance_schedules ms2
        where ms2.id = ${maintenanceSchedules.rescheduledFrom}
      )`,
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
    .leftJoin(
      serviceRequests,
      eq(maintenanceSchedules.sourceRequestId, serviceRequests.id),
    )
    .leftJoin(
      users,
      eq(serviceRequests.providerId, users.id),
    )
    .where(eq(maintenanceSchedules.id, scheduleId))
    .limit(1);

  return row ?? null;
}

function getProviderReminderMilestoneByKey(
  key: string,
): MaintenanceProviderReminderMilestone | null {
  return (
    MAINTENANCE_PROVIDER_REMINDER_MILESTONES.find(
      (milestone) => milestone.key === key,
    ) ?? null
  );
}

export async function notifyMaintenanceSubscriptionActivated(subscriptionId: string) {
  const row = await getSubscriptionContext(subscriptionId);
  if (!row) return null;

  const [nextSchedule] = await db
    .select({ scheduledDate: maintenanceSchedules.scheduledDate })
    .from(maintenanceSchedules)
    .where(eq(maintenanceSchedules.subscriptionId, subscriptionId))
    .orderBy(asc(maintenanceSchedules.scheduledDate))
    .limit(1);

  return await createResidentMaintenanceNotification({
    userId: row.asset.userId,
    title: "Maintenance subscription active",
    message: nextSchedule?.scheduledDate
      ? `Your ${row.plan.name} plan is active. Next maintenance is on ${new Date(
          nextSchedule.scheduledDate,
        ).toLocaleDateString()}.`
      : `Your ${row.plan.name} plan is active.`,
    metadata: {
      kind: "maintenance_subscription_active",
      subscriptionId,
      residentAssetId: row.asset.id,
      targetPath: residentMaintenancePath(),
    },
    dedupeMatch: {
      kind: "maintenance_subscription_active",
      subscriptionId,
    },
  });
}

export async function notifyMaintenanceReminder(scheduleId: string) {
  const row = await getScheduleContext(scheduleId);
  if (!row) return null;

  return await createResidentMaintenanceNotification({
    userId: row.asset.userId,
    title: "Upcoming maintenance reminder",
    message: `${row.asset.customName || row.plan.name} is due on ${new Date(
      row.schedule.scheduledDate,
    ).toLocaleDateString()}.`,
    metadata: {
      kind: "maintenance_schedule_due",
      scheduleId,
      subscriptionId: row.subscription.id,
      targetPath: residentMaintenancePath(),
    },
    dedupeMatch: {
      kind: "maintenance_schedule_due",
      scheduleId,
    },
  });
}

export async function notifyMaintenanceProviderAssigned(scheduleId: string) {
  const row = await getScheduleContext(scheduleId);
  if (!row?.request?.id || !row.provider?.id) return null;

  const providerName =
    [row.provider.firstName, row.provider.lastName].filter(Boolean).join(" ").trim() ||
    row.provider.name ||
    "Your provider";

  return await createResidentMaintenanceNotification({
    userId: row.asset.userId,
    title: "Provider assigned",
    message: `${providerName} has been assigned to your scheduled maintenance.`,
    metadata: {
      kind: "maintenance_provider_assigned",
      scheduleId,
      subscriptionId: row.subscription.id,
      requestId: row.request.id,
      serviceRequestId: row.request.id,
      providerId: row.provider.id,
      targetPath: residentRequestPath(row.request.id),
    },
    dedupeMatch: {
      kind: "maintenance_provider_assigned",
      scheduleId,
      requestId: row.request.id,
    },
  });
}

export async function notifyMaintenanceProviderJobAssigned(scheduleId: string) {
  const row = await getScheduleContext(scheduleId);
  if (!row?.request?.id || !row.provider?.id) return null;

  const assetLabel = row.asset.customName || row.plan.name;
  const scheduledLabel = new Date(row.schedule.scheduledDate).toLocaleString();

  return await createProviderMaintenanceNotification({
    userId: row.provider.id,
    title: "Scheduled maintenance job assigned",
    message: `${assetLabel} is assigned to you for ${scheduledLabel}. It is now in your jobs workspace.`,
    metadata: {
      kind: "maintenance_provider_job_assigned",
      scheduleId,
      subscriptionId: row.subscription.id,
      requestId: row.request.id,
      serviceRequestId: row.request.id,
      providerId: row.provider.id,
      targetPath: providerJobsPath(row.request.id),
    },
    dedupeMatch: {
      kind: "maintenance_provider_job_assigned",
      scheduleId,
      requestId: row.request.id,
      providerId: row.provider.id,
    },
  });
}

export async function notifyMaintenanceProviderUpcomingReminder(params: {
  scheduleId: string;
  milestoneKey: string;
}) {
  const row = await getScheduleContext(params.scheduleId);
  if (!row?.request?.id || !row.provider?.id) return null;

  const milestone = getProviderReminderMilestoneByKey(params.milestoneKey);
  if (!milestone) return null;

  const assetLabel = row.asset.customName || row.plan.name;
  const locationLabel = String(row.asset.locationLabel || "").trim();

  return await createProviderMaintenanceNotification({
    userId: row.provider.id,
    title: "Upcoming maintenance visit",
    message: `${assetLabel}${locationLabel ? ` in ${locationLabel}` : ""} is scheduled in ${milestone.label}.`,
    metadata: {
      kind: "maintenance_provider_upcoming_reminder",
      scheduleId: params.scheduleId,
      milestone: milestone.key,
      subscriptionId: row.subscription.id,
      requestId: row.request.id,
      serviceRequestId: row.request.id,
      providerId: row.provider.id,
      targetPath: providerJobsPath(row.request.id),
    },
    dedupeMatch: {
      kind: "maintenance_provider_upcoming_reminder",
      scheduleId: params.scheduleId,
      milestone: milestone.key,
      requestId: row.request.id,
      providerId: row.provider.id,
    },
  });
}

export async function notifyMaintenanceVisitRescheduled(scheduleId: string) {
  const row = await getScheduleContext(scheduleId);
  if (!row) return null;

  return await createResidentMaintenanceNotification({
    userId: row.asset.userId,
    title: "Maintenance visit rescheduled",
    message: row.previousScheduledDate
      ? `Your maintenance visit has been moved from ${new Date(
          row.previousScheduledDate,
        ).toLocaleDateString()} to ${new Date(row.schedule.scheduledDate).toLocaleDateString()}.`
      : `Your maintenance visit has been rescheduled to ${new Date(
          row.schedule.scheduledDate,
        ).toLocaleDateString()}.`,
    metadata: {
      kind: "maintenance_visit_rescheduled",
      scheduleId,
      subscriptionId: row.subscription.id,
      targetPath: residentMaintenancePath(),
    },
    dedupeMatch: {
      kind: "maintenance_visit_rescheduled",
      scheduleId,
    },
  });
}

export async function notifyMaintenanceVisitCompleted(scheduleId: string) {
  const row = await getScheduleContext(scheduleId);
  if (!row) return null;

  return await createResidentMaintenanceNotification({
    userId: row.asset.userId,
    title: "Maintenance completed",
    message: `${row.asset.customName || row.plan.name} maintenance was completed successfully.`,
    metadata: {
      kind: "maintenance_visit_completed",
      scheduleId,
      subscriptionId: row.subscription.id,
      requestId: row.request?.id ?? null,
      serviceRequestId: row.request?.id ?? null,
      targetPath: row.request?.id ? residentRequestPath(row.request.id) : residentMaintenancePath(),
    },
    dedupeMatch: {
      kind: "maintenance_visit_completed",
      scheduleId,
    },
  });
}

export async function notifyMaintenanceSubscriptionExpiringSoon(params: {
  subscriptionId: string;
  daysRemaining?: number;
}) {
  const row = await getSubscriptionContext(params.subscriptionId);
  if (!row?.subscription.endDate) return null;

  const now = new Date();
  const msRemaining = new Date(row.subscription.endDate).getTime() - now.getTime();
  const calculatedDays = Math.max(0, Math.ceil(msRemaining / (24 * 60 * 60 * 1000)));
  const daysRemaining = params.daysRemaining ?? calculatedDays;

  return await createResidentMaintenanceNotification({
    userId: row.asset.userId,
    title: "Subscription expiring soon",
    message:
      daysRemaining <= 1
        ? `Your ${row.plan.name} plan expires tomorrow. Renew soon to keep maintenance uninterrupted.`
        : `Your ${row.plan.name} plan expires in ${daysRemaining} days.`,
    metadata: {
      kind: "maintenance_subscription_expiring_soon",
      subscriptionId: params.subscriptionId,
      endDate: new Date(row.subscription.endDate).toISOString(),
      targetPath: residentMaintenancePath(),
    },
    dedupeMatch: {
      kind: "maintenance_subscription_expiring_soon",
      subscriptionId: params.subscriptionId,
      endDate: new Date(row.subscription.endDate).toISOString(),
    },
  });
}

export async function notifyExpiringMaintenanceSubscriptionsSoon(params?: {
  thresholdDays?: number;
}) {
  const now = new Date();
  const thresholdDays = Math.max(1, params?.thresholdDays ?? 7);
  const thresholdDate = new Date(now.getTime() + thresholdDays * 24 * 60 * 60 * 1000);

  const rows = await db
    .select({ subscriptionId: assetSubscriptions.id, endDate: assetSubscriptions.endDate })
    .from(assetSubscriptions)
    .where(
      and(
        eq(assetSubscriptions.status, "active"),
        gte(assetSubscriptions.endDate, now),
        lte(assetSubscriptions.endDate, thresholdDate),
      ),
    );

  let count = 0;
  for (const row of rows) {
    const result = await notifyMaintenanceSubscriptionExpiringSoon({
      subscriptionId: row.subscriptionId,
    });
    if (result) count += 1;
  }

  return count;
}
