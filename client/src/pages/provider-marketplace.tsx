import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { ProviderShell } from "@/components/provider/ProviderShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, Package, Store, Layers3, ArrowRight, DollarSign } from "lucide-react";
import { EmptyState, InlineErrorState, PageSkeleton } from "@/components/shared/page-states";
import { ProviderFilterActionBar } from "@/components/provider/provider-primitives";

type ProviderMarketplaceStore = {
  id: string;
  name: string;
  location?: string | null;
  logo?: string | null;
};

type ProviderMarketplaceCategory = {
  id: string;
  name: string;
  slug?: string | null;
};

type ProviderMarketplaceItem = {
  id: string;
  name: string;
  description?: string | null;
  price: string | number;
  currency?: string | null;
  unitOfMeasure?: string | null;
  category?: string | null;
  subcategory?: string | null;
  stock?: number | null;
  images?: string[] | null;
  storeId?: string | null;
  storeName?: string | null;
  storeLocation?: string | null;
};

type ProviderMarketplaceItemsResponse = {
  items: ProviderMarketplaceItem[];
  total: number;
  page: number;
  totalPages: number;
};

const parsePrice = (value: string | number | undefined | null) => {
  if (typeof value === "number") return value;
  const parsed = Number.parseFloat(String(value ?? "0"));
  return Number.isFinite(parsed) ? parsed : 0;
};

