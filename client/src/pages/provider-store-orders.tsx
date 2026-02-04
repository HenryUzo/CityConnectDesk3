import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useParams, Link } from "wouter";
import { ArrowLeft, Package } from "lucide-react";

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

type StoreOrder = {
  id: string;
  buyerId: string;
  buyerName?: string | null;
  total: number | string;
  currency?: string | null;
  status?: string | null;
  createdAt?: string | null;
};

export default function ProviderStoreOrders() {
  const { storeId } = useParams<{ storeId: string }>();

  const { data: store, isLoading: isLoadingStore } = useQuery<ProviderStore | null>({
    queryKey: ["/api/provider/stores", storeId],
    queryFn: async () => {
      const stores = await apiRequest("GET", "/api/provider/stores").then(
        (res) => res.json() as Promise<ProviderStore[]>,
      );
      return stores.find((s: ProviderStore) => s.id === storeId) || null;
    },
    enabled: !!storeId,
  });

  const {
    data: orders = [],
    isLoading: isLoadingOrders,
    error: ordersError,
  } = useQuery<StoreOrder[]>({
    queryKey: ["/api/provider/stores", storeId, "orders"],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/provider/stores/${storeId}/orders`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.message || body?.error || "Unable to load orders");
      }
      return res.json() as Promise<StoreOrder[]>;
    },
    enabled: !!storeId,
  });

  if (isLoadingStore) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Loading store...</p>
      </div>
    );
  }

  if (!store) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">Store not found</p>
          <Link href="/provider">
            <Button variant="outline">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Dashboard
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const approvalStatus = (store.approvalStatus || "pending").toLowerCase();
  const isApproved = approvalStatus === "approved";
  const roleLabel =
    store.membership?.role === "owner"
      ? "Owner"
      : store.membership?.role === "manager"
        ? "Manager"
        : "Staff";

  return (
    <div className="min-h-screen bg-background">
      <nav className="bg-card shadow-sm border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <Link href="/provider">
                <Button variant="ghost" size="sm">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Dashboard
                </Button>
              </Link>
              <span className="ml-4 text-sm text-muted-foreground">
                Managing: {store.name}
              </span>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-foreground mb-2">
            {store.name} - Orders
          </h2>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-muted-foreground">{store.location}</p>
            <Badge variant={isApproved ? "default" : "secondary"}>
              {isApproved ? "Approved" : approvalStatus === "rejected" ? "Rejected" : "Pending Approval"}
            </Badge>
            <Badge variant="outline">{roleLabel}</Badge>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Orders</CardTitle>
          </CardHeader>
          <CardContent>
            {ordersError && (
              <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700">
                {(ordersError as Error).message}
              </div>
            )}
            {isLoadingOrders ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>Loading orders...</p>
              </div>
            ) : orders.length > 0 ? (
              <div className="overflow-hidden rounded-lg border border-border">
                <table className="min-w-full divide-y divide-border text-sm">
                  <thead className="bg-muted/40">
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Order ID</th>
                      <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Customer</th>
                      <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Date</th>
                      <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Status</th>
                      <th className="px-4 py-3 text-right font-semibold text-muted-foreground">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border bg-background">
                    {orders.map((order) => (
                      <tr key={order.id}>
                        <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                          {order.id}
                        </td>
                        <td className="px-4 py-3">
                          {order.buyerName || order.buyerId}
                        </td>
                        <td className="px-4 py-3">
                          {order.createdAt
                            ? new Date(order.createdAt).toLocaleDateString()
                            : "—"}
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant="outline">{order.status || "pending"}</Badge>
                        </td>
                        <td className="px-4 py-3 text-right">
                          {order.currency || "NGN"} {Number(order.total || 0).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <Package className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <h3 className="font-medium text-lg mb-2">No orders yet</h3>
                <p className="text-sm">Orders for this store will appear here.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
