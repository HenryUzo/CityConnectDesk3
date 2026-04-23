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

async function main() {
  const sourceEnv = parseEnvFile(resolve(process.cwd(), ".env.local"));
  const sourceUrl = sourceEnv.DATABASE_URL;
  if (!sourceUrl) throw new Error("Missing DATABASE_URL in .env.local");

  const sourceHost = new URL(sourceUrl).hostname;
  if (sourceHost !== "localhost" && sourceHost !== "127.0.0.1") {
    throw new Error(`Source host is not local (${sourceHost}). Refusing repair.`);
  }

  const client = new Client({ connectionString: sourceUrl });
  await client.connect();

  try {
    const orphanedCompanyResult = await client.query(`
      DELETE FROM companies c
      WHERE c.provider_id IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM users u WHERE u.id = c.provider_id
        )
      RETURNING c.id
    `);

    const orphanedAuditResult = await client.query(`
      DELETE FROM audit_logs a
      WHERE a.actor_id IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM users u WHERE u.id = a.actor_id
        )
      RETURNING a.id
    `);

    // eslint-disable-next-line no-console
    console.log("Local source repair complete.", {
      orphanedCompaniesDeleted: orphanedCompanyResult.rowCount,
      orphanedAuditLogsDeleted: orphanedAuditResult.rowCount,
    });
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error("Failed to repair local source:", error);
  process.exitCode = 1;
});
