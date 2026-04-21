export type CategoryKind = "service" | "item";

const CACHE_KEYS: Record<CategoryKind, string> = {
  service: "cc_service_categories_cache_v1",
  item: "cc_item_categories_cache_v1",
};

export type CategoryItem = {
  id?: string;
  key?: string;
  name: string;
  emoji?: string;
  providerCount?: number;
};

function getCacheKey(kind: CategoryKind) {
  return CACHE_KEYS[kind];
}

export function readCategoriesCache(kind: CategoryKind = "service"): CategoryItem[] | null {
  try {
    const raw = localStorage.getItem(getCacheKey(kind));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeCategoriesCache(items: CategoryItem[], kind: CategoryKind = "service") {
  try {
    localStorage.setItem(getCacheKey(kind), JSON.stringify(items));
  } catch {
    // ignore
  }
}

export async function fetchCategories(
  scope = "global",
  kind: CategoryKind = "service",
): Promise<CategoryItem[]> {
  try {
    const endpoint =
      kind === "item"
        ? "/api/item-categories"
        : `/api/categories?scope=${encodeURIComponent(scope || "global")}`;

    const res = await fetch(endpoint);
    if (!res.ok) return [];

    const data = await res.json();
    const rows = (Array.isArray(data) ? data : []).filter((c: any) => c?.isActive !== false);
    const mapped: CategoryItem[] = rows.map((c: any) => ({
      id: c.id ?? c._id,
      key: c.key ?? c.categoryKey ?? c.slug ?? c.name,
      name: c.name ?? String(c.key ?? c.categoryKey ?? c.id ?? ""),
      emoji: c.emoji ?? c.icon ?? "",
      providerCount: typeof c.providerCount === "number" ? c.providerCount : 0,
    }));

    writeCategoriesCache(mapped, kind);
    return mapped;
  } catch (e) {
    console.warn("fetchCategories failed", e);
    return [];
  }
}

