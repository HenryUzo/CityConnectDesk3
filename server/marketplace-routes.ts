import { Router } from "express";
import { z } from "zod";
import { db } from "./db";
import { stores, marketplaceItems, orders, users, memberships, storeMembers } from "@shared/schema";
import { eq, and, sql, inArray } from "drizzle-orm";

const router = Router();

// Middleware to ensure user is authenticated
const requireAuth = (req: any, res: any, next: any) => {
  if (!req.isAuthenticated() || !req.user) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
};

// GET /stores - Get all stores in the current user's estate
router.get("/stores", requireAuth, async (req, res) => {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      // Get user's estates from memberships
      const userMemberships = await db
        .select()
        .from(memberships)
        .where(eq(memberships.userId, user.id));

      if (userMemberships.length === 0) {
        return res.status(403).json({ message: "No estate membership found" });
      }

      // Get all stores in user's estates
      const estateIds = userMemberships.map((m: any) => m.estateId);
      
      if (estateIds.length === 0) {
        return res.json([]);
      }
      
      const estateStores = await db
        .select({
          id: stores.id,
          name: stores.name,
          description: stores.description,
          location: stores.location,
          phone: stores.phone,
          email: stores.email,
          estateId: stores.estateId,
          isActive: stores.isActive,
          createdAt: stores.createdAt
        })
        .from(stores)
        .where(
          and(
            inArray(stores.estateId, estateIds),
            eq(stores.isActive, true)
          )
        );

      res.json(estateStores);
    } catch (error: any) {
      console.error("Error fetching stores:", error);
      res.status(500).json({ message: error.message || "Failed to fetch stores" });
    }
  });

// GET /stores/:storeId/items - Get all available items in a store
router.get("/stores/:storeId/items", requireAuth, async (req, res) => {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { storeId } = req.params;

      // Verify store exists and is active
      const [store] = await db
        .select()
        .from(stores)
        .where(eq(stores.id, storeId));

      if (!store) {
        return res.status(404).json({ message: "Store not found" });
      }

      if (!store.isActive) {
        return res.status(403).json({ message: "Store is not active" });
      }

      // Verify user has access to this store's estate
      const userMemberships = await db
        .select()
        .from(memberships)
        .where(
          and(
            eq(memberships.userId, user.id),
            eq(memberships.estateId, store.estateId)
          )
        );

      if (userMemberships.length === 0) {
        return res.status(403).json({ message: "No access to this store" });
      }

      // Get all available items in the store
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
          isActive: marketplaceItems.isActive
        })
        .from(marketplaceItems)
        .where(
          and(
            eq(marketplaceItems.storeId, storeId),
            eq(marketplaceItems.isActive, true)
          )
        );

      res.json(items);
    } catch (error: any) {
      console.error("Error fetching store items:", error);
      res.status(500).json({ message: error.message || "Failed to fetch items" });
    }
  });

// POST /orders - Create a new order
router.post("/orders", requireAuth, async (req, res) => {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      // Validate request body
      const orderSchema = z.object({
        storeId: z.string().min(1, "Store ID is required"),
        items: z.array(
          z.object({
            itemId: z.string(),
            name: z.string(),
            price: z.number().positive(),
            quantity: z.number().positive().int(),
            unitOfMeasure: z.string()
          })
        ).min(1, "At least one item is required"),
        deliveryAddress: z.string().min(1, "Delivery address is required"),
        paymentMethod: z.string().optional()
      });

      const validatedData = orderSchema.parse(req.body);

      // Get store to verify it exists and get estate/vendor info
      const [store] = await db
        .select()
        .from(stores)
        .where(eq(stores.id, validatedData.storeId));

      if (!store) {
        return res.status(404).json({ message: "Store not found" });
      }

      if (!store.isActive) {
        return res.status(403).json({ message: "Store is not active" });
      }

      // Verify user has access to this store's estate
      const userMemberships = await db
        .select()
        .from(memberships)
        .where(
          and(
            eq(memberships.userId, user.id),
            eq(memberships.estateId, store.estateId)
          )
        );

      if (userMemberships.length === 0) {
        return res.status(403).json({ message: "No access to this store's estate" });
      }

      // Get a vendor from the store (owner or first member)
      let vendorId = store.ownerId;
      
      if (!vendorId) {
        // If no owner, get the first store member
        const [firstMember] = await db
          .select({
            userId: storeMembers.userId
          })
          .from(storeMembers)
          .where(eq(storeMembers.storeId, store.id))
          .limit(1);
        
        if (firstMember) {
          vendorId = firstMember.userId;
        } else {
          return res.status(500).json({ message: "Store has no vendor assigned" });
        }
      }

      // Calculate total
      const total = validatedData.items.reduce(
        (sum, item) => sum + item.price * item.quantity,
        0
      );

      // Create order
      const [newOrder] = await db
        .insert(orders)
        .values({
          estateId: store.estateId,
          storeId: store.id,
          buyerId: user.id,
          vendorId: vendorId,
          items: validatedData.items,
          total: total.toFixed(2),
          currency: "NGN",
          status: "pending",
          deliveryAddress: validatedData.deliveryAddress,
          paymentMethod: validatedData.paymentMethod || "cash"
        })
        .returning();

      res.status(201).json(newOrder);
    } catch (error: any) {
      console.error("Error creating order:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          message: "Validation error",
          errors: error.errors
        });
      }
      res.status(500).json({ message: error.message || "Failed to create order" });
    }
  });

// GET /orders - Get user's orders
router.get("/orders", requireAuth, async (req, res) => {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      // Get orders where user is the buyer
      const userOrders = await db
        .select({
          id: orders.id,
          estateId: orders.estateId,
          storeId: orders.storeId,
          items: orders.items,
          total: orders.total,
          currency: orders.currency,
          status: orders.status,
          deliveryAddress: orders.deliveryAddress,
          paymentMethod: orders.paymentMethod,
          createdAt: orders.createdAt,
          updatedAt: orders.updatedAt
        })
        .from(orders)
        .where(eq(orders.buyerId, user.id))
        .orderBy(sql`${orders.createdAt} DESC`);

      res.json(userOrders);
    } catch (error: any) {
      console.error("Error fetching orders:", error);
      res.status(500).json({ message: error.message || "Failed to fetch orders" });
    }
});

export default router;
