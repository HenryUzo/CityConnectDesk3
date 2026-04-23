import { db } from "../db";
import { storage } from "../storage";
import {
  assetSubscriptions,
  maintenanceCategories,
  maintenanceItemTypes,
  maintenancePlans,
  maintenanceSchedules,
  residentAssets,
  serviceRequests,
  users,
  type InsertMaintenanceCategory,
  type InsertMaintenanceItemType,
  type InsertMaintenancePlan,
  type MaintenanceCategory,
  type MaintenanceItemType,
  type MaintenancePlan,
} from "../../shared/schema";
import { and, asc, eq } from "drizzle-orm";
import { normalizeAndPersistInventoryImages } from "../utils/inventory-image-storage";
import {
  buildMaintenanceCatalogTree,
  getDefaultVisitsIncluded,
  slugifyMaintenanceName,
  type SupportedMaintenanceDuration,
  validateVisitsIncludedForDuration,
} from "./maintenanceCatalogMath";

function badRequest(message: string) {
  const error = new Error(message);
  (error as any).status = 400;
  return error;
}

type MaintenanceItemAdminRow = {
  item: typeof maintenanceItemTypes.$inferSelect;
  category: typeof maintenanceCategories.$inferSelect;
};

type MaintenancePlanAdminRow = {
  plan: typeof maintenancePlans.$inferSelect;
  item: typeof maintenanceItemTypes.$inferSelect;
  category: typeof maintenanceCategories.$inferSelect;
};

function normalizeTaskSummary(value: unknown) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (!Array.isArray(value)) {
    throw badRequest("Tasks must be provided as an array of strings.");
  }

  const normalized = value
    .map((entry) => String(entry || "").trim())
    .filter(Boolean);

  return normalized;
}

async function normalizeMaintenanceItemImage(params: {
  imageUrl?: string | null;
  uploaderId: string;
  categoryId: string;
}) {
  if (params.imageUrl === undefined) return undefined;
  if (params.imageUrl === null) return null;

  const trimmed = String(params.imageUrl || "").trim();
  if (!trimmed) return null;

  const normalized = await normalizeAndPersistInventoryImages({
    images: [trimmed],
    storeId: `maintenance-${params.categoryId}`,
    uploaderId: params.uploaderId,
    maxImages: 1,
  });

  return normalized?.[0] ?? null;
}

async function ensureCategoryExists(categoryId: string) {
  const category = await storage.getMaintenanceCategory(categoryId);
  if (!category) {
    throw badRequest("Maintenance category not found.");
  }
  return category;
}

async function ensureItemExists(itemId: string) {
  const item = await storage.getMaintenanceItemType(itemId);
  if (!item) {
    throw badRequest("Maintenance item not found.");
  }
  return item;
}

async function ensureCategoryAllowsActiveItem(categoryId: string) {
  const category = await ensureCategoryExists(categoryId);
  if (!category.isActive) {
    throw badRequest("Cannot activate an item under an inactive maintenance category.");
  }
  return category;
}

async function ensureItemAllowsActivePlan(itemId: string) {
  const item = await ensureItemExists(itemId);
  const category = await ensureCategoryExists(item.categoryId);
  if (!item.isActive || !category.isActive) {
    throw badRequest("Cannot activate a plan under an inactive maintenance item or category.");
  }
  return { item, category };
}

async function ensureUniqueActivePlanDuration(params: {
  maintenanceItemId: string;
  durationType: string;
  excludePlanId?: string;
}) {
  const plans = await storage.listMaintenancePlans({
    maintenanceItemId: params.maintenanceItemId,
  });
  const conflicting = plans.find(
    (plan) =>
      plan.id !== params.excludePlanId &&
      plan.isActive &&
      plan.durationType === params.durationType,
  );

  if (conflicting) {
    throw badRequest("An active maintenance plan already exists for this item and duration.");
  }
}

