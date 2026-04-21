import type { LucideIcon } from "lucide-react";
import { Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface RequestCardProps {
  title: string;
  location: string;
  updatedAt: string;
  statusLabel: string;
  statusToneClassName: string;
  icon: LucideIcon;
  isActive: boolean;
  isBusy: boolean;
  isDraft: boolean;
  unreadCount: number;
  onOpen: () => void;
  onDelete?: () => void;
}

export function RequestCard({
  title,
  location,
  updatedAt,
  statusLabel,
  statusToneClassName,
  icon: Icon,
  isActive,
  isBusy,
  isDraft,
  unreadCount,
  onOpen,
  onDelete,
}: RequestCardProps) {
  return (
    <div className="group relative">
      <button
        type="button"
        onClick={onOpen}
        className={cn(
          "w-full rounded-2xl border px-4 py-3.5 text-left transition-all duration-150",
          isActive
            ? "border-[#73E2BA]/70 bg-[#0C7355] shadow-[0_14px_24px_-20px_rgba(94,233,178,0.95)]"
            : "border-transparent bg-[#0A6A4E]/60 hover:border-[#29A874]/45 hover:bg-[#0D7557]",
          isBusy && "cursor-wait opacity-70",
          !isDraft && "pr-11",
        )}
        aria-busy={isBusy}
        disabled={isBusy}
      >
        <div className="flex items-start gap-3">
          <div className="mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#39B885]/40 bg-[#095D45] text-emerald-50 shadow-inner">
            <Icon className="h-4.5 w-4.5" />
          </div>
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <p className="truncate text-[18px] font-semibold leading-snug tracking-[-0.01em] text-white">
                {title}
              </p>
              {unreadCount > 0 ? (
                <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[#F04438] px-1 text-[10px] font-semibold text-white">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              ) : null}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <p className="text-[13px] text-emerald-100/90">
                {new Date(updatedAt || Date.now()).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                })}
              </p>
              <span
                className={cn(
                  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.02em]",
                  statusToneClassName,
                )}
              >
                {statusLabel}
              </span>
            </div>

            <p className="truncate text-[13px] text-emerald-100/85">{location}</p>
          </div>
        </div>
      </button>

      {!isDraft ? (
        <button
          type="button"
          className={cn(
            "absolute right-2.5 top-2.5 rounded-lg p-1.5 text-emerald-100/80 transition",
            "opacity-0 hover:bg-[#065F46] hover:text-white group-hover:opacity-100",
            isActive && "opacity-100",
          )}
          onClick={onDelete}
          aria-label="Delete conversation"
          disabled={isBusy}
        >
          <Trash2 className="h-4 w-4" />
        </button>
      ) : null}
    </div>
  );
}
