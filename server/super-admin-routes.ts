// server/super-admin-routes.ts
import { Router, type Response, type NextFunction } from "express";
import { z } from "zod";
import { storage } from "./storage";
// Use default import for runtime members, and type-only for AdminRequest
import AdminAuth, { type AdminRequest } from "./admin-auth";

// Destructure the guards you need from the default export
const { authenticateAdmin, requireSuperAdmin } = AdminAuth;

const router = Router();

/**
 * GET /api/super-admin/service-requests
 * List all service requests (optionally filter by status/category and simple "q" search)
 */
router.get(
  "/service-requests",
  authenticateAdmin,
  requireSuperAdmin,
  async (req: AdminRequest, res: Response, next: NextFunction) => {
    try {
      const { status, category, q } = req.query as Record<string, string | undefined>;

      // Backing call from your storage bridge
      let rows = await storage.getAllServiceRequests();

      if (status) rows = rows.filter((r: any) => r.status === status);
      if (category) rows = rows.filter((r: any) => r.category === category);

      if (q && q.trim()) {
        const needle = q.trim().toLowerCase();
        rows = rows.filter((r: any) =>
          (r.description ?? "").toLowerCase().includes(needle) ||
          (r.category ?? "").toLowerCase().includes(needle) ||
          (r.id ?? "").toLowerCase().includes(needle)
        );
      }

      res.json(rows);
    } catch (e) {
      next(e);
    }
  }
);

/**
 * GET /api/super-admin/service-requests/:id
 * Fetch a single request
 */
router.get(
  "/service-requests/:id",
  authenticateAdmin,
  requireSuperAdmin,
  async (req: AdminRequest, res: Response, next: NextFunction) => {
    try {
      const row = await storage.getServiceRequest(req.params.id);
      if (!row) return res.status(404).json({ message: "Service request not found" });
      res.json(row);
    } catch (e) {
      next(e);
    }
  }
);

/**
 * PATCH /api/super-admin/service-requests/:id/assign
 * Assign a provider to a request
 */
router.patch(
  "/service-requests/:id/assign",
  authenticateAdmin,
  requireSuperAdmin,
  async (req: AdminRequest, res: Response, next: NextFunction) => {
    try {
      const body = z.object({ providerId: z.string().min(1) }).parse(req.body);
      const updated = await storage.assignServiceRequest(req.params.id, body.providerId);
      if (!updated) return res.status(404).json({ message: "Service request not found" });
      res.json(updated);
    } catch (e) {
      next(e);
    }
  }
);

/**
 * PATCH /api/super-admin/service-requests/:id/status
 * Update the status (and optional close reason)
 */
router.patch(
  "/service-requests/:id/status",
  authenticateAdmin,
  requireSuperAdmin,
  async (req: AdminRequest, res: Response, next: NextFunction) => {
    try {
      const body = z
        .object({
          status: z.enum(["pending", "assigned", "in_progress", "completed", "cancelled"]),
          closeReason: z.string().optional(),
        })
        .parse(req.body);

      const updates: Record<string, any> = {
        status: body.status,
      };
      if (body.closeReason) updates.close_reason = body.closeReason;
      if (body.status === "completed" || body.status === "cancelled") {
        // optional: mark closed timestamp if your table uses it
        updates.closed_at = new Date();
      }

      const updated = await storage.updateServiceRequest(req.params.id, updates);
      if (!updated) return res.status(404).json({ message: "Service request not found" });
      res.json(updated);
    } catch (e) {
      next(e);
    }
  }
);

export default router;
