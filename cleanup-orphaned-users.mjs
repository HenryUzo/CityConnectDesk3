#!/usr/bin/env node
/**
 * Clean up orphaned user records from both Drizzle and Prisma tables
 * Removes users that exist in one table but not the other
 */

import "dotenv/config";
import pkg from "pg";
const { Pool } = pkg;

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function cleanupOrphanedUsers() {
  const client = await pool.connect();
  try {
    console.log("🔍 Scanning for orphaned user records...\n");

    // Find users in Drizzle table but not in Prisma table
    const drizzleOnlyResult = await client.query(`
      SELECT u.id, u.email, u.name FROM users u
      LEFT JOIN "User" p ON u.id = p.id
      WHERE p.id IS NULL
    `);

    // Find users in Prisma table but not in Drizzle table
    const prismaOnlyResult = await client.query(`
      SELECT p.id, p.email, p.name FROM "User" p
      LEFT JOIN users u ON p.id = u.id
      WHERE u.id IS NULL
    `);

    const drizzleOnlyCount = drizzleOnlyResult.rows.length;
    const prismaOnlyCount = prismaOnlyResult.rows.length;
    const totalOrphaned = drizzleOnlyCount + prismaOnlyCount;

    if (totalOrphaned === 0) {
      console.log("✅ No orphaned records found. Tables are in sync!");
      return;
    }

    console.log(`⚠️  Found ${totalOrphaned} orphaned record(s):\n`);

    if (drizzleOnlyCount > 0) {
      console.log(`📝 In Drizzle users table only (${drizzleOnlyCount}):`);
      drizzleOnlyResult.rows.forEach(row => {
        console.log(`   - ${row.email} (ID: ${row.id})`);
      });
      console.log();
    }

    if (prismaOnlyCount > 0) {
      console.log(`📝 In Prisma User table only (${prismaOnlyCount}):`);
      prismaOnlyResult.rows.forEach(row => {
        console.log(`   - ${row.email} (ID: ${row.id})`);
      });
      console.log();
    }

    // Delete orphaned records
    console.log("🗑️  Deleting orphaned records...\n");

    // Delete from Drizzle that don't exist in Prisma
    if (drizzleOnlyCount > 0) {
      const drizzleIds = drizzleOnlyResult.rows.map(r => r.id);
      const placeholders = drizzleIds.map((_, i) => `$${i + 1}`).join(",");
      await client.query(`DELETE FROM users WHERE id IN (${placeholders})`, drizzleIds);
      console.log(`✓ Deleted ${drizzleOnlyCount} orphaned record(s) from Drizzle users table`);
    }

    // Delete from Prisma that don't exist in Drizzle
    if (prismaOnlyCount > 0) {
      const prismaIds = prismaOnlyResult.rows.map(r => r.id);
      const placeholders = prismaIds.map((_, i) => `$${i + 1}`).join(",");
      await client.query(`DELETE FROM "User" WHERE id IN (${placeholders})`, prismaIds);
      console.log(`✓ Deleted ${prismaOnlyCount} orphaned record(s) from Prisma User table`);
    }

    console.log(`\n✅ Cleanup complete! Both tables are now in sync.`);

  } catch (error) {
    console.error("❌ Error during cleanup:", error.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

cleanupOrphanedUsers();
