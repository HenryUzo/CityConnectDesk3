// client/src/hooks/useCityMart.ts
// Server-backed marketplace hooks (V2 – multi-store cart, checkout, store orders)
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

// ──────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────

export type Store = {
  id: string;
  name: string;
  description: string | null;
  location: string;
  phone: string | null;
  email: string | null;
  logo: string | null;
  estateId: string | null;
  companyId: string | null;
  isActive: boolean;
  createdAt: string;
};

export type MarketplaceItem = {
  id: string;
  name: string;
  description: string | null;
  price: string; // decimal string
  currency: string;
  unitOfMeasure: string | null;
  category: string;
  subcategory: string | null;
  stock: number;
  images: string[] | null;
  storeId: string | null;
  storeName?: string | null;
  isActive: boolean;
  createdAt: string;
};

export type ProductDetail = MarketplaceItem & {
  store: { id: string; name: string; logo: string | null; location: string } | null;
  inventory: { stockQty: number; reservedQty: number; available: number } | null;
};

export type CartItemServer = {
  id: string;
  storeId: string;
  productId: string;
  qty: number;
  unitPrice: number; // kobo
  productName: string;
  productImages: string[] | null;
  productIsActive: boolean;
  storeName: string;
};

export type CartStoreGroup = {
  storeId: string;
  storeName: string;
  items: CartItemServer[];
};

export type CartResponse = {
  cartId: string;
  status: string;
  storeGroups: CartStoreGroup[];
  totalItems: number;
  totalAmount: number; // kobo
};

export type StoreOrderSummary = {
  id: string;
  orderId: string;
  storeId: string;
  status: string;
  subtotalAmount: number;
  deliveryFee: number;
  deliveryMethod: string;
  createdAt: string;
  storeName: string;
};

export type ParentOrder = {
  id: string;
  residentId: string;
  totalAmount: number;
  currency: string;
  status: string;
  deliveryAddress: any;
  createdAt: string;
  updatedAt: string;
  storeOrders: StoreOrderSummary[];
};

export type StoreOrderItem = {
  id: string;
  storeOrderId: string;
  productId: string;
  qty: number;
  unitPrice: number;
  lineTotal: number;
  productName: string;
  productImages: string[] | null;
};

export type StoreOrderDetail = StoreOrderSummary & {
  noteToStore: string | null;
  updatedAt: string;
  storeLogo: string | null;
  items: StoreOrderItem[];
};

export type ParentOrderDetail = ParentOrder & {
  storeOrders: StoreOrderDetail[];
  payments: any[];
};

export type ProductsResponse = {
  products: MarketplaceItem[];
  total: number;
  page: number;
  totalPages: number;
};

// ──────────────────────────────────────────────────────────────
// BROWSE hooks
// ──────────────────────────────────────────────────────────────

/** List approved stores visible to the current resident. */
export function useStores() {
  return useQuery<Store[]>({
    queryKey: ["/api/marketplace/stores"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/marketplace/stores");
      return res.json();
    },
    staleTime: 60_000,
  });
}

/** Browse products with search, category filter, store filter, pagination. */
export function useProducts(params: {
  search?: string;
  category?: string;
  storeId?: string;
  page?: number;
  limit?: number;
}) {
  const qs = new URLSearchParams();
  if (params.search) qs.set("search", params.search);
  if (params.category) qs.set("category", params.category);
  if (params.storeId) qs.set("storeId", params.storeId);
  if (params.page) qs.set("page", String(params.page));
  if (params.limit) qs.set("limit", String(params.limit));

  const url = `/api/marketplace/products?${qs.toString()}`;

  return useQuery<ProductsResponse>({
    queryKey: ["/api/marketplace/products", params],
    queryFn: async () => {
      const res = await apiRequest("GET", url);
      return res.json();
    },
    staleTime: 30_000,
  });
}

/** Single product detail. */
export function useProductDetail(productId: string | null) {
  return useQuery<ProductDetail>({
    queryKey: ["/api/marketplace/products", productId],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/marketplace/products/${productId}`);
      return res.json();
    },
    enabled: !!productId,
    staleTime: 30_000,
  });
}

/** Items for a single store (legacy endpoint, still useful). */
export function useStoreItems(storeId: string | null) {
  return useQuery<MarketplaceItem[]>({
    queryKey: ["/api/marketplace/stores", storeId, "items"],
    queryFn: async () => {
      if (!storeId) return [];
      const res = await apiRequest("GET", `/api/marketplace/stores/${storeId}/items`);
      return res.json();
    },
    enabled: !!storeId,
    staleTime: 30_000,
  });
}

// ──────────────────────────────────────────────────────────────
// CART hooks (server-backed)
// ──────────────────────────────────────────────────────────────

/** Fetch the active cart, with items grouped by store. */
export function useCart() {
  return useQuery<CartResponse>({
    queryKey: ["/api/marketplace/cart"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/marketplace/cart");
      return res.json();
    },
    staleTime: 15_000,
  });
}

/** Add an item to the server-side cart. */
export function useAddToCart() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: { productId: string; qty?: number }) => {
      const res = await apiRequest("POST", "/api/marketplace/cart/items", data);
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/marketplace/cart"] });
    },
  });
}

/** Update a cart item's quantity. */
export function useUpdateCartItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, qty }: { id: string; qty: number }) => {
      const res = await apiRequest("PATCH", `/api/marketplace/cart/items/${id}`, { qty });
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/marketplace/cart"] });
    },
  });
}

/** Remove a cart item. */
export function useRemoveCartItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/marketplace/cart/items/${id}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/marketplace/cart"] });
    },
  });
}

// ──────────────────────────────────────────────────────────────
// CHECKOUT
// ──────────────────────────────────────────────────────────────

export function useCheckout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      deliveryAddress: {
        estateId: string;
        region?: string;
        addressLine: string;
        phone: string;
      };
      deliveryMethod?: "pickup" | "store_delivery" | "cityconnect_rider";
      noteToStore?: string;
      paymentReference?: string;
    }) => {
      const res = await apiRequest("POST", "/api/marketplace/checkout", data);
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/marketplace/cart"] });
      qc.invalidateQueries({ queryKey: ["/api/marketplace/orders"] });
    },
  });
}

// ──────────────────────────────────────────────────────────────
// ORDER HISTORY (resident)
// ──────────────────────────────────────────────────────────────

/** List resident's parent orders with nested store orders. */
export function useMyOrders() {
  return useQuery<ParentOrder[]>({
    queryKey: ["/api/marketplace/orders"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/marketplace/orders");
      return res.json();
    },
    staleTime: 30_000,
  });
}

/** Detailed parent order. */
export function useOrderDetail(orderId: string | null) {
  return useQuery<ParentOrderDetail>({
    queryKey: ["/api/marketplace/orders", orderId],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/marketplace/orders/${orderId}`);
      return res.json();
    },
    enabled: !!orderId,
    staleTime: 30_000,
  });
}

