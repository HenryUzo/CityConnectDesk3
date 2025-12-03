import { Router } from "express";
import { db } from "./db";
import { 
  stores, 
  storeMembers, 
  marketplaceItems, 
  users,
  memberships,
  storeEstates,
  insertMarketplaceItemSchema 
} from "@shared/schema";
import { eq, and, or, like, desc } from "drizzle-orm";
import { z } from "zod";
import { storage } from "./storage";
import { requireAuth, requireProvider } from "./auth-middleware";

const router = Router();

// Apply authentication middleware to all provider routes
router.use(requireProvider);

// Middleware to verify provider has access to a store
const verifyStoreAccess = async (req: any, res: any, next: any) => {
  try {
    const storeId = req.params.id || req.params.storeId;
    const providerId = req.auth?.userId; // Use JWT auth

    const [membership] = await db.select()
      .from(storeMembers)
      .where(
        and(
          eq(storeMembers.storeId, storeId),
          eq(storeMembers.userId, providerId),
          eq(storeMembers.isActive, true)
        )
      );

    if (!membership) {
      return res.status(403).json({ error: "Access denied. You are not a member of this store." });
    }

    req.storeMembership = membership;
    next();
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// GET /api/provider/stores - Get all stores I'm a member of
router.get("/stores", async (req: any, res) => {
  try {
    const providerId = req.auth?.userId; // Use JWT auth

    const memberships = await db.select({
      membership: storeMembers,
      store: stores
    })
    .from(storeMembers)
    .innerJoin(stores, eq(storeMembers.storeId, stores.id))
    .where(
      and(
        eq(storeMembers.userId, providerId),
        eq(storeMembers.isActive, true)
      )
    );

    res.json(memberships.map((m: any) => ({
      ...m.store,
      membership: {
        role: m.membership.role,
        canManageItems: m.membership.canManageItems,
        canManageOrders: m.membership.canManageOrders
      }
    })));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/provider/stores - Create a new store (self-registration)
router.post("/stores", async (req: any, res) => {
  try {
    const providerId = req.auth?.userId; // Use JWT auth
    
    // Validation schema for store creation (no estate ID - will be allocated by admin)
    const createStoreSchema = z.object({
      name: z.string().min(1, "Store name is required").max(200),
      description: z.string().max(1000).optional(),
      location: z.string().min(1, "Location is required").max(300),
      latitude: z.number().optional(),
      longitude: z.number().optional(),
      phone: z.string().max(20).optional(),
      email: z.string().email().optional(),
      logo: z.string().max(500).optional(),
    });

    const validated = createStoreSchema.parse(req.body);

    // Create store (without estate - will be allocated by admin after approval)
    // Store starts with approvalStatus='pending' by default from schema
    const [newStore] = await db.insert(stores).values({
      name: validated.name,
      description: validated.description,
      location: validated.location,
      latitude: validated.latitude,
      longitude: validated.longitude,
      phone: validated.phone,
      email: validated.email,
      logo: validated.logo,
      ownerId: providerId,
      isActive: true
      // estateId: null - will be set by admin during approval
      // approvalStatus: 'pending' - default from schema
    }).returning();

    // Automatically add provider as store owner/member
    await db.insert(storeMembers).values({
      storeId: newStore.id,
      userId: providerId,
      role: "owner",
      canManageItems: true as any,
      canManageOrders: true as any,
      isActive: true as any
    });

    res.status(201).json(newStore);
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: "Validation error", details: error.errors });
    }
    res.status(500).json({ error: error.message });
  }
});

// GET /api/provider/stores/:id/items - Get all items for my store
router.get("/stores/:id/items", verifyStoreAccess, async (req: any, res) => {
  try {
    const storeId = req.params.id;
    const { search, category, isActive } = req.query;

    let conditions = [eq(marketplaceItems.storeId, storeId)];
    
    if (search) {
      conditions.push(
        or(
          like(marketplaceItems.name, `%${search}%`),
          like(marketplaceItems.description, `%${search}%`)
        )!
      );
    }
    
    if (category) {
      conditions.push(eq(marketplaceItems.category, category as string));
    }
    
    if (isActive !== undefined) {
      conditions.push(eq(marketplaceItems.isActive, isActive === 'true'));
    }

    const items = await db.select()
      .from(marketplaceItems)
      .where(and(...conditions))
      .orderBy(desc(marketplaceItems.createdAt));

    res.json(items);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/provider/stores/:id/items - Add item to store
router.post("/stores/:id/items", verifyStoreAccess, async (req: any, res) => {
  try {
    const storeId = req.params.id;
    const providerId = req.auth?.userId; // Use JWT auth
    const membership = req.storeMembership;

    // Check if provider has permission to manage items
    if (!membership.canManageItems) {
      return res.status(403).json({ error: "You don't have permission to manage items for this store" });
    }

    // Get store and check approval status
    const [store] = await db.select()
      .from(stores)
      .where(eq(stores.id, storeId));

    if (!store) {
      return res.status(404).json({ error: "Store not found" });
    }

    // Block item creation for pending or rejected stores
    if (store.approvalStatus === 'pending') {
      return res.status(403).json({ 
        error: "Cannot add items to pending stores",
        message: "Your store is awaiting admin approval. Items can be added once approved."
      });
    }

    if (store.approvalStatus === 'rejected') {
      return res.status(403).json({ 
        error: "Cannot add items to rejected stores",
        message: "Your store has been rejected. Please contact admin for details."
      });
    }

    // Get first allocated estate for this store
    const [storeEstate] = await db.select()
      .from(storeEstates)
      .where(eq(storeEstates.storeId, storeId))
      .limit(1);

    if (!storeEstate) {
      return res.status(403).json({ 
        error: "Cannot add items yet",
        message: "No estates have been allocated to your store. Please contact admin."
      });
    }

    // Validation schema for item creation
    const createItemSchema = z.object({
      name: z.string().min(1, "Item name is required"),
      description: z.string().optional(),
      price: z.union([z.string(), z.number()]).transform(val => String(val)),
      currency: z.string().optional().default("NGN"),
      unitOfMeasure: z.enum(["kg", "g", "liter", "ml", "piece", "bunch", "pack", "bag", "bottle", "can", "box", "dozen", "yard", "meter"]).optional().default("piece"),
      category: z.string().min(1, "Category is required"),
      subcategory: z.string().optional(),
      stock: z.number().int().min(0).default(0),
      images: z.array(z.string()).optional()
    });

    const validated = createItemSchema.parse(req.body);

    // Create item (use first allocated estate)
    const [newItem] = await db.insert(marketplaceItems).values({
      name: validated.name,
      description: validated.description,
      price: validated.price,
      currency: validated.currency,
      unitOfMeasure: validated.unitOfMeasure as any,
      category: validated.category,
      subcategory: validated.subcategory,
      stock: validated.stock,
      images: validated.images,
      estateId: storeEstate.estateId, // Use first allocated estate
      storeId: storeId,
      vendorId: providerId,
      isActive: true
    }).returning();

    res.status(201).json(newItem);
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: "Validation error", details: error.errors });
    }
    res.status(500).json({ error: error.message });
  }
});

// PATCH /api/provider/stores/:storeId/items/:itemId - Update item
router.patch("/stores/:storeId/items/:itemId", verifyStoreAccess, async (req: any, res) => {
  try {
    const { storeId, itemId } = req.params;
    const membership = req.storeMembership;

    // Check if provider has permission to manage items
    if (!membership.canManageItems) {
      return res.status(403).json({ error: "You don't have permission to manage items for this store" });
    }

    // Verify item exists and belongs to this store
    const [existingItem] = await db.select()
      .from(marketplaceItems)
      .where(
        and(
          eq(marketplaceItems.id, itemId),
          eq(marketplaceItems.storeId, storeId)
        )
      );

    if (!existingItem) {
      return res.status(404).json({ error: "Item not found in this store" });
    }

    // Validation schema for updates
    const updateItemSchema = z.object({
      name: z.string().min(1).optional(),
      description: z.string().optional(),
      price: z.union([z.string(), z.number()]).transform(val => String(val)).optional(),
      category: z.string().optional(),
      subcategory: z.string().optional(),
      stock: z.number().int().min(0).optional(),
      unitOfMeasure: z.enum(["kg", "g", "liter", "ml", "piece", "bunch", "pack", "bag", "bottle", "can", "box", "dozen", "yard", "meter"]).optional(),
      images: z.array(z.string()).optional(),
      isActive: z.boolean().optional()
    });

    const validated = updateItemSchema.parse(req.body);

    // Build update object
    const updateData: any = {
      updatedAt: new Date()
    };
    if (validated.name !== undefined) updateData.name = validated.name;
    if (validated.description !== undefined) updateData.description = validated.description;
    if (validated.price !== undefined) updateData.price = validated.price;
    if (validated.category !== undefined) updateData.category = validated.category;
    if (validated.subcategory !== undefined) updateData.subcategory = validated.subcategory;
    if (validated.stock !== undefined) updateData.stock = validated.stock;
    if (validated.unitOfMeasure !== undefined) updateData.unitOfMeasure = validated.unitOfMeasure;
    if (validated.images !== undefined) updateData.images = validated.images;
    if (validated.isActive !== undefined) updateData.isActive = validated.isActive;

    // Update item
    const [updatedItem] = await db.update(marketplaceItems)
      .set(updateData)
      .where(eq(marketplaceItems.id, itemId))
      .returning();

    res.json(updatedItem);
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: "Validation error", details: error.errors });
    }
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/provider/stores/:storeId/items/:itemId - Delete item
router.delete("/stores/:storeId/items/:itemId", verifyStoreAccess, async (req: any, res) => {
  try {
    const { storeId, itemId } = req.params;
    const membership = req.storeMembership;

    // Check if provider has permission to manage items
    if (!membership.canManageItems) {
      return res.status(403).json({ error: "You don't have permission to manage items for this store" });
    }

    // Verify item exists and belongs to this store
    const [existingItem] = await db.select()
      .from(marketplaceItems)
      .where(
        and(
          eq(marketplaceItems.id, itemId),
          eq(marketplaceItems.storeId, storeId)
        )
      );

    if (!existingItem) {
      return res.status(404).json({ error: "Item not found in this store" });
    }

    // Soft delete by marking as inactive
    const [deletedItem] = await db.update(marketplaceItems)
      .set({
        isActive: false,
        updatedAt: new Date()
      })
      .where(eq(marketplaceItems.id, itemId))
      .returning();

    res.json({ message: "Item deleted successfully", item: deletedItem });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/provider/company-registration - Register new company profile
router.post("/company-registration", async (req: any, res) => {
  try {
    const providerId = req.auth?.userId; // Use JWT auth

    const createCompanySchema = z.object({
      name: z.string().min(2, "Business name is required"),
      description: z.string().max(1000).optional(),
      contactEmail: z.string().email("Valid contact email is required").optional(),
      phone: z.string().min(7).max(20).optional(),
      businessDetails: z
        .object({
          registrationNumber: z.string().optional(),
          taxId: z.string().optional(),
          businessType: z.string().optional(),
          industry: z.string().optional(),
          yearEstablished: z
            .preprocess((val) => {
              if (typeof val === "string" && val.trim() !== "") {
                const parsed = Number(val);
                return Number.isNaN(parsed) ? undefined : parsed;
              }
              return val;
            }, z.number().int().min(1900).max(new Date().getFullYear()).optional()),
          website: z.string().url().optional(),
        })
        .optional(),
      bankDetails: z
        .object({
          bankName: z.string().optional(),
          accountName: z.string().optional(),
          accountNumber: z.string().optional(),
          routingNumber: z.string().optional(),
          swiftCode: z.string().optional(),
          notes: z.string().optional(),
        })
        .optional(),
      locationDetails: z
        .object({
          addressLine1: z.string().optional(),
          addressLine2: z.string().optional(),
          city: z.string().optional(),
          state: z.string().optional(),
          lga: z.string().optional(),
          country: z.string().optional(),
          coordinates: z
            .object({
              latitude: z.number().optional(),
              longitude: z.number().optional(),
            })
            .optional(),
        })
        .optional(),
    });

    const validated = createCompanySchema.parse(req.body);

    const detailsPayload = {
      businessDetails: validated.businessDetails ?? {},
      bankDetails: validated.bankDetails ?? {},
      locationDetails: validated.locationDetails ?? {},
      submittedAt: new Date().toISOString(),
    };

    const createdCompany = await storage.createCompany({
      name: validated.name,
      description: validated.description,
      contactEmail: validated.contactEmail,
      phone: validated.phone,
      providerId,
      details: detailsPayload,
    });

    res.status(201).json(createdCompany);
  } catch (error: any) {
    if (error?.name === "ZodError") {
      return res.status(400).json({ error: "Validation error", details: error.errors });
    }
    res.status(500).json({ error: error.message });
  }
});

export default router;
