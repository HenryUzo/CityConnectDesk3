import { useState } from "react";
import { useParams, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  useStoreOrders,
  useStoreOrderDetail,
  useUpdateStoreOrderStatus,
  useStoreInventory,
  useUpdateInventory,
  formatKobo,
} from "@/hooks/useCityMart";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft,
  Package,
  Loader2,
  Clock,
  CheckCircle2,
  XCircle,
  Truck,
  ChevronRight,
  Boxes,
  AlertTriangle,
  Save,
} from "lucide-react";

type ProviderStore = {
  id: string;
  name: string;
  description?: string;
  location: string;
  phone?: string;
  email?: string;
  membership?: { role?: string; canManageItems?: boolean; canManageOrders?: boolean };
  isActive?: boolean;
  approvalStatus?: string;
};

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  pending_acceptance: { label: "Pending", color: "bg-yellow-100 text-yellow-700", icon: Clock },
  accepted: { label: "Accepted", color: "bg-blue-100 text-blue-700", icon: CheckCircle2 },
  rejected: { label: "Rejected", color: "bg-red-100 text-red-700", icon: XCircle },
  packing: { label: "Packing", color: "bg-purple-100 text-purple-700", icon: Package },
  ready_for_dispatch: { label: "Ready", color: "bg-indigo-100 text-indigo-700", icon: Truck },
  dispatched: { label: "Dispatched", color: "bg-blue-100 text-blue-700", icon: Truck },
  delivered: { label: "Delivered", color: "bg-green-100 text-green-700", icon: CheckCircle2 },
  cancelled: { label: "Cancelled", color: "bg-gray-100 text-gray-600", icon: XCircle },
  refunded: { label: "Refunded", color: "bg-red-100 text-red-700", icon: XCircle },
};

const NEXT_ACTIONS: Record<string, { label: string; status: string; variant: "default" | "destructive" }[]> = {
  pending_acceptance: [
    { label: "Accept Order", status: "accepted", variant: "default" },
    { label: "Reject", status: "rejected", variant: "destructive" },
  ],
  accepted: [
    { label: "Start Packing", status: "packing", variant: "default" },
    { label: "Cancel", status: "cancelled", variant: "destructive" },
  ],
  packing: [
    { label: "Ready for Dispatch", status: "ready_for_dispatch", variant: "default" },
    { label: "Cancel", status: "cancelled", variant: "destructive" },
  ],
  ready_for_dispatch: [
    { label: "Dispatched", status: "dispatched", variant: "default" },
    { label: "Cancel", status: "cancelled", variant: "destructive" },
  ],
  dispatched: [
    { label: "Mark Delivered", status: "delivered", variant: "default" },
  ],
};

