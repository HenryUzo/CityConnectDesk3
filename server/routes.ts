import type { Express } from "express";
import { createServer, type Server } from "http";
import { z } from "zod";
import { setupAuth } from "./auth";
import { storage } from "./storage";
import { db } from "./db";
import {
  users,
  serviceRequests,
  estates,
  orders,
  auditLogs,
  memberships,
  categories,
  marketplaceItems,
  stores,
  itemCategories,
  insertServiceRequestSchema,
} from "@shared/schema";
import { createMarketplaceItemSchema, updateMarketplaceItemSchema } from "@shared/admin-schema";
import { MARKETPLACE_CATEGORY_PRESETS } from "@shared/marketplace-categories";
import appRoutes from "./app-routes";
import providerRoutes from "./provider-routes";
import marketplaceRoutes from "./marketplace-routes";
import { randomBytes, scrypt } from "crypto";
import { promisify } from "util";
import { and, count, eq, sql, desc } from "drizzle-orm";

// Accept flexible inputs, normalize output types
const CreateServiceRequest = insertServiceRequestSchema.extend({
  preferredTime: z
    .union([
      z.string().datetime().optional(),
      z.string().optional(),
      z.number().optional(),
      z.date().optional(),
      z.null().optional(),
    ])
    .transform((v) => {
      if (v == null || v === "") return null;
      const d = v instanceof Date ? v : new Date(v as any);
      return isNaN(d.getTime()) ? null : d;
    }),
  budget: z
    .preprocess(
      (v) => (v === undefined || v === null || v === "" ? "0" : v),
      z.union([z.string(), z.number()])
    )
    .transform((v) => (typeof v === "number" ? String(v) : v)),
});

let estatesTableEnsured = false;
let auditLogsTableEnsured = false;
let membershipsTableEnsured = false;
let categoriesTableEnsured = false;
let storesTableEnsured = false;
let marketplaceItemsTableEnsured = false;
let itemCategoriesTableEnsured = false;
const marketplaceItemValidator = createMarketplaceItemSchema;
const marketplaceItemUpdateValidator = updateMarketplaceItemSchema;

const defaultCategories = [
  { key: "electrician", name: "Electrician", icon: "⚡", description: "Handles wiring, power faults, and electrical fittings." },
  { key: "plumber", name: "Plumber", icon: "🚰", description: "Fixes leaks, blocked drains, and water systems." },
  { key: "carpenter", name: "Carpenter", icon: "🪚", description: "Builds and repairs doors, furniture, and cabinets." },
  { key: "painter", name: "Painter", icon: "🎨", description: "Interior and exterior painting and wall finishes." },
  { key: "tiler", name: "Tiler", icon: "🧱", description: "Installs and repairs floor and wall tiles." },
  { key: "welder", name: "Welder", icon: "🔥", description: "Metal gates, railings, and structural welding." },
  { key: "auto_mechanic", name: "Auto Mechanic", icon: "🚗", description: "Repairs cars, engines, and vehicle servicing." },
  { key: "panel_beater", name: "Panel Beater", icon: "🛠️", description: "Bodywork repairs and spray painting for vehicles." },
  { key: "ac_technician", name: "AC Technician", icon: "❄️", description: "Installs and services air conditioners and cooling units." },
  { key: "generator_technician", name: "Generator Technician", icon: "⚙️", description: "Maintains and repairs power generators." },
  { key: "bricklayer", name: "Bricklayer", icon: "⛏️", description: "Block work, masonry, and small construction jobs." },
  { key: "mason_builder", name: "Mason / Builder", icon: "🏗️", description: "General building, concrete, and structural work." },
  { key: "gardener", name: "Gardener", icon: "🌿", description: "Lawn care, pruning, and landscaping." },
  { key: "cleaner", name: "Cleaner", icon: "🧹", description: "Residential and office cleaning services." },
  { key: "fumigation", name: "Fumigation", icon: "🪤", description: "Pest control and fumigation services." },
  { key: "laundry", name: "Laundry", icon: "🧺", description: "Dry cleaning and laundry pick-up/drop-off." },
  { key: "barber", name: "Barber", icon: "💈", description: "Men’s grooming and haircuts." },
  { key: "hair_stylist", name: "Hair Stylist", icon: "💇‍♀️", description: "Women’s braids, weaving, and styling." },
  { key: "tailor", name: "Tailor / Fashion Designer", icon: "👗", description: "Custom outfits, adjustments, and repairs." },
  { key: "makeup_artist", name: "Makeup Artist", icon: "💄", description: "Bridal and event makeup services." },
  { key: "interior_decorator", name: "Interior Decorator", icon: "🛋️", description: "Space styling, curtains, and decor plans." },
  { key: "event_planner", name: "Event Planner", icon: "🎉", description: "Plans and manages events and parties." },
  { key: "caterer", name: "Caterer", icon: "🍲", description: "Meal prep and event catering services." },
  { key: "baker", name: "Baker", icon: "🎂", description: "Cakes, pastries, and dessert orders." },
  { key: "driver", name: "Driver / Chauffeur", icon: "🚘", description: "Professional driving and pickups." },
  { key: "security_guard", name: "Security Guard", icon: "🛡️", description: "Private guards and estate security services." },
  { key: "cctv_installer", name: "CCTV & Access Control", icon: "🎥", description: "CCTV, alarms, and access control installs." },
  { key: "handyman", name: "Handyman / General Repairs", icon: "🧰", description: "Minor fixes, fixtures, and home maintenance." },
  { key: "aluminium_fabricator", name: "Aluminium Fabricator", icon: "🪟", description: "Windows, doors, and aluminium works." },
  { key: "borehole_driller", name: "Borehole & Waterworks", icon: "💧", description: "Borehole drilling, pumps, and water systems." },
  { key: "store_owner", name: "Store Owner", icon: "🛒", description: "Manages marketplace stores and inventory as an owner." },
];

const defaultItemCategories = [
  { name: "Fresh Produce", emoji: "🍎", description: "Locally sourced fruits and vegetables." },
  { name: "Dairy & Eggs", emoji: "🧀", description: "Cheese, milk, and egg selections with cold storage." },
  { name: "Bakery", emoji: "🥐", description: "Fresh bread, pastries, and baked treats." },
  { name: "Butcher & Meat", emoji: "🥩", description: "Red meat, poultry, and marinated cuts." },
  { name: "Seafood", emoji: "🐟", description: "Fresh and frozen fish, prawns, and shellfish." },
  { name: "Pantry Staples", emoji: "🍚", description: "Rice, grains, flours, and dry goods for cooking." },
  { name: "Frozen Foods", emoji: "🧊", description: "Frozen vegetables, meats, and ready-to-cook items." },
  { name: "Beverages", emoji: "🍹", description: "Fruit juices, sodas, and flavored drinks." },
  { name: "Snacks", emoji: "🍿", description: "Chips, nuts, popcorn, and light bites." },
  { name: "Ready Meals", emoji: "🍱", description: "Pre-prepared meals for quick reheating." },
  { name: "Organic Goods", emoji: "🌿", description: "Certified organic produce and pantry items." },
  { name: "Health & Supplements", emoji: "💊", description: "Vitamins, supplements, and wellness boosters." },
  { name: "Personal Care", emoji: "🧴", description: "Skincare, haircare, and hygiene products." },
  { name: "Cleaning Supplies", emoji: "🧽", description: "Household cleaners, detergents, and tools." },
  { name: "Home Decor", emoji: "🕯️", description: "Candles, accents, and decorative accessories." },
  { name: "Stationery", emoji: "✏️", description: "Pens, notebooks, and office stationery." },
  { name: "Electronics", emoji: "🖥️", description: "Monitors, accessories, and small electronics." },
  { name: "Mobile Accessories", emoji: "📱", description: "Chargers, cases, and mobile gadgets." },
  { name: "Toys & Games", emoji: "🧸", description: "Children’s toys, puzzles, and board games." },
  { name: "Baby Essentials", emoji: "🍼", description: "Diapers, wipes, and baby care kits." },
  { name: "Pet Supplies", emoji: "🐾", description: "Food, grooming, and accessories for pets." },
  { name: "Garden & Outdoor", emoji: "🌻", description: "Seeds, tools, and outdoor living gear." },
  { name: "Tools & Hardware", emoji: "🛠️", description: "Hand tools, fasteners, and repair kits." },
  { name: "Building Materials", emoji: "🧱", description: "Cement, blocks, timber, and construction supplies." },
  { name: "Automotive", emoji: "🚗", description: "Oils, filters, and automotive care products." },
  { name: "Fitness Gear", emoji: "🏋️", description: "Workout equipment and fitness accessories." },
  { name: "Apparel", emoji: "👕", description: "Clothing for men, women, and kids." },
  { name: "Footwear", emoji: "👟", description: "Casual and formal shoes and trainers." },
  { name: "Accessories", emoji: "👜", description: "Bags, watches, and fashion accessories." },
  { name: "Jewelry", emoji: "💍", description: "Rings, necklaces, and luxury accents." },
  { name: "Sustainable Goods", emoji: "♻️", description: "Eco-friendly and zero-waste essentials." },
  { name: "Art Supplies", emoji: "🎨", description: "Paints, brushes, and creative materials." },
  { name: "Books & Media", emoji: "📚", description: "Books, magazines, and media collections." },
  { name: "Music & Instruments", emoji: "🎸", description: "Instruments and music accessories." },
  { name: "Gifts & Crafts", emoji: "🎁", description: "Handmade gifts, craft kits, and souvenirs." },
  { name: "Party Supplies", emoji: "🎈", description: "Balloons, décor, and celebration bundles." },
  { name: "Travel Essentials", emoji: "🧳", description: "Luggage, organizers, and travel comforts." },
  { name: "Home Appliances", emoji: "🧺", description: "Laundry, kitchen, and home utility appliances." },
  { name: "Furniture", emoji: "🛋️", description: "Indoor and outdoor furniture pieces." },
  { name: "Kitchenware", emoji: "🍽️", description: "Cookware, bakeware, and serving sets." },
  { name: "Tableware", emoji: "🍴", description: "Cutlery and dining accessories." },
  { name: "Lighting", emoji: "💡", description: "Lamps, bulbs, and illumination fixtures." },
  { name: "Technology", emoji: "💻", description: "Laptops, peripherals, and smart devices." },
  { name: "Office Supplies", emoji: "🗃️", description: "File storage, organizers, and desk tools." },
  { name: "Coffee & Tea", emoji: "☕", description: "Ground coffee, tea bags, and brewing kits." },
  { name: "Bakery Bread", emoji: "🥯", description: "Artisanal bread and hearth-baked loaves." },
  { name: "Candy & Treats", emoji: "🍭", description: "Sweets, chocolates, and confectionery." },
  { name: "Spices & Condiments", emoji: "🧂", description: "Spices, sauces, and seasoning blends." },
  { name: "Canned & Jarred", emoji: "🥫", description: "Canned goods, preserves, and sauces." },
  { name: "Deli & Ready-to-Eat", emoji: "🥪", description: "Deli meats, wraps, and picnic favorites." },
];
async function ensurePgcrypto() {
  try {
    await db.execute(sql`CREATE EXTENSION IF NOT EXISTS "pgcrypto";`);
  } catch (err) {
    console.warn("[admin] could not ensure pgcrypto extension:", (err as any)?.message || err);
  }
}

