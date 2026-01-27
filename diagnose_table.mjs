import pkg from 'pg';
const { Client } = pkg;

const client = new Client({
  host: 'localhost',
  user: 'postgres',
  password: 'MyHoneyPie',
  port: 5432,
  database: 'cityconnectdesk'
});

async function diagnose() {
  try {
    await client.connect();
    
    // Check if table exists
    const tableCheck = await client.query(`
      SELECT EXISTS(
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'service_requests' 
        AND table_schema = 'public'
      )
    `);
    
    console.log('Table exists:', tableCheck.rows[0].exists);
    
    if (tableCheck.rows[0].exists) {
      // Get all columns
      const columns = await client.query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_name = 'service_requests'
        AND table_schema = 'public'
        ORDER BY ordinal_position
      `);
      
      console.log('\n--- Current Columns in service_requests ---');
      columns.rows.forEach(col => {
        console.log(`${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
      });
      
      // Expected columns from schema
      const expectedColumns = [
        'id', 'estate_id', 'category', 'description', 'resident_id', 'provider_id',
        'status', 'budget', 'urgency', 'location', 'latitude', 'longitude',
        'preferred_time', 'special_instructions', 'advice_message', 'inspection_dates',
        'inspection_times', 'admin_notes', 'assigned_at', 'closed_at', 'close_reason',
        'billed_amount', 'payment_status', 'created_at', 'updated_at'
      ];
      
      const actualColumns = columns.rows.map(c => c.column_name);
      const missing = expectedColumns.filter(col => !actualColumns.includes(col));
      
      if (missing.length > 0) {
        console.log('\n--- Missing Columns ---');
        missing.forEach(col => console.log(`- ${col}`));
      } else {
        console.log('\n✓ All expected columns are present!');
      }
    }
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await client.end();
  }
}

diagnose();
