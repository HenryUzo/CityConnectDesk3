// Test login and check for session cookie
const API_URL = "http://127.0.0.1:5000";

async function testSessionCookie() {
  console.log("🔐 Testing session cookie handling...\n");

  console.log("1️⃣  Logging in and checking Set-Cookie header...");
  const loginResponse = await fetch(`${API_URL}/api/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({
      username: "testuser@example.com",
      password: "TestPass123!",
    }),
  });

  console.log(`Login status: ${loginResponse.status}`);

  // Check for Set-Cookie header
  const setCookieHeaders = loginResponse.headers.raw?.()?.["set-cookie"] || [];
  console.log(`Set-Cookie headers: ${setCookieHeaders.length}`);
  if (setCookieHeaders.length > 0) {
    setCookieHeaders.forEach((cookie, i) => {
      console.log(`  ${i + 1}. ${cookie.split(";")[0]}`);
    });
  } else {
    console.log("  ❌ No Set-Cookie headers found!");
  }

  // Try to see what we can get
  console.log("\nResponse headers:");
  for (const [key, value] of loginResponse.headers) {
    if (key.toLowerCase().includes("cook") || key.toLowerCase().includes("auth")) {
      console.log(`  ${key}: ${String(value).slice(0, 50)}`);
    }
  }

  const loginData = await loginResponse.json();
  console.log(`\nLogin user: ${loginData?.email}`);
  console.log(`Login response keys: ${Object.keys(loginData).join(", ")}`);
}

testSessionCookie().catch(console.error);
