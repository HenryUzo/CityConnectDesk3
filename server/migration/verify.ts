#!/usr/bin/env tsx
import { db } from '../db';
import { sql } from 'drizzle-orm';

/**
 * Verify migration results
 */
async function verifyMigration() {
  console.log('🔍 Verifying migration results...\n');

  try {
    // Check ID mappings by entity type
    console.log('📊 ID Mapping Statistics:');
    const mappings = await db.execute<{ entity_type: string; count: string }>(sql`
      SELECT entity_type, COUNT(*) as count
      FROM mongo_id_mappings
      GROUP BY entity_type
      ORDER BY entity_type
    `);

    if (mappings.rows.length === 0) {
      console.log('⚠️  No ID mappings found. Migration may not have run yet.');
    } else {
      console.table(mappings.rows);
    }

    // Check table counts
    console.log('\n📈 Table Record Counts:');
    const counts = await Promise.all([
      db.execute(sql`SELECT COUNT(*) as count FROM estates`).then(r => ({ table: 'estates', count: r.rows[0].count })),
      db.execute(sql`SELECT COUNT(*) as count FROM users WHERE global_role IS NOT NULL`).then(r => ({ table: 'admin_users', count: r.rows[0].count })),
      db.execute(sql`SELECT COUNT(*) as count FROM users WHERE role = 'provider'`).then(r => ({ table: 'providers', count: r.rows[0].count })),
      db.execute(sql`SELECT COUNT(*) as count FROM memberships`).then(r => ({ table: 'memberships', count: r.rows[0].count })),
      db.execute(sql`SELECT COUNT(*) as count FROM categories`).then(r => ({ table: 'categories', count: r.rows[0].count })),
      db.execute(sql`SELECT COUNT(*) as count FROM service_requests WHERE estate_id IS NOT NULL`).then(r => ({ table: 'service_requests_with_estate', count: r.rows[0].count })),
      db.execute(sql`SELECT COUNT(*) as count FROM marketplace_items`).then(r => ({ table: 'marketplace_items', count: r.rows[0].count })),
      db.execute(sql`SELECT COUNT(*) as count FROM orders`).then(r => ({ table: 'orders', count: r.rows[0].count })),
      db.execute(sql`SELECT COUNT(*) as count FROM audit_logs`).then(r => ({ table: 'audit_logs', count: r.rows[0].count })),
    ]);

    console.table(counts);

    // Check for potential issues
    console.log('\n🔍 Data Integrity Checks:');
    
    // Check for orphaned memberships
    const orphanedMemberships = await db.execute(sql`
      SELECT COUNT(*) as count
      FROM memberships m
      WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.id = m.user_id)
         OR NOT EXISTS (SELECT 1 FROM estates e WHERE e.id = m.estate_id)
    `);
    
    if (parseInt(orphanedMemberships.rows[0].count as string) > 0) {
      console.log(`⚠️  Found ${orphanedMemberships.rows[0].count} orphaned memberships (missing user or estate)`);
    } else {
      console.log('✅ No orphaned memberships');
    }

    // Check for orphaned marketplace items
    const orphanedItems = await db.execute(sql`
      SELECT COUNT(*) as count
      FROM marketplace_items mi
      WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.id = mi.vendor_id)
         OR NOT EXISTS (SELECT 1 FROM estates e WHERE e.id = mi.estate_id)
    `);
    
    if (parseInt(orphanedItems.rows[0].count as string) > 0) {
      console.log(`⚠️  Found ${orphanedItems.rows[0].count} orphaned marketplace items`);
    } else {
      console.log('✅ No orphaned marketplace items');
    }

    // Check for orphaned orders
    const orphanedOrders = await db.execute(sql`
      SELECT COUNT(*) as count
      FROM orders o
      WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.id = o.buyer_id)
         OR NOT EXISTS (SELECT 1 FROM users v WHERE v.id = o.vendor_id)
         OR NOT EXISTS (SELECT 1 FROM estates e WHERE e.id = o.estate_id)
    `);
    
    if (parseInt(orphanedOrders.rows[0].count as string) > 0) {
      console.log(`⚠️  Found ${orphanedOrders.rows[0].count} orphaned orders`);
    } else {
      console.log('✅ No orphaned orders');
    }

    // Check for providers with company field
    const providersWithCompany = await db.execute(sql`
      SELECT COUNT(*) as count
      FROM users
      WHERE role = 'provider' AND company IS NOT NULL
    `);
    
    console.log(`✅ ${providersWithCompany.rows[0].count} providers have company information`);

    console.log('\n✅ Verification complete!');
    
  } catch (error) {
    console.error('❌ Verification failed:', error);
    throw error;
  }
}

verifyMigration()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
