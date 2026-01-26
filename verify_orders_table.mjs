import pg from "pg";
import path from "path";
import { fileURLToPath } from "url";

const { Client } = pg;

const client = new Client({
  host: "localhost",
  port: 5432,
  user: "postgres",
  password: "MyHoneyPie",
  database: "cityconnectdesk",
});

async function checkOrdersTable() {
  try {
    await client.connect();
    console.log("✓ Connected to PostgreSQL");

    // Check if orders table exists
    const result = await client.query(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'orders'
      );
    `);

    const tableExists = result.rows[0].exists;
    console.log(
      `\nOrders table exists: ${tableExists ? "✅ YES" : "❌ NO"}`
    );

    if (tableExists) {
      // Get column info
      const columnsResult = await client.query(`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'orders'
        ORDER BY ordinal_position;
      `);

      console.log("\nOrders table columns:");
      columnsResult.rows.forEach((row) => {
        console.log(
          `  - ${row.column_name}: ${row.data_type} (nullable: ${row.is_nullable})`
        );
      });
    } else {
      console.log(
        "\n⚠️ Orders table not found! Need to create it from Drizzle schema."
      );
    }

    await client.end();
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

checkOrdersTable();