async function ensureUniqueCategorySlug(slug: string, excludeId?: string) {
  const categories = await storage.listMaintenanceCategories();
  const conflict = categories.find(
    (category) => category.id !== excludeId && category.slug === slug,
  );
  if (conflict) {
    throw badRequest("A maintenance category with this slug already exists.");
  }
}

async function ensureUniqueItemSlug(slug: string, excludeId?: string) {
  const items = await storage.listMaintenanceItemTypes();
  const conflict = items.find((item) => item.id !== excludeId && item.slug === slug);
  if (conflict) {
    throw badRequest("A maintenance item with this slug already exists.");
  }
}

function buildCategoryCounts(categories: MaintenanceCategory[], items: MaintenanceItemType[], plans: MaintenancePlan[]) {
  return categories.map((category) => {
    const categoryItems = items.filter((item) => item.categoryId === category.id);
    const categoryPlans = plans.filter((plan) =>
      categoryItems.some((item) => item.id === plan.maintenanceItemId),
    );

    return {
      ...category,
      counts: {
        items: categoryItems.length,
        activeItems: categoryItems.filter((item) => item.isActive).length,
        plans: categoryPlans.length,
        activePlans: categoryPlans.filter((plan) => plan.isActive).length,
      },
    };
  });
}

export async function getMaintenanceCatalog(options?: {
  activeOnly?: boolean;
}) {
  const [categories, itemTypes, plans] = await Promise.all([
    storage.listMaintenanceCategories(options),
    storage.listMaintenanceItemTypes(options),
    storage.listMaintenancePlans(options),
  ]);

  return buildMaintenanceCatalogTree({
    categories,
    itemTypes,
    plans,
    activeOnly: options?.activeOnly,
  });
}

export async function getMaintenanceAdminCategoryRows(options?: {
  activeOnly?: boolean;
  isActive?: boolean;
  q?: string;
}) {
  const [categories, items, plans] = await Promise.all([
    storage.listMaintenanceCategories(options),
    storage.listMaintenanceItemTypes(),
    storage.listMaintenancePlans(),
  ]);

  return buildCategoryCounts(categories, items, plans);
}

export async function getMaintenanceAdminCategoryById(id: string) {
  const [category] = await Promise.all([storage.getMaintenanceCategory(id)]);
  if (!category) return null;

  const [items, plans] = await Promise.all([
    storage.listMaintenanceItemTypes({ categoryId: id }),
    storage.listMaintenancePlans(),
  ]);

  return buildCategoryCounts([category], items, plans)[0] ?? null;
}

export async function getMaintenanceAdminItemRows(options?: {
  categoryId?: string;
  activeOnly?: boolean;
  isActive?: boolean;
  q?: string;
}) {
  const whereParts: any[] = [];
  if (options?.categoryId) whereParts.push(eq(maintenanceItemTypes.categoryId, options.categoryId));
  if (options?.isActive !== undefined) {
    whereParts.push(eq(maintenanceItemTypes.isActive, options.isActive));
  } else if (options?.activeOnly) {
    whereParts.push(eq(maintenanceItemTypes.isActive, true));
  }
  const where = whereParts.length > 1 ? and(...whereParts) : whereParts[0];

  const baseQuery = db
    .select({
      item: maintenanceItemTypes,
      category: maintenanceCategories,
    })
    .from(maintenanceItemTypes)
    .innerJoin(
      maintenanceCategories,
      eq(maintenanceItemTypes.categoryId, maintenanceCategories.id),
    );
  const rows: MaintenanceItemAdminRow[] = where
    ? await baseQuery.where(where).orderBy(asc(maintenanceCategories.name), asc(maintenanceItemTypes.name))
    : await baseQuery.orderBy(asc(maintenanceCategories.name), asc(maintenanceItemTypes.name));

  const plans = await storage.listMaintenancePlans();
  const filteredRows = options?.q
    ? rows.filter(({ item, category }: MaintenanceItemAdminRow) => {
        const q = String(options.q || "").trim().toLowerCase();
        return (
          String(item.name || "").toLowerCase().includes(q) ||
          String(item.description || "").toLowerCase().includes(q) ||
          String(item.slug || "").toLowerCase().includes(q) ||
          String(category.name || "").toLowerCase().includes(q)
        );
      })
    : rows;

  return filteredRows.map(({ item, category }: MaintenanceItemAdminRow) => ({
    ...item,
    category,
    counts: {
      plans: plans.filter((plan) => plan.maintenanceItemId === item.id).length,
      activePlans: plans.filter(
        (plan) => plan.maintenanceItemId === item.id && plan.isActive,
      ).length,
    },
  }));
}

