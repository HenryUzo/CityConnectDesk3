import pg from 'pg';
import crypto from 'crypto';

const client = new pg.Client({
  host: 'localhost',
  port: 5432,
  database: 'cityconnectdesk',
  user: 'postgres',
  password: 'MyHoneyPie',
});

const pricingRules = [
  { name: 'Plumbing - Standard', category: 'plumber', urgency: 'medium', minPrice: '5000', maxPrice: '15000' },
  { name: 'Plumbing - Urgent', category: 'plumber', urgency: 'high', minPrice: '8000', maxPrice: '20000' },
  { name: 'Electrical - Standard', category: 'electrician', urgency: 'medium', minPrice: '3000', maxPrice: '12000' },
  { name: 'Electrical - Urgent', category: 'electrician', urgency: 'high', minPrice: '5000', maxPrice: '18000' },
  { name: 'Carpentry - Standard', category: 'carpenter', urgency: 'medium', minPrice: '4000', maxPrice: '14000' },
  { name: 'Painting - Standard', category: 'painter', urgency: 'medium', minPrice: '2500', maxPrice: '10000' },
  { name: 'HVAC - Standard', category: 'hvac_technician', urgency: 'medium', minPrice: '6000', maxPrice: '18000' },
  { name: 'Cleaning - Standard', category: 'cleaner', urgency: 'low', minPrice: '1500', maxPrice: '8000' },
];

// Generate UUID v4 style
function generateUUID() {
  const bytes = crypto.randomBytes(16);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  return [
    bytes.slice(0, 4).toString('hex'),
    bytes.slice(4, 6).toString('hex'),
    bytes.slice(6, 8).toString('hex'),
    bytes.slice(8, 10).toString('hex'),
    bytes.slice(10, 16).toString('hex'),
  ].join('-');
}

try {
  await client.connect();
  console.log('✓ Connected to PostgreSQL\n');
  
  // Insert pricing rules
  let insertedCount = 0;
  for (const rule of pricingRules) {
    try {
      const result = await client.query(
        `INSERT INTO pricing_rules (id, name, category, urgency, min_price, max_price, is_active, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())`,
        [generateUUID(), rule.name, rule.category, rule.urgency, rule.minPrice, rule.maxPrice, true]
      );
      if (result.rowCount > 0) {
        insertedCount++;
        console.log(`✓ Added: ${rule.name}`);
      }
    } catch (err) {
      if (err.code === '23505') { // unique violation
        console.log(`→ Skipped: ${rule.name} - already exists`);
      } else {
        throw err;
      }
    }
  }
  
  console.log(`\n✅ Successfully inserted ${insertedCount} pricing rules!`);
  
  // Verify
  const verify = await client.query(`SELECT COUNT(*) FROM pricing_rules`);
  console.log(`Total pricing rules now: ${verify.rows[0].count}`);
  
  await client.end();
} catch (error) {
  console.error('Error:', error.message);
  process.exit(1);
}
