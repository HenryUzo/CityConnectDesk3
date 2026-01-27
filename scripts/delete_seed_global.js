import 'dotenv/config';
import pkg from 'pg';
const { Client } = pkg;
(async ()=>{
  const cs = process.env.DATABASE_URL;
  if(!cs){ console.error('DATABASE_URL not set'); process.exit(1); }
  const client = new Client({ connectionString: cs });
  try{
    await client.connect();
    const q = `DELETE FROM categories WHERE key = $1 OR id LIKE $2 RETURNING *`;
    const res = await client.query(q, ['test-global', 'seed-global-%']);
    console.log('DELETED ROWS:', res.rowCount);
    if(res.rows.length) console.log(JSON.stringify(res.rows, null, 2));
    await client.end();
    process.exit(0);
  }catch(err){ console.error('ERR', err.message||err); try{await client.end()}catch(e){} process.exit(1); }
})();
