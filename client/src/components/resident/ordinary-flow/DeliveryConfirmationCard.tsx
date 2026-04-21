import { Button } from "@/components/ui/button";
import { CheckCheck, Clock3, AlertTriangle } from "lucide-react";

interface DeliveryConfirmationCardProps {
  statusLabel: string;
  note?: string;
  requestedAt?: string;
  canConfirm?: boolean;
  onConfirm?: () => void;
  onDispute?: () => void;
  isConfirming?: boolean;
  isDisputing?: boolean;
}

export function DeliveryConfirmationCard({
  statusLabel,
  note,
  requestedAt,
  canConfirm = false,
  onConfirm,
  onDispute,
  isConfirming,
  isDisputing,
}: DeliveryConfirmationCardProps) {
  return (
    <div className="rounded-xl border border-[#A4BCFD] bg-[#EEF4FF] p-2.5">
      <div className="flex items-start gap-2.5">
        <div className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[#A4BCFD] bg-white text-[#3538CD]">
          <CheckCheck className="h-3.5 w-3.5" />
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[13px] font-semibold text-[#3538CD]">Confirm job delivery</p>
            <span className="inline-flex items-center rounded-full border border-[#A4BCFD] bg-white px-2 py-0.5 text-[11px] font-medium text-[#3538CD]">
              {statusLabel}
            </span>
          </div>

          {note ? <p className="whitespace-pre-line text-[12px] leading-5 text-[#475467]">{note}</p> : null}

          {requestedAt ? (
            <p className="inline-flex items-center gap-1 text-[11px] text-[#667085]">
              <Clock3 className="h-3.5 w-3.5" />
              Marked done {new Date(requestedAt).toLocaleString()}
            </p>
          ) : null}

          {canConfirm ? (
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <Button
                size="sm"
                className="h-8 rounded-full bg-[#3538CD] px-4 text-white hover:bg-[#2D31A6]"
                onClick={onConfirm}
                disabled={Boolean(isConfirming) || Boolean(isDisputing)}
              >
                {isConfirming ? "Confirming..." : "Confirm delivery"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-8 rounded-full px-4"
                onClick={onDispute}
                disabled={Boolean(isConfirming) || Boolean(isDisputing)}
              >
                <AlertTriangle className="mr-1.5 h-3.5 w-3.5" />
                {isDisputing ? "Submitting..." : "Raise issue"}
              </Button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

