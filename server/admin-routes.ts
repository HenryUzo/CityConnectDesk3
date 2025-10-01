import { Router, Response, NextFunction } from 'express';
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
import { AdminUser } from './admin-db';
import { storage } from './storage'; // Bridge to PostgreSQL system
import { 
  createEstateSchema, 
  createUserSchema, 
  createMembershipSchema,
  createCategorySchema,
  updateCategorySchema,
  createMarketplaceItemSchema,
  updateMarketplaceItemSchema,
  createProviderSchema,
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

// Apply database gating to all routes except auth and setup
router.use((req: AdminRequest, res: Response, next: NextFunction) => {
  // Exempt auth and setup routes from DB requirement
  if (req.path.startsWith('/auth/') || req.path === '/setup') {
    return next();
  }
  // All other routes require admin DB
  return requireAdminDB(req, res, next);
});

// Setup Route (for initial admin setup - doesn't require auth)
router.post('/setup', async (req, res) => {
  try {
    // Check if MongoDB is connected
    if (!adminDb.isConnected) {
      return res.status(503).json({ 
        error: 'MongoDB not connected', 
        message: 'Please configure MONGODB_URI environment variable first' 
      });
    }

    // Check if setup is already completed
    const existingSuperAdmin = await adminDb.AdminUser.findOne({ globalRole: UserRole.SUPER_ADMIN });
    const existingEstate = await adminDb.Estate.findOne({ slug: 'default-estate' });

    if (existingSuperAdmin && existingEstate) {
      return res.status(400).json({ 
        error: 'Setup already completed',
        message: 'Super admin and default estate already exist. Use login instead.',
        loginCredentials: {
          email: existingSuperAdmin.email,
          note: 'Use your existing password'
        }
      });
    }

    // Create default estate if it doesn't exist
    let defaultEstate = existingEstate;
    if (!defaultEstate) {
      defaultEstate = new adminDb.Estate({
        name: 'Default Estate',
        slug: 'default-estate',
        address: '123 Main Street, City, State 12345',
        phone: '+1-555-0123',
        email: 'admin@defaultestate.com',
        isActive: true,
        coverage: {
          type: 'Polygon',
          coordinates: [[
            [-74.0059, 40.7128], // New York coordinates as example
            [-74.0059, 40.7628],
            [-73.9559, 40.7628],
            [-73.9559, 40.7128],
            [-74.0059, 40.7128]
          ]]
        },
        settings: {
          timezone: 'UTC',
          currency: 'USD',
          allowMarketplace: true,
          allowServiceRequests: true
        }
      });
      await defaultEstate.save();
    }

    // Create super admin user
    const adminEmail = 'admin@example.com';
    const adminPassword = 'admin123';
    const hashedPassword = await AdminAuthService.hashPassword(adminPassword);

    const superAdmin = new adminDb.AdminUser({
      email: adminEmail,
      name: 'Super Administrator',
      phone: '+1-555-0100',
      passwordHash: hashedPassword,
      globalRole: UserRole.SUPER_ADMIN,
      isActive: true
    });
    await superAdmin.save();

    // Create membership for super admin in default estate
    const membership = new adminDb.Membership({
      userId: superAdmin._id.toString(),
      estateId: defaultEstate._id.toString(),
      role: UserRole.ESTATE_ADMIN,
      permissions: ['*'], // All permissions
      isActive: true
    });
    await membership.save();

    // Return success with credentials
    res.json({
      success: true,
      message: 'Admin setup completed successfully!',
      estate: {
        name: defaultEstate.name,
        id: defaultEstate._id.toString()
      },
      adminCredentials: {
        email: adminEmail,
        password: adminPassword,
        note: 'IMPORTANT: Change this password after first login!'
      },
      nextSteps: {
        loginUrl: '/admin-dashboard',
        apiLoginEndpoint: '/api/admin/auth/login'
      }
    });

  } catch (error: any) {
    console.error('Setup error:', error);
    res.status(500).json({ 
      error: 'Setup failed', 
      message: error.message 
    });
  }
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

    const newRefreshToken = AdminAuthService.generateToken({
      sub: user.id,
      type: 'refresh'
    });

    res.json({ 
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      user: user
    });
  } catch (error: any) {
    res.status(401).json({ error: error.message });
  }
});

router.post('/auth/logout', authenticateAdmin, async (req: AdminRequest, res) => {
  // In a real implementation, you might blacklist the token
  res.json({ success: true });
});

