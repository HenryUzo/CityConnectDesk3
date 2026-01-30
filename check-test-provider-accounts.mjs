#!/usr/bin/env node
/**
 * Check for multiple Test Provider accounts and their company assignments
 */

import "dotenv/config";
import pkg from "pg";
const { Pool } = pkg;

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function checkProviders() {
  const client = await pool.connect();
  try {
    console.log("🔍 Checking for Test Provider accounts...\n");

    // Find all Test Provider accounts
    const result = await client.query(`
      SELECT id, email, name, role, company, is_active, is_approved, created_at
      FROM users 
      WHERE name ILIKE '%Test Provider%' 
         OR email ILIKE '%test%provider%'
         OR email = 'testprovider@example.com'
      ORDER BY created_at DESC
    `);

    console.log(`📊 Found ${result.rows.length} Test Provider account(s):\n`);
    
    if (result.rows.length === 0) {
      console.log("❌ No Test Provider accounts found");
      return;
    }

    result.rows.forEach((provider, idx) => {
      console.log(`${idx + 1}. ${provider.name} (ID: ${provider.id})`);
      console.log(`   Email: ${provider.email}`);
      console.log(`   Company: ${provider.company || "None"}`);
      console.log(`   Active: ${provider.is_active ? "✅" : "❌"}`);
      console.log(`   Approved: ${provider.is_approved ? "✅" : "❌"}`);
      console.log(`   Created: ${provider.created_at}`);
      console.log();
    });

    // Get company details for each provider
    const companies = new Set(result.rows.map(p => p.company).filter(Boolean));
    
    if (companies.size > 0) {
      console.log("📋 Associated Companies:\n");
      
      for (const companyId of companies) {
        const companyResult = await client.query(`
          SELECT id, name, provider_id, is_active FROM companies WHERE id = $1
        `, [companyId]);
        
        if (companyResult.rows.length > 0) {
          const company = companyResult.rows[0];
          console.log(`Company: ${company.name} (ID: ${company.id})`);
          console.log(`  Provider ID: ${company.provider_id || "None"}`);
          console.log(`  Active: ${company.is_active ? "✅" : "❌"}`);
          
          // Count how many providers belong to this company
          const providerCount = await client.query(`
            SELECT COUNT(*) as count FROM users WHERE company = $1
          `, [companyId]);
          console.log(`  Providers in company: ${providerCount.rows[0].count}`);
          console.log();
        }
      }
    }

    // Check for duplicate emails
    console.log("🔎 Checking for duplicate provider emails...\n");
    const emailResult = await client.query(`
      SELECT email, COUNT(*) as count FROM users 
      WHERE role = 'provider'
      GROUP BY email
      HAVING COUNT(*) > 1
      ORDER BY count DESC
    `);

    if (emailResult.rows.length > 0) {
      console.log(`⚠️  Found ${emailResult.rows.length} email(s) with multiple accounts:\n`);
      emailResult.rows.forEach(row => {
        console.log(`  ${row.email}: ${row.count} accounts`);
      });
    } else {
      console.log("✅ No duplicate provider emails found");
    }

  } catch (error) {
    console.error("❌ Error:", error.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

checkProviders();
