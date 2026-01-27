#!/usr/bin/env node
import "dotenv/config";
import pkg from "pg";
const { Pool } = pkg;

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function checkBothTables() {
  const client = await pool.connect();
  try {
    const email = "shikongrebecca@gmail.com";
    
    // Check Drizzle users table
    const drizzleResult = await client.query(
      `SELECT id, email, role FROM users WHERE email = $1`,
      [email]
    );

    // Check Prisma User table
    const prismaResult = await client.query(
      `SELECT id, email, "globalRole" FROM "User" WHERE email = $1`,
      [email]
    );

    console.log(`📊 Drizzle users table:`);
    if (drizzleResult.rows.length > 0) {
      console.log(`   Role: ${drizzleResult.rows[0].role}`);
    }

    console.log(`\n📊 Prisma User table:`);
    if (prismaResult.rows.length > 0) {
      console.log(`   GlobalRole: ${prismaResult.rows[0].globalRole}`);
    } else {
      console.log(`   User not found in Prisma!`);
    }

    if (drizzleResult.rows.length > 0 && prismaResult.rows.length > 0) {
      if (drizzleResult.rows[0].role !== prismaResult.rows[0].globalRole.toLowerCase()) {
        console.log(`\n❌ MISMATCH! Roles don't match`);
      }
    }
    
  } finally {
    client.release();
    await pool.end();
  }
}

checkBothTables();