// --- Admin "me" endpoint (used by admin dashboard/auth hook)
router.get("/me", authenticateAdmin, setEstateContext, (req: AdminRequest, res: Response) => {
  // authenticateAdmin populates req.adminUser
  // setEstateContext optionally populates req.currentEstate based on header x-estate-id
  res.json({
    id: req.adminUser?.id,
    email: req.adminUser?.email,
    name: req.adminUser?.name,
    globalRole: req.adminUser?.globalRole,
    memberships: req.adminUser?.memberships ?? [],
    // helpful for the UI to know which estate is active (or null if none)
    currentEstate: req.currentEstate ?? null,
  });
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
router.get('/estates', authenticateAdmin, setEstateContext, async (req: AdminRequest, res) => {
  try {
    const isSuperAdmin = req.adminUser?.globalRole === UserRole.SUPER_ADMIN;
    
    if (isSuperAdmin) {
      // Super admins can see all estates
      const estates = await adminDb.getEstates();
      res.json(estates);
    } else if (req.currentEstate) {
      // Estate admins can see their current estate only
      res.json([req.currentEstate]);
    } else {
      res.status(400).json({ error: 'Estate context required' });
    }
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
    const { globalRole, search, limit = 50, offset = 0 } = req.query;
    const filter: any = {};
    
    if (globalRole) filter.globalRole = globalRole;
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

router.get('/users/:id/memberships', authenticateAdmin, setEstateContext, requireModerator, async (req: AdminRequest, res) => {
  try {
    const userId = req.params.id;
    const memberships = await adminDb.getUserMemberships(userId);
    
    // Enforce tenant scoping for non-super admins - only show memberships for current estate
    if (req.adminUser?.globalRole !== UserRole.SUPER_ADMIN) {
      if (!req.currentEstate) {
        return res.status(400).json({ error: 'Estate context required' });
      }
      
      // Filter to current estate only to prevent cross-tenant data leakage
      const scopedMemberships = memberships.filter(m => m.estateId === req.currentEstate!.id);
      return res.json(scopedMemberships);
    }
    
    // Super admins can see all memberships
    res.json(memberships);
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

// Provider Management Routes
router.post('/providers', 
  authenticateAdmin, 
  setEstateContext,
  requireEstateAdmin, 
  auditAction('CREATE', 'PROVIDER'),
  async (req: AdminRequest, res) => {
    let createdUser: any = null;
    
    try {
      // Validate input using Zod schema
      const data = createProviderSchema.parse(req.body);
      
      // Hash password
      const hashedPassword = await AdminAuthService.hashPassword(data.password);
      
      // First create the user account
      createdUser = await adminDb.createUser({
        name: data.name,
        email: data.email,
        phone: data.phone || '',
        passwordHash: hashedPassword,
        globalRole: 'provider'
      });
      
      // Then create the provider profile
      const provider = await adminDb.createProvider({
        userId: createdUser._id.toString(),
        categories: data.categories,
        experience: data.experience || 0,
        description: data.description || '',
        isApproved: data.isApproved !== false, // Default to true unless explicitly false
        rating: 0,
        totalJobs: 0,
        // Add current estate if not super admin
        estates: req.adminUser?.globalRole !== UserRole.SUPER_ADMIN && req.currentEstate 
          ? [req.currentEstate.id] 
          : []
      });
      
      res.status(201).json(provider);
    } catch (error: any) {
      // If provider creation failed but user was created, clean up the user
      if (createdUser) {
        try {
          await AdminUser.findByIdAndDelete(createdUser._id);
          console.log(`Cleaned up orphaned user ${createdUser._id} after provider creation failure`);
        } catch (cleanupError) {
          console.error(`Failed to cleanup user ${createdUser._id} after provider creation error:`, cleanupError);
          console.error('Manual cleanup required for user:', createdUser._id);
        }
      }
      
      if (error.name === 'ZodError') {
        return res.status(400).json({ 
          error: 'Validation error', 
          details: error.errors.map((e: any) => `${e.path.join('.')}: ${e.message}`)
        });
      }
      
      if (error.code === 11000) {
        res.status(400).json({ error: 'Email already exists' });
      } else {
        res.status(400).json({ error: error.message });
      }
    }
  }
);

router.get('/providers', requireAdminDB, authenticateAdmin, setEstateContext, requireModerator, async (req: AdminRequest, res) => {
  try {
    const { approved, category, search, limit = 50, offset = 0 } = req.query;
    const filter: any = {};
    
    if (approved !== undefined) filter.isApproved = approved === 'true';
    if (category) filter.categories = category;
    if (search) {
      // We'll need to join with users to search by name/email
      // For now, just use basic provider search
      filter.$or = [{ categories: { $regex: search, $options: 'i' } }];
    }

    // Enforce tenant scoping for non-super admins
    if (req.adminUser?.globalRole !== UserRole.SUPER_ADMIN) {
      if (!req.currentEstate) {
        return res.status(400).json({ error: 'Estate context required' });
      }
      
      // Get providers who serve this estate
      filter.estates = req.currentEstate.id;
    }

    const providers = await adminDb.getProviders(filter);
    res.json(providers.slice(Number(offset), Number(offset) + Number(limit)));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.patch('/providers/:id', 
  authenticateAdmin, 
  setEstateContext,
  requireEstateAdmin, 
  auditAction('UPDATE', 'PROVIDER'),
  async (req: AdminRequest, res) => {
    try {
      const updates = req.body;
      const provider = await adminDb.updateProvider(req.params.id, updates);
      if (!provider) {
        return res.status(404).json({ error: 'Provider not found' });
      }
      res.json(provider);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }
);

router.patch('/providers/:id/approve', 
  authenticateAdmin, 
  setEstateContext,
  requireEstateAdmin, 
  auditAction('APPROVE', 'PROVIDER'),
  async (req: AdminRequest, res) => {
    try {
      const { approved } = req.body;
      const provider = await adminDb.updateProvider(req.params.id, { isApproved: approved });
      if (!provider) {
        return res.status(404).json({ error: 'Provider not found' });
      }
      res.json(provider);
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

// Category Management Routes
router.get('/categories', requireAdminDB, authenticateAdmin, setEstateContext, requireModerator, async (req: AdminRequest, res) => {
  try {
    const { scope } = req.query;
    let categories;
    
    if (req.adminUser?.globalRole === UserRole.SUPER_ADMIN) {
      // Super admins can see all categories
      if (scope === 'global') {
        categories = await adminDb.getCategoriesByScope('global');
      } else if (scope === 'estate' && req.query.estateId) {
        categories = await adminDb.getCategoriesByScope('estate', req.query.estateId as string);
      } else {
        categories = await adminDb.getCategories();
      }
    } else {
      // Estate admins can only see global categories and their estate's categories
      if (!req.currentEstate) {
        return res.status(400).json({ error: 'Estate context required' });
      }
      
      if (scope === 'global') {
        categories = await adminDb.getCategoriesByScope('global');
      } else {
        const globalCategories = await adminDb.getCategoriesByScope('global');
        const estateCategories = await adminDb.getCategoriesByScope('estate', req.currentEstate.id);
        categories = [...globalCategories, ...estateCategories];
      }
    }
    
    res.json(categories);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/categories', requireAdminDB, authenticateAdmin, setEstateContext, auditAction('CREATE', 'CATEGORY'), async (req: AdminRequest, res) => {
  try {
    // Validate request body with Zod
    const validatedData = createCategorySchema.parse(req.body);
    const { scope, name, key, description, icon } = validatedData;
    
    // Permission checks
    if (scope === 'global' && req.adminUser?.globalRole !== UserRole.SUPER_ADMIN) {
      return res.status(403).json({ error: 'Only super admins can create global categories' });
    }
    
    if (scope === 'estate') {
      if (req.adminUser?.globalRole !== UserRole.SUPER_ADMIN && 
          req.adminUser?.globalRole !== UserRole.ESTATE_ADMIN) {
        return res.status(403).json({ error: 'Only super admins and estate admins can create estate categories' });
      }
      
      if (!req.currentEstate) {
        return res.status(400).json({ error: 'Estate context required for estate categories' });
      }
    }
    
    const categoryData = {
      scope,
      estateId: scope === 'estate' ? req.currentEstate?.id : undefined,
      name,
      key,
      description,
      icon,
      isActive: true
    };
    
    const category = await adminDb.createCategory(categoryData);
    
    // Audit logging handled by middleware
    
    res.status(201).json(category);
  } catch (error: any) {
    if (error.code === 11000) {
      res.status(409).json({ error: 'Category key already exists in this scope' });
    } else {
      res.status(500).json({ error: error.message });
    }
  }
});

router.patch('/categories/:id', requireAdminDB, authenticateAdmin, setEstateContext, auditAction('UPDATE', 'CATEGORY'), async (req: AdminRequest, res) => {
  try {
    const categoryId = req.params.id;
    // Validate request body with Zod
    const validatedUpdates = updateCategorySchema.parse(req.body);
    
    // Get existing category to check permissions
    const existingCategory = await adminDb.AdminCategory.findById(categoryId);
    if (!existingCategory) {
      return res.status(404).json({ error: 'Category not found' });
    }
    
    // Permission checks
    if (existingCategory.scope === 'global' && req.adminUser?.globalRole !== UserRole.SUPER_ADMIN) {
      return res.status(403).json({ error: 'Only super admins can modify global categories' });
    }
    
    if (existingCategory.scope === 'estate') {
      if (req.adminUser?.globalRole === UserRole.SUPER_ADMIN) {
        // Super admin can modify any estate category
      } else if (req.adminUser?.globalRole === UserRole.ESTATE_ADMIN) {
        // Estate admin can only modify their estate's categories
        if (!req.currentEstate || existingCategory.estateId !== req.currentEstate.id) {
          return res.status(403).json({ error: 'You can only modify categories for your estate' });
        }
      } else {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }
    }
    
    const category = await adminDb.updateCategory(categoryId, validatedUpdates);
    if (!category) {
      return res.status(404).json({ error: 'Category not found' });
    }
    
    // Audit logging handled by middleware
    
    res.json(category);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/categories/:id', requireAdminDB, authenticateAdmin, setEstateContext, auditAction('DELETE', 'CATEGORY'), async (req: AdminRequest, res) => {
  try {
    const categoryId = req.params.id;
    
    // Get existing category to check permissions
    const existingCategory = await adminDb.AdminCategory.findById(categoryId);
    if (!existingCategory) {
      return res.status(404).json({ error: 'Category not found' });
    }
    
    // Permission checks (same as update)
    if (existingCategory.scope === 'global' && req.adminUser?.globalRole !== UserRole.SUPER_ADMIN) {
      return res.status(403).json({ error: 'Only super admins can delete global categories' });
    }
    
    if (existingCategory.scope === 'estate') {
      if (req.adminUser?.globalRole === UserRole.SUPER_ADMIN) {
        // Super admin can delete any estate category
      } else if (req.adminUser?.globalRole === UserRole.ESTATE_ADMIN) {
        // Estate admin can only delete their estate's categories
        if (!req.currentEstate || existingCategory.estateId !== req.currentEstate.id) {
          return res.status(403).json({ error: 'You can only delete categories for your estate' });
        }
      } else {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }
    }
    
    // Soft delete by setting isActive to false
    const category = await adminDb.updateCategory(categoryId, { isActive: false });
    
    // Audit logging handled by middleware
    
    res.json({ message: 'Category deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Marketplace Management Routes
router.get('/marketplace', requireAdminDB, authenticateAdmin, setEstateContext, requireModerator, async (req: AdminRequest, res) => {
  try {
    const { category, vendor, search, limit = 50, offset = 0 } = req.query;
    const filter: any = {};
    
    if (category) filter.category = category;
    if (vendor) filter.vendorId = vendor;
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }
    
    let items;
    if (req.adminUser?.globalRole === UserRole.SUPER_ADMIN) {
      // Super admins can see all marketplace items
      if (req.query.estateId) {
        items = await adminDb.getMarketplaceItemsByEstate(req.query.estateId as string, filter);
      } else {
        items = await adminDb.getMarketplaceItems(filter);
      }
    } else {
      // Estate admins can only see their estate's marketplace items
      if (!req.currentEstate) {
        return res.status(400).json({ error: 'Estate context required' });
      }
      items = await adminDb.getMarketplaceItemsByEstate(req.currentEstate.id, filter);
    }
    
    // Apply pagination
    const paginatedItems = items.slice(Number(offset), Number(offset) + Number(limit));
    res.json(paginatedItems);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/marketplace', requireAdminDB, authenticateAdmin, setEstateContext, auditAction('CREATE', 'MARKETPLACE_ITEM'), async (req: AdminRequest, res) => {
  try {
    // Validate request body with Zod
    const validatedData = createMarketplaceItemSchema.parse(req.body);
    
    // Permission checks - Only estate admins and super admins can create marketplace items
    if (req.adminUser?.globalRole !== UserRole.SUPER_ADMIN && 
        req.adminUser?.globalRole !== UserRole.ESTATE_ADMIN) {
      return res.status(403).json({ error: 'Only estate admins and super admins can create marketplace items' });
    }
    
    if (!req.currentEstate) {
      return res.status(400).json({ error: 'Estate context required' });
    }
    
    const itemData = {
      ...validatedData,
      estateId: req.currentEstate.id,
      isActive: true
    };
    
    const item = await adminDb.createMarketplaceItem(itemData);
    
    // Audit logging handled by middleware
    
    res.status(201).json(item);
  } catch (error: any) {
    if (error.name === 'ZodError') {
      res.status(400).json({ error: 'Validation error', details: error.errors });
    } else {
      res.status(500).json({ error: error.message });
    }
  }
});

router.patch('/marketplace/:id', requireAdminDB, authenticateAdmin, setEstateContext, auditAction('UPDATE', 'MARKETPLACE_ITEM'), async (req: AdminRequest, res) => {
  try {
    const itemId = req.params.id;
    // Validate request body with Zod
    const validatedUpdates = updateMarketplaceItemSchema.parse(req.body);
    
    // Get existing item to check permissions
    const existingItem = await adminDb.MarketplaceItem.findById(itemId);
    if (!existingItem) {
      return res.status(404).json({ error: 'Marketplace item not found' });
    }
    
    // Permission checks
    if (req.adminUser?.globalRole === UserRole.SUPER_ADMIN) {
      // Super admin can modify any item
    } else if (req.adminUser?.globalRole === UserRole.ESTATE_ADMIN) {
      // Estate admin can only modify their estate's items
      if (!req.currentEstate || existingItem.estateId !== req.currentEstate.id) {
        return res.status(403).json({ error: 'You can only modify items for your estate' });
      }
    } else {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    
    const item = await adminDb.updateMarketplaceItem(itemId, validatedUpdates);
    if (!item) {
      return res.status(404).json({ error: 'Marketplace item not found' });
    }
    
    // Audit logging handled by middleware
    
    res.json(item);
  } catch (error: any) {
    if (error.name === 'ZodError') {
      res.status(400).json({ error: 'Validation error', details: error.errors });
    } else {
      res.status(500).json({ error: error.message });
    }
  }
});

router.delete('/marketplace/:id', requireAdminDB, authenticateAdmin, setEstateContext, auditAction('DELETE', 'MARKETPLACE_ITEM'), async (req: AdminRequest, res) => {
  try {
    const itemId = req.params.id;
    
    // Get existing item to check permissions
    const existingItem = await adminDb.MarketplaceItem.findById(itemId);
    if (!existingItem) {
      return res.status(404).json({ error: 'Marketplace item not found' });
    }
    
    // Permission checks (same as update)
    if (req.adminUser?.globalRole === UserRole.SUPER_ADMIN) {
      // Super admin can delete any item
    } else if (req.adminUser?.globalRole === UserRole.ESTATE_ADMIN) {
      // Estate admin can only delete their estate's items
      if (!req.currentEstate || existingItem.estateId !== req.currentEstate.id) {
        return res.status(403).json({ error: 'You can only delete items for your estate' });
      }
    } else {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    
    // Soft delete by setting isActive to false
    const item = await adminDb.updateMarketplaceItem(itemId, { isActive: false });
    
    // Audit logging handled by middleware
    
    res.json({ message: 'Marketplace item deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

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

// Orders Management Routes
router.get('/orders', requireAdminDB, authenticateAdmin, setEstateContext, async (req: AdminRequest, res) => {
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
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const filter: any = {};
    
    // Estate scoping
    if (req.currentEstate) {
      filter.estateId = req.currentEstate.id;
    } else if (req.adminUser?.globalRole !== UserRole.SUPER_ADMIN) {
      return res.status(400).json({ error: 'Estate context required' });
    }

    // Search functionality
    if (search) {
      filter.$or = [
        { orderId: { $regex: search, $options: 'i' } },
        { 'buyerInfo.name': { $regex: search, $options: 'i' } },
        { 'buyerInfo.email': { $regex: search, $options: 'i' } },
        { 'vendorInfo.name': { $regex: search, $options: 'i' } },
        { 'vendorInfo.email': { $regex: search, $options: 'i' } },
        { 'deliveryAddress.street': { $regex: search, $options: 'i' } },
        { 'deliveryAddress.city': { $regex: search, $options: 'i' } }
      ];
    }

    // Apply filters
    if (status) filter.status = status;
    if (buyerId) filter.buyerId = buyerId;
    if (vendorId) filter.vendorId = vendorId;
    if (hasDispute === 'true') filter['dispute.reason'] = { $exists: true };
    if (disputeStatus) filter['dispute.status'] = disputeStatus;
    
    // Date range filter
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate as string);
      if (endDate) filter.createdAt.$lte = new Date(endDate as string);
    }
    
    // Price range filter
    if (minTotal || maxTotal) {
      filter.total = {};
      if (minTotal) filter.total.$gte = Number(minTotal);
      if (maxTotal) filter.total.$lte = Number(maxTotal);
    }

    // Pagination
    const skip = (Number(page) - 1) * Number(limit);
    const sortDirection = sortOrder === 'desc' ? -1 : 1;

    // Get orders with pagination and populate user details
    const [orders, totalCount] = await Promise.all([
      adminDb.Order.find(filter)
        .sort({ [sortBy as string]: sortDirection })
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      adminDb.Order.countDocuments(filter)
    ]);

    // Get user details for buyers and vendors
    const userIds = Array.from(new Set([...orders.map(o => o.buyerId), ...orders.map(o => o.vendorId)]));
    const users = await adminDb.AdminUser.find({ _id: { $in: userIds } }).select('_id name email').lean();
    const userMap = new Map(users.map(u => [u._id.toString(), u]));

    // Enrich orders with user details
    const enrichedOrders = orders.map(order => ({
      ...order,
      buyer: userMap.get(order.buyerId),
      vendor: userMap.get(order.vendorId)
    }));

    res.json({
      orders: enrichedOrders,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: totalCount,
        totalPages: Math.ceil(totalCount / Number(limit))
      }
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/orders/:id', requireAdminDB, authenticateAdmin, setEstateContext, async (req: AdminRequest, res) => {
  try {
    const orderId = req.params.id;
    
    const order = await adminDb.Order.findById(orderId).lean();
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // Estate scoping
    if (req.currentEstate && order.estateId !== req.currentEstate.id) {
      return res.status(403).json({ error: 'Access denied' });
    } else if (!req.currentEstate && req.adminUser?.globalRole !== UserRole.SUPER_ADMIN) {
      return res.status(400).json({ error: 'Estate context required' });
    }

    // Get buyer and vendor details
    const [buyer, vendor] = await Promise.all([
      adminDb.AdminUser.findById(order.buyerId).select('_id name email phone').lean(),
      adminDb.AdminUser.findById(order.vendorId).select('_id name email phone').lean()
    ]);

    // Get marketplace items details
    const itemIds = order.items.map(item => item.itemId);
    const marketplaceItems = await adminDb.MarketplaceItem.find({ _id: { $in: itemIds } }).lean();
    const itemMap = new Map(marketplaceItems.map(item => [item._id.toString(), item]));

    // Enrich order items with marketplace details
    const enrichedItems = order.items.map(item => ({
      ...item,
      marketplaceItem: itemMap.get(item.itemId)
    }));

    res.json({
      ...order,
      buyer,
      vendor,
      items: enrichedItems
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.patch('/orders/:id/status', requireAdminDB, authenticateAdmin, setEstateContext, auditAction('UPDATE_STATUS', 'ORDER'), async (req: AdminRequest, res) => {
  try {
    const orderId = req.params.id;
    const { status } = z.object({
      status: z.enum(['pending', 'processing', 'delivered', 'cancelled'])
    }).parse(req.body);

    const order = await adminDb.Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // Estate scoping
    if (req.currentEstate && order.estateId !== req.currentEstate.id) {
      return res.status(403).json({ error: 'Access denied' });
    } else if (!req.currentEstate && req.adminUser?.globalRole !== UserRole.SUPER_ADMIN) {
      return res.status(400).json({ error: 'Estate context required' });
    }

    // Business logic for status changes
    const currentStatus = order.status;
    const validTransitions: Record<string, string[]> = {
      'pending': ['processing', 'cancelled'],
      'processing': ['delivered', 'cancelled'],
      'delivered': [], // Final state
      'cancelled': [] // Final state
    };

    if (!validTransitions[currentStatus]?.includes(status)) {
      return res.status(400).json({ 
        error: `Invalid status transition from ${currentStatus} to ${status}` 
      });
    }

    order.status = status;
    await order.save();

    // Audit logging handled by middleware

    res.json({ message: 'Order status updated successfully', order });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      res.status(400).json({ error: 'Validation error', details: error.errors });
    } else {
      res.status(500).json({ error: error.message });
    }
  }
});

router.post('/orders/:id/dispute', requireAdminDB, authenticateAdmin, setEstateContext, auditAction('CREATE_DISPUTE', 'ORDER'), async (req: AdminRequest, res) => {
  try {
    const orderId = req.params.id;
    const { reason, description } = z.object({
      reason: z.string().min(1).max(200),
      description: z.string().min(10).max(1000).optional()
    }).parse(req.body);

    const order = await adminDb.Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // Estate scoping
    if (req.currentEstate && order.estateId !== req.currentEstate.id) {
      return res.status(403).json({ error: 'Access denied' });
    } else if (!req.currentEstate && req.adminUser?.globalRole !== UserRole.SUPER_ADMIN) {
      return res.status(400).json({ error: 'Estate context required' });
    }

    // Check if dispute already exists
    if (order.dispute?.reason) {
      return res.status(400).json({ error: 'Dispute already exists for this order' });
    }

    // Only allow disputes for delivered orders
    if (order.status !== 'delivered') {
      return res.status(400).json({ error: 'Disputes can only be created for delivered orders' });
    }

    order.dispute = {
      reason,
      status: 'open',
      resolvedAt: undefined
    };
    await order.save();

    // Audit logging handled by middleware

    res.status(201).json({ message: 'Dispute created successfully', order });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      res.status(400).json({ error: 'Validation error', details: error.errors });
    } else {
      res.status(500).json({ error: error.message });
    }
  }
});

router.patch('/orders/:id/dispute', requireAdminDB, authenticateAdmin, setEstateContext, auditAction('RESOLVE_DISPUTE', 'ORDER'), async (req: AdminRequest, res) => {
  try {
    const orderId = req.params.id;
    const { status, resolution, refundAmount } = z.object({
      status: z.enum(['resolved', 'rejected', 'escalated']),
      resolution: z.string().min(10).max(1000),
      refundAmount: z.number().min(0).optional()
    }).parse(req.body);

    const order = await adminDb.Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // Estate scoping
    if (req.currentEstate && order.estateId !== req.currentEstate.id) {
      return res.status(403).json({ error: 'Access denied' });
    } else if (!req.currentEstate && req.adminUser?.globalRole !== UserRole.SUPER_ADMIN) {
      return res.status(400).json({ error: 'Estate context required' });
    }

    // Check if dispute exists
    if (!order.dispute?.reason) {
      return res.status(400).json({ error: 'No dispute exists for this order' });
    }

    // Check if dispute is already resolved
    if (order.dispute.status !== 'open') {
      return res.status(400).json({ error: 'Dispute is already resolved' });
    }

    // Validate refund amount
    if (refundAmount && refundAmount > order.total) {
      return res.status(400).json({ error: 'Refund amount cannot exceed order total' });
    }

    order.dispute.status = status;
    order.dispute.resolvedAt = status === 'resolved' ? new Date() : undefined;
    await order.save();

    // Audit logging handled by middleware

    res.json({ message: 'Dispute resolved successfully', order });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      res.status(400).json({ error: 'Validation error', details: error.errors });
    } else {
      res.status(500).json({ error: error.message });
    }
  }
});

// Orders Analytics
router.get('/orders/analytics/stats', requireAdminDB, authenticateAdmin, setEstateContext, async (req: AdminRequest, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    const filter: any = {};
    
    // Estate scoping
    if (req.currentEstate) {
      filter.estateId = req.currentEstate.id;
    } else if (req.adminUser?.globalRole !== UserRole.SUPER_ADMIN) {
      return res.status(400).json({ error: 'Estate context required' });
    }

    // Date range filter
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate as string);
      if (endDate) filter.createdAt.$lte = new Date(endDate as string);
    }

    // Get comprehensive order statistics
    const [
      totalOrders,
      pendingOrders,
      processingOrders,
      deliveredOrders,
      cancelledOrders,
      totalRevenue,
      disputedOrders,
      avgOrderValue
    ] = await Promise.all([
      adminDb.Order.countDocuments(filter),
      adminDb.Order.countDocuments({ ...filter, status: 'pending' }),
      adminDb.Order.countDocuments({ ...filter, status: 'processing' }),
      adminDb.Order.countDocuments({ ...filter, status: 'delivered' }),
      adminDb.Order.countDocuments({ ...filter, status: 'cancelled' }),
      adminDb.Order.aggregate([
        { $match: { ...filter, status: 'delivered' } },
        { $group: { _id: null, total: { $sum: '$total' } } }
      ]),
      adminDb.Order.countDocuments({ ...filter, 'dispute.reason': { $exists: true } }),
      adminDb.Order.aggregate([
        { $match: filter },
        { $group: { _id: null, avgValue: { $avg: '$total' } } }
      ])
    ]);

    res.json({
      totalOrders,
      ordersByStatus: {
        pending: pendingOrders,
        processing: processingOrders,
        delivered: deliveredOrders,
        cancelled: cancelledOrders
      },
      totalRevenue: totalRevenue[0]?.total || 0,
      disputedOrders,
      avgOrderValue: avgOrderValue[0]?.avgValue || 0,
      disputeRate: totalOrders > 0 ? (disputedOrders / totalOrders * 100).toFixed(2) : 0
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// BRIDGE API ENDPOINTS - Connect Admin System with PostgreSQL Resident/Provider Data
// ============================================================================

// Bridge: Get all service requests from PostgreSQL system
router.get('/bridge/service-requests', 
  authenticateAdmin, 
  setEstateContext, 
  requireEstateAdmin, 
  async (req: AdminRequest, res) => {
    try {
      const { status, category, residentId, providerId } = req.query;
      
      // Estate scoping: Get user IDs for current estate
      let allowedUserIds: Set<string> = new Set();
      
      if (req.adminUser?.globalRole === UserRole.SUPER_ADMIN && !req.currentEstate) {
        // Super admin without estate context can see all data
        // Leave allowedUserIds empty to indicate no filtering needed
      } else if (req.currentEstate) {
        // Get all users (residents and providers) for this estate from MongoDB
        const estateMembers = await adminDb.getEstateMemberships(req.currentEstate.id);
        allowedUserIds = new Set(estateMembers.map(m => m.userId));
      } else {
        return res.status(400).json({ error: 'Estate context required for non-super admin users' });
      }
      
      // Get all service requests from PostgreSQL
      let requests = await storage.getAllServiceRequests();
      
      // Apply estate filtering unless super admin viewing global data
      if (req.adminUser?.globalRole === UserRole.SUPER_ADMIN && !req.currentEstate) {
        // Super admin without estate context - no filtering needed
      } else {
        // Estate admin or super admin with estate context - apply filtering
        requests = requests.filter(r => 
          allowedUserIds.has(r.residentId) || 
          (r.providerId && allowedUserIds.has(r.providerId))
        );
      }
      
      // Apply filters if provided
      if (status) {
        requests = requests.filter(r => r.status === status);
      }
      if (category) {
        requests = requests.filter(r => r.category === category);
      }
      if (residentId) {
        requests = requests.filter(r => r.residentId === residentId);
      }
      if (providerId) {
        requests = requests.filter(r => r.providerId === providerId);
      }
      
      // Enrich with user data
      const enrichedRequests = await Promise.all(
        requests.map(async (request) => {
          const resident = await storage.getUser(request.residentId);
          const provider = request.providerId ? await storage.getUser(request.providerId) : null;
          
          return {
            ...request,
            residentName: resident?.name || 'Unknown Resident',
            residentEmail: resident?.email || '',
            residentPhone: resident?.phone || '',
            providerName: provider?.name || null,
            providerEmail: provider?.email || null,
            providerPhone: provider?.phone || null,
          };
        })
      );
      
      res.json(enrichedRequests);
    } catch (error: any) {
      console.error('Bridge service requests error:', error);
      res.status(500).json({ error: error.message });
    }
  }
);

// Bridge: Get all residents and providers from PostgreSQL system
router.get('/bridge/users', 
  authenticateAdmin, 
  setEstateContext, 
  requireEstateAdmin, 
  async (req: AdminRequest, res) => {
    try {
      const { role, search, status } = req.query;
      
      // Estate scoping: Get user IDs for current estate
      let allowedUserIds: Set<string> = new Set();
      
      if (req.adminUser?.globalRole === UserRole.SUPER_ADMIN && !req.currentEstate) {
        // Super admin without estate context can see all data
        // Leave allowedUserIds empty to indicate no filtering needed
      } else if (req.currentEstate) {
        // Get all users (residents and providers) for this estate from MongoDB
        const estateMembers = await adminDb.getEstateMemberships(req.currentEstate.id);
        allowedUserIds = new Set(estateMembers.map(m => m.userId));
      } else {
        return res.status(400).json({ error: 'Estate context required for non-super admin users' });
      }
      
      // Get users by role or all users
      let users = role ? await storage.getUsers(role as string) : await storage.getUsers();
      
      // Apply estate filtering unless super admin viewing global data
      if (req.adminUser?.globalRole === UserRole.SUPER_ADMIN && !req.currentEstate) {
        // Super admin without estate context - no filtering needed
      } else {
        // Estate admin or super admin with estate context - apply filtering
        users = users.filter(user => allowedUserIds.has(user.id));
      }
      
      // Apply filters
      if (search) {
        const searchTerm = (search as string).toLowerCase();
        users = users.filter(user => 
          user.name.toLowerCase().includes(searchTerm) ||
          user.email.toLowerCase().includes(searchTerm) ||
          (user.phone && user.phone.includes(searchTerm))
        );
      }
      
      if (status === 'active') {
        users = users.filter(user => user.isActive);
      } else if (status === 'inactive') {
        users = users.filter(user => !user.isActive);
      }
      
      // For providers, get additional data like pending approvals
      if (role === 'provider') {
        const enrichedUsers = users.map(user => ({
          ...user,
          isPending: !user.isApproved,
          totalJobs: 0, // This could be calculated from service requests
        }));
        res.json(enrichedUsers);
      } else {
        res.json(users);
      }
    } catch (error: any) {
      console.error('Bridge users error:', error);
      res.status(500).json({ error: error.message });
    }
  }
);

// Bridge: Get user statistics from PostgreSQL system
router.get('/bridge/stats', 
  authenticateAdmin, 
  setEstateContext, 
  requireEstateAdmin, 
  async (req: AdminRequest, res) => {
    try {
      // Estate scoping: Get user IDs for current estate
      let allowedUserIds: Set<string> = new Set();
      let estateScoped = false;
      
      if (req.adminUser?.globalRole === UserRole.SUPER_ADMIN && !req.currentEstate) {
        // Super admin without estate context can see all data
        estateScoped = false;
      } else if (req.currentEstate) {
        // Get all users (residents and providers) for this estate from MongoDB
        const estateMembers = await adminDb.getEstateMemberships(req.currentEstate.id);
        allowedUserIds = new Set(estateMembers.map(m => m.userId));
        estateScoped = true;
      } else {
        return res.status(400).json({ error: 'Estate context required for non-super admin users' });
      }
      
      // Get additional detailed statistics
      const [
        allUsers,
        serviceRequests,
      ] = await Promise.all([
        storage.getUsers(),
        storage.getAllServiceRequests(),
      ]);
      
      // Filter data by estate based on admin role and context
      const filteredUsers = (req.adminUser?.globalRole === UserRole.SUPER_ADMIN && !req.currentEstate) ? 
        allUsers : 
        allUsers.filter(user => allowedUserIds.has(user.id));
        
      const filteredServiceRequests = (req.adminUser?.globalRole === UserRole.SUPER_ADMIN && !req.currentEstate) ? 
        serviceRequests : 
        serviceRequests.filter(r => 
          allowedUserIds.has(r.residentId) || 
          (r.providerId && allowedUserIds.has(r.providerId))
        );
      
      // Calculate service request statistics using filtered data
      const serviceStats = {
        total: filteredServiceRequests.length,
        pending: filteredServiceRequests.filter(r => r.status === 'pending').length,
        assigned: filteredServiceRequests.filter(r => r.status === 'assigned').length,
        inProgress: filteredServiceRequests.filter(r => r.status === 'in_progress').length,
        completed: filteredServiceRequests.filter(r => r.status === 'completed').length,
        cancelled: filteredServiceRequests.filter(r => r.status === 'cancelled').length,
      };
      
      // Calculate user activity using filtered data
      const userStats = {
        totalUsers: filteredUsers.length,
        totalResidents: filteredUsers.filter(u => u.role === 'resident').length,
        totalProviders: filteredUsers.filter(u => u.role === 'provider').length,
        totalRequests: filteredServiceRequests.length,
        activeRequests: filteredServiceRequests.filter(r => r.status === 'pending').length,
        pendingApprovals: filteredUsers.filter(u => u.role === 'provider' && !u.isApproved).length,
        activeUsers: filteredUsers.filter(u => u.isActive).length,
        inactiveUsers: filteredUsers.filter(u => !u.isActive).length,
        approvedProviders: filteredUsers.filter(u => u.role === 'provider' && u.isApproved).length,
        pendingProviders: filteredUsers.filter(u => u.role === 'provider' && !u.isApproved).length,
      };
      
      res.json({
        users: userStats,
        serviceRequests: serviceStats,
        lastUpdated: new Date().toISOString(),
        source: 'postgresql_bridge'
      });
    } catch (error: any) {
      console.error('Bridge stats error:', error);
      res.status(500).json({ error: error.message });
    }
  }
);

// Bridge: Approve/reject providers in PostgreSQL system
router.patch('/bridge/providers/:id/approval', 
  authenticateAdmin, 
  setEstateContext, 
  requireEstateAdmin,
  auditAction('UPDATE', 'PROVIDER'),
  async (req: AdminRequest, res) => {
    try {
      const { id } = req.params;
      const { approved, reason } = req.body;
      
      if (typeof approved !== 'boolean') {
        return res.status(400).json({ error: 'approved field must be a boolean' });
      }
      
      // Estate scoping: Check if this provider belongs to the current estate
      if (req.adminUser?.globalRole !== UserRole.SUPER_ADMIN && req.currentEstate) {
        const estateMembers = await adminDb.getEstateMemberships(req.currentEstate.id);
        const allowedUserIds = new Set(estateMembers.map(m => m.userId));
        
        if (!allowedUserIds.has(id)) {
          return res.status(403).json({ error: 'Provider not found in your estate' });
        }
      }
      
      // Update provider approval status in PostgreSQL
      const updatedProvider = await storage.updateUser(id, { 
        isApproved: approved,
        updatedAt: new Date()
      });
      
      if (!updatedProvider) {
        return res.status(404).json({ error: 'Provider not found' });
      }
      
      // Log the action
      console.log(`Provider ${id} ${approved ? 'approved' : 'rejected'} by admin ${req.adminUser?.email}${reason ? ` - Reason: ${reason}` : ''}`);
      
      res.json({
        message: `Provider ${approved ? 'approved' : 'rejected'} successfully`,
        provider: updatedProvider
      });
    } catch (error: any) {
      console.error('Bridge provider approval error:', error);
      res.status(500).json({ error: error.message });
    }
  }
);

// Bridge: Get user wallets and transactions from PostgreSQL system
router.get('/bridge/users/:id/wallet', 
  authenticateAdmin, 
  setEstateContext, 
  requireEstateAdmin, 
  async (req: AdminRequest, res) => {
    try {
      const { id } = req.params;
      
      // Estate scoping: Check if this user belongs to the current estate
      if (req.adminUser?.globalRole !== UserRole.SUPER_ADMIN && req.currentEstate) {
        const estateMembers = await adminDb.getEstateMemberships(req.currentEstate.id);
        const allowedUserIds = new Set(estateMembers.map(m => m.userId));
        
        if (!allowedUserIds.has(id)) {
          return res.status(403).json({ error: 'User not found in your estate' });
        }
      }
      
      // Get user details
      const user = await storage.getUser(id);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      // Get wallet information
      const wallet = await storage.getWalletByUserId(id);
      if (!wallet) {
        return res.json({ 
          user: { id: user.id, name: user.name, email: user.email },
          wallet: null,
          transactions: [],
          message: 'No wallet found for this user'
        });
      }
      
      // Get transactions
      const transactions = await storage.getTransactionsByWallet(wallet.id);
      
      res.json({
        user: { id: user.id, name: user.name, email: user.email, role: user.role },
        wallet,
        transactions
      });
    } catch (error: any) {
      console.error('Bridge wallet error:', error);
      res.status(500).json({ error: error.message });
    }
  }
);

// Health Check
router.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

export default router;