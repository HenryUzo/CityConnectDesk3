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
      AND table_name IN ('estates', 'audit_logs', 'categories')
    `);
    
    console.log('✓ Required Tables:');
    const foundTables = new Set();
    tableCheck.rows.forEach(row => {
      console.log(`  ✓ ${row.table_name}`);
      foundTables.add(row.table_name);
    });
    
    const required = ['estates', 'audit_logs', 'categories'];
    const missing = required.filter(t => !foundTables.has(t));
    
    if (missing.length === 0) {
      console.log('\n✓ All required tables exist!');
      
      // Count rows in each
      const counts = {};
      for (const table of required) {
        const result = await client.query(`SELECT COUNT(*) as count FROM ${table}`);
        counts[table] = result.rows[0].count;
      }
      
      console.log(`\n✓ Table status:`);
      Object.entries(counts).forEach(([table, count]) => {
        console.log(`  - ${table}: ${count} rows`);
      });
    } else {
      console.log(`\n❌ Missing tables: ${missing.join(', ')}`);
    }
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

verifyTables();
