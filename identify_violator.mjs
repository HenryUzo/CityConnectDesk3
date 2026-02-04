import "dotenv/config";
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const main = async () => {
  try {
    // Find the violating provider
    const violatorId = 'e6812ee5-aa68-4968-8e7d-33c38fc5832c';
    
    const userResult = await pool.query(
      `SELECT id, email, name, company, role FROM users WHERE id = $1`,
      [violatorId]
    );
    
    if (userResult.rows.length === 0) {
      console.log("❌ Provider not found");
      process.exit(1);
    }
    
    const user = userResult.rows[0];
    console.log("\n📋 VIOLATING PROVIDER:");
    console.log(`  ID: ${user.id}`);
    console.log(`  Email: ${user.email}`);
    console.log(`  Name: ${user.name}`);
    console.log(`  Assigned Company: ${user.company}`);
    
    // Get the assigned company details
    const assignedCompanyResult = await pool.query(
      `SELECT id, name, provider_id FROM companies WHERE id = $1`,
      [user.company]
    );
    
    if (assignedCompanyResult.rows.length > 0) {
      const assignedCo = assignedCompanyResult.rows[0];
      console.log(`\n  📌 Assigned Company: "${assignedCo.name}" (${assignedCo.id})`);
      console.log(`     Provider ID: ${assignedCo.provider_id || 'NOT OWNED'}`);
    }
    
    // Get all owned companies
    const ownedResult = await pool.query(
      `SELECT id, name FROM companies WHERE provider_id = $1`,
      [violatorId]
    );
    
    console.log(`\n  🏢 Owned Companies (${ownedResult.rows.length}):`);
    ownedResult.rows.forEach(co => {
      console.log(`     - "${co.name}" (${co.id})`);
    });
    
    // Get all store memberships
    const storeResult = await pool.query(
      `SELECT DISTINCT s.id, s.name, s.company_id, c.name as company_name
       FROM store_members sm
       JOIN stores s ON s.id = sm.store_id
       LEFT JOIN companies c ON c.id = s.company_id
       WHERE sm.user_id = $1 AND sm.is_active = true`,
      [violatorId]
    );
    
    console.log(`\n  🏪 Active Store Memberships (${storeResult.rows.length}):`);
    storeResult.rows.forEach(store => {
      console.log(`     - Store: "${store.name}" in Company: "${store.company_name || 'UNKNOWN'}" (${store.company_id || 'null'})`);
    });
    
    console.log("\n✅ Cleanup options:");
    console.log("1. Update users.company to match owned company");
    console.log("2. Transfer company ownership to another user");
    console.log("3. Remove store memberships from other companies");
    
    process.exit(0);
  } catch (err) {
    console.error("❌ Error:", err.message);
    process.exit(1);
  }
};

main();
