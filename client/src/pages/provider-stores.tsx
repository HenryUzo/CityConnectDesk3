import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ProviderShell } from "@/components/provider/ProviderShell";
import { DisabledActionHint } from "@/components/provider/DisabledActionHint";
import {
  getProviderStoreAccessState,
  getStoreApprovalBadgeLabel,
  type ProviderStoreAccessInput,
} from "@/lib/provider-store-access";
import { useLocation } from "wouter";
import { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { EmptyState, InlineErrorState, PageSkeleton } from "@/components/shared/page-states";
import { ProviderFilterActionBar } from "@/components/provider/provider-primitives";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Home,
  MapPin,
  Package,
  ShieldCheck,
} from "lucide-react";

type ProviderStore = ProviderStoreAccessInput & {
  id: string;
  name: string;
  description?: string;
  location: string;
  phone?: string;
  email?: string;
  itemCount?: number;
  createdAt?: string;
  hasEstateAllocation?: boolean;
};

export default function ProviderStores() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");

  const {
    data: stores = [],
    isLoading,
    error: storesError,
  } = useQuery<ProviderStore[]>({
    queryKey: ["provider-stores", user?.id],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/provider/stores");
      return res.json() as Promise<ProviderStore[]>;
    },
    enabled: !!user?.id,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  const filteredStores = useMemo(
    () =>
      stores.filter(
        (store) =>
          store.name.toLowerCase().includes(search.toLowerCase()) ||
          store.location.toLowerCase().includes(search.toLowerCase()),
      ),
    [stores, search],
  );

  const blockedSummary = useMemo(() => {
    return filteredStores.reduce(
      (acc, store) => {
        const access = getProviderStoreAccessState(store);
        if (access.isPendingApproval) acc.pending += 1;
        if (access.isRejected) acc.rejected += 1;
        if (!access.hasEstateAllocation) acc.noEstate += 1;
        return acc;
      },
      { pending: 0, rejected: 0, noEstate: 0 },
    );
  }, [filteredStores]);

  return (
    <ProviderShell
      title="My Stores"
      subtitle="Manage your store approvals, estate allocation, inventory, and order operations"
      actions={<Badge variant="secondary">{filteredStores.length} store(s)</Badge>}
    >
      <div className="space-y-6">
        <ProviderFilterActionBar
          leading={
            <div className="w-full sm:w-[320px]">
              <Input
                placeholder="Search by store name or location..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full"
                aria-label="Search provider stores"
              />
            </div>
          }
          trailing={<Badge variant="secondary">{filteredStores.length} store(s)</Badge>}
        />

        {(blockedSummary.pending > 0 || blockedSummary.rejected > 0 || blockedSummary.noEstate > 0) && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <div className="flex flex-wrap items-center gap-3">
              {blockedSummary.pending > 0 && <span>{blockedSummary.pending} awaiting approval</span>}
              {blockedSummary.rejected > 0 && <span>{blockedSummary.rejected} rejected</span>}
              {blockedSummary.noEstate > 0 && <span>{blockedSummary.noEstate} missing estate allocation</span>}
            </div>
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Your Stores</CardTitle>
          </CardHeader>
          <CardContent>
            {storesError ? (
              <InlineErrorState
                description={storesError instanceof Error ? storesError.message : "Unable to load stores."}
              />
            ) : isLoading ? (
              <PageSkeleton withHeader={false} rows={3} />
            ) : filteredStores.length === 0 ? (
              <EmptyState
                icon={Home}
                title={search ? "No stores match your search" : "No stores found"}
                description={
                  search
                    ? "Try adjusting your store name or location search."
                    : "You have not created any stores yet."
                }
              />
            ) : (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {filteredStores.map((store) => {
                  const access = getProviderStoreAccessState(store);
                  const storeLockedReason = access.operationsBlockedReason;
                  const itemsPageBlockedReason = storeLockedReason;
                  const ordersPageBlockedReason = access.orderUpdateBlockedReason;
                  const dashboardBlockedReason =
                    storeLockedReason ||
                    (!access.canManageItems && !access.canManageOrders
                      ? "Your role has read-only access for this store."
                      : null);
                  const approvalLabel = getStoreApprovalBadgeLabel(store.approvalStatus);

                  return (
                    <Card key={store.id} className="transition-shadow hover:shadow-lg">
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <CardTitle className="truncate text-lg">{store.name}</CardTitle>
                            <div className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
                              <MapPin className="h-4 w-4" />
                              <span className="truncate">{store.location}</span>
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-2">
                            <Badge variant={access.isApproved ? "default" : "secondary"}>
                              {approvalLabel}
                            </Badge>
                            <Badge variant="outline">{access.roleLabel}</Badge>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                          <Badge variant={access.canManageItems ? "secondary" : "outline"}>
                            {access.canManageItems ? "Can manage inventory" : "Inventory read-only"}
                          </Badge>
                          <Badge variant={access.canManageOrders ? "secondary" : "outline"}>
                            {access.canManageOrders ? "Can manage orders" : "Orders read-only"}
                          </Badge>
                        </div>

                        <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                          <div className="flex items-center gap-2 font-medium text-foreground">
                            {access.hasEstateAllocation ? (
                              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                            ) : (
                              <AlertTriangle className="h-4 w-4 text-amber-600" />
                            )}
                            {access.hasEstateAllocation
                              ? `${access.estateAllocationCount} estate allocation${access.estateAllocationCount === 1 ? "" : "s"}`
                              : "No estate allocation yet"}
                          </div>
                          <p className="mt-1 truncate text-muted-foreground">
                            {access.estateNames.length > 0
                              ? access.estateNames.join(", ")
                              : "Admin allocation required before new products can be published."}
                          </p>
                        </div>

                        {store.description && (
                          <p className="text-sm text-muted-foreground line-clamp-2">{store.description}</p>
                        )}

                        <div className="flex items-center gap-2 text-sm">
                          <Package className="h-4 w-4 text-primary" />
                          <span>
                            {store.itemCount || 0} item{(store.itemCount || 0) !== 1 ? "s" : ""}
                          </span>
                        </div>

                        {storeLockedReason && (
                          <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                            {storeLockedReason}
                          </div>
                        )}

                        <div className="space-y-2">
                          <DisabledActionHint reason={itemsPageBlockedReason} actionName="stores_manage_inventory" metadata={{ store_id: store.id, section: "stores" }}>
                            <Button
                              className="w-full"
                              variant="default"
                              disabled={Boolean(itemsPageBlockedReason)}
                              onClick={() => setLocation(`/provider/stores/${store.id}/items`)}
                            >
                              {access.canManageItems ? "Manage inventory" : "View inventory"}
                              <ArrowRight className="ml-2 h-4 w-4" />
                            </Button>
                          </DisabledActionHint>

                          <DisabledActionHint reason={ordersPageBlockedReason} actionName="stores_manage_orders" metadata={{ store_id: store.id, section: "stores" }}>
                            <Button
                              className="w-full"
                              variant="outline"
                              disabled={Boolean(ordersPageBlockedReason)}
                              onClick={() => setLocation(`/provider/stores/${store.id}/orders`)}
                            >
                              {access.canManageOrders ? "Manage orders" : "View orders"}
                            </Button>
                          </DisabledActionHint>

                          <DisabledActionHint reason={dashboardBlockedReason} actionName="stores_open_operations" metadata={{ store_id: store.id, section: "stores" }}>
                            <Button
                              className="w-full"
                              variant="outline"
                              disabled={Boolean(dashboardBlockedReason)}
                              onClick={() => setLocation(`/provider/stores/${store.id}/dashboard`)}
                            >
                              <ShieldCheck className="mr-2 h-4 w-4" />
                              Store operations
                            </Button>
                          </DisabledActionHint>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </ProviderShell>
  );
}
