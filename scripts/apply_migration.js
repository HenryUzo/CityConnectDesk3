const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') });

(async () => {
  try {
    const url = process.env.DATABASE_URL;
    if (!url) {
      console.error('DATABASE_URL not set in .env.local');
      process.exit(2);
    }
    const sql = fs.readFileSync(path.resolve(__dirname, '../migrations/0009_add_ai_prepared_requests.sql'), 'utf8');
    const client = new Client({ connectionString: url });
    await client.connect();
    console.log('Connected to DB, executing migration...');
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('COMMIT');
    console.log('Migration applied successfully.');
    await client.end();
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err && err.message ? err.message : err);
    try { if (client) { await client.query('ROLLBACK'); await client.end(); } } catch (e) {}
    process.exit(1);
  }
})();
