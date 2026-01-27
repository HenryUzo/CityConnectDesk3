#!/usr/bin/env node
import "dotenv/config";
import pkg from "pg";
const { Pool } = pkg;

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function checkUser() {
  const client = await pool.connect();
  try {
    // Check both tables
    const drizzleResult = await client.query(
      "SELECT id, email, name, is_approved FROM users WHERE email = $1",
      ["testprovider@example.com"]
    );
    
    const prismaResult = await client.query(
      'SELECT id, email, name, "isApproved" FROM "User" WHERE email = $1',
      ["testprovider@example.com"]
    );

    if (drizzleResult.rows.length === 0 && prismaResult.rows.length === 0) {
      console.log("✅ Test provider fully deleted from backend");
      console.log("   - Drizzle users table: ✓ Deleted");
      console.log("   - Prisma User table: ✓ Deleted");
      return true;
    }

    if (drizzleResult.rows.length > 0) {
      console.log("❌ Test provider still exists in Drizzle users table:");
      console.log(JSON.stringify(drizzleResult.rows[0], null, 2));
    }

    if (prismaResult.rows.length > 0) {
      console.log("❌ Test provider still exists in Prisma User table:");
      console.log(JSON.stringify(prismaResult.rows[0], null, 2));
    }

    return false;
  } finally {
    client.release();
    await pool.end();
  }
}

checkUser().catch(err => {
  console.error("Error:", err.message);
  process.exit(1);
});
