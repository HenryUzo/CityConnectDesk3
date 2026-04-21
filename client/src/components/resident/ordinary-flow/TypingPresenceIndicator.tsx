import { cn } from "@/lib/utils";

interface TypingPresenceIndicatorProps {
  label: string;
  className?: string;
}

export function TypingPresenceIndicator({ label, className }: TypingPresenceIndicatorProps) {
  return (
    <div className={cn("flex w-full justify-start", className)}>
      <div className="max-w-[76%] space-y-1">
        <div className="inline-flex items-center gap-2 rounded-xl border border-[#E4E7EC] bg-[#FCFCFD] px-3 py-2 shadow-sm">
          <span className="relative inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[#A6F4C5] bg-[#ECFDF3]">
            <span className="absolute inset-0 m-auto h-3 w-3 rounded-full bg-[#12B76A]/35 animate-ping" />
            <span className="relative h-1.5 w-1.5 rounded-full bg-[#12B76A]" />
          </span>

          <div className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-[#667085] animate-bounce [animation-delay:-0.3s]" />
            <span className="h-1.5 w-1.5 rounded-full bg-[#667085] animate-bounce [animation-delay:-0.15s]" />
            <span className="h-1.5 w-1.5 rounded-full bg-[#667085] animate-bounce" />
          </div>

          <span className="text-[12px] font-medium text-[#667085]">{label}</span>
        </div>
      </div>
    </div>
  );
}
