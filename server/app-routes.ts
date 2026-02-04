// server/app-routes.ts
import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { storage } from "./storage";
import { db } from "./db";
import { and, asc, desc, eq } from "drizzle-orm";
import { aiConversationFlowSettings, conversationMessages, conversations, insertServiceRequestSchema, memberships } from "@shared/schema";
import { requireAuth, requireResident } from "./auth-middleware";

const router = Router();

// Legacy dev-login endpoint - DEPRECATED - Use /api/auth/login instead
router.post("/dev-login", async (req: Request, res: Response) => {
  res.status(410).json({ 
    error: "This endpoint is deprecated. Please use /api/auth/login instead.",
    migration_guide: {
      old: "POST /api/app/dev-login",
      new: "POST /api/auth/login",
      body: {
        username: "email or access code",
        password: "password"
      }
    }
  });
});

// Legacy logout endpoint - DEPRECATED - Use /api/auth/logout instead
router.post("/logout", (req, res) => {
  res.status(410).json({ 
    error: "This endpoint is deprecated. Please use /api/auth/logout instead.",
    migration_guide: {
      old: "POST /api/app/logout",
      new: "POST /api/auth/logout",
      body: {
        refreshToken: "your refresh token"
      }
    }
  });
});

// Service request validation schema
const ResidentServiceRequestSchema = z.object({
  category: z.string().min(1),
  description: z.string().min(10),
  urgency: z.enum(["low", "medium", "high", "emergency"]),
  preferredTime: z.string().optional(),
  specialInstructions: z.string().optional(),
  budget: z.string().optional(),
  location: z.string().optional(),
  latitude: z.preprocess(
    (value) => (typeof value === "string" && value.length ? Number(value) : value),
    z.number().optional(),
  ),
  longitude: z.preprocess(
    (value) => (typeof value === "string" && value.length ? Number(value) : value),
    z.number().optional(),
  ),
});

const ConversationCreateSchema = z.object({
  category: z.string().min(1),
});

const ConversationMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  type: z.enum(["text", "image"]).optional(),
  content: z.string().min(1),
  meta: z.any().optional(),
});

const ConversationUpdateSchema = z.object({
  status: z.enum(["active", "closed"]),
});

// Public endpoint: Get enabled categories for resident category selection
router.get("/categories", async (req: Request, res: Response) => {
  try {
    const categories = await db
      .select()
      .from(aiConversationFlowSettings)
      .where(eq(aiConversationFlowSettings.isEnabled, true))
      .orderBy(asc(aiConversationFlowSettings.displayOrder));

    res.json(categories);
  } catch (error: any) {
    console.error("GET /categories error", error);
    res.status(500).json({ error: error.message || "Failed to fetch categories" });
  }
});

// Create a service request - requires authentication
router.post("/service-requests", requireAuth, async (req: Request, res: Response) => {
  try {
    // Get user ID from JWT auth
    const userId = req.auth?.userId;
    if (!userId) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const parsed = ResidentServiceRequestSchema.parse(req.body || {});
    const user = await storage.getUser(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Get user's estate if they have one
    let userEstateId: string | null = null;
    try {
      const userMemberships = await db
        .select({ estateId: memberships.estateId })
        .from(memberships)
        .where(eq(memberships.userId, userId))
        .limit(1);
      if (userMemberships.length > 0) {
        userEstateId = userMemberships[0].estateId;
      }
    } catch (e) {
      // silently fail if memberships table doesn't exist or query fails
    }

    const payload = insertServiceRequestSchema.parse({
      category: parsed.category,
      description: parsed.description,
      residentId: userId,
      urgency: parsed.urgency,
      status: "pending",
      budget: parsed.budget || "Not provided",
      location: parsed.location || user.location || "Not specified",
      latitude: parsed.latitude ?? null,
      longitude: parsed.longitude ?? null,
      preferredTime: parsed.preferredTime
        ? new Date(parsed.preferredTime)
        : null,
      specialInstructions: parsed.specialInstructions || null,
      estateId: userEstateId || undefined,
    });

    const created = await storage.createServiceRequest(payload);
    
    // Broadcast new service request to SSE clients (for admin dashboard real-time updates)
    try {
      // @ts-ignore
      if (global.__serviceRequestSseClients && Array.isArray(global.__serviceRequestSseClients)) {
        const ssePayload = { type: "created", request: created };
        const data = JSON.stringify(ssePayload);
        // @ts-ignore
        for (const c of global.__serviceRequestSseClients) {
          try {
            c.res.write(`event: service-request\n`);
            c.res.write(`data: ${data}\n\n`);
          } catch (e) {
            // ignore
          }
        }
      }
    } catch (e) {
      console.error("Failed to broadcast service-request created event", e);
    }
    
    res.status(201).json(created);
  } catch (error: any) {
    if (error?.issues) {
      return res.status(400).json({
        error: "Validation error",
        details: error.issues.map((issue: any) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      });
    }
    console.error("POST /service-requests error", error);
    res.status(500).json({ error: error.message || "Failed to create service request" });
  }
});

// Get user's own service requests
router.get("/service-requests/mine", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.auth?.userId;
    if (!userId) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const all = await storage.getAllServiceRequests();
    const mine = all.filter((r: any) => r.residentId === userId);

    console.log(`[app] /service-requests/mine -> userId=${userId} count=${mine.length}`);
    return res.json(mine);
  } catch (e: any) {
    console.error("GET /service-requests/mine error", e);
    res.status(500).json({ error: e.message });
  }
});

