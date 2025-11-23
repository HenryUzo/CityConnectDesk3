import "./env";
import ws from "ws";
import * as schema from "@shared/schema";

export let pool: any;
export let db: any;

async function initDb() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL must be set. Did you forget to provision a database?");
  }

  // Support both Neon serverless and a local Postgres (pg) connection string.
  // If the URL starts with postgres:// or postgresql:// we'll use the node-postgres
  // client + drizzle's node-postgres adapter. Otherwise, fall back to the Neon client.
  const cs = process.env.DATABASE_URL;
  if (cs.startsWith("postgres://") || cs.startsWith("postgresql://")) {
    const pg = await import("pg");
    const drizzlePg = await import("drizzle-orm/node-postgres");
    const PgPool = pg.Pool;
    pool = new PgPool({ connectionString: cs });
    db = drizzlePg.drizzle(pool, { schema });
  } else {
    const neon = await import("@neondatabase/serverless");
    const drizzleNeon = await import("drizzle-orm/neon-serverless");
    neon.neonConfig.webSocketConstructor = ws;
    const NeonPool = neon.Pool;
    pool = new NeonPool({ connectionString: cs });
    db = drizzleNeon.drizzle({ client: pool, schema });
  }

  // --- Log which DB this server is actually using (password masked) ---
  try {
    const u = new URL(cs);
    const safe = cs.replace(/:\/\/([^:]+):[^@]+@/, "://$1:****@");
    console.log("[DB] Using", safe);
    console.log("[DB] Host:", u.hostname, " Database:", (u.pathname || "").replace("/", ""));
  } catch {
    console.log("[DB] DATABASE_URL not set or unparsable");
  }
  console.log("[DB] URL present:", !!process.env.DATABASE_URL, "length:", process.env.DATABASE_URL?.length || 0);
}

export const dbReady = initDb();
