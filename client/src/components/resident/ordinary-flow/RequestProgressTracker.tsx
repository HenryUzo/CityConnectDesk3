import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface RequestProgressTrackerProps {
  status?: string | null;
}

const steps = [
  "Request Created",
  "Pending inspection",
  "Assigned for inspection",
  "Assigned for job",
  "In Progress",
  "Awaiting resident confirmation",
  "Completed",
];

const statusIndexByKey: Record<string, number> = {
  draft: 0,
  pending: 0,
  request_created: 0,
  pending_inspection: 1,
  inspection: 1,
  assigned: 2,
  assigned_for_job: 3,
  in_progress: 4,
  rework_required: 4,
  disputed: 5,
  work_completed_pending_resident: 5,
  completed: 6,
  cancelled: 0,
};

function normalizeStatus(status: string) {
  return status.toLowerCase().replace(/[\s-]+/g, "_").trim();
}

export function RequestProgressTracker({ status }: RequestProgressTrackerProps) {
  if (!status) return null;
  const currentIndex = statusIndexByKey[normalizeStatus(status)];
  if (currentIndex === undefined) return null;

  return (
    <div className="border-b border-[#EAECF0] bg-white px-5 py-2">
      <div className="rounded-xl border border-[#E4E7EC] bg-[#FCFCFD] px-3 py-2.5">
        <div className="grid grid-cols-7 gap-2">
          {steps.map((step, index) => {
            const isDone = index < currentIndex;
            const isCurrent = index === currentIndex;

            return (
              <div key={step} className="relative flex min-w-0 flex-col items-center text-center">
                {index < steps.length - 1 ? (
                  <span
                    className={cn(
                      "pointer-events-none absolute left-[calc(50%+14px)] right-[-50%] top-[11px] h-[2px] rounded-full",
                      index < currentIndex ? "bg-[#12B76A]" : "bg-[#D0D5DD]",
                    )}
                  />
                ) : null}
                <span
                  className={cn(
                    "relative z-[1] inline-flex h-5 w-5 items-center justify-center rounded-full border text-[10px] font-semibold",
                    isDone && "border-[#12B76A] bg-[#ECFDF3] text-[#027A48]",
                    isCurrent && "border-[#12B76A] bg-[#12B76A] text-white shadow-[0_0_0_4px_rgba(18,183,106,0.15)]",
                    !isDone && !isCurrent && "border-[#D0D5DD] bg-white text-[#98A2B3]",
                  )}
                >
                  {isDone ? <Check className="h-3 w-3" aria-hidden="true" /> : index + 1}
                </span>
                <span
                  className={cn(
                    "mt-1 min-w-0 text-[11px] font-medium leading-[1.2]",
                    isCurrent && "text-[#101828]",
                    isDone && "text-[#344054]",
                    !isDone && !isCurrent && "text-[#98A2B3]",
                  )}
                >
                  {step}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
