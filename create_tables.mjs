import fs from 'fs';
import { Pool } from 'pg';

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'cityconnectdesk',
  user: 'postgres',
  password: 'MyHoneyPie',
});

const sql = fs.readFileSync('./create_missing_tables.sql', 'utf-8');

async function createTables() {
  const client = await pool.connect();
  try {
    console.log('Executing SQL to create missing tables...');
    await client.query(sql);
    console.log('✓ Tables created successfully!');
  } catch (error) {
    console.error('Error creating tables:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

createTables().catch(console.error);
