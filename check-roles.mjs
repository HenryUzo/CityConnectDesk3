#!/usr/bin/env node
import "dotenv/config";
import pkg from "pg";
const { Pool } = pkg;

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function checkRoles() {
  const client = await pool.connect();
  try {
    const res = await client.query('SELECT DISTINCT role FROM users ORDER BY role');
    console.log('Roles in Drizzle:', res.rows.map(r => r.role));
  } finally {
    client.release();
    await pool.end();
  }
}

checkRoles();
