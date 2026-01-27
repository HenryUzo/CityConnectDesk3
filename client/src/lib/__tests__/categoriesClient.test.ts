import { describe, it, expect, beforeEach, vi } from "vitest";
import { fetchCategories, readCategoriesCache } from "../categoriesClient";

describe("categoriesClient", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("normalizes server data and writes cache", async () => {
    const serverData = [
      { id: "1", key: "cleaning_janitorial", name: "Cleaning & janitorial", emoji: "🧹", providerCount: 19 },
      { _id: "2", key: "surveillance_monitoring", name: "Surveillance monitoring", icon: "🎥" },
    ];

    global.fetch = vi.fn(async () => ({ ok: true, json: async () => serverData })) as any;

    const results = await fetchCategories("global");

    expect(results.length).toBe(2);
    expect(results[0].id).toBe("1");
    expect(results[0].name).toBe("Cleaning & janitorial");
    expect(results[0].emoji).toBe("🧹");
    expect(results[0].providerCount).toBe(19);

    expect(results[1].id).toBe("2");
    expect(results[1].emoji).toBe("🎥");

    const cached = readCategoriesCache();
    expect(Array.isArray(cached)).toBe(true);
    expect(cached?.length).toBe(2);
  });

  it("returns empty array on fetch failure", async () => {
    global.fetch = vi.fn(async () => ({ ok: false })) as any;
    const results = await fetchCategories("global");
    expect(Array.isArray(results)).toBe(true);
    expect(results.length).toBe(0);
  });
});
