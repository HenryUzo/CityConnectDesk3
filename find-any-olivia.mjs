import pkg from 'pg';
const { Client } = pkg;

const client = new Client({
  user: 'postgres',
  password: 'MyHoneyPie',
  host: 'localhost',
  port: 5432,
  database: 'cityconnectdesk',
});

async function findAnyOlivia() {
  try {
    await client.connect();
    const result = await client.query(
      "SELECT id, name, email, role FROM users WHERE name ILIKE '%Olivia%' OR email ILIKE '%olivia%'"
    );
    console.log(JSON.stringify(result.rows, null, 2));
    await client.end();
  } catch (e) { console.error(e); }
}
findAnyOlivia();
