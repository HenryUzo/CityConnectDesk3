// client/src/hooks/useCityMart.ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useState, useCallback, useEffect } from "react";

export type Store = {
  id: string;
  name: string;
  description: string | null;
  location: string | null;
  phone: string | null;
  email: string | null;
  estateId: string | null;
  isActive: boolean;
  createdAt: string;
};

export type MarketplaceItem = {
  id: string;
  name: string;
  description: string | null;
  price: string;
  currency: string;
  unitOfMeasure: string | null;
  category: string;
  subcategory: string | null;
  stock: number;
  images: string[] | null;
  isActive: boolean;
};

export type CartItem = {
  item: MarketplaceItem;
  quantity: number;
  storeId: string;
  storeName: string;
};

export type OrderItem = {
  itemId: string;
  quantity: number;
  priceAtOrder: string;
};

const CART_STORAGE_KEY = "citymart_cart";

// Persist cart to localStorage
function saveCartToStorage(items: CartItem[]) {
  try {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
  } catch {
    // ignore storage errors
  }
}

function loadCartFromStorage(): CartItem[] {
  try {
    const raw = localStorage.getItem(CART_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function useStores() {
  return useQuery({
    queryKey: ["/api/marketplace/stores"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/marketplace/stores");
      return (await res.json()) as Store[];
    },
    staleTime: 60_000,
  });
}

export function useStoreItems(storeId: string | null) {
  return useQuery({
    queryKey: ["/api/marketplace/stores", storeId, "items"],
    queryFn: async () => {
      if (!storeId) return [];
      const res = await apiRequest("GET", `/api/marketplace/stores/${storeId}/items`);
      return (await res.json()) as MarketplaceItem[];
    },
    enabled: !!storeId,
    staleTime: 30_000,
  });
}

export function useCart() {
  const [items, setItems] = useState<CartItem[]>(() => loadCartFromStorage());

  // Sync to localStorage whenever items change
  useEffect(() => {
    saveCartToStorage(items);
  }, [items]);

  const addToCart = useCallback((item: MarketplaceItem, storeId: string, storeName: string, quantity = 1) => {
    setItems(prev => {
      const existingIndex = prev.findIndex(
        cartItem => cartItem.item.id === item.id && cartItem.storeId === storeId
      );
      
      if (existingIndex >= 0) {
        const updated = [...prev];
        updated[existingIndex] = {
          ...updated[existingIndex],
          quantity: updated[existingIndex].quantity + quantity,
        };
        return updated;
      }
      
      return [...prev, { item, quantity, storeId, storeName }];
    });
  }, []);

  const removeFromCart = useCallback((itemId: string, storeId: string) => {
    setItems(prev => prev.filter(
      cartItem => !(cartItem.item.id === itemId && cartItem.storeId === storeId)
    ));
  }, []);

  const updateQuantity = useCallback((itemId: string, storeId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(itemId, storeId);
      return;
    }
    
    setItems(prev => prev.map(cartItem => {
      if (cartItem.item.id === itemId && cartItem.storeId === storeId) {
        return { ...cartItem, quantity };
      }
      return cartItem;
    }));
  }, [removeFromCart]);

  const clearCart = useCallback(() => {
    setItems([]);
  }, []);

  const total = items.reduce((sum, cartItem) => {
    return sum + (parseFloat(cartItem.item.price) * cartItem.quantity);
  }, 0);

  const itemCount = items.reduce((sum, cartItem) => sum + cartItem.quantity, 0);

  return {
    items,
    addToCart,
    removeFromCart,
    updateQuantity,
    clearCart,
    total,
    itemCount,
  };
}

export function useCreateOrder() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (orderData: {
      storeId: string;
      items: OrderItem[];
      deliveryAddress?: string;
      notes?: string;
    }) => {
      const res = await apiRequest("POST", "/api/marketplace/orders", orderData);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/marketplace/orders"] });
    },
  });
}

export function useMyOrders() {
  return useQuery({
    queryKey: ["/api/marketplace/orders"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/marketplace/orders");
      return await res.json();
    },
    staleTime: 30_000,
  });
}
