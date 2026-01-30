#!/usr/bin/env node
/**
 * Check all companies and audit logs for Test Provider reassignments
 */

import "dotenv/config";
import pkg from "pg";
const { Pool } = pkg;

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function checkCompanies() {
  const client = await pool.connect();
  try {
    console.log("\n📊 CHECKING ALL COMPANIES AND AUDIT LOGS\n");
    console.log("=" .repeat(60) + "\n");

    // Get Test Provider ID
    const providerResult = await client.query(`
      SELECT id, email, company FROM users 
      WHERE email = 'testprovider@example.com'
    `);

    if (providerResult.rows.length === 0) {
      console.log("❌ Test Provider not found\n");
      return;
    }

    const providerId = providerResult.rows[0].id;
    const currentCompany = providerResult.rows[0].company;

    console.log(`Provider ID: ${providerId}`);
    console.log(`Current Company: ${currentCompany}\n`);

    // 1. List all companies
    console.log("1️⃣  ALL COMPANIES IN SYSTEM:\n");
    
    const companiesResult = await client.query(`
      SELECT id, name, is_active, created_at
      FROM companies
      ORDER BY created_at DESC
    `);

    console.log(`   Total: ${companiesResult.rows.length} companies\n`);
    companiesResult.rows.forEach((company, i) => {
      const isCurrent = company.id === currentCompany ? " ← CURRENT" : "";
      console.log(`   ${i + 1}. ${company.name}${isCurrent}`);
      console.log(`      ID: ${company.id}`);
      console.log(`      Status: ${company.is_active ? "✅ Active" : "⏳ Pending"}`);
      console.log(`      Created: ${new Date(company.created_at).toLocaleString()}\n`);
    });

    // 2. Check audit logs for this provider
    console.log("2️⃣  AUDIT LOGS FOR TEST PROVIDER:\n");
    
    const auditResult = await client.query(`
      SELECT action, meta, created_at 
      FROM audit_logs
      WHERE actor_id = $1 OR target_id = $1
      ORDER BY created_at DESC
      LIMIT 20
    `, [providerId]);

    if (auditResult.rows.length > 0) {
      console.log(`   Found ${auditResult.rows.length} log entries:\n`);
      auditResult.rows.forEach((log, i) => {
        console.log(`   ${i + 1}. ${log.action}`);
        console.log(`      Time: ${new Date(log.created_at).toLocaleString()}`);
        if (log.meta) {
          console.log(`      Details: ${JSON.stringify(log.meta)}`);
        }
        console.log();
      });
    } else {
      console.log("   ℹ️  No audit logs found\n");
    }

    // 3. Check if provider belongs to multiple companies (shouldn't happen but check)
    console.log("3️⃣  CHECKING FOR MULTI-COMPANY ACCESS:\n");
    
    // Check companies where provider is the provider_id
    const providerCompaniesResult = await client.query(`
      SELECT id, name, is_active FROM companies
      WHERE provider_id = $1
    `, [providerId]);

    if (providerCompaniesResult.rows.length > 0) {
      console.log(`   Companies owned by provider: ${providerCompaniesResult.rows.length}\n`);
      providerCompaniesResult.rows.forEach(company => {
        console.log(`   • ${company.name} (Owner)`);
      });
      console.log();
    }

    // Check if there's any store access through memberships
    const membershipResult = await client.query(`
      SELECT DISTINCT s.company_id, c.name
      FROM memberships m
      JOIN stores s ON m.estate_id = s.id
      JOIN companies c ON s.company_id = c.id
      WHERE m.user_id = $1
      GROUP BY s.company_id, c.name
    `, [providerId]);

    if (membershipResult.rows.length > 0) {
      console.log(`   Companies accessible via store memberships: ${membershipResult.rows.length}\n`);
      membershipResult.rows.forEach(row => {
        console.log(`   • ${row.name}`);
      });
      console.log();
    }

    // 4. Summary
    console.log("4️⃣  SUMMARY:\n");
    console.log(`   Current Company (users.company): ${currentCompany || "None"}`);
    console.log(`   Owned Companies: ${providerCompaniesResult.rows.length}`);
    console.log(`   Accessible via Membership: ${membershipResult.rows.length}`);
    console.log();

    if (currentCompany && membershipResult.rows.length > 0) {
      const accessibleCompanies = [currentCompany, ...membershipResult.rows.map(r => r.name)];
      console.log(`   ⚠️  Total companies accessible: ${accessibleCompanies.length}\n`);
    }

  } catch (error) {
    console.error("❌ Error:", error.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

checkCompanies();
