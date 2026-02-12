import { useEffect, useState } from "react";
import { useLocation, Link } from "wouter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { residentFetch } from "@/lib/residentApi";
import ResidentShell from "@/components/layout/ResidentShell";

export default function PaymentConfirmation() {
  const [status, setStatus] = useState<"loading" | "success" | "failed">("loading");
  const [reference, setReference] = useState<string | null>(null);
  const [failureMessage, setFailureMessage] = useState<string | null>(null);
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get("reference");
    const orderType = params.get("orderType");
    
    if (!ref) {
      setStatus("failed");
      toast({ title: "Missing reference", description: "Payment reference not present", variant: "destructive" });
      return;
    }
    setReference(ref);

    (async () => {
      try {
        const res = await residentFetch<{
          status: "success" | "failed";
          message?: string;
          serviceRequestId?: string | null;
        }>("/api/payments/paystack/verify", {
          method: "POST",
          json: { reference: ref },
        });

        if (res?.status === "success") {
          toast({
            title: "Payment received",
            description: orderType === "marketplace" ? "Payment confirmed. Completing your order..." : "Your booking has been confirmed.",
          });
          
          // Handle marketplace orders
          if (orderType === "marketplace") {
            // Redirect back to cart with payment reference
            // The cart page will use this to finalize the checkout
            setLocation(`/resident/citymart/cart?paymentReference=${encodeURIComponent(ref)}&orderType=marketplace`);
            return;
          }
          
          // Handle service requests
          if (res.serviceRequestId) {
            setLocation(`/track-orders?highlight=${encodeURIComponent(res.serviceRequestId)}`);
          } else {
            setLocation(`/resident?paid=1&reference=${encodeURIComponent(ref)}`);
          }
          return;
        }

        setStatus("failed");
        setFailureMessage(
          res?.message || "We could not confirm this payment. Please try again."
        );
        toast({
          title: "Verification failed",
          description: res?.message || "The payment could not be confirmed",
          variant: "destructive",
        });
      } catch (err: any) {
        setStatus("failed");
        setFailureMessage(err?.message || "Could not verify payment");
        toast({
          title: "Verification error",
          description: err?.message || "Could not verify payment",
          variant: "destructive",
        });
      }
    })();
  }, []);

  return (
    <ResidentShell currentPage="chat">
      <div className="flex items-center justify-center p-6 min-h-full">
      <Card className="max-w-xl w-full p-8">
        <h1 className="text-2xl font-semibold mb-4">Payment Confirmation</h1>

        {status === "loading" && <p className="text-sm text-gray-600">Verifying your payment...</p>}

        {status === "success" && (
          <div>
            <p className="text-green-700 font-semibold">Payment successful.</p>
            <p className="text-sm text-gray-700 mt-2">Reference: <span className="font-mono">{reference}</span></p>
            <p className="text-sm text-gray-700 mt-4">Your order is being processed. You will be redirected shortly...</p>
            <div className="mt-6 flex justify-end">
              <Link href="/resident/citymart/orders">
                <Button>View Orders</Button>
              </Link>
            </div>
          </div>
        )}

        {status === "failed" && (
          <div>
            <p className="text-red-700 font-semibold">Payment not confirmed.</p>
            <p className="text-sm text-gray-700 mt-2">Reference: <span className="font-mono">{reference || "-"}</span></p>
            {failureMessage && (
              <p className="text-sm text-gray-500 mt-1">{failureMessage}</p>
            )}
            <div className="mt-6 flex justify-end space-x-2">
              <Link href="/resident/citymart/cart">
                <Button variant="outline">Back to Cart</Button>
              </Link>
              <Link href="/resident">
                <Button>Back to dashboard</Button>
              </Link>
            </div>
          </div>
        )}
      </Card>
      </div>
    </ResidentShell>
  );
}
