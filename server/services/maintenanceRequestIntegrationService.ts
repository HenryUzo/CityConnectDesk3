import {
  assetSubscriptions,
  maintenancePlans,
  maintenanceSchedules,
  residentAssets,
  maintenanceItemTypes,
  serviceRequests,
} from "../../shared/schema";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { storage } from "../storage";
import { ensureScheduleHorizonForSubscription } from "./maintenanceScheduleService";
import {
  notifyMaintenanceProviderAssigned,
  notifyMaintenanceVisitCompleted,
} from "./maintenanceNotificationService";

function normalizeTextList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((entry) => String(entry ?? "").trim())
      .filter(Boolean);
  }
  const single = String(value ?? "").trim();
  return single ? [single] : [];
}

export async function createMaintenanceRequestFromSchedule(
  scheduleId: string,
  actorId?: string | null,
) {
  return await storage.createServiceRequestFromMaintenanceSchedule(scheduleId, actorId);
}

export async function syncMaintenanceScheduleFromRequest(params: {
  requestId: string;
  status: string;
}) {
  const [row] = await db
    .select({
      request: serviceRequests,
      schedule: maintenanceSchedules,
      subscription: assetSubscriptions,
    })
    .from(serviceRequests)
    .innerJoin(
      maintenanceSchedules,
      eq(maintenanceSchedules.sourceRequestId, serviceRequests.id),
    )
    .innerJoin(
      assetSubscriptions,
      eq(maintenanceSchedules.subscriptionId, assetSubscriptions.id),
    )
    .where(eq(serviceRequests.id, params.requestId))
    .limit(1);

  if (!row) {
    return null;
  }

  const status = String(params.status || "").toLowerCase();
  if (status === "assigned" || status === "assigned_for_job") {
    const updated = await storage.updateMaintenanceSchedule(row.schedule.id, {
      status: "assigned",
    } as any);
    if (String(row.schedule.status || "").toLowerCase() !== "assigned") {
      await notifyMaintenanceProviderAssigned(row.schedule.id);
    }
    return updated;
  }
  if (
    status === "in_progress" ||
    status === "work_completed_pending_resident" ||
    status === "disputed" ||
    status === "rework_required"
  ) {
    return await storage.updateMaintenanceSchedule(row.schedule.id, {
      status: "in_progress",
    } as any);
  }
  if (status === "completed") {
    const updated = await storage.updateMaintenanceSchedule(row.schedule.id, {
      status: "completed",
      completedAt: new Date(),
    } as any);
    await ensureScheduleHorizonForSubscription(row.subscription.id);
    if (String(row.schedule.status || "").toLowerCase() !== "completed") {
      await notifyMaintenanceVisitCompleted(row.schedule.id);
    }
    return updated;
  }
  if (status === "cancelled") {
    return await storage.updateMaintenanceSchedule(row.schedule.id, {
      status: "due",
    } as any);
  }

  return null;
}

export async function getMaintenanceSummaryForRequest(requestId: string) {
  const [row] = await db
    .select({
      request: serviceRequests,
      schedule: maintenanceSchedules,
      subscription: assetSubscriptions,
      asset: residentAssets,
      plan: maintenancePlans,
      itemType: maintenanceItemTypes,
    })
    .from(serviceRequests)
    .innerJoin(
      maintenanceSchedules,
      eq(maintenanceSchedules.sourceRequestId, serviceRequests.id),
    )
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
    .where(eq(serviceRequests.id, requestId))
    .limit(1);

  if (!row) return null;

  const assetLabel = String(row.asset.customName || "").trim() || row.itemType.name;
  const locationLabel = String(row.asset.locationLabel || "").trim();
  const nextStep = "Confirm preferred time and access instructions";
  const introTitle = `Scheduled maintenance for ${assetLabel}${
    locationLabel ? ` in ${locationLabel}` : ""
  }`;

  return {
    source: "scheduled_maintenance",
    scheduleId: row.schedule.id,
    subscriptionId: row.subscription.id,
    title: introTitle,
    introTitle,
    introMessage: `${row.plan.name} is already linked to this asset. Next step: ${nextStep}.`,
    nextStep,
    asset: {
      id: row.asset.id,
      label: assetLabel,
      customName: row.asset.customName || null,
      itemTypeName: row.itemType.name,
      locationLabel: locationLabel || null,
      condition: row.asset.condition || null,
      notes: row.asset.notes || null,
    },
    plan: {
      id: row.plan.id,
      name: row.plan.name,
      description: row.plan.description || null,
      durationType: row.plan.durationType,
      visitsIncluded: row.plan.visitsIncluded,
      includedTasks: normalizeTextList(row.plan.includedTasks),
    },
    schedule: {
      id: row.schedule.id,
      scheduledFor: row.schedule.scheduledDate,
      status: row.schedule.status,
    },
  };
}
