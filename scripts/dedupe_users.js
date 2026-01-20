import 'dotenv/config';
import pkg from 'pg';
const { Client } = pkg;
import { format as formatDate } from 'date-fns';

(async () => {
  const cs = process.env.DATABASE_URL;
  if (!cs) {
    console.error('DATABASE_URL not set');
    process.exit(1);
  }
  const client = new Client({ connectionString: cs });
  try {
    await client.connect();

    const beforeDupRes = await client.query(`
      SELECT lower(email) as email_lower, count(*) as cnt, array_agg(id ORDER BY created_at DESC) as ids
      FROM users
      GROUP BY lower(email)
      HAVING count(*) > 1
    `);

    if (beforeDupRes.rows.length === 0) {
      console.log('No duplicate emails found.');
      await client.end();
      process.exit(0);
    }

    console.log('Found duplicate email groups:', beforeDupRes.rows.length);
    for (const r of beforeDupRes.rows) {
      console.log(`- ${r.email_lower}: count=${r.cnt}, ids=${r.ids.join(',')}`);
    }

    // Backup full users table to timestamped table
    const ts = formatDate(new Date(), 'yyyyMMddHHmmss');
    const backupTable = `users_backup_before_dedupe_${ts}`;
    console.log('Creating backup table', backupTable);
    await client.query(`CREATE TABLE ${backupTable} AS TABLE users`);

    // Delete duplicates keeping the most recent per lower(email)
    console.log('Deleting duplicate rows (keeping most recent per email)...');
    await client.query(`
      WITH ranked AS (
        SELECT id, ROW_NUMBER() OVER (PARTITION BY lower(email) ORDER BY created_at DESC) AS rn
        FROM users
      )
      DELETE FROM users
      USING ranked
      WHERE users.id = ranked.id AND ranked.rn > 1;
    `);

    const afterDupRes = await client.query(`
      SELECT lower(email) as email_lower, count(*) as cnt
      FROM users
      GROUP BY lower(email)
      HAVING count(*) > 1
    `);
    console.log('Duplicate groups remaining after delete:', afterDupRes.rows.length);

    // Create unique index on lower(email)
    try {
      console.log('Creating unique index on lower(email)');
      await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_unique ON users (lower(email));`);
      console.log('Unique index created');
    } catch (err) {
      console.error('Failed to create unique index:', err.message || err);
    }

    // Summary
    const totalUsers = await client.query('SELECT count(*) as cnt FROM users');
    console.log('Total users after dedupe:', totalUsers.rows[0].cnt);

    await client.end();
    process.exit(0);
  } catch (err) {
    console.error('ERR', err.message || err);
    try { await client.end(); } catch {}
    process.exit(1);
  }
})();
