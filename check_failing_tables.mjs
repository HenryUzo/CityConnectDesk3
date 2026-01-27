import pg from "pg";

const { Client } = pg;

const client = new Client({
  host: "localhost",
  port: 5432,
  user: "postgres",
  password: "MyHoneyPie",
  database: "cityconnectdesk",
});

async function checkTablesAndColumns() {
  try {
    await client.connect();
    console.log("✓ Connected to PostgreSQL\n");

    const tables = [
      "ai_prepared_requests",
      "pricing_rules",
      "provider_matching_settings",
    ];

    for (const table of tables) {
      const exists = await client.query(
        `SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=$1)`,
        [table]
      );

      const tableExists = exists.rows[0].exists;
      console.log(
        `${tableExists ? "✅" : "❌"} Table "${table}" exists: ${tableExists}`
      );

      if (tableExists) {
        const columns = await client.query(
          `SELECT column_name, data_type FROM information_schema.columns WHERE table_schema='public' AND table_name=$1 ORDER BY ordinal_position`,
          [table]
        );
        console.log(`   Columns (${columns.rows.length}):`);
        columns.rows.slice(0, 5).forEach((col) => {
          console.log(`   - ${col.column_name}: ${col.data_type}`);
        });
        if (columns.rows.length > 5) {
          console.log(`   ... and ${columns.rows.length - 5} more`);
        }
      }
      console.log();
    }

    await client.end();
  } catch (error) {
    console.error("Error:", error.message);
    process.exit(1);
  }
}

checkTablesAndColumns();
