import { Router } from "express";
import { z } from "zod";
import { db } from "./db";
import {
  stores,
  marketplaceItems,
  orders,
  users,
  memberships,
  storeMembers,
  storeEstates,
  itemCategories,
  inventory,
  carts,
  cartItems,
  parentOrders,
  storeOrders,
  storeOrderItems,
  marketplacePayments,
  refunds,
} from "@shared/schema";
import { eq, and, or, sql, inArray, ilike, desc, asc } from "drizzle-orm";

const router = Router();

// ──────────────────────────────────────────────────────────────────
// Middleware
// ──────────────────────────────────────────────────────────────────
const requireAuth = (req: any, res: any, next: any) => {
  if (!req.isAuthenticated?.() || !req.user) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
};

/** Ensure the caller is a member of the given store (owner/manager/member). */
async function requireStoreMember(userId: string, storeId: string) {
  // Check if owner
  const [store] = await db
    .select({ id: stores.id, ownerId: stores.ownerId })
    .from(stores)
    .where(eq(stores.id, storeId));
  if (!store) return null;
  if (store.ownerId === userId) return { role: "owner" as const };

  const [member] = await db
    .select()
    .from(storeMembers)
    .where(
      and(
        eq(storeMembers.storeId, storeId),
        eq(storeMembers.userId, userId),
        eq(storeMembers.isActive, true)
      )
    );
  return member ?? null;
}

/** Helper: get or create the active cart for a resident */
async function getOrCreateActiveCart(residentId: string) {
  const [existing] = await db
    .select()
    .from(carts)
    .where(and(eq(carts.residentId, residentId), eq(carts.status, "active")));
  if (existing) return existing;

  const [created] = await db
    .insert(carts)
    .values({ residentId })
    .returning();
  return created;
}

/** Helper: convert decimal price string to kobo integer */
function priceToKobo(decimalPrice: string | number): number {
  return Math.round(parseFloat(String(decimalPrice)) * 100);
}

/** Helper: Finalize inventory when order is marked as paid */
async function finalizeInventoryForOrder(orderId: string) {
  try {
    // Get all store order items for this order
    const items = await db
      .select({
        productId: storeOrderItems.productId,
        qty: storeOrderItems.qty,
        storeId: storeOrders.storeId,
      })
      .from(storeOrderItems)
      .innerJoin(storeOrders, eq(storeOrderItems.storeOrderId, storeOrders.id))
      .where(eq(storeOrders.orderId, orderId));

    // Deduct inventory for each item
    for (const item of items) {
      const [inv] = await db
        .select()
        .from(inventory)
        .where(
          and(
            eq(inventory.storeId, item.storeId),
            eq(inventory.productId, item.productId)
          )
        );

      if (inv) {
        // Deduct from stock and clear reservation
        await db
          .update(inventory)
          .set({
            stockQty: Math.max(0, inv.stockQty - item.qty),
            reservedQty: Math.max(0, inv.reservedQty - item.qty),
            updatedAt: new Date(),
          })
          .where(eq(inventory.id, inv.id));

        console.log(
          `[Inventory] Finalized deduction: -${item.qty} of product ${item.productId} from store ${item.storeId}. New stock: ${Math.max(0, inv.stockQty - item.qty)}`
        );
      }
    }
  } catch (err: any) {
    console.error(`[Inventory] Failed to finalize inventory for order ${orderId}:`, err.message);
  }
}

// ──────────────────────────────────────────────────────────────────
// RESIDENT BROWSE
// ──────────────────────────────────────────────────────────────────

/**
 * GET /stores
 * Lists approved + active stores visible to the resident's estate(s).
 */
router.get("/stores", requireAuth, async (req, res) => {
  try {
    const user = req.user as any;

    // Get resident's estate memberships
    const userMemberships = await db
      .select()
      .from(memberships)
      .where(eq(memberships.userId, user.id));

    if (userMemberships.length === 0) {
      return res.json([]);
    }
    const estateIds = userMemberships.map((m: any) => m.estateId);

    // Stores that have the estate directly OR via store_estates join
    const directStores = await db
      .select({
        id: stores.id,
        name: stores.name,
        description: stores.description,
        location: stores.location,
        phone: stores.phone,
        email: stores.email,
        logo: stores.logo,
        estateId: stores.estateId,
        companyId: stores.companyId,
        isActive: stores.isActive,
        createdAt: stores.createdAt,
      })
      .from(stores)
      .where(
        and(
          inArray(stores.estateId, estateIds),
          eq(stores.isActive, true),
          eq(stores.approvalStatus, "approved")
        )
      );

    const allocatedStoreRows = await db
      .select({
        storeId: storeEstates.storeId,
      })
      .from(storeEstates)
      .where(inArray(storeEstates.estateId, estateIds));

    let allocatedStores: typeof directStores = [];
    const allocatedIds = allocatedStoreRows.map((r: any) => r.storeId);
    if (allocatedIds.length > 0) {
      allocatedStores = await db
        .select({
          id: stores.id,
          name: stores.name,
          description: stores.description,
          location: stores.location,
          phone: stores.phone,
          email: stores.email,
          logo: stores.logo,
          estateId: stores.estateId,
          companyId: stores.companyId,
          isActive: stores.isActive,
          createdAt: stores.createdAt,
        })
        .from(stores)
        .where(
          and(
            inArray(stores.id, allocatedIds),
            eq(stores.isActive, true),
            eq(stores.approvalStatus, "approved")
          )
        );
    }

    // Deduplicate
    const seen = new Set<string>();
    const combined = [...directStores, ...allocatedStores].filter((s) => {
      if (seen.has(s.id)) return false;
      seen.add(s.id);
      return true;
    });

    res.json(combined);
  } catch (error: any) {
    console.error("[Marketplace] Error fetching stores:", error);
    res.status(500).json({ message: error.message || "Failed to fetch stores" });
  }
});