export async function getMaintenanceAdminItemById(id: string) {
  const [row] = await db
    .select({
      item: maintenanceItemTypes,
      category: maintenanceCategories,
    })
    .from(maintenanceItemTypes)
    .innerJoin(
      maintenanceCategories,
      eq(maintenanceItemTypes.categoryId, maintenanceCategories.id),
    )
    .where(eq(maintenanceItemTypes.id, id))
    .limit(1);

  if (!row) return null;
  const plans = await storage.listMaintenancePlans({ maintenanceItemId: id });
  return {
    ...row.item,
    category: row.category,
    plans,
  };
}

export async function getMaintenanceAdminPlanRows(options?: {
  maintenanceItemId?: string;
  durationType?: string;
  activeOnly?: boolean;
  isActive?: boolean;
  q?: string;
}) {
  const whereParts: any[] = [];
  if (options?.maintenanceItemId) {
    whereParts.push(eq(maintenancePlans.maintenanceItemId, options.maintenanceItemId));
  }
  if (options?.durationType) {
    whereParts.push(eq(maintenancePlans.durationType, options.durationType as any));
  }
  if (options?.isActive !== undefined) {
    whereParts.push(eq(maintenancePlans.isActive, options.isActive));
  } else if (options?.activeOnly) {
    whereParts.push(eq(maintenancePlans.isActive, true));
  }
  const where = whereParts.length > 1 ? and(...whereParts) : whereParts[0];

  const baseQuery = db
    .select({
      plan: maintenancePlans,
      item: maintenanceItemTypes,
      category: maintenanceCategories,
    })
    .from(maintenancePlans)
    .innerJoin(
      maintenanceItemTypes,
      eq(maintenancePlans.maintenanceItemId, maintenanceItemTypes.id),
    )
    .innerJoin(
      maintenanceCategories,
      eq(maintenanceItemTypes.categoryId, maintenanceCategories.id),
    );
  const rows: MaintenancePlanAdminRow[] = where
    ? await baseQuery.where(where).orderBy(
        asc(maintenanceCategories.name),
        asc(maintenanceItemTypes.name),
        asc(maintenancePlans.durationType),
      )
    : await baseQuery.orderBy(
        asc(maintenanceCategories.name),
        asc(maintenanceItemTypes.name),
        asc(maintenancePlans.durationType),
      );

  const filteredRows = options?.q
    ? rows.filter(({ plan, item, category }: MaintenancePlanAdminRow) => {
        const q = String(options.q || "").trim().toLowerCase();
        return (
          String(plan.name || "").toLowerCase().includes(q) ||
          String(plan.description || "").toLowerCase().includes(q) ||
          String(item.name || "").toLowerCase().includes(q) ||
          String(category.name || "").toLowerCase().includes(q)
        );
      })
    : rows;

  return filteredRows.map(({ plan, item, category }: MaintenancePlanAdminRow) => ({
    ...plan,
    item,
    category,
  }));
}

export async function getMaintenanceAdminPlanById(id: string) {
  const [row] = await db
    .select({
      plan: maintenancePlans,
      item: maintenanceItemTypes,
      category: maintenanceCategories,
    })
    .from(maintenancePlans)
    .innerJoin(
      maintenanceItemTypes,
      eq(maintenancePlans.maintenanceItemId, maintenanceItemTypes.id),
    )
    .innerJoin(
      maintenanceCategories,
      eq(maintenanceItemTypes.categoryId, maintenanceCategories.id),
    )
    .where(eq(maintenancePlans.id, id))
    .limit(1);

  if (!row) return null;
  return {
    ...row.plan,
    item: row.item,
    category: row.category,
  };
}

