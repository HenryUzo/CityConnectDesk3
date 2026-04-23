export type SupportedMaintenanceDuration =
  | "monthly"
  | "quarterly_3m"
  | "halfyearly_6m"
  | "yearly";

const DURATION_TO_MONTHS: Record<SupportedMaintenanceDuration, number> = {
  monthly: 1,
  quarterly_3m: 3,
  halfyearly_6m: 6,
  yearly: 12,
};

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
}

export function addMonths(date: Date, months: number) {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
}

export function durationToMonths(duration: SupportedMaintenanceDuration) {
  return DURATION_TO_MONTHS[duration] ?? 1;
}

function normalizeVisitsIncluded(visitsIncluded: number) {
  if (!Number.isFinite(visitsIncluded)) return 1;
  return Math.max(1, Math.floor(visitsIncluded));
}

function cloneWithMsOffset(anchor: Date, offsetMs: number) {
  return new Date(anchor.getTime() + offsetMs);
}

function isoKey(date: Date) {
  return date.toISOString();
}

export function calculateSubscriptionEndDate(params: {
  startDate: Date;
  duration: SupportedMaintenanceDuration;
}) {
  return addMonths(params.startDate, durationToMonths(params.duration));
}

export function distributeVisitsAcrossTerm(params: {
  startDate: Date;
  endDate: Date;
  visitsIncluded: number;
}) {
  const startDate = new Date(params.startDate);
  const endDate = new Date(params.endDate);
  const visitsIncluded = normalizeVisitsIncluded(params.visitsIncluded);

  if (endDate <= startDate) {
    return [startDate];
  }

  const spanMs = endDate.getTime() - startDate.getTime();
  const uniqueDates: Date[] = [];
  const keys = new Set<string>();

  for (let index = 0; index < visitsIncluded; index += 1) {
    const ratio = index / visitsIncluded;
    let candidate = cloneWithMsOffset(startDate, Math.floor(spanMs * ratio));

    while (candidate >= endDate) {
      candidate = new Date(candidate.getTime() - 24 * 60 * 60 * 1000);
    }

    let key = isoKey(candidate);
    while (keys.has(key)) {
      const shifted = new Date(candidate);
      shifted.setUTCDate(shifted.getUTCDate() + 1);
      if (shifted >= endDate) {
        shifted.setUTCDate(candidate.getUTCDate() - 1);
      }
      candidate = shifted;
      key = isoKey(candidate);
    }

    keys.add(key);
    uniqueDates.push(candidate);
  }

  return uniqueDates.sort((left, right) => left.getTime() - right.getTime());
}

export function generateScheduleDates(params: {
  startDate: Date;
  duration: SupportedMaintenanceDuration;
  visitsIncluded: number;
  endDate?: Date;
}) {
  const startDate = new Date(params.startDate);
  const endDate =
    params.endDate instanceof Date
      ? new Date(params.endDate)
      : calculateSubscriptionEndDate({
          startDate,
          duration: params.duration,
        });

  return distributeVisitsAcrossTerm({
    startDate,
    endDate,
    visitsIncluded: params.visitsIncluded,
  });
}

export function shouldMarkScheduleDue(params: {
  scheduledFor: Date;
  leadDays: number;
  now?: Date;
}) {
  const dueAt = new Date(params.scheduledFor);
  dueAt.setDate(dueAt.getDate() - params.leadDays);
  return dueAt <= (params.now ?? new Date());
}
