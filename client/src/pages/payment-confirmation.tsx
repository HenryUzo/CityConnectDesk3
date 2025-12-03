import { useEffect, useState } from "react";
import { Link } from "wouter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { residentFetch } from "@/lib/residentApi";

export default function PaymentConfirmation() {
  const [status, setStatus] = useState<"loading" | "success" | "failed">("loading");
  const [reference, setReference] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get("reference");
    if (!ref) {
      setStatus("failed");
      toast({ title: "Missing reference", description: "Payment reference not present", variant: "destructive" });
      return;
    }
    setReference(ref);

    (async () => {
      try {
        const res = await residentFetch<{ status: string }>(`/api/paystack/verify?reference=${encodeURIComponent(ref)}`);
        if (res?.status === "success") {
          setStatus("success");
        } else {
          setStatus("failed");
        }
      } catch (err: any) {
        setStatus("failed");
        toast({ title: "Verification error", description: err?.message || "Could not verify payment", variant: "destructive" });
      }
    })();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <Card className="max-w-xl w-full p-8">
        <h1 className="text-2xl font-semibold mb-4">Payment Confirmation</h1>

        {status === "loading" && <p className="text-sm text-gray-600">Verifying your payment...</p>}

        {status === "success" && (
          <div>
            <p className="text-green-700 font-semibold">Payment successful.</p>
            <p className="text-sm text-gray-700 mt-2">Reference: <span className="font-mono">{reference}</span></p>
            <div className="mt-6 flex justify-end">
              <Link href="/resident">
                <Button>Back to dashboard</Button>
              </Link>
            </div>
          </div>
        )}

        {status === "failed" && (
          <div>
            <p className="text-red-700 font-semibold">Payment not confirmed.</p>
            <p className="text-sm text-gray-700 mt-2">Reference: <span className="font-mono">{reference || "-"}</span></p>
            <div className="mt-6 flex justify-end space-x-2">
              <Link href="/checkout-diagnosis">
                <Button variant="outline">Back to checkout</Button>
              </Link>
              <Link href="/resident">
                <Button>Back to dashboard</Button>
              </Link>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
