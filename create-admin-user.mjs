#!/usr/bin/env node
/**
 * Create a test admin user in the database
 */

import "dotenv/config";
import { randomUUID } from "crypto";
import { scrypt, randomBytes } from "crypto";
import { promisify } from "util";
import pkg from "pg";
const { Pool } = pkg;

const scryptAsync = promisify(scrypt);

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const derived = (await scryptAsync(password, salt, 64));
  return `${derived.toString("hex")}.${salt}`;
}

async function createAdminUser() {
  const client = await pool.connect();
  try {
    console.log("🔧 Creating admin user...\n");

    const testEmail = "admin@cityconnect.com";
    const testPassword = "AdminPassword123!";
    const testName = "Admin";

    // Check if user already exists
    const existingQuery = `SELECT id FROM users WHERE email = $1`;
    const existingResult = await client.query(existingQuery, [testEmail]);

    if (existingResult.rows.length > 0) {
      console.log(`⚠️  Admin user already exists with ID: ${existingResult.rows[0].id}`);
      console.log(`\n📝 Login credentials:`);
      console.log(`   Email: ${testEmail}`);
      console.log(`   Password: ${testPassword}`);
      return existingResult.rows[0].id;
    }

    // Hash password
    const hashedPassword = await hashPassword(testPassword);
    const userId = randomUUID();

    // Insert into users table (Drizzle schema) - use super_admin role
    const insertQuery = `
      INSERT INTO users (
        id, 
        name, 
        email, 
        phone, 
        password, 
        role, 
        global_role,
        is_active, 
        is_approved,
        created_at,
        updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
    `;

    const values = [
      userId,           // id
      testName,         // name
      testEmail,        // email
      "+1234567890",    // phone
      hashedPassword,   // password (hashed)
      "super_admin",    // role (use super_admin which exists in Drizzle enum)
      "super_admin",    // global_role 
      true,             // is_active
      true,             // is_approved
    ];

    await client.query(insertQuery, values);

    // Also mirror in Prisma user table - use SUPER_ADMIN which exists in Prisma
    const prismaInsertQuery = `
      INSERT INTO "User" (
        id, 
        email, 
        name, 
        "passwordHash",
        "globalRole",
        "isActive", 
        "isApproved",
        "createdAt",
        "updatedAt"
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
      ON CONFLICT (id) DO NOTHING
    `;

    const prismaValues = [
      userId,           // id
      testEmail,        // email
      testName,         // name
      hashedPassword,   // passwordHash
      "SUPER_ADMIN",    // globalRole (UPPERCASE per Prisma schema)
      true,             // isActive
      true,             // isApproved
    ];

    await client.query(prismaInsertQuery, prismaValues);

    console.log(`✅ Admin user created successfully!\n`);
    console.log(`📋 User Details:`);
    console.log(`   ID: ${userId}`);
    console.log(`   Name: ${testName}`);
    console.log(`   Email: ${testEmail}`);
    console.log(`   Phone: +1234567890`);
    console.log(`   Role: super_admin`);
    console.log(`   Approved: Yes`);
    console.log(`\n📝 Login credentials:`);
    console.log(`   Email: ${testEmail}`);
    console.log(`   Password: ${testPassword}`);
    console.log(`\n🧪 To test admin login, use:`);
    console.log(`   1. Go to http://localhost:5173/admin`);
    console.log(`   2. Enter email: ${testEmail}`);
    console.log(`   3. Enter password: ${testPassword}`);
    console.log(`   4. Click "Login"`);
    console.log(`\n`);

    return userId;
  } catch (error) {
    console.error("❌ Error creating admin user:", error.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

createAdminUser();
