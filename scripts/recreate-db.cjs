const { Client } = require('pg');
(async () => {
  const client = new Client({ connectionString: 'postgresql://postgres:MyHoneyPie@localhost:5432/postgres' });
  try {
    await client.connect();
    await client.query("SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'cityconnectdesk' AND pid != pg_backend_pid()");
    await client.query('DROP DATABASE IF EXISTS cityconnectdesk');
    await client.query('CREATE DATABASE cityconnectdesk');
    console.log('database recreated');
  } catch (error) {
    console.error(error);
    process.exit(1);
  } finally {
    await client.end();
  }
})();
