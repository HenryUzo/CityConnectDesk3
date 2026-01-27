import fetch from "node-fetch";

async function testOrdersEndpoints() {
  try {
    console.log("🔐 Logging in...");
    const loginRes = await fetch("http://localhost:5000/api/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: "testuser@example.com",
        password: "TestPass123!",
      }),
    });

    console.log("Login status:", loginRes.status);

    // Extract cookies from login response
    const setCookieHeaders = loginRes.headers.raw()["set-cookie"] || [];
    console.log("Set-Cookie headers count:", setCookieHeaders.length);

    // Get the session cookie
    const sessionCookie = setCookieHeaders
      .find((c) => c.includes("connect.sid"))
      ?.split(";")[0];

    console.log("Session cookie found:", !!sessionCookie);

    if (!sessionCookie) {
      console.error("❌ No session cookie received");
      return;
    }

    // Test GET /api/admin/orders
    console.log("\n📊 Testing GET /api/admin/orders...");
    const ordersRes = await fetch(
      "http://localhost:5000/api/admin/orders?page=1&limit=20",
      {
        headers: {
          Cookie: sessionCookie,
        },
      }
    );

    console.log("Status:", ordersRes.status);
    const ordersData = await ordersRes.json();
    console.log("Response:", JSON.stringify(ordersData, null, 2));

    // Test GET /api/admin/orders/analytics/stats
    console.log("\n📊 Testing GET /api/admin/orders/analytics/stats...");
    const statsRes = await fetch(
      "http://localhost:5000/api/admin/orders/analytics/stats",
      {
        headers: {
          Cookie: sessionCookie,
        },
      }
    );

    console.log("Status:", statsRes.status);
    const statsData = await statsRes.json();
    console.log("Response:", JSON.stringify(statsData, null, 2));

    console.log("\n✅ All tests completed!");
  } catch (error) {
    console.error("Error:", error.message);
  }
}

testOrdersEndpoints();
