type NotificationRole = string | null | undefined;

type NotificationLike = {
  type?: string | null;
  metadata?: Record<string, unknown> | null;
};

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function ensureAppPath(value: string) {
  if (!value) return "";
  if (value.startsWith("http://") || value.startsWith("https://")) return "";
  return value.startsWith("/") ? value : `/${value}`;
}

function appendQueryParam(path: string, key: string, value: string) {
  if (!path || !key || !value) return path;
  if (path.includes(`${key}=`)) return path;
  return `${path}${path.includes("?") ? "&" : "?"}${encodeURIComponent(key)}=${encodeURIComponent(value)}`;
}

export function resolveNotificationTarget(
  notification: NotificationLike,
  role: NotificationRole,
): string | null {
  const metadata =
    notification.metadata && typeof notification.metadata === "object" && !Array.isArray(notification.metadata)
      ? (notification.metadata as Record<string, unknown>)
      : null;

  const serviceRequestId = readString(metadata?.serviceRequestId);
  const conversationId =
    readString(metadata?.conversationId) || readString(metadata?.requestId) || serviceRequestId;
  const requestId = readString(metadata?.requestId) || serviceRequestId || conversationId;

  const directPath =
    ensureAppPath(readString(metadata?.targetPath)) ||
    ensureAppPath(readString(metadata?.path)) ||
    ensureAppPath(readString(metadata?.href));
  if (directPath) {
    if (role === "resident" && /\/resident\/requests\/ordinary/i.test(directPath) && (conversationId || requestId)) {
      let enriched = appendQueryParam(directPath, "conversationId", conversationId || requestId);
      enriched = appendQueryParam(enriched, "requestId", requestId || conversationId);
      return enriched;
    }
    return directPath;
  }

  if (conversationId || requestId) {
    if (role === "provider") {
      return `/provider/chat?requestId=${encodeURIComponent(requestId || conversationId)}`;
    }
    if (role === "resident") {
      return `/resident/requests/ordinary?conversationId=${encodeURIComponent(
        conversationId || requestId,
      )}&requestId=${encodeURIComponent(requestId || conversationId)}`;
    }
    if (role === "admin" || role === "super_admin" || role === "estate_admin") {
      return `/admin-dashboard/requests/${encodeURIComponent(requestId || conversationId)}`;
    }
  }

  const kind = readString(metadata?.kind) || readString(notification.type);
  if (
    kind === "maintenance_subscription_active" ||
    kind === "maintenance_schedule_due" ||
    kind === "maintenance_visit_rescheduled" ||
    kind === "maintenance_subscription_expiring_soon"
  ) {
    return "/resident/maintenance";
  }
  if (kind === "maintenance_provider_assigned" || kind === "maintenance_visit_completed") {
    if (role === "resident" && requestId) {
      return `/resident/requests/ordinary?conversationId=${encodeURIComponent(
        conversationId || requestId,
      )}&requestId=${encodeURIComponent(requestId)}`;
    }
    return "/resident/maintenance";
  }
  if (kind === "provider_approved") {
    return "/provider/dashboard";
  }
  if (kind === "company_approved") {
    return "/company-dashboard";
  }

  return null;
}
