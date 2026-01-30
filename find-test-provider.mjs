#!/usr/bin/env node

import "dotenv/config";
import pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

async function findTestProvider() {
  try {
    // Find Test Provider
    const providerResult = await pool.query(`
      SELECT id, name, email, phone, company FROM users 
      WHERE name ILIKE '%Test Provider%' OR email ILIKE '%test%provider%'
      LIMIT 10
    `);
    
    console.log("🔍 Test Provider(s) found:\n");
    providerResult.rows.forEach((row, idx) => {
      console.log(`${idx + 1}. ${row.name}`);
      console.log(`   Email: ${row.email}`);
      console.log(`   Phone: ${row.phone}`);
      console.log(`   Company ID: ${row.company || "None"}`);
      console.log();
    });
    
    // Get company details for each provider
    const companyIds = providerResult.rows
      .map(r => r.company)
      .filter(Boolean);
    
    if (companyIds.length > 0) {
      console.log("📋 Associated Companies:\n");
      const companyResult = await pool.query(`
        SELECT id, name, description, contact_email, phone, is_active 
        FROM companies 
        WHERE id = ANY($1)
      `, [companyIds]);
      
      companyResult.rows.forEach((company) => {
        console.log(`Company: ${company.name}`);
        console.log(`  ID: ${company.id}`);
        console.log(`  Email: ${company.contact_email || "N/A"}`);
        console.log(`  Phone: ${company.phone || "N/A"}`);
        console.log(`  Active: ${company.is_active ? "✅ Yes" : "❌ No"}`);
        console.log(`  Description: ${company.description || "N/A"}`);
        console.log();
      });
    } else {
      console.log("❌ No company assigned to Test Provider");
    }
  } catch (error) {
    console.error("❌ Error:", error.message);
  } finally {
    await pool.end();
  }
}

findTestProvider();
