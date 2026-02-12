// diagnose-marketplace-visibility.mjs
// Check why marketplace products aren't visible to residents

import pg from "pg";

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function diagnose() {
  console.log("\n🔍 Diagnosing Marketplace Product Visibility...\n");

  try {
    // 1. Check stores
    console.log("═══ STORES ═══");
    const storesResult = await pool.query(`
      SELECT id, name, "isActive", "approvalStatus", "estateId", "companyId"
      FROM stores
      ORDER BY "createdAt" DESC
      LIMIT 10
    `);
    console.table(storesResult.rows);

    // 2. Check marketplace items
    console.log("\n═══ MARKETPLACE ITEMS ═══");
    const itemsResult = await pool.query(`
      SELECT 
        mi.id, 
        mi.name, 
        mi."storeId",
        mi."isActive",
        mi.stock,
        s.name as store_name,
        s."isActive" as store_active,
        s."approvalStatus" as store_approval
      FROM marketplace_items mi
      LEFT JOIN stores s ON s.id = mi."storeId"
      ORDER BY mi."createdAt" DESC
      LIMIT 20
    `);
    console.table(itemsResult.rows);

    // 3. Check if there are any active products in approved stores
    const activeProductsResult = await pool.query(`
      SELECT COUNT(*) as count
      FROM marketplace_items mi
      JOIN stores s ON s.id = mi."storeId"
      WHERE mi."isActive" = true
        AND s."isActive" = true
        AND s."approvalStatus" = 'approved'
    `);
    console.log(
      `\n✅ Active products in approved stores: ${activeProductsResult.rows[0].count}`
    );

    // 4. Check estates and store associations
    console.log("\n═══ STORE-ESTATE ASSOCIATIONS ═══");
    const storeEstatesResult = await pool.query(`
      SELECT 
        se."storeId",
        se."estateId",
        s.name as store_name,
        e.name as estate_name
      FROM store_estates se
      JOIN stores s ON s.id = se."storeId"
      JOIN estates e ON e.id = se."estateId"
    `);
    console.table(storeEstatesResult.rows);

    // 5. Check if stores have direct estate association
    console.log("\n═══ STORES WITH DIRECT ESTATE ═══");
    const directEstatesResult = await pool.query(`
      SELECT 
        s.id,
        s.name as store_name,
        s."estateId",
        e.name as estate_name
      FROM stores s
      LEFT JOIN estates e ON e.id = s."estateId"
      WHERE s."estateId" IS NOT NULL
    `);
    console.table(directEstatesResult.rows);

    // 6. Check resident memberships
    console.log("\n═══ RESIDENT ESTATE MEMBERSHIPS (Sample) ═══");
    const membershipsResult = await pool.query(`
      SELECT 
        u.username,
        u."firstName",
        u."lastName",
        e.name as estate_name,
        m."estateId"
      FROM memberships m
      JOIN users u ON u.id = m."userId"
      JOIN estates e ON e.id = m."estateId"
      WHERE u.role = 'resident'
      LIMIT 10
    `);
    console.table(membershipsResult.rows);

    // 7. Provide recommendations
    console.log("\n💡 RECOMMENDATIONS:");

    const items = itemsResult.rows;
    const stores = storesResult.rows;

    const inactiveItems = items.filter((i) => !i.isActive);
    if (inactiveItems.length > 0) {
      console.log(
        `\n⚠️  ${inactiveItems.length} inactive products found. Activate them:`
      );
      for (const item of inactiveItems) {
        console.log(`   - ${item.name} (id: ${item.id})`);
      }
      console.log(
        `\n   SQL: UPDATE marketplace_items SET "isActive" = true WHERE id IN (${inactiveItems.map((i) => `'${i.id}'`).join(", ")});`
      );
    }

    const inactiveStores = stores.filter((s) => !s.isActive);
    if (inactiveStores.length > 0) {
      console.log(
        `\n⚠️  ${inactiveStores.length} inactive stores found. Activate them:`
      );
      for (const store of inactiveStores) {
        console.log(`   - ${store.name} (id: ${store.id})`);
      }
      console.log(
        `\n   SQL: UPDATE stores SET "isActive" = true WHERE id IN (${inactiveStores.map((s) => `'${s.id}'`).join(", ")});`
      );
    }

    const unapprovedStores = stores.filter(
      (s) => s.approvalStatus !== "approved"
    );
    if (unapprovedStores.length > 0) {
      console.log(
        `\n⚠️  ${unapprovedStores.length} unapproved stores found. Approve them:`
      );
      for (const store of unapprovedStores) {
        console.log(`   - ${store.name} (id: ${store.id}, status: ${store.approvalStatus})`);
      }
      console.log(
        `\n   SQL: UPDATE stores SET "approvalStatus" = 'approved' WHERE id IN (${unapprovedStores.map((s) => `'${s.id}'`).join(", ")});`
      );
    }

    const storesWithoutEstate = stores.filter((s) => !s.estateId);
    if (storesWithoutEstate.length > 0 && storeEstatesResult.rows.length === 0) {
      console.log(
        `\n⚠️  ${storesWithoutEstate.length} stores have no estate association.`
      );
      for (const store of storesWithoutEstate) {
        console.log(`   - ${store.name} (id: ${store.id})`);
      }
      console.log(
        `   Either set estateId directly or add entries to store_estates table.`
      );
    }

    console.log("\n✅ Diagnostic complete!");
  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    await pool.end();
  }
}

diagnose();