// Conversation endpoints (resident only)
router.get("/conversations/mine", requireAuth, requireResident, async (req: Request, res: Response) => {
  try {
    const userId = req.auth?.userId;
    if (!userId) return res.status(401).json({ error: "Authentication required" });

    const category = (req.query.category || "").toString().trim();
    let query = db
      .select({
        id: conversations.id,
        category: conversations.category,
        status: conversations.status,
        createdAt: conversations.createdAt,
        updatedAt: conversations.updatedAt,
      })
      .from(conversations)
      .where(eq(conversations.residentId, userId));

    if (category) {
      query = query.where(and(eq(conversations.residentId, userId), eq(conversations.category, category)));
    }

    const rows = await query.orderBy(desc(conversations.updatedAt));
    res.json(rows);
  } catch (error: any) {
    console.error("GET /conversations/mine error", error);
    res.status(500).json({ error: error.message || "Failed to load conversations" });
  }
});

router.post("/conversations", requireAuth, requireResident, async (req: Request, res: Response) => {
  try {
    const userId = req.auth?.userId;
    if (!userId) return res.status(401).json({ error: "Authentication required" });

    const parsed = ConversationCreateSchema.parse(req.body || {});
    const existing = await db
      .select()
      .from(conversations)
      .where(and(
        eq(conversations.residentId, userId),
        eq(conversations.category, parsed.category),
        eq(conversations.status, "active"),
      ))
      .limit(1);

    if (existing.length > 0) return res.json(existing[0]);

    const inserted = await db
      .insert(conversations)
      .values({
        residentId: userId,
        category: parsed.category,
        status: "active",
      })
      .returning();

    return res.status(201).json(inserted[0]);
  } catch (error: any) {
    if (error?.issues) {
      return res.status(400).json({ error: "Validation error", details: error.issues });
    }
    console.error("POST /conversations error", error);
    res.status(500).json({ error: error.message || "Failed to create conversation" });
  }
});

router.get("/conversations/:conversationId/messages", requireAuth, requireResident, async (req: Request, res: Response) => {
  try {
    const userId = req.auth?.userId;
    if (!userId) return res.status(401).json({ error: "Authentication required" });

    const conversationId = req.params.conversationId;
    const convo = await db
      .select()
      .from(conversations)
      .where(eq(conversations.id, conversationId))
      .limit(1);

    if (convo.length === 0) return res.status(404).json({ error: "Conversation not found" });
    if (convo[0].residentId !== userId) return res.status(403).json({ error: "Forbidden" });

    const rows = await db
      .select()
      .from(conversationMessages)
      .where(eq(conversationMessages.conversationId, conversationId))
      .orderBy(asc(conversationMessages.createdAt));

    res.json(rows);
  } catch (error: any) {
    console.error("GET /conversations/:id/messages error", error);
    res.status(500).json({ error: error.message || "Failed to load messages" });
  }
});

