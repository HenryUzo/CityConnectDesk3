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

async function checkInventory() {
  try {
    console.log("\n=== Checking Marketplace Inventory ===\n");
    
    // Query inventory table with marketplace items
    const result = await pool.query(`
      SELECT 
        i.id as inventory_id,
        i.stock_qty,
        i.reserved_qty,
        i.updated_at,
        m.id as item_id,
        m.name,
        m.description,
        m.price,
        m.category,
        m.is_active,
        m.stock as marketplace_stock,
        m.created_at,
        s.name as store_name
      FROM inventory i
      INNER JOIN marketplace_items m ON i.product_id = m.id
      LEFT JOIN stores s ON i.store_id = s.id
      WHERE m.is_active = true AND i.stock_qty > 0
      ORDER BY i.updated_at DESC
      LIMIT 20
    `);
    
    if (result.rows.length === 0) {
      console.log("❌ NO ITEMS FOUND in marketplace inventory with stock");
      console.log("\nChecking marketplace_items table...");
      
      const itemsResult = await pool.query(`
        SELECT COUNT(*) as total, 
               SUM(CASE WHEN is_active = true THEN 1 ELSE 0 END) as active_items
        FROM marketplace_items
      `);
      
      console.log(`Marketplace items: ${itemsResult.rows[0].active_items} active out of ${itemsResult.rows[0].total} total`);
      
      console.log("\nTo add inventory:");
      console.log("1. Login as a provider");
      console.log("2. Go to stores section");
      console.log("3. Add items to your store inventory");
    } else {
      console.log(`✓ Found ${result.rows.length} items with stock:\n`);
      
      result.rows.forEach((item, index) => {
        const priceNum = parseFloat(item.price);
        console.log(`${index + 1}. ${item.name}`);
        console.log(`   Item ID: ${item.item_id}`);
        console.log(`   Price: ₦${priceNum.toFixed(2)}`);
        console.log(`   Stock: ${item.stock_qty} available, ${item.reserved_qty} reserved`);
        console.log(`   Category: ${item.category}`);
        console.log(`   Store: ${item.store_name || 'N/A'}`);
        console.log(`   Active: ${item.is_active ? 'Yes' : 'No'}`);
        console.log('');
      });
      
      console.log(`\n✓ Marketplace has ${result.rows.length} items with stock ready for testing\n`);
    }
    
    // Check total items (including inactive)
    const totalResult = await pool.query(`
      SELECT COUNT(*) as total FROM inventory
    `);
    console.log(`Total items in database (including inactive): ${totalResult.rows[0].total}`);
    
  } catch (error) {
    console.error("❌ Error checking inventory:", error.message);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

checkInventory();
