import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, Lock, Info, ArrowRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { residentFetch } from "@/lib/residentApi";
import PaystackRedirectDialog from "@/components/resident/PaystackRedirectDialog";
import Nav from "@/components/layout/Nav";
import MobileNavDrawer from "@/components/layout/MobileNavDrawer";

export default function CheckoutDiagnosis() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [isPaying, setIsPaying] = useState(false);
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [password, setPassword] = useState("");
  const [paystackRedirectUrl, setPaystackRedirectUrl] = useState<string | null>(null);
  const [showPaystackRedirectModal, setShowPaystackRedirectModal] = useState(false);

  const consultancyFee = 4500;
  const tax = 2000;
  const total = consultancyFee + tax;
  const CONSULTANCY_DRAFT_KEY = "citybuddy_consultancy_draft";
  const formatCurrency = (amount: number, options?: { negative?: boolean }) =>
    `${options?.negative ? "- " : ""}NGN ${amount.toLocaleString()}`;

  const paystackPublicKey = import.meta.env.VITE_PAYSTACK_PUBLIC_KEY;

  const launchPayment = async () => {
    if (!paystackPublicKey) {
      toast({
        title: "Missing Paystack key",
        description: "Set VITE_PAYSTACK_PUBLIC_KEY in your environment.",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsPaying(true);
      // 1) create a pending transaction record in our DB
      const session = await residentFetch<{
        reference: string;
        amountKobo: number;
      }>("/api/payments/paystack/session", {
        method: "POST",
        json: {
          amount: total,
          description: "Consultancy and diagnostic fee",
          consultancyRequest: (() => {
            try {
              const raw = sessionStorage.getItem(CONSULTANCY_DRAFT_KEY);
              return raw ? JSON.parse(raw) : undefined;
            } catch {
              return undefined;
            }
          })(),
        },
      });

      // 2) initialize Paystack and get an authorization URL that will redirect the user
      const init = await residentFetch<{ authorization_url?: string; authorizationUrl?: string; reference: string }>(
        "/api/paystack/init",
        {
          method: "POST",
          json: {
            email: user?.email || "resident@example.com",
            amountInNaira: total,
            metadata: { residentId: user?.id, sessionReference: session.reference },
            reference: session.reference, // ensure Paystack uses our DB reference
            callbackUrl: window.location.origin + "/payment-confirmation?source=ordinary",
          },
        }
      );

      // 3) redirect the browser to Paystack's hosted payment page
      const authUrl = init?.authorization_url || init?.authorizationUrl;
      if (authUrl) {
        setPaystackRedirectUrl(authUrl);
        setShowPaystackRedirectModal(true);
      } else {
        throw new Error("Missing authorization URL from Paystack initialization");
      }
    } catch (error: any) {
      setIsPaying(false);
      toast({
        title: "Payment error",
        description: error?.message || "Could not start Paystack checkout.",
        variant: "destructive",
      });
    }
  };


  return (
    <>
    <PaystackRedirectDialog
      open={showPaystackRedirectModal}
      redirectUrl={paystackRedirectUrl}
      onOpenChange={(open) => {
        setShowPaystackRedirectModal(open);
        if (!open) {
          setPaystackRedirectUrl(null);
          setIsPaying(false);
        }
      }}
    />
    <div className="flex h-screen overflow-hidden bg-[#054f31]" data-name="Payment summary">
      <MobileNavDrawer
        onNavigateToHomepage={() => navigate("/resident")}
        onNavigateToMarketplace={() => navigate("/resident/citymart")}
        onNavigateToSettings={() => navigate("/resident/settings")}
        onBookServiceClick={() => navigate("/resident/requests/new")}
        onNavigateToServiceRequests={() => navigate("/service-requests")}
        onNavigateToOrdinaryFlow={() => navigate("/resident/requests/ordinary")}
        currentPage="chat"
      />

      <div className="hidden lg:block h-full">
        <Nav
          onNavigateToHomepage={() => navigate("/resident")}
          onNavigateToMarketplace={() => navigate("/resident/citymart")}
          onNavigateToSettings={() => navigate("/resident/settings")}
          onBookServiceClick={() => navigate("/resident/requests/new")}
          onNavigateToServiceRequests={() => navigate("/service-requests")}
          onNavigateToOrdinaryFlow={() => navigate("/resident/requests/ordinary")}
          currentPage="chat"
        />
      </div>

      <div className="flex-1 min-w-0 h-full bg-white rounded-bl-[40px] rounded-tl-[40px] lg:ml-[14px] lg:mt-[12px] overflow-y-auto">
        <div className="max-w-5xl mx-auto p-8">
          <div className="mb-6">
            <Button
              variant="outline"
              className="border-emerald-600 text-emerald-600 hover:bg-emerald-50"
              onClick={() => navigate("/resident/requests/new")}
            >
              <ChevronLeft className="w-4 h-4 mr-2" />
              Back to chat
            </Button>
          </div>

          {/* Security Notice */}
          <div className="mb-8 bg-emerald-50 border border-emerald-200 rounded-lg p-4 flex items-start space-x-3">
            <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center flex-shrink-0">
              <Lock className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-emerald-900 font-medium mb-1">
                One of our core values is absolute safety.
              </p>
              <p className="text-emerald-700 text-sm">
                Both your digital and physical activity with us is secured and transparent. We utilize one of the
                most secure monitoring systems.
              </p>
            </div>
          </div>

          {/* Payment Summary Card */}
          <Card className="border-0 p-8 shadow-lg">
            <div className="mb-8">
              <h1 className="mb-2 text-3xl font-bold text-gray-900">Payment summary</h1>
              <p className="text-gray-600">This is a summary of your payments</p>
            </div>

            {/* Payment Items */}
            <div className="mb-8 space-y-6">
              {/* Consultancy */}
              <div className="flex flex-col gap-3 border-b border-gray-100 pb-6 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex min-w-0 items-start space-x-4">
                  <div className="relative">
                    <div className="w-6 h-6 rounded-full border-2 border-gray-900 flex items-center justify-center">
                      <div className="w-2 h-2 rounded-full bg-gray-900"></div>
                    </div>
                    <div className="absolute left-1/2 top-6 w-px h-12 bg-gray-300 -ml-px"></div>
                  </div>
                  <div>
                    <h3 className="mb-1 font-semibold text-gray-900">Consultancy</h3>
                    <p className="text-sm text-gray-600">This fee covers inspection and transportation</p>
                  </div>
                </div>
                <div className="text-left sm:text-right">
                  <p className="whitespace-nowrap text-xl font-semibold text-gray-900">{formatCurrency(consultancyFee)}</p>
                </div>
              </div>

              {/* Tax */}
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex min-w-0 items-start space-x-4">
                  <div className="relative">
                    <div className="w-6 h-6 rounded-full border-2 border-gray-900 flex items-center justify-center">
                      <div className="w-2 h-2 rounded-full bg-gray-900"></div>
                    </div>
                  </div>
                  <div>
                    <h3 className="mb-1 font-semibold text-gray-900">Tax</h3>
                    <p className="text-sm text-gray-600">This is a value added tax on the total</p>
                  </div>
                </div>
                <div className="text-left sm:text-right">
                  <p className="whitespace-nowrap text-xl font-semibold text-gray-900">
                    {formatCurrency(tax, { negative: true })}
                  </p>
                </div>
              </div>
            </div>
            {/* Decorative Wave Divider */}
            <div className="my-8">
              <svg width="100%" height="20" viewBox="0 0 800 20" fill="none" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none">
                <path d="M0 10 Q 20 0, 40 10 T 80 10 T 120 10 T 160 10 T 200 10 T 240 10 T 280 10 T 320 10 T 360 10 T 400 10 T 440 10 T 480 10 T 520 10 T 560 10 T 600 10 T 640 10 T 680 10 T 720 10 T 760 10 T 800 10" 
                      stroke="#E5E7EB" 
                      strokeWidth="2" 
                      fill="none"/>
              </svg>
            </div>

            {/* Total Section */}
            <div className="flex flex-col gap-6 pt-6 lg:flex-row lg:items-end lg:justify-between">
              <div className="min-w-0">
                <p className="mb-2 text-sm text-gray-600">TOTAL</p>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:gap-4">
                  <h2 className="whitespace-nowrap text-5xl font-bold text-gray-900">{formatCurrency(total)}</h2>
                  <div className="mb-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-gray-600">
                    <Info className="w-4 h-4" />
                    <span>Some rates might apply</span>
                    <Link href="/payment-policy">
                      <button className="font-medium text-emerald-600 hover:underline">Read Payment Policy</button>
                    </Link>
                  </div>
                </div>
              </div>

              <div className="flex flex-col items-start gap-3 lg:items-end">
                <Button
                  className="h-auto min-h-[52px] w-full whitespace-nowrap bg-emerald-600 px-8 py-3 text-lg font-semibold text-white hover:bg-emerald-700 sm:w-auto"
                  disabled={isPaying}
                  onClick={() => setShowPasswordDialog(true)}
                >
                  {isPaying ? "Processing..." : `Pay ${formatCurrency(total)}`}
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
                <p className="max-w-[540px] text-left text-xs text-gray-500 lg:text-right">
                  Charges are secured through Paystack. You will be redirected to complete payment.
                </p>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
    {/* Password confirmation dialog */}
    <Dialog open={showPasswordDialog} onOpenChange={setShowPasswordDialog}>
      <DialogContent>
        <div className="flex items-center justify-center mb-4">
          <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center">
            <Lock className="w-6 h-6 text-emerald-600" />
          </div>
        </div>
        <DialogHeader>
          <DialogTitle className="text-center text-2xl font-semibold">Please enter your password</DialogTitle>
          <DialogDescription className="text-center text-sm text-muted-foreground">Enter your password to proceed with payment</DialogDescription>
        </DialogHeader>

        <div className="mt-6">
          <label className="text-sm font-medium">Password</label>
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter your password"
            className="mt-2"
          />
        </div>

        <DialogFooter className="mt-6">
          <DialogClose asChild>
            <Button variant="outline" className="mr-2">Cancel</Button>
          </DialogClose>
          <Button
            onClick={async () => {
              if (!password) {
                toast({ title: "Password required", description: "Please enter your password to continue", variant: "destructive" });
                return;
              }
              setShowPasswordDialog(false);
              setPassword("");
              // proceed to initiate redirect payment
              await launchPayment();
            }}
          >
            Proceed with Payment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}



