import pg from 'pg';
const { Client } = pg;

async function main() {
  const client = new Client({
    user: 'postgres',
    password: 'MyHoneyPie',
    host: 'localhost',
    port: 5432,
    database: 'cityconnectdesk',
  });

  try {
    await client.connect();
    console.log('✓ Connected to PostgreSQL\n');

    // Check memberships table
    const table = await client.query(`
      SELECT 
        column_name, 
        data_type,
        is_nullable
      FROM information_schema.columns
      WHERE table_name = 'memberships'
      ORDER BY ordinal_position
    `);

    console.log('Memberships table columns:');
    console.log('─'.repeat(60));
    table.rows.forEach(row => {
      console.log(`${row.column_name.padEnd(20)} │ ${row.data_type.padEnd(20)} │ ${row.is_nullable}`);
    });
    console.log('─'.repeat(60));

    // Check row count
    const count = await client.query('SELECT COUNT(*) FROM memberships');
    console.log(`\nTotal memberships: ${count.rows[0].count}`);

    // Try inserting a test membership
    console.log('\nTrying to create a test membership...');
    try {
      const result = await client.query(
        `INSERT INTO memberships (user_id, estate_id, role, is_active, status, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
         RETURNING *`,
        ['test-user-123', 'a92f385d-33db-4fd1-87f8-310e3854a51f', 'resident', true, 'active']
      );
      console.log('✅ Test insertion successful:', result.rows[0]);
      
      // Clean up
      await client.query('DELETE FROM memberships WHERE user_id = $1', ['test-user-123']);
      console.log('✓ Cleaned up test data');
    } catch (err) {
      console.error('❌ Test insertion failed:', err.message);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.end();
  }
}

main();
