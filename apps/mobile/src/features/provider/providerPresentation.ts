import { ServiceRequest } from "../../api/contracts";

export const PROVIDER_ACTIVE_JOB_STATUSES = new Set([
  "assigned",
  "assigned_for_job",
  "in_progress",
  "work_completed_pending_resident",
  "disputed",
  "rework_required",
]);

export type ProviderJobFilter = "all" | "available" | "assigned" | "in_progress" | "review";

export function normalizeProviderStatus(value?: string | null) {
  return String(value || "").trim().toLowerCase();
}

export function filterProviderJobs(jobs: ServiceRequest[], filter: ProviderJobFilter) {
  if (filter === "all") return jobs;
  if (filter === "available") return jobs.filter((job) => normalizeProviderStatus(job.status) === "available");
  if (filter === "assigned") {
    return jobs.filter((job) => ["assigned", "assigned_for_job"].includes(normalizeProviderStatus(job.status)));
  }
  if (filter === "in_progress") {
    return jobs.filter((job) => normalizeProviderStatus(job.status) === "in_progress");
  }
  if (filter === "review") {
    return jobs.filter((job) =>
      ["work_completed_pending_resident", "disputed", "rework_required"].includes(
        normalizeProviderStatus(job.status),
      ),
    );
  }

  return jobs;
}

export function canMoveProviderJobToInProgress(status?: string | null) {
  const current = normalizeProviderStatus(status);
  return ["assigned_for_job", "rework_required", "in_progress"].includes(current);
}

export function canMarkProviderJobComplete(status?: string | null) {
  return normalizeProviderStatus(status) === "in_progress";
}

export function hasConsultancyReport(request?: ServiceRequest | null) {
  return Boolean(request?.consultancyReport);
}
