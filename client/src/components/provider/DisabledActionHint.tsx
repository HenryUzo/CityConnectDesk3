import type { ReactNode } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { PROVIDER_ANALYTICS_EVENTS, trackEvent, type AnalyticsPayload } from "@/lib/analytics";

type DisabledActionHintProps = {
  reason?: string | null;
  children: ReactNode;
  side?: "top" | "right" | "bottom" | "left";
  actionName?: string;
  metadata?: AnalyticsPayload;
};

export function DisabledActionHint({
  reason,
  children,
  side = "top",
  actionName = "unknown_action",
  metadata,
}: DisabledActionHintProps) {
  if (!reason) {
    return <>{children}</>;
  }

  const emitBlockedAction = () => {
    if (!reason) return;
    trackEvent(PROVIDER_ANALYTICS_EVENTS.BLOCKED_ACTION, {
      action: actionName,
      has_reason: Boolean(reason),
      ...metadata,
    });
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className="inline-flex cursor-not-allowed rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
          tabIndex={0}
          aria-label={reason}
          onClick={emitBlockedAction}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              emitBlockedAction();
            }
          }}
        >
          {children}
        </span>
      </TooltipTrigger>
      <TooltipContent side={side} className="max-w-[260px] text-xs">
        {reason}
      </TooltipContent>
    </Tooltip>
  );
}