/**
 * GET /products
 * Browse products across all visible stores. Supports search, category filter, pagination.
 * Query params: ?search=&category=&storeId=&page=1&limit=20
 */
router.get("/products", requireAuth, async (req, res) => {
  try {
    const user = req.user as any;
    const { search, category, storeId, page = "1", limit = "20" } = req.query as Record<string, string>;
    const offset = (Math.max(1, parseInt(page)) - 1) * parseInt(limit);
    const take = Math.min(100, parseInt(limit));

    // Get visible store IDs
    const userMemberships = await db
      .select()
      .from(memberships)
      .where(eq(memberships.userId, user.id));
    const estateIds = userMemberships.map((m: any) => m.estateId);

    if (estateIds.length === 0) {
      return res.json({ products: [], total: 0, page: 1, totalPages: 0 });
    }

    // Build list of visible store IDs
    const directStoreRows = await db
      .select({ id: stores.id })
      .from(stores)
      .where(
        and(
          inArray(stores.estateId, estateIds),
          eq(stores.isActive, true),
          eq(stores.approvalStatus, "approved")
        )
      );

    const allocRows = await db
      .select({ storeId: storeEstates.storeId })
      .from(storeEstates)
      .where(inArray(storeEstates.estateId, estateIds));

    const visibleStoreIds = [
      ...new Set([
        ...directStoreRows.map((r: any) => r.id),
        ...allocRows.map((r: any) => r.storeId),
      ]),
    ];

    if (visibleStoreIds.length === 0) {
      return res.json({ products: [], total: 0, page: 1, totalPages: 0 });
    }

    // Narrow by storeId if provided
    const targetStoreIds = storeId ? [storeId] : visibleStoreIds;
    // Ensure requested storeId is actually visible
    if (storeId && !visibleStoreIds.includes(storeId)) {
      return res.status(403).json({ message: "Store not accessible" });
    }

    // Build conditions
    const conditions: any[] = [
      inArray(marketplaceItems.storeId, targetStoreIds),
      eq(marketplaceItems.isActive, true),
    ];
    if (search) {
      conditions.push(
        or(
          ilike(marketplaceItems.name, `%${search}%`),
          ilike(marketplaceItems.description, `%${search}%`)
        )
      );
    }
    if (category) {
      conditions.push(eq(marketplaceItems.category, category));
    }

    // Count
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(marketplaceItems)
      .where(and(...conditions));

    // Fetch
    const products = await db
      .select({
        id: marketplaceItems.id,
        name: marketplaceItems.name,
        description: marketplaceItems.description,
        price: marketplaceItems.price,
        currency: marketplaceItems.currency,
        unitOfMeasure: marketplaceItems.unitOfMeasure,
        category: marketplaceItems.category,
        subcategory: marketplaceItems.subcategory,
        stock: marketplaceItems.stock,
        images: marketplaceItems.images,
        storeId: marketplaceItems.storeId,
        isActive: marketplaceItems.isActive,
        createdAt: marketplaceItems.createdAt,
      })
      .from(marketplaceItems)
      .where(and(...conditions))
      .orderBy(desc(marketplaceItems.createdAt))
      .limit(take)
      .offset(offset);

    // Attach store name
    const storeNameMap = new Map<string, string>();
    if (products.length > 0) {
      const storeIdsInResult = [...new Set(products.map((p: any) => p.storeId).filter(Boolean))] as string[];
      if (storeIdsInResult.length > 0) {
        const storeRows = await db
          .select({ id: stores.id, name: stores.name })
          .from(stores)
          .where(inArray(stores.id, storeIdsInResult));
        storeRows.forEach((s: any) => storeNameMap.set(s.id, s.name));
      }
    }

    const enriched = products.map((p: any) => ({
      ...p,
      storeName: p.storeId ? storeNameMap.get(p.storeId) ?? null : null,
    }));

    res.json({
      products: enriched,
      total: count,
      page: parseInt(page),
      totalPages: Math.ceil(count / take),
    });
  } catch (error: any) {
    console.error("[Marketplace] Error browsing products:", error);
    res.status(500).json({ message: error.message || "Failed to fetch products" });
  }
});

/**
 * GET /products/:id
 * Single product detail.
 */
router.get("/products/:id", requireAuth, async (req, res) => {
  try {
    const [product] = await db
      .select()
      .from(marketplaceItems)
      .where(eq(marketplaceItems.id, req.params.id));

    if (!product) return res.status(404).json({ message: "Product not found" });

    // Attach store info
    let store = null;
    if (product.storeId) {
      const [s] = await db
        .select({ id: stores.id, name: stores.name, logo: stores.logo, location: stores.location })
        .from(stores)
        .where(eq(stores.id, product.storeId));
      store = s ?? null;
    }

    // Attach inventory
    let inventoryInfo = null;
    if (product.storeId) {
      const [inv] = await db
        .select()
        .from(inventory)
        .where(
          and(
            eq(inventory.storeId, product.storeId),
            eq(inventory.productId, product.id)
          )
        );
      if (inv) {
        inventoryInfo = {
          stockQty: inv.stockQty,
          reservedQty: inv.reservedQty,
          available: inv.stockQty - inv.reservedQty,
        };
      }
    }

    res.json({ ...product, store, inventory: inventoryInfo });
  } catch (error: any) {
    console.error("[Marketplace] Error fetching product:", error);
    res.status(500).json({ message: error.message || "Failed to fetch product" });
  }
});

/**
 * GET /categories
 * Marketplace item categories.
 */
router.get("/categories", requireAuth, async (_req, res) => {
  try {
    const cats = await db
      .select()
      .from(itemCategories)
      .where(eq(itemCategories.isActive, true))
      .orderBy(asc(itemCategories.name));
    res.json(cats);
  } catch (error: any) {
    console.error("[Marketplace] Error fetching categories:", error);
    res.status(500).json({ message: error.message || "Failed to fetch categories" });
  }
});

// ──────────────────────────────────────────────────────────────────
// CART
// ──────────────────────────────────────────────────────────────────

