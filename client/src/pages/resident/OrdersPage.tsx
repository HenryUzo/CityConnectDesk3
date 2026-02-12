import { useState } from "react";
import { useLocation } from "wouter";
import ResidentShell from "@/components/layout/ResidentShell";
import { useMyOrders, useOrderDetail, formatKobo } from "@/hooks/useCityMart";
import {
  ArrowLeft,
  Package,
  Loader2,
  Clock,
  CheckCircle2,
  XCircle,
  ChevronRight,
  Truck,
  Store,
} from "lucide-react";

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  pending_payment: { label: "Pending Payment", color: "bg-yellow-100 text-yellow-700", icon: Clock },
  paid: { label: "Paid", color: "bg-green-100 text-green-700", icon: CheckCircle2 },
  partially_refunded: { label: "Partially Refunded", color: "bg-orange-100 text-orange-700", icon: Clock },
  refunded: { label: "Refunded", color: "bg-red-100 text-red-700", icon: XCircle },
  cancelled: { label: "Cancelled", color: "bg-gray-100 text-gray-700", icon: XCircle },
  pending_acceptance: { label: "Pending Acceptance", color: "bg-yellow-100 text-yellow-700", icon: Clock },
  accepted: { label: "Accepted", color: "bg-blue-100 text-blue-700", icon: CheckCircle2 },
  rejected: { label: "Rejected", color: "bg-red-100 text-red-700", icon: XCircle },
  packing: { label: "Packing", color: "bg-purple-100 text-purple-700", icon: Package },
  ready_for_dispatch: { label: "Ready for Dispatch", color: "bg-indigo-100 text-indigo-700", icon: Truck },
  dispatched: { label: "Dispatched", color: "bg-blue-100 text-blue-700", icon: Truck },
  delivered: { label: "Delivered", color: "bg-green-100 text-green-700", icon: CheckCircle2 },
};

function StatusBadge({ status }: { status: string }) {
  const config = STATUS_CONFIG[status] || { label: status, color: "bg-gray-100 text-gray-600", icon: Clock };
  const Icon = config.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${config.color}`}>
      <Icon className="w-3 h-3" />
      {config.label}
    </span>
  );
}

export default function OrdersPage() {
  const [, navigate] = useLocation();
  const { data: orders, isLoading } = useMyOrders();
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const { data: orderDetail, isLoading: detailLoading } = useOrderDetail(selectedOrderId);

  return (
    <ResidentShell currentPage="marketplace">
      <div className="max-w-3xl mx-auto px-4 md:px-8 py-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <button
            className="p-2 rounded-full hover:bg-gray-100"
            onClick={() => {
              if (selectedOrderId) {
                setSelectedOrderId(null);
              } else {
                navigate("/resident/citymart");
              }
            }}
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-2xl font-bold">
            {selectedOrderId ? "Order Details" : "My Orders"}
          </h1>
        </div>

        {/* Order Detail View */}
        {selectedOrderId ? (
          detailLoading ? (
            <div className="flex justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-[#039855]" />
            </div>
          ) : !orderDetail ? (
            <p className="text-center text-gray-500 py-12">Order not found</p>
          ) : (
            <div className="space-y-6">
              {/* Parent order info */}
              <div className="bg-white rounded-xl border shadow-sm p-5">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm text-gray-500">
                    Order #{orderDetail.id.slice(0, 8).toUpperCase()}
                  </p>
                  <StatusBadge status={orderDetail.status} />
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Total</span>
                  <span className="font-bold text-lg text-[#039855]">
                    {formatKobo(orderDetail.totalAmount)}
                  </span>
                </div>
                <p className="text-xs text-gray-400 mt-2">
                  Placed {new Date(orderDetail.createdAt).toLocaleString()}
                </p>
              </div>

              {/* Store orders */}
              {orderDetail.storeOrders.map((so: any) => (
                <div key={so.id} className="bg-white rounded-xl border shadow-sm overflow-hidden">
                  {/* Store header */}
                  <div className="flex items-center gap-3 px-5 py-3 bg-gray-50 border-b">
                    {so.storeLogo ? (
                      <img src={so.storeLogo} className="w-8 h-8 rounded-full object-cover" alt="" />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-[#039855] flex items-center justify-center text-white text-xs font-bold">
                        <Store className="w-4 h-4" />
                      </div>
                    )}
                    <span className="font-semibold text-sm">{so.storeName}</span>
                    <div className="ml-auto">
                      <StatusBadge status={so.status} />
                    </div>
                  </div>

                  {/* Items */}
                  <div className="divide-y">
                    {so.items?.map((item: any) => (
                      <div key={item.id} className="flex gap-3 px-5 py-3">
                        {item.productImages?.[0] ? (
                          <img src={item.productImages[0]} className="w-14 h-14 rounded-md object-cover shrink-0" alt="" />
                        ) : (
                          <div className="w-14 h-14 rounded-md bg-gray-100 flex items-center justify-center shrink-0">
                            <Package className="w-6 h-6 text-gray-300" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{item.productName}</p>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {formatKobo(item.unitPrice)} x {item.qty}
                          </p>
                        </div>
                        <p className="text-sm font-semibold shrink-0">{formatKobo(item.lineTotal)}</p>
                      </div>
                    ))}
                  </div>

                  {/* Subtotal */}
                  <div className="flex justify-between px-5 py-3 bg-gray-50 border-t text-sm">
                    <span className="text-gray-500">Subtotal</span>
                    <span className="font-semibold">{formatKobo(so.subtotalAmount)}</span>
                  </div>
                </div>
              ))}
            </div>
          )
        ) : (
          /* Order List View */
          <>
            {isLoading ? (
              <div className="flex justify-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-[#039855]" />
              </div>
            ) : !orders || orders.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <Package className="w-20 h-20 text-gray-200 mb-4" />
                <p className="text-xl font-medium text-gray-600">No orders yet</p>
                <p className="text-gray-400 mt-2">Your orders will appear here after checkout</p>
                <button
                  className="mt-6 bg-[#039855] text-white px-6 py-3 rounded-lg font-semibold hover:bg-[#027a45]"
                  onClick={() => navigate("/resident/citymart")}
                >
                  Browse Marketplace
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {orders.map((order) => (
                  <button
                    key={order.id}
                    className="w-full bg-white rounded-xl border shadow-sm p-5 text-left hover:border-[#039855] transition-colors"
                    onClick={() => setSelectedOrderId(order.id)}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-medium text-gray-800">
                        Order #{order.id.slice(0, 8).toUpperCase()}
                      </p>
                      <ChevronRight className="w-4 h-4 text-gray-400" />
                    </div>
                    <div className="flex items-center justify-between mb-3">
                      <StatusBadge status={order.status} />
                      <span className="font-bold text-[#039855]">{formatKobo(order.totalAmount)}</span>
                    </div>
                    {/* Store order previews */}
                    <div className="flex flex-wrap gap-2 mt-2">
                      {order.storeOrders.map((so) => (
                        <span
                          key={so.id}
                          className="inline-flex items-center gap-1 text-xs bg-gray-100 rounded-full px-2.5 py-1"
                        >
                          <Store className="w-3 h-3" />
                          {so.storeName}
                          <span className="text-gray-400">·</span>
                          {STATUS_CONFIG[so.status]?.label || so.status}
                        </span>
                      ))}
                    </div>
                    <p className="text-xs text-gray-400 mt-3">
                      {new Date(order.createdAt).toLocaleDateString("en-NG", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </ResidentShell>
  );
}
