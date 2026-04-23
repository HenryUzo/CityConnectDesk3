import { count, sql } from "drizzle-orm";
import { db, dbReady, pool } from "../server/db";
import { users } from "../shared/schema";

const ADMIN_ROLES = ["admin", "super_admin", "estate_admin"] as const;
const ADMIN_ROLE_SQL_LIST = ADMIN_ROLES.map((role) => `'${role}'`).join(", ");

const DATA_TABLE_DELETE_ORDER = [
  "session",
  "refresh_tokens",
  "otp_challenges",
  "pending_registrations",
  "user_device_sessions",
  "resident_notification_preferences",
  "resident_settings",
  "notifications",

  "conversation_messages",
  "conversations",
  "ai_session_attachments",
  "ai_session_messages",
  "ai_sessions",
  "ai_prepared_requests",
  "ordinary_flow_answers",
  "ordinary_flow_sessions",

  "maintenance_schedules",
  "asset_subscriptions",
  "resident_assets",

  "company_task_updates",
  "company_tasks",
  "companies",
  "service_request_cancellation_cases",
  "request_bill_items",
  "request_bills",
  "inspections",
  "request_messages",
  "transactions",
  "service_requests",
  "wallets",

  "refunds",
  "marketplace_payments",
  "store_order_items",
  "store_orders",
  "parent_orders",
  "cart_items",
  "carts",
  "orders",
  "inventory",
  "marketplace_items",
  "store_estates",
  "store_members",
  "stores",

  "membership_roles",
  "memberships",
  "device_assignments",
  "impersonation_sessions",
  "provider_requests",
] as const;

function quoteIdent(identifier: string) {
  if (!/^[a-z_][a-z0-9_]*$/i.test(identifier)) {
    throw new Error(`Unsafe SQL identifier: ${identifier}`);
  }
  return `"${identifier}"`;
}

async function executeStatement(statement: string) {
  await db.execute(sql.raw(statement));
}

async function deleteAllIfExists(tableName: string) {
  try {
    await executeStatement(`DELETE FROM ${quoteIdent(tableName)}`);
    return true;
  } catch (error: any) {
    if (error?.code === "42P01") return false;
    throw error;
  }
}

async function scalarNumber(query: any) {
  const result = await db.execute(query);
  const rows = Array.isArray(result) ? result : result?.rows;
  const first = rows?.[0] ?? {};
  return Number(first.value ?? first.count ?? 0);
}

async function clearNonAdminUsers() {
  await dbReady;

  const [beforeUsers] = await db.select({ c: count() }).from(users);
  const [beforeAdmins] = await db
    .select({ c: count() })
    .from(users)
    .where(sql.raw(`
      lower(coalesce(role::text, '')) IN (${ADMIN_ROLE_SQL_LIST})
      OR lower(coalesce(global_role::text, '')) IN (${ADMIN_ROLE_SQL_LIST})
    `));

  await executeStatement(`
    CREATE TABLE IF NOT EXISTS cc_reset_target_users (
      id varchar PRIMARY KEY
    )
  `);
  await executeStatement("TRUNCATE TABLE cc_reset_target_users");

  await executeStatement(`
    INSERT INTO cc_reset_target_users (id)
    SELECT id
    FROM users
    WHERE NOT (
      lower(coalesce(role::text, '')) IN ('admin', 'super_admin', 'estate_admin')
      OR lower(coalesce(global_role::text, '')) IN ('admin', 'super_admin', 'estate_admin')
    )
    ON CONFLICT DO NOTHING
  `);

  const targetCount = await scalarNumber(sql.raw("SELECT count(*) AS value FROM cc_reset_target_users"));

  for (const tableName of DATA_TABLE_DELETE_ORDER) {
    await deleteAllIfExists(tableName);
  }

  // Some configuration/history tables may contain nullable admin/user pointers.
  // Null nullable pointers to removed users; delete non-nullable residual rows.
  await executeStatement(`
    DO $$
    DECLARE
      fk record;
      is_nullable boolean;
    BEGIN
      FOR fk IN
        SELECT
          ns.nspname AS schema_name,
          child.relname AS table_name,
          att.attname AS column_name,
          att.attnotnull AS is_not_null
        FROM pg_constraint con
        JOIN pg_class child ON child.oid = con.conrelid
        JOIN pg_namespace ns ON ns.oid = child.relnamespace
        JOIN pg_attribute att ON att.attrelid = child.oid AND att.attnum = con.conkey[1]
        JOIN pg_class parent ON parent.oid = con.confrelid
        JOIN pg_namespace parent_ns ON parent_ns.oid = parent.relnamespace
        WHERE con.contype = 'f'
          AND parent_ns.nspname = 'public'
          AND parent.relname = 'users'
          AND array_length(con.conkey, 1) = 1
          AND ns.nspname = 'public'
          AND child.relname <> 'users'
      LOOP
        is_nullable := NOT fk.is_not_null;
        IF is_nullable THEN
          EXECUTE format(
            'UPDATE %I.%I SET %I = NULL WHERE %I IN (SELECT id FROM cc_reset_target_users)',
            fk.schema_name,
            fk.table_name,
            fk.column_name,
            fk.column_name
          );
        ELSE
          EXECUTE format(
            'DELETE FROM %I.%I WHERE %I IN (SELECT id FROM cc_reset_target_users)',
            fk.schema_name,
            fk.table_name,
            fk.column_name
          );
        END IF;
      END LOOP;
    END $$;
  `);

  await executeStatement(`
    DELETE FROM audit_logs
    WHERE actor_id IN (SELECT id FROM cc_reset_target_users)
  `);

  await executeStatement(`
    DELETE FROM users
    WHERE id IN (SELECT id FROM cc_reset_target_users)
  `);

  const [afterUsers] = await db.select({ c: count() }).from(users);
  const [afterAdmins] = await db
    .select({ c: count() })
    .from(users)
    .where(sql.raw(`
      lower(coalesce(role::text, '')) IN (${ADMIN_ROLE_SQL_LIST})
      OR lower(coalesce(global_role::text, '')) IN (${ADMIN_ROLE_SQL_LIST})
    `));

  // eslint-disable-next-line no-console
  console.log("Cleared non-admin users and user-owned runtime data.");
  // eslint-disable-next-line no-console
  console.log("Counts:", {
    usersBefore: Number(beforeUsers?.c ?? 0),
    adminUsersBefore: Number(beforeAdmins?.c ?? 0),
    targetedNonAdminUsers: targetCount,
    usersAfter: Number(afterUsers?.c ?? 0),
    adminUsersAfter: Number(afterAdmins?.c ?? 0),
  });

  await executeStatement("DROP TABLE IF EXISTS cc_reset_target_users");
}

clearNonAdminUsers()
  .catch((error) => {
    // eslint-disable-next-line no-console
    console.error("Failed to clear non-admin users:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (typeof pool?.end === "function") {
      await pool.end();
    }
  });
