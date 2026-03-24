type RoleLike = string | null | undefined;

type NotificationTargetInput = {
  role?: RoleLike;
  type?: string | null;
  metadata?: Record<string, unknown> | null;
};

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function ensureAppRelativePath(value: string) {
  if (!value) return "";
  if (value.startsWith("http://") || value.startsWith("https://")) return "";
  return value.startsWith("/") ? value : `/${value}`;
}

function normalizeRole(role: RoleLike) {
  return String(role || "").trim().toLowerCase();
}

function defaultPathForRole(role: string) {
  if (role === "provider") return "/provider/dashboard";
  if (role === "admin" || role === "super_admin" || role === "estate_admin") return "/admin-dashboard";
  return "/notifications";
}

export function resolveNotificationTargetPath({
  role,
  type,
  metadata,
}: NotificationTargetInput): string | null {
  const roleKey = normalizeRole(role);
  const meta =
    metadata && typeof metadata === "object" && !Array.isArray(metadata)
      ? (metadata as Record<string, unknown>)
      : {};

  const explicitPath =
    ensureAppRelativePath(readString(meta.targetPath)) ||
    ensureAppRelativePath(readString(meta.path)) ||
    ensureAppRelativePath(readString(meta.href));
  if (explicitPath) return explicitPath;

  const requestId = readString(meta.requestId);
  if (requestId) {
    if (roleKey === "provider") {
      return `/provider/chat?requestId=${encodeURIComponent(requestId)}`;
    }
    if (roleKey === "resident") {
      return `/resident/requests/ordinary?requestId=${encodeURIComponent(requestId)}`;
    }
    if (roleKey === "admin" || roleKey === "super_admin" || roleKey === "estate_admin") {
      return `/admin-dashboard/requests/${encodeURIComponent(requestId)}`;
    }
    return `/notifications`;
  }

  const kind = readString(meta.kind) || readString(type);
  if (kind === "provider_approved") return "/provider/dashboard";
  if (kind === "company_approved") return "/company-dashboard";

  return defaultPathForRole(roleKey);
}

