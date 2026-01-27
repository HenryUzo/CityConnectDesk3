#!/usr/bin/env node
/**
 * Verify that both Drizzle users and Prisma User tables are in sync
 * Checks for data consistency issues and reports discrepancies
 */

import "dotenv/config";
import pkg from "pg";
const { Pool } = pkg;

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function verifySync() {
  const client = await pool.connect();
  try {
    console.log("🔍 Verifying table synchronization...\n");

    // Get all users from both tables
    const drizzleUsers = await client.query(`
      SELECT id, email, name, is_approved, is_active, password FROM users ORDER BY id
    `);

    const prismaUsers = await client.query(`
      SELECT id, email, name, "isApproved", "isActive", "passwordHash" FROM "User" ORDER BY id
    `);

    const drizzleMap = new Map(drizzleUsers.rows.map(u => [u.id, u]));
    const prismaMap = new Map(prismaUsers.rows.map(u => [u.id, u]));

    let issuesFound = 0;

    // Check for missing users in Prisma
    for (const [id, dUser] of drizzleMap) {
      const pUser = prismaMap.get(id);
      if (!pUser) {
        console.log(`⚠️  User ${dUser.email} (${id}) exists in Drizzle but missing in Prisma`);
        issuesFound++;
      } else {
        // Check for field mismatches
        const mismatches = [];
        if (dUser.email !== pUser.email) mismatches.push(`email`);
        if (dUser.name !== pUser.name) mismatches.push(`name`);
        if (dUser.is_approved !== pUser.isApproved) mismatches.push(`isApproved`);
        if (dUser.is_active !== pUser.isActive) mismatches.push(`isActive`);
        if (dUser.password !== pUser.passwordHash) mismatches.push(`password`);

        if (mismatches.length > 0) {
          console.log(`⚠️  User ${dUser.email} (${id}) has field mismatches: ${mismatches.join(", ")}`);
          issuesFound++;
        }
      }
    }

    // Check for extra users in Prisma
    for (const [id, pUser] of prismaMap) {
      if (!drizzleMap.has(id)) {
        console.log(`⚠️  User ${pUser.email} (${id}) exists in Prisma but missing in Drizzle`);
        issuesFound++;
      }
    }

    console.log(`\n📊 Summary:`);
    console.log(`   Drizzle users: ${drizzleMap.size}`);
    console.log(`   Prisma users: ${prismaMap.size}`);
    console.log(`   Issues found: ${issuesFound}`);

    if (issuesFound === 0) {
      console.log(`\n✅ Both tables are fully in sync!`);
    } else {
      console.log(`\n❌ Found ${issuesFound} synchronization issue(s)`);
      console.log(`   Run: node cleanup-orphaned-users.mjs`);
    }

  } catch (error) {
    console.error("❌ Error during verification:", error.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

verifySync();
