/**
 * Dual-Write Utility Layer
 * 
 * During migration transition, this module handles writing to both:
 * - PostgreSQL (primary) - source of truth
 * - MongoDB (shadow) - for validation and rollback safety
 * 
 * Phase: Dual-Write Period (1-2 weeks)
 * Next: Read cutover with shadow reads
 */

import { db } from './db';
import { adminDb } from './admin-db';
import { 
  estates, 
  users, 
  categories, 
  marketplaceItems, 
  orders, 
  memberships,
  mongoIdMappings,
  type InsertEstate,
  type InsertCategory,
  type InsertMarketplaceItem,
  type InsertOrder,
  type InsertMembership,
} from '../shared/schema';
import { eq, and } from 'drizzle-orm';
import type { ObjectId } from 'mongoose';

interface DualWriteResult<T> {
  pgData: T;
  mongoData?: any;
  shadowWriteSuccess: boolean;
  shadowWriteError?: string;
}

/**
 * Logger for dual-write operations
 */
class DualWriteLogger {
  private failures: Array<{
    timestamp: Date;
    entity: string;
    operation: string;
    pgId: number | string;
    error: string;
  }> = [];

  logFailure(entity: string, operation: string, pgId: number | string, error: string) {
    const failure = {
      timestamp: new Date(),
      entity,
      operation,
      pgId,
      error,
    };
    this.failures.push(failure);
    
    // Log to console for monitoring
    console.error('[DUAL-WRITE FAILURE]', {
      entity,
      operation,
      pgId,
      error,
      timestamp: failure.timestamp.toISOString(),
    });

    // Keep only last 1000 failures in memory
    if (this.failures.length > 1000) {
      this.failures = this.failures.slice(-1000);
    }
  }

  logSuccess(entity: string, operation: string, pgId: number | string) {
    console.log('[DUAL-WRITE SUCCESS]', {
      entity,
      operation,
      pgId,
      timestamp: new Date().toISOString(),
    });
  }

  getFailures() {
    return this.failures;
  }

  getFailureCount() {
    return this.failures.length;
  }
}

export const dualWriteLogger = new DualWriteLogger();

/**
 * Get or create MongoDB ID mapping
 */
async function getOrCreateMapping(
  pgId: number | string,
  entityType: string,
  mongoId?: string
): Promise<string> {
  if (mongoId) {
    return mongoId;
  }

  // Check if mapping already exists
  const existing = await db
    .select()
    .from(mongoIdMappings)
    .where(
      and(
        eq(mongoIdMappings.postgresId, String(pgId)),
        eq(mongoIdMappings.entityType, entityType)
      )
    )
    .limit(1);

  if (existing.length > 0) {
    return existing[0].mongoId;
  }

  // Mapping doesn't exist - this is expected for new entities
  // We'll create it after MongoDB write
  return '';
}

/**
 * Save ID mapping after successful MongoDB write
 */
async function saveMapping(
  pgId: number | string,
  mongoId: string,
  entityType: string
) {
  try {
    await db
      .insert(mongoIdMappings)
      .values({
        postgresId: String(pgId),
        mongoId,
        entityType,
      })
      .onConflictDoNothing();
  } catch (error) {
    console.error('[MAPPING ERROR]', { pgId, mongoId, entityType, error });
  }
}

/**
 * ESTATES
 */
export async function dualWriteCreateEstate(
  data: InsertEstate
): Promise<DualWriteResult<typeof estates.$inferSelect>> {
  // 1. Primary write to PostgreSQL
  const [pgEstate] = await db.insert(estates).values(data).returning();

  // 2. Shadow write to MongoDB
  let shadowSuccess = false;
  let shadowError: string | undefined;
  let mongoEstate: any;

  try {
    if (adminDb.isConnected) {
      // Use same fields for both PostgreSQL and MongoDB - schemas are compatible
      mongoEstate = await adminDb.createEstate({
        name: data.name,
        slug: data.slug,
        description: data.description,
        address: data.address,
        isActive: data.isActive ?? true,
        coverage: data.coverage as any,
        settings: data.settings as any,
      });

      // Save ID mapping
      await saveMapping(pgEstate.id, mongoEstate._id.toString(), 'estate');
      shadowSuccess = true;
      dualWriteLogger.logSuccess('estate', 'create', pgEstate.id);
    } else {
      shadowError = 'MongoDB not connected';
      dualWriteLogger.logFailure('estate', 'create', pgEstate.id, shadowError!);
    }
  } catch (error: any) {
    const errorMessage = error?.message || 'Unknown error';
    shadowError = errorMessage;
    dualWriteLogger.logFailure('estate', 'create', pgEstate.id, errorMessage);
  }

  return {
    pgData: pgEstate,
    mongoData: mongoEstate,
    shadowWriteSuccess: shadowSuccess,
    shadowWriteError: shadowError,
  };
}

