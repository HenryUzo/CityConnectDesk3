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
  
  // Find one provider
  const providerRes = await client.query(
    `SELECT id, name, email, categories FROM users WHERE role = $1 LIMIT 1`,
    ['provider']
  );
  
  if (providerRes.rows.length === 0) {
    console.log('No providers found. Skipping assignment.');
    await client.end();
    return;
  }
  
  const provider = providerRes.rows[0];
  console.log(`Found provider: ${provider.name} (${provider.email})`);
  console.log(`Current categories:`, provider.categories);
  
  // Add store_owner to categories if not present
  const cats = Array.isArray(provider.categories) ? provider.categories : [];
  if (!cats.includes('store_owner')) {
    cats.push('store_owner');
  }
  
  // Update the provider
  const updateRes = await client.query(
    `UPDATE users SET categories = $1, updated_at = NOW() WHERE id = $2 RETURNING id, name, categories`,
    [cats, provider.id]
  );
  
  console.log(`\nUpdated provider:`, updateRes.rows[0]);
  console.log(`✅ Successfully assigned 'store_owner' category!`);
  
  await client.end();
}

main().catch((e)=>{ console.error(e); process.exitCode = 1; });
