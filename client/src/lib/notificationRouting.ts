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

export function resolveNotificationTarget(
  notification: NotificationLike,
  role: NotificationRole,
): string | null {
  const metadata =
    notification.metadata && typeof notification.metadata === "object" && !Array.isArray(notification.metadata)
      ? (notification.metadata as Record<string, unknown>)
      : null;

  const directPath =
    ensureAppPath(readString(metadata?.targetPath)) ||
    ensureAppPath(readString(metadata?.path)) ||
    ensureAppPath(readString(metadata?.href));
  if (directPath) return directPath;

  const requestId = readString(metadata?.requestId);
  if (requestId) {
    if (role === "provider") {
      return `/provider/chat?requestId=${encodeURIComponent(requestId)}`;
    }
    if (role === "resident") {
      return `/resident/requests/ordinary?requestId=${encodeURIComponent(requestId)}`;
    }
    if (role === "admin" || role === "super_admin" || role === "estate_admin") {
      return `/admin-dashboard/requests/${encodeURIComponent(requestId)}`;
    }
  }

  const kind = readString(metadata?.kind) || readString(notification.type);
  if (kind === "provider_approved") {
    return "/provider/dashboard";
  }
  if (kind === "company_approved") {
    return "/company-dashboard";
  }

  return null;
}