export async function dualWriteUpdateEstate(
  id: string,
  updates: Partial<InsertEstate>
): Promise<DualWriteResult<typeof estates.$inferSelect | null>> {
  // Sanitize updates to only include valid PostgreSQL estate fields
  const validFields = ['name', 'slug', 'description', 'address', 'coverage', 'settings', 'isActive'];
  const sanitizedUpdates: any = {};
  for (const key of validFields) {
    if (key in updates) {
      sanitizedUpdates[key] = (updates as any)[key];
    }
  }

  // 1. Primary write to PostgreSQL
  const [pgEstate] = await db
    .update(estates)
    .set(sanitizedUpdates)
    .where(eq(estates.id, id))
    .returning();

  if (!pgEstate) {
    return {
      pgData: null,
      shadowWriteSuccess: false,
      shadowWriteError: 'Estate not found in PostgreSQL',
    };
  }

  // 2. Shadow write to MongoDB
  let shadowSuccess = false;
  let shadowError: string | undefined;
  let mongoEstate: any;

  try {
    if (adminDb.isConnected) {
      const mongoId = await getOrCreateMapping(id, 'estate');
      
      if (!mongoId) {
        shadowError = 'No MongoDB mapping found';
        dualWriteLogger.logFailure('estate', 'update', id, shadowError!);
      } else {
        mongoEstate = await adminDb.updateEstate(mongoId, updates);
        shadowSuccess = true;
        dualWriteLogger.logSuccess('estate', 'update', id);
      }
    } else {
      shadowError = 'MongoDB not connected';
      dualWriteLogger.logFailure('estate', 'update', id, shadowError!);
    }
  } catch (error: any) {
    shadowError = error?.message || 'Unknown error';
    dualWriteLogger.logFailure('estate', 'update', id, shadowError!);
  }

  return {
    pgData: pgEstate,
    mongoData: mongoEstate,
    shadowWriteSuccess: shadowSuccess,
    shadowWriteError: shadowError,
  };
}

export async function dualWriteDeleteEstate(
  id: string
): Promise<DualWriteResult<boolean>> {
  // 1. Primary write to PostgreSQL (soft delete)
  const [pgEstate] = await db
    .update(estates)
    .set({ isActive: false })
    .where(eq(estates.id, id))
    .returning();

  if (!pgEstate) {
    return {
      pgData: false,
      shadowWriteSuccess: false,
      shadowWriteError: 'Estate not found in PostgreSQL',
    };
  }

  // 2. Shadow write to MongoDB
  let shadowSuccess = false;
  let shadowError: string | undefined;

  try {
    if (adminDb.isConnected) {
      const mongoId = await getOrCreateMapping(id, 'estate');
      
      if (!mongoId) {
        shadowError = 'No MongoDB mapping found';
        dualWriteLogger.logFailure('estate', 'delete', id, shadowError!);
      } else {
        await adminDb.deleteEstate(mongoId);
        shadowSuccess = true;
        dualWriteLogger.logSuccess('estate', 'delete', id);
      }
    } else {
      shadowError = 'MongoDB not connected';
      dualWriteLogger.logFailure('estate', 'delete', id, shadowError!);
    }
  } catch (error: any) {
    shadowError = error?.message || 'Unknown error';
    dualWriteLogger.logFailure('estate', 'delete', id, shadowError!);
  }

  return {
    pgData: true,
    shadowWriteSuccess: shadowSuccess,
    shadowWriteError: shadowError,
  };
}

/**
 * CATEGORIES
 */
