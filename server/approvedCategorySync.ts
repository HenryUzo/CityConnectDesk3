import { asc, desc, eq, inArray } from "drizzle-orm";
import { db } from "./db";
import { aiConversationFlowSettings, categories } from "@shared/schema";

type ServiceCategoryRow = {
  id: string;
  name: string;
  key: string;
  emoji: string | null;
  description: string | null;
  isActive: boolean;
};

function normalizeCategoryKey(value: string | null | undefined) {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function normalizeCategoryName(value: string | null | undefined) {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

async function getGlobalServiceCategories(): Promise<ServiceCategoryRow[]> {
  const rows = await db
    .select({
      id: categories.id,
      name: categories.name,
      key: categories.key,
      emoji: categories.emoji,
      description: categories.description,
      isActive: categories.isActive,
    })
    .from(categories)
    .where(eq(categories.scope, "global"))
    .orderBy(asc(categories.createdAt));
  return rows as ServiceCategoryRow[];
}

export async function backfillApprovedCategoriesFromServiceCategories() {
  const sourceCategories = await getGlobalServiceCategories();
  const existingSettings = await db
    .select({
      id: aiConversationFlowSettings.id,
      categoryKey: aiConversationFlowSettings.categoryKey,
      categoryName: aiConversationFlowSettings.categoryName,
      emoji: aiConversationFlowSettings.emoji,
      description: aiConversationFlowSettings.description,
      displayOrder: aiConversationFlowSettings.displayOrder,
    })
    .from(aiConversationFlowSettings)
    .orderBy(asc(aiConversationFlowSettings.displayOrder));

  const byKey = new Map<string, (typeof existingSettings)[number]>();
  const byName = new Map<string, (typeof existingSettings)[number]>();
  let maxOrder = 0;
  for (const row of existingSettings) {
    const normalizedKey = normalizeCategoryKey(row.categoryKey);
    const normalizedName = normalizeCategoryName(row.categoryName);
    if (normalizedKey) byKey.set(normalizedKey, row);
    if (normalizedName) byName.set(normalizedName, row);
    maxOrder = Math.max(maxOrder, Number(row.displayOrder || 0));
  }

  let inserted = 0;
  let updated = 0;
  for (const category of sourceCategories) {
    const normalizedKey = normalizeCategoryKey(category.key || category.name);
    const normalizedName = normalizeCategoryName(category.name);
    if (!normalizedKey || !normalizedName) continue;

    const existing = byKey.get(normalizedKey) || byName.get(normalizedName);
    if (!existing) {
      const [created] = await db
        .insert(aiConversationFlowSettings)
        .values({
          categoryKey: normalizedKey,
          categoryName: category.name,
          isEnabled: category.isActive !== false,
          displayOrder: maxOrder + 1,
          emoji: category.emoji || null,
          description: category.description || null,
          followUpSteps: [],
          confidenceThreshold: 70,
          visualsHelpful: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning({
          id: aiConversationFlowSettings.id,
          categoryKey: aiConversationFlowSettings.categoryKey,
          categoryName: aiConversationFlowSettings.categoryName,
          emoji: aiConversationFlowSettings.emoji,
          description: aiConversationFlowSettings.description,
          displayOrder: aiConversationFlowSettings.displayOrder,
        });

      inserted += 1;
      maxOrder += 1;
      if (created) {
        byKey.set(normalizedKey, created);
        byName.set(normalizedName, created);
      }
      continue;
    }

    const patch: Partial<typeof existing> & { updatedAt?: Date } = {};
    let hasChange = false;
    if ((existing.categoryName || "").trim() !== (category.name || "").trim()) {
      patch.categoryName = category.name;
      hasChange = true;
    }
    if ((existing.categoryKey || "").trim() !== normalizedKey) {
      patch.categoryKey = normalizedKey;
      hasChange = true;
    }
    if (!existing.emoji && category.emoji) {
      patch.emoji = category.emoji;
      hasChange = true;
    }
    if (!existing.description && category.description) {
      patch.description = category.description;
      hasChange = true;
    }

    if (hasChange) {
      await db
        .update(aiConversationFlowSettings)
        .set({ ...patch, updatedAt: new Date() })
        .where(eq(aiConversationFlowSettings.id, existing.id));
      updated += 1;
    }
  }

  return { inserted, updated, sourceCount: sourceCategories.length };
}

export async function upsertApprovedCategoryFromServiceCategory(
  category: ServiceCategoryRow | null | undefined,
) {
  if (!category) return null;
  const normalizedKey = normalizeCategoryKey(category.key || category.name);
  if (!normalizedKey) return null;

  const [existing] = await db
    .select({ id: aiConversationFlowSettings.id })
    .from(aiConversationFlowSettings)
    .where(eq(aiConversationFlowSettings.categoryKey, normalizedKey))
    .limit(1);

  if (existing) {
    await db
      .update(aiConversationFlowSettings)
      .set({
        categoryName: category.name,
        categoryKey: normalizedKey,
        updatedAt: new Date(),
      })
      .where(eq(aiConversationFlowSettings.id, existing.id));
    return existing.id;
  }

  const [maxOrderRow] = await db
    .select({
      maxOrder: aiConversationFlowSettings.displayOrder,
    })
    .from(aiConversationFlowSettings)
    .orderBy(desc(aiConversationFlowSettings.displayOrder))
    .limit(1);
  const [created] = await db
    .insert(aiConversationFlowSettings)
    .values({
      categoryKey: normalizedKey,
      categoryName: category.name,
      isEnabled: category.isActive !== false,
      displayOrder: Number(maxOrderRow?.maxOrder ?? 0) + 1,
      emoji: category.emoji || null,
      description: category.description || null,
      followUpSteps: [],
      confidenceThreshold: 70,
      visualsHelpful: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning({ id: aiConversationFlowSettings.id });
  return created?.id ?? null;
}

export async function syncApprovedCategoryAfterServiceCategoryUpdate(
  beforeCategory: ServiceCategoryRow | null | undefined,
  afterCategory: ServiceCategoryRow | null | undefined,
) {
  if (!afterCategory) return null;
  const previousKey = normalizeCategoryKey(beforeCategory?.key || beforeCategory?.name);
  const previousName = normalizeCategoryName(beforeCategory?.name);
  const nextKey = normalizeCategoryKey(afterCategory.key || afterCategory.name);
  const nextName = normalizeCategoryName(afterCategory.name);

  const allSettings: Array<{ id: string; categoryKey: string; categoryName: string }> = await db
    .select({
      id: aiConversationFlowSettings.id,
      categoryKey: aiConversationFlowSettings.categoryKey,
      categoryName: aiConversationFlowSettings.categoryName,
    })
    .from(aiConversationFlowSettings);

  const matching = allSettings.find((setting) => {
    const settingKey = normalizeCategoryKey(setting.categoryKey);
    const settingName = normalizeCategoryName(setting.categoryName);
    return (
      (previousKey && settingKey === previousKey) ||
      (previousName && settingName === previousName) ||
      (nextKey && settingKey === nextKey) ||
      (nextName && settingName === nextName)
    );
  });

  if (!matching) {
    return upsertApprovedCategoryFromServiceCategory(afterCategory);
  }

  await db
    .update(aiConversationFlowSettings)
    .set({
      categoryKey: nextKey,
      categoryName: afterCategory.name,
      updatedAt: new Date(),
    })
    .where(eq(aiConversationFlowSettings.id, matching.id));

  return matching.id;
}

export async function removeApprovedCategoryForServiceCategory(
  category: ServiceCategoryRow | null | undefined,
) {
  if (!category) return 0;
  const key = normalizeCategoryKey(category.key || category.name);
  const name = normalizeCategoryName(category.name);

  const allSettings: Array<{ id: string; categoryKey: string; categoryName: string }> = await db
    .select({
      id: aiConversationFlowSettings.id,
      categoryKey: aiConversationFlowSettings.categoryKey,
      categoryName: aiConversationFlowSettings.categoryName,
    })
    .from(aiConversationFlowSettings);

  const idsToDelete = allSettings
    .filter((setting) => {
      const settingKey = normalizeCategoryKey(setting.categoryKey);
      const settingName = normalizeCategoryName(setting.categoryName);
      return (key && settingKey === key) || (name && settingName === name);
    })
    .map((setting) => setting.id);

  if (!idsToDelete.length) return 0;

  await db
    .delete(aiConversationFlowSettings)
    .where(inArray(aiConversationFlowSettings.id, idsToDelete));
  return idsToDelete.length;
}
