import { eq, sql } from "drizzle-orm";
import { db } from "../db";
import { stores, storeEstates } from "@shared/schema";

/**
 * Backfill script for store approval workflow migration
 *
 * This script:
 * 1. Auto-approves all existing stores
 * 2. Backfills store_estates from stores.estateId
 * 3. Sets approval metadata (approvedAt timestamp)
 */
async function backfillStoreApproval() {
  console.log("Starting store approval backfill...\n");

  try {
    // Step 1: Get all existing stores
    const existingStores = await db
      .select({
        id: stores.id,
        name: stores.name,
        estateId: stores.estateId,
        approvalStatus: stores.approvalStatus,
      })
      .from(stores);

    console.log(`Found ${existingStores.length} existing stores`);

    if (existingStores.length === 0) {
      console.log("No stores to migrate");
      return;
    }

    // Step 2: Auto-approve all stores that are still pending
    const pendingStores = existingStores.filter((s) => s.approvalStatus === "pending");

    if (pendingStores.length > 0) {
      console.log(`\nAuto-approving ${pendingStores.length} pending stores...`);

      for (const store of pendingStores) {
        await db
          .update(stores)
          .set({
            approvalStatus: "approved",
            approvedAt: new Date(),
            // Note: approvedBy is left null since this is an automated migration
          })
          .where(eq(stores.id, store.id));

        console.log(`  ✓ Approved store: ${store.name} (${store.id})`);
      }
    } else {
      console.log("\nAll stores already approved");
    }

    // Step 3: Backfill store_estates for stores with estateId
    const storesWithEstate = existingStores.filter((s) => s.estateId !== null);

    if (storesWithEstate.length > 0) {
      console.log(`\nBackfilling store_estates for ${storesWithEstate.length} stores...`);

      for (const store of storesWithEstate) {
        // Check if estate allocation already exists
        const [existing] = await db
          .select()
          .from(storeEstates)
          .where(eq(storeEstates.storeId, store.id));

        if (existing) {
          console.log(`  - Skipped ${store.name}: already has estate allocation`);
          continue;
        }

        // Get first admin user as allocator
        const result: any = await db.execute(
          sql`SELECT id FROM users WHERE role = 'admin' OR role = 'super_admin' LIMIT 1`
        );

        if (!result.rows || result.rows.length === 0) {
          console.log(`  - Skipped ${store.name}: no admin user found to attribute allocation`);
          continue;
        }

        const allocatedBy = result.rows[0].id;

        // Insert into store_estates
        await db.insert(storeEstates).values({
          storeId: store.id,
          estateId: store.estateId!,
          allocatedBy: allocatedBy as string,
          allocatedAt: new Date(),
        });

        console.log(`  ✓ Added estate allocation for: ${store.name} → ${store.estateId}`);
      }
    } else {
      console.log("\nNo stores with estate assignments to backfill");
    }

    console.log("\n✅ Backfill completed successfully!");

    // Summary
    console.log("\nSummary:");
    console.log(`  - Total stores: ${existingStores.length}`);
    console.log(`  - Auto-approved: ${pendingStores.length}`);
    console.log(`  - Estate allocations created: ${storesWithEstate.length}`);
  } catch (error) {
    console.error("\n❌ Backfill failed:", error);
    throw error;
  }
}

// Run the backfill
backfillStoreApproval()
  .then(() => {
    console.log("\nBackfill script finished");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\nBackfill script error:", error);
    process.exit(1);
  });