async function ensureEstatesTable() {
  if (estatesTableEnsured) return;
  try {
    await ensurePgcrypto();
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS estates (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        name text NOT NULL,
        slug text UNIQUE NOT NULL,
        description text,
        address text NOT NULL,
        coverage jsonb NOT NULL DEFAULT '{}'::jsonb,
        settings jsonb NOT NULL DEFAULT '{"servicesEnabled":[],"marketplaceEnabled":true,"paymentMethods":[],"deliveryRules":{}}'::jsonb,
        is_active boolean NOT NULL DEFAULT true,
        created_at timestamp DEFAULT now(),
        updated_at timestamp DEFAULT now()
      );
    `);
    estatesTableEnsured = true;
  } catch (error) {
    console.error("[admin] ensure estates table failed", (error as any)?.message || error);
  }
}

async function ensureAuditLogsTable() {
  if (auditLogsTableEnsured) return;
  try {
    await ensurePgcrypto();
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        actor_id varchar NOT NULL,
        estate_id varchar NULL,
        action text NOT NULL,
        target text NOT NULL,
        target_id text NOT NULL,
        meta jsonb NOT NULL DEFAULT '{}'::jsonb,
        ip_address text NULL,
        user_agent text NULL,
        created_at timestamp DEFAULT now()
      );
    `);
    auditLogsTableEnsured = true;
  } catch (err) {
    console.error("[admin] ensure audit_logs table failed", (err as any)?.message || err);
  }
}

async function ensureMembershipsTable() {
  if (membershipsTableEnsured) return;
  try {
    await ensurePgcrypto();
    await ensureEstatesTable();
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS memberships (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id varchar NOT NULL REFERENCES users(id),
        estate_id varchar NOT NULL REFERENCES estates(id),
        role varchar NOT NULL DEFAULT 'resident',
        is_active boolean NOT NULL DEFAULT true,
        permissions text[],
        created_at timestamptz DEFAULT now(),
        updated_at timestamptz DEFAULT now(),
        UNIQUE (user_id, estate_id)
      );
    `);
    await db.execute(sql`ALTER TABLE memberships ADD COLUMN IF NOT EXISTS role varchar NOT NULL DEFAULT 'resident';`);
    await db.execute(sql`ALTER TABLE memberships ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;`);
    await db.execute(sql`ALTER TABLE memberships ADD COLUMN IF NOT EXISTS permissions text[];`);
    await db.execute(sql`ALTER TABLE memberships ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();`);
    await db.execute(sql`ALTER TABLE memberships ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();`);
    await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS memberships_user_estate_unique ON memberships(user_id, estate_id);`);
    membershipsTableEnsured = true;
  } catch (err) {
    console.error("[admin] ensure memberships table failed", (err as any)?.message || err);
  }
}

async function ensureCategoriesTable() {
  if (categoriesTableEnsured) return;
  try {
    await ensurePgcrypto();
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS categories (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        name text NOT NULL,
        key text NOT NULL,
        description text,
        icon text,
        scope text NOT NULL DEFAULT 'estate',
        is_active boolean NOT NULL DEFAULT true,
        estate_id varchar,
        created_at timestamptz DEFAULT now(),
        updated_at timestamptz DEFAULT now()
      );
    `);
    await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS categories_key_unique ON categories(key);`);
    await db.execute(sql`ALTER TABLE categories ADD COLUMN IF NOT EXISTS estate_id varchar;`);
    categoriesTableEnsured = true;
  } catch (err) {
    console.error("[admin] ensure categories table failed", (err as any)?.message || err);
  }
}

async function ensureStoresTable() {
  if (storesTableEnsured) return;
  try {
    await ensurePgcrypto();
    await ensureEstatesTable();
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS stores (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        estate_id varchar REFERENCES estates(id),
        owner_id varchar REFERENCES users(id),
        name text NOT NULL,
        description text,
        location text NOT NULL,
        latitude double precision,
        longitude double precision,
        phone text,
        email text,
        logo text,
        approval_status text NOT NULL DEFAULT 'pending',
        approved_by varchar REFERENCES users(id),
        approved_at timestamp,
        is_active boolean NOT NULL DEFAULT true,
        created_at timestamp DEFAULT now(),
        updated_at timestamp DEFAULT now()
      );
    `);
    await db.execute(sql`ALTER TABLE stores ADD COLUMN IF NOT EXISTS estate_id varchar REFERENCES estates(id);`);
    await db.execute(sql`ALTER TABLE stores ADD COLUMN IF NOT EXISTS owner_id varchar REFERENCES users(id);`);
    await db.execute(sql`ALTER TABLE stores ADD COLUMN IF NOT EXISTS logo text;`);
    await db.execute(sql`ALTER TABLE stores ADD COLUMN IF NOT EXISTS approval_status text NOT NULL DEFAULT 'pending';`);
    await db.execute(sql`ALTER TABLE stores ADD COLUMN IF NOT EXISTS approved_by varchar REFERENCES users(id);`);
    await db.execute(sql`ALTER TABLE stores ADD COLUMN IF NOT EXISTS approved_at timestamp;`);
    await db.execute(sql`ALTER TABLE stores ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;`);
    await db.execute(sql`ALTER TABLE stores ADD COLUMN IF NOT EXISTS created_at timestamp DEFAULT now();`);
    await db.execute(sql`ALTER TABLE stores ADD COLUMN IF NOT EXISTS updated_at timestamp DEFAULT now();`);
    storesTableEnsured = true;
  } catch (err) {
    console.error("[admin] ensure stores table failed", (err as any)?.message || err);
  }
}

async function ensureItemCategoriesTable() {
  if (itemCategoriesTableEnsured) return;
  try {
    await ensurePgcrypto();
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS item_categories (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        name text NOT NULL,
        description text,
        emoji text,
        is_active boolean NOT NULL DEFAULT true,
        created_at timestamp DEFAULT now(),
        updated_at timestamp DEFAULT now()
      );
    `);
    await db.execute(sql`ALTER TABLE item_categories ADD COLUMN IF NOT EXISTS emoji text;`);
    itemCategoriesTableEnsured = true;
  } catch (err) {
    console.error("[admin] ensure item_categories table failed", (err as any)?.message || err);
  }
}

