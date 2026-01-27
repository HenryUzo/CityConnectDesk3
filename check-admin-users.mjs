#!/usr/bin/env node
/**
 * Check admin users in the database
 */

import "dotenv/config";
import pkg from "pg";
const { Pool } = pkg;

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function checkAdmins() {
  const client = await pool.connect();
  try {
    console.log("🔍 Checking for admin users...\n");

    // Check Drizzle users table
    const drizzleAdmins = await client.query(`
      SELECT id, email, name, role, is_approved, is_active FROM users WHERE role = 'admin' OR role = 'super_admin'
    `);

    console.log(`📊 Drizzle users table:`);
    if (drizzleAdmins.rows.length === 0) {
      console.log(`   No admin users found`);
    } else {
      drizzleAdmins.rows.forEach(u => {
        console.log(`   - ${u.email} (${u.role}) [Active: ${u.is_active}, Approved: ${u.is_approved}]`);
      });
    }

    // Check Prisma User table
    const prismaAdmins = await client.query(`
      SELECT id, email, name, "globalRole", "isActive", "isApproved" FROM "User" WHERE "globalRole" = 'ADMIN' OR "globalRole" = 'SUPER_ADMIN'
    `);

    console.log(`\n📊 Prisma User table:`);
    if (prismaAdmins.rows.length === 0) {
      console.log(`   No admin users found`);
    } else {
      prismaAdmins.rows.forEach(u => {
        console.log(`   - ${u.email} (${u.globalRole}) [Active: ${u.isActive}, Approved: ${u.isApproved}]`);
      });
    }

    // Show all users for reference
    console.log(`\n📋 All users in system:`);
    const allUsers = await client.query(`SELECT email, role FROM users ORDER BY email`);
    if (allUsers.rows.length === 0) {
      console.log(`   No users found`);
    } else {
      allUsers.rows.forEach(u => {
        console.log(`   - ${u.email} (${u.role})`);
      });
    }

  } catch (error) {
    console.error("❌ Error:", error.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

checkAdmins();