// ──────────────────────────────────────────────────────────────
// STORE MANAGEMENT hooks (for provider/store staff)
// ──────────────────────────────────────────────────────────────

/** Fetch store orders for store management dashboard. */
export function useStoreOrders(storeId: string | null, status?: string) {
  const qs = status ? `?status=${status}` : "";
  return useQuery({
    queryKey: ["/api/marketplace/store", storeId, "orders", status],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/marketplace/store/${storeId}/orders${qs}`);
      return res.json();
    },
    enabled: !!storeId,
    staleTime: 10_000,
    refetchInterval: storeId ? 20_000 : false,
  });
}

/** Fetch single store order detail. */
export function useStoreOrderDetail(storeId: string | null, orderId: string | null) {
  return useQuery({
    queryKey: ["/api/marketplace/store", storeId, "orders", orderId],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/marketplace/store/${storeId}/orders/${orderId}`);
      return res.json();
    },
    enabled: !!storeId && !!orderId,
    staleTime: 10_000,
    refetchInterval: storeId && orderId ? 20_000 : false,
  });
}

/** Update store order status (accept, reject, pack, dispatch, deliver, cancel). */
export function useUpdateStoreOrderStatus(storeId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ orderId, status }: { orderId: string; status: string }) => {
      const res = await apiRequest(
        "PATCH",
        `/api/marketplace/store/${storeId}/orders/${orderId}/status`,
        { status }
      );
      return res.json();
    },
    onSuccess: async (_, variables) => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["/api/marketplace/store", storeId, "orders"] }),
        qc.invalidateQueries({ queryKey: ["/api/marketplace/store", storeId, "orders", variables.orderId] }),
        qc.invalidateQueries({ queryKey: ["/api/provider/stores", storeId, "orders"] }),
      ]);
    },
  });
}

/** Fetch inventory for a store. */
export function useStoreInventory(storeId: string | null) {
  return useQuery({
    queryKey: ["/api/marketplace/store", storeId, "inventory"],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/marketplace/store/${storeId}/inventory`);
      return res.json();
    },
    enabled: !!storeId,
    staleTime: 20_000,
    refetchInterval: storeId ? 45_000 : false,
  });
}

/** Update inventory for a product in a store. */
export function useUpdateInventory(storeId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      productId,
      stockQty,
      lowStockThreshold,
    }: {
      productId: string;
      stockQty?: number;
      lowStockThreshold?: number | null;
    }) => {
      const res = await apiRequest(
        "PATCH",
        `/api/marketplace/store/${storeId}/inventory/${productId}`,
        { stockQty, lowStockThreshold }
      );
      return res.json();
    },
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["/api/marketplace/store", storeId, "inventory"] }),
        qc.invalidateQueries({ queryKey: ["/api/provider/stores", storeId, "items"] }),
        qc.invalidateQueries({ queryKey: ["provider-marketplace-items"] }),
      ]);
    },
  });
}

// ──────────────────────────────────────────────────────────────
// HELPERS
// ──────────────────────────────────────────────────────────────

/** Format kobo amount to Naira display string */
export function formatKobo(kobo: number): string {
  return `₦${(kobo / 100).toLocaleString("en-NG", { minimumFractionDigits: 2 })}`;
}

/** Format decimal price string (from DB) to display */
export function formatPrice(price: string | number, currency = "NGN"): string {
  const num = typeof price === "string" ? parseFloat(price) : price;
  const symbol = currency === "NGN" ? "₦" : currency;
  return `${symbol}${num.toLocaleString("en-NG", { minimumFractionDigits: 2 })}`;
}

// ──────────────────────────────────────────────────────────────
// ESTATES hook
// ──────────────────────────────────────────────────────────────

export type Estate = {
  id: string;
  name: string;
  address: string | null;
  slug: string | null;
  accessType: string | null;
};

/** Fetch active estates for location dropdown */
export function useEstates() {
  return useQuery<Estate[]>({
    queryKey: ["/api/estates"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/estates");
      return res.json();
    },
    staleTime: 300_000, // 5 minutes
  });
}
