import { db } from "./server/db";
import { estates, transactions, auditLogs } from "@shared/schema";

async function diagnose() {
  console.log("🔍 Diagnosing database tables and columns...\n");

  try {
    // Test 1: Check if estates table exists
    console.log("1️⃣ Testing estates table...");
    const estatesCount = await db.select().from(estates).limit(1);
    console.log("   ✅ estates table exists");

    // Test 2: Check if transactions table exists
    console.log("2️⃣ Testing transactions table...");
    const txCount = await db.select().from(transactions).limit(1);
    console.log("   ✅ transactions table exists");

    // Test 3: Check if auditLogs table exists
    console.log("3️⃣ Testing auditLogs table...");
    const auditCount = await db.select().from(auditLogs).limit(1);
    console.log("   ✅ auditLogs table exists");

    // Test 4: Try aggregates (like in getUserStats)
    console.log("4️⃣ Testing aggregate queries...");
    const result = await db
      .select({ total: db.fn.count() })
      .from(estates);
    console.log("   ✅ Aggregate count works");

    // Test 5: Test transactions sum
    console.log("5️⃣ Testing transactions.amount column...");
    const txSum = await db
      .select({ total: db.fn.sum(transactions.amount) })
      .from(transactions);
    console.log("   ✅ transactions.amount column exists");

    console.log("\n✅ All database checks passed!");
  } catch (error: any) {
    console.error("\n❌ Diagnostic failed:");
    console.error("   Error:", error.message);
    console.error("   Code:", error.code);
    if (error.detail) console.error("   Detail:", error.detail);
  }
}

diagnose().catch(console.error);
