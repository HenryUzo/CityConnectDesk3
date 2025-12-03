import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ensurePaystackScript } from "@/lib/paystack";

type PayWithPaystackButtonProps = {
  email: string;
  amountInNaira: number;
  onPaymentSuccess?: (data: unknown) => void;
};

export function PayWithPaystackButton({
  email,
  amountInNaira,
  onPaymentSuccess,
}: PayWithPaystackButtonProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const publicKey = import.meta.env.VITE_PAYSTACK_PUBLIC_KEY;

  const handlePay = () => {
    if (!publicKey) {
      setError("Missing Paystack public key. Please configure VITE_PAYSTACK_PUBLIC_KEY.");
      return;
    }

    if (!window.PaystackPop) {
      setError("Paystack script not available. Ensure https://js.paystack.co/v1/inline.js is loaded.");
      return;
    }

    setError(null);
    setIsProcessing(true);

    const reference = `CCD-${Date.now()}`;
    const handler = window.PaystackPop.setup({
      key: publicKey,
      email,
      amount: Math.round(amountInNaira * 100),
      ref: reference,
      callback: async () => {
        try {
          const res = await fetch(`/api/paystack/verify?reference=${encodeURIComponent(reference)}`, {
            method: "GET",
            credentials: "include",
          });

          if (!res.ok) {
            const text = await res.text();
            throw new Error(text || "Verification failed");
          }

          const data = await res.json();
          onPaymentSuccess?.(data);
        } catch (err: any) {
          setError(err?.message || "Unable to verify payment");
        } finally {
          setIsProcessing(false);
        }
      },
      onClose: () => {
        setIsProcessing(false);
      },
    });

    handler.openIframe();
  };

  return (
    <div className="space-y-2">
      <Button onClick={handlePay} disabled={isProcessing} className="w-full">
        {isProcessing ? "Processing..." : "Pay with Paystack"}
      </Button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
