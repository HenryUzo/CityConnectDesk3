// server/admin-routes.ts
import { Router, type Response, type NextFunction } from "express";
import { z } from "zod";
import { adminDb } from "./admin-db";
// Default import for runtime members + type-only for req typing
import AdminAuth, { type AdminRequest } from "./admin-auth";
import { storage } from "./storage"; // Bridge to PostgreSQL system
import {
  createEstateSchema,
  createUserSchema,
  createMembershipSchema,
  createCategorySchema,
  updateCategorySchema,
  createMarketplaceItemSchema,
  // ❌ updateMarketplaceItemSchema intentionally not used here
  createProviderSchema,
  UserRole,
} from "../shared/admin-schema";

// Toggle bridge scoping via env (email|off)
// email = scope by estate members' emails (default)
// off   = no scoping (super useful for debugging)
const BRIDGE_SCOPE = (process.env.ADMIN_BRIDGE_SCOPE ?? "email").toLowerCase();


// Pull the guards/services from the default export (must exist in admin-auth.ts)
const {
  AdminAuthService,
  authenticateAdmin,
  setEstateContext,
  requireSuperAdmin,
  requireEstateAdmin,
  requireModerator,
  auditAction,
  rateLimitAuth,
} = AdminAuth;

const router = Router();

/** ------------------------------------------------------------------ */
/** DB health gating (skip for /auth/* and /setup)                      */
/** ------------------------------------------------------------------ */
const requireAdminDB = (req: AdminRequest, res: Response, next: NextFunction) => {
  if (!adminDb.isConnected) {
    return res.status(503).json({
      error: "Admin database unavailable",
      message: "Admin features are currently unavailable",
    });
  }
  next();
};

router.use((req: AdminRequest, res: Response, next: NextFunction) => {
  if (req.path.startsWith("/auth/") || req.path === "/setup") return next();
  return requireAdminDB(req, res, next);
});

/** ------------------------------------------------------------------ */
/** Setup (first-time bootstrap; no auth)                               */
/** ------------------------------------------------------------------ */
router.post("/setup", async (_req, res) => {
  try {
    if (!adminDb.isConnected) {
      return res.status(503).json({
        error: "MongoDB not connected",
        message: "Please configure MONGODB_URI environment variable first",
      });
    }

    const existingSuperAdmin = await adminDb.AdminUser.findOne({
      globalRole: UserRole.SUPER_ADMIN,
    });
    const existingEstate = await adminDb.Estate.findOne({ slug: "default-estate" });

    if (existingSuperAdmin && existingEstate) {
      return res.status(400).json({
        error: "Setup already completed",
        message: "Super admin and default estate already exist. Use login instead.",
        loginCredentials: { email: existingSuperAdmin.email, note: "Use your existing password" },
      });
    }

    // Create default estate (once)
    let defaultEstate = existingEstate;
    if (!defaultEstate) {
      defaultEstate = new adminDb.Estate({
        name: "Default Estate",
        slug: "default-estate",
        address: "123 Main Street, City, State 12345",
        phone: "+1-555-0123",
        email: "admin@defaultestate.com",
        isActive: true,
        coverage: {
          type: "Polygon",
          coordinates: [
            [
              [-74.0059, 40.7128],
              [-74.0059, 40.7628],
              [-73.9559, 40.7628],
              [-73.9559, 40.7128],
              [-74.0059, 40.7128],
            ],
          ],
        },
        settings: {
          timezone: "UTC",
          currency: "USD",
          allowMarketplace: true,
          allowServiceRequests: true,
        },
      });
      await defaultEstate.save();
    }

    // Create super admin
    const adminEmail = "admin@example.com";
    const adminPassword = "admin123";
    const hashedPassword = await AdminAuthService.hashPassword(adminPassword);

    const superAdmin = new adminDb.AdminUser({
      email: adminEmail,
      name: "Super Administrator",
      phone: "+1-555-0100",
      passwordHash: hashedPassword,
      globalRole: UserRole.SUPER_ADMIN,
      isActive: true,
    });
    await superAdmin.save();

    // Give the super admin an estate membership
    const membership = new adminDb.Membership({
      userId: superAdmin._id.toString(),
      estateId: defaultEstate._id.toString(),
      role: UserRole.ESTATE_ADMIN,
      permissions: ["*"],
      isActive: true,
    });
    await membership.save();

    res.json({
      success: true,
      message: "Admin setup completed successfully!",
      estate: { name: defaultEstate.name, id: defaultEstate._id.toString() },
      adminCredentials: {
        email: adminEmail,
        password: adminPassword,
        note: "IMPORTANT: Change this password after first login!",
      },
      nextSteps: {
        loginUrl: "/admin-dashboard",
        apiLoginEndpoint: "/api/admin/auth/login",
      },
    });
  } catch (error: any) {
    console.error("Setup error:", error);
    res.status(500).json({ error: "Setup failed", message: error.message });
  }
});

/** ------------------------------------------------------------------ */
/** Auth (login/refresh/logout)                                         */
/** ------------------------------------------------------------------ */
router.post("/auth/login", rateLimitAuth, async (req, res) => {
  try {
    const { email, password } = z
      .object({ email: z.string().email(), password: z.string().min(6) })
      .parse(req.body);

    const result = await AdminAuthService.authenticateUser(email, password);
    res.json({
      success: true,
      user: result.user,
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
    });
  } catch (error: any) {
    res.status(401).json({ error: error.message });
  }
});

router.post("/auth/refresh", async (req, res) => {
  try {
    const { refreshToken } = z.object({ refreshToken: z.string() }).parse(req.body);
    const payload = AdminAuthService.verifyToken(refreshToken);
    if (!payload || payload.type !== "refresh") {
      return res.status(401).json({ error: "Invalid refresh token" });
    }

    const user = await AdminAuthService.getUserWithMemberships(payload.sub);
    if (!user) return res.status(401).json({ error: "User not found" });

    const newAccessToken = AdminAuthService.generateToken({
      sub: user.id,
      email: user.email,
      name: user.name,
      globalRole: user.globalRole,
      memberships: user.memberships,
    });
    const newRefreshToken = AdminAuthService.generateToken({ sub: user.id, type: "refresh" });

    res.json({ accessToken: newAccessToken, refreshToken: newRefreshToken, user });
  } catch (error: any) {
    res.status(401).json({ error: error.message });
  }
});

router.post("/auth/logout", authenticateAdmin, async (_req: AdminRequest, res) => {
  res.json({ success: true });
});

