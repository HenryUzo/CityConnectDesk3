import type {
  MaintenanceCategory,
  MaintenanceItemType,
  MaintenancePlan,
} from "../../shared/schema";

export type SupportedMaintenanceDuration =
  | "monthly"
  | "quarterly_3m"
  | "halfyearly_6m"
  | "yearly";

const MAINTENANCE_VISIT_LIMITS: Record<
  SupportedMaintenanceDuration,
  { min: number; max: number }
> = {
  monthly: { min: 1, max: 12 },
  quarterly_3m: { min: 1, max: 4 },
  halfyearly_6m: { min: 1, max: 2 },
  yearly: { min: 1, max: 1 },
};

function badRequest(message: string) {
  const error = new Error(message);
  (error as any).status = 400;
  return error;
}

export function slugifyMaintenanceName(value: string) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

export function validateVisitsIncludedForDuration(
  durationType: SupportedMaintenanceDuration,
  visitsIncluded: number,
) {
  const limits = MAINTENANCE_VISIT_LIMITS[durationType];
  if (!limits) {
    throw badRequest("Unsupported maintenance plan duration.");
  }
  if (visitsIncluded < limits.min || visitsIncluded > limits.max) {
    throw badRequest(
      `Visits included must be between ${limits.min} and ${limits.max} for ${durationType}.`,
    );
  }
}

export function getDefaultVisitsIncluded(durationType: SupportedMaintenanceDuration) {
  return MAINTENANCE_VISIT_LIMITS[durationType].max;
}

export function buildMaintenanceCatalogTree(params: {
  categories: MaintenanceCategory[];
  itemTypes: MaintenanceItemType[];
  plans: MaintenancePlan[];
  activeOnly?: boolean;
}) {
  const categories = params.activeOnly
    ? params.categories.filter((category) => category.isActive)
    : params.categories;

  return categories.map((category) => {
    const itemTypes = params.itemTypes
      .filter((itemType) => itemType.categoryId === category.id)
      .filter((itemType) => (params.activeOnly ? itemType.isActive : true))
      .map((itemType) => ({
        ...itemType,
        plans: params.plans
          .filter((plan) => plan.maintenanceItemId === itemType.id)
          .filter((plan) => (params.activeOnly ? plan.isActive : true)),
      }));

    return {
      ...category,
      itemTypes,
    };
  });
}
