import 'dotenv/config';
import pkg from 'pg';
const { Client } = pkg;

(async () => {
  const cs = process.env.DATABASE_URL;
  if (!cs) {
    console.error('DATABASE_URL not set');
    process.exit(1);
  }
  const client = new Client({ connectionString: cs });
  try {
    await client.connect();

    const estatesRes = await client.query('SELECT id, name, slug, created_at FROM estates ORDER BY name');
    console.log('\n== Estates ==');
    console.log(`Found ${estatesRes.rows.length} estates`);
    console.log(JSON.stringify(estatesRes.rows, null, 2));

    const membershipsRes = await client.query('SELECT id, user_id, estate_id, role, status, is_active, created_at FROM memberships ORDER BY created_at DESC LIMIT 200');
    console.log('\n== Memberships (most recent 200) ==');
    console.log(`Found ${membershipsRes.rows.length} memberships`);
    console.log(JSON.stringify(membershipsRes.rows, null, 2));

    await client.end();
    process.exit(0);
  } catch (err) {
    console.error('ERR', err.message || err);
    try { await client.end(); } catch {}
    process.exit(1);
  }
})();
