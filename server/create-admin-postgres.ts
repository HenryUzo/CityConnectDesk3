#!/usr/bin/env tsx
import { randomBytes, scrypt as _scrypt } from 'crypto';
import { promisify } from 'util';
const scrypt = promisify(_scrypt as unknown as (...args: any[]) => any);

// Ensure DATABASE_URL is set before importing storage/db
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://city:pass@127.0.0.1:5432/cityconnect';

import { Pool } from 'pg';

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex');
  const buf = (await scrypt(password, salt, 64)) as Buffer;
  return `${buf.toString('hex')}.${salt}`;
}

async function run() {
  try {
    const email = process.env.ADMIN_EMAIL || 'pgadmin@cityconnect.com';
    const password = process.env.ADMIN_PASSWORD || 'PgAdmin123!';
    const name = process.env.ADMIN_NAME || 'Postgres Admin';
    // derive first & last from provided name
    const nameParts = (name || '').trim().split(/\s+/);
    const firstName = nameParts[0] || '';
    const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '';
    const phone = process.env.ADMIN_PHONE || '+10000000000';

    // Use a fresh pg Pool to avoid importing drizzle/db which may reference schema columns
    const pgPool = new Pool({ connectionString: process.env.DATABASE_URL });
    const existingRes = await pgPool.query('SELECT id, global_role FROM users WHERE email = $1', [email]);
    if (existingRes.rows.length) {
      const existing = existingRes.rows[0];
      if (existing.global_role !== 'super_admin') {
        await pgPool.query('UPDATE users SET global_role = $1 WHERE id = $2', ['super_admin', existing.id]);
        console.log('Promoted existing admin to super_admin:', email);
      } else {
        console.log('Admin already exists:', email);
      }
      await pgPool.end();
      return;
    }

    const hashed = await hashPassword(password);

    const res = await pgPool.query(
      `INSERT INTO users (name, first_name, last_name, email, phone, password, role, global_role, is_approved, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW()) RETURNING id`,
      [name, firstName, lastName, email, phone, hashed, 'admin', 'super_admin', true]
    );

    const userId = res.rows?.[0]?.id;
    await pgPool.end();
    console.log('Created Postgres admin:');
    console.log('  email:', email);
    console.log('  password:', password);
    console.log('  id:', userId);
  } catch (err: any) {
    console.error('Failed to create admin:', err?.message || err);
    process.exit(1);
  }
}

run();
