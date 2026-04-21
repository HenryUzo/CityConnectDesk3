export const PROVIDER_ANALYTICS_EVENTS = {
  DASHBOARD_VIEWED: "provider_dashboard_viewed",
  JOB_ACCEPTED: "provider_job_accepted",
  STORE_CREATED: "provider_store_created",
  INVENTORY_ITEM_CREATED: "provider_inventory_item_created",
  ORDER_STATUS_CHANGED: "provider_order_status_changed",
  BLOCKED_ACTION: "provider_blocked_action",
  NOTIFICATIONS_OPENED: "provider_notifications_opened",
} as const;

export type ProviderAnalyticsEvent =
  (typeof PROVIDER_ANALYTICS_EVENTS)[keyof typeof PROVIDER_ANALYTICS_EVENTS];

type Primitive = string | number | boolean | null;
export type AnalyticsPayload = Record<string, Primitive | undefined>;

type AnalyticsSink = {
  track: (event: string, payload?: Record<string, Primitive>) => void;
};

declare global {
  interface Window {
    __CITYCONNECT_ANALYTICS__?: AnalyticsSink;
    dataLayer?: Array<Record<string, unknown>>;
  }
}

const SENSITIVE_KEY_PATTERN = /(message|description|note|content|email|phone|name|address|token|password|secret)/i;

function isPrimitive(value: unknown): value is Primitive {
  return (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  );
}

function sanitizePayload(payload: AnalyticsPayload = {}): Record<string, Primitive> {
  const clean: Record<string, Primitive> = {};

  Object.entries(payload).forEach(([key, value]) => {
    if (!key || SENSITIVE_KEY_PATTERN.test(key)) return;
    if (typeof value === "undefined") return;
    if (!isPrimitive(value)) return;

    if (typeof value === "string") {
      clean[key] = value.slice(0, 120);
      return;
    }

    clean[key] = value;
  });

  return clean;
}

export function trackEvent(event: ProviderAnalyticsEvent | string, payload: AnalyticsPayload = {}): void {
  if (!event) return;

  const safePayload = sanitizePayload(payload);

  if (typeof window === "undefined") return;

  try {
    if (window.__CITYCONNECT_ANALYTICS__?.track) {
      window.__CITYCONNECT_ANALYTICS__.track(event, safePayload);
    }

    if (Array.isArray(window.dataLayer)) {
      window.dataLayer.push({ event, ...safePayload });
    }

    window.dispatchEvent(new CustomEvent("cityconnect:analytics", { detail: { event, payload: safePayload } }));

    if (import.meta.env.DEV) {
      console.debug("[analytics]", event, safePayload);
    }
  } catch {
    // Intentionally swallow analytics errors so UX is never blocked.
  }
}
