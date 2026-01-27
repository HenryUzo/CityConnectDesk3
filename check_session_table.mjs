import pg from "pg";

const { Client } = pg;

const client = new Client({
  host: "localhost",
  port: 5432,
  user: "postgres",
  password: "MyHoneyPie",
  database: "cityconnectdesk",
});

async function checkSessionTable() {
  try {
    await client.connect();
    console.log("✓ Connected to PostgreSQL\n");

    // Check if session table exists
    const result = await client.query(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'session'
      );
    `);

    const tableExists = result.rows[0].exists;
    console.log(`Session table exists: ${tableExists ? "✅ YES" : "❌ NO"}`);

    if (tableExists) {
      // Get table info
      const columns = await client.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'session' 
        ORDER BY ordinal_position
      `);

      console.log("\nSession table columns:");
      columns.rows.forEach((col) => {
        console.log(`  - ${col.column_name}: ${col.data_type}`);
      });

      // Check for any sessions in the table
      const sessions = await client.query("SELECT COUNT(*) FROM session");
      console.log(`\nActive sessions: ${sessions.rows[0].count}`);
    } else {
      console.log("\n⚠️  Session table not found. express-session should create it on startup.");
    }

    await client.end();
  } catch (error) {
    console.error("Error:", error.message);
    process.exit(1);
  }
}

checkSessionTable();
