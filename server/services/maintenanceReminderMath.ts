const HOUR_MS = 60 * 60 * 1000;

export const MAINTENANCE_PROVIDER_REMINDER_MILESTONES = [
  { key: "7d", label: "7 days", msBefore: 7 * 24 * HOUR_MS },
  { key: "3d", label: "3 days", msBefore: 3 * 24 * HOUR_MS },
  { key: "1d", label: "1 day", msBefore: 24 * HOUR_MS },
  { key: "6h", label: "6 hours", msBefore: 6 * HOUR_MS },
  { key: "1h", label: "1 hour", msBefore: 1 * HOUR_MS },
] as const;

export type MaintenanceProviderReminderMilestone =
  (typeof MAINTENANCE_PROVIDER_REMINDER_MILESTONES)[number];

export function getMaintenanceProviderReminderMilestonesForWindow(params: {
  scheduledDate: Date;
  now: Date;
  windowMs?: number;
}) {
  const windowMs = Math.max(HOUR_MS, params.windowMs ?? HOUR_MS);
  const windowStart = new Date(params.now.getTime() - windowMs);

  return MAINTENANCE_PROVIDER_REMINDER_MILESTONES.filter((milestone) => {
    const reminderAt = new Date(
      params.scheduledDate.getTime() - milestone.msBefore,
    );
    return reminderAt <= params.now && reminderAt > windowStart;
  });
}

