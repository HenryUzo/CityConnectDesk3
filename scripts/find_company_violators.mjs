import "dotenv/config";
import { Pool } from "pg";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL environment variable is required");
  process.exit(1);
}

const pool = new Pool({ connectionString: DATABASE_URL });

const flagViolator = async (client, userId, reason, details) => {
  await client.query(
    `INSERT INTO audit_logs (actor_id, action, target, target_id, meta, created_at)
     VALUES ($1, $2, $3, $4, $5, NOW())`,
    ["system", "company_conflict", "user", userId, JSON.stringify({ reason, ...details })],
  );
};

const main = async () => {
  const client = await pool.connect();
  try {
    const providers = await client.query(
      `SELECT id, company
       FROM users
       WHERE role = 'provider' AND company IS NOT NULL AND company <> ''`,
    );

    const violators = [];

    for (const row of providers.rows) {
      const userId = row.id;
      const companyId = String(row.company || "").trim();
      if (!companyId) continue;

      const owned = await client.query(
        `SELECT id FROM companies WHERE provider_id = $1 AND id <> $2 LIMIT 1`,
        [userId, companyId],
      );
      if (owned.rows.length > 0) {
        violators.push({ userId, reason: "owns_other_company", companyId, ownedId: owned.rows[0].id });
        await flagViolator(client, userId, "owns_other_company", {
          companyId,
          ownedId: owned.rows[0].id,
        });
        continue;
      }

      const membershipConflict = await client.query(
        `SELECT sm.store_id, s.company_id
         FROM store_members sm
         JOIN stores s ON s.id = sm.store_id
         WHERE sm.user_id = $1
           AND sm.is_active = true
           AND s.company_id IS NOT NULL
           AND s.company_id <> $2
         LIMIT 1`,
        [userId, companyId],
      );
      if (membershipConflict.rows.length > 0) {
        violators.push({
          userId,
          reason: "member_other_company_store",
          companyId,
          storeId: membershipConflict.rows[0].store_id,
          otherCompanyId: membershipConflict.rows[0].company_id,
        });
        await flagViolator(client, userId, "member_other_company_store", {
          companyId,
          storeId: membershipConflict.rows[0].store_id,
          otherCompanyId: membershipConflict.rows[0].company_id,
        });
      }
    }

    console.log("Providers violating one-company rule:", violators);
  } finally {
    client.release();
    await pool.end();
  }
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
