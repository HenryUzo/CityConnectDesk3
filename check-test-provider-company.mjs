#!/usr/bin/env node
/**
 * Find what company belongs to Test Provider
 */

import "dotenv/config";
import pkg from "pg";
const { Pool } = pkg;

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function findCompany() {
  const client = await pool.connect();
  try {
    console.log("🔍 Finding Test Provider...\n");

    // Find Test Provider
    const result = await client.query(`
      SELECT id, email, name, role, company FROM users 
      WHERE name = 'Test Provider' OR email LIKE '%test%provider%'
    `);

    if (result.rows.length === 0) {
      console.log("❌ Test Provider not found in database");
      return;
    }

    const provider = result.rows[0];
    console.log("✅ Found Test Provider:");
    console.log(`   Name: ${provider.name}`);
    console.log(`   Email: ${provider.email}`);
    console.log(`   Role: ${provider.role}`);
    console.log(`   Company ID: ${provider.company || "None"}\n`);

    if (!provider.company) {
      console.log("❌ No company assigned to Test Provider");
      return;
    }

    // Get company details
    console.log("📋 Getting company details...\n");
    const companyResult = await client.query(`
      SELECT id, name, description, contact_email, phone, is_active
      FROM companies 
      WHERE id = $1
    `, [provider.company]);

    if (companyResult.rows.length === 0) {
      console.log(`❌ Company with ID ${provider.company} not found`);
      return;
    }

    const company = companyResult.rows[0];
    console.log("✅ Company Details:");
    console.log(`   Name: ${company.name}`);
    console.log(`   ID: ${company.id}`);
    console.log(`   Email: ${company.contact_email || "N/A"}`);
    console.log(`   Phone: ${company.phone || "N/A"}`);
    console.log(`   Status: ${company.is_active ? "✅ Active" : "⏳ Pending Approval"}`);
    console.log(`   Description: ${company.description || "N/A"}`);

  } catch (error) {
    console.error("❌ Error:", error.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

findCompany();
