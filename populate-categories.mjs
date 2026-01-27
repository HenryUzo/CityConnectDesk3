import pg from 'pg';
import crypto from 'crypto';

const client = new pg.Client({
  host: 'localhost',
  port: 5432,
  database: 'cityconnectdesk',
  user: 'postgres',
  password: 'MyHoneyPie',
});

const categories = [
  { name: 'Plumbing', key: 'plumbing', emoji: '🔧' },
  { name: 'Electrical', key: 'electrical', emoji: '⚡' },
  { name: 'Carpentry', key: 'carpentry', emoji: '🪑' },
  { name: 'HVAC', key: 'hvac_technician', emoji: '❄️' },
  { name: 'Painting', key: 'painter', emoji: '🎨' },
  { name: 'Tiling', key: 'tiler', emoji: '🧱' },
  { name: 'Masonry', key: 'mason', emoji: '🏗️' },
  { name: 'Roofing', key: 'roofer', emoji: '🏠' },
  { name: 'Gardening', key: 'gardener', emoji: '🌱' },
  { name: 'Cleaning', key: 'cleaner', emoji: '🧹' },
  { name: 'Welding', key: 'welder', emoji: '🔥' },
  { name: 'Locksmith', key: 'locksmith', emoji: '🔐' },
  { name: 'Appliance Repair', key: 'appliance_repair', emoji: '🔌' },
  { name: 'Glass & Windows', key: 'glass_windows', emoji: '🪟' },
  { name: 'General Repairs', key: 'general_repairs', emoji: '🛠️' },
  { name: 'Store Owner', key: 'store_owner', emoji: '👤' },
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
  
  // Insert categories
  let insertedCount = 0;
  for (const cat of categories) {
    try {
      const result = await client.query(
        `INSERT INTO categories (id, name, key, emoji, scope, is_active, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())`,
        [generateUUID(), cat.name, cat.key, cat.emoji, 'global', true]
      );
      if (result.rowCount > 0) {
        insertedCount++;
        console.log(`✓ Added: ${cat.name} (${cat.key})`);
      }
    } catch (err) {
      if (err.code === '23505') { // unique violation
        console.log(`→ Skipped: ${cat.name} (${cat.key}) - already exists`);
      } else {
        throw err;
      }
    }
  }
  
  console.log(`\n✅ Successfully inserted ${insertedCount} new categories!`);
  
  // Verify
  const verify = await client.query(`SELECT COUNT(*) FROM categories`);
  console.log(`Total categories now: ${verify.rows[0].count}`);
  
  await client.end();
} catch (error) {
  console.error('Error:', error.message);
  process.exit(1);
}
