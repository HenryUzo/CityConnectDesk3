#!/usr/bin/env node
import "dotenv/config";
import pkg from "pg";
const { Pool } = pkg;

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function clearAllData() {
  const client = await pool.connect();
  try {
    console.log("Starting cleanup of chats and requests...");

    // Start a transaction
    await client.query("BEGIN");

    // Order matters if there are foreign keys, though CASCADE helps
    const tables = [
      "request_bill_items",
      "request_bills",
      "request_messages",
      "provider_requests",
      "inspections",
      "service_requests",
      "conversation_messages",
      "conversations",
      "ai_prepared_requests",
      "notifications"
    ];

    for (const table of tables) {
      try {
        // Check if table exists first
        const tableCheck = await client.query(`
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = '${table}'
          );
        `);

        if (tableCheck.rows[0].exists) {
          await client.query(`DELETE FROM "${table}"`);
          console.log(`✅ Cleared table: ${table}`);
        } else {
          console.log(`ℹ️ Table ${table} does not exist, skipping.`);
        }
      } catch (err) {
        console.warn(`⚠️ Could not clear table ${table}: ${err.message}`);
      }
    }

    await client.query("COMMIT");
    console.log("\n✅ All specified chats and requests have been cleared from the database.");
    console.log("Note: Any AI chat sessions stored in browser local storage will persist until cleared in the browser.");
    
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("❌ Error during cleanup:", error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

clearAllData();
