import { db } from './server/db';
import { sql, desc } from 'drizzle-orm';
import { companies } from './shared/schema';

async function checkSchema() {
  try {
    // Try to query the table
    const result = await db.select().from(companies).limit(1);
    console.log('✓ Successfully queried companies table');
    console.log('Columns in table result:', Object.keys(result[0] || {}));
  } catch (error) {
    console.error('✗ Error querying companies:', error instanceof Error ? error.message : error);
  } finally {
    process.exit(0);
  }
}

checkSchema();
