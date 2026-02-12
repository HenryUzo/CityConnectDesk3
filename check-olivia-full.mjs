import pkg from 'pg';
const { Client } = pkg;

const client = new Client({
  user: 'postgres',
  password: 'MyHoneyPie',
  host: 'localhost',
  port: 5432,
  database: 'cityconnectdesk',
});

async function checkUser() {
  try {
    await client.connect();
    
    // Search by email, name, or first/last name
    const email = 'testprovider@example.com';
    const namePart = 'Olivia';
    
    console.log(`Searching for email=${email} OR name~${namePart}...\n`);

    const result = await client.query(
      "SELECT id, first_name, last_name, name, email, role FROM users WHERE email = $1 OR name ILIKE $2 OR first_name ILIKE $2 OR last_name ILIKE $2",
      [email, `%${namePart}%`]
    );

    if (result.rows.length === 0) {
      console.log('No user found.');
    } else {
      result.rows.forEach(u => {
        console.log(`User ID: ${u.id}`);
        console.log(`Name: ${u.name}`);
        console.log(`First Name: ${u.first_name}`);
        console.log(`Last Name: ${u.last_name}`);
        console.log(`Email: ${u.email}`);
        console.log(`Role: ${u.role}`);
        console.log('---');
      });
    }

    await client.end();
  } catch (error) {
    console.error(error);
  }
}

checkUser();
