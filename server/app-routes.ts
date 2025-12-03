// server/app-routes.ts
import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { storage } from "./storage";
import { insertServiceRequestSchema } from "@shared/schema";
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

    const payload = insertServiceRequestSchema.parse({
      category: parsed.category,
      description: parsed.description,
      residentId: userId,
      urgency: parsed.urgency,
      budget: parsed.budget || "Not provided",
      location: parsed.location || user.location || "Not specified",
      latitude: parsed.latitude ?? null,
      longitude: parsed.longitude ?? null,
      preferredTime: parsed.preferredTime
        ? new Date(parsed.preferredTime)
        : null,
      specialInstructions: parsed.specialInstructions || null,
    });

    const created = await storage.createServiceRequest(payload);
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

export default router;