export async function createMaintenanceCategoryAdmin(input: {
  name: string;
  slug?: string | null;
  icon?: string | null;
  description?: string | null;
  isActive?: boolean;
}) {
  const slug = slugifyMaintenanceName(input.slug || input.name);
  if (!slug) {
    throw badRequest("A valid category slug could not be derived.");
  }
  await ensureUniqueCategorySlug(slug);

  return await storage.createMaintenanceCategory({
    name: input.name.trim(),
    slug,
    icon: input.icon ?? null,
    description: input.description ?? null,
    isActive: input.isActive ?? true,
  } as InsertMaintenanceCategory);
}

export async function updateMaintenanceCategoryAdmin(
  id: string,
  input: Partial<{
    name: string;
    slug: string | null;
    icon: string | null;
    description: string | null;
    isActive: boolean;
  }>,
) {
  const existing = await storage.getMaintenanceCategory(id);
  if (!existing) return undefined;

  const nextName = input.name !== undefined ? input.name.trim() : existing.name;
  const nextSlug =
    input.slug !== undefined ? slugifyMaintenanceName(input.slug || nextName) : existing.slug;
  if (!nextSlug) {
    throw badRequest("A valid category slug could not be derived.");
  }
  await ensureUniqueCategorySlug(nextSlug, id);

  return await storage.updateMaintenanceCategory(id, {
    name: nextName,
    slug: nextSlug,
    icon: input.icon !== undefined ? input.icon ?? null : undefined,
    description: input.description !== undefined ? input.description ?? null : undefined,
    isActive: input.isActive,
  } as Partial<MaintenanceCategory>);
}

export async function createMaintenanceItemAdmin(
  input: {
    categoryId: string;
    name: string;
    slug?: string | null;
    description?: string | null;
    defaultFrequency?: SupportedMaintenanceDuration | null;
    recommendedTasks?: unknown;
    imageUrl?: string | null;
    isActive?: boolean;
  },
  actorId: string,
) {
  if (input.isActive ?? true) {
    await ensureCategoryAllowsActiveItem(input.categoryId);
  } else {
    await ensureCategoryExists(input.categoryId);
  }

  const imageUrl = await normalizeMaintenanceItemImage({
    imageUrl: input.imageUrl,
    uploaderId: actorId,
    categoryId: input.categoryId,
  });

  const slug = slugifyMaintenanceName(input.slug || input.name);
  if (!slug) {
    throw badRequest("A valid item slug could not be derived.");
  }
  await ensureUniqueItemSlug(slug);

  return await storage.createMaintenanceItemType({
    categoryId: input.categoryId,
    name: input.name.trim(),
    slug,
    description: input.description ?? null,
    defaultFrequency: input.defaultFrequency ?? null,
    recommendedTasks: normalizeTaskSummary(input.recommendedTasks) ?? null,
    imageUrl,
    isActive: input.isActive ?? true,
  } as InsertMaintenanceItemType);
}

