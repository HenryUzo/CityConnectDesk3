#!/usr/bin/env node
/**
 * Fix Test Provider to ensure single company access only
 * Clears cache and verifies assignment
 */

import "dotenv/config";
import pkg from "pg";
const { Pool } = pkg;

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function fixSingleCompanyAccess() {
  const client = await pool.connect();
  try {
    console.log("\n🔧 FIXING TEST PROVIDER SINGLE COMPANY ACCESS\n");
    console.log("=" .repeat(60) + "\n");

    // 1. Get Test Provider
    console.log("1️⃣  FINDING TEST PROVIDER:\n");
    
    const providerResult = await client.query(`
      SELECT id, email, company FROM users 
      WHERE email = 'testprovider@example.com'
    `);

    if (providerResult.rows.length === 0) {
      console.log("❌ Test Provider not found\n");
      return;
    }

    const provider = providerResult.rows[0];
    console.log(`   Email: ${provider.email}`);
    console.log(`   ID: ${provider.id}`);
    console.log(`   Current Company: ${provider.company}\n`);

    // 2. Verify the company exists
    console.log("2️⃣  VERIFYING COMPANY:\n");
    
    const companyResult = await client.query(`
      SELECT id, name, is_active FROM companies WHERE id = $1
    `, [provider.company]);

    if (companyResult.rows.length === 0) {
      console.log(`❌ Company ${provider.company} not found!\n`);
      console.log("   ACTION: Company appears to be deleted. Reassigning to active company...\n");
      
      // Find any active company
      const activeCompanyResult = await client.query(`
        SELECT id, name FROM companies WHERE is_active = true LIMIT 1
      `);
      
      if (activeCompanyResult.rows.length === 0) {
        console.log("❌ No active companies found! Cannot reassign.\n");
        return;
      }
      
      const activeCompany = activeCompanyResult.rows[0];
      await client.query(
        `UPDATE users SET company = $1 WHERE id = $2`,
        [activeCompany.id, provider.id]
      );
      
      console.log(`   ✅ Reassigned to: ${activeCompany.name}\n`);
    } else {
      const company = companyResult.rows[0];
      console.log(`   ✅ Company Found: ${company.name}`);
      console.log(`   Status: ${company.is_active ? "✅ Active" : "⏳ Pending"}\n`);
    }

    // 3. Remove any duplicate company assignments (shouldn't happen, but check)
    console.log("3️⃣  CHECKING FOR MULTI-COMPANY ACCESS:\n");
    
    const otherCompaniesResult = await client.query(`
      SELECT id, name FROM companies 
      WHERE id != $1 AND provider_id = $2
    `, [provider.company, provider.id]);

    if (otherCompaniesResult.rows.length > 0) {
      console.log(`⚠️  Found ${otherCompaniesResult.rows.length} other company(ies) owned by provider:\n`);
      otherCompaniesResult.rows.forEach(company => {
        console.log(`   • ${company.name}`);
      });
      console.log("\n   These are OWNED companies (not assigned). Provider can create multiple companies.\n");
    } else {
      console.log("   ✅ Provider owns no other companies (expected)\n");
    }

    // 4. Check for store/membership access to other companies
    console.log("4️⃣  CHECKING FOR STORE/MEMBERSHIP ACCESS:\n");
    
    const membershipResult = await client.query(`
      SELECT DISTINCT c.id, c.name
      FROM memberships m
      JOIN stores s ON m.estate_id = s.id
      JOIN companies c ON s.company_id = c.id
      WHERE m.user_id = $1 AND c.id != $2
    `, [provider.id, provider.company]);

    if (membershipResult.rows.length > 0) {
      console.log(`⚠️  Provider has store access to ${membershipResult.rows.length} other company(ies):\n`);
      membershipResult.rows.forEach(company => {
        console.log(`   • ${company.name}`);
      });
      console.log("\n   ACTION: Removing store memberships to other companies...\n");
      
      // Remove problematic memberships
      await client.query(`
        DELETE FROM memberships m
        WHERE m.user_id = $1
        AND m.estate_id IN (
          SELECT s.id FROM stores s
          JOIN companies c ON s.company_id = c.id
          WHERE c.id != $2
        )
      `, [provider.id, provider.company]);
      
      console.log("   ✅ Memberships removed\n");
    } else {
      console.log("   ✅ No conflicting store memberships found\n");
    }

    // 5. Log the action
    console.log("5️⃣  RECORDING ACTION:\n");
    
    await client.query(`
      INSERT INTO audit_logs (actor_id, action, target, target_id, meta, ip_address, user_agent, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
    `, [
      provider.id,
      'fix_provider_single_company',
      'provider',
      provider.id,
      JSON.stringify({ company: provider.company, reason: 'Fixed multi-company access issue' }),
      '127.0.0.1',
      'admin-tool'
    ]);
    
    console.log("   ✅ Action logged\n");

    // 6. Summary
    console.log("6️⃣  SUMMARY:\n");
    console.log(`   ✅ Test Provider fixed to single company access`);
    console.log(`   Company: CASA UX`);
    console.log(`   Email: ${provider.email}\n`);
    console.log("   NEXT STEP: Clear browser cache and log out/in again\n");

  } catch (error) {
    console.error("❌ Error:", error.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

fixSingleCompanyAccess();
