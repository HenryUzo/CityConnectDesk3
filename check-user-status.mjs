import pkg from 'pg';
const { Client } = pkg;

const client = new Client({
  user: 'postgres',
  password: 'MyHoneyPie',
  host: 'localhost',
  port: 5432,
  database: 'cityconnectdesk',
});

async function checkUserStatus() {
  try {
    await client.connect();
    console.log('✅ Connected to PostgreSQL\n');

    const email = 'testprovider@example.com';
    console.log(`Checking status for user: ${email}\n`);

    // 1. Find user record
    const userResult = await client.query(
      'SELECT id, name, email, role, is_active, is_approved FROM users WHERE email = $1',
      [email]
    );

    if (userResult.rows.length === 0) {
      console.log(`❌ User not found with email: ${email}`);
      await client.end();
      return;
    }

    const user = userResult.rows[0];
    console.log('User Record:');
    console.log(`  ID: ${user.id}`);
    console.log(`  Name: ${user.name}`);
    console.log(`  Role: ${user.role}`);
    console.log(`  Is Active: ${user.is_active}`);
    console.log(`  Is Approved: ${user.is_approved}`);
    console.log('');

    // 2. Find memberships
    const membershipsResult = await client.query(
      `SELECT m.id, m.estate_id, e.name as estate_name, m.role, m.status, m.is_active 
       FROM memberships m
       LEFT JOIN estates e ON m.estate_id = e.id
       WHERE m.user_id = $1`,
      [user.id]
    );

    console.log(`Memberships Found: ${membershipsResult.rows.length}`);
    if (membershipsResult.rows.length > 0) {
      membershipsResult.rows.forEach((m, index) => {
        console.log(`  Membership #${index + 1}:`);
        console.log(`    Estate ID: ${m.estate_id}`);
        console.log(`    Estate Name: ${m.estate_name || 'N/A'}`);
        console.log(`    Role: ${m.role}`);
        console.log(`    Status: ${m.status}`);
        console.log(`    Is Active: ${m.is_active}`);
      });
    } else {
      console.log('  No memberships found for this user.');
    }

    // 3. Check for active memberships
    const activeMemberships = membershipsResult.rows.filter(m => m.status === 'active' && m.is_active === true);
    console.log(`\nActive Memberships: ${activeMemberships.length}`);

    await client.end();
  } catch (error) {
    console.error('Database error:', error.message);
    process.exit(1);
  }
}

checkUserStatus();