router.post("/conversations/:conversationId/messages", requireAuth, requireResident, async (req: Request, res: Response) => {
  try {
    const userId = req.auth?.userId;
    if (!userId) return res.status(401).json({ error: "Authentication required" });

    const conversationId = req.params.conversationId;
    const convo = await db
      .select()
      .from(conversations)
      .where(eq(conversations.id, conversationId))
      .limit(1);

    if (convo.length === 0) return res.status(404).json({ error: "Conversation not found" });
    if (convo[0].residentId !== userId) return res.status(403).json({ error: "Forbidden" });

    const parsed = ConversationMessageSchema.parse(req.body || {});
    const inserted = await db
      .insert(conversationMessages)
      .values({
        conversationId,
        role: parsed.role,
        type: parsed.type || "text",
        content: parsed.content,
        meta: parsed.meta ?? null,
      })
      .returning();

    await db
      .update(conversations)
      .set({ updatedAt: new Date() })
      .where(eq(conversations.id, conversationId));

    res.status(201).json(inserted[0]);
  } catch (error: any) {
    if (error?.issues) {
      return res.status(400).json({ error: "Validation error", details: error.issues });
    }
    console.error("POST /conversations/:id/messages error", error);
    res.status(500).json({ error: error.message || "Failed to save message" });
  }
});

router.patch("/conversations/:conversationId", requireAuth, requireResident, async (req: Request, res: Response) => {
  try {
    const userId = req.auth?.userId;
    if (!userId) return res.status(401).json({ error: "Authentication required" });

    const conversationId = req.params.conversationId;
    const convo = await db
      .select()
      .from(conversations)
      .where(eq(conversations.id, conversationId))
      .limit(1);

    if (convo.length === 0) return res.status(404).json({ error: "Conversation not found" });
    if (convo[0].residentId !== userId) return res.status(403).json({ error: "Forbidden" });

    const parsed = ConversationUpdateSchema.parse(req.body || {});
    const updated = await db
      .update(conversations)
      .set({ status: parsed.status, updatedAt: new Date() })
      .where(eq(conversations.id, conversationId))
      .returning();

    res.json(updated[0]);
  } catch (error: any) {
    if (error?.issues) {
      return res.status(400).json({ error: "Validation error", details: error.issues });
    }
    console.error("PATCH /conversations/:id error", error);
    res.status(500).json({ error: error.message || "Failed to update conversation" });
  }
});

// Get single service request
router.get("/service-requests/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.auth?.userId;
    if (!userId) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const all = await storage.getAllServiceRequests();
    const row = all.find((r: any) => r.id === req.params.id);
    if (!row) return res.status(404).json({ error: "Not found" });
    if (row.residentId !== userId) return res.status(403).json({ error: "Forbidden" });

    return res.json(row);
  } catch (e: any) {
    console.error("GET /service-requests/:id error", e);
    res.status(500).json({ error: e.message });
  }
});

// Wallet endpoints
router.get("/wallet", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.auth?.userId;
    if (!userId) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const wallet = await storage.getWalletByUserId(userId);
    if (!wallet) {
      // Create wallet with default 300 coins if not exists
      const newWallet = await storage.createWallet({
        userId,
        balance: "300",
        currency: "NGN"
      });
      return res.json({ coins: 300 });
    }

    res.json({ coins: Number(wallet.balance) });
  } catch (error: any) {
    console.error("GET /wallet error", error);
    res.status(500).json({ error: error.message });
  }
});

router.post("/wallet/spend", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.auth?.userId;
    if (!userId) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const { amount, reason } = req.body;
    if (typeof amount !== "number" || amount !== 100) {
      return res.status(400).json({ error: "Invalid amount. Must be 100 coins." });
    }

    const wallet = await storage.getWalletByUserId(userId);
    if (!wallet) {
      return res.status(404).json({ error: "Wallet not found" });
    }

    const currentBalance = Number(wallet.balance);
    if (currentBalance < amount) {
      return res.status(400).json({ error: "Insufficient coins", coins: currentBalance });
    }

    const newBalance = currentBalance - amount;
    await storage.updateWalletBalance(userId, newBalance.toString());

    res.json({ ok: true, coins: newBalance, reason });
  } catch (error: any) {
    console.error("POST /wallet/spend error", error);
    res.status(500).json({ error: error.message });
  }
});

// Get recent service requests for resident
router.get("/service-requests/mine", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.auth?.userId;
    if (!userId) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const limit = parseInt(req.query.limit as string) || 5;
    const requests = await storage.getServiceRequestsByResident(userId);
    res.json(requests.slice(0, limit));
  } catch (error: any) {
    console.error("GET /service-requests/mine error", error);
    res.status(500).json({ error: error.message });
  }
});

