const baseUrl = process.env.ADMIN_BASE_URL || "http://localhost:5000";
const adminEmail = process.env.ADMIN_EMAIL || "pgadmin@cityconnect.com";
const adminPassword = process.env.ADMIN_PASSWORD || "PgAdmin123!";

const serviceCategories = [
  {
    name: "Surveillance monitoring",
    key: "surveillance_monitoring",
    icon: "🎥",
    emoji: "🎥",
    tag: "Surveillance monitoring",
    highlights: ["CCTV monitoring and surveillance"],
  },
  {
    name: "Cleaning & janitorial",
    key: "cleaning_janitorial",
    icon: "🧹",
    emoji: "🧹",
    tag: "Cleaning & janitorial",
    highlights: ["Cleaning and janitorial services"],
  },
  {
    name: "Catering Services",
    key: "catering_services",
    icon: "🍽️",
    emoji: "🍽️",
    tag: "Catering Services",
    highlights: ["Catering and food services"],
  },
  {
    name: "IT Support",
    key: "it_support",
    icon: "💻",
    emoji: "💻",
    tag: "IT Support",
    highlights: ["IT support and troubleshooting"],
  },
  {
    name: "Maintenance & Repair",
    key: "maintenance_repair",
    icon: "🔧",
    emoji: "🔧",
    tag: "Maintenance & Repair",
    highlights: ["General maintenance and repairs"],
  },
  {
    name: "Marketing & Advertising",
    key: "marketing_advertising",
    icon: "📊",
    emoji: "📊",
    tag: "Marketing & Advertising",
    highlights: ["Marketing and advertising services"],
  },
  {
    name: "Home tutors",
    key: "home_tutors",
    icon: "📚",
    emoji: "📚",
    tag: "Home tutors",
    highlights: ["Home tutoring services"],
  },
  {
    name: "Furniture making",
    key: "furniture_making",
    icon: "🪑",
    emoji: "🪑",
    tag: "Furniture making",
    highlights: ["Furniture making and carpentry"],
  },
];

const toPayload = (category) => ({
  name: category.name,
  key: category.key,
  icon: category.icon,
  emoji: category.emoji,
  tag: category.tag,
  scope: "global",
  description: category.highlights.join(" • "),
  isActive: true,
});

const jsonHeaders = { "Content-Type": "application/json" };

async function seed() {
  const loginResp = await fetch(`${baseUrl}/api/login`, {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify({ username: adminEmail, password: adminPassword }),
  });

  if (!loginResp.ok) {
    throw new Error(`Failed to login admin (${loginResp.status}) ${await loginResp.text()}`);
  }

  const cookie = loginResp.headers.get("set-cookie")?.split(";")[0];
  if (!cookie) {
    throw new Error("Unable to read session cookie");
  }

  const authHeaders = { ...jsonHeaders, Cookie: cookie };
  const existingResp = await fetch(`${baseUrl}/api/admin/categories`, {
    headers: authHeaders,
  });
  if (!existingResp.ok) {
    throw new Error(`Failed to load categories (${existingResp.status}) ${await existingResp.text()}`);
  }

  const existing = await existingResp.json();
  const existingByKey = new Map(
    Array.isArray(existing) ? existing.map((cat) => [cat.key, cat]) : [],
  );

  const keepKeys = new Set(serviceCategories.map((c) => c.key));

  for (const category of serviceCategories.map(toPayload)) {
    const existingCat = existingByKey.get(category.key);
    if (existingCat) {
      const categoryId = existingCat.id || existingCat._id;
      if (!categoryId) {
        console.warn(`Skipping ${category.name} because id is missing on the existing record`);
        continue;
      }
      await fetch(`${baseUrl}/api/admin/categories/${categoryId}`, {
        method: "PATCH",
        headers: authHeaders,
        body: JSON.stringify(category),
      });
      console.log(`Updated ${category.name}`);
    } else {
      await fetch(`${baseUrl}/api/admin/categories`, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify(category),
      });
      console.log(`Created ${category.name}`);
    }
  }

  // Deactivate any other existing global categories (so only the configured list remains active).
  for (const existingCat of Array.isArray(existing) ? existing : []) {
    const key = existingCat?.key;
    const scope = existingCat?.scope;
    const categoryId = existingCat?.id || existingCat?._id;
    if (!key || !categoryId) continue;
    if (scope && scope !== "global") continue;
    if (keepKeys.has(key)) continue;
    if (existingCat?.isActive === false) continue;

    await fetch(`${baseUrl}/api/admin/categories/${categoryId}`, {
      method: "PATCH",
      headers: authHeaders,
      body: JSON.stringify({ isActive: false }),
    });
    console.log(`Deactivated ${existingCat.name || key}`);
  }

  console.log("Service categories seeded/updated successfully.");
}

seed().catch((error) => {
  console.error(error);
  process.exit(1);
});
