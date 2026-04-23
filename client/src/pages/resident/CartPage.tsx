import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import ResidentShell from "@/components/layout/ResidentShell";
import {
  useCart,
  useUpdateCartItem,
  useRemoveCartItem,
  useCheckout,
  useEstates,
  formatKobo,
} from "@/hooks/useCityMart";
import { useToast } from "@/hooks/use-toast";
import { residentFetch } from "@/lib/residentApi";
import PaystackRedirectDialog from "@/components/resident/PaystackRedirectDialog";
import {
  ArrowLeft,
  ShoppingCart,
  Minus,
  Plus,
  Trash2,
  Package,
  Loader2,
  MapPin,
  Phone,
  Truck,
  CreditCard,
} from "lucide-react";

export default function CartPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { data: cartData, isLoading } = useCart();
  const { data: estatesData } = useEstates();
  const updateCartItem = useUpdateCartItem();
  const removeCartItem = useRemoveCartItem();
  const checkout = useCheckout();

  const estates = estatesData ?? [];

  // Checkout form
  const [addressLine, setAddressLine] = useState("");
  const [phone, setPhone] = useState("");
  const [deliveryMethod, setDeliveryMethod] = useState<"pickup" | "store_delivery" | "cityconnect_rider">("pickup");
  const [noteToStore, setNoteToStore] = useState("");
  const [showCheckoutForm, setShowCheckoutForm] = useState(false);
  const [selectedEstateId, setSelectedEstateId] = useState<string | null>(null);
  const [paymentInitializing, setPaymentInitializing] = useState(false);
  const [paymentReference, setPaymentReference] = useState<string | null>(null);
  const [deliveryDetails, setDeliveryDetails] = useState<any>(null);
  const [paystackRedirectUrl, setPaystackRedirectUrl] = useState<string | null>(null);
  const [showPaystackRedirectModal, setShowPaystackRedirectModal] = useState(false);

  const handleInitiatePayment = async () => {
    console.log("Payment button clicked", { cartData, addressLine, phone, estates });
    
    if (!cartData || cartData.storeGroups.length === 0) {
      toast({ title: "Cart error", description: "Your cart is empty", variant: "destructive" });
      return;
    }

    if (!addressLine.trim() || !phone.trim()) {
      toast({ title: "Missing info", description: "Please enter a delivery address and phone number", variant: "destructive" });
      return;
    }

    if (estates.length === 0) {
      toast({ title: "Error", description: "No estate found. Please contact support.", variant: "destructive" });
      return;
    }

    // Save delivery details for later
    const estateId = selectedEstateId || estates[0].id;
    const deliveryDetailsData = {
      estateId,
      addressLine: addressLine.trim(),
      phone: phone.trim(),
      deliveryMethod,
      noteToStore: noteToStore.trim() || undefined,
    };
    setDeliveryDetails(deliveryDetailsData);
    
    // IMPORTANT: Save to localStorage so it survives page reload after Paystack redirect
    sessionStorage.setItem("marketplace_delivery_details", JSON.stringify(deliveryDetailsData));

    // Initiate payment
    setPaymentInitializing(true);
    try {
      const amountInNaira = Math.ceil(cartData.totalAmount / 100);
      console.log("Initiating payment with amount:", amountInNaira);

      const res = await residentFetch<{
        reference?: string;
        authorizationUrl?: string;
        authorization_url?: string;
        error?: string;
        message?: string;
      }>("/api/paystack/init", {
        method: "POST",
        json: {
          amountInNaira,
          metadata: {
            cartTotal: cartData.totalAmount,
            deliveryAddress: addressLine.trim(),
            phone: phone.trim(),
          },
          callbackUrl: `${window.location.origin}/payment-confirmation?orderType=marketplace`,
        },
      });

      console.log("Payment response:", res);

      if (res?.reference) {
        setPaymentReference(res.reference);
        // Redirect to Paystack payment page if authorizationUrl is provided
        const authorizationUrl = res.authorizationUrl || res.authorization_url;
        if (authorizationUrl) {
          console.log("Redirecting to Paystack:", authorizationUrl);
          setPaystackRedirectUrl(authorizationUrl);
          setShowPaystackRedirectModal(true);
        } else {
          toast({ title: "Payment initiated", description: "Preparing payment page. Please wait...", variant: "default" });
        }
      } else {
        console.error("Invalid response:", res);
        const errorMsg = res?.error || res?.message || "Could not initiate payment";
        toast({ title: "Payment error", description: errorMsg, variant: "destructive" });
      }
    } catch (err: any) {
      console.error("Payment error caught:", err);
      toast({ title: "Payment error", description: err?.message || "Could not initiate payment", variant: "destructive" });
    } finally {
      setPaymentInitializing(false);
    }
  };

  // Handle payment confirmation (when returning from Paystack)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const reference = params.get("paymentReference");
    const orderType = params.get("orderType");

    if (reference && orderType === "marketplace") {
      // Restore delivery details from sessionStorage if not in state
      let finalDeliveryDetails = deliveryDetails;
      
      if (!finalDeliveryDetails) {
        const stored = sessionStorage.getItem("marketplace_delivery_details");
        if (stored) {
          try {
            finalDeliveryDetails = JSON.parse(stored);
            setDeliveryDetails(finalDeliveryDetails);
          } catch (e) {
            console.error("Failed to restore delivery details:", e);
          }
        }
      }

      if (finalDeliveryDetails) {
        // Payment confirmed, proceed with checkout
        checkout.mutate(
          {
            deliveryAddress: {
              estateId: finalDeliveryDetails.estateId,
              addressLine: finalDeliveryDetails.addressLine,
              phone: finalDeliveryDetails.phone,
            },
            deliveryMethod: finalDeliveryDetails.deliveryMethod,
            noteToStore: finalDeliveryDetails.noteToStore,
            paymentReference: reference, // Pass payment reference to verify payment
          },
          {
            onSuccess: (data) => {
              toast({ title: "🎉 Order placed!", description: `Order #${data.parentOrder.id.slice(0, 8)} created successfully` });
              // Clean up URL and storage
              window.history.replaceState({}, document.title, "/resident/citymart/cart");
              sessionStorage.removeItem("marketplace_delivery_details");
              // Redirect to orders page
              setTimeout(() => {
                navigate("/resident/citymart/orders");
              }, 1500);
            },
            onError: (err: any) => {
              toast({ title: "Checkout failed", description: err.message, variant: "destructive" });
            },
          }
        );
      } else {
        console.error("No delivery details found for checkout");
        toast({ title: "Error", description: "Delivery details not found. Please try again.", variant: "destructive" });
      }
    }
  }, [checkout, deliveryDetails, toast, navigate]);

  const handleCheckout = () => {
    if (!addressLine.trim() || !phone.trim()) {
      toast({ title: "Missing info", description: "Please enter a delivery address and phone number", variant: "destructive" });
      return;
    }

    if (estates.length === 0) {
      toast({ title: "Error", description: "No estate found. Please contact support.", variant: "destructive" });
      return;
    }

    // Use selected estate or first estate
    const estateId = selectedEstateId || estates[0].id;

    checkout.mutate(
      {
        deliveryAddress: {
          estateId,
          addressLine: addressLine.trim(),
          phone: phone.trim(),
        },
        deliveryMethod,
        noteToStore: noteToStore.trim() || undefined,
      },
      {
        onSuccess: (data) => {
          toast({ title: "Order placed!", description: `Order #${data.parentOrder.id.slice(0, 8)} created successfully` });
          navigate("/resident/citymart/orders");
        },
        onError: (err: any) => {
          toast({ title: "Checkout failed", description: err.message, variant: "destructive" });
        },
      }
    );
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
            setPaymentInitializing(false);
          }
        }}
      />
      <ResidentShell currentPage="marketplace">
      <div className="max-w-3xl mx-auto px-4 md:px-8 py-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <button
            className="p-2 rounded-full hover:bg-gray-100"
            onClick={() => navigate("/resident/citymart")}
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ShoppingCart className="w-6 h-6" />
            Your Cart
          </h1>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-[#039855]" />
          </div>
        ) : !cartData || cartData.storeGroups.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <ShoppingCart className="w-20 h-20 text-gray-200 mb-4" />
            <p className="text-xl font-medium text-gray-600">Your cart is empty</p>
            <p className="text-gray-400 mt-2">Browse the marketplace and add items</p>
            <button
              className="mt-6 bg-[#039855] text-white px-6 py-3 rounded-lg font-semibold hover:bg-[#027a45]"
              onClick={() => navigate("/resident/citymart")}
            >
              Continue Shopping
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Cart items grouped by store */}
            {cartData.storeGroups.map((group) => (
              <div key={group.storeId} className="bg-white rounded-xl border shadow-sm">
                {/* Store header */}
                <div className="flex items-center gap-3 px-5 py-3 border-b bg-gray-50 rounded-t-xl">
                  <div className="w-8 h-8 rounded-full bg-[#039855] flex items-center justify-center text-white text-sm font-bold">
                    {group.storeName.charAt(0)}
                  </div>
                  <span className="font-semibold text-gray-800">{group.storeName}</span>
                  <span className="text-xs text-gray-400 ml-auto">
                    {group.items.length} item{group.items.length !== 1 ? "s" : ""}
                  </span>
                </div>

                {/* Items */}
                <div className="divide-y">
                  {group.items.map((item) => (
                    <div key={item.id} className="flex gap-4 px-5 py-4">
                      {item.productImages?.[0] ? (
                        <img
                          src={item.productImages[0]}
                          alt={item.productName}
                          className="w-20 h-20 rounded-lg object-cover shrink-0"
                        />
                      ) : (
                        <div className="w-20 h-20 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                          <Package className="w-8 h-8 text-gray-300" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{item.productName}</p>
                        <p className="text-[#039855] font-semibold mt-1">
                          {formatKobo(item.unitPrice)}
                        </p>
                        <div className="flex items-center gap-3 mt-3">
                          <button
                            className="w-8 h-8 rounded-full border flex items-center justify-center hover:bg-gray-100"
                            onClick={() =>
                              item.qty <= 1
                                ? removeCartItem.mutate(item.id)
                                : updateCartItem.mutate({ id: item.id, qty: item.qty - 1 })
                            }
                          >
                            {item.qty <= 1 ? (
                              <Trash2 className="w-4 h-4 text-red-500" />
                            ) : (
                              <Minus className="w-4 h-4" />
                            )}
                          </button>
                          <span className="font-semibold text-sm w-8 text-center">{item.qty}</span>
                          <button
                            className="w-8 h-8 rounded-full border flex items-center justify-center hover:bg-gray-100"
                            onClick={() => updateCartItem.mutate({ id: item.id, qty: item.qty + 1 })}
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-bold text-sm">{formatKobo(item.unitPrice * item.qty)}</p>
                        <button
                          className="mt-2 text-gray-400 hover:text-red-500"
                          onClick={() => removeCartItem.mutate(item.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {/* Order summary */}
            <div className="bg-white rounded-xl border shadow-sm p-5">
              <h3 className="font-semibold mb-4">Order Summary</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">
                    Subtotal ({cartData.totalItems} item{cartData.totalItems !== 1 ? "s" : ""})
                  </span>
                  <span className="font-medium">{formatKobo(cartData.totalAmount)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Delivery Fee</span>
                  <span className="font-medium text-[#039855]">Free</span>
                </div>
                <div className="border-t pt-2 mt-2 flex justify-between text-base">
                  <span className="font-bold">Total</span>
                  <span className="font-bold text-[#039855]">{formatKobo(cartData.totalAmount)}</span>
                </div>
              </div>
            </div>

            {/* Checkout form */}
            {!showCheckoutForm ? (
              <button
                className="w-full bg-[#039855] text-white py-3.5 rounded-lg font-semibold text-base hover:bg-[#027a45] transition-colors"
                onClick={() => setShowCheckoutForm(true)}
              >
                Proceed to Checkout
              </button>
            ) : (
              <div className="bg-white rounded-xl border shadow-sm p-5 space-y-4">
                <h3 className="font-semibold text-lg">Delivery Details</h3>

                {estates.length > 1 && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Select Estate
                    </label>
                    <select
                      value={selectedEstateId || estates[0].id}
                      onChange={(e) => setSelectedEstateId(e.target.value)}
                      className="w-full border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#039855]"
                    >
                      {estates.map((estate: any) => (
                        <option key={estate.id} value={estate.id}>
                          {estate.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <MapPin className="w-4 h-4 inline mr-1" />
                    Delivery Address
                  </label>
                  <input
                    type="text"
                    value={addressLine}
                    onChange={(e) => setAddressLine(e.target.value)}
                    className="w-full border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#039855]"
                    placeholder="Enter your delivery address"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <Phone className="w-4 h-4 inline mr-1" />
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#039855]"
                    placeholder="e.g. 08012345678"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <Truck className="w-4 h-4 inline mr-1" />
                    Delivery Method
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {(
                      [
                        { value: "pickup" as const, label: "Pickup" },
                        { value: "store_delivery" as const, label: "Store Delivery" },
                        { value: "cityconnect_rider" as const, label: "CityConnect Rider" },
                      ] as const
                    ).map((opt) => (
                      <button
                        key={opt.value}
                        className={`py-2 px-3 rounded-lg border text-sm font-medium transition-colors ${
                          deliveryMethod === opt.value
                            ? "bg-[#039855] text-white border-[#039855]"
                            : "bg-white text-gray-700 hover:border-[#039855]"
                        }`}
                        onClick={() => setDeliveryMethod(opt.value)}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Note to Store (optional)
                  </label>
                  <textarea
                    value={noteToStore}
                    onChange={(e) => setNoteToStore(e.target.value)}
                    className="w-full border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#039855] resize-none"
                    rows={2}
                    placeholder="Any special instructions..."
                  />
                </div>

                <button
                  className="w-full bg-[#039855] text-white py-3.5 rounded-lg font-semibold text-base hover:bg-[#027a45] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  onClick={handleInitiatePayment}
                  disabled={paymentInitializing || checkout.isPending}
                >
                  {paymentInitializing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Processing Payment...
                    </>
                  ) : (
                    <>
                      <CreditCard className="w-4 h-4" />
                      Pay · {formatKobo(cartData.totalAmount)}
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
      </ResidentShell>
    </>
  );
}
