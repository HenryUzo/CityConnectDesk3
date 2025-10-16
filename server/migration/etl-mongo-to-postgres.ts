import mongoose from 'mongoose';
import { db } from '../db';
import { eq } from 'drizzle-orm';
import { 
  estates, 
  users, 
  memberships, 
  categories, 
  marketplaceItems, 
  orders, 
  auditLogs, 
  mongoIdMappings,
  serviceRequests
} from '../../shared/schema';
import {
  EstateSchema,
  UserSchema,
  MembershipSchema,
  CategorySchema,
  MarketplaceItemSchema,
  OrderSchema,
  AuditLogSchema,
  ProviderSchema,
  ServiceRequestSchema,
  type IEstate,
  type IUser,
  type IMembership,
  type ICategory,
  type IMarketplaceItem,
  type IOrder,
  type IAuditLog,
  type IProvider,
  type IServiceRequest
} from '../../shared/admin-schema';

// MongoDB Models
const Estate = mongoose.model('Estate', EstateSchema);
const User = mongoose.model('User', UserSchema);
const Membership = mongoose.model('Membership', MembershipSchema);
const Category = mongoose.model('Category', CategorySchema);
const MarketplaceItem = mongoose.model('MarketplaceItem', MarketplaceItemSchema);
const Order = mongoose.model('Order', OrderSchema);
const AuditLog = mongoose.model('AuditLog', AuditLogSchema);
const Provider = mongoose.model('Provider', ProviderSchema);
const ServiceRequest = mongoose.model('ServiceRequest', ServiceRequestSchema);

// ID Mapping Cache
const idMappingCache = new Map<string, string>();

/**
 * Store MongoDB-to-PostgreSQL ID mapping
 */
async function storeIdMapping(mongoId: string, postgresId: string, entityType: string) {
  await db.insert(mongoIdMappings).values({
    mongoId,
    postgresId,
    entityType,
  }).onConflictDoNothing();
  
  idMappingCache.set(mongoId, postgresId);
}

/**
 * Get PostgreSQL ID from MongoDB ID
 */
async function getPostgresId(mongoId: string): Promise<string | null> {
  if (idMappingCache.has(mongoId)) {
    return idMappingCache.get(mongoId)!;
  }
  
  const mapping = await db.query.mongoIdMappings.findFirst({
    where: (mappings, { eq }) => eq(mappings.mongoId, mongoId),
  });
  
  if (mapping) {
    idMappingCache.set(mongoId, mapping.postgresId);
    return mapping.postgresId;
  }
  
  return null;
}

/**
 * Migrate Estates from MongoDB to PostgreSQL
 */
export async function migrateEstates() {
  console.log('🏘️  Migrating estates...');
  const mongoEstates = await Estate.find({});
  let migrated = 0;
  let skipped = 0;

  for (const estate of mongoEstates) {
    try {
      // Check if already migrated
      const existingMapping = await getPostgresId(estate._id.toString());
      if (existingMapping) {
        skipped++;
        continue;
      }

      const [inserted] = await db.insert(estates).values({
        name: estate.name,
        slug: estate.slug,
        description: estate.description,
        address: estate.address,
        coverage: estate.coverage as any, // GeoJSON
        settings: estate.settings as any,
        isActive: estate.isActive,
        createdAt: estate.createdAt,
        updatedAt: estate.updatedAt,
      }).returning();

      await storeIdMapping(estate._id.toString(), inserted.id, 'estate');
      migrated++;
    } catch (error) {
      console.error(`❌ Failed to migrate estate ${estate._id}:`, error);
    }
  }

  console.log(`✅ Estates migrated: ${migrated}, skipped: ${skipped}`);
}

/**
 * Migrate Admin Users from MongoDB to PostgreSQL
 */
