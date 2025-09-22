import { Router } from 'express';
import { z } from 'zod';
import { adminDb } from './admin-db';
import { 
  AdminAuthService, 
  authenticateAdmin, 
  setEstateContext, 
  requireSuperAdmin, 
  requireEstateAdmin, 
  requireModerator,
  auditAction,
  rateLimitAuth,
  type AdminRequest
} from './admin-auth';
import { 
  createEstateSchema, 
  createUserSchema, 
  createMembershipSchema,
  UserRole 
} from '../shared/admin-schema';

const router = Router();

// Database health middleware
const requireAdminDB = (req: AdminRequest, res: Response, next: NextFunction) => {
  if (!adminDb.isConnected) {
    return res.status(503).json({ 
      error: 'Admin database unavailable', 
      message: 'Admin features are currently unavailable' 
    });
  }
  next();
};

// Apply database gating to all routes except auth
router.use((req: AdminRequest, res: Response, next: NextFunction) => {
  // Exempt auth routes from DB requirement
  if (req.path.startsWith('/auth/')) {
    return next();
  }
  // All other routes require admin DB
  return requireAdminDB(req, res, next);
});

// Authentication Routes (don't require DB for login)
router.post('/auth/login', rateLimitAuth, async (req, res) => {
  try {
    const { email, password } = z.object({
      email: z.string().email(),
      password: z.string().min(6)
    }).parse(req.body);

    const result = await AdminAuthService.authenticateUser(email, password);
    
    res.json({
      success: true,
      user: result.user,
      accessToken: result.accessToken,
      refreshToken: result.refreshToken
    });
  } catch (error: any) {
    res.status(401).json({ error: error.message });
  }
});

router.post('/auth/refresh', async (req, res) => {
  try {
    const { refreshToken } = z.object({
      refreshToken: z.string()
    }).parse(req.body);

    const payload = AdminAuthService.verifyToken(refreshToken);
    if (!payload || payload.type !== 'refresh') {
      return res.status(401).json({ error: 'Invalid refresh token' });
    }

    const user = await AdminAuthService.getUserWithMemberships(payload.sub);
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    const newAccessToken = AdminAuthService.generateToken({
      sub: user.id,
      email: user.email,
      name: user.name,
      globalRole: user.globalRole,
      memberships: user.memberships
    });

    res.json({ accessToken: newAccessToken });
  } catch (error: any) {
    res.status(401).json({ error: error.message });
  }
});

router.post('/auth/logout', authenticateAdmin, async (req: AdminRequest, res) => {
  // In a real implementation, you might blacklist the token
  res.json({ success: true });
});