/**
 * GET /cart
 * Returns the active cart with items grouped by store.
 */
router.get("/cart", requireAuth, async (req, res) => {
  try {
    const user = req.user as any;
    const cart = await getOrCreateActiveCart(user.id);

    const items = await db
      .select({
        id: cartItems.id,
        storeId: cartItems.storeId,
        productId: cartItems.productId,
        qty: cartItems.qty,
        unitPrice: cartItems.unitPrice,
        productName: marketplaceItems.name,
        productImages: marketplaceItems.images,
        productIsActive: marketplaceItems.isActive,
        storeName: stores.name,
      })
      .from(cartItems)
      .innerJoin(marketplaceItems, eq(cartItems.productId, marketplaceItems.id))
      .innerJoin(stores, eq(cartItems.storeId, stores.id))
      .where(eq(cartItems.cartId, cart.id))
      .orderBy(asc(cartItems.createdAt));

    // Group by store
    const grouped: Record<
      string,
      { storeId: string; storeName: string; items: typeof items }
    > = {};
    for (const item of items) {
      if (!grouped[item.storeId]) {
        grouped[item.storeId] = {
          storeId: item.storeId,
          storeName: item.storeName,
          items: [],
        };
      }
      grouped[item.storeId].items.push(item);
    }

    const totalKobo = items.reduce((sum: number, i: any) => sum + i.unitPrice * i.qty, 0);

    res.json({
      cartId: cart.id,
      status: cart.status,
      storeGroups: Object.values(grouped),
      totalItems: items.length,
      totalAmount: totalKobo, // kobo
    });
  } catch (error: any) {
    console.error("[Marketplace] Error fetching cart:", error);
    res.status(500).json({ message: error.message || "Failed to fetch cart" });
  }
});

/**
 * POST /cart/items
 * Add an item to the cart. If already present, increments qty.
 * Body: { productId, qty? }
 */
router.post("/cart/items", requireAuth, async (req, res) => {
  try {
    const user = req.user as any;
    const schema = z.object({
      productId: z.string().min(1),
      qty: z.number().int().positive().default(1),
    });
    const { productId, qty } = schema.parse(req.body);

    // Fetch product
    const [product] = await db
      .select()
      .from(marketplaceItems)
      .where(and(eq(marketplaceItems.id, productId), eq(marketplaceItems.isActive, true)));

    if (!product) return res.status(404).json({ message: "Product not found or inactive" });
    if (!product.storeId) return res.status(400).json({ message: "Product has no store" });

    const cart = await getOrCreateActiveCart(user.id);
    const unitPriceKobo = priceToKobo(product.price);

    // Check if already in cart
    const [existing] = await db
      .select()
      .from(cartItems)
      .where(
        and(eq(cartItems.cartId, cart.id), eq(cartItems.productId, productId))
      );

    let item;
    if (existing) {
      [item] = await db
        .update(cartItems)
        .set({ qty: existing.qty + qty, unitPrice: unitPriceKobo, updatedAt: new Date() })
        .where(eq(cartItems.id, existing.id))
        .returning();
    } else {
      [item] = await db
        .insert(cartItems)
        .values({
          cartId: cart.id,
          storeId: product.storeId,
          productId,
          qty,
          unitPrice: unitPriceKobo,
        })
        .returning();
    }

    res.status(201).json(item);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Validation error", errors: error.errors });
    }
    console.error("[Marketplace] Error adding cart item:", error);
    res.status(500).json({ message: error.message || "Failed to add item" });
  }
});

/**
 * PATCH /cart/items/:id
 * Update quantity. Body: { qty }
 */
router.patch("/cart/items/:id", requireAuth, async (req, res) => {
  try {
    const user = req.user as any;
    const { qty } = z.object({ qty: z.number().int().positive() }).parse(req.body);

    const cart = await getOrCreateActiveCart(user.id);

    const [item] = await db
      .select()
      .from(cartItems)
      .where(and(eq(cartItems.id, req.params.id), eq(cartItems.cartId, cart.id)));

    if (!item) return res.status(404).json({ message: "Cart item not found" });

    const [updated] = await db
      .update(cartItems)
      .set({ qty, updatedAt: new Date() })
      .where(eq(cartItems.id, item.id))
      .returning();

    res.json(updated);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Validation error", errors: error.errors });
    }
    console.error("[Marketplace] Error updating cart item:", error);
    res.status(500).json({ message: error.message || "Failed to update item" });
  }
});

/**
 * DELETE /cart/items/:id
 * Remove an item from the cart.
 */
router.delete("/cart/items/:id", requireAuth, async (req, res) => {
  try {
    const user = req.user as any;
    const cart = await getOrCreateActiveCart(user.id);

    const deleted = await db
      .delete(cartItems)
      .where(and(eq(cartItems.id, req.params.id), eq(cartItems.cartId, cart.id)))
      .returning();

    if (deleted.length === 0) return res.status(404).json({ message: "Cart item not found" });

    res.json({ message: "Removed" });
  } catch (error: any) {
    console.error("[Marketplace] Error removing cart item:", error);
    res.status(500).json({ message: error.message || "Failed to remove item" });
  }
});

// ──────────────────────────────────────────────────────────────────
// CHECKOUT
// ──────────────────────────────────────────────────────────────────

/**
 * POST /checkout
 * Atomically:
 *  1. Validate stock availability for every cart item (inventory.stockQty - inventory.reservedQty >= qty)
 *  2. Reserve inventory
 *  3. Create parentOrder + storeOrders + storeOrderItems
 *  4. Mark cart as checked_out
 * Body: { deliveryAddress: { estateId, region?, addressLine, phone }, deliveryMethod?, noteToStore? }
 */
