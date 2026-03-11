export function normalizeServiceRequestStatus(status?: string | null) {
  return String(status || "")
    .toLowerCase()
    .replace(/[\s-]+/g, "_")
    .trim();
}

export function isMaintenanceServiceCategory(category?: string | null) {
  const key = String(category || "").toLowerCase();
  return /(maintenance|repair|plumb|elect|hvac|fix)/i.test(key);
}

export function formatServiceRequestStatusLabel(status?: string | null, category?: string | null) {
  const key = normalizeServiceRequestStatus(status);

  if (key === "pending_inspection") return "Pending inspection";
  if (key === "assigned") return "Assigned for inspection";
  if (key === "assigned_for_job") {
    return isMaintenanceServiceCategory(category) ? "Assigned for maintenance" : "Assigned for job";
  }

  if (!key) return "Draft";

  return key
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
