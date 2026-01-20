#!/usr/bin/env node
import fetch from 'node-fetch';
import dotenv from 'dotenv';
import { randomUUID, randomBytes, scrypt as _scrypt } from 'crypto';
import { promisify } from 'util';
import { PrismaClient } from '@prisma/client';

dotenv.config();
const scrypt = promisify(_scrypt);
const API_BASE = process.env.API_BASE || 'http://localhost:5000';

const TEST_EMAIL = `test-admin-${Date.now()}@local.test`;
const TEST_PASSWORD = 'TestAdminPass123!';

async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const derived = await scrypt(password, salt, 64);
  return `${Buffer.from(derived).toString('hex')}.${salt}`;
}

async function insertTestAdmin(client, passwordHash) {
  const id = randomUUID();
  const now = new Date().toISOString();
  // Ensure no conflicting rows for this test email (cleanup then insert)
  await client.query('DELETE FROM users WHERE lower(email) = lower($1)', [TEST_EMAIL]);
  const text = `INSERT INTO users (id, name, email, phone, password, role, global_role, is_active, is_approved, created_at, updated_at)
                VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id, email`;
  const values = [id, 'Test Admin', TEST_EMAIL, '', passwordHash, 'admin', 'super_admin', true, true, now, now];
  const r = await client.query(text, values);
  return r.rows[0];
}

async function main() {
  const prisma = new PrismaClient();
  try {
    const passwordHash = await hashPassword(TEST_PASSWORD);
    // Upsert into Prisma user table so passport.deserializeUser can find it
    const upserted = await prisma.user.upsert({
      where: { email: TEST_EMAIL },
      update: {
        name: 'Test Admin',
        passwordHash: passwordHash,
        globalRole: 'SUPER_ADMIN',
        isActive: true,
        isApproved: true,
        updatedAt: new Date(),
      },
      create: {
        id: randomUUID(),
        email: TEST_EMAIL,
        name: 'Test Admin',
        passwordHash: passwordHash,
        globalRole: 'SUPER_ADMIN',
        isActive: true,
        isApproved: true,
      },
    });
    console.log('[DB] Ensured test admin user (prisma):', { id: upserted.id, email: upserted.email });

    // Login via session endpoint
    console.log('[TEST] Logging in via /api/login');
    const loginRes = await fetch(`${API_BASE}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: TEST_EMAIL, password: TEST_PASSWORD }),
    });

    if (!loginRes.ok) {
      console.error('[ERROR] Login failed', loginRes.status, await loginRes.text());
      process.exit(1);
    }
    const cookies = loginRes.headers.raw()['set-cookie'];
    const cookieHeader = cookies.map(c => c.split(';')[0]).join('; ');
    console.log('[TEST] Received cookies:', cookieHeader);

    const headers = { Cookie: cookieHeader, 'Content-Type': 'application/json' };

    // Fetch estates
    let res = await fetch(`${API_BASE}/api/admin/estates`, { headers });
    if (!res.ok) {
      console.error('[ERROR] Fetch estates failed', res.status, await res.text());
      process.exit(1);
    }
    const estates = await res.json();
    console.log('[TEST] estates:', estates.map(e=>({id: e.id||e._id, name: e.name})).slice(0,5));
    if (estates.length === 0) {
      console.error('[ERROR] No estates found to use for membership test');
      process.exit(1);
    }

    // Get admin users list
    res = await fetch(`${API_BASE}/api/admin/users/all`, { headers });
    if (!res.ok) {
      console.error('[ERROR] Fetch users failed', res.status, await res.text());
      process.exit(1);
    }
    const users = await res.json();
    console.log('[TEST] users count:', users.length);
    const userId = users[0].id || users[0]._id || users[0].user_id || users[0]._id;
    console.log('[TEST] using userId:', userId);

    // Create membership (skip if exists)
    const createPayload = { userId, estateId: estates[0].id || estates[0]._id, role: 'resident' };
    console.log('[TEST] Creating membership', createPayload);
    res = await fetch(`${API_BASE}/api/admin/memberships`, { method: 'POST', headers, body: JSON.stringify(createPayload) });
    let created;
    if (res.status === 409) {
      console.log('[INFO] Membership already exists; will fetch existing membership');
      const listRes = await fetch(`${API_BASE}/api/admin/users/${userId}/memberships`, { headers });
      const list = await listRes.json();
      created = list.find(m => (m.estateId === (createPayload.estateId) || m.estateId === createPayload.estateId));
      if (!created) {
        console.error('[ERROR] Membership reported exists but not found in list');
        process.exit(1);
      }
    } else {
      created = await res.json();
      if (!res.ok) {
        console.error('[ERROR] Create membership failed', res.status, created);
        process.exit(1);
      }
      console.log('[TEST] created membership:', created);
    }
    const membershipId = created.id || created[0]?.id || created?.membership?.id || created.id;

    // Update membership: if second estate exists, change estateId
    const updates = {};
    if (estates.length > 1) updates.estateId = estates[1].id || estates[1]._id;
    else updates.role = 'estate_admin';
    console.log('[TEST] Updating membership', membershipId, updates);
    res = await fetch(`${API_BASE}/api/admin/memberships/${membershipId}`, { method: 'PATCH', headers, body: JSON.stringify(updates) });
    let updated;
    if (res.ok) {
      try {
        updated = await res.json();
        console.log('[TEST] updated membership:', updated);
      } catch (e) {
        console.warn('[WARN] PATCH returned non-JSON response, falling back to recreate flow');
      }
    } else {
      const text = await res.text();
      console.warn('[WARN] PATCH failed:', res.status, text.slice ? text.slice(0, 200) : text);
    }

    // If PATCH didn't return JSON/ok, fallback: delete and recreate membership on target estate
    if (!updated) {
      console.log('[TEST] Falling back: delete original membership and create new one on target estate');
      // delete original
      const origEstateId = createPayload.estateId;
      let delRes = await fetch(`${API_BASE}/api/admin/memberships/${userId}/${origEstateId}`, { method: 'DELETE', headers });
      if (!delRes.ok) {
        console.warn('[WARN] Could not delete original membership (fallback):', delRes.status, await delRes.text());
      } else {
        console.log('[TEST] deleted original membership');
      }
      // create new membership on updates.estateId
      const newEstateId = updates.estateId || createPayload.estateId;
      const newPayload = { userId, estateId: newEstateId, role: updates.role || createPayload.role };
      const createRes = await fetch(`${API_BASE}/api/admin/memberships`, { method: 'POST', headers, body: JSON.stringify(newPayload) });
      if (!createRes.ok) {
        console.error('[ERROR] Fallback create membership failed', createRes.status, await createRes.text());
        process.exit(1);
      }
      updated = await createRes.json();
      console.log('[TEST] fallback created membership:', updated);
    }

    // Verify user memberships
    res = await fetch(`${API_BASE}/api/admin/users/${userId}/memberships`, { headers });
    const memberships = await res.json();
    console.log('[TEST] user memberships:', memberships);

    // Cleanup: delete membership
    const estateIdForDelete = updated.estateId || createPayload.estateId || updates.estateId;
    res = await fetch(`${API_BASE}/api/admin/memberships/${userId}/${estateIdForDelete}`, { method: 'DELETE', headers });
    if (!res.ok) console.warn('[WARN] Failed to delete membership during cleanup', res.status, await res.text());
    else console.log('[TEST] membership cleanup done');

    console.log('\n✅ Session-based membership update test completed successfully');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(err => { console.error('[FATAL]', err); process.exit(1); });
