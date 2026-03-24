export function normalizeServiceRequestStatus(status?: string | null) {
  return String(status || "")
    .toLowerCase()
    .replace(/[\s-]+/g, "_")
    .trim();
}

export function formatServiceRequestStatusLabel(status?: string | null, _category?: string | null) {
  const key = normalizeServiceRequestStatus(status);

  if (key === "pending_inspection") return "Pending inspection";
  if (key === "assigned") return "Assigned for inspection";
  if (key === "assigned_for_job" || key === "assigned_for_maintenance") return "Assigned for job";
  if (key === "work_completed_pending_resident") return "Awaiting resident confirmation";
  if (key === "rework_required") return "Rework required";
  if (key === "disputed") return "Disputed";

  if (!key) return "Draft";

  return key
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
