// server/admin-auth.ts
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { Request, Response, NextFunction } from "express";
import { adminDb } from "./admin-db";
import { UserRole } from "../shared/admin-schema";

/* ──────────────────────────────────────────────────────────
   JWT & Auth config
   ────────────────────────────────────────────────────────── */
const envSecret = process.env.JWT_SECRET ?? process.env.SESSION_SECRET;
if (!envSecret) {
  throw new Error(
    "JWT_SECRET or SESSION_SECRET environment variable is required for admin authentication"
  );
}
// After this runtime guard, TS knows it's a string
const ADMIN_JWT_SECRET: string = envSecret;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "1h";
const REFRESH_TOKEN_EXPIRES_IN = process.env.REFRESH_TOKEN_EXPIRES_IN || "7d";

/* ──────────────────────────────────────────────────────────
   Request typing (exported)
   ────────────────────────────────────────────────────────── */
export interface AdminRequest extends Request {
  adminUser?: {
    id: string;
    email: string;
    name: string;
    globalRole?: string;
    memberships?: Array<{
      estateId: string;
      role: string;
      permissions?: string[];
    }>;
  };
  currentEstate?: {
    id: string;
    name: string;
    slug: string;
  };
}

/* ──────────────────────────────────────────────────────────
   JWT payload typing (internal)
   ────────────────────────────────────────────────────────── */
interface JWTPayload {
  sub: string;
  email?: string;
  name?: string;
  globalRole?: string;
  memberships?: Array<{
    estateId: string;
    role: string;
    permissions?: string[];
  }>;
  type?: "refresh";
  iat?: number;
  exp?: number;
}

/* ──────────────────────────────────────────────────────────
   Auth service (exported)
   ────────────────────────────────────────────────────────── */
export class AdminAuthService {
  static async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 12);
  }

  static async verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
    return bcrypt.compare(password, hashedPassword);
  }

  static generateToken(payload: Omit<JWTPayload, "iat" | "exp">): string {
    return jwt.sign(payload, ADMIN_JWT_SECRET, { expiresIn: JWT_EXPIRES_IN } as jwt.SignOptions);
  }

  static generateRefreshToken(userId: string): string {
    return jwt.sign({ sub: userId, type: "refresh" }, ADMIN_JWT_SECRET, {
      expiresIn: REFRESH_TOKEN_EXPIRES_IN,
    } as jwt.SignOptions);
  }

  static verifyToken(token: string): JWTPayload | null {
    try {
      return jwt.verify(token, ADMIN_JWT_SECRET) as JWTPayload;
    } catch {
      return null;
    }
  }

  static async getUserWithMemberships(userId: string) {
    const user = await adminDb.getUserById(userId);
    if (!user || !user.isActive) return null;

    const memberships = await adminDb.getUserMemberships(userId);
    return {
      id: user._id.toString(),
      email: user.email,
      name: user.name,
      globalRole: user.globalRole,
      memberships: memberships.map((m) => ({
        estateId: m.estateId,
        role: m.role,
        permissions: m.permissions || [],
      })),
    };
  }

  static async authenticateUser(email: string, password: string) {
    const user = await adminDb.getUserByEmail(email);
    if (!user || !user.isActive) throw new Error("Invalid credentials");

    const ok = await this.verifyPassword(password, user.passwordHash);
    if (!ok) throw new Error("Invalid credentials");

    const userWithMemberships = await this.getUserWithMemberships(user._id.toString());
    if (!userWithMemberships) throw new Error("User not found");

    await adminDb.updateUser(user._id.toString(), { lastLoginAt: new Date() });

    const accessToken = this.generateToken({
      sub: userWithMemberships.id,
      email: userWithMemberships.email,
      name: userWithMemberships.name,
      globalRole: userWithMemberships.globalRole,
      memberships: userWithMemberships.memberships,
    });
    const refreshToken = this.generateRefreshToken(userWithMemberships.id);

    return { user: userWithMemberships, accessToken, refreshToken };
  }

  static async createAuditLog(
    actorId: string,
    action: string,
    target: string,
    targetId: string,
    estateId?: string,
    meta: Record<string, any> = {},
    req?: Request
  ) {
    await adminDb.createAuditLog({
      actorId,
      estateId,
      action,
      target,
      targetId,
      meta,
      ipAddress: req?.ip || undefined,
      userAgent: req?.get("User-Agent") || undefined,
    });
  }
}

/* ──────────────────────────────────────────────────────────
   Middleware (exported)
   ────────────────────────────────────────────────────────── */
export const authenticateAdmin = async (req: AdminRequest, res: Response, next: NextFunction) => {
  try {
    const hdr = req.headers.authorization;
    if (!hdr || !hdr.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Authentication required" });
    }
    const token = hdr.slice(7);
    const payload = AdminAuthService.verifyToken(token);
    if (!payload) return res.status(401).json({ error: "Invalid or expired token" });

    const user = await AdminAuthService.getUserWithMemberships(payload.sub);
    if (!user) return res.status(401).json({ error: "User not found or inactive" });

    req.adminUser = user;
    next();
  } catch {
    res.status(401).json({ error: "Authentication failed" });
  }
};

