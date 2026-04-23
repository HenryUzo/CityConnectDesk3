import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import process from "node:process";
import { Client } from "pg";

function parseEnvFile(path: string) {
  const env: Record<string, string> = {};
  const content = readFileSync(path, "utf8");

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;

    const [, key, rawValue] = match;
    env[key] = rawValue.replace(/^['"]|['"]$/g, "");
  }

  return env;
}

function buildClient(connectionString: string) {
  const url = new URL(connectionString);
  const requiresSsl =
    url.searchParams.get("sslmode") === "require" || url.hostname.endsWith(".neon.tech");

  return new Client({
    connectionString,
    ssl: requiresSsl ? { rejectUnauthorized: false } : undefined,
  });
}

async function main() {
  if (!process.argv.includes("--confirm")) {
    throw new Error("Refusing to reset Neon schema without --confirm.");
  }

  const targetEnv = parseEnvFile(resolve(process.cwd(), ".env"));
  const targetUrl = targetEnv.DIRECT_URL || targetEnv.DATABASE_URL;
  if (!targetUrl) throw new Error("Missing DIRECT_URL or DATABASE_URL in .env");

  const targetHost = new URL(targetUrl).hostname;
  if (!targetHost.endsWith(".neon.tech")) {
    throw new Error(`Target host is not Neon (${targetHost}). Refusing to reset.`);
  }

  const client = buildClient(targetUrl);
  await client.connect();

  try {
    await client.query("DROP SCHEMA IF EXISTS public CASCADE");
    await client.query("CREATE SCHEMA public");
    await client.query("GRANT ALL ON SCHEMA public TO public");
    // eslint-disable-next-line no-console
    console.log("Neon public schema reset.");
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error("Failed to reset Neon schema:", error);
  process.exitCode = 1;
});
