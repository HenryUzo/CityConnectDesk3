import { db } from "./server/db.js";
import { users } from "./shared/schema.js";
import { eq } from "drizzle-orm";

async function checkTestResident() {
  try {
    const testUser = await db
      .select()
      .from(users)
      .where(eq(users.email, "testresident@gmail.com"))
      .limit(1);

    if (testUser.length > 0) {
      console.log("✓ Test resident found:");
      console.log(JSON.stringify(testUser[0], null, 2));
    } else {
      console.log("✗ Test resident NOT found");
      console.log("Creating test resident...");
      
      // Note: You'll need to create this account through the registration flow
      // or manually insert with proper password hashing
      console.log("\nTo create test resident:");
      console.log("1. Go to http://localhost:5000/auth");
      console.log("2. Click 'Register' tab");
      console.log("3. Fill in:");
      console.log("   Email: testresident@gmail.com");
      console.log("   Password: password123");
      console.log("   Name: Test Resident");
    }
  } catch (error) {
    console.error("Error checking test resident:", error);
  } finally {
    process.exit(0);
  }
}

checkTestResident();