router.post("/checkout", requireAuth, async (req, res) => {
  try {
    const user = req.user as any;

    const schema = z.object({
      deliveryAddress: z.object({
        estateId: z.string().min(1),
        region: z.string().optional(),
        addressLine: z.string().min(1),
        phone: z.string().min(1),
      }),
      deliveryMethod: z.enum(["pickup", "store_delivery", "cityconnect_rider"]).default("pickup"),
      noteToStore: z.string().optional(),
      paymentReference: z.string().optional(), // Paystack reference if payment was verified
    });
    const body = schema.parse(req.body);

    // Fetch active cart with items
    const [cart] = await db
      .select()
      .from(carts)
      .where(and(eq(carts.residentId, user.id), eq(carts.status, "active")));

    if (!cart) return res.status(400).json({ message: "No active cart" });

    const items = await db
      .select({
        id: cartItems.id,
        storeId: cartItems.storeId,
        productId: cartItems.productId,
        qty: cartItems.qty,
        unitPrice: cartItems.unitPrice,
      })
      .from(cartItems)
      .where(eq(cartItems.cartId, cart.id));

    if (items.length === 0) return res.status(400).json({ message: "Cart is empty" });

    // Group items by store
    const storeGroups = new Map<
      string,
      { storeId: string; items: typeof items; subtotal: number }
    >();
    for (const item of items) {
      let group = storeGroups.get(item.storeId);
      if (!group) {
        group = { storeId: item.storeId, items: [], subtotal: 0 };
        storeGroups.set(item.storeId, group);
      }
      group.items.push(item);
      group.subtotal += item.unitPrice * item.qty;
    }

    const totalAmount = Array.from(storeGroups.values()).reduce(
      (sum, g) => sum + g.subtotal,
      0
    );

    // Verify payment if reference is provided
    let orderStatus = "pending_payment";
    if (body.paymentReference) {
      try {
        const tx = await db.query.transactions.findFirst({
          where: (t: any) => eq(t.reference, body.paymentReference),
        });

        const txStatus = String(tx?.status || "").toLowerCase();
        if (tx && (tx.status === "COMPLETED" || txStatus === "completed")) {
          orderStatus = "paid";
          console.log(`[Marketplace] Payment verified for order: ${body.paymentReference}`);
        } else {
          console.warn(`[Marketplace] Payment not verified: ${body.paymentReference}, status: ${tx?.status}`);
        }
      } catch (err: any) {
        console.error(`[Marketplace] Failed to verify payment: ${err.message}`);
        // Continue with pending_payment if verification fails
      }
    }

    // Prevent duplicate orders for the same payment reference: if a marketplace payment
    // with this reference already exists, return the existing order instead of creating
    // a new one. This guards against repeated redirects / retries creating duplicate
    // parent orders when payment was already completed.
    if (body.paymentReference) {
      try {
        const [existingPayment] = await db
          .select()
          .from(marketplacePayments)
          .where(eq(marketplacePayments.reference, body.paymentReference))
          .limit(1);

        if (existingPayment) {
          const [po] = await db
            .select()
            .from(parentOrders)
            .where(eq(parentOrders.id, existingPayment.orderId))
            .limit(1);

          if (po) {
            // Attach store orders + items + payments and return
            const sos = await db
              .select({
                id: storeOrders.id,
                orderId: storeOrders.orderId,
                storeId: storeOrders.storeId,
                status: storeOrders.status,
                subtotalAmount: storeOrders.subtotalAmount,
                deliveryFee: storeOrders.deliveryFee,
                deliveryMethod: storeOrders.deliveryMethod,
                noteToStore: storeOrders.noteToStore,
                createdAt: storeOrders.createdAt,
                updatedAt: storeOrders.updatedAt,
                storeName: stores.name,
                storeLogo: stores.logo,
              })
              .from(storeOrders)
              .innerJoin(stores, eq(storeOrders.storeId, stores.id))
              .where(eq(storeOrders.orderId, po.id));

            const soIds = sos.map((s: any) => s.id);
            let soiRows: any[] = [];
            if (soIds.length > 0) {
              soiRows = await db
                .select({
                  id: storeOrderItems.id,
                  storeOrderId: storeOrderItems.storeOrderId,
                  productId: storeOrderItems.productId,
                  qty: storeOrderItems.qty,
                  unitPrice: storeOrderItems.unitPrice,
                  lineTotal: storeOrderItems.lineTotal,
                  productName: marketplaceItems.name,
                  productImages: marketplaceItems.images,
                })
                .from(storeOrderItems)
                .innerJoin(marketplaceItems, eq(storeOrderItems.productId, marketplaceItems.id))
                .where(inArray(storeOrderItems.storeOrderId, soIds));
            }

            const soiMap = new Map<string, typeof soiRows>();
            for (const soi of soiRows) {
              const list = soiMap.get(soi.storeOrderId) ?? [];
              list.push(soi);
              soiMap.set(soi.storeOrderId, list);
            }

            const payments = await db
              .select()
              .from(marketplacePayments)
              .where(eq(marketplacePayments.orderId, po.id));

            const enrichedSos = sos.map((so: any) => ({
              ...so,
              items: soiMap.get(so.id) ?? [],
            }));

            return res.status(200).json({ parentOrder: po, storeOrders: enrichedSos, payments });
          }
        }
      } catch (err: any) {
        console.error(`[Marketplace] Error checking existing payment reference: ${err.message}`);
        // ignore and continue to create a new order
      }
    }

    // ── Use a transaction for atomicity ──
    const result = await db.transaction(async (tx: any) => {
      // Step 1 & 2: Validate and reserve inventory for each item
      for (const item of items) {
        // Try to find inventory row
        const [inv] = await tx
          .select()
          .from(inventory)
          .where(
            and(
              eq(inventory.storeId, item.storeId),
              eq(inventory.productId, item.productId)
            )
          );

        if (inv) {
          const available = inv.stockQty - inv.reservedQty;
          if (available < item.qty) {
            throw new Error(
              `Insufficient stock for product ${item.productId}. Available: ${available}, requested: ${item.qty}`
            );
          }
          
          if (orderStatus === "paid") {
            // Payment verified: deduct from actual stock and clear reservation
            await tx
              .update(inventory)
              .set({
                stockQty: inv.stockQty - item.qty,
                reservedQty: 0,
                updatedAt: new Date(),
              })
              .where(eq(inventory.id, inv.id));
            console.log(
              `[Inventory] Deducted ${item.qty} of product ${item.productId} from store ${item.storeId}. New stock: ${inv.stockQty - item.qty}`
            );
          } else {
            // Payment pending: reserve the quantity
            await tx
              .update(inventory)
              .set({
                reservedQty: inv.reservedQty + item.qty,
                updatedAt: new Date(),
              })
              .where(eq(inventory.id, inv.id));
            console.log(
              `[Inventory] Reserved ${item.qty} of product ${item.productId} for store ${item.storeId}`
            );
          }
        }
        // If no inventory row, skip stock check (product uses legacy stock field)
      }

      // Step 3: Create parent order with status based on payment verification
      // If paymentReference provided, ensure we don't create a duplicate parent order
      if (body.paymentReference) {
        const [existingPayment] = await tx
          .select()
          .from(marketplacePayments)
          .where(eq(marketplacePayments.reference, body.paymentReference))
          .limit(1);

        if (existingPayment) {
          // Return existing parent order (with store orders/items/payments) to caller
          const [poExisting] = await tx
            .select()
            .from(parentOrders)
            .where(eq(parentOrders.id, existingPayment.orderId))
            .limit(1);

          if (poExisting) {
            const sosExisting = await tx
              .select({
                id: storeOrders.id,
                orderId: storeOrders.orderId,
                storeId: storeOrders.storeId,
                status: storeOrders.status,
                subtotalAmount: storeOrders.subtotalAmount,
                deliveryFee: storeOrders.deliveryFee,
                deliveryMethod: storeOrders.deliveryMethod,
                noteToStore: storeOrders.noteToStore,
                createdAt: storeOrders.createdAt,
                updatedAt: storeOrders.updatedAt,
                storeName: stores.name,
                storeLogo: stores.logo,
              })
              .from(storeOrders)
              .innerJoin(stores, eq(storeOrders.storeId, stores.id))
              .where(eq(storeOrders.orderId, poExisting.id));

            const soIdsExisting = sosExisting.map((s: any) => s.id);
            let soiRowsExisting: any[] = [];
            if (soIdsExisting.length > 0) {
              soiRowsExisting = await tx
                .select({
                  id: storeOrderItems.id,
                  storeOrderId: storeOrderItems.storeOrderId,
                  productId: storeOrderItems.productId,
                  qty: storeOrderItems.qty,
                  unitPrice: storeOrderItems.unitPrice,
                  lineTotal: storeOrderItems.lineTotal,
                  productName: marketplaceItems.name,
                  productImages: marketplaceItems.images,
                })
                .from(storeOrderItems)
                .innerJoin(marketplaceItems, eq(storeOrderItems.productId, marketplaceItems.id))
                .where(inArray(storeOrderItems.storeOrderId, soIdsExisting));
            }

            const soiMapExisting = new Map<string, typeof soiRowsExisting>();
            for (const soi of soiRowsExisting) {
              const list = soiMapExisting.get(soi.storeOrderId) ?? [];
              list.push(soi);
              soiMapExisting.set(soi.storeOrderId, list);
            }

            const paymentsExisting = await tx
              .select()
              .from(marketplacePayments)
              .where(eq(marketplacePayments.orderId, poExisting.id));

            const enrichedSosExisting = sosExisting.map((so: any) => ({
              ...so,
              items: soiMapExisting.get(so.id) ?? [],
            }));

            return { parentOrder: poExisting, storeOrders: enrichedSosExisting, payments: paymentsExisting };
          }
        }
      }

      const [po] = await tx
        .insert(parentOrders)
        .values({
          residentId: user.id,
          totalAmount,
          currency: "NGN",
          status: orderStatus,
          deliveryAddress: body.deliveryAddress,
        })
        .returning();

      // Step 4: Create store orders + items
      const createdStoreOrders = [];
      for (const [, group] of storeGroups) {
        const [so] = await tx
          .insert(storeOrders)
          .values({
            orderId: po.id,
            storeId: group.storeId,
            status: "pending_acceptance",
            subtotalAmount: group.subtotal,
            deliveryFee: 0,
            deliveryMethod: body.deliveryMethod,
            noteToStore: body.noteToStore ?? null,
          })
          .returning();

        const soItems = group.items.map((item: any) => ({
          storeOrderId: so.id,
          productId: item.productId,
          qty: item.qty,
          unitPrice: item.unitPrice,
          lineTotal: item.unitPrice * item.qty,
        }));

        await tx.insert(storeOrderItems).values(soItems);
        createdStoreOrders.push(so);
      }

      // If paymentReference provided, record a marketplace payment to prevent duplicates
      if (body.paymentReference) {
        try {
          await tx.insert(marketplacePayments).values({
            orderId: po.id,
            reference: body.paymentReference,
            status: "paid",
            amount: totalAmount,
            meta: {},
          });
        } catch (err: any) {
          // Ignore insert errors (e.g., unique constraint) — another concurrent request may have created it
          console.warn(`[Marketplace] marketplacePayments insert warning: ${err.message}`);
        }
      }

      // Step 5: Mark cart as checked_out
      await tx
        .update(carts)
        .set({ status: "checked_out", updatedAt: new Date() })
        .where(eq(carts.id, cart.id));

      return { parentOrder: po, storeOrders: createdStoreOrders };
    });

    res.status(201).json(result);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Validation error", errors: error.errors });
    }
    console.error("[Marketplace] Checkout error:", error);
    res
      .status(error.message?.startsWith("Insufficient stock") ? 409 : 500)
      .json({ message: error.message || "Checkout failed" });
  }
});