export async function updateMaintenanceItemAdmin(
  id: string,
  input: Partial<{
    categoryId: string;
    name: string;
    slug: string | null;
    description: string | null;
    defaultFrequency: SupportedMaintenanceDuration | null;
    recommendedTasks: unknown;
    imageUrl: string | null;
    isActive: boolean;
  }>,
  actorId: string,
) {
  const existing = await storage.getMaintenanceItemType(id);
  if (!existing) return undefined;

  const nextCategoryId = input.categoryId ?? existing.categoryId;
  const nextName = input.name !== undefined ? input.name.trim() : existing.name;
  const nextIsActive = input.isActive ?? existing.isActive;
  const nextSlug =
    input.slug !== undefined
      ? slugifyMaintenanceName(input.slug || nextName)
      : input.name !== undefined
        ? slugifyMaintenanceName(nextName)
        : existing.slug;
  if (nextIsActive) {
    await ensureCategoryAllowsActiveItem(nextCategoryId);
  } else {
    await ensureCategoryExists(nextCategoryId);
  }
  if (!nextSlug) {
    throw badRequest("A valid item slug could not be derived.");
  }
  await ensureUniqueItemSlug(nextSlug, id);

  const imageUrl = await normalizeMaintenanceItemImage({
    imageUrl: input.imageUrl,
    uploaderId: actorId,
    categoryId: nextCategoryId,
  });

  return await storage.updateMaintenanceItemType(id, {
    categoryId: nextCategoryId,
    name: nextName,
    slug: nextSlug,
    description: input.description !== undefined ? input.description ?? null : undefined,
    defaultFrequency:
      input.defaultFrequency !== undefined ? input.defaultFrequency ?? null : undefined,
    recommendedTasks:
      input.recommendedTasks !== undefined
        ? normalizeTaskSummary(input.recommendedTasks) ?? null
        : undefined,
    imageUrl,
    isActive: input.isActive,
  } as Partial<MaintenanceItemType>);
}

export async function createMaintenancePlanAdmin(input: {
  maintenanceItemId: string;
  name: string;
  description?: string | null;
  durationType: SupportedMaintenanceDuration;
  price: string;
  currency?: string | null;
  visitsIncluded?: number;
  includedTasks?: unknown;
  requestLeadDays?: number;
  isActive?: boolean;
}) {
  const visitsIncluded = input.visitsIncluded ?? getDefaultVisitsIncluded(input.durationType);
  validateVisitsIncludedForDuration(input.durationType, visitsIncluded);

  if (input.isActive ?? true) {
    await ensureItemAllowsActivePlan(input.maintenanceItemId);
    await ensureUniqueActivePlanDuration({
      maintenanceItemId: input.maintenanceItemId,
      durationType: input.durationType,
    });
  } else {
    await ensureItemExists(input.maintenanceItemId);
  }

  return await storage.createMaintenancePlan({
    maintenanceItemId: input.maintenanceItemId,
    name: input.name.trim(),
    description: input.description ?? null,
    durationType: input.durationType,
    price: input.price,
    currency: input.currency?.trim() || "NGN",
    visitsIncluded,
    includedTasks: normalizeTaskSummary(input.includedTasks) ?? null,
    requestLeadDays: input.requestLeadDays ?? 3,
    isActive: input.isActive ?? true,
  } as InsertMaintenancePlan);
}

export async function updateMaintenancePlanAdmin(
  id: string,
  input: Partial<{
    maintenanceItemId: string;
    name: string;
    description: string | null;
    durationType: SupportedMaintenanceDuration;
    price: string;
    currency: string | null;
    visitsIncluded: number;
    includedTasks: unknown;
    requestLeadDays: number;
    isActive: boolean;
  }>,
) {
  const existing = await storage.getMaintenancePlan(id);
  if (!existing) return undefined;

  const nextItemId = input.maintenanceItemId ?? existing.maintenanceItemId;
  const nextDurationType = (input.durationType ?? existing.durationType) as SupportedMaintenanceDuration;
  const nextVisitsIncluded = input.visitsIncluded ?? existing.visitsIncluded;
  const nextIsActive = input.isActive ?? existing.isActive;

  validateVisitsIncludedForDuration(nextDurationType, nextVisitsIncluded);

  if (nextIsActive) {
    await ensureItemAllowsActivePlan(nextItemId);
    await ensureUniqueActivePlanDuration({
      maintenanceItemId: nextItemId,
      durationType: nextDurationType,
      excludePlanId: id,
    });
  } else {
    await ensureItemExists(nextItemId);
  }

  return await storage.updateMaintenancePlan(id, {
    maintenanceItemId: nextItemId,
    name: input.name !== undefined ? input.name.trim() : undefined,
    description: input.description !== undefined ? input.description ?? null : undefined,
    durationType: nextDurationType,
    price: input.price,
    currency: input.currency !== undefined ? input.currency?.trim() || "NGN" : undefined,
    visitsIncluded: nextVisitsIncluded,
    includedTasks:
      input.includedTasks !== undefined
        ? normalizeTaskSummary(input.includedTasks) ?? null
        : undefined,
    requestLeadDays: input.requestLeadDays,
    isActive: input.isActive,
  } as Partial<MaintenancePlan>);
}

