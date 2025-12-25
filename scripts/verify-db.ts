import dotenv from "dotenv";
import { Client } from "pg";

dotenv.config();

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL not set");
  const client = new Client({ connectionString: url });
  await client.connect();

  const enums = [
    "membership_status",
    "role_scope",
    "bill_status",
    "category_scope",
  ];
  for (const e of enums) {
    const res = await client.query(
      `SELECT t.typname, n.nspname FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace WHERE t.typname = $1 AND n.nspname = 'public'`,
      [e]
    );
    console.log(`enum ${e}:`, res.rowCount > 0 ? "present" : "missing");
  }

  const tables = [
    "roles",
    "permissions",
    "role_permissions",
    "membership_roles",
  ];
  for (const t of tables) {
    const res = await client.query(
      `SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = $1`,
      [t]
    );
    console.log(`table ${t}:`, res.rowCount > 0 ? "present" : "missing");
  }

  const cols = [
    { table: "memberships", column: "status" },
    { table: "memberships", column: "is_primary" },
  ];
  for (const c of cols) {
    const res = await client.query(
      `SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2`,
      [c.table, c.column]
    );
    console.log(`column ${c.table}.${c.column}:`, res.rowCount > 0 ? "present" : "missing");
  }

  await client.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