// ──────────────────────────────────────────────────────────────────
// RESIDENT ORDER HISTORY
// ──────────────────────────────────────────────────────────────────

/**
 * GET /orders
 * Resident's parent orders (newest first) with nested storeOrders.
 */
router.get("/orders", requireAuth, async (req, res) => {
  try {
    const user = req.user as any;

    const pos = await db
      .select()
      .from(parentOrders)
      .where(eq(parentOrders.residentId, user.id))
      .orderBy(desc(parentOrders.createdAt));

    if (pos.length === 0) return res.json([]);

    // Attach store orders for each parent
    const orderIds = pos.map((o: any) => o.id);
    const sos = await db
      .select({
        id: storeOrders.id,
        orderId: storeOrders.orderId,
        storeId: storeOrders.storeId,
        status: storeOrders.status,
        subtotalAmount: storeOrders.subtotalAmount,
        deliveryFee: storeOrders.deliveryFee,
        deliveryMethod: storeOrders.deliveryMethod,
        createdAt: storeOrders.createdAt,
        storeName: stores.name,
      })
      .from(storeOrders)
      .innerJoin(stores, eq(storeOrders.storeId, stores.id))
      .where(inArray(storeOrders.orderId, orderIds))
      .orderBy(asc(storeOrders.createdAt));

    const soMap = new Map<string, (typeof sos)>();
    for (const so of sos) {
      const list = soMap.get(so.orderId) ?? [];
      list.push(so);
      soMap.set(so.orderId, list);
    }

    const enriched = pos.map((po: any) => ({
      ...po,
      storeOrders: soMap.get(po.id) ?? [],
    }));

    res.json(enriched);
  } catch (error: any) {
    console.error("[Marketplace] Error fetching orders:", error);
    res.status(500).json({ message: error.message || "Failed to fetch orders" });
  }
});

