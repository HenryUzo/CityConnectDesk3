// Use a distinct cache key for marketplace item categories to avoid
// colliding with any legacy service-category cache entries.
const CACHE_KEY = "cc_item_categories_cache_v1";

export type CategoryItem = {
  id?: string;
  key?: string;
  name: string;
  emoji?: string;
  providerCount?: number;
};

export function readCategoriesCache(): CategoryItem[] | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeCategoriesCache(items: CategoryItem[]) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(items));
  } catch {
    // ignore
  }
}

export async function fetchCategories(scope = "global"): Promise<CategoryItem[]> {
  try {
    // Fetch item categories for marketplace, not service categories
    const res = await fetch(`/api/item-categories`);
    if (!res.ok) return [];
    const data = await res.json();
    const mapped: CategoryItem[] = (Array.isArray(data) ? data : []).map((c: any) => ({
      id: c.id ?? c._id,
      key: c.key,
      name: c.name ?? String(c.key ?? c.id ?? ""),
      emoji: c.emoji ?? c.icon ?? "",
      providerCount: typeof c.providerCount === "number" ? c.providerCount : 0,
    }));
    writeCategoriesCache(mapped);
    return mapped;
  } catch (e) {
    console.warn("fetchCategories failed", e);
    return [];
  }
}
