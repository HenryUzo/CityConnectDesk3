import "dotenv/config";
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const main = async () => {
  try {
    // Check for any existing company_conflict logs
    const result = await pool.query(
      `SELECT id, actor_id, action, target_id, meta, created_at 
       FROM audit_logs 
       WHERE action = 'company_conflict'
       ORDER BY created_at DESC LIMIT 20`
    );
    
    if (result.rows.length === 0) {
      console.log("✅ No company conflicts found in audit_logs");
    } else {
      console.log(`⚠️  Found ${result.rows.length} company conflicts:`);
      result.rows.forEach(log => {
        console.log(`  - User ${log.target_id}: ${JSON.stringify(log.meta)}`);
      });
    }
    
    // Count providers with multiple company assignments
    const providerCheck = await pool.query(
      `SELECT 
        COUNT(*) as total_providers,
        SUM(CASE WHEN users.company IS NOT NULL AND users.company <> '' THEN 1 ELSE 0 END) as with_assigned_company
       FROM users 
       WHERE role = 'provider'`
    );
    
    console.log(`\nProvider Summary:`);
    console.log(`  Total providers: ${providerCheck.rows[0].total_providers}`);
    console.log(`  Providers with assigned company: ${providerCheck.rows[0].with_assigned_company}`);
    
    process.exit(0);
  } catch (err) {
    console.error("Error:", err.message);
    process.exit(1);
  }
};

main();
