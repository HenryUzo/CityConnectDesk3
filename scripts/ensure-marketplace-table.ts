import "../server/env";
import { dbReady, db } from "../server/db";
import { sql } from "drizzle-orm";

async function ensureMarketplaceItems() {
  await db.execute(sql`CREATE EXTENSION IF NOT EXISTS "pgcrypto";`);

  await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'unit_of_measure') THEN
        CREATE TYPE unit_of_measure AS ENUM (
          'kg','g','liter','ml','piece','bunch','pack','bag','bottle','can','box','dozen','yard','meter'
        );
      END IF;
    END$$;
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS marketplace_items (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      estate_id varchar NOT NULL REFERENCES estates(id),
      store_id varchar REFERENCES stores(id),
      vendor_id varchar NOT NULL REFERENCES users(id),
      name text NOT NULL,
      description text,
      price numeric(10, 2) NOT NULL,
      currency varchar(10) NOT NULL DEFAULT 'NGN',
      unit_of_measure unit_of_measure DEFAULT 'piece',
      category text NOT NULL,
      subcategory text,
      stock integer NOT NULL DEFAULT 0,
      images text[],
      is_active boolean NOT NULL DEFAULT true,
      created_at timestamp DEFAULT now(),
      updated_at timestamp DEFAULT now()
    );
  `);
}

async function main() {
  await dbReady;
  await ensureMarketplaceItems();
  console.log("marketplace_items table ensured");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
