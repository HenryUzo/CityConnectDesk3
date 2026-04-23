import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import process from "node:process";
import { Client } from "pg";

type EnvMap = Record<string, string>;

type ColumnInfo = {
  name: string;
  dataType: string;
  udtName: string;
};

type TableInfo = {
  name: string;
  columns: ColumnInfo[];
};

const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run") || !args.has("--confirm");
const replaceTarget = args.has("--replace-target");
const allowAnyTarget = args.has("--allow-any-target");

function parseEnvFile(path: string): EnvMap {
  const env: EnvMap = {};
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

function quoteIdent(identifier: string) {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(identifier)) {
    throw new Error(`Unsafe SQL identifier: ${identifier}`);
  }
  return `"${identifier}"`;
}

function qualifiedTable(table: string) {
  return `public.${quoteIdent(table)}`;
}

function maskConnection(connectionString: string) {
  const url = new URL(connectionString);
  return `${url.protocol}//${url.username ? "***:***@" : ""}${url.host}${url.pathname}`;
}

function normalizeValueForColumn(value: unknown, column: ColumnInfo) {
  if (value == null) return value;
  if (column.udtName === "json" || column.udtName === "jsonb") {
    return typeof value === "string" ? value : JSON.stringify(value);
  }
  return value;
}

async function getPublicTables(client: Client): Promise<TableInfo[]> {
  const { rows } = await client.query<{
    table_name: string;
    column_name: string;
    data_type: string;
    udt_name: string;
  }>(`
    SELECT table_name, column_name, data_type, udt_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name IN (
        SELECT tablename
        FROM pg_catalog.pg_tables
        WHERE schemaname = 'public'
      )
      AND is_generated = 'NEVER'
    ORDER BY table_name, ordinal_position
  `);

  const byTable = new Map<string, ColumnInfo[]>();
  for (const row of rows) {
    if (!byTable.has(row.table_name)) byTable.set(row.table_name, []);
    byTable.get(row.table_name)!.push({
      name: row.column_name,
      dataType: row.data_type,
      udtName: row.udt_name,
    });
  }

  return Array.from(byTable.entries()).map(([name, columns]) => ({ name, columns }));
}

async function getInsertOrder(client: Client, tableNames: string[]) {
  const tableSet = new Set(tableNames);
  const { rows } = await client.query<{ child_table: string; parent_table: string }>(`
    SELECT
      child.relname AS child_table,
      parent.relname AS parent_table
    FROM pg_constraint con
    JOIN pg_class child ON child.oid = con.conrelid
    JOIN pg_namespace child_ns ON child_ns.oid = child.relnamespace
    JOIN pg_class parent ON parent.oid = con.confrelid
    JOIN pg_namespace parent_ns ON parent_ns.oid = parent.relnamespace
    WHERE con.contype = 'f'
      AND child_ns.nspname = 'public'
      AND parent_ns.nspname = 'public'
  `);

  const dependencies = new Map<string, Set<string>>();
  for (const table of tableNames) dependencies.set(table, new Set());

  for (const row of rows) {
    if (!tableSet.has(row.child_table) || !tableSet.has(row.parent_table)) continue;
    if (row.child_table === row.parent_table) continue;
    dependencies.get(row.child_table)!.add(row.parent_table);
  }

  const sorted: string[] = [];
  const remaining = new Set(tableNames);

  while (remaining.size > 0) {
    const ready = Array.from(remaining)
      .filter((table) =>
        Array.from(dependencies.get(table) ?? []).every((dependency) => !remaining.has(dependency)),
      )
      .sort();

    if (ready.length === 0) {
      throw new Error(
        `Could not resolve table dependency order. Remaining tables: ${Array.from(remaining).join(", ")}`,
      );
    }

    for (const table of ready) {
      sorted.push(table);
      remaining.delete(table);
    }
  }

  return sorted;
}

async function getRowCount(client: Client, tableName: string) {
  const { rows } = await client.query<{ count: string }>(
    `SELECT count(*)::text AS count FROM ${qualifiedTable(tableName)}`,
  );
  return Number(rows[0]?.count ?? 0);
}

async function resetSequences(client: Client) {
  await client.query(`
    SELECT setval(
      pg_get_serial_sequence(format('%I.%I', table_schema, table_name), column_name),
      COALESCE((xpath('/row/max/text()', query_to_xml(format('SELECT max(%I) FROM %I.%I', column_name, table_schema, table_name), true, true, '')))[1]::text::bigint, 1),
      true
    )
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND column_default LIKE 'nextval(%'
      AND pg_get_serial_sequence(format('%I.%I', table_schema, table_name), column_name) IS NOT NULL
  `);
}