export const setEstateContext = async (req: AdminRequest, _res: Response, next: NextFunction) => {
  try {
    const estateId =
      (req.params as any).estateId ||
      (req.query.estateId as string | undefined) ||
      (req.headers["x-estate-id"] as string | undefined);

    if (estateId) {
      const estate = await adminDb.getEstateById(estateId);
      if (estate) {
        req.currentEstate = {
          id: estate._id.toString(),
          name: estate.name,
          slug: estate.slug,
        };
      }
    }
    next();
  } catch {
    next();
  }
};

export const requireRole = (allowedRoles: string[], allowGlobalAdmin = true) => {
  return (req: AdminRequest, res: Response, next: NextFunction) => {
    const user = req.adminUser;
    const currentEstate = req.currentEstate;

    if (!user) return res.status(401).json({ error: "Authentication required" });

    if (allowGlobalAdmin && user.globalRole === UserRole.SUPER_ADMIN) return next();

    if (currentEstate && user.memberships) {
      const membership = user.memberships.find((m) => m.estateId === currentEstate.id);
      if (membership && allowedRoles.includes(membership.role)) return next();
    }

    if (!currentEstate && user.globalRole && allowedRoles.includes(user.globalRole)) return next();

    return res.status(403).json({ error: "Insufficient permissions" });
  };
};

export const requireSuperAdmin = requireRole([UserRole.SUPER_ADMIN], false);
export const requireEstateAdmin = requireRole([UserRole.SUPER_ADMIN, UserRole.ESTATE_ADMIN]);
export const requireModerator = requireRole([
  UserRole.SUPER_ADMIN,
  UserRole.ESTATE_ADMIN,
  UserRole.MODERATOR,
]);

export const requirePermission = (permission: string) => {
  return (req: AdminRequest, res: Response, next: NextFunction) => {
    const user = req.adminUser;
    const estate = req.currentEstate;

    if (!user) return res.status(401).json({ error: "Authentication required" });
    if (user.globalRole === UserRole.SUPER_ADMIN) return next();

    if (estate && user.memberships) {
      const membership = user.memberships.find((m) => m.estateId === estate.id);
      if (membership?.permissions?.includes(permission)) return next();
    }

    return res.status(403).json({ error: `Permission '${permission}' required` });
  };
};

export const auditAction = (action: string, target: string) => {
  return (req: AdminRequest, res: Response, next: NextFunction) => {
    const originalSend = res.send.bind(res);
    res.send = (data: any) => {
      if (res.statusCode >= 200 && res.statusCode < 300 && req.adminUser) {
        const targetId = (req.params as any).id || (req.body && (req.body.id as string)) || "unknown";
        AdminAuthService.createAuditLog(
          req.adminUser.id,
          action,
          target,
          targetId,
          req.currentEstate?.id,
          { method: req.method, path: req.path, statusCode: res.statusCode },
          req
        ).catch(console.error);
      }
      return originalSend(data);
    };
    next();
  };
};

/* ──────────────────────────────────────────────────────────
   Rate limiting for auth attempts (exported)
   ────────────────────────────────────────────────────────── */
const authAttempts = new Map<string, { count: number; lastAttempt: number }>();
const MAX_AUTH_ATTEMPTS = 5;
const AUTH_WINDOW = 15 * 60 * 1000;

export const rateLimitAuth = (req: Request, res: Response, next: NextFunction) => {
  const ip =
    (req.ip as string) ||
    ((req as any).connection?.remoteAddress as string) ||
    "unknown";
  const now = Date.now();
  const attempts = authAttempts.get(ip);

  if (attempts && attempts.count >= MAX_AUTH_ATTEMPTS && now - attempts.lastAttempt < AUTH_WINDOW) {
    return res
      .status(429)
      .json({ error: "Too many authentication attempts. Please try again later." });
  }

  const originalSend = res.send.bind(res);
  res.send = (data: any) => {
    if (res.statusCode === 401) {
      const current = authAttempts.get(ip) || { count: 0, lastAttempt: 0 };
      authAttempts.set(ip, { count: current.count + 1, lastAttempt: now });
    } else if (res.statusCode === 200) {
      authAttempts.delete(ip);
    }
    return originalSend(data);
  };

  next();
};

/* ──────────────────────────────────────────────────────────
   Default export for route files (import AdminAuth, {type AdminRequest})
   ────────────────────────────────────────────────────────── */
const AdminAuth = {
  AdminAuthService,
  authenticateAdmin,
  setEstateContext,
  requireRole,
  requireSuperAdmin,
  requireEstateAdmin,
  requireModerator,
  requirePermission,
  auditAction,
  rateLimitAuth,
};

export default AdminAuth;
