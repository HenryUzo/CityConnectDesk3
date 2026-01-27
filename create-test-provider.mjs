#!/usr/bin/env node

/**
 * Create a test provider user in the database for testing provider login.
 * Usage: 
 *   node create-test-provider.mjs              // Creates unapproved provider (goes to waiting room)
 *   node create-test-provider.mjs --approved   // Creates approved provider (goes to dashboard)
 */

import "dotenv/config";
import { randomUUID } from "crypto";
import { scrypt, randomBytes } from "crypto";
import { promisify } from "util";

const scryptAsync = promisify(scrypt);

// Get DB connection details from environment
const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("❌ DATABASE_URL environment variable not set");
  process.exit(1);
}

// Parse connection string
const cs = DATABASE_URL;
let pg;
let pool;

// Import appropriate db driver
if (cs.startsWith("postgres://") || cs.startsWith("postgresql://")) {
  // Node postgres
  const pgModule = await import("pg");
  pg = pgModule;
  pool = new pgModule.Pool({ connectionString: cs });
} else {
  console.error("❌ Unsupported database. Expected PostgreSQL connection string");
  process.exit(1);
}

async function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const derived = (await scryptAsync(password, salt, 64));
  return `${derived.toString("hex")}.${salt}`;
}

async function createTestProvider() {
  const client = await pool.connect();
  try {
    console.log("🔧 Creating test provider user...\n");

    // Check for --approved flag
    const isApproved = process.argv.includes("--approved");

    const testEmail = "testprovider@example.com";
    const testPassword = "TestProvider123!";
    const testName = "Test Provider";

    // Check if user already exists
    const existingQuery = `SELECT id FROM users WHERE email = $1`;
    const existingResult = await client.query(existingQuery, [testEmail]);

    if (existingResult.rows.length > 0) {
      console.log(`⚠️  Test provider already exists with ID: ${existingResult.rows[0].id}`);
      console.log(`\n📝 Login credentials:`);
      console.log(`   Email: ${testEmail}`);
      console.log(`   Password: ${testPassword}`);
      return existingResult.rows[0].id;
    }

    // Hash password
    const hashedPassword = await hashPassword(testPassword);
    const userId = randomUUID();

    // Insert into users table (Drizzle schema)
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
      "provider",       // role (lowercase)
      "provider",       // global_role (lowercase)
      true,             // is_active
      isApproved,       // is_approved (false by default, true if --approved)
    ];

    await client.query(insertQuery, values);

    // Also mirror in Prisma user table
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
      "PROVIDER",       // globalRole (UPPERCASE per Prisma schema)
      true,             // isActive
      isApproved,       // isApproved (matches the Drizzle value)
    ];

    await client.query(prismaInsertQuery, prismaValues);

    console.log(`✅ Test provider created successfully!\n`);
    console.log(`📋 User Details:`);
    console.log(`   ID: ${userId}`);
    console.log(`   Name: ${testName}`);
    console.log(`   Email: ${testEmail}`);
    console.log(`   Phone: +1234567890`);
    console.log(`   Role: provider`);
    console.log(`   Approved: ${isApproved ? "Yes ✅" : "No (Waiting Room) ⏳"}`);
    console.log(`\n📝 Login credentials:`);
    console.log(`   Email: ${testEmail}`);
    console.log(`   Password: ${testPassword}`);
    console.log(`\n🧪 To test login, use:`);
    console.log(`   1. Go to http://localhost:5173/auth`);
    console.log(`   2. Select "Provider" tab`);
    console.log(`   3. Click on "Sign In"`);
    console.log(`   4. Enter email: ${testEmail}`);
    console.log(`   5. Enter password: ${testPassword}`);
    console.log(`   6. Click "Sign In"`);
    if (!isApproved) {
      console.log(`\n   → You should be redirected to the WAITING ROOM (pending approval)`);
    } else {
      console.log(`\n   → You should be redirected to the PROVIDER DASHBOARD`);
    }
    console.log(`\n💡 To create an approved provider instead, run:`);
    console.log(`   node create-test-provider.mjs --approved`);
    console.log(`\n`);

    return userId;
  } catch (error) {
    console.error("❌ Error creating test provider:", error.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

// Run
createTestProvider().catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});