export async function dualWriteCreateCategory(
  data: InsertCategory
): Promise<DualWriteResult<typeof categories.$inferSelect>> {
  // 1. Primary write to PostgreSQL
  const [pgCategory] = await db.insert(categories).values(data).returning();

  // 2. Shadow write to MongoDB
  let shadowSuccess = false;
  let shadowError: string | undefined;
  let mongoCategory: any;

  try {
    if (adminDb.isConnected) {
      // Get estate MongoDB ID if estateId exists
      let estateMongoId: string | undefined;
      if (data.estateId) {
        estateMongoId = await getOrCreateMapping(data.estateId, 'estate');
      }

      mongoCategory = await adminDb.createCategory({
        name: data.name,
        description: data.description,
        scope: data.scope,
        estateId: estateMongoId,
        isActive: data.isActive ?? true,
      });

      await saveMapping(pgCategory.id, mongoCategory._id.toString(), 'category');
      shadowSuccess = true;
      dualWriteLogger.logSuccess('category', 'create', pgCategory.id);
    } else {
      shadowError = 'MongoDB not connected';
      dualWriteLogger.logFailure('category', 'create', pgCategory.id, shadowError!);
    }
  } catch (error: any) {
    shadowError = error?.message || 'Unknown error';
    dualWriteLogger.logFailure('category', 'create', pgCategory.id, shadowError!);
  }

  return {
    pgData: pgCategory,
    mongoData: mongoCategory,
    shadowWriteSuccess: shadowSuccess,
    shadowWriteError: shadowError,
  };
}

export async function dualWriteUpdateCategory(
  id: string,
  updates: Partial<InsertCategory>
): Promise<DualWriteResult<typeof categories.$inferSelect | null>> {
  // 1. Primary write to PostgreSQL
  const [pgCategory] = await db
    .update(categories)
    .set(updates)
    .where(eq(categories.id, id))
    .returning();

  if (!pgCategory) {
    return {
      pgData: null,
      shadowWriteSuccess: false,
      shadowWriteError: 'Category not found in PostgreSQL',
    };
  }

  // 2. Shadow write to MongoDB
  let shadowSuccess = false;
  let shadowError: string | undefined;
  let mongoCategory: any;

  try {
    if (adminDb.isConnected) {
      const mongoId = await getOrCreateMapping(id, 'category');
      
      if (!mongoId) {
        shadowError = 'No MongoDB mapping found';
        dualWriteLogger.logFailure('category', 'update', id, shadowError!);
      } else {
        // Convert estateId if present in updates
        const mongoUpdates = { ...updates };
        if (updates.estateId !== undefined && updates.estateId !== null) {
          const estateMongoId = await getOrCreateMapping(updates.estateId, 'estate');
          if (estateMongoId) {
            (mongoUpdates as any).estateId = estateMongoId;
          }
        }

        mongoCategory = await adminDb.updateCategory(mongoId, mongoUpdates);
        shadowSuccess = true;
        dualWriteLogger.logSuccess('category', 'update', id);
      }
    } else {
      shadowError = 'MongoDB not connected';
      dualWriteLogger.logFailure('category', 'update', id, shadowError!);
    }
  } catch (error: any) {
    shadowError = error?.message || 'Unknown error';
    dualWriteLogger.logFailure('category', 'update', id, shadowError!);
  }

  return {
    pgData: pgCategory,
    mongoData: mongoCategory,
    shadowWriteSuccess: shadowSuccess,
    shadowWriteError: shadowError,
  };
}

/**
 * MARKETPLACE ITEMS
 */
