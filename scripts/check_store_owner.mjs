import pg from 'pg';

const client = new pg.Client({
  host: 'localhost',
  port: 5432,
  database: 'cityconnectdesk',
  user: 'postgres',
  password: 'MyHoneyPie',
});

async function main(){
  await client.connect();
  const res = await client.query(
    'SELECT id, name, key, emoji FROM categories WHERE key = $1',
    ['store_owner']
  );
  console.log('RESULT:', JSON.stringify(res.rows, null, 2));
  await client.end();
}

main().catch((e)=>{ console.error(e); process.exitCode = 1; });
