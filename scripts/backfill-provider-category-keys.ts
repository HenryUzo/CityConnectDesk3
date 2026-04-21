import { db, dbReady } from "../server/db";
import { categories, users } from "@shared/schema";
import { eq } from "drizzle-orm";

const normalize = (value?: string | null) => String(value || "").trim().toLowerCase();

async function run() {
  await dbReady;

  const categoryRows = await db.select({ id: categories.id, key: categories.key }).from(categories);
  const idToKey = new Map<string, string>();
  const keySet = new Set<string>();

  for (const row of categoryRows) {
    if (row?.id && row?.key) {
      idToKey.set(String(row.id), normalize(String(row.key)));
      keySet.add(normalize(String(row.key)));
    }
  }

  const providers = await db
    .select({ id: users.id, categories: users.categories })
    .from(users)
    .where(eq(users.role, "provider"));

  let updated = 0;
  let total = 0;

  for (const provider of providers) {
    total += 1;
    const original = Array.isArray(provider.categories) ? provider.categories : [];
    if (!original.length) continue;

    const next = Array.from(
      new Set(
        original
          .map((entry) => {
            const raw = String(entry || "").trim();
            if (!raw) return null;
            const normalized = normalize(raw);
            if (idToKey.has(raw)) return idToKey.get(raw) || normalized;
            if (idToKey.has(normalized)) return idToKey.get(normalized) || normalized;
            if (keySet.has(normalized)) return normalized;
            return normalized;
          })
          .filter(Boolean)
      )
    ) as string[];

    const originalNormalized = original.map((entry) => normalize(entry));
    const isSame =
      next.length === originalNormalized.length &&
      next.every((value, idx) => value === originalNormalized[idx]);

    if (!isSame) {
      await db.update(users).set({ categories: next }).where(eq(users.id, provider.id));
      updated += 1;
    }
  }

  console.log(`[backfill] Providers checked: ${total}`);
  console.log(`[backfill] Providers updated: ${updated}`);
}

run().catch((error) => {
  console.error("[backfill] Failed", error);
  process.exit(1);
});
