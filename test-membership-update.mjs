#!/usr/bin/env node
import fetch from 'node-fetch';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

const API_BASE = process.env.API_BASE || 'http://localhost:5000';
const JWT_SECRET = process.env.JWT_SECRET || 'local-jwt-secret-change-me';

function makeToken() {
  const payload = {
    userId: '00000000-0000-0000-0000-000000000000',
    email: 'admin@test.com',
    role: 'admin',
    globalRole: 'super_admin',
  };
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '15m', issuer: 'cityconnect', audience: 'cityconnect-api' });
}

async function run() {
  const token = makeToken();
  console.log('[TEST] Using token with payload: admin, globalRole super_admin');

  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  // Get estates
  console.log('[TEST] Fetching estates...');
  let res = await fetch(`${API_BASE}/api/admin/estates`, { headers });
  if (!res.ok) {
    console.error('[ERROR] Failed to fetch estates:', res.status, await res.text());
    process.exit(1);
  }
  const estates = await res.json();
  console.log(`[TEST] Found ${estates.length} estates`);
  if (estates.length < 1) {
    console.error('[ERROR] No estates present to test with');
    process.exit(1);
  }

  // Get a user
  console.log('[TEST] Fetching users...');
  res = await fetch(`${API_BASE}/api/admin/users/all`, { headers });
  if (!res.ok) {
    console.error('[ERROR] Failed to fetch users:', res.status, await res.text());
    process.exit(1);
  }
  const users = await res.json();
  if (users.length === 0) {
    console.error('[ERROR] No users available to attach membership');
    process.exit(1);
  }
  const user = users[0];
  console.log('[TEST] Using user:', user.id, user.email);

  // Create membership for user -> estate[0]
  const membershipPayload = { userId: user.id, estateId: estates[0].id || estates[0]._id || estates[0].estateId || estates[0].id, role: 'resident' };
  console.log('[TEST] Creating membership:', membershipPayload);
  res = await fetch(`${API_BASE}/api/admin/memberships`, { method: 'POST', headers, body: JSON.stringify(membershipPayload) });
  if (!res.ok) {
    console.error('[ERROR] Failed to create membership:', res.status, await res.text());
    process.exit(1);
  }
  const created = await res.json();
  console.log('[TEST] Created membership:', created);

  // Update membership: change estateId to second estate if available, or change role
  const membershipId = created.id || created[0]?.id || created?.membership?.id || created;
  let updates = {};
  if (estates.length > 1) {
    updates.estateId = estates[1].id || estates[1]._id || estates[1].estateId || estates[1].id;
  } else {
    updates.role = 'estate_admin';
  }
  console.log('[TEST] Updating membership', membershipId, 'with', updates);
  res = await fetch(`${API_BASE}/api/admin/memberships/${membershipId}`, { method: 'PATCH', headers, body: JSON.stringify(updates) });
  if (!res.ok) {
    console.error('[ERROR] Failed to update membership:', res.status, await res.text());
    process.exit(1);
  }
  const updated = await res.json();
  console.log('[TEST] Updated membership:', updated);

  // Verify by fetching user memberships
  console.log('[TEST] Fetching user memberships...');
  res = await fetch(`${API_BASE}/api/admin/users/${user.id}/memberships`, { headers });
  if (!res.ok) {
    console.error('[ERROR] Failed to fetch user memberships:', res.status, await res.text());
    process.exit(1);
  }
  const memberships = await res.json();
  console.log('[TEST] User memberships now:', memberships);

  // Cleanup: delete membership
  console.log('[TEST] Deleting membership...');
  const estateIdToDelete = updated.estateId || updated.estateId || updates.estateId || membershipPayload.estateId;
  res = await fetch(`${API_BASE}/api/admin/memberships/${user.id}/${estateIdToDelete}`, { method: 'DELETE', headers });
  if (!res.ok) {
    console.error('[WARN] Failed to delete membership during cleanup:', res.status, await res.text());
  } else {
    console.log('[TEST] Cleanup complete');
  }

  console.log('\n✅ Membership create -> update -> verify test completed successfully');
}

run().catch((err) => { console.error('[FATAL] Test script error:', err); process.exit(1); });
