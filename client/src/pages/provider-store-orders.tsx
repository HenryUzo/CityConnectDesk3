import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ProviderShell } from "@/components/provider/ProviderShell";
import {
  extractApiErrorMessage,
  getProviderStoreAccessState,
  getStoreApprovalBadgeLabel,
  type ProviderStoreAccessInput,
} from "@/lib/provider-store-access";
import { useParams, Link } from "wouter";
import { useMemo } from "react";
import { ArrowLeft, Package } from "lucide-react";
import { EmptyState, InlineErrorState, PageSkeleton } from "@/components/shared/page-states";

type ProviderStore = ProviderStoreAccessInput & {
  id: string;
  name: string;
  description?: string;
  location: string;
  phone?: string;
  email?: string;
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
    staleTime: 60_000,
  });

  const storeAccess = useMemo(() => getProviderStoreAccessState(store), [store]);
  const canQueryOrders = Boolean(storeId) && Boolean(store) && !storeAccess.orderUpdateBlockedReason;

  const {
    data: orders = [],
    isLoading: isLoadingOrders,
    error: ordersError,
  } = useQuery<StoreOrder[]>({
    queryKey: ["/api/provider/stores", storeId, "orders"],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/provider/stores/${storeId}/orders`);
      return res.json() as Promise<StoreOrder[]>;
    },
    enabled: canQueryOrders,
    staleTime: 10_000,
    refetchInterval: canQueryOrders ? 20_000 : false,
  });

  if (isLoadingStore) {
    return (
      <ProviderShell title="Store orders" subtitle="Loading store details.">
        <PageSkeleton rows={2} />
      </ProviderShell>
    );
  }

  if (!store) {
    return (
      <ProviderShell
        title="Store orders"
        subtitle="We could not find this store."
        actions={
          <Button asChild variant="outline">
            <Link href="/provider/stores">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to stores
            </Link>
          </Button>
        }
      >
        <EmptyState
          title="Store not found"
          description="We could not locate this store. It may have been removed or you no longer have access."
          icon={Package}
        />
      </ProviderShell>
    );
  }

  const approvalLabel = getStoreApprovalBadgeLabel(store.approvalStatus);

  return (
    <ProviderShell
      title={`${store.name} Orders`}
      subtitle={`${store.location} - ${storeAccess.roleLabel}`}
      actions={
        <Button asChild variant="outline">
          <Link href="/provider/stores">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to stores
          </Link>
        </Button>
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
        </div>

        {storeAccess.orderUpdateBlockedReason && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-700">
            {storeAccess.orderUpdateBlockedReason}
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Orders</CardTitle>
          </CardHeader>
          <CardContent>
            {ordersError ? (
              <InlineErrorState
                className="mb-4"
                description={extractApiErrorMessage(ordersError, "Unable to load orders")}
              />
            ) : null}
            {!canQueryOrders ? (
              <EmptyState
                icon={Package}
                title="Order access blocked"
                description="Order access is currently blocked for this store."
              />
            ) : isLoadingOrders ? (
              <PageSkeleton withHeader={false} rows={3} />
            ) : orders.length > 0 ? (
              <div className="overflow-hidden rounded-lg border border-border">
                <table className="min-w-full divide-y divide-border text-sm">
                  <caption className="sr-only">Store order list with customer, date, status, and total amount</caption>
                  <thead className="bg-muted/40">
                    <tr>
                      <th scope="col" className="px-4 py-3 text-left font-semibold text-muted-foreground">Order ID</th>
                      <th scope="col" className="px-4 py-3 text-left font-semibold text-muted-foreground">Customer</th>
                      <th scope="col" className="px-4 py-3 text-left font-semibold text-muted-foreground">Date</th>
                      <th scope="col" className="px-4 py-3 text-left font-semibold text-muted-foreground">Status</th>
                      <th scope="col" className="px-4 py-3 text-right font-semibold text-muted-foreground">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border bg-background">
                    {orders.map((order) => (
                      <tr key={order.id}>
                        <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{order.id}</td>
                        <td className="px-4 py-3">{order.buyerName || order.buyerId}</td>
                        <td className="px-4 py-3">
                          {order.createdAt ? new Date(order.createdAt).toLocaleDateString() : "-"}
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
              <EmptyState
                icon={Package}
                title="No orders yet"
                description="Orders for this store will appear here once residents place orders."
              />
            )}
          </CardContent>
        </Card>
      </div>
    </ProviderShell>
  );
}
