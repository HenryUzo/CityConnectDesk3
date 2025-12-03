import pkg from 'pg';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Load .env.local
dotenv.config({ path: '.env.local' });

const { Client } = pkg;

const client = new Client({ connectionString: process.env.DATABASE_URL });

client.connect()
  .then(() => {
    return client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'service_requests' 
      ORDER BY ordinal_position;
    `);
  })
  .then(res => {
    console.log('=== service_requests table columns ===');
    res.rows.forEach(row => {
      console.log(`${row.column_name}: ${row.data_type}`);
    });
    
    // Check for the specific columns we need
    const columnNames = res.rows.map(r => r.column_name);
    const requiredCols = ['advice_message', 'inspection_dates', 'inspection_times'];
    const missing = requiredCols.filter(col => !columnNames.includes(col));
    
    if (missing.length > 0) {
      console.log('\n⚠️  Missing columns:', missing);
      process.exit(1);
    } else {
      console.log('\n✅ All required columns present!');
      process.exit(0);
    }
  })
  .catch(e => {
    console.error('❌ Error:', e.message);
    process.exit(1);
  });
