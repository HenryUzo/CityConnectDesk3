#!/usr/bin/env node
/**
 * Resync all user data from Drizzle to Prisma
 * Fixes mismatched fields and ensures consistency
 */

import "dotenv/config";
import pkg from "pg";
const { Pool } = pkg;

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function syncDrizzleToPrisma() {
  const client = await pool.connect();
  try {
    console.log("🔄 Syncing Drizzle users to Prisma...\n");

    // Get all users from Drizzle
    const result = await client.query(`
      SELECT id, email, name, password, is_approved, is_active, global_role
      FROM users
      ORDER BY id
    `);

    const users = result.rows;
    console.log(`Found ${users.length} users to sync\n`);

    // For each user, update Prisma to match Drizzle
    for (const user of users) {
      // Convert Drizzle role to Prisma enum (map to uppercase with underscores)
      const roleMap = {
        "resident": "RESIDENT",
        "provider": "PROVIDER",
        "admin": "ADMIN",
        "super_admin": "SUPER_ADMIN",
        "estate_admin": "ESTATE_ADMIN",
        "moderator": "MODERATOR",
      };
      const globalRole = roleMap[user.global_role] || "RESIDENT";
      
      const updateSql = `
        UPDATE "User"
        SET 
          email = $2,
          name = $3,
          "passwordHash" = $4,
          "isApproved" = $5,
          "isActive" = $6,
          "globalRole" = $7,
          "updatedAt" = NOW()
        WHERE id = $1
      `;

      await client.query(updateSql, [
        user.id,
        user.email,
        user.name,
        user.password,
        user.is_approved,
        user.is_active,
        globalRole,
      ]);

      console.log(`✓ Synced ${user.email}`);
    }

    console.log(`\n✅ All users synced from Drizzle to Prisma!`);

  } catch (error) {
    console.error("❌ Error during sync:", error.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

syncDrizzleToPrisma();
