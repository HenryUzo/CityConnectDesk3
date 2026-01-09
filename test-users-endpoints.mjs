#!/usr/bin/env node

import fetch from 'node-fetch';

const API_BASE = 'http://localhost:5000';

// Admin credentials (from your test setup)
const ADMIN_EMAIL = 'admin@test.com';
const ADMIN_PASSWORD = 'AdminPassword123!';

async function getAuthToken() {
  console.log('[AUTH] Getting auth token...');
  
  const response = await fetch(`${API_BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
    }),
  });

  if (!response.ok) {
    console.error('[AUTH] Login failed:', response.status, await response.text());
    return null;
  }

  const data = await response.json();
  console.log('[AUTH] Token obtained:', data.token ? 'YES' : 'NO');
  return data.token;
}

async function testUsersEndpoints(token) {
  console.log('\n=== TESTING USERS ENDPOINTS ===\n');

  // Test 1: GET /api/admin/users/all
  console.log('[TEST 1] GET /api/admin/users/all (no filters)');
  try {
    const response = await fetch(`${API_BASE}/api/admin/users/all`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });

    if (!response.ok) {
      console.error(`  ❌ Failed: ${response.status} ${response.statusText}`);
      console.error('  Response:', await response.text());
      return;
    }

    const users = await response.json();
    console.log(`  ✅ Success: Got ${users.length} users`);
    if (users.length > 0) {
      console.log(`  Sample user:`, {
        id: users[0].id,
        name: users[0].name,
        email: users[0].email,
        globalRole: users[0].globalRole,
        isActive: users[0].isActive,
      });
    }
  } catch (error) {
    console.error(`  ❌ Error:`, error.message);
  }

  // Test 2: GET /api/admin/users/all with role filter
  console.log('\n[TEST 2] GET /api/admin/users/all (role=provider)');
  try {
    const response = await fetch(`${API_BASE}/api/admin/users/all?role=provider`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });

    if (!response.ok) {
      console.error(`  ❌ Failed: ${response.status} ${response.statusText}`);
      return;
    }

    const users = await response.json();
    console.log(`  ✅ Success: Got ${users.length} providers`);
  } catch (error) {
    console.error(`  ❌ Error:`, error.message);
  }

  // Test 3: GET /api/admin/users/all with search
  console.log('\n[TEST 3] GET /api/admin/users/all (search=admin)');
  try {
    const response = await fetch(`${API_BASE}/api/admin/users/all?search=admin`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });

    if (!response.ok) {
      console.error(`  ❌ Failed: ${response.status} ${response.statusText}`);
      return;
    }

    const users = await response.json();
    console.log(`  ✅ Success: Got ${users.length} results for "admin"`);
  } catch (error) {
    console.error(`  ❌ Error:`, error.message);
  }

  // Test 4: Get a sample user and then test memberships endpoint
  console.log('\n[TEST 4] Testing user memberships endpoint');
  try {
    const listResponse = await fetch(`${API_BASE}/api/admin/users/all`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });

    if (!listResponse.ok) {
      console.error(`  ❌ Failed to list users`);
      return;
    }

    const users = await listResponse.json();
    if (users.length === 0) {
      console.log('  ℹ️  No users to test memberships');
      return;
    }

    const userId = users[0].id || users[0]._id;
    console.log(`  Testing memberships for user: ${users[0].name} (${userId})`);

    const membershipResponse = await fetch(`${API_BASE}/api/admin/users/${userId}/memberships`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });

    if (!membershipResponse.ok) {
      console.error(`  ❌ Failed: ${membershipResponse.status} ${membershipResponse.statusText}`);
      console.error('  Response:', await membershipResponse.text());
      return;
    }

    const memberships = await membershipResponse.json();
    console.log(`  ✅ Success: User has ${memberships.length} memberships`);
    if (memberships.length > 0) {
      console.log(`  Sample membership:`, {
        estateId: memberships[0].estateId,
        role: memberships[0].role,
        status: memberships[0].status,
        isActive: memberships[0].isActive,
      });
    }
  } catch (error) {
    console.error(`  ❌ Error:`, error.message);
  }

  // Test 5: POST /api/admin/users (create a test user)
  console.log('\n[TEST 5] POST /api/admin/users (create test user)');
  const testUserEmail = `testuser${Date.now()}@test.com`;
  try {
    const response = await fetch(`${API_BASE}/api/admin/users`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'Test User',
        email: testUserEmail,
        phone: '1234567890',
        password: 'TestPassword123!',
        globalRole: 'resident',
        isActive: true,
        isApproved: true,
      }),
    });

    if (!response.ok) {
      console.error(`  ❌ Failed: ${response.status} ${response.statusText}`);
      console.error('  Response:', await response.text());
      return;
    }

    const user = await response.json();
    console.log(`  ✅ Success: Created user ${user.name} (${user.id})`);

    // Test 6: PATCH /api/admin/users/:id (update the user)
    console.log('\n[TEST 6] PATCH /api/admin/users/:id (update user)');
    const updateResponse = await fetch(`${API_BASE}/api/admin/users/${user.id}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'Updated Test User',
        isActive: false,
      }),
    });

    if (!updateResponse.ok) {
      console.error(`  ❌ Failed: ${updateResponse.status} ${updateResponse.statusText}`);
      console.error('  Response:', await updateResponse.text());
      return;
    }

    const updated = await updateResponse.json();
    console.log(`  ✅ Success: Updated user to ${updated.name}, isActive=${updated.isActive}`);

    // Test 7: DELETE /api/admin/users/:id (delete the user)
    console.log('\n[TEST 7] DELETE /api/admin/users/:id (delete user)');
    const deleteResponse = await fetch(`${API_BASE}/api/admin/users/${user.id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` },
    });

    if (!deleteResponse.ok) {
      console.error(`  ❌ Failed: ${deleteResponse.status} ${deleteResponse.statusText}`);
      console.error('  Response:', await deleteResponse.text());
      return;
    }

    const result = await deleteResponse.json();
    console.log(`  ✅ Success: User deleted`);
  } catch (error) {
    console.error(`  ❌ Error:`, error.message);
  }
}

async function main() {
  console.log('🧪 Testing Users Management Endpoints\n');
  
  const token = await getAuthToken();
  if (!token) {
    console.error('❌ Failed to get auth token. Exiting.');
    process.exit(1);
  }

  await testUsersEndpoints(token);

  console.log('\n✅ Test suite completed!\n');
}

main().catch(console.error);
