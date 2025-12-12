import type { Express } from "express";
import { createServer, type Server } from "http";
import { z } from "zod";
import { setupAuth } from "./auth";
import { storage } from "./storage";
import { db } from "./db";
import { prisma } from "./lib/prisma";
import {
  users,
  serviceRequests,
  insertServiceRequestSchema,
  estates,
  insertEstateSchema,
  auditLogs,
  memberships,
  insertMembershipSchema,
  categories,
  insertCategorySchema,
  stores,
  itemCategories,
  marketplaceItems,
  transactions,
  companies,
  providerRequests,
} from "@shared/schema";
import appRoutes from "./app-routes";
import providerRoutes from "./provider-routes";
import marketplaceRoutes from "./marketplace-routes";
import { randomBytes, scrypt } from "crypto";
import { promisify } from "util";
import { and, count, desc, eq, ilike, or, sum, sql } from "drizzle-orm";
import {
  createMarketplaceItemSchema,
  createProviderSchema,
  providerRequestSchema,
  updateMarketplaceItemSchema,
} from "@shared/admin-schema";
import {
  createPendingPaystackTransaction,
  verifyAndFinalizePaystackCharge,
} from "./payments";
import { validatePaystackSignature } from "./paystack";
import { initializePaystackTransaction } from "./paystackService";
import {
  handlePaystackVerify,
  handlePaystackWebhook,
} from "./paystackHandlers";

const isAdminOrSuper = (req: Express["request"]) =>
  req.isAuthenticated() &&
  (req.user?.role === "admin" || req.user?.globalRole === "super_admin");

// Accept flexible inputs, normalize output types
const CreateServiceRequest = insertServiceRequestSchema.extend({
  preferredTime: z
    .union([
      z.string().datetime().optional(),
      z.string().optional(),
      z.number().optional(),
      z.date().optional(),
      z.null().optional(),
    ])
    .transform((v) => {
      if (v == null || v === "") return null;
      const d = v instanceof Date ? v : new Date(v as any);
      return isNaN(d.getTime()) ? null : d;
    }),
  budget: z
    .preprocess(
      (v) => (v === undefined || v === null || v === "" ? "0" : v),
      z.union([z.string(), z.number()])
    )
    .transform((v) => (typeof v === "number" ? String(v) : v)),
});

const SERVICE_REQUEST_STATUSES = [
  "PENDING",
  "IN_REVIEW",
  "UNDER_REVIEW",
  "ASSIGNED",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
  "REJECTED",
];

async function findEstateMembership(userId: string, estateId: string) {
  return prisma.membership.findFirst({
    where: {
      userId,
      estateId,
      status: {
        not: "REJECTED",
      },
    },
  });
}

