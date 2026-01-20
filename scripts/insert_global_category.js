import 'dotenv/config';
import pkg from 'pg';
const { Client } = pkg;
(async ()=>{
  const cs = process.env.DATABASE_URL;
  if(!cs){ console.error('DATABASE_URL not set'); process.exit(1); }
  const client = new Client({ connectionString: cs });
  try{
    await client.connect();
    const now = new Date().toISOString();
    const id = 'seed-global-' + Date.now();
    const values = [id, 'global', null, 'Test Global Category', 'test-global', null, 'A test global category', '🌐', 'Utilities', true, now, now];
    const q = `INSERT INTO categories (id, scope, estate_id, name, key, emoji, description, icon, tag, is_active, created_at, updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`;
    const res = await client.query(q, values);
    console.log('INSERTED', res.rows[0]);
    await client.end();
    process.exit(0);
  }catch(err){ console.error('ERR', err.message||err); try{await client.end()}catch(e){} process.exit(1); }
})();
