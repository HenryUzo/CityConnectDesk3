import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
  user: 'postgres',
  password: 'MyHoneyPie',
  host: 'localhost',
  port: 5432,
  database: 'cityconnectdesk',
});

async function checkServiceRequests() {
  try {
    const result = await pool.query(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'service_requests'
      ORDER BY ordinal_position
    `);
    
    console.log('\nservice_requests table columns:');
    console.log(result.rows.map(r => `  ${r.column_name}: ${r.data_type} (nullable: ${r.is_nullable})`).join('\n'));

    await pool.end();
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

checkServiceRequests();
