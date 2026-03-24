import { useMemo, useState } from "react";
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
import { ProviderShell } from "@/components/provider/ProviderShell";
import { DisabledActionHint } from "@/components/provider/DisabledActionHint";
import {
  extractApiErrorMessage,
  getProviderStoreAccessState,
  getStoreApprovalBadgeLabel,
  type ProviderStoreAccessInput,
} from "@/lib/provider-store-access";
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
import { EmptyState, InlineErrorState, PageSkeleton } from "@/components/shared/page-states";
import { PROVIDER_ANALYTICS_EVENTS, trackEvent } from "@/lib/analytics";

type ProviderStore = ProviderStoreAccessInput & {
  id: string;
  name: string;
  description?: string;
  location: string;
  phone?: string;
  email?: string;
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
    staleTime: 60_000,
  });

  const storeAccess = useMemo(() => getProviderStoreAccessState(store), [store]);
  const canLoadStoreOperations = Boolean(storeId) && Boolean(store) && !storeAccess.operationsBlockedReason;
  const canLoadInventory = canLoadStoreOperations && activeTab === "inventory";

  // V2 orders
  const {
    data: storeOrders,
    isLoading: ordersLoading,
    error: ordersError,
  } = useStoreOrders(canLoadStoreOperations ? storeId : null, statusFilter || undefined);
  const {
    data: orderDetail,
    isLoading: detailLoading,
    error: orderDetailError,
  } = useStoreOrderDetail(canLoadStoreOperations ? storeId : null, selectedOrderId);
  const updateStatus = useUpdateStoreOrderStatus(storeId);

  // Inventory
  const {
    data: inventoryData,
    isLoading: inventoryLoading,
    error: inventoryError,
  } = useStoreInventory(canLoadInventory ? storeId : null);
  const updateInventory = useUpdateInventory(storeId);

  if (storeLoading) {
    return (
      <ProviderShell title="Store operations" subtitle="Loading store details.">
        <PageSkeleton rows={2} />
      </ProviderShell>
    );
  }

  if (!store) {
    return (
      <ProviderShell
        title="Store operations"
        subtitle="We could not find this store."
        actions={
          <Link href="/provider/stores">
            <a>
              <Button variant="outline">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to stores
              </Button>
            </a>
          </Link>
        }
      >
        <EmptyState
          icon={Package}
          title="Store not found"
          description="We could not locate this store. It may have been removed or you no longer have access."
        />
      </ProviderShell>
    );
  }

  const approvalLabel = getStoreApprovalBadgeLabel(store.approvalStatus);
  const orderActionBlockedReason = storeAccess.orderUpdateBlockedReason;
  const inventoryActionBlockedReason = storeAccess.inventoryUpdateBlockedReason;
  const tabNavigationBlockedReason = storeAccess.operationsBlockedReason;

  const handleStatusUpdate = (orderId: string, newStatus: string) => {
    if (orderActionBlockedReason) {
      trackEvent(PROVIDER_ANALYTICS_EVENTS.BLOCKED_ACTION, {
        action: "store_order_status_update",
        store_id: storeId || "unknown",
        section: "store_orders",
      });
      toast({ title: "Action blocked", description: orderActionBlockedReason, variant: "destructive" });
      return;
    }

    const sourceOrder =
      (Array.isArray(storeOrders) ? storeOrders.find((order: any) => order.id === orderId) : null) ||
      (orderDetail && orderDetail.id === orderId ? orderDetail : null);
    const previousStatus = String(sourceOrder?.status || "unknown");

    updateStatus.mutate(
      { orderId, status: newStatus },
      {
        onSuccess: () => {
          trackEvent(PROVIDER_ANALYTICS_EVENTS.ORDER_STATUS_CHANGED, {
            store_id: storeId || "unknown",
            order_id: orderId,
            from_status: previousStatus,
            to_status: newStatus,
          });
          toast({ title: "Status updated", description: `Order status changed to ${STATUS_CONFIG[newStatus]?.label || newStatus}` });
        },
        onError: (err: any) => {
          toast({
            title: "Error",
            description: extractApiErrorMessage(err, "Unable to update order status"),
            variant: "destructive",
          });
        },
      }
    );
  };

  return (
    <ProviderShell
      title={`${store.name} Operations`}
      subtitle={`${store.location} - ${storeAccess.roleLabel}`}
      actions={
        <Link href="/provider/stores">
          <a>
            <Button variant="outline">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to stores
            </Button>
          </a>
        </Link>
      }
    >
      <div className="space-y-8">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={storeAccess.isApproved ? "default" : "secondary"}>{approvalLabel}</Badge>
          <Badge variant="outline">{storeAccess.roleLabel}</Badge>
          <Badge variant={storeAccess.hasEstateAllocation ? "secondary" : "outline"}>
            {storeAccess.hasEstateAllocation
              ? `${storeAccess.estateAllocationCount} estate allocation${storeAccess.estateAllocationCount === 1 ? "" : "s"}`
              : "No estate allocation"}
          </Badge>
          {!storeAccess.canManageOrders && <Badge variant="outline">Orders: read-only</Badge>}
          {!storeAccess.canManageItems && <Badge variant="outline">Inventory: read-only</Badge>}
        </div>

        {storeAccess.operationsBlockedReason && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-700">
            {storeAccess.operationsBlockedReason}
          </div>
        )}
        {!storeAccess.operationsBlockedReason && !storeAccess.hasEstateAllocation && (
          <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-sm text-blue-700">
            No estate is currently allocated. You can track orders, but inventory expansion is blocked until allocation.
          </div>
        )}
        {!storeAccess.operationsBlockedReason && orderActionBlockedReason && (
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-700">
            {orderActionBlockedReason}
          </div>
        )}
        {!storeAccess.operationsBlockedReason && !orderActionBlockedReason && inventoryActionBlockedReason && (
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-700">
            {inventoryActionBlockedReason}
          </div>
        )}

        {/* Tabs */}
        <div className="mb-6 flex w-fit gap-1 rounded-lg bg-muted/50 p-1">
          <DisabledActionHint reason={tabNavigationBlockedReason} actionName="store_operations_tab_switch" metadata={{ store_id: storeId || "unknown", section: "store_operations" }}>
            <span>
              <button
                className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                  activeTab === "orders" ? "bg-white text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                } ${tabNavigationBlockedReason ? "cursor-not-allowed opacity-50" : ""}`}
                disabled={Boolean(tabNavigationBlockedReason)}
                onClick={() => setActiveTab("orders")}
              >
                <Package className="mr-1.5 inline h-4 w-4" />
                Orders
              </button>
            </span>
          </DisabledActionHint>
          <DisabledActionHint reason={tabNavigationBlockedReason} actionName="store_operations_tab_switch" metadata={{ store_id: storeId || "unknown", section: "store_operations" }}>
            <span>
              <button
                className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                  activeTab === "inventory" ? "bg-white text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                } ${tabNavigationBlockedReason ? "cursor-not-allowed opacity-50" : ""}`}
                disabled={Boolean(tabNavigationBlockedReason)}
                onClick={() => setActiveTab("inventory")}
              >
                <Boxes className="mr-1.5 inline h-4 w-4" />
                Inventory
              </button>
            </span>
          </DisabledActionHint>
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

                {orderDetailError ? (
                  <InlineErrorState
                    description={extractApiErrorMessage(orderDetailError, "Unable to load order details")}
                  />
                ) : null}

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
                          <DisabledActionHint key={action.status} reason={orderActionBlockedReason} actionName="store_order_action" metadata={{ store_id: storeId || "unknown", section: "store_orders", next_status: action.status }}>
                            <Button
                              variant={action.variant}
                              onClick={() => handleStatusUpdate(orderDetail.id, action.status)}
                              disabled={updateStatus.isPending || Boolean(orderActionBlockedReason)}
                            >
                              {updateStatus.isPending ? (
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              ) : null}
                              {action.label}
                            </Button>
                          </DisabledActionHint>
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
                  {ordersError ? (
                    <InlineErrorState
                      className="mb-4"
                      description={extractApiErrorMessage(ordersError, "Unable to load store orders")}
                    />
                  ) : null}
                  {!canLoadStoreOperations ? (
                    <EmptyState
                      icon={AlertTriangle}
                      title="Store operations blocked"
                      description="Store operations are currently blocked for this account."
                    />
                  ) : ordersLoading ? (
                    <PageSkeleton withHeader={false} rows={3} />
                  ) : !storeOrders || storeOrders.length === 0 ? (
                    <EmptyState
                      icon={Package}
                      title="No orders yet"
                      description="Orders will appear here when residents checkout."
                    />
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
              {inventoryError ? (
                <InlineErrorState
                  className="mb-4"
                  description={extractApiErrorMessage(inventoryError, "Unable to load inventory")}
                />
              ) : null}
              {!canLoadStoreOperations ? (
                <EmptyState
                  icon={AlertTriangle}
                  title="Inventory access blocked"
                  description="Inventory access is currently blocked for this store."
                />
              ) : inventoryLoading ? (
                <PageSkeleton withHeader={false} rows={3} />
              ) : !inventoryData || inventoryData.length === 0 ? (
                <EmptyState
                  icon={Boxes}
                  title="No inventory records"
                  description="Inventory will be tracked once products are managed."
                />
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
                          canEdit={!inventoryActionBlockedReason}
                          disabledReason={inventoryActionBlockedReason}
                          onSave={(productId, updates) => {
                            if (inventoryActionBlockedReason) {
                              trackEvent(PROVIDER_ANALYTICS_EVENTS.BLOCKED_ACTION, {
                                action: "store_inventory_update",
                                store_id: storeId || "unknown",
                                section: "store_operations",
                              });
                              toast({ title: "Action blocked", description: inventoryActionBlockedReason, variant: "destructive" });
                              return;
                            }
                            updateInventory.mutate(
                              { productId, ...updates },
                              {
                                onSuccess: () => toast({ title: "Inventory updated" }),
                                onError: (err: any) =>
                                  toast({
                                    title: "Error",
                                    description: extractApiErrorMessage(err, "Unable to update inventory"),
                                    variant: "destructive",
                                  }),
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
    </ProviderShell>
  );
}

function InventoryRow({
  row,
  canEdit,
  disabledReason,
  onSave,
}: {
  row: any;
  canEdit: boolean;
  disabledReason?: string | null;
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
            placeholder="-"
          />
        ) : (
          <span className="text-muted-foreground">{row.lowStockThreshold ?? "-"}</span>
        )}
      </td>
      <td className="px-4 py-3 text-center">
        {editing ? (
          <div className="flex items-center justify-center gap-1">
            <DisabledActionHint reason={disabledReason} actionName="store_inventory_edit" metadata={{ section: "store_inventory" }}>
              <Button
                size="sm"
                variant="default"
                disabled={!canEdit}
                onClick={() => {
                  if (!canEdit) return;
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
            </DisabledActionHint>
            <Button size="sm" variant="ghost" onClick={() => {
              setStockQty(row.stockQty);
              setThreshold(row.lowStockThreshold ?? "");
              setEditing(false);
            }}>
              Cancel
            </Button>
          </div>
        ) : (
          <DisabledActionHint reason={disabledReason} actionName="store_inventory_edit" metadata={{ section: "store_inventory" }}>
            <Button size="sm" variant="outline" disabled={!canEdit} onClick={() => setEditing(true)}>
              Edit
            </Button>
          </DisabledActionHint>
        )}
      </td>
    </tr>
  );
}