function formatEstateFromMembership(membership: { estateId: string; estate?: { id: string; name: string; slug: string } | null; role: string; status: string; isPrimary: boolean }) {
  const estate = membership.estate;
  return {
    id: estate?.id ?? membership.estateId,
    slug: estate?.slug ?? "",
    name: estate?.name ?? "Untitled estate",
    role: membership.role,
    status: membership.status,
    isPrimary: membership.isPrimary,
  };
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Setup authentication routes
  setupAuth(app);

  // Debug endpoint (DEV ONLY): check Paystack secret key loading
  app.get("/api/debug/paystack-key", (req, res) => {
    const key = process.env.PAYSTACK_SECRET_KEY || "";
    const masked = key.length > 14 ? `${key.slice(0, 10)}...${key.slice(-4)}` : "[NOT SET]";
    res.json({
      keyLoaded: !!key,
      masked,
      length: key.length,
      envFileCheck: "Check .env.local in repo root",
    });
  });

  app.use("/api/app", appRoutes);
  app.use("/api/provider", providerRoutes);
  app.use("/api/marketplace", marketplaceRoutes);

  // Password hashing helper (mirror of auth.ts)
  const scryptAsync = promisify(scrypt);
  async function hashPassword(password: string) {
    const salt = randomBytes(16).toString("hex");
    const buf = (await scryptAsync(password, salt, 64)) as Buffer;
    return `${buf.toString("hex")}.${salt}`;
  }

  // Service Requests Routes
  app.post("/api/service-requests", async (req, res, next) => {
    try {
      if (!req.isAuthenticated() || req.user?.role !== "resident") {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const parsed = CreateServiceRequest.parse({
        ...req.body,
        residentId: req.user.id,
      });

      const created = await storage.createServiceRequest(parsed);
      return res.status(201).json(created);
    } catch (error: any) {
      if (error?.issues) {
        return res.status(400).json({
          error: "Validation error",
          details: error.issues.map((i: any) => ({
            path: i.path.join("."),
            message: i.message,
            expected: i.expected,
            received: i.received,
            code: i.code,
          })),
        });
      }
      next(error);
    }
  });

  app.get("/api/service-requests", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { status } = req.query;
      let requests;

      if (req.user?.role === "resident") {
        requests = await storage.getServiceRequestsByResident(req.user.id);
      } else if (req.user?.role === "provider") {
        if (status === "available") {
          requests = await storage.getAvailableServiceRequests(req.user.serviceCategory || undefined);
        } else {
          requests = await storage.getServiceRequestsByProvider(req.user.id);
        }
      } else if (req.user?.role === "admin") {
        requests = await storage.getAllServiceRequests();
      }

      res.json(requests || []);
    } catch (error) {
      next(error);
    }
  });

  app.patch("/api/service-requests/:id", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { id } = req.params;
      const updates = req.body;

      const serviceRequest = await storage.updateServiceRequest(id, updates);
      if (!serviceRequest) {
        return res.status(404).json({ message: "Service request not found" });
      }

      res.json(serviceRequest);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/service-requests/:id/accept", async (req, res, next) => {
    try {
      if (!req.isAuthenticated() || req.user?.role !== "provider") {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { id } = req.params;
      const serviceRequest = await storage.assignServiceRequest(id, req.user.id);

      if (!serviceRequest) {
        return res.status(404).json({ message: "Service request not found" });
      }

      res.json(serviceRequest);
    } catch (error) {
      next(error);
    }
  });

  // Admin: Send advice with inspection dates/times to resident
  app.post("/api/admin/service-requests/:id/advice", async (req, res, next) => {
    try {
      if (!req.isAuthenticated() || req.user?.role !== "admin") {
        return res.status(401).json({ message: "Unauthorized - Admin only" });
      }

      const { id } = req.params;
      const { message, inspectionDates, inspectionTimes } = req.body;

      if (!message || !inspectionDates || !Array.isArray(inspectionDates)) {
        return res.status(400).json({ message: "Message and inspection dates are required" });
      }

      // Update the service request with advice metadata
      const updated = await storage.updateServiceRequest(id, {
        adviceMessage: message,
        inspectionDates,
        inspectionTimes: inspectionTimes || [],
      });

      if (!updated) {
        return res.status(404).json({ message: "Service request not found" });
      }

      // TODO: Send notification/email to the resident
      res.json({ success: true, message: "Advice sent successfully", request: updated });
    } catch (error) {
      next(error);
    }
  });

  // Admin: Assign provider to a service request
  app.post("/api/admin/service-requests/:id/assign", async (req, res, next) => {
    try {
      if (!req.isAuthenticated() || req.user?.role !== "admin") {
        return res.status(401).json({ message: "Unauthorized - Admin only" });
      }

      const { id } = req.params;
      const { providerId } = req.body;

      if (!providerId) {
        return res.status(400).json({ message: "Provider ID is required" });
      }

      const serviceRequest = await storage.assignServiceRequest(id, providerId);

      if (!serviceRequest) {
        return res.status(404).json({ message: "Service request not found" });
      }

      // TODO: Send notification to the assigned provider
      res.json({ success: true, message: "Provider assigned successfully", request: serviceRequest });
    } catch (error) {
      next(error);
    }
  });

  // Legacy-friendly Prisma-backed endpoints for the new requests view
  app.get("/api/my-estates", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const memberships = await prisma.membership.findMany({
        where: {
          userId: req.user.id,
          status: {
            not: "REJECTED",
          },
        },
        include: {
          estate: true,
        },
        orderBy: {
          isPrimary: "desc",
        },
      });

      res.json(memberships.map(formatEstateFromMembership));
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/estates/:estateId/requests", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { estateId } = req.params;
      if (!estateId) {
        return res.status(400).json({ message: "Estate ID is required" });
      }

      const membership = await findEstateMembership(req.user.id, estateId);
      if (!membership && req.user?.role !== "admin") {
        return res.status(403).json({ message: "Not a member of that estate" });
      }

      const requests = await prisma.serviceRequest.findMany({
        where: {
          estateId,
        },
        orderBy: {
          createdAt: "desc",
        },
      });

      res.json(
        requests.map((request) => ({
          ...request,
          status: request.status?.toUpperCase?.() ?? request.status,
        }))
      );
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/estates/:estateId/requests", async (req, res, next) => {
    try {
      if (!req.isAuthenticated() || req.user?.role !== "resident") {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { estateId } = req.params;
      if (!estateId) {
        return res.status(400).json({ message: "Estate ID is required" });
      }

      const membership = await findEstateMembership(req.user.id, estateId);
      if (!membership) {
        return res.status(403).json({ message: "Not a member of that estate" });
      }

      const schema = z.object({
        title: z.string().optional(),
        description: z.string().min(1, "Description is required"),
        serviceCategoryId: z.string().optional().nullable(),
        serviceId: z.string().optional().nullable(),
        preferredStart: z.string().optional().nullable(),
        preferredEnd: z.string().optional().nullable(),
        location: z.string().optional().nullable(),
      });

      const payload = schema.parse(req.body || {});

      const newRequest = await prisma.serviceRequest.create({
        data: {
          residentId: req.user.id,
          estateId,
          title: payload.title ?? null,
          description: payload.description,
          serviceCategoryId: payload.serviceCategoryId ?? null,
          serviceId: payload.serviceId ?? null,
          preferredStart: payload.preferredStart ? new Date(payload.preferredStart) : null,
          preferredEnd: payload.preferredEnd ? new Date(payload.preferredEnd) : null,
          location: payload.location ?? null,
          status: "PENDING",
        },
      });

      res.status(201).json({
        ...newRequest,
        status: newRequest.status.toUpperCase(),
      });
    } catch (error: any) {
      if (error?.issues) {
        return res.status(400).json({
          error: "Validation error",
          details: error.issues.map((i: any) => ({"path": i.path.join("."), "message": i.message, "expected": i.expected, "received": i.received, "code": i.code })),
        });
      }
      next(error);
    }
  });

  app.patch("/api/requests/:id/status", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { id } = req.params;
      const { status } = z.object({ status: z.string().min(1) }).parse(req.body || {});
      const normalized = status.toUpperCase();

      if (!SERVICE_REQUEST_STATUSES.includes(normalized)) {
        return res.status(400).json({ message: "Invalid status" });
      }

      const existing = await prisma.serviceRequest.findUnique({
        where: { id },
        select: { estateId: true },
      });

      if (!existing) {
        return res.status(404).json({ message: "Request not found" });
      }

      if (req.user?.role !== "admin") {
        if (!existing.estateId) {
          return res.status(403).json({ message: "Cannot update requests without an estate" });
        }
        const membership = await findEstateMembership(req.user.id, existing.estateId);
        if (!membership) {
          return res.status(403).json({ message: "Not a member of that estate" });
        }
      }

      const updated = await prisma.serviceRequest.update({
        where: { id },
        data: { status: normalized },
      });

      res.json({
        ...updated,
        status: updated.status.toUpperCase(),
      });
    } catch (error) {
      next(error);
    }
  });

  // Wallet Routes
  app.get("/api/wallet", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const wallet = await storage.getWalletByUserId(req.user.id);
      res.json(wallet);
    } catch (error) {
      next(error);
    }
  });

  // Paystack Payments
  app.post("/api/payments/paystack/session", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const payload = z
        .object({
          amount: z.preprocess((val) => Number(val), z.number().positive()),
          serviceRequestId: z.string().optional(),
          description: z.string().optional(),
        })
        .parse(req.body || {});

      if (payload.serviceRequestId) {
        const request = await storage.getServiceRequest(payload.serviceRequestId);
        if (!request) {
          return res.status(404).json({ message: "Service request not found" });
        }
        const isOwner =
          req.user?.role === "admin" || request.residentId === req.user?.id;
        if (!isOwner) {
          return res.status(403).json({ message: "Forbidden" });
        }
      }

      const session = await createPendingPaystackTransaction({
        userId: req.user.id,
        amount: payload.amount,
        serviceRequestId: payload.serviceRequestId,
        description: payload.description,
        meta: {
          initiatorId: req.user.id,
          serviceRequestId: payload.serviceRequestId,
        },
      });

      res.json({
        reference: session.reference,
        amountKobo: session.amountKobo,
        amountFormatted: session.amountFormatted,
      });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/paystack/init", async (req, res, next) => {
    try {
      const payload = z.object({
        email: z.string().email(),
        amountInNaira: z.number().positive(),
        metadata: z.record(z.any()).optional(),
        reference: z.string().optional(),
        callbackUrl: z.string().url().optional(),
      });

      const { email, amountInNaira, metadata, reference, callbackUrl } = payload.parse(req.body || {});

      const result = await initializePaystackTransaction({
        email,
        amountInNaira,
        metadata,
        reference,
        callbackUrl,
      });

      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/paystack/webhook", async (req, res) => {
    const rawBody = req.body;
    if (!Buffer.isBuffer(rawBody)) {
      return res.status(400).json({ received: false });
    }

    const signature = req.header("x-paystack-signature");
    // Security: reject webhook immediately if the HMAC signature does not match.
    if (!validatePaystackSignature(rawBody, signature)) {
      return res.status(401).json({ received: false });
    }

    try {
      const payload = JSON.parse(rawBody.toString("utf8"));
      const event = payload?.event;
      const data = payload?.data;
      const reference = data?.reference;

      // Security: capture webhook metadata without storing secrets for auditing.
      await storage.createAuditLog({
        actorId: "system",
        estateId: null,
        action: "paystack:webhook",
        target: "transaction",
        targetId: reference || "unknown",
        meta: {
          event,
          reference,
          receivedAt: new Date().toISOString(),
        },
        ipAddress: req.ip,
        userAgent: req.get("user-agent"),
      });

      if (event !== "charge.success" || !reference) {
        return res.json({ received: true });
      }

      // TODO: replace this with the real payment/order lookup table keyed by reference.
      const tx = await storage.getTransactionByReference(reference);
      if (!tx) {
        console.warn("Paystack webhook: transaction not found", reference);
        return res.json({ received: true });
      }

      // Security: idempotency—if already paid, just acknowledge to avoid double credits.
      if (tx.status === "completed") {
        return res.json({ received: true });
      }

      const amountFromGateway =
        typeof data.amount === "number" ? data.amount / 100 : null;

      // Security: fail closed when amount or currency differ from what we expect.
      if (
        data.currency !== "NGN" ||
        amountFromGateway === null ||
        Math.abs(amountFromGateway - Number(tx.amount)) > 0.001
      ) {
        return res.json({ received: true });
      }

      // Security: only now, after all checks pass, do we mark the transaction as paid.
      await storage.updateTransactionByReference(reference, {
        status: "completed",
        description: `Paystack webhook ${data.channel || "charge"}`,
        meta: {
          ...(tx.meta as Record<string, unknown>),
          paystackWebhook: data,
        },
      });

      if (tx.serviceRequestId) {
        // TODO: ensure this ties into the full service-order billing workflow.
        await storage.updateServiceRequest(tx.serviceRequestId, {
          paymentStatus: "paid",
          billedAmount: tx.amount as any,
        });
      }
    } catch (error: any) {
      console.error("Paystack webhook handler failed", { message: error?.message });
    }

    return res.json({ received: true });
  });

  app.get("/api/paystack/verify", async (req, res, next) => {
    try {
      const reference = (req.query.reference as string | undefined)?.trim();
      // Security: refuse requests without a reference to avoid replay attacks.
      if (!reference) {
        return res.status(400).json({ status: "failed", message: "reference query param is required" });
      }

      // TODO: ensure this lookup uses the production payment table keyed by reference.
      const tx = await storage.getTransactionByReference(reference);
      if (!tx) {
        return res.status(404).json({ status: "failed" });
      }

      if (tx.status === "completed") {
        return res.json({ status: "success" });
      }

      const verification = await verifyPaystackTransaction(reference);
      // Security: make sure Paystack is telling us the charge actually succeeded.
      const charge = verification.data;

      // Security: enforce currency and success state before touching any DB rows.
      if (!verification.status || charge?.status !== "success" || charge?.currency !== "NGN") {
        return res.json({ status: "failed" });
      }

      const amountFromGateway =
        typeof charge.amount === "number" ? charge.amount / 100 : null;
      const expectedAmount = Number(tx.amount);
      if (amountFromGateway === null || Number.isNaN(amountFromGateway)) {
        return res.json({ status: "failed" });
      }

      // Security: guard against tampered amounts by comparing gateway vs expected value.
      if (Math.abs(amountFromGateway - expectedAmount) > 0.001) {
        return res.json({ status: "failed" });
      }

      await storage.updateTransactionByReference(reference, {
        status: "completed",
        description: `Paystack ${charge.channel || "charge"}`,
        meta: {
          ...(tx.meta as Record<string, unknown>),
          paystack: charge,
        },
      });

      if (tx.serviceRequestId) {
        // TODO: replace with real billing workflow (e.g., payment record table update) before marking service request paid.
        await storage.updateServiceRequest(tx.serviceRequestId, {
          paymentStatus: "paid",
          billedAmount: tx.amount as any,
        });
      }

      res.json({ status: "success" });
    } catch (error: any) {
      console.error("Paystack verify GET error", { message: error?.message });
      res.status(500).json({ status: "failed" });
    }
  });

  app.post("/api/payments/paystack/verify", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { reference } = z
        .object({
          reference: z.string().min(6),
        })
        .parse(req.body || {});

      const tx = await storage.getTransactionByReference(reference);
      if (!tx) {
        return res.status(404).json({ message: "Transaction not found" });
      }

      if (req.user?.role !== "admin") {
        const wallet = await storage.getWalletByUserId(req.user.id);
        if (!wallet || wallet.id !== tx.walletId) {
          return res.status(403).json({ message: "Forbidden" });
        }
      }

      const result = await handlePaystackVerify({
        reference,
        storage,
        transaction: tx,
      });

      res.json({
        reference,
        ...result,
      });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/payments/paystack/webhook", async (req, res) => {
    try {
      const rawBody = req.body;
      if (!Buffer.isBuffer(rawBody)) {
        return res.status(400).json({ message: "Invalid payload" });
      }

      const signature = req.header("x-paystack-signature") || undefined;

      if (!validatePaystackSignature(rawBody, signature)) {
        // Security: reject unsigned requests to avoid spoofed credits.
        return res.status(400).json({ message: "Invalid signature" });
      }

      const payload = JSON.parse(rawBody.toString("utf8"));
      const reference = payload?.data?.reference;

      if (reference) {
        await verifyAndFinalizePaystackCharge(reference);
      }

      res.json({ received: true });
    } catch (error) {
      console.error("Paystack webhook error", error);
      res.status(500).json({ message: "Webhook processing failed" });
    }
  });

  // Admin Routes
  app.get("/api/admin/users", async (req, res, next) => {
    try {
      if (!req.isAuthenticated() || req.user?.role !== "admin") {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { role } = req.query;
      const users = await storage.getUsers(role as string);
      res.json(users);
    } catch (error) {
      next(error);
    }
  });

  // Unified list with search + role filter (used by admin dashboard)
  app.get("/api/admin/users/all", async (req, res, next) => {
    try {
      if (!req.isAuthenticated() || req.user?.role !== "admin") {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { role, search } = req.query as { role?: string; search?: string };
      const list = await storage.getUsers(role);
      const filtered = search
        ? list.filter((u) => {
            const q = search.toLowerCase();
            return (
              u.name?.toLowerCase().includes(q) ||
              u.email?.toLowerCase().includes(q) ||
              u.phone?.toLowerCase().includes(q)
            );
          })
        : list;

      res.json(filtered);
    } catch (error) {
      next(error);
    }
  });

  // Create user
  app.post("/api/admin/users", async (req, res, next) => {
    try {
      if (!req.isAuthenticated() || req.user?.role !== "admin") {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { name, email, phone, password, role, globalRole, isActive, isApproved, company } = req.body || {};
      const roleValue = role || globalRole;
      if (!name || !email || !phone || !password || !roleValue) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      const existing = await storage.getUserByEmail(email);
      if (existing) {
        return res.status(400).json({ message: "Email already exists" });
      }

      const hashedPassword = await hashPassword(password);
      const user = await storage.createUser({
        name,
        email,
        phone,
        password: hashedPassword,
        role: roleValue,
        globalRole,
        company,
        isActive: isActive ?? true,
        isApproved: isApproved ?? true,
      } as any);

      res.status(201).json(user);
    } catch (error) {
      next(error);
    }
  });

  // Update user
  app.patch("/api/admin/users/:id", async (req, res, next) => {
    try {
      if (!req.isAuthenticated() || req.user?.role !== "admin") {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { id } = req.params;
      const updates: any = { ...req.body, updatedAt: new Date() };
      if (req.body?.password) {
        updates.password = await hashPassword(req.body.password);
      }

      const user = await storage.updateUser(id, updates);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      res.json(user);
    } catch (error) {
      next(error);
    }
  });

  // Admin: reset a user's password (admin-only)
  app.post("/api/admin/users/:id/reset-password", async (req, res, next) => {
    try {
      if (!req.isAuthenticated() || req.user?.role !== "admin") {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { id } = req.params;
      if (!id) return res.status(400).json({ message: "User id is required" });

      const { password: providedPassword } = req.body || {};

      // If password not provided, generate a secure temporary password
      let plainPassword = providedPassword;
      if (!plainPassword) {
        // 12 bytes -> 24 hex chars (sufficiently random for temp password)
        plainPassword = randomBytes(12).toString("hex");
      }

      const hashed = await hashPassword(plainPassword);
      const user = await storage.updateUser(id, { password: hashed } as any);
      if (!user) return res.status(404).json({ message: "User not found" });

      // Return the plaintext only if we generated it (so admins can communicate it)
      const response: any = { success: true };
      if (!providedPassword) response.tempPassword = plainPassword;

      res.json(response);
    } catch (error) {
      next(error);
    }
  });

  app.delete("/api/admin/users/:id", async (req, res, next) => {
    try {
      if (!isAdminOrSuper(req)) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { id } = req.params;
      if (!id) {
        return res.status(400).json({ message: "User id is required" });
      }

      const targetId = (await storage.getUser(id))?.id ??
        (await storage.getPostgresIdFromMongoId("user", id)) ??
        null;

      if (!targetId) {
        return res.status(404).json({ message: "User not found" });
      }

      const deleted = await storage.deleteUser(targetId);
      if (!deleted) {
        return res.status(404).json({ message: "User not found" });
      }

      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/admin/providers", async (req, res, next) => {
    try {
      const isAdmin = req.isAuthenticated() && (req.user?.role === "admin" || req.user?.globalRole === "super_admin");
      if (!isAdmin) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { search, approved, category } = req.query;

      const providers = await storage.getProviders({
        search: search as string,
        approved: approved !== undefined ? approved === "true" : undefined,
        category: category as string,
      });

      res.json(providers);
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/admin/providers/pending", async (req, res, next) => {
    try {
      const isAdmin = req.isAuthenticated() && (req.user?.role === "admin" || req.user?.globalRole === "super_admin");
      if (!isAdmin) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const providers = await storage.getPendingProviders();
      res.json(providers);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/admin/providers/:id/approve", async (req, res, next) => {
    try {
      const isAdmin = req.isAuthenticated() && (req.user?.role === "admin" || req.user?.globalRole === "super_admin");
      if (!isAdmin) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { id } = req.params;
      const provider = await storage.approveProvider(id);

      if (!provider) {
        return res.status(404).json({ message: "Provider not found" });
      }

      await storage.deleteProviderRequestByProviderId(id);
      await storage.createAuditLog({
        actorId: req.user?.id ?? "system",
        action: "approve_provider",
        target: "provider_request",
        targetId: provider.id,
        meta: {
          providerEmail: provider.email,
          providerName: provider.name,
        },
        ipAddress: req.ip,
        userAgent: req.get("user-agent") ?? "",
      });

      res.json(provider);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/admin/provider-requests/:id/decline", async (req, res, next) => {
    try {
      if (!isAdminOrSuper(req)) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      const { id } = req.params;
      const { reason } = req.body as { reason?: string };
      const request = await storage.getProviderRequestById(id);
      if (!request) {
        return res.status(404).json({ message: "Provider request not found" });
      }
      const providerId = request.providerId;
      if (providerId) {
        await storage.deleteUser(providerId);
      }
      await storage.deleteProviderRequest(id);
      await storage.createAuditLog({
        actorId: req.user?.id ?? "system",
        action: "decline_provider_request",
        target: "provider_request",
        targetId: request.id,
        meta: {
          providerEmail: request.email,
          providerName: request.name,
          reason: reason ?? "",
        },
        ipAddress: req.ip,
        userAgent: req.get("user-agent") ?? "",
      });
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/admin/providers", async (req, res, next) => {
    try {
      const isAdmin = req.isAuthenticated() && (req.user?.role === "admin" || req.user?.globalRole === "super_admin");
      if (!isAdmin) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const parsed = createProviderSchema.parse(req.body);
      if (!parsed.password) {
        return res.status(400).json({ message: "Password is required" });
      }

      const existing = await storage.getUserByEmail(parsed.email);
      if (existing) {
        return res.status(409).json({ message: "Email already exists" });
      }

      const hashedPassword = await hashPassword(parsed.password);
      const provider = await storage.createUser({
        name: parsed.name,
        email: parsed.email,
        phone: parsed.phone || "",
        password: hashedPassword,
        role: "provider",
        company: parsed.company,
        categories: parsed.categories,
        experience: parsed.experience,
        isApproved: parsed.isApproved ?? true,
        metadata: parsed.description ? { description: parsed.description } : undefined,
      } as any);

      res.status(201).json(provider);
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
      next(error);
    }
  });

  app.get("/api/admin/stats", async (req, res, next) => {
    try {
      if (!req.isAuthenticated() || req.user?.role !== "admin") {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const stats = await storage.getUserStats();
      res.json(stats);
    } catch (error) {
      next(error);
    }
  });

  // Admin: bridge stats (users + service requests from canonical Postgres tables)
  app.get("/api/admin/bridge/stats", async (req, res, next) => {
    try {
      const isAdmin =
        req.isAuthenticated() &&
        (req.user?.role === "admin" || req.user?.globalRole === "super_admin");
      if (!isAdmin) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const [[residents], [providers], [pendingProviders]] = await Promise.all([
        db.select({ c: count() }).from(users).where(eq(users.role, "resident")),
        db.select({ c: count() }).from(users).where(eq(users.role, "provider")),
        db
          .select({ c: count() })
          .from(users)
          .where(and(eq(users.role, "provider"), eq(users.isApproved, false))),
      ]);

      const [[srTotal], [srPending], [srInProgress], [srCompleted], [srCancelled]] =
        await Promise.all([
          db.select({ c: count() }).from(serviceRequests),
          db
            .select({ c: count() })
            .from(serviceRequests)
            .where(eq(serviceRequests.status, "pending")),
          db
            .select({ c: count() })
            .from(serviceRequests)
            .where(eq(serviceRequests.status, "in_progress")),
          db
            .select({ c: count() })
            .from(serviceRequests)
            .where(eq(serviceRequests.status, "completed")),
          db
            .select({ c: count() })
            .from(serviceRequests)
            .where(eq(serviceRequests.status, "cancelled")),
        ]);

      res.json({
        users: {
          totalResidents: Number(residents?.c ?? 0),
          totalProviders: Number(providers?.c ?? 0),
          pendingProviders: Number(pendingProviders?.c ?? 0),
        },
        serviceRequests: {
          total: Number(srTotal?.c ?? 0),
          pending: Number(srPending?.c ?? 0),
          inProgress: Number(srInProgress?.c ?? 0),
          completed: Number(srCompleted?.c ?? 0),
          cancelled: Number(srCancelled?.c ?? 0),
        },
      });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/admin/bridge/service-requests", async (req, res, next) => {
    try {
      const isAdmin =
        req.isAuthenticated() &&
        (req.user?.role === "admin" || req.user?.globalRole === "super_admin");

      if (!isAdmin) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const {
        status,
        q,
        estateId,
        residentId,
        providerId,
      } = req.query as {
        status?: string;
        q?: string;
        estateId?: string;
        residentId?: string;
        providerId?: string;
      };

      const all = await storage.getAllServiceRequests();

      const filtered = all.filter((request) => {
        let matches = true;

        if (status && status !== "all") {
          matches &&= request.status === status;
        }

        if (estateId) {
          matches &&= (request as any).estateId === estateId;
        }

        if (residentId) {
          matches &&= request.residentId === residentId;
        }

        if (providerId) {
          matches &&= request.providerId === providerId;
        }

        if (q) {
          const needle = q.toLowerCase();
          const haystack = [
            request.id,
            request.description,
            request.category,
            request.residentId,
            request.providerId,
            (request as any).location,
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();
          matches &&= haystack.includes(needle);
        }

        return matches;
      });

      res.json(filtered);
    } catch (error) {
      next(error);
    }
  });

  // Admin dashboard stats (front-end expects /api/admin/dashboard/stats)
  app.get("/api/admin/dashboard/stats", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      const stats = await storage.getUserStats();
      res.json(stats);
    } catch (error) {
      next(error);
    }
  });

  // Business overview data for company dashboard
  app.get("/api/business/overview", async (req, res, next) => {
    try {
      if (!isAdminOrSuper(req)) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const businessName = (req.query.company || req.query.business || "").toString();
      const providerConditions = [
        eq(users.role, "provider"),
        ...(businessName ? [eq(users.company, businessName)] : []),
      ];

      const [
        [providerCount],
        [activeRequestsCount],
        [revenueRow],
        recentActivityRows,
      ] = await Promise.all([
        db.select({ c: count() }).from(users).where(and(...providerConditions)),
        db
          .select({ c: count() })
          .from(serviceRequests)
          .leftJoin(users, eq(users.id, serviceRequests.providerId))
          .where(
            and(
              eq(serviceRequests.status, "pending"),
              ...(businessName ? [eq(users.company, businessName)] : []),
            ),
          ),
        db
          .select({ total: sum(transactions.amount) })
          .from(transactions)
          .where(eq(transactions.status, "completed")),
        db
          .select({
            id: serviceRequests.id,
            status: serviceRequests.status,
            category: serviceRequests.category,
            createdAt: serviceRequests.createdAt,
          })
          .from(serviceRequests)
          .leftJoin(users, eq(users.id, serviceRequests.providerId))
          .where(and(...providerConditions))
          .orderBy(desc(serviceRequests.createdAt))
          .limit(5),
      ]);

      const latestTransactionRows = await db
        .select({
          id: transactions.id,
          amount: transactions.amount,
          status: transactions.status,
          description: transactions.description,
          createdAt: transactions.createdAt,
          category: serviceRequests.category,
          requestId: serviceRequests.id,
          providerName: users.name,
        })
        .from(transactions)
        .leftJoin(
          serviceRequests,
          eq(transactions.serviceRequestId, serviceRequests.id),
        )
        .leftJoin(users, eq(users.id, serviceRequests.providerId))
        .where(and(...providerConditions))
        .orderBy(desc(transactions.createdAt))
        .limit(5);

      let auditQuery = db
        .select({
          id: auditLogs.id,
          action: auditLogs.action,
          target: auditLogs.target,
          targetId: auditLogs.targetId,
          createdAt: auditLogs.createdAt,
        })
        .from(auditLogs);

      if (businessName) {
        auditQuery = auditQuery.where(
          sql`${auditLogs.meta} ->> 'company' = ${businessName}`,
        );
      }

      const recentAuditRows = await auditQuery
        .orderBy(desc(auditLogs.createdAt))
        .limit(5);

      const normalizedActivities = [
        ...recentActivityRows.map((row: any) => ({
          id: row.id,
          status: row.status ?? null,
          category: row.category ?? null,
          createdAt: row.createdAt ?? null,
        })),
        ...recentAuditRows.map((row: any) => ({
          id: row.id,
          status: row.action ?? null,
          category: row.target ?? null,
          createdAt: row.createdAt ?? null,
        })),
      ]
        .sort((a, b) => {
          const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return bTime - aTime;
        })
        .slice(0, 5)
        .map((activity) => ({
          id: activity.id,
          status: activity.status,
          category: activity.category,
          createdAt: activity.createdAt
            ? new Date(activity.createdAt).toISOString()
            : null,
        }));

      const normalizedLatestTransactions = latestTransactionRows.map((row: any) => ({
        id: row.id,
        amount: Number(row.amount ?? 0),
        status: row.status ?? null,
        description: row.description ?? null,
        category: row.category ?? null,
        requestId: row.requestId ?? null,
        providerName: row.providerName ?? null,
        createdAt: row.createdAt ? row.createdAt.toISOString() : null,
      }));

      res.json({
        totalProviders: Number(providerCount?.c ?? 0),
        activeRequests: Number(activeRequestsCount?.c ?? 0),
        totalRevenue: Number(revenueRow?.total ?? 0),
        recentActivity: normalizedActivities,
        latestTransactions: normalizedLatestTransactions,
      });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/categories", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { scope } = req.query as { scope?: string };
      let query = db.select().from(categories);
      if (scope && scope !== "all" && (scope === "global" || scope === "estate")) {
        query = query.where(eq(categories.scope, scope as "global" | "estate"));
      }

      const rows = await query.orderBy(desc(categories.createdAt));
      res.json(rows);
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/companies", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const rows = await db
        .select()
        .from(companies)
        .orderBy(desc(companies.createdAt));
      res.json(rows);
    } catch (error) {
      next(error);
    }
  });

  // Audit log listing (limit optional)
  app.get("/api/admin/audit-logs", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      const limit =
        Math.min(Math.max(Number(req.query.limit ?? 10), 1), 100) || 10;

      const logs = await db
        .select()
        .from(auditLogs)
        .orderBy(desc(auditLogs.createdAt))
        .limit(limit);

      res.json(logs);
    } catch (error) {
      next(error);
    }
  });

  // Admin: estates management
  app.get("/api/admin/estates", async (req, res, next) => {
    try {
      const isAdmin =
        req.isAuthenticated() &&
        (req.user?.role === "admin" || req.user?.globalRole === "super_admin");
      if (!isAdmin) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const rows = await db.select().from(estates);
      res.json(rows);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/admin/estates", async (req, res, next) => {
    try {
      const isAdmin =
        req.isAuthenticated() &&
        (req.user?.role === "admin" || req.user?.globalRole === "super_admin");
      if (!isAdmin) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const parsed = insertEstateSchema.parse({
        ...req.body,
        createdBy: req.user?.id,
      });

      const [created] = await db
        .insert(estates)
        .values({
          ...parsed,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();

      res.status(201).json(created);
    } catch (error) {
      next(error);
    }
  });

  // Admin: memberships (user-estate relationships)
  app.get("/api/admin/memberships", async (req, res, next) => {
    try {
      if (!isAdminOrSuper(req)) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const rows = await db
        .select({
          id: memberships.id,
          userId: memberships.userId,
          user_id: memberships.userId,
          estateId: memberships.estateId,
          estate_id: memberships.estateId,
          role: memberships.role,
          permissions: memberships.permissions,
          isActive: memberships.isActive,
          createdAt: memberships.createdAt,
          updatedAt: memberships.updatedAt,
          userName: users.name,
          estateName: estates.name,
        })
        .from(memberships)
        .leftJoin(users, eq(users.id, memberships.userId))
        .leftJoin(estates, eq(estates.id, memberships.estateId))
        .orderBy(desc(memberships.createdAt));

      res.json(rows);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/admin/memberships", async (req, res, next) => {
    try {
      if (!isAdminOrSuper(req)) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const parsed = insertMembershipSchema.parse(req.body);
      const [existing] = await db
        .select()
        .from(memberships)
        .where(
          and(
            eq(memberships.userId, parsed.userId),
            eq(memberships.estateId, parsed.estateId)
          )
        )
        .limit(1);

      if (existing) {
        return res.status(409).json({ message: "Membership already exists" });
      }

      const [created] = await db
        .insert(memberships)
        .values(parsed)
        .returning();

      res.status(201).json(created);
    } catch (error) {
      next(error);
    }
  });

  app.delete("/api/admin/memberships/:userId/:estateId", async (req, res, next) => {
    try {
      if (!isAdminOrSuper(req)) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { userId, estateId } = req.params;
      const deleted = await db
        .delete(memberships)
        .where(
          and(
            eq(memberships.userId, userId),
            eq(memberships.estateId, estateId)
          )
        )
        .returning();

      if (!deleted || deleted.length === 0) {
        return res.status(404).json({ message: "Membership not found" });
      }

      res.json({ success: true, membership: deleted[0] });
    } catch (error) {
      next(error);
    }
  });

  // Admin: categories management
  app.get("/api/admin/categories", async (req, res, next) => {
    try {
      if (!isAdminOrSuper(req)) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { scope, estateId } = req.query;
      let query = db.select().from(categories);
      if (scope && scope !== "all" && (scope === "global" || scope === "estate")) {
        query = query.where(eq(categories.scope, scope as "global" | "estate"));
      }
      if (estateId) {
        query = query.where(eq(categories.estateId, String(estateId)));
      }

      const rows = await query.orderBy(desc(categories.createdAt));
      res.json(rows);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/admin/categories", async (req, res, next) => {
    try {
      if (!isAdminOrSuper(req)) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const parsed = insertCategorySchema.parse(req.body);
      const [created] = await db.insert(categories).values(parsed).returning();
      res.status(201).json(created);
    } catch (error) {
      next(error);
    }
  });

  app.patch("/api/admin/categories/:id", async (req, res, next) => {
    try {
      if (!isAdminOrSuper(req)) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { id } = req.params;
      const updates = {
        ...req.body,
        updatedAt: new Date(),
      };

      const [updated] = await db
        .update(categories)
        .set(updates)
        .where(eq(categories.id, id))
        .returning();

      if (!updated) {
        return res.status(404).json({ message: "Category not found" });
      }

      res.json(updated);
    } catch (error) {
      next(error);
    }
  });

  app.delete("/api/admin/categories/:id", async (req, res, next) => {
    try {
      if (!isAdminOrSuper(req)) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { id } = req.params;
      const deleted = await db
        .delete(categories)
        .where(eq(categories.id, id))
        .returning();

      if (!deleted || deleted.length === 0) {
        return res.status(404).json({ message: "Category not found" });
      }

      res.json({ success: true, category: deleted[0] });
    } catch (error) {
      next(error);
    }
  });

  // Admin: item categories (for marketplace items)
  const ItemCategorySchema = z.object({
    name: z.string().min(1, "Name is required"),
    description: z.string().optional(),
    emoji: z.string().optional(),
    isActive: z.boolean().optional(),
  });

  app.get("/api/admin/item-categories", async (req, res, next) => {
    try {
      if (!isAdminOrSuper(req)) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const rows = await db
        .select()
        .from(itemCategories)
        .orderBy(desc(itemCategories.createdAt));

      res.json(rows);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/admin/item-categories", async (req, res, next) => {
    try {
      if (!isAdminOrSuper(req)) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const parsed = ItemCategorySchema.parse(req.body);
      const [created] = await db
        .insert(itemCategories)
        .values({
          name: parsed.name,
          description: parsed.description,
          emoji: parsed.emoji,
          isActive: parsed.isActive ?? true,
        })
        .returning();

      res.status(201).json(created);
    } catch (error) {
      next(error);
    }
  });

  app.patch("/api/admin/item-categories/:id", async (req, res, next) => {
    try {
      if (!isAdminOrSuper(req)) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { id } = req.params;
      const parsed = ItemCategorySchema.partial().parse(req.body);

      const [updated] = await db
        .update(itemCategories)
        .set({
          ...parsed,
          updatedAt: new Date(),
        })
        .where(eq(itemCategories.id, id))
        .returning();

      if (!updated) {
        return res.status(404).json({ message: "Item category not found" });
      }

      res.json(updated);
    } catch (error) {
      next(error);
    }
  });

  app.delete("/api/admin/item-categories/:id", async (req, res, next) => {
    try {
      if (!isAdminOrSuper(req)) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { id } = req.params;
      const deleted = await db
        .delete(itemCategories)
        .where(eq(itemCategories.id, id))
        .returning();

      if (!deleted || deleted.length === 0) {
        return res.status(404).json({ message: "Item category not found" });
      }

      res.json({ success: true, category: deleted[0] });
    } catch (error) {
      next(error);
    }
  });

  const StoreSchema = z.object({
    name: z.string().min(1, "Name is required"),
    description: z.string().optional(),
    location: z.string().min(1, "Location is required"),
    phone: z.string().optional(),
    email: z.string().email().optional(),
    ownerId: z.string().min(1, "Owner is required"),
    estateId: z.string().optional(),
    isActive: z.boolean().optional(),
  });

  app.get("/api/admin/stores", async (req, res, next) => {
    try {
      if (!isAdminOrSuper(req)) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { search } = req.query;
      let query = db.select().from(stores);

      if (typeof search === "string" && search.trim().length > 0) {
        const term = `%${search.trim()}%`;
        query = query.where(
          or(
            ilike(stores.name, term),
            ilike(stores.location, term),
            ilike(stores.phone, term),
            ilike(stores.email, term),
          ),
        );
      }

      const rows = await query.orderBy(desc(stores.createdAt));
      res.json(rows);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/admin/stores", async (req, res, next) => {
    try {
      if (!isAdminOrSuper(req)) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const parsed = StoreSchema.parse(req.body);
      const [created] = await db
        .insert(stores)
        .values({
          name: parsed.name,
          description: parsed.description,
          location: parsed.location,
          phone: parsed.phone,
          email: parsed.email,
          ownerId: parsed.ownerId,
          estateId: parsed.estateId,
          isActive: parsed.isActive ?? true,
        })
        .returning();

      res.status(201).json(created);
    } catch (error) {
      next(error);
    }
  });

  app.patch("/api/admin/stores/:id", async (req, res, next) => {
    try {
      if (!isAdminOrSuper(req)) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { id } = req.params;
      const updates = StoreSchema.partial().parse(req.body);

      const [updated] = await db
        .update(stores)
        .set({
          ...updates,
          updatedAt: new Date(),
        })
        .where(eq(stores.id, id))
        .returning();

      if (!updated) {
        return res.status(404).json({ message: "Store not found" });
      }

      res.json(updated);
    } catch (error) {
      next(error);
    }
  });

  const MarketplaceItemAdminSchema = createMarketplaceItemSchema.extend({
    storeId: z.string().min(1, "Store ID is required"),
    estateId: z.string().optional(),
    isActive: z.boolean().optional(),
  });

  app.get("/api/admin/marketplace", async (req, res, next) => {
    try {
      if (!isAdminOrSuper(req)) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { storeId } = req.query;
      let query = db.select().from(marketplaceItems);
      if (typeof storeId === "string" && storeId.trim()) {
        query = query.where(eq(marketplaceItems.storeId, storeId.trim()));
      }

      const rows = await query.orderBy(desc(marketplaceItems.createdAt));
      res.json(rows);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/admin/marketplace", async (req, res, next) => {
    try {
      if (!isAdminOrSuper(req)) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const parsed = MarketplaceItemAdminSchema.parse(req.body);
      const [created] = await db
        .insert(marketplaceItems)
        .values({
          vendorId: parsed.vendorId,
          storeId: parsed.storeId,
          estateId: parsed.estateId,
          name: parsed.name,
          description: parsed.description,
          price: parsed.price as any,
          currency: parsed.currency,
          category: parsed.category,
          subcategory: parsed.subcategory,
          stock: parsed.stock as any,
          images: parsed.images,
          isActive: parsed.isActive ?? true,
        })
        .returning();

      res.status(201).json(created);
    } catch (error) {
      next(error);
    }
  });

  app.patch("/api/admin/marketplace/:id", async (req, res, next) => {
    try {
      if (!isAdminOrSuper(req)) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { id } = req.params;
      const updates = updateMarketplaceItemSchema.partial().parse(req.body);

      const [updated] = await db
        .update(marketplaceItems)
        .set({
          ...updates,
          updatedAt: new Date(),
        })
        .where(eq(marketplaceItems.id, id))
        .returning();

      if (!updated) {
        return res.status(404).json({ message: "Marketplace item not found" });
      }

      res.json(updated);
    } catch (error) {
      next(error);
    }
  });

  app.delete("/api/admin/marketplace/:id", async (req, res, next) => {
    try {
      if (!isAdminOrSuper(req)) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { id } = req.params;
      const deleted = await db
        .delete(marketplaceItems)
        .where(eq(marketplaceItems.id, id))
        .returning();

      if (!deleted || deleted.length === 0) {
        return res.status(404).json({ message: "Marketplace item not found" });
      }

      res.json({ success: true, item: deleted[0] });
    } catch (error) {
      next(error);
    }
  });

  // Admin: Companies (for providers)
  app.get("/api/admin/companies", async (req, res, next) => {
    try {
      if (!req.isAuthenticated() || req.user?.role !== "admin") {
        return res.status(401).json({ message: "Unauthorized" });
      }
      const companies = await storage.getCompanies();
      res.json(companies);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/admin/companies", async (req, res, next) => {
    try {
      if (!req.isAuthenticated() || req.user?.role !== "admin") {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { name, description, contactEmail, phone } = req.body || {};
      if (!name) return res.status(400).json({ message: "Name is required" });

      const company = await storage.createCompany({
        name,
        description,
        contactEmail,
        phone,
      } as any);

      res.status(201).json(company);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/company/provider-requests", async (req, res, next) => {
    try {
      const parsed = providerRequestSchema.parse(req.body);
      const existingUser = await storage.getUserByEmail(parsed.email);
      if (existingUser) {
        return res
          .status(409)
          .json({ message: "A provider with that email already exists" });
      }

      const tempPassword = randomBytes(8).toString("hex");
      const hashedPassword = await hashPassword(tempPassword);

      const user = await storage.createUser({
        name: parsed.name,
        email: parsed.email,
        phone: parsed.phone || "",
        password: hashedPassword,
        role: "provider",
        company: parsed.company,
        categories: parsed.categories,
        experience: parsed.experience,
        isApproved: false,
        metadata: parsed.description ? { description: parsed.description } : undefined,
      } as any);
      const created = await storage.createProviderRequest({ ...parsed, providerId: user.id });
      await storage.createAuditLog({
        actorId: user.id,
        action: "create_provider_request",
        target: "provider_request",
        targetId: created.id,
        meta: {
          providerEmail: parsed.email,
          company: parsed.company,
        },
        ipAddress: req.ip,
        userAgent: req.get("user-agent") ?? "",
      });
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
      next(error);
    }
  });

  app.get("/api/admin/provider-requests", async (req, res, next) => {
    try {
      if (!isAdminOrSuper(req)) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const rows = await db
        .select({
          id: providerRequests.id,
          name: providerRequests.name,
          email: providerRequests.email,
          company: providerRequests.company,
          categories: providerRequests.categories,
          experience: providerRequests.experience,
          description: providerRequests.description,
          createdAt: providerRequests.createdAt,
          providerId: sql`coalesce(${providerRequests.providerId}, ${users.id})`,
        })
        .from(providerRequests)
        .leftJoin(users, eq(users.email, providerRequests.email))
        .orderBy(desc(providerRequests.createdAt));

      res.json(rows);
    } catch (error) {
      next(error);
    }
  });

  // Admin: Get a specific service request by ID
  app.get("/api/admin/service-requests/:id", async (req, res, next) => {
    try {
      if (!req.isAuthenticated() || req.user?.role !== "admin") {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { id } = req.params;
      const request = await storage.getServiceRequest(id);

      if (!request) {
        return res.status(404).json({ message: "Service request not found" });
      }

      res.json(request);
    } catch (error) {
      console.error("Error fetching service request for admin:", error);
      next(error);
    }
  });

  // Access Code Generation Route (for testing)
  app.post("/api/generate-access-code", async (req, res, next) => {
    try {
      if (!req.isAuthenticated() || req.user?.role !== "admin") {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const accessCode = Math.floor(100000 + Math.random() * 900000).toString();
      res.json({ accessCode });
    } catch (error) {
      next(error);
    }
  });

  // Resident: Get a specific service request by ID
  app.get("/api/service-requests/:id", async (req, res, next) => {
    try {
      if (!req.isAuthenticated() || req.user?.role !== "resident") {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { id } = req.params;
      if (!id || typeof id !== "string") {
        return res.status(400).json({ message: "Invalid service request ID" });
      }

      const request = await storage.getServiceRequest(id);

      if (!request) {
        return res.status(404).json({ message: "Service request not found" });
      }

      res.json(request);
    } catch (error) {
      console.error("Error fetching service request:", error);
      next(error);
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
