import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
  user: 'postgres',
  password: 'MyHoneyPie',
  host: 'localhost',
  port: 5432,
  database: 'cityconnectdesk',
});

async function verifyTables() {
  try {
    console.log('Checking for required tables...\n');

    const requiredTables = [
      'estates',
      'audit_logs',
      'categories',
      'item_categories',
      'stores',
      'service_requests'
    ];

    const result = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = ANY($1)
      ORDER BY table_name
    `, [requiredTables]);

    const existingTables = result.rows.map(r => r.table_name);
    const missingTables = requiredTables.filter(t => !existingTables.includes(t));

    console.log('✓ Required Tables:');
    for (const table of requiredTables) {
      if (existingTables.includes(table)) {
        console.log(`  ✓ ${table}`);
      } else {
        console.log(`  ✗ ${table} (MISSING)`);
      }
    }

    if (missingTables.length === 0) {
      console.log('\n✓ All required tables exist!');
      
      // Check row counts
      console.log('\n✓ Table status:');
      for (const table of requiredTables) {
        if (existingTables.includes(table)) {
          const countResult = await pool.query(`SELECT COUNT(*) as count FROM ${table}`);
          console.log(`  - ${table}: ${countResult.rows[0].count} rows`);
        }
      }
    } else {
      console.log(`\n✗ Missing tables: ${missingTables.join(', ')}`);
      process.exit(1);
    }

    // Check enums
    console.log('\n✓ Enums:');
    const enumTypes = ['category_scope', 'service_status', 'urgency', 'service_category', 'store_approval_status'];
    const enumResult = await pool.query(`
      SELECT typname FROM pg_type WHERE typtype = 'e' AND typname = ANY($1)
    `, [enumTypes]);
    
    const existingEnums = enumResult.rows.map(r => r.typname);
    for (const enumType of enumTypes) {
      if (existingEnums.includes(enumType)) {
        console.log(`  ✓ ${enumType}`);
      } else {
        console.log(`  ✗ ${enumType} (MISSING)`);
      }
    }

    await pool.end();
  } catch (error) {
    console.error('Error verifying tables:', error.message);
    process.exit(1);
  }
}

verifyTables();
