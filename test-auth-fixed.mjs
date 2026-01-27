import fetch from 'node-fetch';

const BASE_URL = 'http://127.0.0.1:5000';

async function testAuthFlow() {
  console.log('🔑 Testing Authentication Flow\n');

  // Test 1: Login
  console.log('1️⃣ Attempting login...');
  const loginRes = await fetch(`${BASE_URL}/api/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: 'testuser@example.com',
      password: 'TestPass123!'
    })
  });

  console.log(`Login status: ${loginRes.status}`);
  const loginData = await loginRes.json();
  console.log(`Login user: ${loginData.email}`);
  const cookies = loginRes.headers.get('set-cookie');
  console.log(`Set-Cookie header: ${cookies ? cookies.substring(0, 80) : 'None'}`);

  // Test 2: Call admin endpoint with session
  console.log('\n2️⃣ Testing /api/admin/estates with session...');
  const estatesRes = await fetch(`${BASE_URL}/api/admin/estates`);
  console.log(`Status: ${estatesRes.status}`);
  const estatesData = await estatesRes.json();
  console.log(`Response (first 200 chars): ${JSON.stringify(estatesData).substring(0, 200)}`);

  // Test 3: Other admin endpoints
  console.log('\n3️⃣ Testing other admin endpoints...');
  const endpoints = [
    '/api/admin/users/all',
    '/api/admin/categories',
    '/api/admin/ai/conversations',
    '/api/admin/pricing-rules',
    '/api/admin/orders'
  ];

  for (const endpoint of endpoints) {
    const res = await fetch(`${BASE_URL}${endpoint}`);
    console.log(`${endpoint}: ${res.status}`);
  }

  console.log('\n✅ All tests complete!');
}

testAuthFlow().catch(console.error);
