#!/usr/bin/env node
import "dotenv/config";
import pkg from "pg";
const { Pool } = pkg;

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function checkDrizzle() {
  const client = await pool.connect();
  try {
    const res = await client.query(
      `SELECT email, role, global_role FROM users WHERE email = $1`,
      ["shikongrebecca@gmail.com"]
    );

    console.log("Raw Drizzle data:");
    console.log(JSON.stringify(res.rows[0], null, 2));
    
  } finally {
    client.release();
    await pool.end();
  }
}

checkDrizzle();
