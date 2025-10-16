import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import ws from "ws";
import * as schema from "@shared/schema";

neonConfig.webSocketConstructor = ws;

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set. Did you forget to provision a database?");
}

export const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const db = drizzle({ client: pool, schema });

// --- NEW: log which DB this server is actually using (password masked) ---
try {
  const cs = process.env.DATABASE_URL!;
  const u = new URL(cs);
  const safe = cs.replace(/:\/\/([^:]+):[^@]+@/, "://$1:****@");
  console.log("[DB] Using", safe);
  console.log("[DB] Host:", u.hostname, " Database:", (u.pathname || "").replace("/", ""));
} catch {
  console.log("[DB] DATABASE_URL not set or unparsable");
}
console.log("[DB] URL present:", !!process.env.DATABASE_URL, "length:", process.env.DATABASE_URL?.length || 0);

