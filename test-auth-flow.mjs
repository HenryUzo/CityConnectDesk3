// Test login and session persistence
const API_URL = "http://127.0.0.1:5000";

async function testAuthFlow() {
  console.log("🔐 Testing authentication flow...\n");

  // Step 1: Login
  console.log("1️⃣  Attempting login...");
  const loginResponse = await fetch(`${API_URL}/api/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include", // Important: include cookies
    body: JSON.stringify({
      username: "testuser@example.com",
      password: "TestPass123!",
    }),
  });

  console.log(`   Login status: ${loginResponse.status}`);
  const loginData = await loginResponse.json();
  console.log(`   User: ${loginData?.email || "error"}\n`);

  if (!loginResponse.ok) {
    console.error("   ❌ Login failed:", loginData);
    return;
  }

  // Step 2: Check session with estates endpoint
  console.log("2️⃣  Testing /api/admin/estates with session...");
  const estatesResponse = await fetch(`${API_URL}/api/admin/estates`, {
    method: "GET",
    credentials: "include", // Important: include cookies
  });

  console.log(`   Status: ${estatesResponse.status}`);
  const estatesData = await estatesResponse.json();
  console.log(`   Response: ${JSON.stringify(estatesData).slice(0, 100)}\n`);

  // Step 3: Test other endpoints
  console.log("3️⃣  Testing other admin endpoints...");
  const endpoints = [
    "/api/admin/users/all",
    "/api/admin/categories",
    "/api/admin/ai/conversations",
  ];

  for (const endpoint of endpoints) {
    const response = await fetch(`${API_URL}${endpoint}`, {
      credentials: "include",
    });
    console.log(`   ${endpoint}: ${response.status}`);
  }
}

testAuthFlow().catch(console.error);
