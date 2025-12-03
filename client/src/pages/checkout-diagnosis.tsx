// client/src/pages/checkout-diagnosis.tsx
import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  ChevronLeft, 
  Home, 
  BarChart3, 
  Layers, 
  FileText, 
  Flag,
  Users,
  Settings,
  HelpCircle,
  Upload,
  Wrench,
  Clock,
  Shirt,
  MapPin,
  Lock,
  Info,
  ArrowRight
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
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
import { openPaystackCheckout } from "@/lib/paystack";

export default function CheckoutDiagnosis() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [isPaying, setIsPaying] = useState(false);
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [password, setPassword] = useState("");

  const consultancyFee = 4500;
  const tax = 2000;
  const total = consultancyFee + tax;

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
        },
      });

      // 2) initialize Paystack and get an authorization URL that will redirect the user
      const init = await residentFetch<{ authorization_url: string; reference: string }>(
        "/api/paystack/init",
        {
          method: "POST",
          json: {
            email: user?.email || "resident@example.com",
            amountInNaira: total,
            metadata: { residentId: user?.id, sessionReference: session.reference },
            reference: session.reference, // ensure Paystack uses our DB reference
            callbackUrl: window.location.origin + "/payment-confirmation",
          },
        }
      );

      // 3) redirect the browser to Paystack's hosted payment page
      if (init?.authorization_url) {
        window.location.href = init.authorization_url;
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
    <div className="flex h-screen bg-gray-50">
      {/* Primary Left Sidebar - Collapsible */}
      <div className="w-16 bg-emerald-700 flex flex-col items-center py-6 space-y-6">
        <div className="w-10 h-10 bg-yellow-400 rounded-lg flex items-center justify-center">
          <MapPin className="w-6 h-6 text-emerald-800" />
        </div>
        
        <nav className="flex-1 flex flex-col items-center space-y-4">
          <Link href="/resident">
            <button className="w-10 h-10 rounded-lg bg-emerald-600 flex items-center justify-center transition-colors">
              <Home className="w-5 h-5 text-white" />
            </button>
          </Link>
          <button className="w-10 h-10 rounded-lg hover:bg-emerald-600 flex items-center justify-center transition-colors">
            <BarChart3 className="w-5 h-5 text-white" />
          </button>
          <button className="w-10 h-10 rounded-lg hover:bg-emerald-600 flex items-center justify-center transition-colors">
            <Layers className="w-5 h-5 text-white" />
          </button>
          <button className="w-10 h-10 rounded-lg hover:bg-emerald-600 flex items-center justify-center transition-colors">
            <FileText className="w-5 h-5 text-white" />
          </button>
          <button className="w-10 h-10 rounded-lg hover:bg-emerald-600 flex items-center justify-center transition-colors">
            <Flag className="w-5 h-5 text-white" />
          </button>
          <button className="w-10 h-10 rounded-lg hover:bg-emerald-600 flex items-center justify-center transition-colors">
            <Users className="w-5 h-5 text-white" />
          </button>
        </nav>

        <div className="flex flex-col items-center space-y-4">
          <button className="w-10 h-10 rounded-lg hover:bg-emerald-600 flex items-center justify-center transition-colors">
            <Settings className="w-5 h-5 text-white" />
          </button>
          <button className="w-10 h-10 rounded-lg hover:bg-emerald-600 flex items-center justify-center transition-colors">
            <HelpCircle className="w-5 h-5 text-white" />
          </button>
          <div className="w-10 h-10 rounded-full bg-emerald-600 flex items-center justify-center">
            <span className="text-white text-sm font-semibold">OR</span>
          </div>
        </div>
      </div>

      {/* Secondary Left Navigation */}
      <div className="w-60 bg-emerald-800 text-white flex flex-col">
        <div className="p-4 border-b border-emerald-700">
          <Link href="/book-artisan">
            <button className="flex items-center text-white/80 hover:text-white transition-colors">
              <ChevronLeft className="w-5 h-5 mr-1" />
              <span className="text-sm">Book a Service</span>
            </button>
          </Link>
        </div>

        <nav className="flex-1 py-4">
          <Link href="/book-artisan">
            <button className="w-full px-4 py-3 flex items-center space-x-3 text-white hover:bg-emerald-700 transition-colors">
              <Wrench className="w-5 h-5" />
              <span>Service Categories</span>
              <Badge className="ml-auto bg-white text-emerald-800 text-xs">40</Badge>
            </button>
          </Link>
          
          <Link href="/book-artisan">
            <button className="w-full px-4 py-3 flex items-center space-x-3 bg-emerald-700 text-white">
              <Wrench className="w-5 h-5" />
              <span>Book Repairs</span>
            </button>
          </Link>

          <button className="w-full px-4 py-3 flex items-center space-x-3 text-white hover:bg-emerald-700 transition-colors">
            <Clock className="w-5 h-5" />
            <span>Schedule Maintenance</span>
          </button>

          <button className="w-full px-4 py-3 flex items-center space-x-3 text-white hover:bg-emerald-700 transition-colors">
            <Shirt className="w-5 h-5" />
            <span>Do your Laundry</span>
          </button>
        </nav>

        <div className="p-4 border-t border-emerald-700">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-full bg-emerald-600 flex items-center justify-center">
              <span className="text-white text-sm font-semibold">
                {user?.name?.charAt(0) || 'O'}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{user?.name || 'Olivia Rhye'}</p>
              <p className="text-xs text-white/60 truncate">{user?.email || 'olivia@untitledui.com'}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto p-8">
          {/* Back to Bookings Button */}
          <div className="mb-6">
            <Link href="/book-artisan">
              <Button variant="outline" className="border-emerald-600 text-emerald-600 hover:bg-emerald-50">
                <ChevronLeft className="w-4 h-4 mr-2" />
                Back to Bookings
              </Button>
            </Link>
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
                Both your digital and physical activity with us is secured and transparent. We utilize one of the most secure monitoring system
              </p>
            </div>
          </div>

          {/* Payment Summary Card */}
          <Card className="border-0 shadow-lg p-8">
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Payment summary</h1>
              <p className="text-gray-600">This is a summary of your payments</p>
            </div>

            {/* Payment Items */}
            <div className="space-y-6 mb-8">
              {/* Consultancy */}
              <div className="flex items-start justify-between pb-6 border-b border-gray-100">
                <div className="flex items-start space-x-4">
                  <div className="relative">
                    <div className="w-6 h-6 rounded-full border-2 border-gray-900 flex items-center justify-center">
                      <div className="w-2 h-2 rounded-full bg-gray-900"></div>
                    </div>
                    <div className="absolute left-1/2 top-6 w-px h-12 bg-gray-300 -ml-px"></div>
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-1">Consultancy</h3>
                    <p className="text-sm text-gray-600">This fee covers inspection and transportation</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xl font-semibold text-gray-900">₦ {consultancyFee.toLocaleString()}</p>
                </div>
              </div>

              {/* Tax */}
              <div className="flex items-start justify-between">
                <div className="flex items-start space-x-4">
                  <div className="relative">
                    <div className="w-6 h-6 rounded-full border-2 border-gray-900 flex items-center justify-center">
                      <div className="w-2 h-2 rounded-full bg-gray-900"></div>
                    </div>
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-1">Tax</h3>
                    <p className="text-sm text-gray-600">This is a value added tax on the total</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xl font-semibold text-gray-900">- ₦ {tax.toLocaleString()}</p>
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
            <div className="flex items-end justify-between pt-6">
              <div>
                <p className="text-sm text-gray-600 mb-2">TOTAL</p>
                <div className="flex items-baseline space-x-3">
                  <h2 className="text-5xl font-bold text-gray-900">₦ {total.toLocaleString()}</h2>
                  <div className="flex items-center space-x-2 text-sm text-gray-600 mb-2">
                    <Info className="w-4 h-4" />
                    <span>Some rates might apply</span>
                    <Link href="/payment-policy">
                      <button className="text-emerald-600 hover:underline">Read Payment Policy</button>
                    </Link>
                  </div>
                </div>
              </div>

              <div className="flex flex-col items-end gap-3">
                <Button
                  className="bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-6 text-lg font-semibold"
                  disabled={isPaying}
                  onClick={() => setShowPasswordDialog(true)}
                >
                  {isPaying ? "Processing..." : `Pay ₦ ${total.toLocaleString()}`}
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
                <p className="text-xs text-gray-500 text-right">
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
            placeholder="••••••••"
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
