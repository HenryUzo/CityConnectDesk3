import pkg from 'pg';
const { Client } = pkg;

const client = new Client({
  host: 'localhost',
  user: 'postgres',
  password: 'MyHoneyPie',
  port: 5432,
  database: 'cityconnectdesk'
});

async function fixSchema() {
  try {
    await client.connect();
    
    console.log('Adding missing columns to service_requests table...\n');
    
    // Add missing columns
    const addColumns = `
      ALTER TABLE service_requests
      ADD COLUMN IF NOT EXISTS advice_message text,
      ADD COLUMN IF NOT EXISTS inspection_dates text[],
      ADD COLUMN IF NOT EXISTS inspection_times text[];
    `;
    
    await client.query(addColumns);
    console.log('✓ Successfully added missing columns:');
    console.log('  - advice_message (text)');
    console.log('  - inspection_dates (text array)');
    console.log('  - inspection_times (text array)');
    
    // Verify columns were added
    const verification = await client.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'service_requests'
      AND table_schema = 'public'
      AND column_name IN ('advice_message', 'inspection_dates', 'inspection_times')
      ORDER BY column_name
    `);
    
    console.log('\n--- Verification ---');
    console.log(`Found ${verification.rows.length} of 3 expected columns:`);
    verification.rows.forEach(row => {
      console.log(`✓ ${row.column_name}: ${row.data_type}`);
    });
    
    if (verification.rows.length === 3) {
      console.log('\n✅ All missing columns have been added successfully!');
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.end();
  }
}

fixSchema();
