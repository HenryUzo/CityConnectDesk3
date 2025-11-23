import type { Express } from "express";
import { createServer, type Server } from "http";
import { z } from "zod";
import { setupAuth } from "./auth";
import { storage } from "./storage";
import { db } from "./db";
import { users, serviceRequests, insertServiceRequestSchema } from "@shared/schema";
import appRoutes from "./app-routes";
import providerRoutes from "./provider-routes";
import marketplaceRoutes from "./marketplace-routes";
import { randomBytes, scrypt } from "crypto";
import { promisify } from "util";
import { and, count, eq } from "drizzle-orm";

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

export async function registerRoutes(app: Express): Promise<Server> {
  // Setup authentication routes
  setupAuth(app);

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

      res.json(provider);
    } catch (error) {
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
