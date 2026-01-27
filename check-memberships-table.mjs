import pkg from 'pg';
const { Client } = pkg;

const client = new Client({
  user: 'postgres',
  password: 'postgres',
  host: 'localhost',
  port: 5432,
  database: 'cityconnectdesk',
});

async function checkMembershipsTable() {
  try {
    await client.connect();
    console.log('✅ Connected to PostgreSQL\n');

    // Check if memberships table exists
    const tableCheck = await client.query(
      `SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'memberships'
      );`
    );

    const tableExists = tableCheck.rows[0].exists;
    console.log(`Memberships table exists: ${tableExists ? '✅ YES' : '❌ NO'}`);

    if (tableExists) {
      // Get table structure
      const structureCheck = await client.query(
        `SELECT column_name, data_type, is_nullable 
         FROM information_schema.columns 
         WHERE table_schema = 'public' AND table_name = 'memberships'
         ORDER BY ordinal_position;`
      );

      console.log('\nTable structure:');
      structureCheck.rows.forEach(row => {
        console.log(`  - ${row.column_name}: ${row.data_type} (nullable: ${row.is_nullable})`);
      });
    } else {
      console.log('\n❌ Table "memberships" is MISSING - this is the cause of the 500 errors!');
    }

    await client.end();
  } catch (error) {
    console.error('Database error:', error.message);
    process.exit(1);
  }
}

checkMembershipsTable();
