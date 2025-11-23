import './env';

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL must be set');
  process.exit(1);
}

const email = process.argv[2] || 'pgadmin@cityconnect.com';

(async () => {
  try {
    const { Pool } = await import('pg');
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });

    const res = await pool.query(
      `UPDATE users SET global_role = $1 WHERE email = $2 RETURNING id, email, global_role`,
      ['super_admin', email],
    );

    if (res.rowCount === 0) {
      console.log(`No user found with email ${email}`);
    } else {
      console.log('Promoted user:', res.rows[0]);
    }

    await pool.end();
  } catch (err) {
    console.error('Failed to promote admin:', err);
    process.exit(1);
  }
})();
