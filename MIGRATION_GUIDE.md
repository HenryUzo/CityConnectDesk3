# MongoDB to PostgreSQL Migration Guide

## Overview

This guide documents the migration from a dual-database architecture (MongoDB + PostgreSQL) to a unified PostgreSQL database. The migration consolidates all admin management data from MongoDB into the existing PostgreSQL operational database.

## Architecture Changes

### Before Migration
- **MongoDB**: Estates, admin users, memberships, providers (with company field), service requests, marketplace items, orders, categories, audit logs
- **PostgreSQL**: Residents, providers (operational data), service requests, wallets, transactions

### After Migration
- **PostgreSQL**: All data consolidated with unified schema
- **MongoDB**: Archived for historical reference

## New PostgreSQL Tables

### 1. **estates**
- Estate/tenant information
- Stores geospatial coverage data as JSONB (GeoJSON Polygon)
- Settings stored as JSONB for flexibility

### 2. **memberships**
- User-estate relationships
- Links users to estates with specific roles
- Replaces estate-specific access control

### 3. **categories**
- Service and marketplace categories
- Supports both global and estate-specific categories

### 4. **marketplace_items**
- Marketplace product listings
- Estate-scoped with vendor relationships

### 5. **orders**
- Order management and tracking
- Items stored as JSONB array

### 6. **audit_logs**
- Complete audit trail for all actions
- Metadata stored as JSONB

### 7. **mongo_id_mappings**
- Migration tracking table
- Maps MongoDB _id to PostgreSQL UUID
- Enables bidirectional lookups during transition

## Extended PostgreSQL Tables

### **users** table additions:
- `globalRole` - For admin roles (super_admin, estate_admin, moderator)
- `company` - Provider company name (from MongoDB)
- `documents` - Array of provider documents
- `lastLoginAt` - Last login timestamp for admins
- `metadata` - JSONB field for flexible MongoDB data

### **service_requests** table additions:
- `estateId` - Optional estate reference for multi-tenant support

## Migration Process

### Phase 1: Schema Deployment ✅
1. Unified schema designed in `shared/schema.ts`
2. New enums added: `order_status`, `category_scope`
3. Extended `user_role` enum with admin roles
4. Schema pushed to database using Drizzle

### Phase 2: ETL Migration (Current Phase)
Run the migration script to backfill data from MongoDB:

```bash
# Set MongoDB connection string
export MONGODB_URI="mongodb://your-mongodb-connection-string"

# Run migration
tsx server/migration/index.ts

# Verify results
tsx server/migration/verify.ts
```

The migration script (`server/migration/etl-mongo-to-postgres.ts`) will:
1. ✅ Migrate estates with geospatial data
2. ✅ Migrate admin users
3. ✅ Merge MongoDB providers with PostgreSQL users
4. ✅ Migrate memberships (user-estate relationships)
5. ✅ Migrate service requests with estate references
6. ✅ Migrate categories (global and estate-specific)
7. ✅ Migrate marketplace items
8. ✅ Migrate orders
9. ✅ Migrate audit logs

Each migration:
- Checks for existing mappings to prevent duplicates
- Stores MongoDB-to-PostgreSQL ID mappings
- Handles missing references gracefully
- Provides detailed logging

### Phase 3: Dual-Write Period (Next)
During transition, implement dual writes:
- Primary writes go to PostgreSQL
- Shadow writes go to MongoDB for validation
- Duration: 1-2 weeks or until confidence is high

Implementation:
```typescript
// Example dual-write pattern
async function createEstate(data) {
  // Primary write to PostgreSQL
  const pgEstate = await db.insert(estates).values(data).returning();
  
  // Shadow write to MongoDB (non-blocking)
  Estate.create(data).catch(err => 
    console.error('Shadow write failed:', err)
  );
  
  return pgEstate;
}
```

### Phase 4: Read Cutover (After Dual-Write)
1. Switch all reads to PostgreSQL
2. Add shadow reads from MongoDB for validation:
   ```typescript
   const pgData = await db.query.estates.findMany();
   
   // Shadow read for validation (async, non-blocking)
   validateAgainstMongo(pgData).catch(console.error);
   ```
3. Alert on mismatches
4. Duration: 1 week

### Phase 5: Decommissioning
1. Stop dual-writes after validation period
2. Export MongoDB data for archival:
   ```bash
   mongodump --uri="mongodb://..." --out=./mongodb-archive
   ```
3. Remove MongoDB dependencies from codebase
4. Update environment variables
5. Remove MongoDB connection code

## ID Mapping

The `mongo_id_mappings` table tracks all migrated entities:

| Field | Type | Description |
|-------|------|-------------|
| id | varchar (UUID) | PostgreSQL primary key |
| mongoId | text | Original MongoDB _id |
| postgresId | varchar | New PostgreSQL UUID |
| entityType | text | Entity type (estate, user, provider, etc.) |
| createdAt | timestamp | Mapping creation time |

