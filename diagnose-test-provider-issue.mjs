#!/usr/bin/env node
/**
 * Diagnose why Test Provider can login to multiple companies
 */

import "dotenv/config";
import pkg from "pg";
const { Pool } = pkg;

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function diagnoseIssue() {
  const client = await pool.connect();
  try {
    console.log("\n🔍 DIAGNOSING: Test Provider Multiple Companies Issue\n");
    console.log("=" .repeat(60) + "\n");

    // 1. Check all Test Provider accounts
    console.log("1️⃣  CHECKING FOR MULTIPLE TEST PROVIDER ACCOUNTS:\n");
    const providersResult = await client.query(`
      SELECT id, email, name, role, company, is_active, is_approved, created_at
      FROM users 
      WHERE name ILIKE '%Test Provider%' 
         OR email ILIKE '%testprovider%'
      ORDER BY created_at DESC
    `);

    console.log(`   Found: ${providersResult.rows.length} account(s)\n`);
    
    if (providersResult.rows.length === 0) {
      console.log("   ❌ No Test Provider accounts found\n");
      return;
    }

    providersResult.rows.forEach((p, i) => {
      console.log(`   ${i + 1}. ID: ${p.id.substring(0, 8)}...`);
      console.log(`      Email: ${p.email}`);
      console.log(`      Company: ${p.company || "None"}`);
      console.log(`      Created: ${new Date(p.created_at).toLocaleString()}\n`);
    });

    // 2. Check if same provider ID has different companies across time
    console.log("2️⃣  CHECKING FOR COMPANY REASSIGNMENTS:\n");
    
    if (providersResult.rows.length === 1) {
      console.log("   ✅ Only one Test Provider account exists\n");
      const provider = providersResult.rows[0];
      
      // Check for audit logs showing company changes
      const auditResult = await client.query(`
        SELECT action, meta, created_at FROM audit_logs
        WHERE target_id = $1 AND action ILIKE '%company%'
        ORDER BY created_at DESC
        LIMIT 5
      `, [provider.id]);
      
      if (auditResult.rows.length > 0) {
        console.log(`   ⚠️  Found ${auditResult.rows.length} company-related changes:\n`);
        auditResult.rows.forEach((log, i) => {
          console.log(`      ${i + 1}. ${log.action}`);
          console.log(`         Meta: ${JSON.stringify(log.meta)}`);
          console.log(`         Time: ${new Date(log.created_at).toLocaleString()}\n`);
        });
      }
    } else {
      console.log("   ⚠️  Multiple Test Provider accounts found!\n");
      console.log(`   This is likely the issue. Each account can have a different company:\n`);
      
      providersResult.rows.forEach((p, i) => {
        console.log(`      Account ${i + 1}: ${p.email} → Company: ${p.company || "None"}`);
      });
      console.log();
    }

    // 3. Check companies associated with Test Provider
    console.log("3️⃣  CHECKING ASSOCIATED COMPANIES:\n");
    
    const companyIds = new Set(providersResult.rows.map(p => p.company).filter(Boolean));
    
    if (companyIds.size === 0) {
      console.log("   ❌ No companies assigned\n");
    } else if (companyIds.size === 1) {
      console.log("   ✅ Only one company assigned\n");
      const companyId = Array.from(companyIds)[0];
      const compResult = await client.query(`
        SELECT id, name, provider_id, is_active FROM companies WHERE id = $1
      `, [companyId]);
      
      if (compResult.rows.length > 0) {
        const company = compResult.rows[0];
        console.log(`   Company: ${company.name}`);
        console.log(`   ID: ${company.id}`);
        console.log(`   Active: ${company.is_active ? "✅" : "⏳ Pending"}\n`);
      }
    } else {
      console.log(`   ⚠️  Multiple companies assigned (${companyIds.size}):\n`);
      
      for (const companyId of companyIds) {
        const compResult = await client.query(`
          SELECT id, name, is_active FROM companies WHERE id = $1
        `, [companyId]);
        
        if (compResult.rows.length > 0) {
          const company = compResult.rows[0];
          console.log(`   • ${company.name} (ID: ${company.id})`);
          console.log(`     Status: ${company.is_active ? "✅ Active" : "⏳ Pending"}\n`);
        }
      }
    }

    // 4. Check provider requests
    console.log("4️⃣  CHECKING PROVIDER REQUESTS:\n");
    
    const requestResult = await client.query(`
      SELECT id, email, name, company, status, created_at
      FROM provider_requests
      WHERE email ILIKE '%testprovider%'
      ORDER BY created_at DESC
    `);

    if (requestResult.rows.length > 0) {
      console.log(`   Found ${requestResult.rows.length} provider request(s):\n`);
      requestResult.rows.forEach((req, i) => {
        console.log(`   ${i + 1}. ${req.email}`);
        console.log(`      Company: ${req.company || "None"}`);
        console.log(`      Status: ${req.status || "unknown"}`);
        console.log(`      Created: ${new Date(req.created_at).toLocaleString()}\n`);
      });
    } else {
      console.log("   ℹ️  No provider requests found\n");
    }

    // 5. Recommendations
    console.log("5️⃣  RECOMMENDATIONS:\n");
    
    if (providersResult.rows.length > 1) {
      console.log("   ⚠️  ISSUE FOUND: Multiple Test Provider accounts exist\n");
      console.log("   SOLUTION: Delete duplicate accounts and keep only one\n");
      console.log("   Script to fix:\n");
      providersResult.rows.slice(1).forEach((p, i) => {
        console.log(`      DELETE FROM users WHERE id = '${p.id}';`);
      });
      console.log();
    } else if (companyIds.size > 1) {
      console.log("   ⚠️  ISSUE FOUND: One provider assigned to multiple companies\n");
      console.log("   SOLUTION: Ensure users.company field has only one company\n");
      console.log(`   Current company: ${providersResult.rows[0].company || "None"}\n`);
    } else {
      console.log("   ✅ No obvious issues found\n");
      console.log("   Possible causes:\n");
      console.log("   • Browser cache storing old company info\n");
      console.log("   • Multiple Test Provider accounts created at different times\n");
      console.log("   • Admin reassigning provider between companies\n");
    }

  } catch (error) {
    console.error("❌ Error:", error.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

diagnoseIssue();
