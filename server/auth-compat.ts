import { Request, Response, NextFunction } from "express";

/**
 * Compatibility middleware to support both old (Passport) and new (JWT) authentication
 * This allows gradual migration from session-based to JWT-based auth
 * 
 * Priority:
 * 1. JWT auth (req.auth) - new system
 * 2. Passport session (req.user) - legacy system
 */
export function compatAuth(req: Request, res: Response, next: NextFunction) {
  // If JWT auth is present, use it
  if (req.auth) {
    // Map JWT auth to req.user for backward compatibility
    (req as any).user = {
      id: req.auth.userId,
      email: req.auth.email,
      role: req.auth.role,
      globalRole: req.auth.globalRole,
    };
    
    // Mark as authenticated via isAuthenticated() method
    (req as any).isAuthenticated = () => true;
  }
  // Otherwise, rely on existing Passport session (req.user and req.isAuthenticated)
  
  next();
}

/**
 * Helper to check if request is authenticated via either method
 */
export function isAuthenticated(req: Request): boolean {
  // Check JWT auth first
  if (req.auth) {
    return true;
  }
  
  // Fall back to Passport session auth
  if (req.isAuthenticated && req.isAuthenticated()) {
    return true;
  }
  
  return false;
}

/**
 * Helper to get user from either auth method
 */
export function getAuthUser(req: Request): any | null {
  // Check JWT auth first
  if (req.auth) {
    return {
      id: req.auth.userId,
      email: req.auth.email,
      role: req.auth.role,
      globalRole: req.auth.globalRole,
    };
  }
  
  // Fall back to Passport session auth
  if ((req as any).user) {
    return (req as any).user;
  }
  
  return null;
}