/**
 * GET /orders/:id
 * Detailed parent order with store orders and their items.
 */
router.get("/orders/:id", requireAuth, async (req, res) => {
  try {
    const user = req.user as any;

    const [po] = await db
      .select()
      .from(parentOrders)
      .where(
        and(eq(parentOrders.id, req.params.id), eq(parentOrders.residentId, user.id))
      );

    if (!po) return res.status(404).json({ message: "Order not found" });

    // Store orders
    const sos = await db
      .select({
        id: storeOrders.id,
        orderId: storeOrders.orderId,
        storeId: storeOrders.storeId,
        status: storeOrders.status,
        subtotalAmount: storeOrders.subtotalAmount,
        deliveryFee: storeOrders.deliveryFee,
        deliveryMethod: storeOrders.deliveryMethod,
        noteToStore: storeOrders.noteToStore,
        createdAt: storeOrders.createdAt,
        updatedAt: storeOrders.updatedAt,
        storeName: stores.name,
        storeLogo: stores.logo,
      })
      .from(storeOrders)
      .innerJoin(stores, eq(storeOrders.storeId, stores.id))
      .where(eq(storeOrders.orderId, po.id));

    // Items for each store order
    const soIds = sos.map((s: any) => s.id);
    let soiRows: any[] = [];
    if (soIds.length > 0) {
      soiRows = await db
        .select({
          id: storeOrderItems.id,
          storeOrderId: storeOrderItems.storeOrderId,
          productId: storeOrderItems.productId,
          qty: storeOrderItems.qty,
          unitPrice: storeOrderItems.unitPrice,
          lineTotal: storeOrderItems.lineTotal,
          productName: marketplaceItems.name,
          productImages: marketplaceItems.images,
        })
        .from(storeOrderItems)
        .innerJoin(marketplaceItems, eq(storeOrderItems.productId, marketplaceItems.id))
        .where(inArray(storeOrderItems.storeOrderId, soIds));
    }

    const soiMap = new Map<string, typeof soiRows>();
    for (const soi of soiRows) {
      const list = soiMap.get(soi.storeOrderId) ?? [];
      list.push(soi);
      soiMap.set(soi.storeOrderId, list);
    }

    // Payments
    const payments = await db
      .select()
      .from(marketplacePayments)
      .where(eq(marketplacePayments.orderId, po.id));

    const enrichedSos = sos.map((so: any) => ({
      ...so,
      items: soiMap.get(so.id) ?? [],
    }));

    res.json({ ...po, storeOrders: enrichedSos, payments });
  } catch (error: any) {
    console.error("[Marketplace] Error fetching order detail:", error);
    res.status(500).json({ message: error.message || "Failed to fetch order" });
  }
});

// ──────────────────────────────────────────────────────────────────
// STORE MANAGEMENT – ORDERS
// ──────────────────────────────────────────────────────────────────

/**
 * GET /store/:storeId/orders
 * Store staff sees their store orders. Supports ?status= filter.
 */
router.get("/store/:storeId/orders", requireAuth, async (req, res) => {
  try {
    const user = req.user as any;
    const { storeId } = req.params;
    const { status } = req.query as { status?: string };

    const member = await requireStoreMember(user.id, storeId);
    if (!member) return res.status(403).json({ message: "Not a store member" });

    const conditions: any[] = [eq(storeOrders.storeId, storeId)];
    if (status) {
      conditions.push(eq(storeOrders.status, status as any));
    }

    const rows = await db
      .select({
        id: storeOrders.id,
        orderId: storeOrders.orderId,
        storeId: storeOrders.storeId,
        status: storeOrders.status,
        subtotalAmount: storeOrders.subtotalAmount,
        deliveryFee: storeOrders.deliveryFee,
        deliveryMethod: storeOrders.deliveryMethod,
        noteToStore: storeOrders.noteToStore,
        createdAt: storeOrders.createdAt,
        updatedAt: storeOrders.updatedAt,
        residentName: sql<string>`concat(${users.firstName}, ' ', ${users.lastName})`,
      })
      .from(storeOrders)
      .innerJoin(parentOrders, eq(storeOrders.orderId, parentOrders.id))
      .innerJoin(users, eq(parentOrders.residentId, users.id))
      .where(and(...conditions))
      .orderBy(desc(storeOrders.createdAt));

    res.json(rows);
  } catch (error: any) {
    console.error("[Marketplace] Error fetching store orders:", error);
    res.status(500).json({ message: error.message || "Failed to fetch store orders" });
  }
});

