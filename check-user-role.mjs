#!/usr/bin/env node
import "dotenv/config";
import pkg from "pg";
const { Pool } = pkg;

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function checkUser() {
  const client = await pool.connect();
  try {
    const email = "shikongrebecca@gmail.com";
    
    // Check Drizzle users table
    const result = await client.query(
      `SELECT id, email, name, role, global_role, is_approved, is_active FROM users WHERE email = $1`,
      [email]
    );

    if (result.rows.length === 0) {
      console.log(`❌ User not found: ${email}`);
    } else {
      const user = result.rows[0];
      console.log(`✓ Found user: ${email}`);
      console.log(`\n📊 User Details:`);
      console.log(`   ID: ${user.id}`);
      console.log(`   Name: ${user.name}`);
      console.log(`   Role: ${user.role}`);
      console.log(`   Global Role: ${user.global_role}`);
      console.log(`   Approved: ${user.is_approved}`);
      console.log(`   Active: ${user.is_active}`);
    }
    
  } finally {
    client.release();
    await pool.end();
  }
}

checkUser();
