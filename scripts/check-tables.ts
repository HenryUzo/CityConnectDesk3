import { db, dbReady } from "../server/db";
import { sql } from "drizzle-orm";

async function main() {
  await dbReady;
  const tables = await db.execute(
    sql`SELECT tablename FROM pg_tables WHERE schemaname='public';`,
  );
  console.log("Public tables:", tables.rows);

  const providers = await db.execute(
    sql`SELECT id, name, role FROM users WHERE role='provider' LIMIT 5;`,
  );
  console.log("Providers sample:", providers.rows);

  const estates = await db.execute(
    sql`SELECT id, name FROM estates LIMIT 5;`,
  );
  console.log("Estates sample:", estates.rows);
}

main().then(() => process.exit(0)).catch((err) => {
  console.error(err);
  process.exit(1);
});
