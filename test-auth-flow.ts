import http from "http";

/**
 * Test login endpoint and verify authentication flow
 * This script makes actual HTTP requests to the running server
 */

const BASE_URL = "http://127.0.0.1:5000";

interface TestResult {
  name: string;
  status: "pass" | "fail";
  message: string;
  details?: any;
}

const results: TestResult[] = [];

async function makeRequest(
  method: string,
  path: string,
  body?: any,
  cookies?: string
): Promise<{ status: number; body: any; headers: any }> {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options = {
      hostname: url.hostname,
      port: url.port || 5000,
      path: url.pathname + url.search,
      method,
      headers: {
        "Content-Type": "application/json",
        ...(cookies && { Cookie: cookies }),
      },
    };

    const req = http.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => {
        data += chunk;
      });
      res.on("end", () => {
        try {
          resolve({
            status: res.statusCode || 500,
            body: data ? JSON.parse(data) : null,
            headers: res.headers,
          });
        } catch (e) {
          resolve({
            status: res.statusCode || 500,
            body: data,
            headers: res.headers,
          });
        }
      });
    });

    req.on("error", reject);

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function runTests() {
  console.log("🔧 Authentication Flow Tests");
  console.log("============================\n");

  try {
    // Test 1: Login with correct credentials
    console.log("Test 1: Attempting login with testuser@example.com...");
    const loginRes = await makeRequest("POST", "/api/login", {
      username: "testuser@example.com",
      password: "TestPass123!",
    });

    if (loginRes.status === 200) {
      const sessionCookie = loginRes.headers["set-cookie"]?.[0];
      if (sessionCookie) {
        results.push({
          name: "Login request",
          status: "pass",
          message: "✅ Login successful with correct credentials",
          details: {
            statusCode: loginRes.status,
            user: loginRes.body,
            hasSessionCookie: !!sessionCookie,
          },
        });

        // Test 2: Verify session persistence - check if user endpoint returns authenticated user
        console.log("Test 2: Verifying session persistence with /api/user...");
        const userRes = await makeRequest("GET", "/api/user", undefined, sessionCookie);

        if (userRes.status === 200 && userRes.body?.id) {
          results.push({
            name: "Session persistence",
            status: "pass",
            message: "✅ Session persisted - /api/user returns authenticated user",
            details: {
              userId: userRes.body.id,
              email: userRes.body.email,
              globalRole: userRes.body.globalRole || userRes.body.role,
            },
          });

          // Test 3: Verify admin access - check if categories endpoint is accessible
          console.log("Test 3: Checking admin endpoint access (/api/admin/categories)...");
          const adminRes = await makeRequest(
            "GET",
            "/api/admin/categories",
            undefined,
            sessionCookie
          );

          if (adminRes.status === 200 || adminRes.status === 400) {
            // 400 might be expected if there's validation, but not 401
            results.push({
              name: "Admin access",
              status: "pass",
              message: `✅ Admin endpoint accessible (${adminRes.status === 200 ? "returned data" : "not 401"})`,
              details: { statusCode: adminRes.status },
            });
          } else if (adminRes.status === 401) {
            results.push({
              name: "Admin access",
              status: "fail",
              message: "❌ Admin endpoint returned 401 - user not authorized",
              details: { statusCode: adminRes.status, body: adminRes.body },
            });
          } else {
            results.push({
              name: "Admin access",
              status: "fail",
              message: `❌ Unexpected status code: ${adminRes.status}`,
              details: { statusCode: adminRes.status },
            });
          }
        } else {
          results.push({
            name: "Session persistence",
            status: "fail",
            message: "❌ Session not persisted - /api/user returned 401",
            details: { statusCode: userRes.status },
          });
        }
      } else {
        results.push({
          name: "Login request",
          status: "fail",
          message: "❌ Login succeeded but no session cookie was set",
          details: { statusCode: loginRes.status, headers: loginRes.headers },
        });
      }
    } else if (loginRes.status === 401) {
      results.push({
        name: "Login request",
        status: "fail",
        message:
          "❌ Login failed with 401 - Password may not match or user not found",
        details: {
          statusCode: loginRes.status,
          body: loginRes.body,
          testCredentials:
            "email: testuser@example.com, password: TestPass123!",
        },
      });
    } else {
      results.push({
        name: "Login request",
        status: "fail",
        message: `❌ Unexpected status code: ${loginRes.status}`,
        details: { statusCode: loginRes.status, body: loginRes.body },
      });
    }

    // Test 4: Wrong password should fail
    console.log("Test 4: Testing login with wrong password...");
    const wrongPwdRes = await makeRequest("POST", "/api/login", {
      username: "testuser@example.com",
      password: "WrongPassword123!",
    });

    if (wrongPwdRes.status === 401) {
      results.push({
        name: "Wrong password rejection",
        status: "pass",
        message: "✅ Login correctly rejected with wrong password",
        details: { statusCode: wrongPwdRes.status },
      });
    } else {
      results.push({
        name: "Wrong password rejection",
        status: "fail",
        message: `❌ Wrong password should return 401, got ${wrongPwdRes.status}`,
        details: { statusCode: wrongPwdRes.status },
      });
    }
  } catch (error) {
    results.push({
      name: "Test execution",
      status: "fail",
      message: `❌ Error during tests: ${(error as any).message}`,
      details: { error },
    });
  }

  // Print results
  console.log("\n📊 Test Results");
  console.log("================\n");

  let passed = 0;
  let failed = 0;

  results.forEach((result) => {
    const icon = result.status === "pass" ? "✅" : "❌";
    console.log(`${icon} ${result.name}`);
    console.log(`   ${result.message}`);
    if (result.details) {
      console.log(`   Details:`, JSON.stringify(result.details, null, 2));
    }
    console.log();

    if (result.status === "pass") {
      passed++;
    } else {
      failed++;
    }
  });

  console.log("============================");
  console.log(`Passed: ${passed}/${results.length}`);
  console.log(`Failed: ${failed}/${results.length}`);

  if (failed === 0) {
    console.log("\n🎉 All tests passed! Authentication flow is working correctly.");
  } else {
    console.log(
      "\n⚠️  Some tests failed. See details above for troubleshooting."
    );
  }
}

// Give server a moment to start
setTimeout(runTests, 1000);
