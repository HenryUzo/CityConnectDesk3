import pkg from 'pg';
const { Client } = pkg;

const client = new Client({
  user: 'postgres',
  password: 'MyHoneyPie',
  host: 'localhost',
  port: 5432,
  database: 'cityconnectdesk',
});

async function findOlivia() {
  try {
    await client.connect();
    console.log('Searching for users named Olivia...\n');

    const result = await client.query(
      "SELECT id, name, email, role FROM users WHERE name ILIKE '%Olivia%'"
    );

    console.log(`Found ${result.rows.length} matches:`);
    result.rows.forEach(user => {
      console.log(`  - ID: ${user.id}, Name: ${user.name}, Email: ${user.email}, Role: ${user.role}`);
    });

    await client.end();
  } catch (error) {
    console.error('Error:', error.message);
  }
}

findOlivia();