Query mappings:
```sql
-- Find PostgreSQL ID from MongoDB ID
SELECT postgres_id FROM mongo_id_mappings 
WHERE mongo_id = '507f1f77bcf86cd799439011';

-- Find MongoDB ID from PostgreSQL ID
SELECT mongo_id FROM mongo_id_mappings 
WHERE postgres_id = '550e8400-e29b-41d4-a716-446655440000';
```

## Data Transformations

### GeoJSON Data
MongoDB GeoJSON → PostgreSQL JSONB:
```typescript
// MongoDB
coverage: {
  type: 'Polygon',
  coordinates: [[[lng, lat], ...]]
}

// PostgreSQL (stored as JSONB)
coverage: {
  type: 'Polygon',
  coordinates: [[[lng, lat], ...]]
}
```

### Provider Data
MongoDB separate Provider collection → PostgreSQL users table:
```typescript
// MongoDB Provider merged into PostgreSQL user
{
  role: 'provider',
  company: provider.company,
  categories: provider.categories,
  experience: provider.experience,
  metadata: {
    totalJobs: provider.totalJobs,
    estates: provider.estates
  }
}
```

### Flexible Fields
MongoDB flexible fields → PostgreSQL JSONB:
- Estate settings → JSONB
- Order items → JSONB  
- Order dispute → JSONB
- User metadata → JSONB
- Audit log meta → JSONB

## Rollback Plan

If issues arise during migration:

### During ETL Phase:
```bash
# Delete migrated data
DELETE FROM estates WHERE id IN (
  SELECT postgres_id FROM mongo_id_mappings WHERE entity_type = 'estate'
);
DELETE FROM mongo_id_mappings;
```

### During Dual-Write Phase:
1. Stop writes to PostgreSQL
2. Revert to MongoDB-only reads/writes
3. Keep PostgreSQL data for investigation

### After Read Cutover:
1. Restore MongoDB connection
2. Re-enable MongoDB reads
3. Investigate and fix issues
4. Retry migration

## Validation Checklist

### Pre-Migration
- [x] Unified PostgreSQL schema designed
- [x] Schema deployed to database
- [x] Migration scripts created
- [ ] MongoDB connection string configured
- [ ] Backup of both databases created

### Post-Migration
- [ ] Verify record counts match (MongoDB vs PostgreSQL)
- [ ] Test critical user flows (login, service requests, orders)
- [ ] Validate data integrity (no missing references)
- [ ] Check geospatial queries work correctly
- [ ] Verify admin dashboard functionality

### Post-Dual-Write
- [ ] Monitor error rates
- [ ] Compare shadow write results
- [ ] Validate data consistency
- [ ] Performance metrics acceptable

### Pre-Decommissioning
- [ ] All features working on PostgreSQL
- [ ] No MongoDB read/write errors for 1 week
- [ ] MongoDB data archived
- [ ] Team trained on new architecture

## Running the Migration

### 1. Prepare Environment
```bash
# Backup databases
pg_dump $DATABASE_URL > postgres_backup.sql
mongodump --uri=$MONGODB_URI --out=./mongodb_backup

# Set MongoDB URI
export MONGODB_URI="mongodb://username:password@host:port/database"
```

### 2. Run Migration
```bash
# Run the migration script
tsx server/migration/index.ts

# Verify migration results
tsx server/migration/verify.ts
```

### 3. Manual Verification (Optional)
```sql
-- Check migration counts
SELECT entity_type, COUNT(*) 
FROM mongo_id_mappings 
GROUP BY entity_type;

-- Verify estates
SELECT COUNT(*) FROM estates;

-- Verify admin users
SELECT COUNT(*) FROM users WHERE global_role IS NOT NULL;
```

## Troubleshooting

### Common Issues

**Issue**: User not found during provider migration
```
Solution: Run user migration before provider migration
Order: estates → users → providers → memberships
```

**Issue**: Duplicate key violations
```
Solution: Migration is idempotent - it checks for existing mappings
Safe to re-run after fixing data issues
```

**Issue**: Missing references (estate/user not found)
```
Solution: Check MongoDB data integrity
Ensure referenced documents exist before migration
```

## Monitoring

### During Migration
- Watch console output for errors
- Monitor database connections
- Check disk space (PostgreSQL will grow)

### After Migration
- Monitor application logs for database errors
- Track API response times
- Watch for missing data reports
- Monitor PostgreSQL performance

## Support

For issues or questions:
1. Check migration logs in console output
2. Query `mongo_id_mappings` to trace data
3. Review this guide's troubleshooting section
4. Rollback if critical issues found

## Timeline Estimate

- **Phase 1 (Schema)**: ✅ Complete
- **Phase 2 (ETL)**: 2-4 hours (depends on data volume)
- **Phase 3 (Dual-Write)**: 1-2 weeks
- **Phase 4 (Read Cutover)**: 1 week  
- **Phase 5 (Decommission)**: 1-2 days

Total: 3-4 weeks for safe, validated migration
