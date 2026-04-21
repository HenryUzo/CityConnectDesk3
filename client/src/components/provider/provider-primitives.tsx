import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { formatServiceRequestStatusLabel, normalizeServiceRequestStatus } from "@/lib/serviceRequestStatus";

type ProviderPageHeaderProps = {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  className?: string;
};

export function ProviderPageHeader({ title, subtitle, actions, className }: ProviderPageHeaderProps) {
  return (
    <div className={cn("flex flex-col gap-3 px-4 py-3 sm:px-6 lg:px-8 xl:flex-row xl:items-center xl:justify-between", className)}>
      <div className="min-w-0">
        <h1 className="truncate text-xl font-semibold tracking-tight text-foreground sm:text-2xl">{title}</h1>
        {subtitle ? <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center justify-start gap-2 sm:justify-end">{actions}</div> : null}
    </div>
  );
}

type ProviderMetricTone = "default" | "success" | "info" | "warning" | "accent";

type ProviderMetricCardProps = {
  title: string;
  value: string | number;
  hint?: string;
  icon: React.ComponentType<{ className?: string }>;
  tone?: ProviderMetricTone;
  dataTestId?: string;
  className?: string;
};

const metricToneClasses: Record<ProviderMetricTone, string> = {
  default: "bg-slate-100 text-slate-700",
  success: "bg-emerald-100 text-emerald-700",
  info: "bg-cyan-100 text-cyan-700",
  warning: "bg-amber-100 text-amber-700",
  accent: "bg-violet-100 text-violet-700",
};

export function ProviderMetricCard({
  title,
  value,
  hint,
  icon: Icon,
  tone = "default",
  dataTestId,
  className,
}: ProviderMetricCardProps) {
  return (
    <Card className={cn("border-emerald-100/80 shadow-sm", className)}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</p>
            <p className="text-2xl font-semibold text-foreground" data-testid={dataTestId}>
              {value}
            </p>
            {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
          </div>
          <span className={cn("inline-flex h-10 w-10 items-center justify-center rounded-xl", metricToneClasses[tone])}>
            <Icon className="h-5 w-5" />
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

type ProviderStatusTone = "neutral" | "warning" | "success" | "danger" | "info" | "accent";

type ProviderStatusBadgeProps = {
  status: string;
  category?: string;
  variant?: "request" | "urgency";
  className?: string;
};

const statusToneClasses: Record<ProviderStatusTone, string> = {
  neutral: "border-slate-200 bg-slate-100 text-slate-700",
  warning: "border-amber-200 bg-amber-100 text-amber-700",
  success: "border-emerald-200 bg-emerald-100 text-emerald-700",
  danger: "border-rose-200 bg-rose-100 text-rose-700",
  info: "border-cyan-200 bg-cyan-100 text-cyan-700",
  accent: "border-violet-200 bg-violet-100 text-violet-700",
};

function requestTone(status: string): ProviderStatusTone {
  switch (normalizeServiceRequestStatus(status)) {
    case "pending_inspection":
      return "warning";
    case "assigned":
      return "accent";
    case "assigned_for_job":
      return "info";
    case "in_progress":
      return "info";
    case "work_completed_pending_resident":
      return "info";
    case "rework_required":
      return "warning";
    case "disputed":
      return "danger";
    case "completed":
      return "success";
    case "cancelled":
      return "danger";
    case "pending":
    default:
      return "neutral";
  }
}

function urgencyTone(urgency: string): ProviderStatusTone {
  switch (String(urgency || "").toLowerCase()) {
    case "emergency":
      return "danger";
    case "high":
      return "warning";
    case "medium":
      return "info";
    case "low":
      return "success";
    default:
      return "neutral";
  }
}

function formatUrgencyLabel(value: string) {
  if (!value) return "Standard";
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
}

export function ProviderStatusBadge({
  status,
  category,
  variant = "request",
  className,
}: ProviderStatusBadgeProps) {
  const label =
    variant === "urgency"
      ? formatUrgencyLabel(status)
      : formatServiceRequestStatusLabel(status, category);

  const toneClass =
    variant === "urgency"
      ? statusToneClasses[urgencyTone(status)]
      : statusToneClasses[requestTone(status)];

  return (
    <Badge
      className={cn(
        "rounded-full border px-2.5 py-1 text-[11px] font-semibold",
        toneClass,
        className,
      )}
    >
      {label}
    </Badge>
  );
}

type ProviderFilterActionBarProps = {
  leading?: ReactNode;
  trailing?: ReactNode;
  className?: string;
};

export function ProviderFilterActionBar({ leading, trailing, className }: ProviderFilterActionBarProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-2xl border border-emerald-100 bg-white/90 p-3 shadow-[0_8px_20px_rgba(16,185,129,0.06)] sm:flex-row sm:items-center sm:justify-between",
        className,
      )}
    >
      {leading ? <div className="flex flex-wrap items-center gap-2">{leading}</div> : <span />}
      {trailing ? <div className="flex flex-wrap items-center gap-2 sm:justify-end">{trailing}</div> : null}
    </div>
  );
}