export default function ProviderMarketplace() {
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("name");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedStoreId, setSelectedStoreId] = useState("all");

  const { data: stores = [] } = useQuery<ProviderMarketplaceStore[]>({
    queryKey: ["provider-marketplace-stores"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/provider/marketplace/stores");
      return res.json() as Promise<ProviderMarketplaceStore[]>;
    },
    staleTime: 60_000,
    refetchInterval: 120_000,
  });

  const { data: categories = [] } = useQuery<ProviderMarketplaceCategory[]>({
    queryKey: ["provider-marketplace-categories"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/provider/marketplace/categories");
      return res.json() as Promise<ProviderMarketplaceCategory[]>;
    },
    staleTime: 60_000,
    refetchInterval: 120_000,
  });

  const {
    data: itemsResponse,
    isLoading,
    error: itemsError,
  } = useQuery<ProviderMarketplaceItemsResponse>({
    queryKey: ["provider-marketplace-items", { search, selectedCategory, selectedStoreId }],
    placeholderData: (prev) => prev,
    queryFn: async () => {
      const qs = new URLSearchParams();
      if (search.trim()) qs.set("search", search.trim());
      if (selectedCategory !== "all") qs.set("category", selectedCategory);
      if (selectedStoreId !== "all") qs.set("storeId", selectedStoreId);

      const query = qs.toString();
      const url = query
        ? `/api/provider/marketplace/items?${query}`
        : "/api/provider/marketplace/items";

      const res = await apiRequest("GET", url);
      return res.json() as Promise<ProviderMarketplaceItemsResponse>;
    },
    staleTime: 30_000,
    refetchInterval: search.trim() || selectedCategory !== "all" || selectedStoreId !== "all" ? false : 90_000,
  });

  const sortedItems = useMemo(() => {
    const base = [...(itemsResponse?.items ?? [])];
    base.sort((a, b) => {
      switch (sortBy) {
        case "price-low":
          return parsePrice(a.price) - parsePrice(b.price);
        case "price-high":
          return parsePrice(b.price) - parsePrice(a.price);
        case "stock":
          return Number(b.stock ?? 0) - Number(a.stock ?? 0);
        case "name":
        default:
          return a.name.localeCompare(b.name);
      }
    });
    return base;
  }, [itemsResponse?.items, sortBy]);

  return (
    <ProviderShell
      title="Marketplace"
      subtitle="Read-only catalog browsing. Inventory and pricing changes happen in your Stores workspace."
      actions={<Badge variant="secondary">{itemsResponse?.total ?? 0} items</Badge>}
    >
      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Layers3 className="h-4 w-4 text-muted-foreground" />
                Catalog browsing
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 text-sm text-muted-foreground">
              Use this page to monitor live marketplace listings from approved stores.
              This view is read-only for providers.
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Store className="h-4 w-4 text-muted-foreground" />
                Store operations
              </CardTitle>
            </CardHeader>
            <CardContent className="flex items-center justify-between gap-4 pt-0 text-sm text-muted-foreground">
              <span>Manage your inventory, pricing, and orders in the Stores workspace.</span>
              <Button asChild variant="outline" className="whitespace-nowrap">
                <Link href="/provider/stores">
                  Go to stores
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>

        <ProviderFilterActionBar
          leading={
            <div className="relative w-full sm:w-[260px]">
              <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search catalog"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
                aria-label="Search marketplace catalog"
              />
            </div>
          }
          trailing={
            <>
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger aria-label="Filter marketplace by category" className="w-full sm:w-[190px]">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All categories</SelectItem>
                  {categories.map((category) => (
                    <SelectItem key={category.id} value={category.name}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={selectedStoreId} onValueChange={setSelectedStoreId}>
                <SelectTrigger aria-label="Filter marketplace by store" className="w-full sm:w-[190px]">
                  <SelectValue placeholder="Store" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All stores</SelectItem>
                  {stores.map((store) => (
                    <SelectItem key={store.id} value={store.id}>
                      {store.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger aria-label="Sort marketplace results" className="w-full sm:w-[190px]">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="name">Name (A-Z)</SelectItem>
                  <SelectItem value="price-low">Price (Low to High)</SelectItem>
                  <SelectItem value="price-high">Price (High to Low)</SelectItem>
                  <SelectItem value="stock">Stock (High to Low)</SelectItem>
                </SelectContent>
              </Select>
            </>
          }
        />

        <Card>
          <CardContent className="pt-6">
            {itemsError ? (
              <InlineErrorState
                description={itemsError instanceof Error ? itemsError.message : "Unable to load marketplace catalog."}
              />
            ) : isLoading ? (
              <PageSkeleton withHeader={false} rows={4} />
            ) : sortedItems.length === 0 ? (
              <EmptyState
                icon={Package}
                title="No catalog items found"
                description="Adjust your search or filters to view available marketplace listings."
              />
            ) : (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {sortedItems.map((item) => {
                  const image = item.images?.[0] ?? null;
                  const price = parsePrice(item.price);
                  const stock = Number(item.stock ?? 0);

                  return (
                    <Card key={item.id} className="flex h-full flex-col border-border">
                      <div className="flex h-40 w-full items-center justify-center bg-gradient-to-br from-muted to-muted/60">
                        {image ? (
                          <img src={image} alt={item.name} className="h-full w-full object-cover" />
                        ) : (
                          <Package className="h-12 w-12 text-muted-foreground" />
                        )}
                      </div>

                      <CardContent className="flex flex-1 flex-col pt-4">
                        <div className="mb-2 flex flex-wrap gap-2">
                          {item.category ? (
                            <Badge variant="outline" className="text-[11px]">
                              {item.category}
                            </Badge>
                          ) : null}
                          <Badge variant={stock > 0 ? "default" : "destructive"} className="text-[11px]">
                            {stock > 0 ? `${stock} in stock` : "Out of stock"}
                          </Badge>
                        </div>

                        <h3 className="mb-1 line-clamp-2 text-sm font-semibold text-foreground">{item.name}</h3>
                        {item.description ? (
                          <p className="mb-3 line-clamp-2 text-xs text-muted-foreground">{item.description}</p>
                        ) : null}

                        <p className="mb-3 text-xs text-muted-foreground">
                          Store: <span className="font-medium text-foreground">{item.storeName ?? "Unknown"}</span>
                        </p>

                        <div className="mt-auto flex items-center justify-between pt-2">
                          <div className="flex items-center gap-1 text-base font-semibold text-foreground">
                            <DollarSign className="h-4 w-4" />
                            {price.toLocaleString("en-NG")}
                          </div>
                          <span className="text-xs text-muted-foreground">{item.unitOfMeasure ?? "unit"}</span>
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