async function ensureMarketplaceItemsTable() {
  if (marketplaceItemsTableEnsured) return;
  try {
    await ensurePgcrypto();
    await ensureEstatesTable();
    await ensureStoresTable();

    // Create enum for item unit of measure if it doesn't already exist
    await db.execute(sql`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'unit_of_measure') THEN
          CREATE TYPE unit_of_measure AS ENUM (
            'kg','g','liter','ml','piece','bunch','pack','bag','bottle','can','box','dozen','yard','meter'
          );
        END IF;
      END$$;
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS marketplace_items (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        estate_id varchar REFERENCES estates(id),
        store_id varchar REFERENCES stores(id),
        vendor_id varchar NOT NULL REFERENCES users(id),
        name text NOT NULL,
        description text,
        price numeric(10, 2) NOT NULL,
        currency varchar(10) NOT NULL DEFAULT 'NGN',
        unit_of_measure unit_of_measure DEFAULT 'piece',
        category text NOT NULL,
        subcategory text,
        stock integer NOT NULL DEFAULT 0,
        images text[],
        is_active boolean NOT NULL DEFAULT true,
        created_at timestamp DEFAULT now(),
        updated_at timestamp DEFAULT now()
      );
    `);
    // Relax estate_id nullability for legacy data where estates are not linked to stores
    try {
      await db.execute(sql`ALTER TABLE marketplace_items ALTER COLUMN estate_id DROP NOT NULL;`);
    } catch (err) {
      // Ignore if constraint already removed
    }
    marketplaceItemsTableEnsured = true;
  } catch (err) {
    console.error("[admin] ensure marketplace_items table failed", (err as any)?.message || err);
  }
}
async function seedDefaultCategories() {
  await ensureCategoriesTable();
  try {
    const existing = await db.select({ key: categories.key }).from(categories);
    const existingKeys = new Set(existing.map((r) => r.key));
    const toInsert = defaultCategories
      .filter((c) => !existingKeys.has(c.key))
      .map((c) => ({
        name: c.name,
        key: c.key,
        description: c.description,
        icon: c.icon,
        scope: "global",
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      }));
    if (toInsert.length > 0) {
      for (const cat of toInsert) {
        await db.execute(sql`
          INSERT INTO categories (name, key, description, icon, scope, is_active, created_at, updated_at)
          VALUES (${cat.name}, ${cat.key}, ${cat.description}, ${cat.icon}, ${cat.scope}, ${cat.isActive}, ${cat.createdAt}, ${cat.updatedAt})
          ON CONFLICT (key) DO NOTHING;
        `);
      }
    }
  } catch (err: any) {
    console.error("[admin] seed categories error", err?.message || err);
  }
}

