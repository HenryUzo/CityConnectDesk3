import { Router, raw } from "express";
import type { Server as SocketIOServer } from "socket.io";
import { db } from "./db";
import { 
  stores, 
  storeMembers,
  marketplaceItems,
  itemCategories,
  companies,
  companyTasks,
  companyTaskUpdates,
  users,
  memberships,
  orders,
  storeEstates,
  estates,
  insertMarketplaceItemSchema
} from "@shared/schema";
import { eq, and, or, like, ilike, desc, asc, sql, inArray } from "drizzle-orm";
import { z } from "zod";
import { storage } from "./storage";
import { requireAuth, requireProvider } from "./auth-middleware";
import {
  normalizeAndPersistInventoryImages,
  persistInventoryImage,
} from "./utils/inventory-image-storage";

const router = Router();

// Apply authentication middleware to all provider routes
router.use(requireProvider);

const ConsultancyReportSchema = z.object({
  inspectionDate: z.string().min(1),
  actualIssue: z.string().trim().min(3).max(2000),
  causeOfIssue: z.string().trim().min(3).max(2000),
  materialCost: z.preprocess((val) => Number(val), z.number().min(0)),
  serviceCost: z.preprocess((val) => Number(val), z.number().min(0)),
  preventiveRecommendation: z.string().trim().min(3).max(2000),
});

const ProviderTaskStatusSchema = z.object({
  status: z.enum(["open", "in_progress", "completed", "cancelled"]),
});

const ProviderTaskUpdateSchema = z.object({
  message: z.string().trim().min(1).max(4000),
  attachments: z.array(z.string().trim().min(1)).max(10).optional(),
});

const normalizeStatusKey = (value: unknown) =>
  String(value || "")
    .toLowerCase()
    .replace(/[\s-]+/g, "_")
    .trim();

router.post("/service-requests/:id/consultancy-report", async (req: any, res) => {
  try {
    const providerId = req.auth?.userId;
    if (!providerId) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const requestId = String(req.params.id || "").trim();
    const serviceRequest = await storage.getServiceRequest(requestId);
    if (!serviceRequest) {
      return res.status(404).json({ error: "Service request not found" });
    }

    if (serviceRequest.providerId !== providerId) {
      return res.status(403).json({ error: "Only the assigned provider can submit this report" });
    }

    const statusKey = normalizeStatusKey(serviceRequest.status);
    if (["completed", "cancelled"].includes(statusKey)) {
      return res.status(400).json({ error: "Cannot submit report for closed request" });
    }

    const payload = ConsultancyReportSchema.parse(req.body || {});
    const inspectionDate = new Date(payload.inspectionDate);
    if (Number.isNaN(inspectionDate.getTime())) {
      return res.status(400).json({ error: "Invalid inspection date" });
    }

    const totalRecommendation = payload.materialCost + payload.serviceCost;
    const report = {
      inspectionDate: inspectionDate.toISOString(),
      actualIssue: payload.actualIssue,
      causeOfIssue: payload.causeOfIssue,
      materialCost: payload.materialCost,
      serviceCost: payload.serviceCost,
      totalRecommendation,
      preventiveRecommendation: payload.preventiveRecommendation,
      submittedAt: new Date().toISOString(),
      submittedBy: providerId,
    };

    const updated = await storage.updateServiceRequest(requestId, {
      consultancyReport: report as any,
      consultancyReportSubmittedAt: new Date(),
      consultancyReportSubmittedBy: providerId,
    } as any);

    if (!updated) {
      return res.status(404).json({ error: "Service request not found" });
    }

    const io = req.app.get("io") as SocketIOServer | undefined;
    const reviewerIds = new Set<string>();
    const reviewerUsers = await db
      .select({ id: users.id })
      .from(users)
      .where(
        or(
          eq(users.role, "admin"),
          eq(users.role, "estate_admin"),
          eq(users.role, "super_admin"),
          eq(users.globalRole, "super_admin"),
        ),
      );
    for (const reviewer of reviewerUsers) {
      if (reviewer?.id) reviewerIds.add(String(reviewer.id));
    }

    const linkedCompanyId = String((updated as any).companyId || "").trim();
    if (linkedCompanyId) {
      const [companyRow] = await db
        .select({ id: companies.id, providerId: companies.providerId })
        .from(companies)
        .where(eq(companies.id, linkedCompanyId))
        .limit(1 as any);
      if (companyRow?.providerId) {
        reviewerIds.add(String(companyRow.providerId));
      }
    }

    if (updated.residentId) reviewerIds.delete(String(updated.residentId));
    if (updated.providerId) reviewerIds.delete(String(updated.providerId));
    reviewerIds.delete(String(providerId));

    for (const reviewerId of reviewerIds) {
      const notification = await storage.createNotification({
        userId: reviewerId,
        title: "Consultancy report awaiting review",
        message: "A provider submitted a report. Review and approve before resident payment can be requested.",
        type: "info",
        metadata: {
          requestId,
          kind: "consultancy_report_review",
        },
      });
      io?.to(`user-${reviewerId}`).emit("notification:new", notification);
    }

    const providerNotification = await storage.createNotification({
      userId: providerId,
      title: "Report submitted for approval",
      message: "Your consultancy report is now pending company/admin review.",
      type: "info",
      metadata: {
        requestId,
        kind: "consultancy_report_submitted",
      },
    });
    io?.to(`user-${providerId}`).emit("notification:new", providerNotification);

    io?.to(`user-${providerId}`).emit("service-request:updated", {
      type: "status",
      requestId,
      request: updated,
      at: new Date().toISOString(),
    });

    return res.status(201).json({ success: true, report, request: updated });
  } catch (error: any) {
    if (error?.name === "ZodError") {
      return res.status(400).json({ error: "Validation error", details: error.errors });
    }
    return res.status(500).json({ error: error?.message || "Failed to submit consultancy report" });
  }
});

