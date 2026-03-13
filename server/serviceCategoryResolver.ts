const SERVICE_REQUEST_CATEGORY_KEYS = new Set([
  "electrician",
  "plumber",
  "carpenter",
  "hvac_technician",
  "painter",
  "tiler",
  "mason",
  "roofer",
  "gardener",
  "cleaner",
  "security_guard",
  "cook",
  "laundry_service",
  "pest_control",
  "welder",
  "mechanic",
  "phone_repair",
  "appliance_repair",
  "tailor",
  "surveillance_monitoring",
  "alarm_system",
  "cleaning_janitorial",
  "catering_services",
  "it_support",
  "maintenance_repair",
  "packaging_solutions",
  "marketing_advertising",
  "home_tutors",
  "furniture_making",
  "market_runner",
  "item_vendor",
]);

const CATEGORY_ALIASES: Record<string, string> = {
  hvac: "hvac_technician",
  landscaping: "gardener",
  landscaper: "gardener",
  gardening: "gardener",
  cleaning: "cleaner",
  painting: "painter",
  painter_services: "painter",
  tiling: "tiler",
  masonry: "mason",
  roofing: "roofer",
  janitorial: "cleaning_janitorial",
  carpentry: "carpenter",
  carpenter_work: "carpenter",
  carpenter_works: "carpenter",
  carpenter_services: "carpenter",
  plumbing: "plumber",
  electrical: "electrician",
  electrician_services: "electrician",
  welding: "welder",
  laundry: "laundry_service",
  pest: "pest_control",
  appliance: "appliance_repair",
  maintenance: "maintenance_repair",
  maintenance_and_repair: "maintenance_repair",
  repair: "maintenance_repair",
  repairs: "maintenance_repair",
  general_repair: "maintenance_repair",
  general_repairs: "maintenance_repair",
  general_maintenance: "maintenance_repair",
  locksmith: "maintenance_repair",
  glass_windows: "maintenance_repair",
  glass_window: "maintenance_repair",
};

const CATEGORY_HINTS: Array<{ token: string; category: string }> = [
  { token: "carpent", category: "carpenter" },
  { token: "plumb", category: "plumber" },
  { token: "elect", category: "electrician" },
  { token: "hvac", category: "hvac_technician" },
  { token: "garden", category: "gardener" },
  { token: "clean", category: "cleaner" },
  { token: "paint", category: "painter" },
  { token: "tile", category: "tiler" },
  { token: "mason", category: "mason" },
  { token: "roof", category: "roofer" },
  { token: "janitor", category: "cleaning_janitorial" },
  { token: "weld", category: "welder" },
  { token: "laundry", category: "laundry_service" },
  { token: "pest", category: "pest_control" },
  { token: "appliance", category: "appliance_repair" },
  { token: "lock", category: "maintenance_repair" },
  { token: "glass", category: "maintenance_repair" },
  { token: "repair", category: "maintenance_repair" },
  { token: "maint", category: "maintenance_repair" },
];

export function normalizeCategoryKey(value: string): string {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function resolveFromCandidate(candidate: string): string | null {
  const normalized = normalizeCategoryKey(candidate);
  if (!normalized) return null;

  if (SERVICE_REQUEST_CATEGORY_KEYS.has(normalized)) {
    return normalized;
  }

  const alias = CATEGORY_ALIASES[normalized];
  if (alias && SERVICE_REQUEST_CATEGORY_KEYS.has(alias)) {
    return alias;
  }

  for (const hint of CATEGORY_HINTS) {
    if (normalized.includes(hint.token) && SERVICE_REQUEST_CATEGORY_KEYS.has(hint.category)) {
      return hint.category;
    }
  }

  return null;
}

export function resolveServiceRequestCategory(categoryKey?: string, categoryLabel?: string): string {
  return (
    resolveFromCandidate(String(categoryKey || "")) ||
    resolveFromCandidate(String(categoryLabel || "")) ||
    "maintenance_repair"
  );
}
