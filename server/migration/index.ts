#!/usr/bin/env tsx
import mongoose from 'mongoose';
import { runMigration } from './etl-mongo-to-postgres';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/cityconnect';

async function main() {
  console.log('🔌 Connecting to MongoDB...');
  await mongoose.connect(MONGODB_URI);
  console.log('✅ Connected to MongoDB');

  try {
    await runMigration();
    console.log('\n🎉 Migration completed successfully!');
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

main().catch(console.error);
