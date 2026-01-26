import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
  user: 'postgres',
  password: 'MyHoneyPie',
  host: 'localhost',
  port: 5432,
  database: 'cityconnectdesk',
});

async function checkSchema() {
  try {
    // Check wallets table
    const walletsResult = await pool.query(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'wallets'
      ORDER BY ordinal_position
    `);
    
    console.log('\nwallets table columns:');
    console.log(walletsResult.rows.map(r => `  ${r.column_name} (${r.data_type})`).join('\n'));

    // Check if wallets table exists
    const existsResult = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'wallets'
      )
    `);
    
    console.log('\nwallets table exists:', existsResult.rows[0].exists);
    
    await pool.end();
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

checkSchema();
