import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config();

import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { requestConversationSettings } from "./shared/schema.ts";
import { desc } from "drizzle-orm";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool);

const settings = await db
  .select()
  .from(requestConversationSettings)
  .orderBy(desc(requestConversationSettings.updatedAt))
  .limit(1);

console.log("Current AI Settings from database:");
console.log(JSON.stringify(settings, null, 2));

await pool.end();
