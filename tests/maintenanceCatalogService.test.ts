import { describe, expect, it } from "vitest";
import {
  buildMaintenanceCatalogTree,
  slugifyMaintenanceName,
  validateVisitsIncludedForDuration,
} from "../server/services/maintenanceCatalogMath";

describe("maintenanceCatalogService", () => {
  it("slugifies admin-defined maintenance names consistently", () => {
    expect(slugifyMaintenanceName("  Air Conditioner (Split Unit)  ")).toBe(
      "air-conditioner-split-unit",
    );
    expect(slugifyMaintenanceName("___")).toBe("");
  });

  it("rejects visitsIncluded values outside the allowed duration range", () => {
    expect(() => validateVisitsIncludedForDuration("monthly", 0)).toThrow(
      "Visits included must be between 1 and 12 for monthly.",
    );
    expect(() => validateVisitsIncludedForDuration("yearly", 2)).toThrow(
      "Visits included must be between 1 and 1 for yearly.",
    );
    expect(() => validateVisitsIncludedForDuration("quarterly_3m", 4)).not.toThrow();
  });

  it("suppresses items and plans from inactive categories in the resident catalog", () => {
    const catalog = buildMaintenanceCatalogTree({
      activeOnly: true,
      categories: [
        {
          id: "inactive-category",
          name: "Inactive",
          slug: "inactive",
          icon: null,
          description: null,
          isActive: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: "active-category",
          name: "Active",
          slug: "active",
          icon: null,
          description: null,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ] as any,
      itemTypes: [
        {
          id: "inactive-item",
          categoryId: "inactive-category",
          name: "Hidden item",
          slug: "hidden-item",
          description: null,
          defaultFrequency: "monthly",
          recommendedTasks: [],
          imageUrl: null,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: "active-item",
          categoryId: "active-category",
          name: "Visible item",
          slug: "visible-item",
          description: null,
          defaultFrequency: "monthly",
          recommendedTasks: [],
          imageUrl: null,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ] as any,
      plans: [
        {
          id: "inactive-plan",
          maintenanceItemId: "inactive-item",
          name: "Hidden plan",
          description: null,
          durationType: "monthly",
          price: "1000",
          currency: "NGN",
          visitsIncluded: 1,
          includedTasks: [],
          requestLeadDays: 3,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: "active-plan",
          maintenanceItemId: "active-item",
          name: "Visible plan",
          description: null,
          durationType: "monthly",
          price: "1000",
          currency: "NGN",
          visitsIncluded: 1,
          includedTasks: [],
          requestLeadDays: 3,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ] as any,
    });

    expect(catalog).toHaveLength(1);
    expect(catalog[0]?.id).toBe("active-category");
    expect(catalog[0]?.itemTypes).toHaveLength(1);
    expect(catalog[0]?.itemTypes[0]?.id).toBe("active-item");
    expect(catalog[0]?.itemTypes[0]?.plans).toHaveLength(1);
    expect(catalog[0]?.itemTypes[0]?.plans[0]?.id).toBe("active-plan");
  });
});
