import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: resolve(__dirname, '.env') });
dotenv.config({ path: resolve(__dirname, '.env.local') });

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}

const pool = new Pool({ connectionString });

async function fixUsersTable() {
  const client = await pool.connect();
  try {
    console.log('Verifying users table schema...');

    // 1. Create user_role enum if it doesn't exist
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
          CREATE TYPE user_role AS ENUM (
            'resident', 'provider', 'admin', 'super_admin', 'estate_admin', 'moderator'
          );
        END IF;
      END
      $$;
    `);
    console.log('✓ user_role enum verified');

    // 2. Add global_role column to users table
    await client.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS global_role user_role;
    `);
    console.log('✓ global_role column verified');

    // 3. Add other common missing columns just in case
    const columns = [
      ['role', 'user_role', "'resident'"],
      ['is_active', 'boolean', 'true'],
      ['is_approved', 'boolean', 'true']
    ];

    for (const [name, type, def] of columns) {
      await client.query(`
        ALTER TABLE users
        ADD COLUMN IF NOT EXISTS ${name} ${type} DEFAULT ${def};
      `);
      console.log(`✓ ${name} column verified`);
    }

    console.log('\n✅ users table schema is up to date!');
  } catch (error) {
    console.error('❌ Error fixing users table:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

fixUsersTable();
