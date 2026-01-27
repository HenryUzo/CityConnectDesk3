#!/usr/bin/env node
import "dotenv/config";
import pkg from "pg";
const { Pool } = pkg;

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function cleanup() {
  const client = await pool.connect();
  try {
    // Delete from both Drizzle (users) and Prisma (User) tables
    await client.query("DELETE FROM users WHERE email = $1", ["testprovider@example.com"]);
    await client.query('DELETE FROM "User" WHERE email = $1', ["testprovider@example.com"]);
    console.log("✅ Old test provider deleted from all tables");
  } finally {
    client.release();
    await pool.end();
  }
}

cleanup().catch(err => {
  console.error("Error:", err.message);
  process.exit(1);
});