export async function migrateAdminUsers() {
  console.log('👥 Migrating admin users...');
  const mongoUsers = await User.find({});
  let migrated = 0;
  let skipped = 0;

  for (const user of mongoUsers) {
    try {
      // Check if already migrated
      const existingMapping = await getPostgresId(user._id.toString());
      if (existingMapping) {
        skipped++;
        continue;
      }

      // Check if email already exists in PostgreSQL
      const existingUser = await db.query.users.findFirst({
        where: (users, { eq }) => eq(users.email, user.email),
      });

      if (existingUser) {
        // If user exists, just store the mapping
        await storeIdMapping(user._id.toString(), existingUser.id, 'user');
        skipped++;
        continue;
      }

      const [inserted] = await db.insert(users).values({
        name: user.name,
        email: user.email,
        phone: user.phone,
        password: user.passwordHash,
        globalRole: user.globalRole as any,
        isActive: user.isActive,
        lastLoginAt: user.lastLoginAt,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      }).returning();

      await storeIdMapping(user._id.toString(), inserted.id, 'user');
      migrated++;
    } catch (error) {
      console.error(`❌ Failed to migrate user ${user._id}:`, error);
    }
  }

  console.log(`✅ Admin users migrated: ${migrated}, skipped: ${skipped}`);
}

/**
 * Migrate Providers from MongoDB to PostgreSQL (merge with existing users)
 */
export async function migrateProviders() {
  console.log('🔧 Migrating providers...');
  const mongoProviders = await Provider.find({});
  let migrated = 0;
  let skipped = 0;

  for (const provider of mongoProviders) {
    try {
      // Check if already migrated
      const existingMapping = await getPostgresId(provider._id.toString());
      if (existingMapping) {
        skipped++;
        continue;
      }

      // Get the user ID from the mapping
      const userId = await getPostgresId(provider.userId);
      if (!userId) {
        console.warn(`⚠️  User ${provider.userId} not found for provider ${provider._id}`);
        continue;
      }

      // Update the user record with provider-specific fields
      await db.update(users)
        .set({
          role: 'provider',
          company: provider.company,
          categories: provider.categories,
          experience: provider.experience,
          rating: provider.rating?.toString(),
          isApproved: provider.isApproved,
          documents: provider.documents,
          latitude: provider.location?.coordinates?.[1],
          longitude: provider.location?.coordinates?.[0],
          metadata: {
            totalJobs: provider.totalJobs,
            estates: provider.estates,
          },
        })
        .where(eq(users.id, userId));

      await storeIdMapping(provider._id.toString(), userId, 'provider');
      migrated++;
    } catch (error) {
      console.error(`❌ Failed to migrate provider ${provider._id}:`, error);
    }
  }

  console.log(`✅ Providers migrated: ${migrated}, skipped: ${skipped}`);
}

/**
 * Migrate Memberships from MongoDB to PostgreSQL
 */
export async function migrateMemberships() {
  console.log('🏘️  Migrating memberships...');
  const mongoMemberships = await Membership.find({});
  let migrated = 0;
  let skipped = 0;

  for (const membership of mongoMemberships) {
    try {
      // Check if already migrated
      const existingMapping = await getPostgresId(membership._id.toString());
      if (existingMapping) {
        skipped++;
        continue;
      }

      const userId = await getPostgresId(membership.userId);
      const estateId = await getPostgresId(membership.estateId);

      if (!userId || !estateId) {
        console.warn(`⚠️  Missing user ${membership.userId} or estate ${membership.estateId} for membership ${membership._id}`);
        continue;
      }

      const [inserted] = await db.insert(memberships).values({
        userId,
        estateId,
        role: membership.role as any,
        isActive: membership.isActive,
        permissions: membership.permissions,
        createdAt: membership.createdAt,
        updatedAt: membership.updatedAt,
      }).returning();

      await storeIdMapping(membership._id.toString(), inserted.id, 'membership');
      migrated++;
    } catch (error) {
      console.error(`❌ Failed to migrate membership ${membership._id}:`, error);
    }
  }

  console.log(`✅ Memberships migrated: ${migrated}, skipped: ${skipped}`);
}

