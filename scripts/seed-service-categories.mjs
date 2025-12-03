const baseUrl = process.env.ADMIN_BASE_URL || "http://localhost:5000";
const adminEmail = process.env.ADMIN_EMAIL || "pgadmin@cityconnect.com";
const adminPassword = process.env.ADMIN_PASSWORD || "PgAdmin123!";

const serviceCategories = [
  {
    name: "Security & Access Control",
    key: "security-access-control",
    icon: "🛡️",
    tag: "Security & Access Control",
    highlights: [
      "Visitor management (🚶‍♂️ id-card / user-check)",
      "Gate access (🚧 gate / door-open)",
      "Surveillance monitoring (🎥 cctv / video)",
      "Emergency alerts (🚨 alarm / alert-triangle)",
      "Security guards (👮‍♂️ shield-person / user-shield)",
    ],
  },
  {
    name: "Transportation & Mobility",
    key: "transportation-mobility",
    icon: "🚗",
    tag: "Transportation & Mobility",
    highlights: [
      "Shuttle / intra-estate movement (🚌 bus / shuttle)",
      "On-demand rides (🚕 taxi)",
      "Carpooling (🚐 users-car / car-multiple)",
      "Delivery vehicle access control (🚛 truck / truck-check)",
    ],
  },
  {
    name: "Utilities & Infrastructure",
    key: "utilities-infrastructure",
    icon: "⚙️",
    tag: "Utilities & Infrastructure",
    highlights: [
      "Power supply issues (💡 bolt / plug)",
      "Water management (💧 droplet)",
      "Drainage (🌊 water-path / waves)",
      "Waste disposal (🗑️ trash / recycle)",
    ],
  },
  {
    name: "Facility Management",
    key: "facility-management",
    icon: "🏗️",
    tag: "Facility Management",
    highlights: [
      "Estate maintenance requests (🧾 clipboard-list / wrench)",
      "Landscaping & gardening (🌳 leaf / tree)",
      "Cleaning & janitorial (🧹 broom / sparkles)",
      "Repairs (roads, lights, pavements) (🛠️ tools / road)",
      "Pest control (🐜 bug-off / shield-bug)",
    ],
  },
  {
    name: "Repairs & Home Services",
    key: "repairs-home-services",
    icon: "🏠🔧",
    tag: "Repairs & Home Services",
    highlights: [
      "Plumbing (🚰 pipe / water-tap)",
      "Electrical (🔌 plug / zap)",
      "AC repair (🌬️ fan / snowflake)",
      "Generator repair (🔋 generator / battery-charging)",
      "Carpenter (🪚 saw / hammer)",
      "Locksmith (🔑 key / lock)",
      "Painter (🎨 paint-roller)",
      "Welder (🔧🔥 wrench-spark)",
      "Mason / bricklayer (🧱 bricks)",
    ],
  },
  {
    name: "Emergency Services",
    key: "emergency-services",
    icon: "🚨",
    tag: "Emergency Services",
    highlights: [
      "Estate first responders (🏃‍♂️ first-aid / user-nurse)",
      "Ambulance (🚑 ambulance)",
      "Fire support (🔥 fire-extinguisher)",
      "Security emergency team (🛡️👥 shield-group)",
    ],
  },
  {
    name: "Wellness & Health",
    key: "wellness-health",
    icon: "🩺",
    tag: "Wellness & Health",
    highlights: [
      "Fitness trainers (🏋️‍♂️ dumbbell)",
      "Physiotherapy (🧘‍♂️ body-scan)",
      "Home nursing (👩‍⚕️ nurse / home-medical)",
      "Elderly care (👵 user-cane)",
      "Pharmacy delivery (💊 capsule / truck-medical)",
    ],
  },
  {
    name: "Domestic Help",
    key: "domestic-help",
    icon: "🧹",
    tag: "Domestic Help",
    highlights: [
      "Housekeepers (🧽 broom / spray-bottle)",
      "Babysitters (👶 baby)",
      "Nannies (👩‍🍼 user-nurse)",
      "Drivers (🚘 steering-wheel)",
      "Gardeners (🌱 plant / shovel)",
      "Pool cleaners (🏊‍♂️ pool / water-wave)",
    ],
  },
  {
    name: "Food & Groceries",
    key: "food-groceries",
    icon: "🥦",
    tag: "Food & Groceries",
    highlights: [
      "Market runs (🧺 basket / shopping-bag)",
      "Food delivery (🍱 takeaway / scooter)",
      "Fresh produce (🥕 carrot / apple)",
      "Supermarket delivery (🛒 cart / storefront)",
      "Water refill delivery (🧴 water-bottle / truck-droplet)",
    ],
  },
  {
    name: "Laundry & Cleaning",
    key: "laundry-cleaning",
    icon: "👕",
    tag: "Laundry & Cleaning",
    highlights: [
      "Laundry pickup (🧺 laundry-bag)",
      "Dry cleaning (👔 hanger / shirt-outline)",
      "Home deep cleaning (🧽 sparkles-home)",
      "Upholstery cleaning (🛋️ sofa)",
      "Fumigation (🐭🚫 spray / bug-off)",
    ],
  },
  {
    name: "Pet Services",
    key: "pet-services",
    icon: "🐾",
    tag: "Pet Services",
    highlights: [
      "Pet grooming (✂️🐶 scissors-paw)",
      "Pet walking (🚶‍♂️🐕 dog-leash)",
      "Pet vet visit scheduling (🩺🐕 paw-medical)",
      "Pet boarding (🏠🐾 kennel / home-paw)",
      "Pet food delivery (🦴 bowl-paw / bag-bone)",
    ],
  },
  {
    name: "Recreation & Events",
    key: "recreation-events",
    icon: "🎉",
    tag: "Recreation & Events",
    highlights: [
      "Sports facilities booking (⚽ trophy / ball)",
      "Community events (🎊 people-group / party-popper)",
      "Picnic area booking (🧺🌳 picnic-table)",
      "Clubhouse rentals (🏡 building / home-community)",
      "Swimming pool access (🏊‍♀️ pool / wave)",
    ],
  },
  {
    name: "Education & Kids",
    key: "education-kids",
    icon: "🎓",
    tag: "Education & Kids",
    highlights: [
      "Home tutors (📚 book-open / user-teacher)",
      "Lesson centers (🏫 school)",
      "Skill clubs (music, dance, coding) (🎵💃💻 star / sparkles)",
      "School shuttle services (🚌 school-bus)",
    ],
  },
  {
    name: "Marketplace & Classifieds",
    key: "marketplace-classifieds",
    icon: "🛒",
    tag: "Marketplace & Classifieds",
    highlights: [
      "Buy / sell within estate (🔁 shopping-bag / arrows-exchange)",
      "Estate vendors (🏬 store / badge-check)",
      "Artisan marketplace (🛠️ hammer-wrench)",
      "Lost & found (🔎 search / box-question)",
      "Jobs board (📄 briefcase / clipboard-check)",
    ],
  },
  {
    name: "Estate Dues & Payments",
    key: "estate-dues-payments",
    icon: "💳",
    tag: "Estate Dues & Payments",
    highlights: [
      "Service charge payments (📥💰 receipt / home-dollar)",
      "Utility payments (💡💧 bolt / droplet-dollar)",
      "Facility booking fees (🧾 calendar-dollar)",
      "Vendor payments (🔁💵 arrows-right-left / wallet-send)",
    ],
  },
  {
    name: "Resident Records",
    key: "resident-records",
    icon: "📁",
    tag: "Resident Records",
    highlights: [
      "Digital ID (🪪 id-card)",
      "Household profiles (👨‍👩‍👧‍👦 users)",
      "Vehicle registration (🚙 car-profile)",
      "Visitor logs (📘 notebook / clipboard-list)",
      "Apartment documents (🏢📄 home-file)",
    ],
  },
  {
    name: "Communication",
    key: "communication",
    icon: "📢",
    tag: "Communication",
    highlights: [
      "Broadcast messages (📣 speaker-loud)",
      "Announcements (📯 megaphone / bell)",
      "Emergency notifications (🚨 alert-octagon)",
      "Polls and surveys (📊 bar-chart / checklist)",
    ],
  },
  {
    name: "Smart Home & IoT",
    key: "smart-home-iot",
    icon: "🔌",
    tag: "Smart Home & IoT",
    highlights: [
      "Smart lock integration (🔒 lock-wifi / key-wireless)",
      "Smart energy monitoring (📈⚡ gauge / bolt-circle)",
      "Home automation support (🏠🤖 home-wifi / settings-2)",
    ],
  },
  {
    name: "Insurance",
    key: "insurance",
    icon: "🛡️💰",
    tag: "Insurance",
    highlights: [
      "Home insurance (🏠🛡️ home-shield)",
      "Health insurance partners (🩺🛡️ heart-pulse-shield)",
      "Car insurance (🚗🛡️ car-shield)",
      "Gadget protection plans (📱🛡️ device-mobile-shield)",
    ],
  },
  {
    name: "Legal & Compliance",
    key: "legal-compliance",
    icon: "⚖️",
    tag: "Legal & Compliance",
    highlights: [
      "Property ownership verification (🏠📜 certificate / file-check)",
      "Complaint handling (📨😠 inbox / message-warning)",
      "Mediation with estate management (🤝 handshake / users-gear)",
    ],
  },
  {
    name: "Real Estate Services",
    key: "real-estate-services",
    icon: "🏡",
    tag: "Real Estate Services",
    highlights: [
      "Rent & buy listings (📋🏠 home-search)",
      "Short-let verification (🕒 badge-check / clock-home)",
      "Moving services (🚚 truck)",
      "Property management (🏢🛠️ building-gear)",
      "Home inspection (🔍🏠 home-search / clipboard-search)",
    ],
  },
  {
    name: "Corporate / SME Services",
    key: "corporate-sme-services",
    icon: "🏢",
    tag: "Corporate / SME Services",
    highlights: [
      "Business verification (✅🏢 badge-check / shield-check)",
      "In-estate B2B logistics (📦🚚 truck-delivery / boxes)",
      "Vendor onboarding & compliance (🧾✅ file-check / user-plus-badge)",
    ],
  },
];

const toPayload = (category) => ({
  name: category.name,
  key: category.key,
  icon: category.icon,
  tag: category.tag,
  scope: "global",
  description: category.highlights.join(" • "),
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

  console.log("Service categories seeded/updated successfully.");
}

seed().catch((error) => {
  console.error(error);
  process.exit(1);
});
