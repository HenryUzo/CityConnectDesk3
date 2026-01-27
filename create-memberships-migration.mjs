import pg from 'pg';
const { Client } = pg;

async function main() {
  const client = new Client({
    user: 'postgres',
    password: 'MyHoneyPie',
    host: 'localhost',
    port: 5432,
    database: 'cityconnectdesk',
  });

  try {
    await client.connect();
    console.log('Connected to PostgreSQL');

    // Check if enum types already exist
    const enumCheck = await client.query(
      "SELECT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role')"
    );
    
    if (!enumCheck.rows[0].exists) {
      console.log('Creating user_role enum...');
      await client.query(`
        CREATE TYPE user_role AS ENUM (
          'resident',
          'provider',
          'admin',
          'super_admin',
          'estate_admin',
          'moderator'
        )
      `);
      console.log('✓ user_role enum created');
    } else {
      console.log('✓ user_role enum already exists');
    }

    const statusEnumCheck = await client.query(
      "SELECT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'membership_status')"
    );
    
    if (!statusEnumCheck.rows[0].exists) {
      console.log('Creating membership_status enum...');
      await client.query(`
        CREATE TYPE membership_status AS ENUM (
          'pending',
          'active',
          'suspended',
          'rejected',
          'left'
        )
      `);
      console.log('✓ membership_status enum created');
    } else {
      console.log('✓ membership_status enum already exists');
    }

    // Check if memberships table exists
    const tableCheck = await client.query(
      "SELECT EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'memberships')"
    );

    if (tableCheck.rows[0].exists) {
      console.log('✓ memberships table already exists');
      const columns = await client.query(`
        SELECT column_name, data_type FROM information_schema.columns 
        WHERE table_name = 'memberships'
        ORDER BY ordinal_position
      `);
      console.log('Columns:');
      columns.rows.forEach(row => {
        console.log(`  - ${row.column_name}: ${row.data_type}`);
      });
    } else {
      console.log('Creating memberships table...');
      await client.query(`
        CREATE TABLE memberships (
          id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id VARCHAR NOT NULL REFERENCES "User"(id),
          estate_id VARCHAR NOT NULL REFERENCES estates(id),
          role user_role NOT NULL,
          is_primary BOOLEAN NOT NULL DEFAULT false,
          status membership_status NOT NULL DEFAULT 'active',
          is_active BOOLEAN NOT NULL DEFAULT true,
          permissions TEXT[],
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      console.log('✓ memberships table created');

      // Create indexes
      console.log('Creating indexes...');
      await client.query('CREATE INDEX idx_memberships_user_id ON memberships(user_id)');
      await client.query('CREATE INDEX idx_memberships_estate_id ON memberships(estate_id)');
      await client.query('CREATE INDEX idx_memberships_user_estate ON memberships(user_id, estate_id)');
      console.log('✓ Indexes created');
    }

    console.log('\n✅ Memberships table setup complete!');
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
