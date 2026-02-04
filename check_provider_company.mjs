import "dotenv/config";
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const main = async () => {
  try {
    const violatorId = 'e6812ee5-aa68-4968-8e7d-33c38fc5832c';
    
    const result = await pool.query(
      `SELECT id, email, name, company FROM users WHERE id = $1`,
      [violatorId]
    );
    
    if (result.rows.length === 0) {
      console.log("Provider not found");
      process.exit(0);
    }
    
    const user = result.rows[0];
    
    if (user.company) {
      // Get company details
      const companyResult = await pool.query(
        `SELECT id, name FROM companies WHERE id = $1`,
        [user.company]
      );
      
      if (companyResult.rows.length > 0) {
        const company = companyResult.rows[0];
        console.log(`✅ Yes, Test Provider is assigned to: "${company.name}"`);
        console.log(`   Company ID: ${company.id}`);
      }
    } else {
      console.log(`❌ No, Test Provider is NOT assigned to any company`);
    }
    
    process.exit(0);
  } catch (err) {
    console.error("Error:", err.message);
    process.exit(1);
  }
};

main();
