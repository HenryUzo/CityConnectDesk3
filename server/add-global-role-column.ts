#!/usr/bin/env tsx
import { Pool } from 'pg';

const cs = process.env.DATABASE_URL || 'postgresql://postgres:MyHoneyPie@localhost:5432/cityconnectdesk';

async function run() {
  const pool = new Pool({ connectionString: cs });
  try {
    console.log('[migrate] Using', cs.replace(/:\/\/([^:]+):[^@]+@/, '://$1:****@'));
    await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS global_role text");
    console.log('[migrate] Added column `global_role` (if it did not exist)');
  } catch (err: any) {
    console.error('[migrate] failed:', err?.message || err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

run();
