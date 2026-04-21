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

async function migrateToInventory() {
  try {
    console.log("\n=== Migrating marketplace_items to inventory ===\n");
    
    // Get all marketplace items that don't have inventory entries
    const itemsResult = await pool.query(`
      SELECT 
        m.id as product_id,
        m.store_id,
        m.stock,
        m.name
      FROM marketplace_items m
      WHERE m.is_active = true 
        AND m.store_id IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM inventory i 
          WHERE i.product_id = m.id AND i.store_id = m.store_id
        )
    `);
    
    if (itemsResult.rows.length === 0) {
      console.log("✓ All marketplace items already have inventory entries");
      return;
    }
    
    console.log(`Found ${itemsResult.rows.length} items to migrate:\n`);
    
    let migrated = 0;
    for (const item of itemsResult.rows) {
      console.log(`Migrating: ${item.name} (stock: ${item.stock})`);
      
      try {
        await pool.query(`
          INSERT INTO inventory (store_id, product_id, stock_qty, reserved_qty, updated_at)
          VALUES ($1, $2, $3, 0, NOW())
          ON CONFLICT (store_id, product_id) DO NOTHING
        `, [item.store_id, item.product_id, item.stock || 0]);
        
        migrated++;
        console.log(`  ✓ Created inventory entry`);
      } catch (err) {
        console.log(`  ✗ Failed: ${err.message}`);
      }
    }
    
    console.log(`\n✓ Successfully migrated ${migrated} items to inventory table\n`);
    
    // Verify the migration
    const verifyResult = await pool.query(`
      SELECT COUNT(*) as count FROM inventory
    `);
    
    console.log(`Total inventory entries: ${verifyResult.rows[0].count}`);
    
  } catch (error) {
    console.error("❌ Migration error:", error.message);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

migrateToInventory();
