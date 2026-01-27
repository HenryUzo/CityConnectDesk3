#!/usr/bin/env node
import "dotenv/config";
import pkg from "pg";
const { Pool } = pkg;

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function clearSessions() {
  const client = await pool.connect();
  try {
    // Clear the session store
    await client.query(`DELETE FROM "session" WHERE "sid" IS NOT NULL`);
    console.log("✅ Sessions cleared");
    
  } finally {
    client.release();
    await pool.end();
  }
}

clearSessions();
