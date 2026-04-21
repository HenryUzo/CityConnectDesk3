import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { config } from "dotenv";

config({ path: ".env.local" });
config();

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const db = drizzle(pool);

async function checkMarketplaceItems() {
  try {
    console.log("\n=== Checking marketplace_items Table ===\n");
    
    const result = await pool.query(`
      SELECT 
        id,
        name,
        description,
        price,
        category,
        stock,
        is_active,
        store_id,
        vendor_id,
        created_at
      FROM marketplace_items
      WHERE is_active = true
      ORDER BY created_at DESC
    `);
    
    if (result.rows.length === 0) {
      console.log("❌ No items in marketplace_items table");
    } else {
      console.log(`✓ Found ${result.rows.length} active marketplace items:\n`);
      
      result.rows.forEach((item, index) => {
        const priceNum = parseFloat(item.price);
        console.log(`${index + 1}. ${item.name}`);
        console.log(`   ID: ${item.id}`);
        console.log(`   Price: ₦${priceNum.toFixed(2)}`);
        console.log(`   Legacy Stock: ${item.stock}`);
        console.log(`   Category: ${item.category}`);
        console.log(`   Store ID: ${item.store_id || 'N/A'}`);
        console.log(`   Vendor ID: ${item.vendor_id}`);
        console.log('');
      });
      
      console.log("\n⚠️  These items exist in marketplace_items but NOT in inventory table");
      console.log("The new marketplace uses the 'inventory' table for stock tracking.");
      console.log("\nTo migrate these items to inventory:");
      console.log("1. Create inventory entries for each marketplace_item");
      console.log("2. Link them to their respective stores");
      console.log("3. Set stock_qty from marketplace_items.stock");
    }
    
  } catch (error) {
    console.error("❌ Error:", error.message);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

checkMarketplaceItems();
