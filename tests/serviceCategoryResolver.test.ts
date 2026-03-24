import { describe, expect, it } from "vitest";
import {
  resolveServiceRequestCategory,
  tryResolveServiceRequestCategory,
} from "../server/serviceCategoryResolver";

describe("serviceCategoryResolver", () => {
  it("resolves canonical category keys", () => {
    expect(tryResolveServiceRequestCategory("plumber", "")).toBe("plumber");
    expect(tryResolveServiceRequestCategory("electrician", "")).toBe("electrician");
  });

  it("resolves aliases and hints", () => {
    expect(tryResolveServiceRequestCategory("landscaping", "")).toBe("gardener");
    expect(tryResolveServiceRequestCategory("Glass Window Repair", "")).toBe("glass_windows");
    expect(tryResolveServiceRequestCategory("general_repairs", "")).toBe("general_repairs");
    expect(tryResolveServiceRequestCategory("locksmith", "")).toBe("locksmith");
  });

  it("returns null for unsupported categories in strict mode", () => {
    expect(tryResolveServiceRequestCategory("store_owner", "Store Owner")).toBe("item_vendor");
    expect(tryResolveServiceRequestCategory("general", "General")).toBeNull();
  });

  it("keeps legacy fallback behavior in non-strict mode", () => {
    expect(resolveServiceRequestCategory("unknown_category", "Unknown Category")).toBe("maintenance_repair");
  });
});
