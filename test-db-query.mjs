import pkg from 'pg';
import { db, dbReady } from './server/db.ts';
import { serviceRequests } from './shared/schema.ts';

const pool = new pkg.Pool({
  user: 'postgres',
  password: 'MyHoneyPie',
  host: 'localhost',
  port: 5432,
  database: 'cityconnectdesk',
});

async function test() {
  try {
    console.log('Waiting for database to be ready...');
    await dbReady;
    console.log('Database ready');

    console.log('\nTesting raw query...');
    const result = await pool.query('SELECT COUNT(*) FROM service_requests');
    console.log('Raw query result:', result.rows);

    console.log('\nTesting Drizzle query...');
    const requests = await db.select().from(serviceRequests).limit(5);
    console.log('Drizzle query result:', requests);
    
    console.log('\n✓ All queries successful');
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

test();
