import { Button } from "@/components/ui/button";
import { CreditCard, Clock3, Wallet } from "lucide-react";

interface PaymentRequestCardProps {
  amountLabel: string;
  statusLabel: string;
  note?: string;
  requestedAt?: string;
  canPay?: boolean;
  onPay?: () => void;
  onDecline?: () => void;
  isPaying?: boolean;
  isDeclining?: boolean;
}

export function PaymentRequestCard({
  amountLabel,
  statusLabel,
  note,
  requestedAt,
  canPay = false,
  onPay,
  onDecline,
  isPaying,
  isDeclining,
}: PaymentRequestCardProps) {
  return (
    <div className="rounded-xl border border-[#B2DDFF] bg-[#F5FAFF] p-2.5">
      <div className="flex items-start gap-2.5">
        <div className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[#B2DDFF] bg-white text-[#1570EF]">
          <Wallet className="h-3.5 w-3.5" />
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[13px] font-semibold text-[#175CD3]">Service payment requested</p>
            <span className="inline-flex items-center rounded-full border border-[#B2DDFF] bg-white px-2 py-0.5 text-[11px] font-medium text-[#1849A9]">
              {statusLabel}
            </span>
          </div>

          <p className="text-lg font-semibold text-[#101828]">{amountLabel}</p>

          {note ? <p className="whitespace-pre-line text-[12px] leading-5 text-[#475467]">{note}</p> : null}

          {requestedAt ? (
            <p className="inline-flex items-center gap-1 text-[11px] text-[#667085]">
              <Clock3 className="h-3.5 w-3.5" />
              Requested {new Date(requestedAt).toLocaleString()}
            </p>
          ) : null}

          {canPay ? (
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <Button
                size="sm"
                className="h-8 rounded-full bg-[#1570EF] px-4 text-white hover:bg-[#175CD3]"
                onClick={onPay}
                disabled={Boolean(isPaying) || Boolean(isDeclining)}
              >
                <CreditCard className="mr-1.5 h-3.5 w-3.5" />
                {isPaying ? "Starting payment..." : "Make payment"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-8 rounded-full px-4"
                onClick={onDecline}
                disabled={Boolean(isPaying) || Boolean(isDeclining)}
              >
                {isDeclining ? "Declining..." : "Decline payment"}
              </Button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
