import pg from "pg";
import { config } from "dotenv";
import { randomBytes, scrypt } from "crypto";
import { promisify } from "util";

const scryptAsync = promisify(scrypt);

config({ path: ".env.local" });
config();

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const buf = await scryptAsync(password, salt, 64);
  return `${buf.toString("hex")}.${salt}`;
}

async function createTestResident() {
  try {
    console.log("\n=== Creating Test Resident Account ===\n");
    
    // Check if user already exists
    const existingUser = await pool.query(`
      SELECT id, email, role FROM users WHERE email = 'testresident@gmail.com'
    `);
    
    if (existingUser.rows.length > 0) {
      console.log("✓ Test resident already exists:");
      console.log(`  ID: ${existingUser.rows[0].id}`);
      console.log(`  Email: ${existingUser.rows[0].email}`);
      console.log(`  Role: ${existingUser.rows[0].role}`);
      
      // Update password to ensure it's correct
      const hashedPassword = await hashPassword("password123");
      
      await pool.query(`
        UPDATE users 
        SET password = $1, is_approved = true
        WHERE email = 'testresident@gmail.com'
      `, [hashedPassword]);
      
      console.log("\n✓ Password updated to: password123");
      console.log("✓ Status set to: approved\n");
      return;
    }
    
    // Create new user
    const hashedPassword = await hashPassword("password123");
    
    const result = await pool.query(`
      INSERT INTO users (
        email, 
        password, 
        first_name, 
        last_name, 
        name,
        phone, 
        role, 
        is_approved,
        created_at
      ) VALUES (
        'testresident@gmail.com',
        $1,
        'Test',
        'Resident',
        'Test Resident',
        '1234567890',
        'resident',
        true,
        NOW()
      )
      RETURNING id, email, role
    `, [hashedPassword]);
    
    console.log("✓ Test resident created successfully:");
    console.log(`  ID: ${result.rows[0].id}`);
    console.log(`  Email: ${result.rows[0].email}`);
    console.log(`  Password: password123`);
    console.log(`  Role: ${result.rows[0].role}\n`);
    
  } catch (error) {
    console.error("❌ Error:", error.message);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

createTestResident();
