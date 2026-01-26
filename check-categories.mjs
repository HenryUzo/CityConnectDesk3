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

    // Check categories table
    const result = await client.query(`
      SELECT id, name, key, scope, is_active as "isActive", created_at as "createdAt"
      FROM categories
      ORDER BY created_at DESC
      LIMIT 50
    `);

    console.log(`Found ${result.rows.length} categories:\n`);
    console.log('Categories Table:');
    console.log('─'.repeat(100));
    console.log('ID'.padEnd(40), 'Name'.padEnd(35), 'Key'.padEnd(25));
    console.log('─'.repeat(100));
    
    result.rows.forEach(row => {
      console.log(
        (row.id || 'N/A').padEnd(40),
        (row.name || 'N/A').padEnd(35),
        (row.key || 'N/A').padEnd(25)
      );
    });
    
    console.log('─'.repeat(100));

    // Get unique keys
    console.log('\nUnique Category Keys:');
    const keys = result.rows.map(r => r.key).filter(Boolean);
    const uniqueKeys = [...new Set(keys)].sort();
    uniqueKeys.forEach((key, idx) => {
      console.log(`${idx + 1}. ${key}`);
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.end();
  }
}

main();