/**
 * GET /store/:storeId/orders/:orderId
 * Store order detail with items + resident info.
 */
router.get("/store/:storeId/orders/:orderId", requireAuth, async (req, res) => {
  try {
    const user = req.user as any;
    const { storeId, orderId } = req.params;

    const member = await requireStoreMember(user.id, storeId);
    if (!member) return res.status(403).json({ message: "Not a store member" });

    const [so] = await db
      .select()
      .from(storeOrders)
      .where(and(eq(storeOrders.id, orderId), eq(storeOrders.storeId, storeId)));

    if (!so) return res.status(404).json({ message: "Store order not found" });

    // Items
    const items = await db
      .select({
        id: storeOrderItems.id,
        productId: storeOrderItems.productId,
        qty: storeOrderItems.qty,
        unitPrice: storeOrderItems.unitPrice,
        lineTotal: storeOrderItems.lineTotal,
        productName: marketplaceItems.name,
        productImages: marketplaceItems.images,
      })
      .from(storeOrderItems)
      .innerJoin(marketplaceItems, eq(storeOrderItems.productId, marketplaceItems.id))
      .where(eq(storeOrderItems.storeOrderId, so.id));

    // Resident info
    const [po] = await db
      .select()
      .from(parentOrders)
      .where(eq(parentOrders.id, so.orderId));

    let resident = null;
    if (po) {
      const [r] = await db
        .select({ id: users.id, fullName: sql<string>`concat(${users.firstName}, ' ', ${users.lastName})`, phone: users.phone, email: users.email })
        .from(users)
        .where(eq(users.id, po.residentId));
      resident = r ?? null;
    }

    res.json({
      ...so,
      items,
      resident,
      deliveryAddress: po?.deliveryAddress,
      parentOrderStatus: po?.status,
    });
  } catch (error: any) {
    console.error("[Marketplace] Error fetching store order detail:", error);
    res.status(500).json({ message: error.message || "Failed to fetch order" });
  }
});

/**
 * PATCH /store/:storeId/orders/:orderId/status
 * Update store order status with valid transitions.
 * Body: { status }
 */
router.patch("/store/:storeId/orders/:orderId/status", requireAuth, async (req, res) => {
  try {
    const user = req.user as any;
    const { storeId, orderId } = req.params;

    const member = await requireStoreMember(user.id, storeId);
    if (!member) return res.status(403).json({ message: "Not a store member" });

    const { status: newStatus } = z
      .object({
        status: z.enum([
          "accepted",
          "rejected",
          "packing",
          "ready_for_dispatch",
          "dispatched",
          "delivered",
          "cancelled",
        ]),
      })
      .parse(req.body);

    const [so] = await db
      .select()
      .from(storeOrders)
      .where(and(eq(storeOrders.id, orderId), eq(storeOrders.storeId, storeId)));

    if (!so) return res.status(404).json({ message: "Store order not found" });

    // Validate transition
    const VALID_TRANSITIONS: Record<string, string[]> = {
      pending_acceptance: ["accepted", "rejected"],
      accepted: ["packing", "cancelled"],
      packing: ["ready_for_dispatch", "cancelled"],
      ready_for_dispatch: ["dispatched", "cancelled"],
      dispatched: ["delivered"],
      // terminal: delivered, rejected, cancelled, refunded
    };
    const allowed = VALID_TRANSITIONS[so.status] ?? [];
    if (!allowed.includes(newStatus)) {
      return res.status(422).json({
        message: `Cannot transition from '${so.status}' to '${newStatus}'`,
        allowed,
      });
    }

    const [updated] = await db
      .update(storeOrders)
      .set({ status: newStatus as any, updatedAt: new Date() })
      .where(eq(storeOrders.id, so.id))
      .returning();

    // On rejection/cancel → release reserved inventory
    if (newStatus === "rejected" || newStatus === "cancelled") {
      const soItems = await db
        .select()
        .from(storeOrderItems)
        .where(eq(storeOrderItems.storeOrderId, so.id));

      for (const item of soItems) {
        await db.execute(sql`
          UPDATE inventory
          SET reserved_qty = GREATEST(reserved_qty - ${item.qty}, 0),
              updated_at = now()
          WHERE store_id = ${storeId} AND product_id = ${item.productId}
        `);
      }
    }

    // On delivered → deduct stock (commit the reservation)
    if (newStatus === "delivered") {
      const soItems = await db
        .select()
        .from(storeOrderItems)
        .where(eq(storeOrderItems.storeOrderId, so.id));

      for (const item of soItems) {
        await db.execute(sql`
          UPDATE inventory
          SET stock_qty = GREATEST(stock_qty - ${item.qty}, 0),
              reserved_qty = GREATEST(reserved_qty - ${item.qty}, 0),
              updated_at = now()
          WHERE store_id = ${storeId} AND product_id = ${item.productId}
        `);
      }
    }

    res.json(updated);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Validation error", errors: error.errors });
    }
    console.error("[Marketplace] Error updating store order status:", error);
    res.status(500).json({ message: error.message || "Failed to update status" });
  }
});

// ──────────────────────────────────────────────────────────────────
// STORE MANAGEMENT – INVENTORY
// ──────────────────────────────────────────────────────────────────

/**
 * GET /store/:storeId/inventory
 * All inventory rows for a store with product info.
 */