async function seedDefaultItemCategories() {
  await ensureItemCategoriesTable();
  try {
    const existing = await db.select({ name: itemCategories.name }).from(itemCategories);
    const existingNames = new Set(existing.map((r) => r.name));
    const toInsert = defaultItemCategories.filter((c) => !existingNames.has(c.name));
    if (toInsert.length === 0) return;
    const timestamp = new Date();
    for (const cat of toInsert) {
      await db.execute(sql`
        INSERT INTO item_categories (name, description, emoji, is_active, created_at, updated_at)
        VALUES (${cat.name}, ${cat.description}, ${cat.emoji}, ${true}, ${timestamp}, ${timestamp})
      `);
    }
  } catch (err: any) {
    console.error("[admin] seed item categories error", err?.message || err);
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Setup authentication routes
  setupAuth(app);

  // Ensure core tables exist
  await ensureEstatesTable();
  await ensureMembershipsTable();
  await ensureCategoriesTable();
  await ensureStoresTable();
  await ensureItemCategoriesTable();
  await seedDefaultItemCategories();
  await ensureMarketplaceItemsTable();
  await seedDefaultCategories();

  app.use("/api/app", appRoutes);
  app.use("/api/provider", providerRoutes);
  app.use("/api/marketplace", marketplaceRoutes);

  // Password hashing helper (mirror of auth.ts)
  const scryptAsync = promisify(scrypt);
  async function hashPassword(password: string) {
    const salt = randomBytes(16).toString("hex");
    const buf = (await scryptAsync(password, salt, 64)) as Buffer;
    return `${buf.toString("hex")}.${salt}`;
  }

  // Service Requests Routes
  app.post("/api/service-requests", async (req, res, next) => {
    try {
      if (!req.isAuthenticated() || req.user?.role !== "resident") {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const parsed = CreateServiceRequest.parse({
        ...req.body,
        residentId: req.user.id,
      });

      const created = await storage.createServiceRequest(parsed);
      return res.status(201).json(created);
    } catch (error: any) {
      if (error?.issues) {
        return res.status(400).json({
          error: "Validation error",
          details: error.issues.map((i: any) => ({
            path: i.path.join("."),
            message: i.message,
            expected: i.expected,
            received: i.received,
            code: i.code,
          })),
        });
      }
      next(error);
    }
  });

  // Admin: assign estate membership
  app.post("/api/admin/memberships", async (req, res, next) => {
    try {
      const isAuthed = typeof req.isAuthenticated === "function" ? req.isAuthenticated() : false;
      const isAdmin = isAuthed && (req.user?.role === "admin" || req.user?.globalRole === "super_admin");
      if (!isAdmin) return res.status(401).json({ message: "Unauthorized" });

      const { userId, estateId, role = "provider" } = req.body || {};
      if (!userId || !estateId) {
        return res.status(400).json({ error: "userId and estateId are required" });
      }

      await ensureMembershipsTable();

      // Prevent duplicate memberships
      const existing = await db
        .select()
        .from(memberships)
        .where(and(eq(memberships.userId, userId), eq(memberships.estateId, estateId)))
        .limit(1);
      if (existing?.length) {
        return res.json(existing[0]);
      }

      const [membership] = await db
        .insert(memberships)
        .values({
          userId,
          estateId,
          role,
          createdAt: new Date(),
          updatedAt: new Date(),
        } as any)
        .returning();

      res.status(201).json(membership);
    } catch (error) {
      const message = (error as any)?.message || "";
      console.error("[admin] memberships insert error", message);
      // Auto-heal if table is missing
      if (message.includes(`relation "memberships" does not exist`)) {
        try {
          await ensureMembershipsTable();
          const [membership] = await db
            .insert(memberships)
            .values({
              userId: req.body.userId,
              estateId: req.body.estateId,
              role: req.body.role || "provider",
              createdAt: new Date(),
              updatedAt: new Date(),
            } as any)
            .returning();
          return res.status(201).json(membership);
        } catch (retryErr: any) {
          console.error("[admin] memberships retry failed", retryErr?.message || retryErr);
          return res.status(500).json({ error: retryErr?.message || "Failed to create membership" });
        }
      }
      return res.status(500).json({ error: message || "Failed to create membership" });
    }
  });

  // Admin: item categories CRUD
  app.get("/api/admin/item-categories", async (req, res) => {
    try {
      const isAdmin =
        req.isAuthenticated() &&
        (req.user?.role === "admin" || req.user?.globalRole === "super_admin");
      if (!isAdmin) return res.status(401).json({ message: "Unauthorized" });

      await ensureItemCategoriesTable();
      const rows = await db.select().from(itemCategories).orderBy(desc(itemCategories.createdAt));
      res.json(rows);
    } catch (err: any) {
      console.error("[admin] item-categories list error", err?.message || err);
      res.status(500).json({ error: err?.message || "Failed to fetch item categories" });
    }
  });

  const ItemCategorySchema = z.object({
    name: z.string().min(1, "Name is required"),
    description: z.string().optional().default(""),
    emoji: z.string().max(8).optional().default(""),
    isActive: z.boolean().optional().default(true),
  });

  app.post("/api/admin/item-categories", async (req, res) => {
    try {
      const isAdmin =
        req.isAuthenticated() &&
        (req.user?.role === "admin" || req.user?.globalRole === "super_admin");
      if (!isAdmin) return res.status(401).json({ message: "Unauthorized" });

      const payload = ItemCategorySchema.parse(req.body || {});
      await ensureItemCategoriesTable();
      const [created] = await db.insert(itemCategories).values({
        name: payload.name,
        description: payload.description,
        emoji: payload.emoji || null,
        isActive: payload.isActive ?? true,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any).returning();
      res.status(201).json(created);
    } catch (err: any) {
      console.error("[admin] item-categories create error", err?.message || err);
      res.status(400).json({ error: err?.message || "Failed to create category" });
    }
  });

  app.patch("/api/admin/item-categories/:id", async (req, res) => {
    try {
      const isAdmin =
        req.isAuthenticated() &&
        (req.user?.role === "admin" || req.user?.globalRole === "super_admin");
      if (!isAdmin) return res.status(401).json({ message: "Unauthorized" });

      const payload = ItemCategorySchema.partial().parse(req.body || {});
      await ensureItemCategoriesTable();
      const [updated] = await db
        .update(itemCategories)
        .set({ ...payload, updatedAt: new Date() } as any)
        .where(eq(itemCategories.id, req.params.id))
        .returning();
      if (!updated) return res.status(404).json({ message: "Category not found" });
      res.json(updated);
    } catch (err: any) {
      console.error("[admin] item-categories update error", err?.message || err);
      res.status(400).json({ error: err?.message || "Failed to update category" });
    }
  });

  app.delete("/api/admin/item-categories/:id", async (req, res) => {
    try {
      const isAdmin =
        req.isAuthenticated() &&
        (req.user?.role === "admin" || req.user?.globalRole === "super_admin");
      if (!isAdmin) return res.status(401).json({ message: "Unauthorized" });

      await ensureItemCategoriesTable();
      const [deleted] = await db
        .delete(itemCategories)
        .where(eq(itemCategories.id, req.params.id))
        .returning();
      if (!deleted) return res.status(404).json({ message: "Category not found" });
      res.json({ ok: true });
    } catch (err: any) {
      console.error("[admin] item-categories delete error", err?.message || err);
      res.status(400).json({ error: err?.message || "Failed to delete category" });
    }
  });

  // List memberships (optional filters: userId, estateId)
  app.get("/api/admin/memberships", async (req, res, next) => {
    try {
      const isAuthed = typeof req.isAuthenticated === "function" ? req.isAuthenticated() : false;
      const isAdmin = isAuthed && (req.user?.role === "admin" || req.user?.globalRole === "super_admin");
      if (!isAdmin) return res.status(401).json({ message: "Unauthorized" });

      const { userId, estateId } = req.query as { userId?: string; estateId?: string };
      await ensureMembershipsTable();

      let conditions: any[] = [];
      if (userId) conditions.push(eq(memberships.userId, userId));
      if (estateId) conditions.push(eq(memberships.estateId, estateId));

      const rows = conditions.length
        ? await db.select().from(memberships).where(and(...conditions))
        : await db.select().from(memberships);

      res.json(rows);
    } catch (err) {
      console.error("[admin] memberships list error", (err as any)?.message || err);
      res.status(500).json({ error: (err as any)?.message || "Failed to fetch memberships" });
    }
  });

  // Delete membership (remove estate assignment)
  app.delete("/api/admin/memberships/:userId/:estateId", async (req, res) => {
    try {
      const isAuthed = typeof req.isAuthenticated === "function" ? req.isAuthenticated() : false;
      const isAdmin = isAuthed && (req.user?.role === "admin" || req.user?.globalRole === "super_admin");
      if (!isAdmin) return res.status(401).json({ message: "Unauthorized" });

      const { userId, estateId } = req.params;
      await ensureMembershipsTable();

      const deleted = await db
        .delete(memberships)
        .where(and(eq(memberships.userId, userId), eq(memberships.estateId, estateId)))
        .returning();

      if (!deleted?.length) {
        return res.status(404).json({ message: "Membership not found" });
      }

      res.json({ ok: true, deleted: deleted[0] });
    } catch (err) {
      console.error("[admin] memberships delete error", (err as any)?.message || err);
      res.status(500).json({ error: (err as any)?.message || "Failed to delete membership" });
    }
  });

  app.get("/api/service-requests", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { status } = req.query;
      let requests;

      if (req.user?.role === "resident") {
        requests = await storage.getServiceRequestsByResident(req.user.id);
      } else if (req.user?.role === "provider") {
        if (status === "available") {
          requests = await storage.getAvailableServiceRequests(req.user.serviceCategory || undefined);
        } else {
          requests = await storage.getServiceRequestsByProvider(req.user.id);
        }
      } else if (req.user?.role === "admin") {
        requests = await storage.getAllServiceRequests();
      }

      res.json(requests || []);
    } catch (error) {
      next(error);
    }
  });

  app.patch("/api/service-requests/:id", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { id } = req.params;
      const updates = req.body;

      const serviceRequest = await storage.updateServiceRequest(id, updates);
      if (!serviceRequest) {
        return res.status(404).json({ message: "Service request not found" });
      }

      res.json(serviceRequest);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/service-requests/:id/accept", async (req, res, next) => {
    try {
      if (!req.isAuthenticated() || req.user?.role !== "provider") {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { id } = req.params;
      const serviceRequest = await storage.assignServiceRequest(id, req.user.id);

      if (!serviceRequest) {
        return res.status(404).json({ message: "Service request not found" });
      }

      res.json(serviceRequest);
    } catch (error) {
      next(error);
    }
  });

  // Wallet Routes
  app.get("/api/wallet", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const wallet = await storage.getWalletByUserId(req.user.id);
      res.json(wallet);
    } catch (error) {
      next(error);
    }
  });

  // Admin dashboard stats
  app.get("/api/admin/dashboard/stats", async (_req, res, next) => {
    try {
      const [totalUsersRow] = await db.select({ c: count() }).from(users);
      const [providersRow] = await db
        .select({ c: count() })
        .from(users)
        .where(eq(users.role, "provider"));
      const [residentsRow] = await db
        .select({ c: count() })
        .from(users)
        .where(eq(users.role, "resident"));
      const [pendingProvidersRow] = await db
        .select({ c: count() })
        .from(users)
        .where(and(eq(users.role, "provider"), eq(users.isApproved, false)));
      const [requestsRow] = await db.select({ c: count() }).from(serviceRequests);
      const [activeRequestsRow] = await db
        .select({ c: count() })
        .from(serviceRequests)
        .where(sql`${serviceRequests.status} IN ('pending','assigned','in_progress')`);
      const [estatesRow] = await db.select({ c: count() }).from(estates);
      const [revenueRow] = await db
        .select({ sum: sql`COALESCE(SUM(${orders.total}), 0)` })
        .from(orders);

      res.json({
        totalUsers: Number(totalUsersRow?.c || 0),
        totalProviders: Number(providersRow?.c || 0),
        totalResidents: Number(residentsRow?.c || 0),
        pendingApprovals: Number(pendingProvidersRow?.c || 0),
        totalRequests: Number(requestsRow?.c || 0),
        activeRequests: Number(activeRequestsRow?.c || 0),
        totalEstates: Number(estatesRow?.c || 0),
        totalRevenue: Number(revenueRow?.sum || 0),
      });
    } catch (err: any) {
      // If schema is still being migrated, return safe defaults instead of 500s
      console.error("[admin] dashboard stats error", err?.message || err);
      res.json({
        totalUsers: 0,
        totalProviders: 0,
        totalResidents: 0,
        pendingApprovals: 0,
        totalRequests: 0,
        activeRequests: 0,
        totalEstates: 0,
        totalRevenue: 0,
      });
    }
  });

  // Admin audit logs
  app.get("/api/admin/audit-logs", async (req, res, next) => {
    try {
      await ensureAuditLogsTable();

      const { limit = "10", search, dateFrom, dateTo } = req.query as Record<string, string | undefined>;
      const limitNum = Math.min(Math.max(parseInt(limit || "10", 10) || 10, 1), 200);

      const whereParts: any[] = [];
      if (search) {
        const like = `%${search}%`;
        whereParts.push(
          sql`(${auditLogs.action} ILIKE ${like} OR ${auditLogs.target} ILIKE ${like} OR ${auditLogs.meta}::text ILIKE ${like})`
        );
      }
      if (dateFrom) whereParts.push(sql`${auditLogs.createdAt} >= ${new Date(dateFrom)}`);
      if (dateTo) whereParts.push(sql`${auditLogs.createdAt} <= ${new Date(dateTo)}`);

      const rows = await db
        .select()
        .from(auditLogs)
        .where(whereParts.length ? and(...whereParts) : undefined as any)
        .orderBy(desc(auditLogs.createdAt))
        .limit(limitNum);

      res.json(
        rows.map((row) => ({
          ...row,
          user: { name: row.actorId },
          details: row.meta ? JSON.stringify(row.meta) : "",
        }))
      );
    } catch (err: any) {
      console.error("[admin] audit logs error", err?.message || err);
      res.json([]);
    }
  });

  // Admin Routes
  // Categories
  app.get("/api/admin/categories", async (req, res) => {
    try {
      const isAdmin =
        req.isAuthenticated() &&
        (req.user?.role === "admin" || req.user?.globalRole === "super_admin");
      if (!isAdmin) return res.status(401).json({ message: "Unauthorized" });

      await ensureCategoriesTable();
      await seedDefaultCategories();
      const { scope } = req.query as { scope?: string };
      const where =
        scope && scope !== "all"
          ? sql`${categories.scope} = ${scope}`
          : undefined;

      let list;
      try {
        list = await db
          .select()
          .from(categories)
          .where(where as any)
          .orderBy(categories.createdAt);
      } catch (err: any) {
        // Auto-heal if table was missing at runtime
        if ((err?.message || "").includes(`relation "categories" does not exist`)) {
          await ensureCategoriesTable();
          list = await db
            .select()
            .from(categories)
            .where(where as any)
            .orderBy(categories.createdAt);
        } else {
          throw err;
        }
      }

      res.json(list);
    } catch (err: any) {
      console.error("[admin] categories list error", err?.message || err);
      res.json([]);
    }
  });

  app.post("/api/admin/categories", async (req, res) => {
    try {
      const isAdmin =
        req.isAuthenticated() &&
        (req.user?.role === "admin" || req.user?.globalRole === "super_admin");
      if (!isAdmin) return res.status(401).json({ message: "Unauthorized" });

      await ensureCategoriesTable();

      const { name, key, description, icon, scope = "estate", estateId } = req.body || {};
      if (!name) return res.status(400).json({ error: "Name is required" });

      const keyVal =
        key && String(key).trim()
          ? String(key).trim().toLowerCase()
          : String(name)
              .trim()
              .toLowerCase()
              .replace(/\s+/g, "_")
              .replace(/[^a-z0-9_]/g, "");

      const [row] = await db
        .insert(categories)
        .values({
          name,
          key: keyVal,
          description: description || "",
          icon: icon || "",
          scope,
          estateId: estateId || null,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        } as any)
        .returning();

      res.status(201).json(row);
    } catch (err: any) {
      console.error("[admin] categories create error", err?.message || err);
      res.status(500).json({ error: err?.message || "Failed to create category" });
    }
  });

  app.patch("/api/admin/categories/:id", async (req, res) => {
    try {
      const isAdmin =
        req.isAuthenticated() &&
        (req.user?.role === "admin" || req.user?.globalRole === "super_admin");
      if (!isAdmin) return res.status(401).json({ message: "Unauthorized" });

      await ensureCategoriesTable();
      const { id } = req.params;
      if (!id) return res.status(400).json({ error: "Invalid category id" });

      const updates: any = { ...req.body, updatedAt: new Date() };
      if (updates.key) updates.key = String(updates.key).trim().toLowerCase();
      if (updates.estateId === undefined) {
        // keep as-is; if explicitly set null allow clearing
      }

      const [row] = await db
        .update(categories)
        .set(updates)
        .where(eq(categories.id, id))
        .returning();
      if (!row) return res.status(404).json({ error: "Category not found" });
      res.json(row);
    } catch (err: any) {
      console.error("[admin] categories update error", err?.message || err);
      res.status(500).json({ error: err?.message || "Failed to update category" });
    }
  });

  app.delete("/api/admin/categories/:id", async (req, res) => {
    try {
      const isAdmin =
        req.isAuthenticated() &&
        (req.user?.role === "admin" || req.user?.globalRole === "super_admin");
      if (!isAdmin) return res.status(401).json({ message: "Unauthorized" });

      await ensureCategoriesTable();
      const { id } = req.params;
      if (!id) return res.status(400).json({ error: "Invalid category id" });

      const [row] = await db.delete(categories).where(eq(categories.id, id)).returning();
      if (!row) return res.status(404).json({ error: "Category not found" });
      res.json({ success: true });
    } catch (err: any) {
      console.error("[admin] categories delete error", err?.message || err);
      res.status(500).json({ error: err?.message || "Failed to delete category" });
    }
  });

  // Marketplace
  app.get("/api/admin/marketplace", async (req, res) => {
    try {
      const isAdmin =
        req.isAuthenticated() &&
        (req.user?.role === "admin" || req.user?.globalRole === "super_admin");
      if (!isAdmin) return res.status(401).json({ message: "Unauthorized" });

      await ensureMarketplaceItemsTable();
      const { storeId, vendorId, estateId, category } = req.query as {
        storeId?: string;
        vendorId?: string;
        estateId?: string;
        category?: string;
      };

      const filters = [];
      if (storeId) filters.push(eq(marketplaceItems.storeId, String(storeId)));
      if (vendorId) filters.push(eq(marketplaceItems.vendorId, String(vendorId)));
      if (estateId) filters.push(eq(marketplaceItems.estateId, String(estateId)));
      if (category) filters.push(eq(marketplaceItems.category, String(category)));

      const list = await (filters.length
        ? db.select().from(marketplaceItems).where(and(...filters)).limit(500)
        : db.select().from(marketplaceItems).limit(500));
      res.json(list);
    } catch (err: any) {
      console.error("[admin] marketplace list error", err?.message || err);
      res.json([]);
    }
  });

  app.post("/api/admin/marketplace", async (req, res) => {
    try {
      const isAdmin =
        req.isAuthenticated() &&
        (req.user?.role === "admin" || req.user?.globalRole === "super_admin");
      if (!isAdmin) return res.status(401).json({ message: "Unauthorized" });

      await ensureMarketplaceItemsTable();
      const parsed = marketplaceItemValidator.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.flatten() });
      }

      const data = parsed.data as any;
      const storeId = data.storeId;
      let estateId = data.estateId ?? null;
      let vendorId = data.vendorId ?? null;

      // Derive missing estate/vendor from the store record to make the form payload lighter
      if ((!estateId || !vendorId) && storeId) {
        const storeLookup = await db.select().from(stores).where(eq(stores.id, storeId)).limit(1);
        const store = storeLookup?.[0];
        if (store) {
          estateId = estateId ?? (store as any).estateId ?? null;
          vendorId = vendorId ?? (store as any).ownerId ?? null;
        }
      }

      if (!vendorId) {
        return res.status(400).json({ error: "vendorId is required (store owner id missing)" });
      }

      const now = new Date();
      const payload = {
        ...data,
        storeId: storeId ?? null,
        estateId: estateId ?? null,
        vendorId: vendorId,
        price: Number(data.price),
        stock: data.stock ?? 0,
        images: Array.isArray(data.images) ? data.images : [],
        currency: data.currency ?? "NGN",
        unitOfMeasure: data.unitOfMeasure ?? "piece",
        isActive: data.isActive ?? true,
        createdAt: now,
        updatedAt: now,
      };

      const [row] = await db.insert(marketplaceItems).values(payload).returning();
      return res.status(201).json(row);
    } catch (err: any) {
      console.error("[admin] marketplace create error", err?.message || err);
      return res.status(500).json({ error: err?.message || "Failed to create item" });
    }
  });

  app.patch("/api/admin/marketplace/:id", async (req, res) => {
    try {
      const isAdmin =
        req.isAuthenticated() &&
        (req.user?.role === "admin" || req.user?.globalRole === "super_admin");
      if (!isAdmin) return res.status(401).json({ message: "Unauthorized" });

      await ensureMarketplaceItemsTable();
      const { id } = req.params;
      if (!id) return res.status(400).json({ error: "Invalid item id" });

      const parsed = marketplaceItemUpdateValidator.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.flatten() });
      }

      const data = parsed.data;
      const updates: any = { updatedAt: new Date() };
      if (data.name !== undefined) updates.name = data.name;
      if (data.description !== undefined) updates.description = data.description;
      if (data.price !== undefined) updates.price = Number(data.price);
      if (data.currency !== undefined) updates.currency = data.currency;
      if (data.unitOfMeasure !== undefined) updates.unitOfMeasure = data.unitOfMeasure;
      if (data.category !== undefined) updates.category = data.category;
      if (data.subcategory !== undefined) updates.subcategory = data.subcategory;
      if (data.stock !== undefined) updates.stock = data.stock;
      if (data.images !== undefined) updates.images = data.images;
      if (data.storeId !== undefined) updates.storeId = data.storeId;
      if (data.estateId !== undefined) updates.estateId = data.estateId;
      if (data.vendorId !== undefined) updates.vendorId = data.vendorId;
      if (data.isActive !== undefined) updates.isActive = data.isActive;

      const [row] = await db
        .update(marketplaceItems)
        .set(updates)
        .where(eq(marketplaceItems.id, id))
        .returning();

      if (!row) return res.status(404).json({ error: "Marketplace item not found" });
      return res.json(row);
    } catch (err: any) {
      console.error("[admin] marketplace update error", err?.message || err);
      return res.status(500).json({ error: err?.message || "Failed to update item" });
    }
  });

  app.delete("/api/admin/marketplace/:id", async (req, res) => {
    try {
      const isAdmin =
        req.isAuthenticated() &&
        (req.user?.role === "admin" || req.user?.globalRole === "super_admin");
      if (!isAdmin) return res.status(401).json({ message: "Unauthorized" });

      await ensureMarketplaceItemsTable();
      const { id } = req.params;
      if (!id) return res.status(400).json({ error: "Invalid item id" });

      const [row] = await db.delete(marketplaceItems).where(eq(marketplaceItems.id, id)).returning();
      if (!row) return res.status(404).json({ error: "Marketplace item not found" });
      return res.json({ success: true });
    } catch (err: any) {
      console.error("[admin] marketplace delete error", err?.message || err);
      return res.status(500).json({ error: err?.message || "Failed to delete item" });
    }
  });

  // Service Requests (admin view)
  app.get("/api/admin/service-requests", async (req, res) => {
    try {
      const isAdmin =
        req.isAuthenticated() &&
        (req.user?.role === "admin" || req.user?.globalRole === "super_admin");
      if (!isAdmin) return res.status(401).json({ message: "Unauthorized" });

      const list = await db.select().from(serviceRequests).limit(200);
      res.json(list);
    } catch (err: any) {
      console.error("[admin] service requests list error", err?.message || err);
      res.json([]);
    }
  });

  // Orders (placeholder if table missing)
  app.get("/api/admin/orders", async (req, res) => {
    try {
      const isAdmin =
        req.isAuthenticated() &&
        (req.user?.role === "admin" || req.user?.globalRole === "super_admin");
      if (!isAdmin) return res.status(401).json({ message: "Unauthorized" });

      try {
        const list = await db.select().from(orders).limit(200);
        return res.json({
          orders: list,
          pagination: { total: list.length, page: 1, totalPages: 1, limit: list.length },
        });
      } catch (err: any) {
        console.error("[admin] orders table missing or error", err?.message || err);
        return res.json({ orders: [], pagination: { total: 0, page: 1, totalPages: 1, limit: 0 } });
      }
    } catch (err: any) {
      return res.json({ orders: [], pagination: { total: 0, page: 1, totalPages: 1, limit: 0 } });
    }
  });

  // Orders analytics placeholder
  app.get("/api/admin/orders/analytics/stats", (_req, res) => {
    res.json({ totalOrders: 0, totalRevenue: 0, disputedOrders: 0, avgOrderValue: 0 });
  });

  // Notifications / Settings placeholders
  app.get("/api/admin/notifications", (_req, res) => res.json([]));
  app.get("/api/admin/settings", (_req, res) => res.json({}));
  app.get("/api/admin/users", async (req, res, next) => {
    try {
      const isAdmin = req.isAuthenticated() && (req.user?.role === "admin" || req.user?.globalRole === "super_admin");
      if (!isAdmin) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { role } = req.query;
      const users = await storage.getUsers(role as string);
      res.json(users);
    } catch (error) {
      next(error);
    }
  });

  // Unified list with search + role filter (used by admin dashboard)
  app.get("/api/admin/users/all", async (req, res, next) => {
    try {
      const isAdmin = req.isAuthenticated() && (req.user?.role === "admin" || req.user?.globalRole === "super_admin");
      if (!isAdmin) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { role, search } = req.query as { role?: string; search?: string };
      console.info("[admin] users list request", { requester: req.user?.id, role, search });

      // normalize role query: allow `all` to mean no filter
      const roleFilter = role && String(role).toLowerCase() !== "all" ? String(role) : undefined;

      let list;
      try {
        list = await storage.getUsers(roleFilter as any);
      } catch (err: any) {
        console.error("[admin] getUsers error:", err?.message || err);
        return res.status(500).json({ message: "Failed to fetch users", details: err?.message });
      }

      const filtered = search
        ? list.filter((u) => {
            const q = String(search).toLowerCase();
            return (
              String(u.name || "").toLowerCase().includes(q) ||
              String(u.email || "").toLowerCase().includes(q) ||
              String(u.phone || "").toLowerCase().includes(q)
            );
          })
        : list;

      res.json(filtered || []);
    } catch (error) {
      next(error);
    }
  });

  // Create user
  app.post("/api/admin/users", async (req, res, next) => {
    try {
      const isAdmin = req.isAuthenticated() && (req.user?.role === "admin" || req.user?.globalRole === "super_admin");
      if (!isAdmin) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      // Basic logging to help diagnose 500s coming from DB/enum mismatches
      console.info("[admin] create user payload:", { body: req.body });

      const {
        name,
        email,
        phone,
        password,
        role,
        globalRole,
        isActive,
        isApproved,
        company,
      } = req.body || {};

      // Normalize role: allow either `role` or `globalRole` from client
      let roleValue = ((role || globalRole || "resident") as string).toLowerCase();
      if (roleValue === "none") roleValue = "resident";

      // Validate required fields and acceptable role values
      const allowedRoles = [
        "resident",
        "provider",
        "admin",
        "super_admin",
        "estate_admin",
        "moderator",
      ];

      if (!name || !email || !password || !roleValue) {
        console.warn("[admin] create user missing fields", { name: !!name, email: !!email, password: !!password, roleValue });
        return res.status(400).json({ error: "Missing required fields" });
      }

      if (!allowedRoles.includes(roleValue)) {
        console.warn("[admin] invalid role", roleValue);
        return res.status(400).json({ error: `Invalid role: ${roleValue}` });
      }

      try {
        const existing = await storage.getUserByEmail(email);
        if (existing) {
          return res.status(400).json({ error: "Email already exists" });
        }

        const hashedPassword = await hashPassword(password);
        const safePhone = (phone ?? "").toString();
        const user = await storage.createUser({
          name,
          email,
          phone: safePhone,
          password: hashedPassword,
          role: roleValue,
          globalRole: roleValue === globalRole ? globalRole : undefined,
          company,
          isActive: isActive ?? true,
          isApproved: isApproved ?? true,
        } as any);

        return res.status(201).json(user);
      } catch (dbErr: any) {
        console.error("[admin] create user error:", dbErr?.message || dbErr);
        // Return error message to client for easier debugging in dev
        return res.status(500).json({ error: "Failed to create user", details: dbErr?.message });
      }
    } catch (error) {
      next(error);
    }
  });

  // Update user
  app.patch("/api/admin/users/:id", async (req, res, next) => {
    try {
      if (!req.isAuthenticated() || req.user?.role !== "admin") {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { id } = req.params;
      const updates: any = { ...req.body, updatedAt: new Date() };
      if (req.body?.password) {
        updates.password = await hashPassword(req.body.password);
      }

      const user = await storage.updateUser(id, updates);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      res.json(user);
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/admin/providers", async (req, res, next) => {
    try {
      const isAdmin = req.isAuthenticated() && (req.user?.role === "admin" || req.user?.globalRole === "super_admin");
      if (!isAdmin) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { search, approved, category } = req.query;

      const providers = await storage.getProviders({
        search: search as string,
        approved: approved !== undefined ? approved === "true" : undefined,
        category: category as string,
      });

      res.json(providers);
    } catch (error) {
      next(error);
    }
  });

  // Create provider
  app.post("/api/admin/providers", async (req, res, next) => {
    try {
      const isAdmin = req.isAuthenticated() && (req.user?.role === "admin" || req.user?.globalRole === "super_admin");
      if (!isAdmin) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const {
        name,
        email,
        phone,
        password,
        company,
        categories = [],
        experience = 0,
        description = "",
        isApproved = false,
      } = req.body || {};

      if (!name || !email || !password) {
        return res.status(400).json({ message: "Name, email, and password are required" });
      }

      const existing = await storage.getUserByEmail(email);
      if (existing) {
        return res.status(400).json({ message: "Email already exists" });
      }

      const hashedPassword = await hashPassword(password);
      const provider = await storage.createUser({
        name,
        email,
        phone: (phone ?? "").toString(),
        password: hashedPassword,
        role: "provider",
        globalRole: "provider",
        company,
        categories,
        experience,
        description,
        isApproved,
      } as any);

      res.status(201).json(provider);
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/admin/providers/pending", async (req, res, next) => {
    try {
      const isAdmin = req.isAuthenticated() && (req.user?.role === "admin" || req.user?.globalRole === "super_admin");
      if (!isAdmin) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const providers = await storage.getPendingProviders();
      res.json(providers);
    } catch (error) {
      next(error);
    }
  });

  // Approve/reject provider
  app.patch("/api/admin/providers/:id/approval", async (req, res, next) => {
    try {
      const isAdmin = req.isAuthenticated() && (req.user?.role === "admin" || req.user?.globalRole === "super_admin");
      if (!isAdmin) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { id } = req.params;
      const { approved } = req.body as { approved?: boolean };
      const provider = await db
        .update(users)
        .set({ isApproved: approved ?? true, updatedAt: new Date() })
        .where(eq(users.id, id))
        .returning()
        .then((rows) => rows[0]);

      if (!provider) {
        return res.status(404).json({ message: "Provider not found" });
      }

      res.json(provider);
    } catch (error) {
      next(error);
    }
  });

  // Admin: Stores CRUD (minimal)
  app.get("/api/admin/stores", async (req, res, next) => {
    try {
      const isAdmin =
        req.isAuthenticated() &&
        (req.user?.role === "admin" || req.user?.globalRole === "super_admin");
      if (!isAdmin) return res.status(401).json({ message: "Unauthorized" });

      await ensureStoresTable();
      const { search } = req.query as { search?: string };
      const where =
        search && search.trim().length > 0
          ? sql`LOWER(${stores.name}) LIKE LOWER(${"%" + search + "%"})`
          : undefined;

      let list;
      try {
        list = await db
          .select()
          .from(stores)
          .where(where as any)
          .orderBy(stores.createdAt);
      } catch (err: any) {
        if ((err?.message || "").includes(`relation "stores" does not exist`)) {
          await ensureStoresTable();
          list = await db
            .select()
            .from(stores)
            .where(where as any)
            .orderBy(stores.createdAt);
        } else {
          throw err;
        }
      }

      res.json(list);
    } catch (error: any) {
      console.error("[admin] stores list error", error?.message || error);
      res.json([]);
    }
  });

  app.post("/api/admin/stores", async (req, res, next) => {
    try {
      const isAdmin =
        req.isAuthenticated() &&
        (req.user?.role === "admin" || req.user?.globalRole === "super_admin");
      if (!isAdmin) return res.status(401).json({ message: "Unauthorized" });

      await ensureStoresTable();
      const { name, description, location, phone, email, estateId, ownerId } = req.body || {};
      if (!name || !location) {
        return res.status(400).json({ error: "Name and location are required" });
      }

      if (ownerId) {
        const [owner] = await db.select().from(users).where(eq(users.id, ownerId)).limit(1);
        if (!owner) {
          return res.status(400).json({ error: "Selected owner not found" });
        }
        const hasStoreOwnerCategory = Array.isArray((owner as any).categories)
          ? (owner as any).categories.some((c: any) => {
              const raw =
                typeof c === "string"
                  ? c
                  : c?.value || c?.key || c?.name || "";
              const norm = String(raw).trim().toLowerCase().replace(/\s+/g, "_");
              return norm === "store_owner";
            })
          : false;
        if (!hasStoreOwnerCategory) {
          return res.status(400).json({ error: "Selected provider must have the store_owner category" });
        }
      }

      const [store] = await db
        .insert(stores)
        .values({
          name,
          description,
          location,
          phone,
          email,
          estateId: estateId || null,
          ownerId: ownerId || null,
          isActive: true,
        } as any)
        .returning();

      res.status(201).json(store);
    } catch (error: any) {
      console.error("[admin] create store error", error?.message || error);
      const msg = error?.message || "";
      if (msg.includes(`relation "stores" does not exist`)) {
        try {
          await ensureStoresTable();
          const { name, description, location, phone, email, estateId, ownerId } = req.body || {};
          const [store] = await db
            .insert(stores)
            .values({
              name,
              description,
              location,
              phone,
              email,
              estateId: estateId || null,
              ownerId: ownerId || null,
              isActive: true,
            } as any)
            .returning();
          return res.status(201).json(store);
        } catch (retryErr: any) {
          console.error("[admin] create store retry failed", retryErr?.message || retryErr);
          return res.status(500).json({ error: retryErr?.message || "Failed to create store" });
        }
      }
      res.status(500).json({ error: msg || "Failed to create store" });
    }
  });

  app.patch("/api/admin/stores/:id", async (req, res) => {
    try {
      const isAdmin =
        req.isAuthenticated() &&
        (req.user?.role === "admin" || req.user?.globalRole === "super_admin");
      if (!isAdmin) return res.status(401).json({ message: "Unauthorized" });

      await ensureStoresTable();
      const { id } = req.params;
      if (!id) return res.status(400).json({ error: "Invalid store id" });

      console.info("[admin] stores patch", { id, body: req.body });
      const updates: any = { ...req.body, updatedAt: new Date() };
      if (updates.ownerId) {
        const [owner] = await db.select().from(users).where(eq(users.id, updates.ownerId)).limit(1);
        if (!owner) return res.status(400).json({ error: "Selected owner not found" });
        const hasStoreOwnerCategory = Array.isArray((owner as any).categories)
          ? (owner as any).categories.some((c: any) => {
              const raw =
                typeof c === "string"
                  ? c
                  : c?.value || c?.key || c?.name || "";
              const norm = String(raw).trim().toLowerCase().replace(/\s+/g, "_");
              return norm === "store_owner";
            })
          : false;
        if (!hasStoreOwnerCategory) {
          return res.status(400).json({ error: "Selected provider must have the store_owner category" });
        }
      }

      const [row] = await db.update(stores).set(updates).where(eq(stores.id, id)).returning();
      console.info("[admin] stores patch update result", { found: !!row, id });
      if (row) return res.json(row);

      // If no row updated, attempt to upsert (handles legacy IDs or missing records)
      const payload: any = {
        id,
        name: req.body?.name,
        description: req.body?.description || "",
        location: req.body?.location,
        phone: req.body?.phone || "",
        email: req.body?.email || "",
        ownerId: req.body?.ownerId || null,
        estateId: req.body?.estateId || null,
        isActive: req.body?.isActive ?? true,
        updatedAt: new Date(),
      };

      if (!payload.name || !payload.location) {
        return res.status(404).json({ error: "Store not found" });
      }

      const [upserted] = await db.insert(stores).values(payload).returning();
      console.info("[admin] stores patch upsert result", { inserted: !!upserted, id });

      if (!upserted) {
        return res.status(404).json({ error: "Store not found" });
      }
      return res.json(upserted);
    } catch (err: any) {
      console.error("[admin] update store error", err?.message || err);
      res.status(500).json({ error: err?.message || "Failed to update store" });
    }
  });

  // Admin: Estates CRUD
  app.get("/api/admin/estates", async (req, res, next) => {
    try {
      const isAdmin =
        req.isAuthenticated() &&
        (req.user?.role === "admin" || req.user?.globalRole === "super_admin");
      if (!isAdmin) return res.status(401).json({ message: "Unauthorized" });

      await ensureEstatesTable();

      const { search } = req.query as { search?: string };
      const where =
        search && search.trim().length > 0
          ? sql`LOWER(${estates.name}) LIKE LOWER(${"%" + search + "%"})`
          : undefined;

      const list = await db
        .select()
        .from(estates)
        .where(where as any)
        .orderBy(estates.createdAt);

      res.json(list);
    } catch (error: any) {
      console.error("[admin] estates list error", error?.message || error);
      res.json([]);
    }
  });

  app.post("/api/admin/estates", async (req, res, next) => {
    try {
      const isAdmin =
        req.isAuthenticated() &&
        (req.user?.role === "admin" || req.user?.globalRole === "super_admin");
      if (!isAdmin) return res.status(401).json({ message: "Unauthorized" });

      await ensureEstatesTable();

      const { name, slug, address, description, coverage, settings } = req.body || {};
      if (!name || !slug || !address) {
        return res.status(400).json({ message: "name, slug, and address are required" });
      }

      const payload: any = {
        name,
        slug,
        address,
        description: description ?? "",
        coverage:
          coverage && coverage.type && coverage.coordinates
            ? coverage
            : { type: "Polygon", coordinates: [[[0, 0],[0,1],[1,1],[1,0],[0,0]]]},
        settings:
          settings && typeof settings === "object"
            ? settings
            : { servicesEnabled: [], marketplaceEnabled: true, paymentMethods: [], deliveryRules: {} },
      };

      const [row] = await db.insert(estates).values(payload).returning();
      res.status(201).json(row);
    } catch (error: any) {
      console.error("[admin] create estate error", error?.message || error);
      res.status(500).json({ error: error?.message || "Failed to create estate" });
    }
  });

  app.patch("/api/admin/estates/:id", async (req, res, next) => {
    try {
      const isAdmin =
        req.isAuthenticated() &&
        (req.user?.role === "admin" || req.user?.globalRole === "super_admin");
      if (!isAdmin) return res.status(401).json({ message: "Unauthorized" });

      const { id } = req.params;
      if (!id) return res.status(400).json({ message: "Invalid estate id" });

      const updates: any = { ...req.body, updatedAt: new Date() };
      const [row] = await db.update(estates).set(updates).where(eq(estates.id, id)).returning();
      if (!row) return res.status(404).json({ message: "Estate not found" });
      res.json(row);
    } catch (error) {
      next(error);
    }
  });

  app.delete("/api/admin/estates/:id", async (req, res, next) => {
    try {
      const isAdmin =
        req.isAuthenticated() &&
        (req.user?.role === "admin" || req.user?.globalRole === "super_admin");
      if (!isAdmin) return res.status(401).json({ message: "Unauthorized" });

      const { id } = req.params;
      if (!id) return res.status(400).json({ message: "Invalid estate id" });

      const [row] = await db.delete(estates).where(eq(estates.id, id)).returning();
      if (!row) return res.status(404).json({ message: "Estate not found" });
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/admin/stats", async (req, res, next) => {
    try {
      const isAdmin =
        req.isAuthenticated() &&
        (req.user?.role === "admin" || req.user?.globalRole === "super_admin");
      if (!isAdmin) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const [
        [totalUsers],
        [totalResidents],
        [totalProviders],
        [totalRequests],
        [activeRequests],
        [pendingApprovals],
        [totalEstates],
        [revenueRow],
      ] = await Promise.all([
        db.select({ c: count() }).from(users),
        db.select({ c: count() }).from(users).where(eq(users.role, "resident")),
        db.select({ c: count() }).from(users).where(eq(users.role, "provider")),
        db.select({ c: count() }).from(serviceRequests),
        db
          .select({ c: count() })
          .from(serviceRequests)
          .where(eq(serviceRequests.status, "pending")),
        db
          .select({ c: count() })
          .from(users)
          .where(and(eq(users.role, "provider"), eq(users.isApproved, false))),
        db.select({ c: count() }).from(estates),
        db.select({ sum: sql`COALESCE(SUM(${orders.total}), 0)` }).from(orders),
      ]);

      res.json({
        totalUsers: Number(totalUsers?.c ?? 0),
        totalResidents: Number(totalResidents?.c ?? 0),
        totalProviders: Number(totalProviders?.c ?? 0),
        totalRequests: Number(totalRequests?.c ?? 0),
        activeRequests: Number(activeRequests?.c ?? 0),
        pendingApprovals: Number(pendingApprovals?.c ?? 0),
        totalEstates: Number(totalEstates?.c ?? 0),
        totalRevenue: Number(revenueRow?.sum ?? 0),
      });
    } catch (error) {
      next(error);
    }
  });

  // Public business overview for company partners
  app.get("/api/business/overview", async (_req, res, next) => {
    try {
      const [
        [totalProviders],
        [activeRequests],
        [revenueRow],
        recentActivity,
      ] = await Promise.all([
        db.select({ c: count() }).from(users).where(eq(users.role, "provider")),
        db
          .select({ c: count() })
          .from(serviceRequests)
          .where(eq(serviceRequests.status, "pending")),
        db
          .select({ sum: sql`COALESCE(SUM(${orders.total}), 0)` })
          .from(orders),
        db
          .select({
            id: serviceRequests.id,
            status: serviceRequests.status,
            category: serviceRequests.category,
            createdAt: serviceRequests.createdAt,
          })
          .from(serviceRequests)
          .orderBy(desc(serviceRequests.createdAt))
          .limit(8),
      ]);

      res.json({
        totalProviders: Number(totalProviders?.c ?? 0),
        activeRequests: Number(activeRequests?.c ?? 0),
        totalRevenue: Number(revenueRow?.sum ?? 0),
        recentActivity,
      });
    } catch (error) {
      next(error);
    }
  });

  // Admin: bridge stats (users + service requests from canonical Postgres tables)
  app.get("/api/admin/bridge/stats", async (req, res, next) => {
    try {
      const isAdmin =
        req.isAuthenticated() &&
        (req.user?.role === "admin" || req.user?.globalRole === "super_admin");
      if (!isAdmin) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const [[residents], [providers], [pendingProviders]] = await Promise.all([
        db.select({ c: count() }).from(users).where(eq(users.role, "resident")),
        db.select({ c: count() }).from(users).where(eq(users.role, "provider")),
        db
          .select({ c: count() })
          .from(users)
          .where(and(eq(users.role, "provider"), eq(users.isApproved, false))),
      ]);

      const [[srTotal], [srPending], [srInProgress], [srCompleted], [srCancelled]] =
        await Promise.all([
          db.select({ c: count() }).from(serviceRequests),
          db
            .select({ c: count() })
            .from(serviceRequests)
            .where(eq(serviceRequests.status, "pending")),
          db
            .select({ c: count() })
            .from(serviceRequests)
            .where(eq(serviceRequests.status, "in_progress")),
          db
            .select({ c: count() })
            .from(serviceRequests)
            .where(eq(serviceRequests.status, "completed")),
          db
            .select({ c: count() })
            .from(serviceRequests)
            .where(eq(serviceRequests.status, "cancelled")),
        ]);

      res.json({
        users: {
          totalResidents: Number(residents?.c ?? 0),
          totalProviders: Number(providers?.c ?? 0),
          pendingProviders: Number(pendingProviders?.c ?? 0),
        },
        serviceRequests: {
          total: Number(srTotal?.c ?? 0),
          pending: Number(srPending?.c ?? 0),
          inProgress: Number(srInProgress?.c ?? 0),
          completed: Number(srCompleted?.c ?? 0),
          cancelled: Number(srCancelled?.c ?? 0),
        },
      });
      } catch (error) {
        next(error);
      }
    });

  // Admin: list service requests from the canonical bridge tables scoped to the selected estate
  app.get("/api/admin/bridge/service-requests", async (req, res, next) => {
    try {
      const isAdmin =
        req.isAuthenticated() &&
        (req.user?.role === "admin" || req.user?.globalRole === "super_admin");
      if (!isAdmin) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const query = req.query as Record<string, string | undefined>;
      const estateId = req.header("X-Estate-Id") || query.estateId;
      if (!estateId) {
        return res.status(400).json({ message: "Estate context is required" });
      }

      const status = query.status;
      const search = query.q?.trim();
      const rawLimit = parseInt(query.limit ?? "200", 10);
      const limitValue = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 500) : 200;

      const whereParts: any[] = [eq(serviceRequests.estateId, estateId)];
      if (status) {
        whereParts.push(eq(serviceRequests.status, status));
      }
      if (search) {
        const needle = `%${search}%`;
        whereParts.push(
          sql`(${serviceRequests.description} ILIKE ${needle} OR ${serviceRequests.category} ILIKE ${needle} OR ${serviceRequests.id} ILIKE ${needle})`
        );
      }

      const rows = await db
        .select({
          id: serviceRequests.id,
          category: serviceRequests.category,
          description: serviceRequests.description,
          status: serviceRequests.status,
          providerId: serviceRequests.providerId,
          residentId: serviceRequests.residentId,
          createdAt: serviceRequests.createdAt,
          billedAmount: serviceRequests.billedAmount,
        })
        .from(serviceRequests)
        .where(and(...whereParts))
        .orderBy(desc(serviceRequests.createdAt))
        .limit(limitValue);

      res.json(rows);
    } catch (error) {
      next(error);
    }
  });

  // Public: Companies lookup (used for provider registration)
  app.get("/api/companies", async (req, res, next) => {
    try {
      const companies = await storage.getCompanies();
      res.json(companies);
    } catch (error) {
      next(error);
    }
  });

  // Admin: Companies (for providers)
  app.get("/api/admin/companies", async (req, res, next) => {
    try {
      if (!req.isAuthenticated() || req.user?.role !== "admin") {
        return res.status(401).json({ message: "Unauthorized" });
      }
      const companies = await storage.getCompanies();
      res.json(companies);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/admin/companies", async (req, res, next) => {
    try {
      if (!req.isAuthenticated() || req.user?.role !== "admin") {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { name, description, contactEmail, phone } = req.body || {};
      if (!name) return res.status(400).json({ message: "Name is required" });

      const company = await storage.createCompany({
        name,
        description,
        contactEmail,
        phone,
      } as any);

      res.status(201).json(company);
    } catch (error) {
      next(error);
    }
  });

  // Admin: Get a specific service request by ID
  app.get("/api/admin/service-requests/:id", async (req, res, next) => {
    try {
      if (!req.isAuthenticated() || req.user?.role !== "admin") {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { id } = req.params;
      const request = await storage.getServiceRequest(id);

      if (!request) {
        return res.status(404).json({ message: "Service request not found" });
      }

      res.json(request);
    } catch (error) {
      console.error("Error fetching service request for admin:", error);
      next(error);
    }
  });

  // Access Code Generation Route (for testing)
  app.post("/api/generate-access-code", async (req, res, next) => {
    try {
      if (!req.isAuthenticated() || req.user?.role !== "admin") {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const accessCode = Math.floor(100000 + Math.random() * 900000).toString();
      res.json({ accessCode });
    } catch (error) {
      next(error);
    }
  });

  // Resident: Get a specific service request by ID
  app.get("/api/service-requests/:id", async (req, res, next) => {
    try {
      if (!req.isAuthenticated() || req.user?.role !== "resident") {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { id } = req.params;
      if (!id || typeof id !== "string") {
        return res.status(400).json({ message: "Invalid service request ID" });
      }

      const request = await storage.getServiceRequest(id);

      if (!request) {
        return res.status(404).json({ message: "Service request not found" });
      }

      res.json(request);
    } catch (error) {
      console.error("Error fetching service request:", error);
      next(error);
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
