// fix-marketplace-visibility.mjs
// Ensures products and stores are visible to residents

import pg from "pg";
import dotenv from "dotenv";

dotenv.config();

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

console.log("\n🔧 Fixing Marketplace Visibility...\n");

try {
  // 1. Activate all marketplace items
  const activateItemsResult = await pool.query(
    `UPDATE marketplace_items SET is_active = true WHERE is_active = false RETURNING id, name`
  );
  
  if (activateItemsResult.rows.length > 0) {
    console.log(`✅ Activated ${activateItemsResult.rows.length} products:`);
    activateItemsResult.rows.forEach(row => console.log(`   - ${row.name}`));
  } else {
    console.log("✅ All products already active");
  }

  // 2. Activate and approve all stores
  const fixStoresResult = await pool.query(
    `UPDATE stores 
     SET is_active = true,
         approval_status = 'approved' 
     WHERE is_active = false OR approval_status != 'approved'
     RETURNING id, name, is_active, approval_status`
  );
  
  if (fixStoresResult.rows.length > 0) {
    console.log(`\n✅ Fixed ${fixStoresResult.rows.length} stores:`);
    fixStoresResult.rows.forEach(row => console.log(`   - ${row.name}`));
  } else {
    console.log("\n✅ All stores already active and approved");
  }

  // 3. Check for stores without estate association
  const storesWithoutEstateResult = await pool.query(
    `SELECT s.id, s.name
     FROM stores s
     WHERE s.estate_id IS NULL
       AND NOT EXISTS (
         SELECT 1 FROM store_estates se WHERE se.store_id = s.id
       )`
  );

  if (storesWithoutEstateResult.rows.length > 0) {
    console.log(`\n⚠️  Found ${storesWithoutEstateResult.rows.length} stores without estate association:`);
    storesWithoutEstateResult.rows.forEach(row => console.log(`   - ${row.name} (id: ${row.id})`));
    
    // Get the first available estate to associate with
    const estateResult = await pool.query(`SELECT id, name FROM estates LIMIT 1`);
    if (estateResult.rows.length > 0) {
      const estate = estateResult.rows[0];
      console.log(`\n📍 Associating these stores with estate: ${estate.name}`);
      
      for (const store of storesWithoutEstateResult.rows) {
        await pool.query(
          `UPDATE stores SET estate_id = $1 WHERE id = $2`,
          [estate.id, store.id]
        );
        console.log(`   ✓ ${store.name} → ${estate.name}`);
      }
    } else {
      console.log("\n⚠️  No estates found. Please create an estate first.");
    }
  } else {
    console.log("\n✅ All stores have estate associations");
  }

  // 4. Show summary
  console.log("\n📊 SUMMARY:");
  const summaryResult = await pool.query(`
    SELECT 
      (SELECT COUNT(*) FROM marketplace_items WHERE is_active = true) as active_products,
      (SELECT COUNT(*) FROM stores WHERE is_active = true AND approval_status = 'approved') as active_stores,
      (SELECT COUNT(*) FROM marketplace_items mi 
       JOIN stores s ON s.id = mi.store_id 
       WHERE mi.is_active = true 
         AND s.is_active = true 
         AND s.approval_status = 'approved') as visible_products
  `);
  
  const summary = summaryResult.rows[0];
  console.log(`   Active Products: ${summary.active_products}`);
  console.log(`   Active & Approved Stores: ${summary.active_stores}`);
  console.log(`   Products Visible to Residents: ${summary.visible_products}`);
  
  console.log("\n✅ Done! Products should now be visible on the marketplace.");
  
} catch (error) {
  console.error("\n❌ Error:", error.message);
} finally {
  await pool.end();
}
