import type { LucideIcon } from "lucide-react";
import { AlertCircle, Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type PageSkeletonProps = {
  className?: string;
  rows?: number;
  withHeader?: boolean;
};

export function PageSkeleton({
  className,
  rows = 3,
  withHeader = true,
}: PageSkeletonProps) {
  return (
    <div className={cn("space-y-4", className)}>
      {withHeader ? (
        <div className="space-y-2">
          <Skeleton className="h-6 w-56" />
          <Skeleton className="h-4 w-80 max-w-full" />
        </div>
      ) : null}
      {Array.from({ length: Math.max(rows, 1) }).map((_, index) => (
        <Card key={`skeleton-row-${index}`}>
          <CardContent className="space-y-3 p-4">
            <Skeleton className="h-5 w-48 max-w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-4/5" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

type EmptyStateProps = {
  title: string;
  description?: string;
  action?: React.ReactNode;
  icon?: LucideIcon;
  className?: string;
};

export function EmptyState({
  title,
  description,
  action,
  icon: Icon = Inbox,
  className,
}: EmptyStateProps) {
  return (
    <Card className={cn("border-dashed", className)}>
      <CardContent className="flex flex-col items-center justify-center py-12 text-center">
        <span className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <Icon className="h-6 w-6" />
        </span>
        <h3 className="text-lg font-semibold text-foreground">{title}</h3>
        {description ? <p className="mt-2 text-sm text-muted-foreground">{description}</p> : null}
        {action ? <div className="mt-4">{action}</div> : null}
      </CardContent>
    </Card>
  );
}

type InlineErrorStateProps = {
  description: string;
  title?: string;
  onRetry?: () => void;
  retryLabel?: string;
  className?: string;
};

export function InlineErrorState({
  description,
  title = "Unable to load data",
  onRetry,
  retryLabel = "Retry",
  className,
}: InlineErrorStateProps) {
  return (
    <div
      className={cn(
        "rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-rose-700",
        className,
      )}
      role="alert"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-semibold">{title}</p>
            <p className="text-sm">{description}</p>
          </div>
        </div>
        {onRetry ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="border-rose-300 bg-transparent text-rose-700 hover:bg-rose-100"
            onClick={onRetry}
          >
            {retryLabel}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
