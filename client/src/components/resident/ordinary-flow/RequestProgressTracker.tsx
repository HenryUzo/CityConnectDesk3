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
  completed: 5,
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
      <div className="rounded-xl border border-[#E4E7EC] bg-[#FCFCFD] px-3 py-2">
        <div className="flex items-center gap-3 overflow-x-auto">
          {steps.map((step, index) => {
            const isDone = index < currentIndex;
            const isCurrent = index === currentIndex;
            return (
              <div key={step} className="flex min-w-max items-center gap-3">
                <span
                  className={cn(
                    "inline-flex h-5 w-5 items-center justify-center rounded-full border text-[10px] font-semibold",
                    isDone && "border-[#12B76A] bg-[#ECFDF3] text-[#027A48]",
                    isCurrent && "border-[#12B76A] bg-[#12B76A] text-white shadow-[0_0_0_4px_rgba(18,183,106,0.15)]",
                    !isDone && !isCurrent && "border-[#D0D5DD] bg-white text-[#98A2B3]",
                  )}
                >
                  {isDone ? "✓" : index + 1}
                </span>
                <span
                  className={cn(
                    "text-[11px] font-medium",
                    isCurrent && "text-[#101828]",
                    isDone && "text-[#344054]",
                    !isDone && !isCurrent && "text-[#98A2B3]",
                  )}
                >
                  {step}
                </span>
                {index < steps.length - 1 ? (
                  <span
                    className={cn(
                      "h-[2px] w-7 rounded-full",
                      index < currentIndex ? "bg-[#12B76A]" : "bg-[#D0D5DD]",
                    )}
                  />
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