/** ------------------------------------------------------------------ */
/** Dashboard                                                           */
/** ------------------------------------------------------------------ */
router.get(
  "/dashboard/stats",
  requireAdminDB,
  authenticateAdmin,
  setEstateContext,
  async (req: AdminRequest, res) => {
    try {
      const isSuperAdmin = req.adminUser?.globalRole === UserRole.SUPER_ADMIN;
      if (isSuperAdmin) {
        const stats = await adminDb.getGlobalStats();
        return res.json(stats);
      }
      if (req.currentEstate) {
        const stats = await adminDb.getEstateStats(req.currentEstate.id);
        return res.json(stats);
      }
      return res.status(400).json({ error: "Estate context required" });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);

/** ------------------------------------------------------------------ */
/** Estates                                                             */
/** ------------------------------------------------------------------ */
router.get("/estates", authenticateAdmin, setEstateContext, async (req: AdminRequest, res) => {
  try {
    const isSuperAdmin = req.adminUser?.globalRole === UserRole.SUPER_ADMIN;
    if (isSuperAdmin) {
      const estates = await adminDb.getEstates();
      return res.json(estates);
    }
    if (req.currentEstate) return res.json([req.currentEstate]);
    return res.status(400).json({ error: "Estate context required" });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post(
  "/estates",
  authenticateAdmin,
  requireSuperAdmin,
  auditAction("CREATE", "ESTATE"),
  async (req: AdminRequest, res) => {
    try {
      const data = createEstateSchema.parse(req.body);
      const estate = await adminDb.createEstate(data);
      res.status(201).json(estate);
    } catch (error: any) {
      if (error.code === 11000) res.status(400).json({ error: "Estate slug already exists" });
      else res.status(400).json({ error: error.message });
    }
  }
);

router.get("/estates/:id", authenticateAdmin, setEstateContext, requireEstateAdmin, async (req, res) => {
  try {
    const estate = await adminDb.getEstateById(req.params.id);
    if (!estate) return res.status(404).json({ error: "Estate not found" });
    res.json(estate);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.patch(
  "/estates/:id",
  authenticateAdmin,
  setEstateContext,
  requireEstateAdmin,
  auditAction("UPDATE", "ESTATE"),
  async (req: AdminRequest, res) => {
    try {
      const estate = await adminDb.updateEstate(req.params.id, req.body);
      if (!estate) return res.status(404).json({ error: "Estate not found" });
      res.json(estate);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }
);

router.delete(
  "/estates/:id",
  authenticateAdmin,
  setEstateContext,
  requireSuperAdmin,
  auditAction("DELETE", "ESTATE"),
  async (req: AdminRequest, res) => {
    try {
      const estate = await adminDb.deleteEstate(req.params.id);
      if (!estate) return res.status(404).json({ error: "Estate not found" });
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);

/** ------------------------------------------------------------------ */
/** Users                                                               */
/** ------------------------------------------------------------------ */
router.get(
  "/users",
  requireAdminDB,
  authenticateAdmin,
  setEstateContext,
  requireModerator,
  async (req: AdminRequest, res) => {
    try {
      const { globalRole, search, limit = 50, offset = 0 } = req.query as Record<string, any>;
      const filter: any = {};
      if (globalRole) filter.globalRole = globalRole;
      if (search) {
        filter.$or = [
          { name: { $regex: search, $options: "i" } },
          { email: { $regex: search, $options: "i" } },
        ];
      }

      if (req.adminUser?.globalRole !== UserRole.SUPER_ADMIN) {
        if (!req.currentEstate) return res.status(400).json({ error: "Estate context required" });
        const memberships = await adminDb.getEstateMemberships(req.currentEstate.id);
        const estateUserIds = memberships.map((m) => m.userId);
        filter._id = { $in: estateUserIds };
      }

      const users = await adminDb.getUsers(filter);
      res.json(users.slice(Number(offset), Number(offset) + Number(limit)));
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);

// ---- Unified Users (Admin + Residents + Providers) ----
router.get(
  "/users/all",
  requireAdminDB,
  authenticateAdmin,
  setEstateContext,
  requireModerator,
  async (req: AdminRequest, res) => {
    try {
      const {
        role,         // 'admin' | 'resident' | 'provider' (optional)
        search,       // string (optional)
        status,       // 'active' | 'inactive' (optional)
        limit = 50,
        offset = 0,
      } = req.query as Record<string, any>;

      // ---------- Determine global/scope ----------
      const isSuperGlobal =
        req.adminUser?.globalRole === UserRole.SUPER_ADMIN && !req.currentEstate;

      // Email-based scoping for Postgres users (or null for global super / scope off)
      let allowedEmails: Set<string> | null = null;
      try {
        allowedEmails = await getAllowedEmailsOrNull(req);
      } catch (e: any) {
        // Non-super admins must supply an estate; surface the 400 cleanly
        const msg = e?.message || String(e);
        const code = (e && e.status) || 400;
        return res.status(code).json({ error: msg });
      }

      // ---------- 1) ADMIN USERS (Mongo) ----------
      let adminFilter: any = {};
      if (!isSuperGlobal && req.currentEstate) {
        const memberships = await adminDb.getEstateMemberships(req.currentEstate.id);
        adminFilter._id = { $in: memberships.map((m: any) => m.userId) };
      }

      let adminUsers: any[] = [];
      if (!role || role === "admin") {
        try {
          adminUsers = await adminDb.getUsers(adminFilter);
        } catch (e: any) {
          console.error("users/all admin fetch failed:", e?.message || e);
          adminUsers = []; // don’t 500 just because Mongo hiccuped
        }
      }


      const adminMapped = adminUsers.map((u: any) => {
        const id = (u._id?.toString?.() ?? u.id ?? String(u._id));
        return {
          id,
          name: u.name,
          email: u.email,
          phone: u.phone ?? "",
          role: "admin",               // unified role
          adminRole: u.globalRole,     // keep original role detail
          globalRole: u.globalRole,
          isActive: !!u.isActive,
          source: "admin",
          createdAt: u.createdAt ?? undefined,
          updatedAt: u.updatedAt ?? undefined,
        };
      });

      // ---------- 2) RESIDENTS & PROVIDERS (Postgres bridge) ----------
      let bridgeUsers: any[] = [];
      if (!role || role === "resident" || role === "provider") {
        try {
          // storage.getUsers(role?) returns all if undefined
          bridgeUsers =
            role === "resident" || role === "provider"
              ? await storage.getUsers(role)
              : await storage.getUsers();
        } catch (e: any) {
          console.error("users/all bridge fetch failed:", e?.message || e);
          // Fallback so the route still returns Admin users instead of 500
          bridgeUsers = [];
        }

        // Email-based scoping (only when not global super)
        if (allowedEmails) {
          bridgeUsers = bridgeUsers.filter(
            (u: any) => u.email && allowedEmails!.has(String(u.email).toLowerCase())
          );
        }
      }

      const bridgeMapped = bridgeUsers.map((u: any) => ({
        id: u.id,
        name: u.name,
        email: u.email ?? "",
        phone: u.phone ?? "",
        role: u.role,               // 'resident' | 'provider'
        isApproved: !!u.isApproved, // providers only
        isActive: !!u.isActive,
        source: "bridge",
        createdAt: u.createdAt ?? undefined,
        updatedAt: u.updatedAt ?? undefined,
      }));

      // ---------- Combine + filters ----------
      let combined = [...adminMapped, ...bridgeMapped];

      if (search) {
        const needle = String(search).toLowerCase();
        combined = combined.filter(
          (u) =>
            (u.name ?? "").toLowerCase().includes(needle) ||
            (u.email ?? "").toLowerCase().includes(needle) ||
            (u.phone ?? "").toLowerCase().includes(needle)
        );
      }

      if (status === "active") combined = combined.filter((u) => u.isActive);
      if (status === "inactive") combined = combined.filter((u) => !u.isActive);

      if (role) combined = combined.filter((u) => u.role === role);

      combined.sort((a, b) => {
        const ax = (a.name || a.email || "").toLowerCase();
        const bx = (b.name || b.email || "").toLowerCase();
        return ax.localeCompare(bx);
      });

      // ---------- Pagination ----------
      const start = Number(offset) || 0;
      const end = start + (Number(limit) || 50);
      const page = combined.slice(start, end);

      res.json({
        total: combined.length,
        limit: Number(limit),
        offset: Number(offset),
        items: page,
      });
    } catch (error: any) {
      console.error("Unified users error:", error);
      res.status(500).json({ error: error.message || String(error) });
    }
  }
);


router.post(
  "/users",
  authenticateAdmin,
  requireEstateAdmin,
  auditAction("CREATE", "USER"),
  async (req: AdminRequest, res) => {
    try {
      const data = createUserSchema.parse(req.body);
      const hashedPassword = await AdminAuthService.hashPassword(data.password);

      const user = await adminDb.createUser({ ...data, passwordHash: hashedPassword });
      const { passwordHash, ...userResponse } = user.toObject();
      res.status(201).json(userResponse);
    } catch (error: any) {
      if (error.code === 11000) res.status(400).json({ error: "Email already exists" });
      else res.status(400).json({ error: error.message });
    }
  }
);




router.get(
  "/users/:id",
  authenticateAdmin,
  setEstateContext,
  requireModerator,
  
  async (req: AdminRequest, res) => {
    try {
      const userId = req.params.id;
      if (req.params.id === "all") {
        return next(); // skip to the /users/all handler
      }
      if (req.adminUser?.globalRole !== UserRole.SUPER_ADMIN) {
        if (!req.currentEstate) return res.status(400).json({ error: "Estate context required" });
        const memberships = await adminDb.getUserMemberships(userId);
        const isEstateUser = memberships.some((m) => m.estateId === req.currentEstate!.id);
        if (!isEstateUser) return res.status(403).json({ error: "User not found in current estate" });
      }

      const user = await adminDb.getUserById(userId);
      if (!user) return res.status(404).json({ error: "User not found" });

      const { passwordHash, ...userResponse } = user.toObject();
      res.json(userResponse);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);


router.get(
  "/users/:id/memberships",
  authenticateAdmin,
  setEstateContext,
  requireModerator,
  async (req: AdminRequest, res) => {
    try {
      const userId = req.params.id;
      const memberships = await adminDb.getUserMemberships(userId);

      if (req.adminUser?.globalRole !== UserRole.SUPER_ADMIN) {
        if (!req.currentEstate) return res.status(400).json({ error: "Estate context required" });
        const scoped = memberships.filter((m) => m.estateId === req.currentEstate!.id);
        return res.json(scoped);
      }

      res.json(memberships);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);

router.patch(
  "/users/:id",
  authenticateAdmin,
  requireEstateAdmin,
  auditAction("UPDATE", "USER"),
  async (req: AdminRequest, res) => {
    try {
      const updates = { ...req.body };
      if (updates.password) {
        updates.passwordHash = await AdminAuthService.hashPassword(updates.password);
        delete updates.password;
      }
      const user = await adminDb.updateUser(req.params.id, updates);
      if (!user) return res.status(404).json({ error: "User not found" });

      const { passwordHash, ...userResponse } = user.toObject();
      res.json(userResponse);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }
);

// ---- Unified Users (Admin + Residents + Providers) ----

/** ------------------------------------------------------------------ */
/** Providers                                                           */
/** ------------------------------------------------------------------ */
router.post(
  "/providers",
  authenticateAdmin,
  setEstateContext,
  requireEstateAdmin,
  auditAction("CREATE", "PROVIDER"),
  async (req: AdminRequest, res) => {
    let createdUser: any = null;
    try {
      const data = createProviderSchema.parse(req.body);
      const hashedPassword = await AdminAuthService.hashPassword(data.password);

      // 1) Create user
      createdUser = await adminDb.createUser({
        name: data.name,
        email: data.email,
        phone: data.phone || "",
        passwordHash: hashedPassword,
        globalRole: "provider",
      });

      // 2) Create provider profile
      const provider = await adminDb.createProvider({
        userId: createdUser._id.toString(),
        company: data.company,
        categories: data.categories,
        experience: data.experience ?? 0,
        description: data.description ?? "",
        isApproved: data.isApproved !== false,
        rating: 0,
        totalJobs: 0,
        estates:
          req.adminUser?.globalRole !== UserRole.SUPER_ADMIN && req.currentEstate
            ? [req.currentEstate.id]
            : [],
      });

      res.status(201).json(provider);
    } catch (error: any) {
      // Cleanup user if provider creation fails
      if (createdUser) {
        try {
          await adminDb.AdminUser.findByIdAndDelete(createdUser._id);
          console.log(`Cleaned orphaned user ${createdUser._id} after provider creation failure`);
        } catch (cleanupError) {
          console.error("Failed cleanup after provider error:", cleanupError);
        }
      }

      if (error.name === "ZodError") {
        return res.status(400).json({
          error: "Validation error",
          details: error.errors.map((e: any) => `${e.path.join(".")}: ${e.message}`),
        });
      }
      if (error.code === 11000) return res.status(400).json({ error: "Email already exists" });
      res.status(400).json({ error: error.message });
    }
  }
);

router.get(
  "/providers",
  requireAdminDB,
  authenticateAdmin,
  setEstateContext,
  requireModerator,
  async (req: AdminRequest, res) => {
    try {
      const { approved, category, search, limit = 50, offset = 0 } = req.query as Record<string, any>;
      const filter: any = {};
      if (approved !== undefined) filter.isApproved = approved === "true";
      if (category) filter.categories = category;
      if (search) filter.$or = [{ categories: { $regex: search, $options: "i" } }];

      // Super admins in global mode (no estate context) see all providers
      const isSuperGlobal = req.adminUser?.globalRole === UserRole.SUPER_ADMIN && !req.currentEstate;
      
      if (!isSuperGlobal) {
        // Non-super admins or super admins with estate context see estate-scoped providers
        if (!req.currentEstate) return res.status(400).json({ error: "Estate context required" });
        filter.estates = req.currentEstate.id;
      }

      const providers = await adminDb.getProviders(filter);
      res.json(providers.slice(Number(offset), Number(offset) + Number(limit)));
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);

router.patch(
  "/providers/:id",
  authenticateAdmin,
  setEstateContext,
  requireEstateAdmin,
  auditAction("UPDATE", "PROVIDER"),
  async (req: AdminRequest, res) => {
    try {
      const provider = await adminDb.updateProvider(req.params.id, req.body);
      if (!provider) return res.status(404).json({ error: "Provider not found" });
      res.json(provider);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }
);

router.patch(
  "/providers/:id/approve",
  authenticateAdmin,
  setEstateContext,
  requireEstateAdmin,
  auditAction("APPROVE", "PROVIDER"),
  async (req: AdminRequest, res) => {
    try {
      const { approved } = req.body;
      const provider = await adminDb.updateProvider(req.params.id, { isApproved: approved });
      if (!provider) return res.status(404).json({ error: "Provider not found" });
      res.json(provider);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }
);

/** ------------------------------------------------------------------ */
/** Memberships                                                         */
/** ------------------------------------------------------------------ */
router.get(
  "/estates/:estateId/memberships",
  authenticateAdmin,
  setEstateContext,
  requireEstateAdmin,
  async (req, res) => {
    try {
      const { role } = req.query;
      const memberships = await adminDb.getEstateMemberships(req.params.estateId, role as string);
      res.json(memberships);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);

router.post(
  "/memberships",
  authenticateAdmin,
  requireEstateAdmin,
  auditAction("CREATE", "MEMBERSHIP"),
  async (req: AdminRequest, res) => {
    try {
      const data = createMembershipSchema.parse(req.body);
      const membership = await adminDb.createMembership(data);
      res.status(201).json(membership);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }
);

router.patch(
  "/memberships/:userId/:estateId",
  authenticateAdmin,
  requireEstateAdmin,
  auditAction("UPDATE", "MEMBERSHIP"),
  async (req: AdminRequest, res) => {
    try {
      const { userId, estateId } = req.params;
      const membership = await adminDb.updateMembership(userId, estateId, req.body);
      res.json(membership);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }
);

/** ------------------------------------------------------------------ */
/** Service Requests (Mongo)                                            */
/** ------------------------------------------------------------------ */
router.get(
  "/service-requests",
  authenticateAdmin,
  setEstateContext,
  async (req: AdminRequest, res) => {
    try {
      const { status, category, provider, limit = 50, offset = 0 } = req.query as Record<string, any>;
      const filter: any = {};
      if (status) filter.status = status;
      if (category) filter.category = category;
      if (provider) filter.providerId = provider;

      let requests: any[];
      if (req.currentEstate) requests = await adminDb.getServiceRequestsByEstate(req.currentEstate.id, filter);
      else if (req.adminUser?.globalRole === UserRole.SUPER_ADMIN) requests = await adminDb.getServiceRequests(filter);
      else return res.status(400).json({ error: "Estate context required" });

      res.json(requests.slice(Number(offset), Number(offset) + Number(limit)));
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);

router.patch(
  "/service-requests/:id",
  authenticateAdmin,
  requireModerator,
  auditAction("UPDATE", "SERVICE_REQUEST"),
  async (req: AdminRequest, res) => {
    try {
      const request = await adminDb.updateServiceRequest(req.params.id, req.body);
      if (!request) return res.status(404).json({ error: "Service request not found" });
      res.json(request);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }
);

/** ------------------------------------------------------------------ */
/** Categories                                                          */
/** ------------------------------------------------------------------ */
router.get(
  "/categories",
  requireAdminDB,
  authenticateAdmin,
  setEstateContext,
  requireModerator,
  async (req: AdminRequest, res) => {
    try {
      const { scope } = req.query as Record<string, any>;
      let categories: any[];

      if (req.adminUser?.globalRole === UserRole.SUPER_ADMIN) {
        if (scope === "global") categories = await adminDb.getCategoriesByScope("global");
        else if (scope === "estate" && req.query.estateId)
          categories = await adminDb.getCategoriesByScope("estate", req.query.estateId as string);
        else categories = await adminDb.getCategories();
      } else {
        if (!req.currentEstate) return res.status(400).json({ error: "Estate context required" });
        if (scope === "global") categories = await adminDb.getCategoriesByScope("global");
        else {
          const globalCategories = await adminDb.getCategoriesByScope("global");
          const estateCategories = await adminDb.getCategoriesByScope("estate", req.currentEstate.id);
          categories = [...globalCategories, ...estateCategories];
        }
      }

      res.json(categories);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);

router.post(
  "/categories",
  requireAdminDB,
  authenticateAdmin,
  setEstateContext,
  auditAction("CREATE", "CATEGORY"),
  async (req: AdminRequest, res) => {
    try {
      const validatedData = createCategorySchema.parse(req.body);
      const { scope, name, key, description, icon } = validatedData;

      if (scope === "global" && req.adminUser?.globalRole !== UserRole.SUPER_ADMIN) {
        return res.status(403).json({ error: "Only super admins can create global categories" });
      }
      if (scope === "estate") {
        if (
          req.adminUser?.globalRole !== UserRole.SUPER_ADMIN &&
          req.adminUser?.globalRole !== UserRole.ESTATE_ADMIN
        ) {
          return res.status(403).json({ error: "Only super/estate admins can create estate categories" });
        }
        if (!req.currentEstate) return res.status(400).json({ error: "Estate context required for estate categories" });
      }

      const categoryData = {
        scope,
        estateId: scope === "estate" ? req.currentEstate?.id : undefined,
        name,
        key,
        description,
        icon,
        isActive: true,
      };

      const category = await adminDb.createCategory(categoryData);
      res.status(201).json(category);
    } catch (error: any) {
      if (error.code === 11000) res.status(409).json({ error: "Category key already exists in this scope" });
      else res.status(500).json({ error: error.message });
    }
  }
);

router.patch(
  "/categories/:id",
  requireAdminDB,
  authenticateAdmin,
  setEstateContext,
  auditAction("UPDATE", "CATEGORY"),
  async (req: AdminRequest, res) => {
    try {
      const categoryId = req.params.id;
      const validatedUpdates = updateCategorySchema.parse(req.body);

      const existingCategory = await adminDb.AdminCategory.findById(categoryId);
      if (!existingCategory) return res.status(404).json({ error: "Category not found" });

      if (existingCategory.scope === "global" && req.adminUser?.globalRole !== UserRole.SUPER_ADMIN) {
        return res.status(403).json({ error: "Only super admins can modify global categories" });
      }
      if (existingCategory.scope === "estate") {
        if (req.adminUser?.globalRole === UserRole.SUPER_ADMIN) {
          // ok
        } else if (req.adminUser?.globalRole === UserRole.ESTATE_ADMIN) {
          if (!req.currentEstate || existingCategory.estateId !== req.currentEstate.id) {
            return res.status(403).json({ error: "You can only modify categories for your estate" });
          }
        } else {
          return res.status(403).json({ error: "Insufficient permissions" });
        }
      }

      const category = await adminDb.updateCategory(categoryId, validatedUpdates);
      if (!category) return res.status(404).json({ error: "Category not found" });
      res.json(category);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);

router.delete(
  "/categories/:id",
  requireAdminDB,
  authenticateAdmin,
  setEstateContext,
  auditAction("DELETE", "CATEGORY"),
  async (req: AdminRequest, res) => {
    try {
      const categoryId = req.params.id;
      const existingCategory = await adminDb.AdminCategory.findById(categoryId);
      if (!existingCategory) return res.status(404).json({ error: "Category not found" });

      if (existingCategory.scope === "global" && req.adminUser?.globalRole !== UserRole.SUPER_ADMIN) {
        return res.status(403).json({ error: "Only super admins can delete global categories" });
      }
      if (existingCategory.scope === "estate") {
        if (req.adminUser?.globalRole === UserRole.SUPER_ADMIN) {
          // ok
        } else if (req.adminUser?.globalRole === UserRole.ESTATE_ADMIN) {
          if (!req.currentEstate || existingCategory.estateId !== req.currentEstate.id) {
            return res.status(403).json({ error: "You can only delete categories for your estate" });
          }
        } else {
          return res.status(403).json({ error: "Insufficient permissions" });
        }
      }

      await adminDb.updateCategory(categoryId, { isActive: false });
      res.json({ message: "Category deleted successfully" });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);

/** ------------------------------------------------------------------ */
/** Marketplace                                                         */
/** ------------------------------------------------------------------ */
router.get(
  "/marketplace",
  requireAdminDB,
  authenticateAdmin,
  setEstateContext,
  requireModerator,
  async (req: AdminRequest, res) => {
    try {
      const { category, vendor, search, limit = 50, offset = 0 } = req.query as Record<string, any>;
      const filter: any = {};
      if (category) filter.category = category;
      if (vendor) filter.vendorId = vendor;
      if (search) {
        filter.$or = [
          { name: { $regex: search, $options: "i" } },
          { description: { $regex: search, $options: "i" } },
        ];
      }

      let items: any[];
      if (req.adminUser?.globalRole === UserRole.SUPER_ADMIN) {
        if (req.query.estateId)
          items = await adminDb.getMarketplaceItemsByEstate(req.query.estateId as string, filter);
        else items = await adminDb.getMarketplaceItems(filter);
      } else {
        if (!req.currentEstate) return res.status(400).json({ error: "Estate context required" });
        items = await adminDb.getMarketplaceItemsByEstate(req.currentEstate.id, filter);
      }

      res.json(items.slice(Number(offset), Number(offset) + Number(limit)));
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);

router.post(
  "/marketplace",
  requireAdminDB,
  authenticateAdmin,
  setEstateContext,
  auditAction("CREATE", "MARKETPLACE_ITEM"),
  async (req: AdminRequest, res) => {
    try {
      const validatedData = createMarketplaceItemSchema.parse(req.body);

      if (
        req.adminUser?.globalRole !== UserRole.SUPER_ADMIN &&
        req.adminUser?.globalRole !== UserRole.ESTATE_ADMIN
      ) {
        return res
          .status(403)
          .json({ error: "Only estate admins and super admins can create marketplace items" });
      }
      if (!req.currentEstate) {
        return res.status(400).json({ error: "Estate context required" });
      }

      const item = await adminDb.createMarketplaceItem({
        ...validatedData,
        estateId: req.currentEstate.id,
        isActive: true,
      });
      res.status(201).json(item);
    } catch (error: any) {
      if (error.name === "ZodError") res.status(400).json({ error: "Validation error", details: error.errors });
      else res.status(500).json({ error: error.message });
    }
  }
);

router.patch(
  "/marketplace/:id",
  requireAdminDB,
  authenticateAdmin,
  setEstateContext,
  auditAction("UPDATE", "MARKETPLACE_ITEM"),
  async (req: AdminRequest, res) => {
    try {
      const itemId = req.params.id;
      const existingItem = await adminDb.MarketplaceItem.findById(itemId).lean();
      if (!existingItem) return res.status(404).json({ error: "Marketplace item not found" });

      if (req.adminUser?.globalRole === UserRole.SUPER_ADMIN) {
        // ok
      } else if (req.adminUser?.globalRole === UserRole.ESTATE_ADMIN) {
        if (!req.currentEstate || existingItem.estateId !== req.currentEstate.id) {
          return res.status(403).json({ error: "You can only modify items for your estate" });
        }
      } else {
        return res.status(403).json({ error: "Insufficient permissions" });
      }

      const item = await adminDb.updateMarketplaceItem(itemId, req.body);
      if (!item) return res.status(404).json({ error: "Marketplace item not found" });
      res.json(item);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);

router.delete(
  "/marketplace/:id",
  requireAdminDB,
  authenticateAdmin,
  setEstateContext,
  auditAction("DELETE", "MARKETPLACE_ITEM"),
  async (req: AdminRequest, res) => {
    try {
      const itemId = req.params.id;
      const existingItem = await adminDb.MarketplaceItem.findById(itemId).lean();
      if (!existingItem) return res.status(404).json({ error: "Marketplace item not found" });

      if (req.adminUser?.globalRole === UserRole.SUPER_ADMIN) {
        // ok
      } else if (req.adminUser?.globalRole === UserRole.ESTATE_ADMIN) {
        if (!req.currentEstate || existingItem.estateId !== req.currentEstate.id) {
          return res.status(403).json({ error: "You can only delete items for your estate" });
        }
      } else {
        return res.status(403).json({ error: "Insufficient permissions" });
      }

      await adminDb.updateMarketplaceItem(itemId, { isActive: false });
      res.json({ message: "Marketplace item deleted successfully" });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);

/** ------------------------------------------------------------------ */
/** Audit logs                                                          */
/** ------------------------------------------------------------------ */
router.get(
  "/audit-logs",
  authenticateAdmin,
  setEstateContext,
  requireEstateAdmin,
  async (req: AdminRequest, res) => {
    try {
      const { limit = 100, action, target } = req.query as Record<string, any>;
      const filter: any = {};
      if (action) filter.action = action;
      if (target) filter.target = target;

      let logs: any[];
      if (req.currentEstate) {
        logs = await adminDb.getAuditLogsByEstate(req.currentEstate.id, Number(limit));
      } else if (req.adminUser?.globalRole === UserRole.SUPER_ADMIN) {
        logs = await adminDb.getAuditLogs(filter, Number(limit));
      } else {
        return res.status(400).json({ error: "Estate context required" });
      }

      res.json(logs);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);

/** ------------------------------------------------------------------ */
/** Orders + Analytics                                                  */
/** ------------------------------------------------------------------ */
router.get(
  "/orders",
  requireAdminDB,
  authenticateAdmin,
  setEstateContext,
  async (req: AdminRequest, res) => {
    try {
      const {
        search,
        status,
        buyerId,
        vendorId,
        startDate,
        endDate,
        minTotal,
        maxTotal,
        hasDispute,
        disputeStatus,
        page = 1,
        limit = 20,
        sortBy = "createdAt",
        sortOrder = "desc",
      } = req.query as Record<string, any>;

      const filter: any = {};
      if (req.currentEstate) filter.estateId = req.currentEstate.id;
      else if (req.adminUser?.globalRole !== UserRole.SUPER_ADMIN)
        return res.status(400).json({ error: "Estate context required" });

      if (search) {
        filter.$or = [
          { orderId: { $regex: search, $options: "i" } },
          { "buyerInfo.name": { $regex: search, $options: "i" } },
          { "buyerInfo.email": { $regex: search, $options: "i" } },
          { "vendorInfo.name": { $regex: search, $options: "i" } },
          { "vendorInfo.email": { $regex: search, $options: "i" } },
          { "deliveryAddress.street": { $regex: search, $options: "i" } },
          { "deliveryAddress.city": { $regex: search, $options: "i" } },
        ];
      }

      if (status) filter.status = status;
      if (buyerId) filter.buyerId = buyerId;
      if (vendorId) filter.vendorId = vendorId;
      if (hasDispute === "true") filter["dispute.reason"] = { $exists: true };
      if (disputeStatus) filter["dispute.status"] = disputeStatus;

      if (startDate || endDate) {
        filter.createdAt = {};
        if (startDate) filter.createdAt.$gte = new Date(startDate);
        if (endDate) filter.createdAt.$lte = new Date(endDate);
      }

      if (minTotal || maxTotal) {
        filter.total = {};
        if (minTotal) filter.total.$gte = Number(minTotal);
        if (maxTotal) filter.total.$lte = Number(maxTotal);
      }

      const skip = (Number(page) - 1) * Number(limit);
      const sortDirection = sortOrder === "desc" ? -1 : 1;

      const [orders, totalCount] = await Promise.all([
        adminDb.Order.find(filter).sort({ [String(sortBy)]: sortDirection }).skip(skip).limit(Number(limit)).lean(),
        adminDb.Order.countDocuments(filter),
      ]);

      const userIds = Array.from(new Set([...orders.map((o) => o.buyerId), ...orders.map((o) => o.vendorId)]));
      const users = await adminDb.AdminUser.find({ _id: { $in: userIds } })
        .select("_id name email")
        .lean();
      const userMap = new Map(users.map((u: any) => [u._id.toString(), u]));

      const enrichedOrders = orders.map((order: any) => ({
        ...order,
        buyer: userMap.get(order.buyerId),
        vendor: userMap.get(order.vendorId),
      }));

      res.json({
        orders: enrichedOrders,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total: totalCount,
          totalPages: Math.ceil(totalCount / Number(limit)),
        },
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);

router.get(
  "/orders/:id",
  requireAdminDB,
  authenticateAdmin,
  setEstateContext,
  async (req: AdminRequest, res) => {
    try {
      const order = await adminDb.Order.findById(req.params.id).lean();
      if (!order) return res.status(404).json({ error: "Order not found" });

      if (req.currentEstate && order.estateId !== req.currentEstate.id)
        return res.status(403).json({ error: "Access denied" });
      else if (!req.currentEstate && req.adminUser?.globalRole !== UserRole.SUPER_ADMIN)
        return res.status(400).json({ error: "Estate context required" });

      const [buyer, vendor] = await Promise.all([
        adminDb.AdminUser.findById(order.buyerId).select("_id name email phone").lean(),
        adminDb.AdminUser.findById(order.vendorId).select("_id name email phone").lean(),
      ]);

      const itemIds = order.items.map((i: any) => i.itemId);
      const marketplaceItems = await adminDb.MarketplaceItem.find({ _id: { $in: itemIds } }).lean();
      const itemMap = new Map(marketplaceItems.map((i: any) => [i._id.toString(), i]));
      const enrichedItems = order.items.map((i: any) => ({ ...i, marketplaceItem: itemMap.get(i.itemId) }));

      res.json({ ...order, buyer, vendor, items: enrichedItems });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);

router.patch(
  "/orders/:id/status",
  requireAdminDB,
  authenticateAdmin,
  setEstateContext,
  auditAction("UPDATE_STATUS", "ORDER"),
  async (req: AdminRequest, res) => {
    try {
      const { status } = z.object({ status: z.enum(["pending", "processing", "delivered", "cancelled"]) }).parse(req.body);
      const order = await adminDb.Order.findById(req.params.id);
      if (!order) return res.status(404).json({ error: "Order not found" });

      if (req.currentEstate && order.estateId !== req.currentEstate.id)
        return res.status(403).json({ error: "Access denied" });
      else if (!req.currentEstate && req.adminUser?.globalRole !== UserRole.SUPER_ADMIN)
        return res.status(400).json({ error: "Estate context required" });

      const validTransitions: Record<string, string[]> = {
        pending: ["processing", "cancelled"],
        processing: ["delivered", "cancelled"],
        delivered: [],
        cancelled: [],
      };
      if (!validTransitions[order.status]?.includes(status)) {
        return res
          .status(400)
          .json({ error: `Invalid status transition from ${order.status} to ${status}` });
      }

      order.status = status;
      await order.save();
      res.json({ message: "Order status updated successfully", order });
    } catch (error: any) {
      if (error.name === "ZodError") res.status(400).json({ error: "Validation error", details: error.errors });
      else res.status(500).json({ error: error.message });
    }
  }
);

router.post(
  "/orders/:id/dispute",
  requireAdminDB,
  authenticateAdmin,
  setEstateContext,
  auditAction("CREATE_DISPUTE", "ORDER"),
  async (req: AdminRequest, res) => {
    try {
      const { reason, description } = z
        .object({
          reason: z.string().min(1).max(200),
          description: z.string().min(10).max(1000).optional(),
        })
        .parse(req.body);

      const order = await adminDb.Order.findById(req.params.id);
      if (!order) return res.status(404).json({ error: "Order not found" });

      if (req.currentEstate && order.estateId !== req.currentEstate.id)
        return res.status(403).json({ error: "Access denied" });
      else if (!req.currentEstate && req.adminUser?.globalRole !== UserRole.SUPER_ADMIN)
        return res.status(400).json({ error: "Estate context required" });

      if (order.dispute?.reason) return res.status(400).json({ error: "Dispute already exists for this order" });
      if (order.status !== "delivered")
        return res.status(400).json({ error: "Disputes can only be created for delivered orders" });

      order.dispute = { reason, status: "open", resolvedAt: undefined as any };
      await order.save();

      res.status(201).json({ message: "Dispute created successfully", order });
    } catch (error: any) {
      if (error.name === "ZodError") res.status(400).json({ error: "Validation error", details: error.errors });
      else res.status(500).json({ error: error.message });
    }
  }
);

router.patch(
  "/orders/:id/dispute",
  requireAdminDB,
  authenticateAdmin,
  setEstateContext,
  auditAction("RESOLVE_DISPUTE", "ORDER"),
  async (req: AdminRequest, res) => {
    try {
      const { status, resolution, refundAmount } = z
        .object({
          status: z.enum(["resolved", "rejected", "escalated"]),
          resolution: z.string().min(10).max(1000),
          refundAmount: z.number().min(0).optional(),
        })
        .parse(req.body);

      const order = await adminDb.Order.findById(req.params.id);
      if (!order) return res.status(404).json({ error: "Order not found" });

      if (req.currentEstate && order.estateId !== req.currentEstate.id)
        return res.status(403).json({ error: "Access denied" });
      else if (!req.currentEstate && req.adminUser?.globalRole !== UserRole.SUPER_ADMIN)
        return res.status(400).json({ error: "Estate context required" });

      if (!order.dispute?.reason) return res.status(400).json({ error: "No dispute exists for this order" });
      if (order.dispute.status !== "open") return res.status(400).json({ error: "Dispute is already resolved" });
      if (refundAmount && refundAmount > order.total)
        return res.status(400).json({ error: "Refund amount cannot exceed order total" });

      order.dispute.status = status;
      order.dispute.resolvedAt = status === "resolved" ? new Date() : (undefined as any);
      await order.save();

      res.json({ message: "Dispute resolved successfully", order });
    } catch (error: any) {
      if (error.name === "ZodError") res.status(400).json({ error: "Validation error", details: error.errors });
      else res.status(500).json({ error: error.message });
    }
  }
);

/** ------------------------------------------------------------------ */
/** Bridge (PostgreSQL system)  — EMAIL-BASED TENANT SCOPING            */
/** ------------------------------------------------------------------ */

// Helper: get allowed emails for current estate (Mongo → emails).
// Returns null if we should not scope (super admin without estate, or mapping unavailable).
async function getAllowedEmailsOrNull(req: AdminRequest): Promise<Set<string> | null> {
  // If scope is turned off, return null to signal "no scoping"
  if (BRIDGE_SCOPE === "off") return null;

  const isGlobalSuper = req.adminUser?.globalRole === UserRole.SUPER_ADMIN && !req.currentEstate;
  if (isGlobalSuper) return null; // no scoping for global super admin

  if (!req.currentEstate) {
    // Non-super admins must supply an estate
    throw Object.assign(new Error("Estate context required for non-super admin users"), { status: 400 });
  }

  // Get memberships (userIds in Mongo), then derive emails
  const memberships = await adminDb.getEstateMemberships(req.currentEstate.id);
  const mongoIds = memberships.map((m: any) => m.userId);
  if (!mongoIds.length) {
    // Dev-friendly: if there are no memberships yet, skip scoping so you can at least see data.
    // Change to `return new Set()` if you prefer strict behavior.
    return null;
  }

  const users = await adminDb.AdminUser.find({ _id: { $in: mongoIds } }).select("email").lean();
  const emails = users
    .map((u: any) => (u.email || "").toLowerCase())
    .filter(Boolean);

  return emails.length ? new Set(emails) : null;
}


router.get(
  "/bridge/service-requests",
  authenticateAdmin,
  setEstateContext,
  requireEstateAdmin,
  async (req: AdminRequest, res) => {
    try {
      const { status, category, residentId, providerId } = req.query as Record<string, string | undefined>;

      const allowedEmails = await getAllowedEmailsOrNull(req);

      // Pull ALL requests from Postgres
      const all = await storage.getAllServiceRequests();

      // Enrich with storage users (to get emails for scoping)
      const enriched = await Promise.all(
        all.map(async (r: any) => {
          const resident = r.residentId ? await storage.getUser(r.residentId) : null;
          const provider = r.providerId ? await storage.getUser(r.providerId) : null;
          return {
            ...r,
            resident,
            provider,
            residentEmail: resident?.email?.toLowerCase() || null,
            providerEmail: provider?.email?.toLowerCase() || null,
          };
        })
      );

      // Tenant scope (by email) unless global super admin
      let scoped = enriched;
      if (allowedEmails) {
        scoped = enriched.filter(
          (r) =>
            (r.residentEmail && allowedEmails.has(r.residentEmail)) ||
            (r.providerEmail && allowedEmails.has(r.providerEmail))
        );
      }

      // Apply query filters
      if (status) scoped = scoped.filter((r) => r.status === status);
      if (category) scoped = scoped.filter((r) => r.category === category);
      if (residentId) scoped = scoped.filter((r) => r.residentId === residentId);
      if (providerId) scoped = scoped.filter((r) => r.providerId === providerId);

      // Shape response
      res.json(
        scoped.map((r) => ({
          ...r,
          residentName: r.resident?.name ?? "Unknown Resident",
          residentEmail: r.resident?.email ?? "",
          residentPhone: r.resident?.phone ?? "",
          providerName: r.provider?.name ?? null,
          providerEmail: r.provider?.email ?? null,
          providerPhone: r.provider?.phone ?? null,
        }))
      );
    } catch (error: any) {
      console.error("Bridge service requests error:", error);
      res.status(error.status || 500).json({ error: error.message });
    }
  }
);

router.get(
  "/bridge/users",
  authenticateAdmin,
  setEstateContext,
  requireEstateAdmin,
  async (req: AdminRequest, res) => {
    try {
      const { role, search, status } = req.query as Record<string, string | undefined>;
      const allowedEmails = await getAllowedEmailsOrNull(req);

      // Pull from Postgres
      let users = role ? await storage.getUsers(role) : await storage.getUsers();

      // Scope by email when applicable
      if (allowedEmails) {
        users = users.filter((u: any) => u.email && allowedEmails.has(String(u.email).toLowerCase()));
      }

      // Search
      if (search) {
        const q = search.toLowerCase();
        users = users.filter(
          (u: any) =>
            String(u.name || "").toLowerCase().includes(q) ||
            String(u.email || "").toLowerCase().includes(q) ||
            String(u.phone || "").includes(search)
        );
      }

      // Status filter
      if (status === "active") users = users.filter((u: any) => u.isActive);
      if (status === "inactive") users = users.filter((u: any) => !u.isActive);

      // Provider extras
      if (role === "provider") {
        users = users.map((u: any) => ({
          ...u,
          isPending: !u.isApproved,
          totalJobs: 0,
        }));
      }

      res.json(users);
    } catch (error: any) {
      console.error("Bridge users error:", error);
      res.status(error.status || 500).json({ error: error.message });
    }
  }
);

// Bridge: Get user statistics from PostgreSQL system (email-scoped)
router.get(
  "/bridge/stats",
  authenticateAdmin,
  setEstateContext,
  requireEstateAdmin,
  async (req: AdminRequest, res) => {
    try {
      const allowedEmails = await getAllowedEmailsOrNull(req);

      const [allUsers, allRequests] = await Promise.all([
        storage.getUsers(),
        storage.getAllServiceRequests(),
      ]);

      // Scope users by email
      const usersScoped =
        allowedEmails
          ? allUsers.filter((u: any) => u.email && allowedEmails.has(String(u.email).toLowerCase()))
          : allUsers;



      // Enrich requests to add emails for scoping
      const enrichedReqs = await Promise.all(
        allRequests.map(async (r: any) => {
          const resident = r.residentId ? await storage.getUser(r.residentId) : null;
          const provider = r.providerId ? await storage.getUser(r.providerId) : null;
          return {
            ...r,
            residentEmail: resident?.email?.toLowerCase() || null,
            providerEmail: provider?.email?.toLowerCase() || null,
          };
        })
      );

      const requestsScoped =
        allowedEmails
          ? enrichedReqs.filter(
              (r) =>
                (r.residentEmail && allowedEmails.has(r.residentEmail)) ||
                (r.providerEmail && allowedEmails.has(r.providerEmail))
            )
          : enrichedReqs;

      // Build stats
      const usersStats = {
        totalUsers: usersScoped.length,
        totalResidents: usersScoped.filter((u: any) => u.role === "resident").length,
        totalProviders: usersScoped.filter((u: any) => u.role === "provider").length,
        activeUsers: usersScoped.filter((u: any) => u.isActive).length,
        inactiveUsers: usersScoped.filter((u: any) => !u.isActive).length,
        approvedProviders: usersScoped.filter((u: any) => u.role === "provider" && u.isApproved).length,
        pendingProviders: usersScoped.filter((u: any) => u.role === "provider" && !u.isApproved).length,
      };

      const serviceStats = {
        total: requestsScoped.length,
        pending: requestsScoped.filter((r: any) => r.status === "pending").length,
        assigned: requestsScoped.filter((r: any) => r.status === "assigned").length,
        inProgress: requestsScoped.filter((r: any) => r.status === "in_progress").length,
        completed: requestsScoped.filter((r: any) => r.status === "completed").length,
        cancelled: requestsScoped.filter((r: any) => r.status === "cancelled").length,
      };

      res.json({
        users: usersStats,
        serviceRequests: serviceStats,
        lastUpdated: new Date().toISOString(),
        source: "postgresql_bridge",
      });
    } catch (error: any) {
      console.error("Bridge stats error:", error);
      res.status(error.status || 500).json({ error: error.message });
    }
  }
);

// Bridge: Get user wallet/transactions (authorize by email)
router.get(
  "/bridge/users/:id/wallet",
  authenticateAdmin,
  setEstateContext,
  requireEstateAdmin,
  async (req: AdminRequest, res) => {
    try {
      const { id } = req.params;

      // Fetch the Postgres user to obtain their email for scoping checks
      const pgUser = await storage.getUser(id);
      if (!pgUser) return res.status(404).json({ error: "User not found" });

      // Non-global-super must pass email-based membership scope
      const allowedEmails = await getAllowedEmailsOrNull(req);
      if (allowedEmails && (!pgUser.email || !allowedEmails.has(String(pgUser.email).toLowerCase()))) {
        return res.status(403).json({ error: "User not found in your estate" });
      }

      // Get wallet + transactions
      const wallet = await storage.getWalletByUserId(id);
      if (!wallet) {
        return res.json({
          user: { id: pgUser.id, name: pgUser.name, email: pgUser.email },
          wallet: null,
          transactions: [],
          message: "No wallet found for this user",
        });
      }

      const transactions = await storage.getTransactionsByWallet(wallet.id);
      res.json({
        user: { id: pgUser.id, name: pgUser.name, email: pgUser.email, role: pgUser.role },
        wallet,
        transactions,
      });
    } catch (error: any) {
      console.error("Bridge wallet error:", error);
      res.status(error.status || 500).json({ error: error.message });
    }
  }
);

// Debug: show bridge scope state (emails, estate, etc.)
router.get(
  "/bridge/_debug-scope",
  authenticateAdmin,
  setEstateContext,
  async (req: AdminRequest, res) => {
    try {
      const isGlobalSuper = req.adminUser?.globalRole === UserRole.SUPER_ADMIN && !req.currentEstate;
      let allowedEmails: string[] | null = null;

      if (BRIDGE_SCOPE !== "off" && !isGlobalSuper && req.currentEstate) {
        const memberships = await adminDb.getEstateMemberships(req.currentEstate.id);
        const mongoIds = memberships.map((m: any) => m.userId);
        const users = mongoIds.length
          ? await adminDb.AdminUser.find({ _id: { $in: mongoIds } }).select("email").lean()
          : [];
        allowedEmails = users.map((u: any) => (u.email || "").toLowerCase()).filter(Boolean);
      }

      res.json({
        bridgeScope: BRIDGE_SCOPE,
        isGlobalSuper,
        estateId: req.currentEstate?.id ?? null,
        allowedEmailsCount: allowedEmails ? allowedEmails.length : null,
        allowedEmailsSample: allowedEmails ? allowedEmails.slice(0, 10) : null,
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  }
);

// One-time helper: create memberships in current estate for any AdminUser whose email exists in Postgres.
// This makes email-based scoping work without hand-adding memberships.
router.post(
  "/bridge/_sync-memberships",
  authenticateAdmin,
  setEstateContext,
  requireEstateAdmin,
  async (req: AdminRequest, res) => {
    try {
      if (!req.currentEstate) {
        return res.status(400).json({ error: "Estate context required" });
      }

      // Pull all Postgres users to harvest emails
      const pgUsers = await storage.getUsers();
      const emailSet = new Set(
        pgUsers
          .map((u: any) => String(u.email || "").toLowerCase())
          .filter((e: string) => !!e)
      );

      if (!emailSet.size) {
        return res.json({ synced: 0, skipped: 0, message: "No emails found in Postgres users" });
      }

      // Find AdminUsers with those emails
      const adminUsers = await adminDb.AdminUser.find({
        email: { $in: Array.from(emailSet) },
      }).select("_id email").lean();

      let synced = 0;
      let skipped = 0;

      for (const u of adminUsers) {
        const userId = String(u._id);
        const already = await adminDb.Membership.findOne({
          userId,
          estateId: req.currentEstate.id,
        }).lean();

        if (already) {
          skipped++;
          continue;
        }

        await adminDb.createMembership({
          userId,
          estateId: req.currentEstate.id,
          role: UserRole.MODERATOR,     // role value doesn't affect scoping; pick something allowed
          permissions: [],              // optional
          isActive: true,
        });

        synced++;
      }

      res.json({
        estateId: req.currentEstate.id,
        emailsInPostgres: emailSet.size,
        adminUsersMatched: adminUsers.length,
        membershipsCreated: synced,
        membershipsSkipped: skipped,
      });
    } catch (e: any) {
      console.error("bridge/_sync-memberships error", e);
      res.status(500).json({ error: e.message });
    }
  }
);


/** ------------------------------------------------------------------ */
/** Health                                                              */
/** ------------------------------------------------------------------ */
router.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

export default router;
function next(): void | PromiseLike<void> {
    throw new Error("Function not implemented.");
}