export async function getMaintenanceAdminScheduleRows(options?: { status?: string }) {
  const where = options?.status
    ? eq(maintenanceSchedules.status, options.status as any)
    : undefined;
  const query = db
    .select({
      schedule: maintenanceSchedules,
      subscription: assetSubscriptions,
      asset: residentAssets,
      itemType: maintenanceItemTypes,
      plan: maintenancePlans,
      category: maintenanceCategories,
      request: serviceRequests,
      provider: users,
    })
    .from(maintenanceSchedules)
    .innerJoin(
      assetSubscriptions,
      eq(maintenanceSchedules.subscriptionId, assetSubscriptions.id),
    )
    .innerJoin(
      residentAssets,
      eq(assetSubscriptions.residentAssetId, residentAssets.id),
    )
    .innerJoin(
      maintenanceItemTypes,
      eq(residentAssets.maintenanceItemId, maintenanceItemTypes.id),
    )
    .innerJoin(
      maintenanceCategories,
      eq(maintenanceItemTypes.categoryId, maintenanceCategories.id),
    )
    .innerJoin(
      maintenancePlans,
      eq(assetSubscriptions.maintenancePlanId, maintenancePlans.id),
    )
    .leftJoin(
      serviceRequests,
      eq(maintenanceSchedules.sourceRequestId, serviceRequests.id),
    )
    .leftJoin(
      users,
      eq(serviceRequests.providerId, users.id),
    );

  const rows = where
    ? await query.where(where).orderBy(asc(maintenanceSchedules.scheduledDate))
    : await query.orderBy(asc(maintenanceSchedules.scheduledDate));

  return rows.map((row: any) => {
    const providerName =
      [row.provider?.firstName, row.provider?.lastName].filter(Boolean).join(" ").trim() ||
      row.provider?.name ||
      null;

    return {
      id: row.schedule.id,
      status: row.schedule.status,
      scheduledDate: row.schedule.scheduledDate,
      createdAt: row.schedule.createdAt,
      updatedAt: row.schedule.updatedAt,
      completedAt: row.schedule.completedAt,
      skippedAt: row.schedule.skippedAt,
      sourceRequestId: row.schedule.sourceRequestId,
      notes: row.schedule.notes,
      subscription: {
        id: row.subscription.id,
        status: row.subscription.status,
        startDate: row.subscription.startDate,
        endDate: row.subscription.endDate,
      },
      asset: {
        id: row.asset.id,
        userId: row.asset.userId,
        name: row.asset.customName || row.itemType.name,
        customName: row.asset.customName,
        locationLabel: row.asset.locationLabel,
        condition: row.asset.condition,
      },
      item: {
        id: row.itemType.id,
        name: row.itemType.name,
        slug: row.itemType.slug,
      },
      category: {
        id: row.category.id,
        name: row.category.name,
        icon: row.category.icon,
      },
      plan: {
        id: row.plan.id,
        name: row.plan.name,
        durationType: row.plan.durationType,
        price: row.plan.price,
        currency: row.plan.currency,
        visitsIncluded: row.plan.visitsIncluded,
      },
      request: row.request
        ? {
            id: row.request.id,
            status: row.request.status,
            providerId: row.request.providerId,
          }
        : null,
      provider: row.provider
        ? {
            id: row.provider.id,
            name: providerName,
            email: row.provider.email,
          }
        : null,
    };
  });
}
