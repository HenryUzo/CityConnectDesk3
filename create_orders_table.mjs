import pg from "pg";

const { Client } = pg;

const client = new Client({
  host: "localhost",
  port: 5432,
  user: "postgres",
  password: "MyHoneyPie",
  database: "cityconnectdesk",
});

async function createOrdersTable() {
  try {
    await client.connect();
    console.log("✓ Connected to PostgreSQL");

    // Check if enum exists
    const enumResult = await client.query(`
      SELECT EXISTS (
        SELECT 1 FROM pg_type 
        WHERE typname = 'order_status'
      );
    `);

    const enumExists = enumResult.rows[0].exists;
    
    if (!enumExists) {
      console.log("\n📝 Creating order_status enum...");
      await client.query(`
        CREATE TYPE order_status AS ENUM (
          'pending',
          'confirmed',
          'processing',
          'dispatched',
          'delivered',
          'cancelled',
          'disputed'
        );
      `);
      console.log("✓ order_status enum created");
    } else {
      console.log("✓ order_status enum already exists");
    }

    // Create orders table
    console.log("\n📝 Creating orders table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
        estate_id VARCHAR(36) NOT NULL REFERENCES estates(id),
        store_id VARCHAR(36) REFERENCES stores(id),
        buyer_id VARCHAR(36) NOT NULL REFERENCES users(id),
        vendor_id VARCHAR(36) NOT NULL REFERENCES users(id),
        items JSONB NOT NULL,
        total DECIMAL(10, 2) NOT NULL,
        currency VARCHAR(10) NOT NULL DEFAULT 'NGN',
        status order_status NOT NULL DEFAULT 'pending',
        delivery_address TEXT NOT NULL,
        payment_method TEXT,
        payment_id TEXT,
        dispute JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log("✓ orders table created");

    // Create indexes
    console.log("\n📝 Creating indexes...");
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_orders_estate_id ON orders(estate_id);
      CREATE INDEX IF NOT EXISTS idx_orders_buyer_id ON orders(buyer_id);
      CREATE INDEX IF NOT EXISTS idx_orders_vendor_id ON orders(vendor_id);
      CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
      CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);
    `);
    console.log("✓ Indexes created");

    // Verify table
    const verifyResult = await client.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'orders'
      ORDER BY ordinal_position;
    `);

    console.log("\n✅ Orders table structure:");
    verifyResult.rows.forEach((row) => {
      console.log(`  - ${row.column_name}: ${row.data_type}`);
    });

    await client.end();
    console.log("\n✅ Orders table successfully created!");
  } catch (error) {
    console.error("❌ Error:", error.message);
    process.exit(1);
  }
}

createOrdersTable();