router.get("/store/:storeId/inventory", requireAuth, async (req, res) => {
  try {
    const user = req.user as any;
    const { storeId } = req.params;

    const member = await requireStoreMember(user.id, storeId);
    if (!member) return res.status(403).json({ message: "Not a store member" });

    const rows = await db
      .select({
        id: inventory.id,
        productId: inventory.productId,
        stockQty: inventory.stockQty,
        reservedQty: inventory.reservedQty,
        lowStockThreshold: inventory.lowStockThreshold,
        updatedAt: inventory.updatedAt,
        productName: marketplaceItems.name,
        productPrice: marketplaceItems.price,
        productImages: marketplaceItems.images,
        productIsActive: marketplaceItems.isActive,
      })
      .from(inventory)
      .innerJoin(marketplaceItems, eq(inventory.productId, marketplaceItems.id))
      .where(eq(inventory.storeId, storeId))
      .orderBy(asc(marketplaceItems.name));

    const enriched = rows.map((r: any) => ({
      ...r,
      available: r.stockQty - r.reservedQty,
      isLowStock: r.lowStockThreshold != null && r.stockQty - r.reservedQty <= r.lowStockThreshold,
    }));

    res.json(enriched);
  } catch (error: any) {
    console.error("[Marketplace] Error fetching inventory:", error);
    res.status(500).json({ message: error.message || "Failed to fetch inventory" });
  }
});

/**
 * PATCH /store/:storeId/inventory/:productId
 * Update stock qty and/or low-stock threshold.
 * Body: { stockQty?, lowStockThreshold? }
 */
router.patch("/store/:storeId/inventory/:productId", requireAuth, async (req, res) => {
  try {
    const user = req.user as any;
    const { storeId, productId } = req.params;

    const member = await requireStoreMember(user.id, storeId);
    if (!member) return res.status(403).json({ message: "Not a store member" });

    const schema = z.object({
      stockQty: z.number().int().min(0).optional(),
      lowStockThreshold: z.number().int().min(0).nullable().optional(),
    });
    const body = schema.parse(req.body);

    // Upsert inventory row
    const [existing] = await db
      .select()
      .from(inventory)
      .where(
        and(eq(inventory.storeId, storeId), eq(inventory.productId, productId))
      );

    let row;
    if (existing) {
      const updates: any = { updatedAt: new Date() };
      if (body.stockQty !== undefined) updates.stockQty = body.stockQty;
      if (body.lowStockThreshold !== undefined) updates.lowStockThreshold = body.lowStockThreshold;
      [row] = await db.update(inventory).set(updates).where(eq(inventory.id, existing.id)).returning();
    } else {
      [row] = await db
        .insert(inventory)
        .values({
          storeId,
          productId,
          stockQty: body.stockQty ?? 0,
          lowStockThreshold: body.lowStockThreshold ?? null,
        })
        .returning();
    }

    res.json(row);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Validation error", errors: error.errors });
    }
    console.error("[Marketplace] Error updating inventory:", error);
    res.status(500).json({ message: error.message || "Failed to update inventory" });
  }
});

// ──────────────────────────────────────────────────────────────────
// LEGACY V1 ENDPOINTS (backward-compat)
// ──────────────────────────────────────────────────────────────────

/**
 * GET /stores/:storeId/items
 * Legacy: items for a single store.
 */
router.get("/stores/:storeId/items", requireAuth, async (req, res) => {
  try {
    const { storeId } = req.params;

    const [store] = await db.select().from(stores).where(eq(stores.id, storeId));
    if (!store || !store.isActive) {
      return res.status(404).json({ message: "Store not found or inactive" });
    }

    const items = await db
      .select({
        id: marketplaceItems.id,
        name: marketplaceItems.name,
        description: marketplaceItems.description,
        price: marketplaceItems.price,
        unitOfMeasure: marketplaceItems.unitOfMeasure,
        category: marketplaceItems.category,
        stock: marketplaceItems.stock,
        images: marketplaceItems.images,
        isActive: marketplaceItems.isActive,
      })
      .from(marketplaceItems)
      .where(
        and(eq(marketplaceItems.storeId, storeId), eq(marketplaceItems.isActive, true))
      );

    res.json(items);
  } catch (error: any) {
    console.error("[Marketplace] Error fetching store items:", error);
    res.status(500).json({ message: error.message || "Failed to fetch items" });
  }
});

/**
 * POST /orders/legacy
 * Legacy single-store order creation (kept for backward compat).
 */
router.post("/orders/legacy", requireAuth, async (req, res) => {
  try {
    const user = req.user as any;

    const orderSchema = z.object({
      storeId: z.string().min(1),
      items: z
        .array(
          z.object({
            itemId: z.string(),
            name: z.string(),
            price: z.number().positive(),
            quantity: z.number().positive().int(),
            unitOfMeasure: z.string(),
          })
        )
        .min(1),
      deliveryAddress: z.string().min(1),
      paymentMethod: z.string().optional(),
    });

    const data = orderSchema.parse(req.body);

    const [store] = await db.select().from(stores).where(eq(stores.id, data.storeId));
    if (!store || !store.isActive) {
      return res.status(404).json({ message: "Store not found" });
    }

    let vendorId = store.ownerId;
    if (!vendorId) {
      const [first] = await db
        .select({ userId: storeMembers.userId })
        .from(storeMembers)
        .where(eq(storeMembers.storeId, store.id))
        .limit(1);
      if (first) vendorId = first.userId;
      else return res.status(500).json({ message: "Store has no vendor" });
    }

    const total = data.items.reduce((s, i) => s + i.price * i.quantity, 0);

    const [newOrder] = await db
      .insert(orders)
      .values({
        estateId: store.estateId!,
        storeId: store.id,
        buyerId: user.id,
        vendorId: vendorId!,
        items: data.items,
        total: total.toFixed(2),
        currency: "NGN",
        status: "pending",
        deliveryAddress: data.deliveryAddress,
        paymentMethod: data.paymentMethod || "cash",
      })
      .returning();

    res.status(201).json(newOrder);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Validation error", errors: error.errors });
    }
    console.error("[Marketplace] Error creating legacy order:", error);
    res.status(500).json({ message: error.message || "Failed to create order" });
  }
});

export default router;