export async function dualWriteCreateMarketplaceItem(
  data: InsertMarketplaceItem
): Promise<DualWriteResult<typeof marketplaceItems.$inferSelect>> {
  // 1. Primary write to PostgreSQL
  const [pgItem] = await db.insert(marketplaceItems).values(data).returning();

  // 2. Shadow write to MongoDB
  let shadowSuccess = false;
  let shadowError: string | undefined;
  let mongoItem: any;

  try {
    if (adminDb.isConnected) {
      // Get MongoDB IDs for references
      const vendorMongoId = await getOrCreateMapping(data.vendorId, 'user');
      const estateMongoId = await getOrCreateMapping(data.estateId, 'estate');

      // Skip shadow write if no mapping exists for required foreign keys
      if (!vendorMongoId || !estateMongoId) {
        shadowError = 'Missing required MongoDB mapping for vendor or estate';
        dualWriteLogger.logFailure('marketplace_item', 'create', pgItem.id, shadowError!);
      } else {
        mongoItem = await adminDb.createMarketplaceItem({
          name: data.name,
          description: data.description,
          price: data.price,
          vendorId: vendorMongoId,
          estateId: estateMongoId,
          category: data.category, // Use category string, not categoryId
          images: data.images ?? [],
          stock: data.stock ?? 0,
          isActive: data.isActive ?? true,
        });

        await saveMapping(pgItem.id, mongoItem._id.toString(), 'marketplace_item');
        shadowSuccess = true;
        dualWriteLogger.logSuccess('marketplace_item', 'create', pgItem.id);
      }
    } else {
      shadowError = 'MongoDB not connected';
      dualWriteLogger.logFailure('marketplace_item', 'create', pgItem.id, shadowError!);
    }
  } catch (error: any) {
    shadowError = error?.message || 'Unknown error';
    dualWriteLogger.logFailure('marketplace_item', 'create', pgItem.id, shadowError!);
  }

  return {
    pgData: pgItem,
    mongoData: mongoItem,
    shadowWriteSuccess: shadowSuccess,
    shadowWriteError: shadowError,
  };
}

export async function dualWriteUpdateMarketplaceItem(
  id: string,
  updates: Partial<InsertMarketplaceItem>
): Promise<DualWriteResult<typeof marketplaceItems.$inferSelect | null>> {
  // 1. Primary write to PostgreSQL
  const [pgItem] = await db
    .update(marketplaceItems)
    .set(updates)
    .where(eq(marketplaceItems.id, id))
    .returning();

  if (!pgItem) {
    return {
      pgData: null,
      shadowWriteSuccess: false,
      shadowWriteError: 'Marketplace item not found in PostgreSQL',
    };
  }

  // 2. Shadow write to MongoDB
  let shadowSuccess = false;
  let shadowError: string | undefined;
  let mongoItem: any;

  try {
    if (adminDb.isConnected) {
      const mongoId = await getOrCreateMapping(id, 'marketplace_item');
      
      if (mongoId) {
        // Convert foreign keys to MongoDB IDs
        const mongoUpdates: any = { ...updates };
        if (updates.vendorId !== undefined) {
          const vendorMongoId = await getOrCreateMapping(updates.vendorId, 'user');
          if (!vendorMongoId) {
            shadowError = 'Missing MongoDB mapping for vendorId';
            dualWriteLogger.logFailure('marketplace_item', 'update', id, shadowError!);
            return {
              pgData: pgItem,
              shadowWriteSuccess: false,
              shadowWriteError: shadowError,
            };
          }
          mongoUpdates.vendorId = vendorMongoId;
        }
        if (updates.estateId !== undefined) {
          const estateMongoId = await getOrCreateMapping(updates.estateId, 'estate');
          if (!estateMongoId) {
            shadowError = 'Missing MongoDB mapping for estateId';
            dualWriteLogger.logFailure('marketplace_item', 'update', id, shadowError!);
            return {
              pgData: pgItem,
              shadowWriteSuccess: false,
              shadowWriteError: shadowError,
            };
          }
          mongoUpdates.estateId = estateMongoId;
        }
        // Note: PostgreSQL uses 'category' (string), not 'categoryId'
        // MongoDB schema may be different, using the field as-is

        mongoItem = await adminDb.updateMarketplaceItem(mongoId, mongoUpdates);
        shadowSuccess = true;
        dualWriteLogger.logSuccess('marketplace_item', 'update', id);
      } else {
        shadowError = 'No MongoDB mapping found';
        dualWriteLogger.logFailure('marketplace_item', 'update', id, shadowError!);
      }
    } else {
      shadowError = 'MongoDB not connected';
      dualWriteLogger.logFailure('marketplace_item', 'update', id, shadowError!);
    }
  } catch (error: any) {
    shadowError = error?.message || 'Unknown error';
    dualWriteLogger.logFailure('marketplace_item', 'update', id, shadowError!);
  }

  return {
    pgData: pgItem,
    mongoData: mongoItem,
    shadowWriteSuccess: shadowSuccess,
    shadowWriteError: shadowError,
  };
}

