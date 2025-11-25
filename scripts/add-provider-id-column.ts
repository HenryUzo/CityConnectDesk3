import { config } from 'dotenv';
import { Client } from 'pg';
import { readFileSync } from 'fs';
import { join } from 'path';

config({ path: '.env.local' });

async function runMigration() {
  const client = new Client(process.env.DATABASE_URL);
  
  try {
    await client.connect();
    console.log('Connected to database');
    
    const sql = readFileSync(join(process.cwd(), 'migrations', '0001_add_provider_id.sql'), 'utf-8');
    
    await client.query(sql);
    console.log('✓ Migration completed: provider_id column added to provider_requests table');
    
  } catch (error) {
    console.error('Migration failed:', error.message);
    throw error;
  } finally {
    await client.end();
  }
}

runMigration().catch(console.error);
