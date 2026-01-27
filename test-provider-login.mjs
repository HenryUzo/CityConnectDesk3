#!/usr/bin/env node
/**
 * Test provider login to see what's returned
 */

import "dotenv/config";

const API_URL = "http://localhost:5000";

async function testProviderLogin() {
  try {
    console.log("🧪 Testing provider login...\n");

    // Use the credentials provided by user
    const email = "shikongrebecca@gmail.com";
    const password = "1234567890";

    console.log(`📝 Credentials:`);
    console.log(`   Email: ${email}`);
    console.log(`   Password: ${password}`);
    console.log();

    const response = await fetch(`${API_URL}/api/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        username: email,
        password: password,
      }),
      credentials: "include",
    });

    const data = await response.json();

    console.log(`📊 Login Response Status: ${response.status}\n`);
    console.log(`📋 User Object Returned:`);
    console.log(JSON.stringify(data, null, 2));

    if (data.role) {
      console.log(`\n✓ User has 'role' field: ${data.role}`);
    } else {
      console.log(`\n❌ User is missing 'role' field!`);
      console.log(`   This would cause the redirect to fail.`);
    }

    if (data.isApproved !== undefined) {
      console.log(`✓ User has 'isApproved' field: ${data.isApproved}`);
    } else {
      console.log(`❌ User is missing 'isApproved' field!`);
    }

  } catch (error) {
    console.error("❌ Error:", error.message);
  }
}

testProviderLogin();