// GET /api/provider/company - Get company context for provider route guards/shell
router.get("/company", async (req: any, res) => {
  try {
    const providerId = req.auth?.userId;
    if (!providerId) {
      return res.status(401).json({ error: "Authentication required" });
    }

    // Prefer explicit company linkage on the provider profile.
    // Fall back to ownership lookup for legacy records.
    const provider = await storage.getUser(providerId).catch(() => undefined);
    const companyRef = String(provider?.company || "").trim();

    let company =
      (
        await (companyRef
          ? db
              .select()
              .from(companies)
              .where(or(eq(companies.id, companyRef), eq(companies.name, companyRef)))
              .limit(1)
          : db.select().from(companies).where(eq(companies.providerId, providerId)).limit(1))
      )[0] ?? null;

    if (!company && companyRef) {
      company =
        (
          await db
            .select()
            .from(companies)
            .where(eq(companies.providerId, providerId))
            .limit(1)
        )[0] ?? null;
    }

    if (!company) {
      return res.json(null);
    }

    res.json({
      ...company,
      isOwner: String(company.providerId || "") === String(providerId),
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

const resolveProviderCompany = async (providerId: string) => {
  const provider = await storage.getUser(providerId).catch(() => undefined);
  const companyRef = String(provider?.company || "").trim();

  let company =
    (
      await (companyRef
        ? db
            .select()
            .from(companies)
            .where(or(eq(companies.id, companyRef), eq(companies.name, companyRef)))
            .limit(1)
        : db.select().from(companies).where(eq(companies.providerId, providerId)).limit(1))
    )[0] ?? null;

  if (!company && companyRef) {
    company =
      (
        await db
          .select()
          .from(companies)
          .where(eq(companies.providerId, providerId))
          .limit(1)
      )[0] ?? null;
  }

  return company;
};

router.get("/tasks", async (req: any, res) => {
  try {
    const providerId = req.auth?.userId;
    if (!providerId) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const company = await resolveProviderCompany(providerId);
    const statusFilter = String(req.query.status || "").trim().toLowerCase();
    const filters: any[] = [eq(companyTasks.assigneeId, providerId)];

    if (company?.id) {
      filters.push(eq(companyTasks.companyId, String(company.id)));
    }

    if (statusFilter && statusFilter !== "all") {
      filters.push(eq(companyTasks.status, statusFilter));
    }

    const taskRows = await db
      .select()
      .from(companyTasks)
      .where(and(...filters))
      .orderBy(desc(companyTasks.createdAt));

    if (!taskRows.length) {
      return res.json([]);
    }

    const userIds: string[] = Array.from(
      new Set(
        taskRows
          .flatMap((task: any) => [task.createdBy, task.assigneeId])
          .filter((id: any): id is string => Boolean(id)),
      ),
    );

    const usersById = new Map<string, any>();
    if (userIds.length) {
      const relatedUsers = await db
        .select({
          id: users.id,
          name: users.name,
          email: users.email,
          phone: users.phone,
          isActive: users.isActive,
        })
        .from(users)
        .where(inArray(users.id, userIds));
      for (const row of relatedUsers as any[]) {
        usersById.set(row.id, row);
      }
    }

    const taskIds: string[] = taskRows.map((task: any) => String(task.id));
    const updateRows = await db
      .select()
      .from(companyTaskUpdates)
      .where(inArray(companyTaskUpdates.taskId, taskIds))
      .orderBy(asc(companyTaskUpdates.createdAt));

    const updatesByTask = new Map<string, any[]>();
    for (const update of updateRows as any[]) {
      const bucket = updatesByTask.get(update.taskId) || [];
      bucket.push({
        ...update,
        attachments: Array.isArray(update.attachments) ? update.attachments : [],
        author: usersById.get(update.authorId) ?? null,
      });
      updatesByTask.set(update.taskId, bucket);
    }

    const payload = taskRows.map((task: any) => ({
      ...task,
      creator: usersById.get(task.createdBy) ?? null,
      assignee: task.assigneeId ? usersById.get(task.assigneeId) ?? null : null,
      updates: updatesByTask.get(task.id) || [],
    }));

    res.json(payload);
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to fetch provider tasks" });
  }
});

router.patch("/tasks/:taskId", async (req: any, res) => {
  try {
    const providerId = req.auth?.userId;
    if (!providerId) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const { taskId } = req.params;
    const [task] = await db
      .select()
      .from(companyTasks)
      .where(and(eq(companyTasks.id, taskId), eq(companyTasks.assigneeId, providerId)))
      .limit(1 as any);

    if (!task) {
      return res.status(404).json({ error: "Task not found" });
    }

    const payload = ProviderTaskStatusSchema.parse(req.body || {});
    const updates: Record<string, any> = {
      status: payload.status,
      updatedAt: new Date(),
      completedAt: payload.status === "completed" ? new Date() : null,
    };

    const [updated] = await db
      .update(companyTasks)
      .set(updates)
      .where(eq(companyTasks.id, taskId))
      .returning();

    res.json(updated);
  } catch (error: any) {
    if (error?.name === "ZodError") {
      return res.status(400).json({ error: "Validation error", details: error.errors });
    }
    res.status(500).json({ error: error.message || "Failed to update task" });
  }
});

router.post("/tasks/:taskId/updates", async (req: any, res) => {
  try {
    const providerId = req.auth?.userId;
    if (!providerId) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const { taskId } = req.params;
    const [task] = await db
      .select()
      .from(companyTasks)
      .where(and(eq(companyTasks.id, taskId), eq(companyTasks.assigneeId, providerId)))
      .limit(1 as any);

    if (!task) {
      return res.status(404).json({ error: "Task not found" });
    }

    const payload = ProviderTaskUpdateSchema.parse(req.body || {});
    const [created] = await db
      .insert(companyTaskUpdates)
      .values({
        taskId,
        authorId: providerId,
        message: payload.message,
        attachments: payload.attachments || [],
      })
      .returning();

    await db
      .update(companyTasks)
      .set({ updatedAt: new Date() })
      .where(eq(companyTasks.id, taskId));

    res.status(201).json(created);
  } catch (error: any) {
    if (error?.name === "ZodError") {
      return res.status(400).json({ error: "Validation error", details: error.errors });
    }
    res.status(500).json({ error: error.message || "Failed to add task update" });
  }
});

// GET /api/provider/marketplace/stores - Provider-safe read-only marketplace stores
router.get("/marketplace/stores", async (_req: any, res) => {
  try {
    const rows = await db
      .select({
        id: stores.id,
        name: stores.name,
        location: stores.location,
        logo: stores.logo,
      })
      .from(stores)
      .where(and(eq(stores.isActive, true), eq(stores.approvalStatus, "approved")))
      .orderBy(asc(stores.name));

    res.json(rows);
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to fetch marketplace stores" });
  }
});

// GET /api/provider/marketplace/categories - Provider-safe read-only categories
router.get("/marketplace/categories", async (_req: any, res) => {
  try {
    const rows = await db
      .select({
        id: itemCategories.id,
        name: itemCategories.name,
      })
      .from(itemCategories)
      .where(eq(itemCategories.isActive, true))
      .orderBy(asc(itemCategories.name));

    res.json(rows);
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to fetch marketplace categories" });
  }
});

// GET /api/provider/marketplace/items - Provider-safe read-only marketplace catalog
router.get("/marketplace/items", async (req: any, res) => {
  try {
    const { search, category, storeId, page = "1", limit = "24" } = req.query as Record<string, string>;

    const pageNumber = Math.max(1, Number.parseInt(page || "1", 10) || 1);
    const pageSize = Math.min(100, Math.max(1, Number.parseInt(limit || "24", 10) || 24));
    const offset = (pageNumber - 1) * pageSize;

    const conditions: any[] = [
      eq(marketplaceItems.isActive, true),
      eq(stores.isActive, true),
      eq(stores.approvalStatus, "approved"),
    ];

    if (storeId?.trim()) {
      conditions.push(eq(marketplaceItems.storeId, storeId.trim()));
    }
    if (category?.trim()) {
      conditions.push(eq(marketplaceItems.category, category.trim()));
    }
    if (search?.trim()) {
      conditions.push(
        or(
          ilike(marketplaceItems.name, `%${search.trim()}%`),
          ilike(marketplaceItems.description, `%${search.trim()}%`)
        )
      );
    }

    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(marketplaceItems)
      .innerJoin(stores, eq(stores.id, marketplaceItems.storeId))
      .where(and(...conditions));

    const rows = await db
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
        isActive: marketplaceItems.isActive,
        createdAt: marketplaceItems.createdAt,
        storeId: marketplaceItems.storeId,
        storeName: stores.name,
        storeLocation: stores.location,
      })
      .from(marketplaceItems)
      .innerJoin(stores, eq(stores.id, marketplaceItems.storeId))
      .where(and(...conditions))
      .orderBy(desc(marketplaceItems.createdAt))
      .limit(pageSize)
      .offset(offset);

    res.json({
      items: rows,
      total: count,
      page: pageNumber,
      totalPages: Math.ceil(count / pageSize),
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to fetch marketplace items" });
  }
});

// Middleware to verify provider has access to a store
const verifyStoreAccess = async (req: any, res: any, next: any) => {
  try {
    const storeId = req.params.id || req.params.storeId;
    let providerId = req.auth?.userId;

    if (!providerId) {
      return res.status(401).json({ error: "Authentication required" });
    }

    // Ensure providerId exists in users table; if not, omit providerId to avoid FK violation
    const providerUser = await storage.getUser(providerId).catch(() => undefined);
    if (!providerUser) {
      providerId = null as any;
    }

    let [membership] = await db.select()
      .from(storeMembers)
      .where(
        and(
          eq(storeMembers.storeId, storeId),
          eq(storeMembers.userId, providerId),
          eq(storeMembers.isActive, true)
        )
      );

    // If no membership found, check if provider is the store owner and auto-add them
    if (!membership && providerId) {
      const [store] = await db.select()
        .from(stores)
        .where(eq(stores.id, storeId));

      if (store && store.ownerId === providerId) {
        // Auto-add store owner as member with full permissions
        await db.insert(storeMembers).values({
          storeId: storeId,
          userId: providerId,
          role: "owner",
          canManageItems: true,
          canManageOrders: true,
          isActive: true
        }).onConflictDoNothing();

        // Fetch the newly created (or existing) membership
        [membership] = await db.select()
          .from(storeMembers)
          .where(
            and(
              eq(storeMembers.storeId, storeId),
              eq(storeMembers.userId, providerId),
              eq(storeMembers.isActive, true)
            )
          );
      }
    }

    if (!membership) {
      return res.status(403).json({ error: "Access denied. You are not a member of this store." });
    }

    req.storeMembership = membership;
    next();
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

const ensureStoreApproved = async (storeId: string, res: any) => {
  const [store] = await db.select().from(stores).where(eq(stores.id, storeId));
  if (!store) {
    res.status(404).json({ error: "Store not found" });
    return null;
  }
  if (store.approvalStatus === "pending") {
    res.status(403).json({
      error: "Store not approved",
      message: "Your store is awaiting admin approval. Please try again later.",
    });
    return null;
  }
  if (store.approvalStatus === "rejected") {
    res.status(403).json({
      error: "Store rejected",
      message: "Your store has been rejected. Please contact support.",
    });
    return null;
  }
  return store;
};

// GET /api/provider/stores - Get all stores I'm a member of
router.get("/stores", async (req: any, res) => {
  try {
    const providerId = req.auth?.userId;

    if (!providerId) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const memberships = await db.select({
      membership: storeMembers,
      store: stores,
    })
      .from(storeMembers)
      .innerJoin(stores, eq(storeMembers.storeId, stores.id))
      .where(
        and(
          eq(storeMembers.userId, providerId),
          eq(storeMembers.isActive, true),
        ),
      );

    const storeIds = memberships.map((m: any) => m.store.id).filter(Boolean);
    const allocationRows = storeIds.length
      ? await db
          .select({
            storeId: storeEstates.storeId,
            estateId: storeEstates.estateId,
            estateName: estates.name,
          })
          .from(storeEstates)
          .leftJoin(estates, eq(storeEstates.estateId, estates.id))
          .where(inArray(storeEstates.storeId, storeIds))
      : [];

    const allocationMap = new Map<string, { count: number; names: string[] }>();
    for (const row of allocationRows) {
      const existing = allocationMap.get(row.storeId) || { count: 0, names: [] };
      existing.count += 1;
      if (row.estateName && !existing.names.includes(row.estateName)) {
        existing.names.push(row.estateName);
      }
      allocationMap.set(row.storeId, existing);
    }

    res.json(
      memberships.map((m: any) => {
        const allocation = allocationMap.get(m.store.id);
        return {
          ...m.store,
          estateAllocationCount: allocation?.count || 0,
          estateNames: allocation?.names || [],
          hasEstateAllocation: (allocation?.count || 0) > 0 || Boolean(m.store.estateId),
          membership: {
            role: m.membership.role,
            canManageItems: m.membership.canManageItems,
            canManageOrders: m.membership.canManageOrders,
          },
        };
      }),
    );
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/provider/stores - Create a new store (self-registration)
router.post("/stores", async (req: any, res) => {
  try {
    const providerId = req.auth?.userId;
    
    if (!providerId) {
      return res.status(401).json({ error: "Authentication required" });
    }
    
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

const inventoryImageUploadParser = raw({
  type: ["image/jpeg", "image/png", "image/webp"],
  limit: "5mb",
});

// POST /api/provider/stores/:id/items/images - Upload inventory image and return a clean URL reference
router.post("/stores/:id/items/images", verifyStoreAccess, inventoryImageUploadParser, async (req: any, res) => {
  try {
    const storeId = String(req.params.id || "").trim();
    const providerId = String(req.auth?.userId || "").trim();
    const membership = req.storeMembership;

    if (!providerId) {
      return res.status(401).json({ error: "Authentication required" });
    }

    if (!membership?.canManageItems) {
      return res.status(403).json({ error: "You don't have permission to manage items for this store" });
    }

    const approvedStore = await ensureStoreApproved(storeId, res);
    if (!approvedStore) return;

    const rawContentType = String(req.headers["content-type"] || "");
    const mimeType = rawContentType.split(";")[0].trim().toLowerCase();

    if (!Buffer.isBuffer(req.body) || !req.body.length) {
      return res.status(400).json({ error: "Image file is required" });
    }

    const uploaded = await persistInventoryImage({
      buffer: req.body,
      mimeType,
      storeId,
      uploaderId: providerId,
    });

    return res.status(201).json(uploaded);
  } catch (error: any) {
    return res.status(400).json({ error: error?.message || "Failed to upload image" });
  }
});

// GET /api/provider/stores/:id/items - Get all items for my store
router.get("/stores/:id/items", verifyStoreAccess, async (req: any, res) => {
  try {
    const storeId = req.params.id;
    const { search, category, isActive } = req.query;
    const approvedStore = await ensureStoreApproved(storeId, res);
    if (!approvedStore) return;

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

    const approvedStore = await ensureStoreApproved(storeId, res);
    if (!approvedStore) return;

    // Get first allocated estate for this store
    let [storeEstate] = await db.select()
      .from(storeEstates)
      .where(eq(storeEstates.storeId, storeId))
      .limit(1);

    if (!storeEstate && approvedStore?.estateId) {
      const allocatedBy = approvedStore.ownerId || providerId;
      await db.insert(storeEstates)
        .values({
          storeId,
          estateId: approvedStore.estateId,
          allocatedBy,
        })
        .onConflictDoNothing();
      storeEstate = { storeId, estateId: approvedStore.estateId } as typeof storeEstates.$inferSelect;
    }

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
    const normalizedImages = await normalizeAndPersistInventoryImages({
      images: validated.images,
      storeId,
      uploaderId: providerId,
    });

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
      images: normalizedImages,
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
    const approvedStore = await ensureStoreApproved(storeId, res);
    if (!approvedStore) return;

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
    const normalizedImages = await normalizeAndPersistInventoryImages({
      images: validated.images,
      storeId,
      uploaderId: String(req.auth?.userId || ""),
    });

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
    if (normalizedImages !== undefined) updateData.images = normalizedImages;
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
    const approvedStore = await ensureStoreApproved(storeId, res);
    if (!approvedStore) return;

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

// GET /api/provider/stores/:id/orders - Get all orders for this store
router.get("/stores/:id/orders", verifyStoreAccess, async (req: any, res) => {
  try {
    const storeId = req.params.id;
    const membership = req.storeMembership;
    if (!membership?.canManageOrders) {
      return res.status(403).json({
        error: "Orders access restricted",
        message: "Your role can view this store but cannot manage orders.",
      });
    }

    const approvedStore = await ensureStoreApproved(storeId, res);
    if (!approvedStore) return;

    const rows = await db
      .select({
        order: orders,
        buyer: users,
      })
      .from(orders)
      .leftJoin(users, eq(orders.buyerId, users.id))
      .where(eq(orders.storeId, storeId))
      .orderBy(desc(orders.createdAt));

    res.json(
      rows.map(
        (row: { order: typeof orders.$inferSelect; buyer: typeof users.$inferSelect | null }) => ({
          ...row.order,
          buyerName: row.buyer?.name || row.buyer?.email || null,
        }),
      ),
    );
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/provider/company-registration - Register new company profile
router.post("/company-registration", async (req: any, res) => {
  try {
    const providerId = req.auth?.userId;

    if (!providerId) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const provider = await storage.getUser(providerId);
    if (provider?.company) {
      return res
        .status(403)
        .json({ error: "You must leave your current company to create a new one." });
    }

    const [ownedCompany] = await db
      .select({ id: companies.id })
      .from(companies)
      .where(eq(companies.providerId, providerId))
      .limit(1);
    if (ownedCompany) {
      return res
        .status(403)
        .json({ error: "You must leave your current company to create a new one." });
    }

    const [activeMembership] = await db
      .select({ id: storeMembers.id })
      .from(storeMembers)
      .where(
        and(
          eq(storeMembers.userId, providerId),
          eq(storeMembers.isActive, true),
        ),
      )
      .limit(1);
    if (activeMembership) {
      return res
        .status(403)
        .json({ error: "You must leave your current company to create a new one." });
    }

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
      details: detailsPayload,
      isActive: false,
      providerId,
      submittedAt: new Date(),
    });

    await storage.updateUser(providerId, { company: createdCompany.id } as any);

    res.status(201).json(createdCompany);
  } catch (error: any) {
    if (error?.name === "ZodError") {
      return res.status(400).json({ error: "Validation error", details: error.errors });
    }
    res.status(500).json({ error: error.message });
  }
});

export default router;