// Dashboard Stats Routes
router.get('/dashboard/stats', requireAdminDB, authenticateAdmin, setEstateContext, async (req: AdminRequest, res) => {
  try {
    const isSuperAdmin = req.adminUser?.globalRole === UserRole.SUPER_ADMIN;
    
    if (isSuperAdmin) {
      const stats = await adminDb.getGlobalStats();
      res.json(stats);
    } else if (req.currentEstate) {
      const stats = await adminDb.getEstateStats(req.currentEstate.id);
      res.json(stats);
    } else {
      res.status(400).json({ error: 'Estate context required' });
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Estate Management Routes
router.get('/estates', authenticateAdmin, requireSuperAdmin, async (req, res) => {
  try {
    const estates = await adminDb.getEstates();
    res.json(estates);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/estates', 
  authenticateAdmin, 
  requireSuperAdmin, 
  auditAction('CREATE', 'ESTATE'),
  async (req: AdminRequest, res) => {
    try {
      const data = createEstateSchema.parse(req.body);
      const estate = await adminDb.createEstate(data);
      res.status(201).json(estate);
    } catch (error: any) {
      if (error.code === 11000) {
        res.status(400).json({ error: 'Estate slug already exists' });
      } else {
        res.status(400).json({ error: error.message });
      }
    }
  }
);

router.get('/estates/:id', authenticateAdmin, setEstateContext, requireEstateAdmin, async (req, res) => {
  try {
    const estate = await adminDb.getEstateById(req.params.id);
    if (!estate) {
      return res.status(404).json({ error: 'Estate not found' });
    }
    res.json(estate);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.patch('/estates/:id', 
  authenticateAdmin, 
  setEstateContext,
  requireEstateAdmin, 
  auditAction('UPDATE', 'ESTATE'),
  async (req: AdminRequest, res) => {
    try {
      const updates = req.body;
      const estate = await adminDb.updateEstate(req.params.id, updates);
      if (!estate) {
        return res.status(404).json({ error: 'Estate not found' });
      }
      res.json(estate);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }
);

router.delete('/estates/:id', 
  authenticateAdmin, 
  setEstateContext,
  requireSuperAdmin, 
  auditAction('DELETE', 'ESTATE'),
  async (req: AdminRequest, res) => {
    try {
      const estate = await adminDb.deleteEstate(req.params.id);
      if (!estate) {
        return res.status(404).json({ error: 'Estate not found' });
      }
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);

// User Management Routes
router.get('/users', requireAdminDB, authenticateAdmin, setEstateContext, requireModerator, async (req: AdminRequest, res) => {
  try {
    const { role, search, limit = 50, offset = 0 } = req.query;
    const filter: any = {};
    
    if (role) filter.role = role;
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    // Enforce tenant scoping for non-super admins
    if (req.adminUser?.globalRole !== UserRole.SUPER_ADMIN) {
      if (!req.currentEstate) {
        return res.status(400).json({ error: 'Estate context required' });
      }
      
      // Get users who are members of this estate only
      const memberships = await adminDb.getEstateMemberships(req.currentEstate.id);
      const estateUserIds = memberships.map(m => m.userId);
      filter._id = { $in: estateUserIds };
    }

    const users = await adminDb.getUsers(filter);
    res.json(users.slice(Number(offset), Number(offset) + Number(limit)));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/users', 
  authenticateAdmin, 
  requireEstateAdmin, 
  auditAction('CREATE', 'USER'),
  async (req: AdminRequest, res) => {
    try {
      const data = createUserSchema.parse(req.body);
      const hashedPassword = await AdminAuthService.hashPassword(data.password);
      
      const user = await adminDb.createUser({
        ...data,
        passwordHash: hashedPassword
      });
      
      // Remove password hash from response
      const { passwordHash, ...userResponse } = user.toObject();
      res.status(201).json(userResponse);
    } catch (error: any) {
      if (error.code === 11000) {
        res.status(400).json({ error: 'Email already exists' });
      } else {
        res.status(400).json({ error: error.message });
      }
    }
  }
);

router.get('/users/:id', authenticateAdmin, setEstateContext, requireModerator, async (req: AdminRequest, res) => {
  try {
    const userId = req.params.id;
    
    // Enforce tenant scoping for non-super admins
    if (req.adminUser?.globalRole !== UserRole.SUPER_ADMIN) {
      if (!req.currentEstate) {
        return res.status(400).json({ error: 'Estate context required' });
      }
      
      // Check if user is member of current estate
      const memberships = await adminDb.getUserMemberships(userId);
      const isEstateUser = memberships.some(m => m.estateId === req.currentEstate!.id);
      if (!isEstateUser) {
        return res.status(403).json({ error: 'User not found in current estate' });
      }
    }
    
    const user = await adminDb.getUserById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const { passwordHash, ...userResponse } = user.toObject();
    res.json(userResponse);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.patch('/users/:id', 
  authenticateAdmin, 
  requireEstateAdmin, 
  auditAction('UPDATE', 'USER'),
  async (req: AdminRequest, res) => {
    try {
      const updates = req.body;
      
      // Hash password if provided
      if (updates.password) {
        updates.passwordHash = await AdminAuthService.hashPassword(updates.password);
        delete updates.password;
      }
      
      const user = await adminDb.updateUser(req.params.id, updates);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      const { passwordHash, ...userResponse } = user.toObject();
      res.json(userResponse);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }
);

// Membership Management Routes
router.get('/estates/:estateId/memberships', 
  authenticateAdmin, 
  setEstateContext, 
  requireEstateAdmin, 
  async (req, res) => {
    try {
      const { role } = req.query;
      const memberships = await adminDb.getEstateMemberships(
        req.params.estateId, 
        role as string
      );
      res.json(memberships);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);

router.post('/memberships', 
  authenticateAdmin, 
  requireEstateAdmin, 
  auditAction('CREATE', 'MEMBERSHIP'),
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

router.patch('/memberships/:userId/:estateId', 
  authenticateAdmin, 
  requireEstateAdmin, 
  auditAction('UPDATE', 'MEMBERSHIP'),
  async (req: AdminRequest, res) => {
    try {
      const { userId, estateId } = req.params;
      const updates = req.body;
      
      const membership = await adminDb.updateMembership(userId, estateId, updates);
      res.json(membership);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }
);

// Service Request Management Routes
router.get('/service-requests', 
  authenticateAdmin, 
  setEstateContext, 
  async (req: AdminRequest, res) => {
    try {
      const { status, category, provider, limit = 50, offset = 0 } = req.query;
      const filter: any = {};
      
      if (status) filter.status = status;
      if (category) filter.category = category;
      if (provider) filter.providerId = provider;
      
      let requests;
      if (req.currentEstate) {
        requests = await adminDb.getServiceRequestsByEstate(req.currentEstate.id, filter);
      } else if (req.adminUser?.globalRole === UserRole.SUPER_ADMIN) {
        requests = await adminDb.getServiceRequests(filter);
      } else {
        return res.status(400).json({ error: 'Estate context required' });
      }
      
      res.json(requests.slice(Number(offset), Number(offset) + Number(limit)));
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);

router.patch('/service-requests/:id', 
  authenticateAdmin, 
  requireModerator, 
  auditAction('UPDATE', 'SERVICE_REQUEST'),
  async (req: AdminRequest, res) => {
    try {
      const updates = req.body;
      const request = await adminDb.updateServiceRequest(req.params.id, updates);
      if (!request) {
        return res.status(404).json({ error: 'Service request not found' });
      }
      res.json(request);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }
);

// Audit Logs Routes
router.get('/audit-logs', 
  authenticateAdmin, 
  setEstateContext, 
  requireEstateAdmin, 
  async (req: AdminRequest, res) => {
    try {
      const { limit = 100, action, target } = req.query;
      const filter: any = {};
      
      if (action) filter.action = action;
      if (target) filter.target = target;
      
      let logs;
      if (req.currentEstate) {
        logs = await adminDb.getAuditLogsByEstate(req.currentEstate.id, Number(limit));
      } else if (req.adminUser?.globalRole === UserRole.SUPER_ADMIN) {
        logs = await adminDb.getAuditLogs(filter, Number(limit));
      } else {
        return res.status(400).json({ error: 'Estate context required' });
      }
      
      res.json(logs);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);

// Health Check
router.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

export default router;