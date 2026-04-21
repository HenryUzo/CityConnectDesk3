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

function appendQueryParam(path: string, key: string, value: string) {
  if (!path || !key || !value) return path;
  if (path.includes(`${key}=`)) return path;
  return `${path}${path.includes("?") ? "&" : "?"}${encodeURIComponent(key)}=${encodeURIComponent(value)}`;
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

  const serviceRequestId = readString(meta.serviceRequestId);
  const conversationId = readString(meta.conversationId) || readString(meta.requestId) || serviceRequestId;
  const requestId = readString(meta.requestId) || serviceRequestId || conversationId;

  const explicitPath =
    ensureAppRelativePath(readString(meta.targetPath)) ||
    ensureAppRelativePath(readString(meta.path)) ||
    ensureAppRelativePath(readString(meta.href));
  if (explicitPath) {
    if (roleKey === "resident" && /\/resident\/requests\/ordinary/i.test(explicitPath) && (conversationId || requestId)) {
      let enriched = appendQueryParam(explicitPath, "conversationId", conversationId || requestId);
      enriched = appendQueryParam(enriched, "requestId", requestId || conversationId);
      return enriched;
    }
    return explicitPath;
  }
  if (conversationId || requestId) {
    if (roleKey === "provider") {
      return `/provider/chat?requestId=${encodeURIComponent(requestId || conversationId)}`;
    }
    if (roleKey === "resident") {
      return `/resident/requests/ordinary?conversationId=${encodeURIComponent(
        conversationId || requestId,
      )}&requestId=${encodeURIComponent(requestId || conversationId)}`;
    }
    if (roleKey === "admin" || roleKey === "super_admin" || roleKey === "estate_admin") {
      return `/admin-dashboard/requests/${encodeURIComponent(requestId || conversationId)}`;
    }
    return `/notifications`;
  }

  const kind = readString(meta.kind) || readString(type);
  if (kind === "provider_approved") return "/provider/dashboard";
  if (kind === "company_approved") return "/company-dashboard";

  return defaultPathForRole(roleKey);
}