// Resident dashboard stats endpoint
router.get("/dashboard/stats", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.auth?.userId;
    if (!userId) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const requests = await storage.getServiceRequestsByResident(userId);
    
    // Calculate stats from service requests
    const completedRequests = requests.filter((r: any) => r.status === "completed");
    const activeContracts = requests.filter((r: any) => 
      r.status === "in_progress" || r.status === "assigned"
    );
    const pendingRequests = requests.filter((r: any) => r.status === "pending");
    
    // Calculate change percentages (comparing last 30 days vs previous 30 days)
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
    
    const recentCompleted = completedRequests.filter((r: any) => 
      new Date(r.createdAt) >= thirtyDaysAgo
    );
    const previousCompleted = completedRequests.filter((r: any) => {
      const created = new Date(r.createdAt);
      return created >= sixtyDaysAgo && created < thirtyDaysAgo;
    });
    
    const completedChangePercent = previousCompleted.length > 0 
      ? Math.round(((recentCompleted.length - previousCompleted.length) / previousCompleted.length) * 100)
      : recentCompleted.length > 0 ? 100 : 0;

    const recentActive = activeContracts.filter((r: any) => 
      new Date(r.createdAt) >= thirtyDaysAgo
    );
    const previousActive = activeContracts.filter((r: any) => {
      const created = new Date(r.createdAt);
      return created >= sixtyDaysAgo && created < thirtyDaysAgo;
    });
    
    const contractsChangePercent = previousActive.length > 0 
      ? Math.round(((recentActive.length - previousActive.length) / previousActive.length) * 100)
      : recentActive.length > 0 ? 100 : 0;

    // Find next scheduled maintenance (pending requests with preferredTime in future)
    const scheduledMaintenance = requests
      .filter((r: any) => 
        r.status === "pending" && 
        r.preferredTime && 
        new Date(r.preferredTime) > now
      )
      .sort((a: any, b: any) => 
        new Date(a.preferredTime).getTime() - new Date(b.preferredTime).getTime()
      );

    const nextMaintenance = scheduledMaintenance.length > 0 
      ? scheduledMaintenance[0].category || "Scheduled maintenance"
      : null;
    
    const nextMaintenanceCost = scheduledMaintenance.length > 0 && scheduledMaintenance[0].budget
      ? parseFloat(scheduledMaintenance[0].budget) || null
      : null;

    res.json({
      maintenanceScheduleCount: scheduledMaintenance.length,
      nextMaintenance,
      nextMaintenanceCost,
      activeContractsCount: activeContracts.length,
      contractsChangePercent,
      completedRequestsCount: completedRequests.length,
      completedChangePercent,
      pendingRequestsCount: pendingRequests.length,
      totalRequestsCount: requests.length,
    });
  } catch (error: any) {
    console.error("GET /dashboard/stats error", error);
    res.status(500).json({ error: error.message || "Failed to load dashboard stats" });
  }
});

// Update resident profile
router.patch("/profile", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.auth?.userId;
    if (!userId) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const { firstName, lastName, email, phone, profileImage, bio, website, username } = req.body;
    
    const updates: any = {};
    if (firstName !== undefined) updates.firstName = firstName;
    if (lastName !== undefined) updates.lastName = lastName;
    if (email !== undefined) updates.email = email;
    if (phone !== undefined) updates.phone = phone;
    if (profileImage !== undefined) updates.profileImage = profileImage;
    if (bio !== undefined) updates.bio = bio;
    if (website !== undefined) updates.website = website;
    if (username !== undefined) updates.username = username;
    
    // Also update name as combined first + last
    if (firstName !== undefined || lastName !== undefined) {
      const user = await storage.getUser(userId);
      const newFirst = firstName ?? user?.firstName ?? "";
      const newLast = lastName ?? user?.lastName ?? "";
      updates.name = `${newFirst} ${newLast}`.trim();
    }

    const updated = await storage.updateUser(userId, updates);
    if (!updated) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({
      id: updated.id,
      firstName: updated.firstName,
      lastName: updated.lastName,
      name: updated.name,
      email: updated.email,
      phone: updated.phone,
      profileImage: updated.profileImage,
    });
  } catch (error: any) {
    console.error("PATCH /profile error", error);
    res.status(500).json({ error: error.message || "Failed to update profile" });
  }
});

// Get resident profile
router.get("/profile", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.auth?.userId;
    if (!userId) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const user = await storage.getUser(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      name: user.name,
      email: user.email,
      phone: user.phone,
      location: user.location,
      profileImage: user.profileImage,
      role: user.role,
    });
  } catch (error: any) {
    console.error("GET /profile error", error);
    res.status(500).json({ error: error.message || "Failed to load profile" });
  }
});

export default router;