/**
 * Migrate Service Requests from MongoDB to PostgreSQL
 */
export async function migrateServiceRequests() {
  console.log('📋 Migrating service requests...');
  const mongoRequests = await ServiceRequest.find({});
  let migrated = 0;
  let skipped = 0;

  for (const request of mongoRequests) {
    try {
      // Check if already migrated
      const existingMapping = await getPostgresId(request._id.toString());
      if (existingMapping) {
        skipped++;
        continue;
      }

      const estateId = request.estateId ? await getPostgresId(request.estateId) : null;
      const residentId = await getPostgresId(request.residentId);
      const providerId = request.providerId ? await getPostgresId(request.providerId) : null;

      if (!residentId) {
        console.warn(`⚠️  Resident ${request.residentId} not found for request ${request._id}`);
        continue;
      }

      const [inserted] = await db.insert(serviceRequests).values({
        estateId: estateId || undefined,
        category: request.category as any,
        description: request.description,
        residentId,
        providerId: providerId || undefined,
        status: request.status as any,
        budget: `${request.budget.min}-${request.budget.max} ${request.budget.currency}`,
        urgency: request.urgency as any,
        location: request.location.address,
        latitude: request.location.coordinates?.coordinates?.[1],
        longitude: request.location.coordinates?.coordinates?.[0],
        preferredTime: request.preferredTime,
        specialInstructions: request.specialInstructions,
        assignedAt: request.assignedAt,
        createdAt: request.createdAt,
        updatedAt: request.updatedAt,
      }).returning();

      await storeIdMapping(request._id.toString(), inserted.id, 'service_request');
      migrated++;
    } catch (error) {
      console.error(`❌ Failed to migrate service request ${request._id}:`, error);
    }
  }

  console.log(`✅ Service requests migrated: ${migrated}, skipped: ${skipped}`);
}

/**
 * Migrate Categories from MongoDB to PostgreSQL
 */
export async function migrateCategories() {
  console.log('📂 Migrating categories...');
  const mongoCategories = await Category.find({});
  let migrated = 0;
  let skipped = 0;

  for (const category of mongoCategories) {
    try {
      // Check if already migrated
      const existingMapping = await getPostgresId(category._id.toString());
      if (existingMapping) {
        skipped++;
        continue;
      }

      const estateId = category.estateId ? await getPostgresId(category.estateId) : null;

      const [inserted] = await db.insert(categories).values({
        scope: category.scope as any,
        estateId: estateId || undefined,
        name: category.name,
        key: category.key,
        description: category.description,
        icon: category.icon,
        isActive: category.isActive,
        createdAt: category.createdAt,
        updatedAt: category.updatedAt,
      }).returning();

      await storeIdMapping(category._id.toString(), inserted.id, 'category');
      migrated++;
    } catch (error) {
      console.error(`❌ Failed to migrate category ${category._id}:`, error);
    }
  }

  console.log(`✅ Categories migrated: ${migrated}, skipped: ${skipped}`);
}

/**
 * Migrate Marketplace Items from MongoDB to PostgreSQL
 */
export async function migrateMarketplaceItems() {
  console.log('🛒 Migrating marketplace items...');
  const mongoItems = await MarketplaceItem.find({});
  let migrated = 0;
  let skipped = 0;

  for (const item of mongoItems) {
    try {
      // Check if already migrated
      const existingMapping = await getPostgresId(item._id.toString());
      if (existingMapping) {
        skipped++;
        continue;
      }

      const estateId = await getPostgresId(item.estateId);
      const vendorId = await getPostgresId(item.vendorId);

      if (!estateId || !vendorId) {
        console.warn(`⚠️  Missing estate ${item.estateId} or vendor ${item.vendorId} for item ${item._id}`);
        continue;
      }

      const [inserted] = await db.insert(marketplaceItems).values({
        estateId,
        vendorId,
        name: item.name,
        description: item.description,
        price: item.price.toString(),
        currency: item.currency,
        category: item.category,
        subcategory: item.subcategory,
        stock: item.stock,
        images: item.images,
        isActive: item.isActive,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      }).returning();

      await storeIdMapping(item._id.toString(), inserted.id, 'marketplace_item');
      migrated++;
    } catch (error) {
      console.error(`❌ Failed to migrate marketplace item ${item._id}:`, error);
    }
  }

  console.log(`✅ Marketplace items migrated: ${migrated}, skipped: ${skipped}`);
}