/**
 * MEMBERSHIPS
 */
export async function dualWriteCreateMembership(
  data: InsertMembership
): Promise<DualWriteResult<typeof memberships.$inferSelect>> {
  // 1. Primary write to PostgreSQL
  const [pgMembership] = await db.insert(memberships).values(data).returning();

  // 2. Shadow write to MongoDB
  let shadowSuccess = false;
  let shadowError: string | undefined;
  let mongoMembership: any;

  try {
    if (adminDb.isConnected) {
      const userMongoId = await getOrCreateMapping(data.userId, 'user');
      const estateMongoId = await getOrCreateMapping(data.estateId, 'estate');

      // Skip shadow write if no mapping exists for required foreign keys
      if (!userMongoId || !estateMongoId) {
        shadowError = 'Missing required MongoDB mapping for user or estate';
        dualWriteLogger.logFailure('membership', 'create', pgMembership.id, shadowError!);
      } else {
        mongoMembership = await adminDb.createMembership({
          userId: userMongoId,
          estateId: estateMongoId,
          role: data.role,
          isActive: data.isActive ?? true,
        });

        await saveMapping(pgMembership.id, mongoMembership._id.toString(), 'membership');
        shadowSuccess = true;
        dualWriteLogger.logSuccess('membership', 'create', pgMembership.id);
      }
    } else {
      shadowError = 'MongoDB not connected';
      dualWriteLogger.logFailure('membership', 'create', pgMembership.id, shadowError!);
    }
  } catch (error: any) {
    shadowError = error?.message || 'Unknown error';
    dualWriteLogger.logFailure('membership', 'create', pgMembership.id, shadowError!);
  }

  return {
    pgData: pgMembership,
    mongoData: mongoMembership,
    shadowWriteSuccess: shadowSuccess,
    shadowWriteError: shadowError,
  };
}

export async function dualWriteUpdateMembership(
  userId: string,
  estateId: string,
  updates: Partial<InsertMembership>
): Promise<DualWriteResult<typeof memberships.$inferSelect | null>> {
  // 1. Primary write to PostgreSQL
  const [pgMembership] = await db
    .update(memberships)
    .set(updates)
    .where(
      and(
        eq(memberships.userId, userId),
        eq(memberships.estateId, estateId)
      )
    )
    .returning();

  if (!pgMembership) {
    return {
      pgData: null,
      shadowWriteSuccess: false,
      shadowWriteError: 'Membership not found in PostgreSQL',
    };
  }

  // 2. Shadow write to MongoDB
  let shadowSuccess = false;
  let shadowError: string | undefined;
  let mongoMembership: any;

  try {
    if (adminDb.isConnected) {
      const userMongoId = await getOrCreateMapping(userId, 'user');
      const estateMongoId = await getOrCreateMapping(estateId, 'estate');

      // Skip shadow write if no mapping exists
      if (!userMongoId || !estateMongoId) {
        shadowError = 'Missing MongoDB mapping for user or estate';
        dualWriteLogger.logFailure('membership', 'update', `${userId}-${estateId}`, shadowError!);
      } else {
        mongoMembership = await adminDb.updateMembership(userMongoId, estateMongoId, updates);
        shadowSuccess = true;
        dualWriteLogger.logSuccess('membership', 'update', `${userId}-${estateId}`);
      }
    } else {
      shadowError = 'MongoDB not connected';
      dualWriteLogger.logFailure('membership', 'update', `${userId}-${estateId}`, shadowError!);
    }
  } catch (error: any) {
    shadowError = error?.message || 'Unknown error';
    dualWriteLogger.logFailure('membership', 'update', `${userId}-${estateId}`, shadowError!);
  }

  return {
    pgData: pgMembership,
    mongoData: mongoMembership,
    shadowWriteSuccess: shadowSuccess,
    shadowWriteError: shadowError,
  };
}

/**
 * Get dual-write statistics
 */
export function getDualWriteStats() {
  return {
    totalFailures: dualWriteLogger.getFailureCount(),
    recentFailures: dualWriteLogger.getFailures().slice(-50),
  };
}
