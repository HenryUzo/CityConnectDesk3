import { Request, Response, NextFunction } from "express";
import { verifyAccessToken, extractTokenFromHeader, JWTPayload } from "./jwt-utils";
import { storage } from "./storage";

// Extend Express Request to include authenticated user
declare global {
  namespace Express {
    interface Request {
      auth?: JWTPayload & { id: string };
    }
  }
}

function ensureDevAuth(req: Request) {
  if (req.auth) return req.auth;
  if (process.env.NODE_ENV === "development" && req.user?.id) {
    req.auth = {
      id: req.user.id,
      userId: req.user.id,
      role: req.user?.role ?? undefined,
      globalRole: req.user?.globalRole ?? undefined,
    } as JWTPayload & { id: string };
    return req.auth;
  }
  return undefined;
 }

/**
 * Middleware to authenticate JWT token
 * Sets req.auth with user information if valid token is present
 */
export function authenticateJWT(req: Request, res: Response, next: NextFunction) {
  const token = extractTokenFromHeader(req.headers.authorization);

  if (!token) {
    return next(); // No token, continue without auth
  }

  const payload = verifyAccessToken(token);
  if (!payload) {
    return res.status(401).json({ message: "Invalid or expired token" });
  }

  // Set auth information on request
  req.auth = {
    ...payload,
    id: payload.userId, // Add id for backward compatibility
  };

  next();
}

/**
 * Middleware to require authentication
 * Must be used after authenticateJWT
 */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const auth = ensureDevAuth(req);
  if (!auth) {
    return res.status(401).json({ message: "Authentication required" });
  }
  next();
}

/**
 * Middleware factory to require specific role(s)
 * Must be used after authenticateJWT
 */
export function requireRole(...allowedRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const auth = ensureDevAuth(req);
    if (!auth) {
      return res.status(401).json({ message: "Authentication required" });
    }

    const userRole = auth.role;
    const userGlobalRole = auth.globalRole;

    // Check if user has any of the allowed roles
    const hasRole = allowedRoles.some(
      role => userRole === role || userGlobalRole === role
    );

    if (!hasRole) {
      return res.status(403).json({ 
        message: "Insufficient permissions",
        required: allowedRoles,
        current: userRole
      });
    }

    next();
  };
}

/**
 * Middleware to require admin or super_admin role
 */
export const requireAdmin = requireRole("admin", "super_admin");

/**
 * Middleware to require provider role
 */
export const requireProvider = requireRole("provider");

/**
 * Middleware to require resident role
 */
export const requireResident = requireRole("resident");

/**
 * Middleware to check if user owns the resource or is an admin
 * Expects resourceUserId to be set on req by previous middleware
 */
export function requireOwnershipOrAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.auth) {
    return res.status(401).json({ message: "Authentication required" });
  }

  const resourceUserId = (req as any).resourceUserId;
  const isOwner = req.auth.userId === resourceUserId;
  const isAdmin = req.auth.role === "admin" || req.auth.globalRole === "super_admin";

  if (!isOwner && !isAdmin) {
    return res.status(403).json({ message: "Access denied" });
  }

  next();
}