/**
 * Migrate Orders from MongoDB to PostgreSQL
 */
export async function migrateOrders() {
  console.log('📦 Migrating orders...');
  const mongoOrders = await Order.find({});
  let migrated = 0;
  let skipped = 0;

  for (const order of mongoOrders) {
    try {
      // Check if already migrated
      const existingMapping = await getPostgresId(order._id.toString());
      if (existingMapping) {
        skipped++;
        continue;
      }

      const estateId = await getPostgresId(order.estateId);
      const buyerId = await getPostgresId(order.buyerId);
      const vendorId = await getPostgresId(order.vendorId);

      if (!estateId || !buyerId || !vendorId) {
        console.warn(`⚠️  Missing estate/buyer/vendor for order ${order._id}`);
        continue;
      }

      const [inserted] = await db.insert(orders).values({
        estateId,
        buyerId,
        vendorId,
        items: order.items as any,
        total: order.total.toString(),
        currency: order.currency,
        status: order.status as any,
        deliveryAddress: order.deliveryAddress,
        paymentMethod: order.paymentMethod,
        paymentId: order.paymentId,
        dispute: order.dispute as any,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
      }).returning();

      await storeIdMapping(order._id.toString(), inserted.id, 'order');
      migrated++;
    } catch (error) {
      console.error(`❌ Failed to migrate order ${order._id}:`, error);
    }
  }

  console.log(`✅ Orders migrated: ${migrated}, skipped: ${skipped}`);
}

/**
 * Migrate Audit Logs from MongoDB to PostgreSQL
 */
export async function migrateAuditLogs() {
  console.log('📝 Migrating audit logs...');
  const mongoLogs = await AuditLog.find({});
  let migrated = 0;
  let skipped = 0;

  for (const log of mongoLogs) {
    try {
      // Check if already migrated
      const existingMapping = await getPostgresId(log._id.toString());
      if (existingMapping) {
        skipped++;
        continue;
      }

      const estateId = log.estateId ? await getPostgresId(log.estateId) : null;

      const [inserted] = await db.insert(auditLogs).values({
        actorId: log.actorId,
        estateId: estateId || undefined,
        action: log.action,
        target: log.target,
        targetId: log.targetId,
        meta: log.meta as any,
        ipAddress: log.ipAddress,
        userAgent: log.userAgent,
        createdAt: log.createdAt,
      }).returning();

      await storeIdMapping(log._id.toString(), inserted.id, 'audit_log');
      migrated++;
    } catch (error) {
      console.error(`❌ Failed to migrate audit log ${log._id}:`, error);
    }
  }

  console.log(`✅ Audit logs migrated: ${migrated}, skipped: ${skipped}`);
}

/**
 * Run complete migration
 */
export async function runMigration() {
  console.log('🚀 Starting MongoDB to PostgreSQL migration...\n');

  try {
    // Migrate in order of dependencies
    await migrateEstates();
    await migrateAdminUsers();
    await migrateProviders();
    await migrateMemberships();
    await migrateCategories();
    await migrateServiceRequests();
    await migrateMarketplaceItems();
    await migrateOrders();
    await migrateAuditLogs();

    console.log('\n✅ Migration completed successfully!');
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    throw error;
  }
}

// CLI execution
if (require.main === module) {
  runMigration()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
