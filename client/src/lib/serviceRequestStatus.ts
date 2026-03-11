export function normalizeServiceRequestStatus(status?: string | null) {
  return String(status || "")
    .toLowerCase()
    .replace(/[\s-]+/g, "_")
    .trim();
}

export function isMaintenanceServiceCategory(category?: string | null) {
  const key = String(category || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  // Keep this narrow: only explicit maintenance categories should use
  // "Assigned for maintenance". Every other category uses "Assigned for job".
  return new Set([
    "maintenance",
    "maintenance_repair",
    "maintenance_and_repair",
  ]).has(key);
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
