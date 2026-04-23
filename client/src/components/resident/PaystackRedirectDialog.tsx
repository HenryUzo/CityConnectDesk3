import { useEffect, useRef } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import RobotIcon from "@/components/resident/CityBuddyMascot";

type PaystackRedirectDialogProps = {
  open: boolean;
  redirectUrl: string | null;
  onOpenChange: (open: boolean) => void;
  message?: string;
};

export default function PaystackRedirectDialog({
  open,
  redirectUrl,
  onOpenChange,
  message = "You are being directed to paystack to complete your payments",
}: PaystackRedirectDialogProps) {
  const hasRedirectedRef = useRef(false);

  useEffect(() => {
    if (!open || !redirectUrl) {
      hasRedirectedRef.current = false;
      return;
    }

    const timer = window.setTimeout(() => {
      hasRedirectedRef.current = true;
      window.location.assign(redirectUrl);
    }, 1400);

    return () => window.clearTimeout(timer);
  }, [open, redirectUrl]);

  const handleContinue = () => {
    if (!redirectUrl) return;
    hasRedirectedRef.current = true;
    window.location.assign(redirectUrl);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-md rounded-[28px] border-0 bg-white p-0 shadow-[0px_24px_64px_rgba(16,24,40,0.18)] [&>button]:hidden"
        onEscapeKeyDown={(event) => event.preventDefault()}
        onPointerDownOutside={(event) => event.preventDefault()}
      >
        <style>{`
          @keyframes paystack-bot-bounce {
            0%, 100% { transform: translateY(0) scale(1); }
            20% { transform: translateY(-7px) scale(1.02); }
            40% { transform: translateY(0) scale(0.99); }
            60% { transform: translateY(-3px) scale(1.01); }
            80% { transform: translateY(0) scale(1); }
          }
          @keyframes paystack-bot-blink {
            0%, 44%, 48%, 100% { opacity: 1; }
            45%, 47% { opacity: 0.45; }
          }
        `}</style>
        <div className="overflow-hidden rounded-[28px]">
          <div className="bg-[linear-gradient(180deg,#ecfdf3_0%,#ffffff_100%)] px-8 pb-8 pt-7 text-center">
            <div className="relative mx-auto mb-5 flex h-32 w-32 items-center justify-center">
              <div className="absolute inset-0 rounded-full bg-[#12b76a]/12 animate-ping" />
              <div className="absolute inset-[14px] rounded-full bg-[#12b76a]/10" />
              <div className="relative flex h-28 w-28 items-center justify-center rounded-full border border-[#a6f4c5] bg-white shadow-[0px_10px_24px_rgba(18,183,106,0.18)]">
                <div
                  className="scale-[5.8]"
                  style={{
                    animation:
                      "paystack-bot-bounce 1.9s ease-in-out infinite, paystack-bot-blink 2.8s step-end infinite",
                  }}
                >
                  <RobotIcon variant="green" />
                </div>
              </div>
            </div>

            <DialogHeader className="space-y-3 text-center sm:text-center">
              <DialogTitle className="text-[24px] font-semibold text-[#101828]">
                Redirecting to Paystack
              </DialogTitle>
              <DialogDescription className="mx-auto max-w-[290px] text-[15px] leading-6 text-[#475467]">
                {message}
              </DialogDescription>
            </DialogHeader>

            <div className="mt-6 rounded-[20px] border border-[#d1fadf] bg-white/90 px-4 py-4 text-center">
              <div className="flex flex-col items-center justify-center gap-3">
                <div className="mt-0.5 rounded-full bg-[#ecfdf3] p-2 text-[#039855]">
                  <Loader2 className="h-4 w-4 animate-spin" />
                </div>
                <div className="space-y-1 text-center">
                  <p className="text-sm font-medium text-[#101828]">Secure payment handoff in progress</p>
                  <p className="mx-auto max-w-[280px] text-sm leading-5 text-[#667085]">
                    If you are not redirected automatically, use the button below.
                  </p>
                </div>
              </div>
            </div>

            <Button
              type="button"
              className="mt-6 h-12 w-full rounded-[16px] bg-[#039855] text-base font-semibold text-white hover:bg-[#027a48]"
              onClick={handleContinue}
              disabled={!redirectUrl}
            >
              Continue to Paystack
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
