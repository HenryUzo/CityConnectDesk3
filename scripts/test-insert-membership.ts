import { db, dbReady } from "../server/db";
import { sql } from "drizzle-orm";

const userId = process.env.TEST_PROVIDER_ID || "4b075430-f468-4148-933a-916ebdb9e705";
const estateId = process.env.TEST_ESTATE_ID || "b45f4ce8-21fc-4960-9333-3e1a014fb60b";

async function main() {
  await dbReady;
  const res = await db.execute(
    sql`insert into memberships (user_id, estate_id, role) values (${userId}, ${estateId}, 'provider') on conflict (user_id, estate_id) do nothing returning *;`,
  );
  console.log("Insert result:", res.rows);
}

main().then(() => process.exit(0)).catch((err) => {
  console.error(err);
  process.exit(1);
});
