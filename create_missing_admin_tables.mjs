import pg from "pg";

const { Client } = pg;

const client = new Client({
  host: "localhost",
  port: 5432,
  user: "postgres",
  password: "MyHoneyPie",
  database: "cityconnectdesk",
});

async function createMissingTables() {
  try {
    await client.connect();
    console.log("✓ Connected to PostgreSQL\n");

    // Create ai_prepared_requests table
    console.log("📝 Creating ai_prepared_requests table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS ai_prepared_requests (
        id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
        session_id TEXT NOT NULL UNIQUE,
        resident_hash TEXT NOT NULL,
        estate_id VARCHAR(36) REFERENCES estates(id),
        category service_category NOT NULL,
        urgency urgency NOT NULL,
        recommended_approach TEXT NOT NULL,
        confidence_score INTEGER NOT NULL DEFAULT 0,
        requires_consultancy BOOLEAN NOT NULL DEFAULT false,
        ready_to_book BOOLEAN NOT NULL DEFAULT false,
        snapshot JSONB NOT NULL DEFAULT '{}',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log("✓ ai_prepared_requests table created");

    // Create pricing_rules table
    console.log("\n📝 Creating pricing_rules table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS pricing_rules (
        id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
        name TEXT NOT NULL,
        category service_category,
        scope TEXT,
        urgency urgency,
        min_price DECIMAL(10, 2) NOT NULL DEFAULT 0,
        max_price DECIMAL(10, 2) NOT NULL DEFAULT 0,
        is_active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log("✓ pricing_rules table created");

    // Create provider_matching_settings table
    console.log("\n📝 Creating provider_matching_settings table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS provider_matching_settings (
        id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
        provider_id VARCHAR(36) NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
        is_enabled BOOLEAN NOT NULL DEFAULT true,
        settings JSONB NOT NULL DEFAULT '{}',
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log("✓ provider_matching_settings table created");

        // Create store_members table
    console.log("\nCreating store_members table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS store_members (
        id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
        store_id VARCHAR(36) NOT NULL REFERENCES stores(id),
        user_id VARCHAR(36) NOT NULL REFERENCES users(id),
        role TEXT NOT NULL DEFAULT 'member',
        can_manage_items BOOLEAN NOT NULL DEFAULT true,
        can_manage_orders BOOLEAN NOT NULL DEFAULT true,
        is_active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (store_id, user_id)
      );
    `);
    console.log("store_members table created");

// Create indexes
    console.log("\n📝 Creating indexes...");
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_ai_prepared_requests_estate_id ON ai_prepared_requests(estate_id);
      CREATE INDEX IF NOT EXISTS idx_ai_prepared_requests_created_at ON ai_prepared_requests(created_at);
      CREATE INDEX IF NOT EXISTS idx_pricing_rules_category ON pricing_rules(category);
      CREATE INDEX IF NOT EXISTS idx_pricing_rules_is_active ON pricing_rules(is_active);
      CREATE INDEX IF NOT EXISTS idx_provider_matching_settings_provider_id ON provider_matching_settings(provider_id);
      CREATE INDEX IF NOT EXISTS idx_store_members_store_id ON store_members(store_id);
      CREATE INDEX IF NOT EXISTS idx_store_members_user_id ON store_members(user_id);
    `);
    console.log("✓ Indexes created");

    // Verify tables were created
    console.log("\n✅ Verification:");
    const tables = [
      "ai_prepared_requests",
      "pricing_rules",
      "provider_matching_settings",
      "store_members",
    ];

    for (const table of tables) {
      const result = await client.query(
        `SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=$1)`,
        [table]
      );
      const exists = result.rows[0].exists;
      console.log(`  ${exists ? "✓" : "✗"} ${table}`);
    }

    await client.end();
    console.log("\n✅ All missing tables created successfully!");
  } catch (error) {
    console.error("❌ Error:", error.message);
    process.exit(1);
  }
}

createMissingTables();
