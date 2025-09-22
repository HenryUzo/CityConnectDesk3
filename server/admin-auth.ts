import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { Request, Response, NextFunction } from 'express';
import { adminDb } from './admin-db';
import { UserRole } from '../shared/admin-schema';

// JWT Configuration
const JWT_SECRET = process.env.JWT_SECRET || process.env.SESSION_SECRET;
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET or SESSION_SECRET environment variable is required for admin authentication');
}
// Assert JWT_SECRET is defined for TypeScript
const ADMIN_JWT_SECRET: string = JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1h'; // Shorter for security
const REFRESH_TOKEN_EXPIRES_IN = process.env.REFRESH_TOKEN_EXPIRES_IN || '7d';

// Extended Request interface for admin context
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

// JWT Token Interface
interface JWTPayload {
  sub: string; // user ID
  email?: string;
  name?: string;
  globalRole?: string;
  memberships?: Array<{
    estateId: string;
    role: string;
    permissions?: string[];
  }>;
  type?: 'refresh'; // for refresh tokens
  iat?: number;
  exp?: number;
}

export class AdminAuthService {
  // Hash password
  static async hashPassword(password: string): Promise<string> {
    const saltRounds = 12;
    return await bcrypt.hash(password, saltRounds);
  }

  // Verify password
  static async verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
    return await bcrypt.compare(password, hashedPassword);
  }

  // Generate JWT token
  static generateToken(payload: Omit<JWTPayload, 'iat' | 'exp'>): string {
    return jwt.sign(payload, ADMIN_JWT_SECRET, { expiresIn: JWT_EXPIRES_IN } as jwt.SignOptions);
  }

  // Generate refresh token
  static generateRefreshToken(userId: string): string {
    return jwt.sign({ sub: userId, type: 'refresh' }, ADMIN_JWT_SECRET, { 
      expiresIn: REFRESH_TOKEN_EXPIRES_IN 
    } as jwt.SignOptions);
  }

  // Verify JWT token
  static verifyToken(token: string): JWTPayload | null {
    try {
      return jwt.verify(token, ADMIN_JWT_SECRET) as JWTPayload;
    } catch (error) {
      return null;
    }
  }

  // Get user with memberships for JWT
  static async getUserWithMemberships(userId: string) {
    const user = await adminDb.getUserById(userId);
    if (!user || !user.isActive) return null;

    const memberships = await adminDb.getUserMemberships(userId);
    
    return {
      id: user._id.toString(),
      email: user.email,
      name: user.name,
      globalRole: user.globalRole,
      memberships: memberships.map(m => ({
        estateId: m.estateId,
        role: m.role,
        permissions: m.permissions || []
      }))
    };
  }

  // Authenticate user and generate tokens
  static async authenticateUser(email: string, password: string) {
    const user = await adminDb.getUserByEmail(email);
    if (!user || !user.isActive) {
      throw new Error('Invalid credentials');
    }

    const isValidPassword = await this.verifyPassword(password, user.passwordHash);
    if (!isValidPassword) {
      throw new Error('Invalid credentials');
    }

    const userWithMemberships = await this.getUserWithMemberships(user._id.toString());
    if (!userWithMemberships) {
      throw new Error('User not found');
    }

    // Update last login
    await adminDb.updateUser(user._id.toString(), { lastLoginAt: new Date() });

    const accessToken = this.generateToken({
      sub: userWithMemberships.id,
      email: userWithMemberships.email,
      name: userWithMemberships.name,
      globalRole: userWithMemberships.globalRole,
      memberships: userWithMemberships.memberships
    });

    const refreshToken = this.generateRefreshToken(userWithMemberships.id);

    return {
      user: userWithMemberships,
      accessToken,
      refreshToken
    };
  }

  // Create audit log
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
      userAgent: req?.get('User-Agent') || undefined
    });
  }
}

// Authentication Middleware
export const authenticateAdmin = async (req: AdminRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const token = authHeader.substring(7);
    const payload = AdminAuthService.verifyToken(token);
    
    if (!payload) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    // Verify user still exists and is active
    const user = await AdminAuthService.getUserWithMemberships(payload.sub);
    if (!user) {
      return res.status(401).json({ error: 'User not found or inactive' });
    }

    req.adminUser = user;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Authentication failed' });
  }
};