async function main() {
  const sourceEnvPath = resolve(process.cwd(), ".env.local");
  const targetEnvPath = resolve(process.cwd(), ".env");
  const sourceEnv = parseEnvFile(sourceEnvPath);
  const targetEnv = parseEnvFile(targetEnvPath);

  const sourceUrl = sourceEnv.DATABASE_URL;
  const targetUrl = targetEnv.DIRECT_URL || targetEnv.DATABASE_URL;

  if (!sourceUrl) throw new Error(`Missing DATABASE_URL in ${sourceEnvPath}`);
  if (!targetUrl) throw new Error(`Missing DIRECT_URL or DATABASE_URL in ${targetEnvPath}`);
  if (sourceUrl === targetUrl) {
    throw new Error("Source and target database URLs are identical. Refusing to continue.");
  }

  const targetHost = new URL(targetUrl).hostname;
  if (!allowAnyTarget && !targetHost.endsWith(".neon.tech")) {
    throw new Error(`Target host is not Neon (${targetHost}). Pass --allow-any-target to override.`);
  }

  const source = buildClient(sourceUrl);
  const target = buildClient(targetUrl);

  await source.connect();
  await target.connect();

  try {
    const sourceTables = await getPublicTables(source);
    const targetTables = await getPublicTables(target);
    const targetTableMap = new Map(targetTables.map((table) => [table.name, table]));
    const missingTargetTables = sourceTables
      .map((table) => table.name)
      .filter((name) => !targetTableMap.has(name));

    if (missingTargetTables.length > 0) {
      throw new Error(
        `Target database is missing ${missingTargetTables.length} table(s): ${missingTargetTables.join(", ")}. Run Drizzle migrations against Neon first.`,
      );
    }

    const sourceTableMap = new Map(sourceTables.map((table) => [table.name, table]));
    const tableNames = sourceTables.map((table) => table.name).sort();
    const insertOrder = await getInsertOrder(source, tableNames);
    const truncateOrder = [...insertOrder].reverse();
    const summary: Array<{ table: string; sourceRows: number; targetRows: number }> = [];

    for (const tableName of tableNames) {
      summary.push({
        table: tableName,
        sourceRows: await getRowCount(source, tableName),
        targetRows: await getRowCount(target, tableName),
      });
    }

    // eslint-disable-next-line no-console
    console.log("Source:", maskConnection(sourceUrl));
    // eslint-disable-next-line no-console
    console.log("Target:", maskConnection(targetUrl));
    // eslint-disable-next-line no-console
    console.table(summary);

    if (dryRun) {
      // eslint-disable-next-line no-console
      console.log("Dry run only. Re-run with --confirm to copy data.");
      return;
    }

    if (!replaceTarget) {
      throw new Error("Refusing to copy into a non-empty target mode. Pass --replace-target to truncate target tables first.");
    }

    await target.query("BEGIN");
    try {
      for (const tableName of truncateOrder) {
        await target.query(`TRUNCATE TABLE ${qualifiedTable(tableName)} RESTART IDENTITY CASCADE`);
      }

      for (const tableName of insertOrder) {
        const sourceTable = sourceTableMap.get(tableName)!;
        const targetTable = targetTableMap.get(tableName)!;
        const targetColumnMap = new Map(targetTable.columns.map((column) => [column.name, column]));
        const skippedColumns = sourceTable.columns
          .map((column) => column.name)
          .filter((column) => !targetColumnMap.has(column));
        if (skippedColumns.length > 0) {
          // eslint-disable-next-line no-console
          console.warn(`Skipping local-only column(s) on ${tableName}: ${skippedColumns.join(", ")}`);
        }

        const columns = sourceTable.columns.filter((column) => targetColumnMap.has(column.name));
        if (columns.length === 0) continue;

        const { rows } = await source.query(
          `SELECT ${columns.map((column) => quoteIdent(column.name)).join(", ")} FROM ${qualifiedTable(tableName)}`,
        );
        if (rows.length === 0) continue;

        const columnSql = columns.map((column) => quoteIdent(column.name)).join(", ");
        const valueSql: string[] = [];
        const values: unknown[] = [];

        rows.forEach((row, rowIndex) => {
          const placeholders = columns.map((column, columnIndex) => {
            const targetColumn = targetColumnMap.get(column.name)!;
            values.push(normalizeValueForColumn(row[column.name], targetColumn));
            return `$${rowIndex * columns.length + columnIndex + 1}`;
          });
          valueSql.push(`(${placeholders.join(", ")})`);
        });

        try {
          await target.query(
            `INSERT INTO ${qualifiedTable(tableName)} (${columnSql}) VALUES ${valueSql.join(", ")}`,
            values,
          );
        } catch (error: any) {
          throw new Error(`Failed copying ${tableName}: ${error?.message ?? String(error)}`, {
            cause: error,
          });
        }
      }

      await resetSequences(target);
      await target.query("COMMIT");
    } catch (error) {
      await target.query("ROLLBACK");
      throw error;
    }

    // eslint-disable-next-line no-console
    console.log("Data migration to Neon completed.");
  } finally {
    await source.end();
    await target.end();
  }
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error("Data migration failed:", error);
  process.exitCode = 1;
});
