// server/super-admin-routes.ts
import { Router, type Response, type NextFunction } from "express";
import { z } from "zod";
import { storage } from "./storage";
import {
  authenticateAdmin,          // your JWT auth
  requireSuperAdmin,          // <-- you already have this
  type AdminRequest,
} from "./admin-auth";

const router = Router();

// list service requests
router.get(
  "/service-requests",
  authenticateAdmin,
  requireSuperAdmin, // <-- use your guard here
  async (req: AdminRequest, res: Response, next: NextFunction) => {
    try {
      const { status, category, q } = req.query as Record<string, string>;
      const rows = await storage.getArtisanRequests({ status, category, q });
      res.json(rows);
    } catch (e) { next(e); }
  }
);

// get one request (inspection/bill/messages included)
router.get(
  "/service-requests/:id",
  authenticateAdmin,
  requireSuperAdmin,
  async (req, res, next) => {
    try {
      const data = await storage.getServiceRequestFull(req.params.id);
      if (!data) return res.status(404).json({ message: "Not found" });
      res.json(data);
    } catch (e) { next(e); }
  }
);

// assign provider
router.patch(
  "/service-requests/:id/assign",
  authenticateAdmin,
  requireSuperAdmin,
  async (req, res, next) => {
    try {
      const body = z.object({ providerId: z.string().min(1) }).parse(req.body);
      const updated = await storage.assignProviderToRequest(req.params.id, body.providerId);
      if (!updated) return res.status(404).json({ message: "Request not found" });
      res.json(updated);
    } catch (e) { next(e); }
  }
);

// update status
router.patch(
  "/service-requests/:id/status",
  authenticateAdmin,
  requireSuperAdmin,
  async (req, res, next) => {
    try {
      const body = z.object({
        status: z.enum(["pending","assigned","in_progress","completed","cancelled"]),
        closeReason: z.string().optional(),
      }).parse(req.body);
      const updated = await storage.updateRequestStatus(req.params.id, body.status as any, body.closeReason);
      if (!updated) return res.status(404).json({ message: "Request not found" });
      res.json(updated);
    } catch (e) { next(e); }
  }
);

// inspection
router.post(
  "/service-requests/:id/inspection",
  authenticateAdmin,
  requireSuperAdmin,
  async (req: AdminRequest, res, next) => {
    try {
      const body = z.object({
        summary: z.string().min(1),
        findings: z.string().optional(),
        recommendedWork: z.string().optional(),
        estimatedCost: z.string().optional(),
      }).parse(req.body);

      const row = await storage.createInspection(req.params.id, {
        ...body,
        createdByAdminId: req.adminUser?.id, // from your JWT payload
      });
      res.status(201).json(row);
    } catch (e) { next(e); }
  }
);

// billing
router.post(
  "/service-requests/:id/bill",
  authenticateAdmin,
  requireSuperAdmin,
  async (req, res, next) => {
    try {
      const body = z.object({
        currency: z.string().default("NGN"),
        taxRate: z.number().optional(),
        status: z.enum(["draft","issued","paid","cancelled"]).optional(),
        items: z.array(z.object({
          label: z.string().min(1),
          quantity: z.number().int().positive(),
          unitPrice: z.string().regex(/^\d+(\.\d{1,2})?$/),
        })).min(1),
      }).parse(req.body);

      const result = await storage.createOrUpdateBill(req.params.id, body);
      res.status(201).json(result);
    } catch (e) { next(e); }
  }
);

// messages
router.get(
  "/service-requests/:id/messages",
  authenticateAdmin,
  requireSuperAdmin,
  async (req, res, next) => {
    try { res.json(await storage.getRequestMessages(req.params.id)); }
    catch (e) { next(e); }
  }
);

router.post(
  "/service-requests/:id/messages",
  authenticateAdmin,
  requireSuperAdmin,
  async (req: AdminRequest, res, next) => {
    try {
      const body = z.object({
        message: z.string().min(1),
        attachmentUrl: z.string().url().optional(),
      }).parse(req.body);
      const row = await storage.addRequestMessage(
        req.params.id,
        req.adminUser!.id,
        "admin",
        body.message,
        body.attachmentUrl
      );
      res.status(201).json(row);
    } catch (e) { next(e); }
  }
);

// telematics pointers (bodycam/GPS/mic)
router.get(
  "/providers/:id/telematics",
  authenticateAdmin,
  requireSuperAdmin,
  async (req, res, next) => {
    try { res.json(await storage.getProviderTelematics(req.params.id)); }
    catch (e) { next(e); }
  }
);

export default router;