// Estate Context Middleware
export const setEstateContext = async (req: AdminRequest, res: Response, next: NextFunction) => {
  try {
    // Get estate ID from URL params, query, or header
    const estateId = req.params.estateId || req.query.estateId || req.headers['x-estate-id'];
    
    if (estateId && typeof estateId === 'string') {
      const estate = await adminDb.getEstateById(estateId);
      if (estate) {
        req.currentEstate = {
          id: estate._id.toString(),
          name: estate.name,
          slug: estate.slug
        };
      }
    }
    
    next();
  } catch (error) {
    next();
  }
};

// Role-based Authorization Middleware
export const requireRole = (allowedRoles: string[], allowGlobalAdmin = true) => {
  return (req: AdminRequest, res: Response, next: NextFunction) => {
    const user = req.adminUser;
    const currentEstate = req.currentEstate;

    if (!user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Super admin has global access
    if (allowGlobalAdmin && user.globalRole === UserRole.SUPER_ADMIN) {
      return next();
    }

    // Check estate-specific roles
    if (currentEstate && user.memberships) {
      const membership = user.memberships.find(m => m.estateId === currentEstate.id);
      if (membership && allowedRoles.includes(membership.role)) {
        return next();
      }
    }

    // Check global role if no estate context
    if (!currentEstate && user.globalRole && allowedRoles.includes(user.globalRole)) {
      return next();
    }

    return res.status(403).json({ error: 'Insufficient permissions' });
  };
};

// Specific role middleware functions
export const requireSuperAdmin = requireRole([UserRole.SUPER_ADMIN], false);
export const requireEstateAdmin = requireRole([UserRole.SUPER_ADMIN, UserRole.ESTATE_ADMIN]);
export const requireModerator = requireRole([UserRole.SUPER_ADMIN, UserRole.ESTATE_ADMIN, UserRole.MODERATOR]);

// Permission-based Authorization
export const requirePermission = (permission: string) => {
  return (req: AdminRequest, res: Response, next: NextFunction) => {
    const user = req.adminUser;
    const currentEstate = req.currentEstate;

    if (!user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Super admin has all permissions
    if (user.globalRole === UserRole.SUPER_ADMIN) {
      return next();
    }

    // Check estate-specific permissions
    if (currentEstate && user.memberships) {
      const membership = user.memberships.find(m => m.estateId === currentEstate.id);
      if (membership && membership.permissions?.includes(permission)) {
        return next();
      }
    }

    return res.status(403).json({ error: `Permission '${permission}' required` });
  };
};

// Audit Log Middleware
export const auditAction = (action: string, target: string) => {
  return (req: AdminRequest, res: Response, next: NextFunction) => {
    const originalSend = res.send;
    
    res.send = function(data) {
      // Log successful actions (2xx status codes)
      if (res.statusCode >= 200 && res.statusCode < 300 && req.adminUser) {
        const targetId = req.params.id || req.body?.id || 'unknown';
        AdminAuthService.createAuditLog(
          req.adminUser.id,
          action,
          target,
          targetId,
          req.currentEstate?.id,
          {
            method: req.method,
            path: req.path,
            statusCode: res.statusCode
          },
          req
        ).catch(console.error);
      }
      
      return originalSend.call(this, data);
    };
    
    next();
  };
};

// Rate limiting for authentication attempts
const authAttempts = new Map<string, { count: number; lastAttempt: number }>();
const MAX_AUTH_ATTEMPTS = 5;
const AUTH_WINDOW = 15 * 60 * 1000; // 15 minutes

export const rateLimitAuth = (req: Request, res: Response, next: NextFunction) => {
  const ip = req.ip;
  const now = Date.now();
  const attempts = authAttempts.get(ip);

  if (attempts && attempts.count >= MAX_AUTH_ATTEMPTS && now - attempts.lastAttempt < AUTH_WINDOW) {
    return res.status(429).json({ 
      error: 'Too many authentication attempts. Please try again later.' 
    });
  }

  // Track failed attempts
  const originalSend = res.send;
  res.send = function(data) {
    if (res.statusCode === 401) {
      const currentAttempts = authAttempts.get(ip) || { count: 0, lastAttempt: 0 };
      authAttempts.set(ip, {
        count: currentAttempts.count + 1,
        lastAttempt: now
      });
    } else if (res.statusCode === 200) {
      // Clear attempts on successful auth
      authAttempts.delete(ip);
    }
    
    return originalSend.call(this, data);
  };

  next();
};