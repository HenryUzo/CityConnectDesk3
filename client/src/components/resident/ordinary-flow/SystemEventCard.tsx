import { Bot, CalendarClock, Clock3 } from "lucide-react";

interface SystemEventCardProps {
  title: string;
  body: string;
  scheduleLabel?: string;
  countdownLabel?: string;
}

export function SystemEventCard({
  title,
  body,
  scheduleLabel,
  countdownLabel,
}: SystemEventCardProps) {
  return (
    <div className="rounded-xl border border-[#DCE4EE] bg-[#F8FAFC] p-3">
      <div className="flex items-start gap-2.5">
        <div className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[#D0D5DD] bg-white text-[#667085]">
          <Bot className="h-3.5 w-3.5" />
        </div>
        <div className="min-w-0 space-y-1.5">
          <p className="text-[13px] font-semibold text-[#1D2939]">{title}</p>
          <p className="text-[13px] leading-5 text-[#475467]">{body}</p>
          {(scheduleLabel || countdownLabel) ? (
            <div className="flex flex-wrap items-center gap-2">
              {scheduleLabel ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-[#D0D5DD] bg-white px-2 py-0.5 text-[11px] text-[#344054]">
                  <CalendarClock className="h-3.5 w-3.5 text-[#667085]" />
                  {scheduleLabel}
                </span>
              ) : null}
              {countdownLabel ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-[#D0D5DD] bg-white px-2 py-0.5 text-[11px] text-[#344054]">
                  <Clock3 className="h-3.5 w-3.5 text-[#667085]" />
                  {countdownLabel}
                </span>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
