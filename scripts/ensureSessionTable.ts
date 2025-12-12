// scripts/ensureSessionTable.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Standard connect-pg-simple session table structure
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "session" (
      "sid" VARCHAR NOT NULL PRIMARY KEY,
      "sess" JSON NOT NULL,
      "expire" TIMESTAMP NOT NULL
    );
  `);

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "session" ("expire");
  `);

  console.log('✅ Session table ensured');
}

main()
  .catch((e) => {
    console.error('❌ Failed to ensure session table:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
