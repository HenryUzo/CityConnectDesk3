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
    const res = await client.query("SELECT indexname, indexdef FROM pg_indexes WHERE tablename='users';");
    console.log('Indexes on users:');
    console.log(JSON.stringify(res.rows, null, 2));
    await client.end();
    process.exit(0);
  } catch (err) {
    console.error('ERR', err.message || err);
    try { await client.end(); } catch {}
    process.exit(1);
  }
})();
