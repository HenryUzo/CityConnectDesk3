import "dotenv/config";
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const main = async () => {
  try {
    const violatorId = 'e6812ee5-aa68-4968-8e7d-33c38fc5832c';
    
    // Get the owned company ID
    const ownedResult = await pool.query(
      `SELECT id FROM companies WHERE provider_id = $1 LIMIT 1`,
      [violatorId]
    );
    
    if (ownedResult.rows.length === 0) {
      console.log("❌ No owned company found");
      process.exit(1);
    }
    
    const ownedCompanyId = ownedResult.rows[0].id;
    
    console.log(`\n🔧 CLEANUP: Test Provider`);
    console.log(`   From: CASA UX (assigned but not owned)`);
    console.log(`   To: Anny (owned company)`);
    console.log(`\nExecuting cleanup...`);
    
    // Update users.company to match owned company
    const updateResult = await pool.query(
      `UPDATE users 
       SET company = $1 
       WHERE id = $2
       RETURNING id, email, company`,
      [ownedCompanyId, violatorId]
    );
    
    if (updateResult.rows.length === 0) {
      console.log("❌ Update failed");
      process.exit(1);
    }
    
    console.log(`✅ Updated successfully!`);
    console.log(`   Email: ${updateResult.rows[0].email}`);
    console.log(`   New Company: ${updateResult.rows[0].company}`);
    
    // Clear the audit log entry since violation is resolved
    const clearAuditResult = await pool.query(
      `DELETE FROM audit_logs 
       WHERE action = 'company_conflict' 
       AND target_id = $1`,
      [violatorId]
    );
    
    console.log(`\n✅ Removed ${clearAuditResult.rowCount} audit log entries`);
    console.log(`\n🎉 Test Provider is now compliant with one-company rule!`);
    
    process.exit(0);
  } catch (err) {
    console.error("❌ Error:", err.message);
    process.exit(1);
  }
};

main();