function StatusBadge({ status }: { status: string }) {
  const config = STATUS_CONFIG[status] || { label: status, color: "bg-gray-100 text-gray-600", icon: Clock };
  const Icon = config.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${config.color}`}>
      <Icon className="w-3 h-3" />
      {config.label}
    </span>
  );
}

export default function StoreOrdersDashboard() {
  const { storeId: rawStoreId } = useParams<{ storeId: string }>();
  const storeId = rawStoreId || "";
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<"orders" | "inventory">("orders");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  // Fetch store info
  const { data: store, isLoading: storeLoading } = useQuery<ProviderStore | null>({
    queryKey: ["/api/provider/stores", storeId],
    queryFn: async () => {
      const stores = await apiRequest("GET", "/api/provider/stores").then(
        (res) => res.json() as Promise<ProviderStore[]>
      );
      return stores.find((s) => s.id === storeId) || null;
    },
    enabled: !!storeId,
  });

  // V2 orders
  const { data: storeOrders, isLoading: ordersLoading } = useStoreOrders(storeId, statusFilter || undefined);
  const { data: orderDetail, isLoading: detailLoading } = useStoreOrderDetail(storeId, selectedOrderId);
  const updateStatus = useUpdateStoreOrderStatus(storeId);

  // Inventory
  const { data: inventoryData, isLoading: inventoryLoading } = useStoreInventory(activeTab === "inventory" ? storeId : null);
  const updateInventory = useUpdateInventory(storeId);

  if (storeLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#039855]" />
      </div>
    );
  }

  if (!store) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">Store not found</p>
          <Link href="/provider">
            <Button variant="outline"><ArrowLeft className="w-4 h-4 mr-2" />Back</Button>
          </Link>
        </div>
      </div>
    );
  }

  const handleStatusUpdate = (orderId: string, newStatus: string) => {
    updateStatus.mutate(
      { orderId, status: newStatus },
      {
        onSuccess: () => {
          toast({ title: "Status updated", description: `Order status changed to ${STATUS_CONFIG[newStatus]?.label || newStatus}` });
        },
        onError: (err: any) => {
          toast({ title: "Error", description: err.message, variant: "destructive" });
        },
      }
    );
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <nav className="bg-card shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-4">
              <Link href="/provider">
                <Button variant="ghost" size="sm">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back
                </Button>
              </Link>
              <span className="text-sm font-medium">{store.name}</span>
              <Badge variant="outline">{store.membership?.role || "member"}</Badge>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-muted/50 rounded-lg p-1 w-fit">
          <button
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === "orders" ? "bg-white shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => setActiveTab("orders")}
          >
            <Package className="w-4 h-4 inline mr-1.5" />
            Orders
          </button>
          <button
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === "inventory" ? "bg-white shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => setActiveTab("inventory")}
          >
            <Boxes className="w-4 h-4 inline mr-1.5" />
            Inventory
          </button>
        </div>

        {/* ── ORDERS TAB ── */}
        {activeTab === "orders" && (
          <>
            {selectedOrderId && orderDetail ? (
              /* Order detail view */
              <div className="space-y-6">
                <button
                  className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
                  onClick={() => setSelectedOrderId(null)}
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back to orders
                </button>

                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">
                        Order #{orderDetail.id?.slice(0, 8).toUpperCase()}
                      </CardTitle>
                      <StatusBadge status={orderDetail.status} />
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Resident info */}
                    {orderDetail.resident && (
                      <div className="bg-muted/50 rounded-lg p-4">
                        <p className="text-sm font-medium mb-1">Customer</p>
                        <p className="text-sm">{orderDetail.resident.fullName}</p>
                        {orderDetail.resident.phone && (
                          <p className="text-xs text-muted-foreground">{orderDetail.resident.phone}</p>
                        )}
                      </div>
                    )}

                    {/* Delivery address */}
                    {orderDetail.deliveryAddress && (
                      <div className="bg-muted/50 rounded-lg p-4">
                        <p className="text-sm font-medium mb-1">Delivery Address</p>
                        <p className="text-sm">{(orderDetail.deliveryAddress as any)?.addressLine}</p>
                        <p className="text-xs text-muted-foreground">{(orderDetail.deliveryAddress as any)?.phone}</p>
                      </div>
                    )}

                    {/* Note */}
                    {orderDetail.noteToStore && (
                      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                        <p className="text-sm font-medium mb-1">Note from customer</p>
                        <p className="text-sm">{orderDetail.noteToStore}</p>
                      </div>
                    )}

                    {/* Items table */}
                    <div className="border rounded-lg overflow-hidden">
                      <table className="min-w-full text-sm">
                        <thead className="bg-muted/40">
                          <tr>
                            <th className="px-4 py-2 text-left font-medium">Product</th>
                            <th className="px-4 py-2 text-center font-medium">Qty</th>
                            <th className="px-4 py-2 text-right font-medium">Unit Price</th>
                            <th className="px-4 py-2 text-right font-medium">Total</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {orderDetail.items?.map((item: any) => (
                            <tr key={item.id}>
                              <td className="px-4 py-2 flex items-center gap-2">
                                {item.productImages?.[0] ? (
                                  <img src={item.productImages[0]} className="w-8 h-8 rounded object-cover" alt="" />
                                ) : (
                                  <div className="w-8 h-8 rounded bg-gray-100 flex items-center justify-center">
                                    <Package className="w-4 h-4 text-gray-300" />
                                  </div>
                                )}
                                {item.productName}
                              </td>
                              <td className="px-4 py-2 text-center">{item.qty}</td>
                              <td className="px-4 py-2 text-right">{formatKobo(item.unitPrice)}</td>
                              <td className="px-4 py-2 text-right font-medium">{formatKobo(item.lineTotal)}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="bg-muted/40">
                            <td colSpan={3} className="px-4 py-2 text-right font-semibold">Subtotal</td>
                            <td className="px-4 py-2 text-right font-bold">{formatKobo(orderDetail.subtotalAmount)}</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>

                    {/* Action buttons */}
                    {NEXT_ACTIONS[orderDetail.status] && (
                      <div className="flex gap-2 pt-2">
                        {NEXT_ACTIONS[orderDetail.status].map((action) => (
                          <Button
                            key={action.status}
                            variant={action.variant}
                            onClick={() => handleStatusUpdate(orderDetail.id, action.status)}
                            disabled={updateStatus.isPending}
                          >
                            {updateStatus.isPending ? (
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            ) : null}
                            {action.label}
                          </Button>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            ) : (
              /* Orders list */
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>Store Orders</CardTitle>
                    {/* Status filter */}
                    <select
                      className="border rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#039855]"
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                    >
                      <option value="">All statuses</option>
                      {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                        <option key={key} value={key}>{cfg.label}</option>
                      ))}
                    </select>
                  </div>
                </CardHeader>
                <CardContent>
                  {ordersLoading ? (
                    <div className="flex justify-center py-12">
                      <Loader2 className="w-6 h-6 animate-spin text-[#039855]" />
                    </div>
                  ) : !storeOrders || storeOrders.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <Package className="w-16 h-16 mx-auto mb-4 opacity-50" />
                      <p className="font-medium">No orders yet</p>
                      <p className="text-sm mt-1">Orders will appear here when residents checkout</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {storeOrders.map((order: any) => (
                        <button
                          key={order.id}
                          className="w-full flex items-center gap-4 p-4 rounded-lg border hover:border-[#039855] transition-colors text-left"
                          onClick={() => setSelectedOrderId(order.id)}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <p className="text-sm font-medium">
                                #{order.id.slice(0, 8).toUpperCase()}
                              </p>
                              <StatusBadge status={order.status} />
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {order.residentName || "Customer"}
                            </p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {order.createdAt ? new Date(order.createdAt).toLocaleString() : ""}
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="font-bold text-sm">{formatKobo(order.subtotalAmount)}</p>
                            <p className="text-xs text-muted-foreground capitalize">
                              {order.deliveryMethod?.replace(/_/g, " ")}
                            </p>
                          </div>
                          <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
                        </button>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </>
        )}

        {/* ── INVENTORY TAB ── */}
        {activeTab === "inventory" && (
          <Card>
            <CardHeader>
              <CardTitle>Inventory</CardTitle>
            </CardHeader>
            <CardContent>
              {inventoryLoading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin text-[#039855]" />
                </div>
              ) : !inventoryData || inventoryData.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Boxes className="w-16 h-16 mx-auto mb-4 opacity-50" />
                  <p className="font-medium">No inventory records</p>
                  <p className="text-sm mt-1">Inventory will be tracked once products are managed</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-muted/40">
                      <tr>
                        <th className="px-4 py-3 text-left font-medium">Product</th>
                        <th className="px-4 py-3 text-center font-medium">Stock</th>
                        <th className="px-4 py-3 text-center font-medium">Reserved</th>
                        <th className="px-4 py-3 text-center font-medium">Available</th>
                        <th className="px-4 py-3 text-center font-medium">Threshold</th>
                        <th className="px-4 py-3 text-center font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {inventoryData.map((row: any) => (
                        <InventoryRow
                          key={row.id}
                          row={row}
                          storeId={storeId}
                          onSave={(productId, updates) => {
                            updateInventory.mutate(
                              { productId, ...updates },
                              {
                                onSuccess: () => toast({ title: "Inventory updated" }),
                                onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
                              }
                            );
                          }}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function InventoryRow({
  row,
  storeId,
  onSave,
}: {
  row: any;
  storeId: string;
  onSave: (productId: string, updates: { stockQty?: number; lowStockThreshold?: number | null }) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [stockQty, setStockQty] = useState(row.stockQty);
  const [threshold, setThreshold] = useState(row.lowStockThreshold ?? "");

  return (
    <tr className={row.isLowStock ? "bg-red-50" : ""}>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          {row.productImages?.[0] ? (
            <img src={row.productImages[0]} className="w-8 h-8 rounded object-cover" alt="" />
          ) : (
            <div className="w-8 h-8 rounded bg-gray-100 flex items-center justify-center">
              <Package className="w-4 h-4 text-gray-300" />
            </div>
          )}
          <div>
            <p className="font-medium text-sm">{row.productName}</p>
            {row.isLowStock && (
              <span className="text-xs text-red-600 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                Low stock
              </span>
            )}
          </div>
        </div>
      </td>
      <td className="px-4 py-3 text-center">
        {editing ? (
          <input
            type="number"
            value={stockQty}
            min={0}
            onChange={(e) => setStockQty(Number(e.target.value))}
            className="w-16 border rounded px-2 py-1 text-center text-sm"
          />
        ) : (
          <span className="font-medium">{row.stockQty}</span>
        )}
      </td>
      <td className="px-4 py-3 text-center text-muted-foreground">{row.reservedQty}</td>
      <td className="px-4 py-3 text-center">
        <span className={`font-semibold ${row.available <= 0 ? "text-red-600" : row.isLowStock ? "text-orange-600" : "text-green-600"}`}>
          {row.available}
        </span>
      </td>
      <td className="px-4 py-3 text-center">
        {editing ? (
          <input
            type="number"
            value={threshold}
            min={0}
            onChange={(e) => setThreshold(e.target.value === "" ? "" : Number(e.target.value))}
            className="w-16 border rounded px-2 py-1 text-center text-sm"
            placeholder="—"
          />
        ) : (
          <span className="text-muted-foreground">{row.lowStockThreshold ?? "—"}</span>
        )}
      </td>
      <td className="px-4 py-3 text-center">
        {editing ? (
          <div className="flex items-center justify-center gap-1">
            <Button
              size="sm"
              variant="default"
              onClick={() => {
                onSave(row.productId, {
                  stockQty,
                  lowStockThreshold: threshold === "" ? null : Number(threshold),
                });
                setEditing(false);
              }}
            >
              <Save className="w-3 h-3 mr-1" />
              Save
            </Button>
            <Button size="sm" variant="ghost" onClick={() => {
              setStockQty(row.stockQty);
              setThreshold(row.lowStockThreshold ?? "");
              setEditing(false);
            }}>
              Cancel
            </Button>
          </div>
        ) : (
          <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
            Edit
          </Button>
        )}
      </td>
    </tr>
  );
}
