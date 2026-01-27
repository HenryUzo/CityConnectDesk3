import { Pool } from 'pg';

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'cityconnectdesk',
  user: 'postgres',
  password: 'MyHoneyPie',
});

async function verifyTables() {
  const client = await pool.connect();
  try {
    // Check if tables exist
    const tableCheck = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('estates', 'audit_logs')
    `);
    
    console.log('✓ Tables check:');
    tableCheck.rows.forEach(row => console.log(`  - ${row.table_name}`));
    
    if (tableCheck.rows.length === 2) {
      console.log('\n✓ Both tables exist!');
      
      // Count rows in each
      const estatesCount = await client.query('SELECT COUNT(*) as count FROM estates');
      const logsCount = await client.query('SELECT COUNT(*) as count FROM audit_logs');
      
      console.log(`\n✓ Table status:`);
      console.log(`  - estates: ${estatesCount.rows[0].count} rows`);
      console.log(`  - audit_logs: ${logsCount.rows[0].count} rows`);
    } else {
      console.log('\n❌ Not all tables found!');
    }
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

verifyTables();
