import { sql } from "drizzle-orm";
import {
  pgTable,
  text,
  varchar,
  timestamp,
  integer,
  decimal,
  boolean,
  pgEnum,
  doublePrecision,
  jsonb,
  uuid,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Enums
export const userRoleEnum = pgEnum("user_role", [
  "resident",
  "provider",
  "admin",
  "super_admin",
  "estate_admin",
  "moderator",
]);
export const serviceStatusEnum = pgEnum("service_status", [
  "pending",
  "pending_inspection",
  "assigned",
  "assigned_for_job",
  "in_progress",
  "work_completed_pending_resident",
  "disputed",
  "rework_required",
  "completed",
  "cancelled",
]);
export const urgencyEnum = pgEnum("urgency", [
  "low",
  "medium",
  "high",
  "emergency",
]);
export const serviceCategoryEnum = pgEnum("service_category", [
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
  // CityBuddy (resident chat) categories
  "surveillance_monitoring",
  "alarm_system",
  "cleaning_janitorial",
  "catering_services",
  "it_support",
  "maintenance_repair",
  "general_repairs",
  "locksmith",
  "glass_windows",
  "packaging_solutions",
  "marketing_advertising",
  "home_tutors",
  "furniture_making",
  "market_runner",
  "item_vendor",
]);
export const transactionTypeEnum = pgEnum("transaction_type", [
  "debit",
  "credit",
]);
export const transactionStatusEnum = pgEnum("transaction_status", [
  "pending",
  "completed",
  "failed",
]);
export const membershipStatusEnum = pgEnum("membership_status", [
  "pending",
  "active",
  "suspended",
  "rejected",
  "left",
]);
export const roleScopeEnum = pgEnum("role_scope", [
  "platform",
  "estate",
  "business",
]);

// ADD new enums
export const billStatusEnum = pgEnum("bill_status", [
  "draft",
  "issued",
  "paid",
  "cancelled",
]);
export const messageSenderEnum = pgEnum("message_sender", [
  "admin",
  "resident",
  "provider",
]);
export const disputeStatusEnum = pgEnum("dispute_status", [
  "open",
  "resolved",
  "rejected",
  "escalated",
]);
export const orderStatusEnum = pgEnum("order_status", [
  "pending",
  "processing",
  "delivered",
  "cancelled",
]);
export const categoryScopeEnum = pgEnum("category_scope", [
  "global",
  "estate",
]);
export const unitOfMeasureEnum = pgEnum("unit_of_measure", [
  "kg",
  "g",
  "liter",
  "ml",
  "piece",
  "bunch",
  "pack",
  "bag",
  "bottle",
  "can",
  "box",
  "dozen",
  "yard",
  "meter",
]);
export const storeApprovalStatusEnum = pgEnum("store_approval_status", [
  "pending",
  "approved",
  "rejected",
]);

// â”€â”€ Marketplace V2 enums â”€â”€
export const cartStatusEnum = pgEnum("cart_status", [
  "active",
  "checked_out",
  "abandoned",
]);
export const parentOrderStatusEnum = pgEnum("parent_order_status", [
  "pending_payment",
  "paid",
  "partially_refunded",
  "refunded",
  "cancelled",
]);
export const storeOrderStatusEnum = pgEnum("store_order_status", [
  "pending_acceptance",
  "accepted",
  "rejected",
  "packing",
  "ready_for_dispatch",
  "dispatched",
  "delivered",
  "cancelled",
  "refunded",
]);
export const deliveryMethodEnum = pgEnum("delivery_method", [
  "pickup",
  "store_delivery",
  "cityconnect_rider",
]);
export const paymentProviderEnum = pgEnum("payment_provider", [
  "paystack",
]);
export const paymentStatusEnum = pgEnum("payment_status_enum", [
  "initiated",
  "paid",
  "failed",
  "refunded",
  "partial_refund",
]);
export const refundStatusEnum = pgEnum("refund_status", [
  "requested",
  "approved",
  "rejected",
  "processed",
]);
export const broadcastTargetEnum = pgEnum("broadcast_target", [
  "all_residents",
  "all_providers",
  "all_users",
  "estate_residents",
  "estate_providers",
]);
export const broadcastStatusEnum = pgEnum("broadcast_status", [
  "draft",
  "sent",
  "scheduled",
]);
export const conversationStatusEnum = pgEnum("conversation_status", [
  "active",
  "closed",
]);
export const conversationRoleEnum = pgEnum("conversation_role", [
  "user",
  "assistant",
]);
export const conversationMessageTypeEnum = pgEnum("conversation_message_type", [
  "text",
  "image",
]);
export const requestConversationModeEnum = pgEnum("request_conversation_mode", [
  "ai",
  "ordinary",
]);
export const aiSessionStatusEnum = pgEnum("ai_session_status", [
  "active",
  "completed",
]);
export const aiSessionRoleEnum = pgEnum("ai_session_role", [
  "user",
  "assistant",
  "system",
]);
export const requestAiProviderEnum = pgEnum("request_ai_provider", [
  "gemini",
  "ollama",
  "openai",
]);
export const requestOrdinaryPresentationEnum = pgEnum("request_ordinary_presentation", [
  "chat",
  "form",
]);
export const requestQuestionModeEnum = pgEnum("request_question_mode", [
  "ai",
  "ordinary",
]);
export const requestQuestionScopeEnum = pgEnum("request_question_scope", [
  "global",
  "category",
]);
export const requestQuestionTypeEnum = pgEnum("request_question_type", [
  "text",
  "textarea",
  "select",
  "date",
  "datetime",
  "estate",
  "urgency",
  "image",
  "multi_image",
]);

// Simple app settings (key/value) table for global configs
export const appSettings = pgTable("app_settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull().default("{}"),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Estates table (from MongoDB)
export const estates = pgTable("estates", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description"),
  address: text("address").notNull(),
  accessType: text("access_type"),
  accessCode: text("access_code"),
  coverage: jsonb("coverage").notNull(), // GeoJSON Polygon
  settings: jsonb("settings").notNull().default('{"servicesEnabled":[],"marketplaceEnabled":true,"paymentMethods":[],"deliveryRules":{}}'),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Users table (merged: residents, providers, and admin users)
export const users = pgTable("users", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  // New split names (keep `name` for compatibility during rollout)
  firstName: text("first_name"),
  lastName: text("last_name"),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  phone: text("phone").notNull(),
  password: text("password").notNull(),
  accessCode: text("access_code"), // 6-digit code for residents
  role: userRoleEnum("role").notNull().default("resident"),
  globalRole: userRoleEnum("global_role"), // for admin users from MongoDB
  rating: decimal("rating", { precision: 3, scale: 2 }).default("0"),
  isActive: boolean("is_active").notNull().default(true),
  isApproved: boolean("is_approved").notNull().default(true), // for providers
  categories: varchar("categories", { length: 100 }).array(), // for providers
  serviceCategory: serviceCategoryEnum("service_category"), // for providers
  experience: integer("experience"), // years of experience for providers
  company: text("company"), // company name for providers (from MongoDB)
  documents: text("documents").array(), // provider documents
  location: text("location"), // building/block info for residents
  latitude: doublePrecision("latitude"), // optional latitude for location
  longitude: doublePrecision("longitude"), // optional longitude for location
  lastLoginAt: timestamp("last_login_at"), // for admin users
  metadata: jsonb("metadata"), // flexible field for extra profile data from MongoDB
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Memberships table (user-estate relationships from MongoDB)
export const memberships = pgTable("memberships", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar("user_id")
    .notNull()
    .references(() => users.id),
  estateId: varchar("estate_id")
    .notNull()
    .references(() => estates.id),
  role: userRoleEnum("role").notNull(),
  isPrimary: boolean("is_primary").notNull().default(false),
  status: membershipStatusEnum("status").notNull().default("active"),
  isActive: boolean("is_active").notNull().default(true),
  permissions: text("permissions").array(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const roles = pgTable("roles", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  key: text("key").notNull().unique(),
  name: text("name").notNull(),
  scope: roleScopeEnum("scope").notNull().default("platform"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const permissions = pgTable("permissions", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  key: text("key").notNull().unique(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const rolePermissions = pgTable("role_permissions", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  roleId: varchar("role_id")
    .notNull()
    .references(() => roles.id, { onDelete: "cascade" }),
  permissionId: varchar("permission_id")
    .notNull()
    .references(() => permissions.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow(),
});

export const membershipRoles = pgTable("membership_roles", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  membershipId: varchar("membership_id")
    .notNull()
    .references(() => memberships.id, { onDelete: "cascade" }),
  roleId: varchar("role_id")
    .notNull()
    .references(() => roles.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow(),
});

// Categories table (from MongoDB)
export const categories = pgTable("categories", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  scope: categoryScopeEnum("scope").notNull(),
  estateId: varchar("estate_id").references(() => estates.id),
  name: text("name").notNull(),
  key: text("key").notNull(),
  // Optional emoji for category display (e.g., ðŸ”Œ)
  emoji: text("emoji"),
  description: text("description"),
  icon: text("icon"),
  tag: text("tag").notNull().default("Facility Management ðŸ—ï¸"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Stores table (marketplace vendor stores)
export const stores = pgTable("stores", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  estateId: varchar("estate_id").references(() => estates.id), // Nullable - estate assigned by admin after approval
  ownerId: varchar("owner_id").references(() => users.id), // Optional: primary owner
  companyId: varchar("company_id"), // Company that owns this store (optional)
  name: text("name").notNull(),
  description: text("description"),
  location: text("location").notNull(), // Physical location/address
  latitude: doublePrecision("latitude"),
  longitude: doublePrecision("longitude"),
  phone: text("phone"),
  email: text("email"),
  logo: text("logo"), // Store logo URL
  approvalStatus: storeApprovalStatusEnum("approval_status").notNull().default("pending"),
  approvedBy: varchar("approved_by").references(() => users.id), // Admin who approved
  approvedAt: timestamp("approved_at"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Store Members table (allocate multiple providers to a store)
export const storeMembers = pgTable("store_members", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  storeId: varchar("store_id")
    .notNull()
    .references(() => stores.id),
  userId: varchar("user_id")
    .notNull()
    .references(() => users.id),
  role: text("role").notNull().default("member"), // 'owner', 'manager', 'member'
  canManageItems: boolean("can_manage_items").notNull().default(true),
  canManageOrders: boolean("can_manage_orders").notNull().default(true),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  uniqueStoreMember: sql`UNIQUE (${table.storeId}, ${table.userId})`,
}));

// Store Estates table (many-to-many: stores can deliver to multiple estates)
export const storeEstates = pgTable("store_estates", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  storeId: varchar("store_id")
    .notNull()
    .references(() => stores.id, { onDelete: "cascade" }),
  estateId: varchar("estate_id")
    .notNull()
    .references(() => estates.id, { onDelete: "cascade" }),
  allocatedBy: varchar("allocated_by")
    .notNull()
    .references(() => users.id), // Admin who allocated this estate
  allocatedAt: timestamp("allocated_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  uniqueStoreEstate: sql`UNIQUE (${table.storeId}, ${table.estateId})`,
}));

export const notifications = pgTable("notifications", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar("user_id")
    .notNull()
    .references(() => users.id),
  title: varchar("title", { length: 120 }).notNull(),
  message: text("message").notNull(),
  type: varchar("type", { length: 20 }).notNull().default("info"),
  metadata: jsonb("metadata").notNull().default(sql`'{}'::jsonb`),
  isRead: boolean("is_read").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Marketplace Items table (from MongoDB)
export const marketplaceItems = pgTable("marketplace_items", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  estateId: varchar("estate_id").references(() => estates.id),
  storeId: varchar("store_id").references(() => stores.id), // Nullable for backward compatibility
  vendorId: varchar("vendor_id")
    .notNull()
    .references(() => users.id), // Legacy: keep for backward compatibility
  name: text("name").notNull(),
  description: text("description"),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  currency: varchar("currency", { length: 10 }).notNull().default("NGN"),
  unitOfMeasure: unitOfMeasureEnum("unit_of_measure").default("piece"), // Nullable for backward compatibility
  category: text("category").notNull(),
  subcategory: text("subcategory"),
  stock: integer("stock").notNull().default(0),
  images: text("images").array(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Item Categories table (for marketplace items)
export const itemCategories = pgTable("item_categories", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  emoji: text("emoji"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Companies table (for provider associations)
export const companies = pgTable("companies", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  contactEmail: text("contact_email"),
  phone: text("phone"),
  providerId: varchar("provider_id").references(() => users.id),
  // Backwards-compatible blob retained until migration completes
  details: jsonb("details").notNull().default("{}"),

  // New structured fields (JSON/nullable for smooth migration)
  businessDetails: jsonb("business_details"),
  bankDetails: jsonb("bank_details"),
  locationDetails: jsonb("location_details"),
  submittedAt: timestamp("submitted_at"),
  isActive: boolean("is_active").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const providerRequests = pgTable("provider_requests", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  email: text("email").notNull(),
  phone: text("phone"),
  company: text("company"),
  categories: varchar("categories", { length: 100 }).array(),
  experience: integer("experience").notNull().default(0),
  description: text("description"),
  providerId: varchar("provider_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});

export const mongoIdMappings = pgTable("mongo_id_mappings", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  mongoId: text("mongo_id").notNull(),
  postgresId: varchar("postgres_id").notNull(),
  entityType: text("entity_type").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertCompanySchema = createInsertSchema(companies);
export type Company = typeof companies.$inferSelect;
export type InsertCompany = typeof companies.$inferInsert;

export const insertProviderRequestSchema = createInsertSchema(providerRequests).omit({
  id: true,
  createdAt: true,
});
export type ProviderRequest = typeof providerRequests.$inferSelect;
export type InsertProviderRequest = z.infer<typeof insertProviderRequestSchema>;

// Orders table (from MongoDB)
export const orders = pgTable("orders", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  estateId: varchar("estate_id")
    .notNull()
    .references(() => estates.id),
  storeId: varchar("store_id").references(() => stores.id), // Optional: for store-specific orders
  buyerId: varchar("buyer_id")
    .notNull()
    .references(() => users.id),
  vendorId: varchar("vendor_id")
    .notNull()
    .references(() => users.id),
  items: jsonb("items").notNull(), // Array of {itemId, name, price, quantity, unitOfMeasure}
  total: decimal("total", { precision: 10, scale: 2 }).notNull(),
  currency: varchar("currency", { length: 10 }).notNull().default("NGN"),
  status: orderStatusEnum("status").notNull().default("pending"),
  deliveryAddress: text("delivery_address").notNull(),
  paymentMethod: text("payment_method"),
  paymentId: text("payment_id"),
  dispute: jsonb("dispute"), // {reason, status, resolvedAt}
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// â”€â”€ Marketplace V2: Inventory â”€â”€
export const inventory = pgTable("inventory", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  storeId: varchar("store_id")
    .notNull()
    .references(() => stores.id, { onDelete: "cascade" }),
  productId: varchar("product_id")
    .notNull()
    .references(() => marketplaceItems.id, { onDelete: "cascade" }),
  stockQty: integer("stock_qty").notNull().default(0),
  reservedQty: integer("reserved_qty").notNull().default(0),
  lowStockThreshold: integer("low_stock_threshold"),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  uniqueStoreProduct: sql`UNIQUE (${table.storeId}, ${table.productId})`,
}));

// â”€â”€ Marketplace V2: Carts â”€â”€
export const carts = pgTable("carts", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  residentId: varchar("resident_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  status: cartStatusEnum("status").notNull().default("active"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const cartItems = pgTable("cart_items", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  cartId: varchar("cart_id")
    .notNull()
    .references(() => carts.id, { onDelete: "cascade" }),
  storeId: varchar("store_id")
    .notNull()
    .references(() => stores.id),
  productId: varchar("product_id")
    .notNull()
    .references(() => marketplaceItems.id),
  qty: integer("qty").notNull().default(1),
  unitPrice: integer("unit_price").notNull(), // snapshot in kobo
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  uniqueCartProduct: sql`UNIQUE (${table.cartId}, ${table.productId})`,
}));

// â”€â”€ Marketplace V2: Parent Orders (umbrella) â”€â”€
export const parentOrders = pgTable("parent_orders", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  residentId: varchar("resident_id")
    .notNull()
    .references(() => users.id),
  totalAmount: integer("total_amount").notNull(), // kobo
  currency: varchar("currency", { length: 10 }).notNull().default("NGN"),
  status: parentOrderStatusEnum("status").notNull().default("pending_payment"),
  deliveryAddress: jsonb("delivery_address").notNull(), // {estateId, region, addressLine, phone}
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// â”€â”€ Marketplace V2: Store Orders (one per store per parent order) â”€â”€
export const storeOrders = pgTable("store_orders", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  orderId: varchar("order_id")
    .notNull()
    .references(() => parentOrders.id, { onDelete: "cascade" }),
  storeId: varchar("store_id")
    .notNull()
    .references(() => stores.id),
  status: storeOrderStatusEnum("status").notNull().default("pending_acceptance"),
  subtotalAmount: integer("subtotal_amount").notNull(), // kobo
  deliveryFee: integer("delivery_fee").notNull().default(0),
  deliveryMethod: deliveryMethodEnum("delivery_method").notNull().default("pickup"),
  noteToStore: text("note_to_store"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  uniqueOrderStore: sql`UNIQUE (${table.orderId}, ${table.storeId})`,
}));

export const storeOrderItems = pgTable("store_order_items", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  storeOrderId: varchar("store_order_id")
    .notNull()
    .references(() => storeOrders.id, { onDelete: "cascade" }),
  productId: varchar("product_id")
    .notNull()
    .references(() => marketplaceItems.id),
  qty: integer("qty").notNull(),
  unitPrice: integer("unit_price").notNull(), // kobo snapshot
  lineTotal: integer("line_total").notNull(), // qty * unitPrice
  createdAt: timestamp("created_at").defaultNow(),
});

// â”€â”€ Marketplace V2: Payments â”€â”€
export const marketplacePayments = pgTable("marketplace_payments", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  orderId: varchar("order_id")
    .notNull()
    .references(() => parentOrders.id),
  provider: paymentProviderEnum("provider").notNull().default("paystack"),
  reference: varchar("reference", { length: 255 }).notNull().unique(),
  status: paymentStatusEnum("status").notNull().default("initiated"),
  amount: integer("amount").notNull(), // kobo
  meta: jsonb("meta").notNull().default(sql`'{}'::jsonb`),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// â”€â”€ Marketplace V2: Refunds (store-level) â”€â”€
export const refunds = pgTable("refunds", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  storeOrderId: varchar("store_order_id")
    .notNull()
    .references(() => storeOrders.id),
  status: refundStatusEnum("status").notNull().default("requested"),
  amount: integer("amount").notNull(), // kobo
  reason: text("reason"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// CityMart Banners table (configurable promotional banners)
export const cityMartBanners = pgTable("citymart_banners", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  type: varchar("type", { length: 50 }).notNull(), // 'hero', 'horizontal', 'aside-long', 'aside-small', 'full-width'
  title: text("title").notNull(),
  description: text("description"),
  heading: text("heading"), // for full-width banners
  buttonText: text("button_text"),
  buttonVariant: text("button_variant"), // 'primary', 'secondary', 'dark'
  buttonLink: text("button_link"), // URL or route path
  imageUrl: text("image_url"),
  backgroundImageUrl: text("background_image_url"),
  badge: jsonb("badge"), // {text: string, color: string}
  discount: jsonb("discount"), // {text: string, color: string}
  price: text("price"),
  priceLabel: text("price_label"), // "Just", "Only", etc.
  priceSuffix: text("price_suffix"), // "Only!", etc.
  priceTopText: text("price_top_text"),
  priceBottomText: text("price_bottom_text"),
  promoBadgeText: text("promo_badge_text"), // "SAVE UP TO 50%", etc.
  countdown: text("countdown"), // Deal countdown timer text
  category: text("category"), // COMPUTER & ACCESSORIES, etc.
  position: integer("position").notNull().default(0), // Display order
  isActive: boolean("is_active").notNull().default(true),
  showCarouselDots: boolean("show_carousel_dots").default(false),
  activeCarouselDot: integer("active_carousel_dot").default(0),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Broadcast Messages table
export const broadcastMessages = pgTable("broadcast_messages", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  senderId: varchar("sender_id")
    .notNull()
    .references(() => users.id),
  estateId: varchar("estate_id").references(() => estates.id), // Null for system-wide broadcasts
  target: broadcastTargetEnum("target").notNull(),
  subject: text("subject").notNull(),
  message: text("message").notNull(),
  status: broadcastStatusEnum("status").notNull().default("draft"),
  scheduledFor: timestamp("scheduled_for"),
  sentAt: timestamp("sent_at"),
  recipientCount: integer("recipient_count").default(0),
  deliveredCount: integer("delivered_count").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Admin Impersonation Sessions table
export const impersonationSessions = pgTable("impersonation_sessions", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  superAdminId: varchar("super_admin_id")
    .notNull()
    .references(() => users.id),
  targetUserId: varchar("target_user_id")
    .notNull()
    .references(() => users.id),
  reason: text("reason"),
  startedAt: timestamp("started_at").defaultNow(),
  endedAt: timestamp("ended_at"),
  ipAddress: text("ip_address"),
  isActive: boolean("is_active").notNull().default(true),
});

// Audit Logs table (from MongoDB)
export const auditLogs = pgTable("audit_logs", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  actorId: varchar("actor_id").notNull(),
  estateId: varchar("estate_id").references(() => estates.id),
  action: text("action").notNull(),
  target: text("target").notNull(),
  targetId: text("target_id").notNull(),
  meta: jsonb("meta").notNull().default('{}'),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Service Requests table
export const serviceRequests = pgTable("service_requests", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  estateId: varchar("estate_id").references(() => estates.id), // optional estate reference
  category: serviceCategoryEnum("category").notNull(),
  description: text("description").notNull(),
  residentId: varchar("resident_id")
    .notNull()
    .references(() => users.id),
  providerId: varchar("provider_id").references(() => users.id),
  status: serviceStatusEnum("status").notNull().default("pending"),
  budget: text("budget").notNull(), // budget range as string
  urgency: urgencyEnum("urgency").notNull(),
  location: text("location").notNull(),
  latitude: doublePrecision("latitude"), // optional latitude for service location
  longitude: doublePrecision("longitude"), // optional longitude for service location
  preferredTime: timestamp("preferred_time"),
  specialInstructions: text("special_instructions"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  // Admin advice and inspection fields
  adviceMessage: text("advice_message"),
  inspectionDates: text("inspection_dates").array(), // Array of date strings
  inspectionTimes: text("inspection_times").array(), // Array of time strings
  // Other admin fields
  adminNotes: text("admin_notes"),
  assignedAt: timestamp("assigned_at"),
  paymentRequestedAt: timestamp("payment_requested_at"),
  approvedForJobAt: timestamp("approved_for_job_at"),
  approvedForJobBy: varchar("approved_for_job_by").references(() => users.id),
  consultancyReport: jsonb("consultancy_report"),
  consultancyReportSubmittedAt: timestamp("consultancy_report_submitted_at"),
  consultancyReportSubmittedBy: varchar("consultancy_report_submitted_by").references(() => users.id),
  categoryLabel: text("category_label"),
  issueType: text("issue_type"),
  areaAffected: text("area_affected"),
  quantityLabel: text("quantity_label"),
  timeWindowLabel: text("time_window_label"),
  photosCount: integer("photos_count"),
  addressLine: text("address_line"),
  estateName: text("estate_name"),
  stateName: text("state_name"),
  lgaName: text("lga_name"),
  paymentPurpose: text("payment_purpose"),
  consultancyFee: decimal("consultancy_fee", { precision: 10, scale: 2 }),
  materialCost: decimal("material_cost", { precision: 10, scale: 2 }),
  serviceCost: decimal("service_cost", { precision: 10, scale: 2 }),
  requestedTotal: decimal("requested_total", { precision: 10, scale: 2 }),
  assignedInspectorId: varchar("assigned_inspector_id").references(() => users.id),
  assignedJobProviderId: varchar("assigned_job_provider_id").references(() => users.id),
  closedAt: timestamp("closed_at"),
  closeReason: text("close_reason"),
  billedAmount: decimal("billed_amount", { precision: 10, scale: 2 }).default(
    "0",
  ),
  paymentStatus: text("payment_status").default("pending"),
});

export const serviceRequestCancellationCases = pgTable("service_request_cancellation_cases", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  requestId: varchar("request_id")
    .notNull()
    .references(() => serviceRequests.id, { onDelete: "cascade" }),
  residentId: varchar("resident_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  status: text("status").notNull().default("requested"), // requested | under_review | approved | rejected | withdrawn
  reasonCode: text("reason_code").notNull(),
  reasonDetail: text("reason_detail").notNull(),
  preferredResolution: text("preferred_resolution").notNull().default("full_refund"),
  evidence: jsonb("evidence").notNull().default("[]"),
  adminDecision: text("admin_decision"),
  adminNote: text("admin_note"),
  refundDecision: text("refund_decision").notNull().default("none"), // none | full | partial
  refundAmount: decimal("refund_amount", { precision: 10, scale: 2 }),
  assignedAdminId: varchar("assigned_admin_id").references(() => users.id),
  providerFeedback: text("provider_feedback"),
  companyFeedback: text("company_feedback"),
  resolvedAt: timestamp("resolved_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const companyTasks = pgTable("company_tasks", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  companyId: varchar("company_id")
    .notNull()
    .references(() => companies.id),
  title: text("title").notNull(),
  description: text("description"),
  assigneeId: varchar("assignee_id").references(() => users.id),
  createdBy: varchar("created_by")
    .notNull()
    .references(() => users.id),
  priority: text("priority").notNull().default("medium"),
  status: text("status").notNull().default("open"),
  dueDate: timestamp("due_date"),
  serviceRequestId: varchar("service_request_id").references(() => serviceRequests.id),
  metadata: jsonb("metadata").notNull().default("{}"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const companyTaskUpdates = pgTable("company_task_updates", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  taskId: varchar("task_id")
    .notNull()
    .references(() => companyTasks.id),
  authorId: varchar("author_id")
    .notNull()
    .references(() => users.id),
  message: text("message").notNull(),
  attachments: jsonb("attachments").notNull().default("[]"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Wallets table
export const wallets = pgTable("wallets", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar("userId")
    .notNull()
    .references(() => users.id),
  balance: decimal("balance", { precision: 10, scale: 2 })
    .notNull()
    .default("0"),
  createdAt: timestamp("createdAt").defaultNow(),
  updatedAt: timestamp("updatedAt").defaultNow(),
});

// Transactions table
export const transactions = pgTable("transactions", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  reference: text("reference")
    .notNull()
    .unique(),
  gateway: text("gateway").notNull().default("paystack"),
  walletId: varchar("walletId")
    .notNull()
    .references(() => wallets.id),
  serviceRequestId: varchar("serviceRequestId").references(() => serviceRequests.id),
  currency: text("currency").notNull().default("NGN"),
  gatewayReference: text("gatewayReference").notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  type: transactionTypeEnum("type").notNull(),
  status: transactionStatusEnum("status").notNull().default("pending"),
  description: text("description"),
  meta: jsonb("meta").notNull().default("{}"),
  createdAt: timestamp("createdAt").defaultNow(),
  updatedAt: timestamp("updatedAt").defaultNow(),
});

//Inspection Analysis table
export const inspections = pgTable("inspections", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  requestId: varchar("request_id")
    .notNull()
    .references(() => serviceRequests.id),
  summary: text("summary").notNull(),
  findings: text("findings"),
  recommendedWork: text("recommended_work"),
  estimatedCost: decimal("estimated_cost", { precision: 10, scale: 2 }),
  createdByAdminId: varchar("created_by_admin_id"), // if your admins are in Mongo, keep string ref
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

//Billing Table
export const requestBills = pgTable("request_bills", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  requestId: varchar("request_id")
    .notNull()
    .references(() => serviceRequests.id),
  currency: varchar("currency", { length: 8 }).notNull().default("NGN"),
  subtotal: decimal("subtotal", { precision: 10, scale: 2 })
    .notNull()
    .default("0"),
  tax: decimal("tax", { precision: 10, scale: 2 }).notNull().default("0"),
  total: decimal("total", { precision: 10, scale: 2 }).notNull().default("0"),
  status: billStatusEnum("status").notNull().default("draft"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const requestBillItems = pgTable("request_bill_items", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  billId: varchar("bill_id")
    .notNull()
    .references(() => requestBills.id),
  label: text("label").notNull(),
  quantity: integer("quantity").notNull().default(1),
  unitPrice: decimal("unit_price", { precision: 10, scale: 2 })
    .notNull()
    .default("0"),
  lineTotal: decimal("line_total", { precision: 10, scale: 2 })
    .notNull()
    .default("0"),
});

// Messages Table
export const requestMessages = pgTable("request_messages", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  requestId: varchar("request_id")
    .notNull()
    .references(() => serviceRequests.id),
  senderId: varchar("sender_id").notNull(),
  senderRole: messageSenderEnum("sender_role").notNull(),
  message: text("message").notNull(),
  attachmentUrl: text("attachment_url"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const conversations = pgTable("conversations", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  residentId: varchar("resident_id")
    .notNull()
    .references(() => users.id),
  category: text("category").notNull(),
  status: conversationStatusEnum("status").notNull().default("active"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const conversationMessages = pgTable("conversation_messages", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  conversationId: varchar("conversation_id")
    .notNull()
    .references(() => conversations.id),
  role: conversationRoleEnum("role").notNull(),
  type: conversationMessageTypeEnum("type").notNull().default("text"),
  content: text("content").notNull(),
  meta: jsonb("meta"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const aiSessions = pgTable("ai_sessions", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  residentId: varchar("resident_id")
    .notNull()
    .references(() => users.id),
  categoryKey: text("category_key").notNull(),
  mode: requestConversationModeEnum("mode").notNull().default("ai"),
  status: aiSessionStatusEnum("status").notNull().default("active"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const aiSessionMessages = pgTable("ai_session_messages", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  sessionId: varchar("session_id")
    .notNull()
    .references(() => aiSessions.id, { onDelete: "cascade" }),
  role: aiSessionRoleEnum("role").notNull(),
  content: text("content").notNull(),
  meta: jsonb("meta"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const aiSessionAttachments = pgTable("ai_session_attachments", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  sessionId: varchar("session_id")
    .notNull()
    .references(() => aiSessions.id),
  messageId: varchar("message_id").references(() => aiSessionMessages.id, { onDelete: "cascade" }),
  type: text("type").notNull().default("image"),
  dataUrl: text("data_url").notNull(),
  mimeType: varchar("mime_type", { length: 100 }),
  byteSize: integer("byte_size").notNull(),
  sha256: varchar("sha256", { length: 128 }),
  createdAt: timestamp("created_at").defaultNow(),
});

export const requestConversationSettings = pgTable("request_conversation_settings", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  mode: requestConversationModeEnum("mode").notNull().default("ai"),
  aiProvider: requestAiProviderEnum("ai_provider").notNull().default("gemini"),
  aiModel: text("ai_model"),
  aiTemperature: doublePrecision("ai_temperature"),
  aiSystemPrompt: text("ai_system_prompt"),
  ordinaryPresentation: requestOrdinaryPresentationEnum("ordinary_presentation")
    .notNull()
    .default("chat"),
  adminWaitThresholdMs: integer("admin_wait_threshold_ms").default(300000), // 5 minutes default
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const requestQuestions = pgTable("request_questions", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  mode: requestQuestionModeEnum("mode").notNull(),
  scope: requestQuestionScopeEnum("scope").notNull().default("global"),
  categoryKey: text("category_key"),
  key: text("key").notNull(),
  label: text("label").notNull(),
  type: requestQuestionTypeEnum("type").notNull(),
  required: boolean("required").notNull().default(false),
  options: jsonb("options"),
  order: integer("order").notNull().default(0),
  isEnabled: boolean("is_enabled").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

//Telematics pointer Table
export const deviceAssignments = pgTable("device_assignments", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  providerId: varchar("provider_id")
    .notNull()
    .references(() => users.id),
  bodycamStreamUrl: text("bodycam_stream_url"), // e.g., HLS/WebRTC gateway URL
  gpsDeviceId: text("gps_device_id"),
  lastKnownLat: doublePrecision("last_known_lat"),
  lastKnownLng: doublePrecision("last_known_lng"),
  micEnabled: boolean("mic_enabled").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// --- Super Admin observability/config tables ---

export const aiPreparedRequests = pgTable("ai_prepared_requests", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  sessionId: text("session_id").notNull().unique(),
  residentHash: text("resident_hash").notNull(),
  estateId: varchar("estate_id").references(() => estates.id),
  category: serviceCategoryEnum("category").notNull(),
  urgency: urgencyEnum("urgency").notNull(),
  recommendedApproach: text("recommended_approach").notNull(),
  confidenceScore: integer("confidence_score").notNull().default(0),
  requiresConsultancy: boolean("requires_consultancy").notNull().default(false),
  readyToBook: boolean("ready_to_book").notNull().default(false),
  snapshot: jsonb("snapshot").notNull().default("{}"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const pricingRules = pgTable("pricing_rules", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  category: serviceCategoryEnum("category"),
  scope: text("scope"),
  urgency: urgencyEnum("urgency"),
  minPrice: decimal("min_price", { precision: 10, scale: 2 }).notNull().default(
    "0",
  ),
  maxPrice: decimal("max_price", { precision: 10, scale: 2 }).notNull().default(
    "0",
  ),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const providerMatchingSettings = pgTable("provider_matching_settings", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  providerId: varchar("provider_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" })
    .unique(),
  isEnabled: boolean("is_enabled").notNull().default(true),
  settings: jsonb("settings").notNull().default("{}"),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// AI Conversation Flow Settings - Controls which categories appear on resident category selection
// and customizes the conversation flow for each category
export const aiConversationFlowSettings = pgTable("ai_conversation_flow_settings", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  categoryKey: text("category_key").notNull().unique(), // e.g., "store_owner", "maintenance_repair"
  categoryName: text("category_name").notNull(), // Display name, e.g., "Store Owner"
  isEnabled: boolean("is_enabled").notNull().default(true), // Show/hide on resident category selection
  displayOrder: integer("display_order").notNull().default(0), // Order in the category list
  emoji: text("emoji"), // Category emoji
  description: text("description"), // Category description shown to residents
  // Conversation flow customization
  initialMessage: text("initial_message"), // Custom first message from CityBuddy
  followUpSteps: jsonb("follow_up_steps").notNull().default("[]"), // Array of step configs
  confidenceThreshold: integer("confidence_threshold").notNull().default(70),
  visualsHelpful: boolean("visuals_helpful").notNull().default(false),
  // Metadata
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertAiConversationFlowSettingsSchema = createInsertSchema(aiConversationFlowSettings);

export const insertRequestConversationSettingsSchema = createInsertSchema(requestConversationSettings);
export const insertRequestQuestionsSchema = createInsertSchema(requestQuestions);

// Relations
export const estatesRelations = relations(estates, ({ many }) => ({
  memberships: many(memberships),
  serviceRequests: many(serviceRequests),
  marketplaceItems: many(marketplaceItems),
  orders: many(orders),
  categories: many(categories),
  auditLogs: many(auditLogs),
  stores: many(stores),
  broadcastMessages: many(broadcastMessages),
}));

export const usersRelations = relations(users, ({ many, one }) => ({
  serviceRequestsAsResident: many(serviceRequests, {
    relationName: "residentRequests",
  }),
  serviceRequestsAsProvider: many(serviceRequests, {
    relationName: "providerRequests",
  }),
  memberships: many(memberships),
  marketplaceItems: many(marketplaceItems),
  ordersAsBuyer: many(orders, { relationName: "buyerOrders" }),
  ordersAsVendor: many(orders, { relationName: "vendorOrders" }),
  wallet: one(wallets),
  ownedStores: many(stores),
  storeMembers: many(storeMembers),
  broadcastMessagesSent: many(broadcastMessages),
  impersonationSessionsAsAdmin: many(impersonationSessions, { relationName: "superAdminSessions" }),
  impersonationSessionsAsTarget: many(impersonationSessions, { relationName: "targetUserSessions" }),
}));

export const membershipsRelations = relations(memberships, ({ one }) => ({
  user: one(users, {
    fields: [memberships.userId],
    references: [users.id],
  }),
  estate: one(estates, {
    fields: [memberships.estateId],
    references: [estates.id],
  }),
}));

export const categoriesRelations = relations(categories, ({ one }) => ({
  estate: one(estates, {
    fields: [categories.estateId],
    references: [estates.id],
  }),
}));

export const storesRelations = relations(stores, ({ one, many }) => ({
  estate: one(estates, {
    fields: [stores.estateId],
    references: [estates.id],
  }),
  owner: one(users, {
    fields: [stores.ownerId],
    references: [users.id],
  }),
  approver: one(users, {
    fields: [stores.approvedBy],
    references: [users.id],
  }),
  members: many(storeMembers),
  storeEstates: many(storeEstates),
  items: many(marketplaceItems),
  orders: many(orders),
}));

export const storeMembersRelations = relations(storeMembers, ({ one }) => ({
  store: one(stores, {
    fields: [storeMembers.storeId],
    references: [stores.id],
  }),
  user: one(users, {
    fields: [storeMembers.userId],
    references: [users.id],
  }),
}));

export const storeEstatesRelations = relations(storeEstates, ({ one }) => ({
  store: one(stores, {
    fields: [storeEstates.storeId],
    references: [stores.id],
  }),
  estate: one(estates, {
    fields: [storeEstates.estateId],
    references: [estates.id],
  }),
  allocator: one(users, {
    fields: [storeEstates.allocatedBy],
    references: [users.id],
  }),
}));

export const marketplaceItemsRelations = relations(marketplaceItems, ({ one }) => ({
  estate: one(estates, {
    fields: [marketplaceItems.estateId],
    references: [estates.id],
  }),
  store: one(stores, {
    fields: [marketplaceItems.storeId],
    references: [stores.id],
  }),
  vendor: one(users, {
    fields: [marketplaceItems.vendorId],
    references: [users.id],
  }),
}));

export const ordersRelations = relations(orders, ({ one }) => ({
  estate: one(estates, {
    fields: [orders.estateId],
    references: [estates.id],
  }),
  store: one(stores, {
    fields: [orders.storeId],
    references: [stores.id],
  }),
  buyer: one(users, {
    fields: [orders.buyerId],
    references: [users.id],
    relationName: "buyerOrders",
  }),
  vendor: one(users, {
    fields: [orders.vendorId],
    references: [users.id],
    relationName: "vendorOrders",
  }),
}));

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  estate: one(estates, {
    fields: [auditLogs.estateId],
    references: [estates.id],
  }),
}));

export const serviceRequestsRelations = relations(
  serviceRequests,
  ({ one }) => ({
    resident: one(users, {
      fields: [serviceRequests.residentId],
      references: [users.id],
      relationName: "residentRequests",
    }),
    provider: one(users, {
      fields: [serviceRequests.providerId],
      references: [users.id],
      relationName: "providerRequests",
    }),
    transactions: one(transactions),
  }),
);

export const walletsRelations = relations(wallets, ({ one, many }) => ({
  user: one(users, {
    fields: [wallets.userId],
    references: [users.id],
  }),
  transactions: many(transactions),
}));

export const transactionsRelations = relations(transactions, ({ one }) => ({
  wallet: one(wallets, {
    fields: [transactions.walletId],
    references: [wallets.id],
  }),
  serviceRequest: one(serviceRequests, {
    fields: [transactions.serviceRequestId],
    references: [serviceRequests.id],
  }),
}));

export const companyTasksRelations = relations(companyTasks, ({ one, many }) => ({
  company: one(companies, {
    fields: [companyTasks.companyId],
    references: [companies.id],
  }),
  assignee: one(users, {
    fields: [companyTasks.assigneeId],
    references: [users.id],
    relationName: "companyTaskAssignee",
  }),
  creator: one(users, {
    fields: [companyTasks.createdBy],
    references: [users.id],
    relationName: "companyTaskCreator",
  }),
  serviceRequest: one(serviceRequests, {
    fields: [companyTasks.serviceRequestId],
    references: [serviceRequests.id],
  }),
  updates: many(companyTaskUpdates),
}));

export const companyTaskUpdatesRelations = relations(companyTaskUpdates, ({ one }) => ({
  task: one(companyTasks, {
    fields: [companyTaskUpdates.taskId],
    references: [companyTasks.id],
  }),
  author: one(users, {
    fields: [companyTaskUpdates.authorId],
    references: [users.id],
  }),
}));

export const broadcastMessagesRelations = relations(broadcastMessages, ({ one }) => ({
  sender: one(users, {
    fields: [broadcastMessages.senderId],
    references: [users.id],
  }),
  estate: one(estates, {
    fields: [broadcastMessages.estateId],
    references: [estates.id],
  }),
}));

export const impersonationSessionsRelations = relations(impersonationSessions, ({ one }) => ({
  superAdmin: one(users, {
    fields: [impersonationSessions.superAdminId],
    references: [users.id],
    relationName: "superAdminSessions",
  }),
  targetUser: one(users, {
    fields: [impersonationSessions.targetUserId],
    references: [users.id],
    relationName: "targetUserSessions",
  }),
}));

// â”€â”€ Marketplace V2 relations â”€â”€
export const inventoryRelations = relations(inventory, ({ one }) => ({
  store: one(stores, { fields: [inventory.storeId], references: [stores.id] }),
  product: one(marketplaceItems, { fields: [inventory.productId], references: [marketplaceItems.id] }),
}));

export const cartsRelations = relations(carts, ({ one, many }) => ({
  resident: one(users, { fields: [carts.residentId], references: [users.id] }),
  items: many(cartItems),
}));

export const cartItemsRelations = relations(cartItems, ({ one }) => ({
  cart: one(carts, { fields: [cartItems.cartId], references: [carts.id] }),
  store: one(stores, { fields: [cartItems.storeId], references: [stores.id] }),
  product: one(marketplaceItems, { fields: [cartItems.productId], references: [marketplaceItems.id] }),
}));

export const parentOrdersRelations = relations(parentOrders, ({ one, many }) => ({
  resident: one(users, { fields: [parentOrders.residentId], references: [users.id] }),
  storeOrders: many(storeOrders),
  payments: many(marketplacePayments),
}));

export const storeOrdersRelations = relations(storeOrders, ({ one, many }) => ({
  parentOrder: one(parentOrders, { fields: [storeOrders.orderId], references: [parentOrders.id] }),
  store: one(stores, { fields: [storeOrders.storeId], references: [stores.id] }),
  items: many(storeOrderItems),
  refunds: many(refunds),
}));

export const storeOrderItemsRelations = relations(storeOrderItems, ({ one }) => ({
  storeOrder: one(storeOrders, { fields: [storeOrderItems.storeOrderId], references: [storeOrders.id] }),
  product: one(marketplaceItems, { fields: [storeOrderItems.productId], references: [marketplaceItems.id] }),
}));

export const marketplacePaymentsRelations = relations(marketplacePayments, ({ one }) => ({
  order: one(parentOrders, { fields: [marketplacePayments.orderId], references: [parentOrders.id] }),
}));

export const refundsRelations = relations(refunds, ({ one }) => ({
  storeOrder: one(storeOrders, { fields: [refunds.storeOrderId], references: [storeOrders.id] }),
}));

// Insert schemas
export const insertEstateSchema = createInsertSchema(estates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertMembershipSchema = createInsertSchema(memberships).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertNotificationSchema = createInsertSchema(notifications).omit({
  id: true,
  createdAt: true,
});

export const insertCategorySchema = createInsertSchema(categories).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertStoreSchema = createInsertSchema(stores).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertStoreMemberSchema = createInsertSchema(storeMembers).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertStoreEstateSchema = createInsertSchema(storeEstates).omit({
  id: true,
  createdAt: true,
});

export const insertMarketplaceItemSchema = createInsertSchema(marketplaceItems).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertOrderSchema = createInsertSchema(orders).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertAuditLogSchema = createInsertSchema(auditLogs).omit({
  id: true,
  createdAt: true,
});

export const insertServiceRequestSchema = createInsertSchema(
  serviceRequests,
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertServiceRequestCancellationCaseSchema = createInsertSchema(
  serviceRequestCancellationCases,
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  resolvedAt: true,
});

export const insertWalletSchema = createInsertSchema(wallets).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertTransactionSchema = createInsertSchema(transactions).omit({
  id: true,
  createdAt: true,
});

export const insertCompanyTaskSchema = createInsertSchema(companyTasks).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCompanyTaskUpdateSchema = createInsertSchema(companyTaskUpdates).omit({
  id: true,
  createdAt: true,
});

export const insertBroadcastMessageSchema = createInsertSchema(broadcastMessages).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertImpersonationSessionSchema = createInsertSchema(impersonationSessions).omit({
  id: true,
  startedAt: true,
});

// Types
export type Estate = typeof estates.$inferSelect;
export type InsertEstate = z.infer<typeof insertEstateSchema>;
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Membership = typeof memberships.$inferSelect;
export type InsertMembership = z.infer<typeof insertMembershipSchema>;
export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type Category = typeof categories.$inferSelect;
export type InsertCategory = z.infer<typeof insertCategorySchema>;
export type Store = typeof stores.$inferSelect;
export type InsertStore = z.infer<typeof insertStoreSchema>;
export type StoreMember = typeof storeMembers.$inferSelect;
export type InsertStoreMember = z.infer<typeof insertStoreMemberSchema>;
export type MarketplaceItem = typeof marketplaceItems.$inferSelect;
export type InsertMarketplaceItem = z.infer<typeof insertMarketplaceItemSchema>;
export type Order = typeof orders.$inferSelect;
export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type AuditLog = typeof auditLogs.$inferSelect;
export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;
export type ServiceRequest = typeof serviceRequests.$inferSelect;
export type InsertServiceRequest = z.infer<typeof insertServiceRequestSchema>;
export type ServiceRequestCancellationCase = typeof serviceRequestCancellationCases.$inferSelect;
export type InsertServiceRequestCancellationCase = z.infer<
  typeof insertServiceRequestCancellationCaseSchema
>;
export type Wallet = typeof wallets.$inferSelect;
export type InsertWallet = z.infer<typeof insertWalletSchema>;
export type Transaction = typeof transactions.$inferSelect;
export type InsertTransaction = z.infer<typeof insertTransactionSchema>;
export type CompanyTask = typeof companyTasks.$inferSelect;
export type InsertCompanyTask = z.infer<typeof insertCompanyTaskSchema>;
export type CompanyTaskUpdate = typeof companyTaskUpdates.$inferSelect;
export type InsertCompanyTaskUpdate = z.infer<typeof insertCompanyTaskUpdateSchema>;
export type RequestMessage = typeof requestMessages.$inferSelect;
export type InsertRequestMessage = typeof requestMessages.$inferInsert;
export type RequestBill = typeof requestBills.$inferSelect;
export type InsertRequestBill = typeof requestBills.$inferInsert;
export type RequestBillItem = typeof requestBillItems.$inferSelect;
export type InsertRequestBillItem = typeof requestBillItems.$inferInsert;
export type Inspection = typeof inspections.$inferSelect;
export type InsertInspection = typeof inspections.$inferInsert;
export type DeviceAssignment = typeof deviceAssignments.$inferSelect;
export type BroadcastMessage = typeof broadcastMessages.$inferSelect;
export type InsertBroadcastMessage = z.infer<typeof insertBroadcastMessageSchema>;
export type ImpersonationSession = typeof impersonationSessions.$inferSelect;
export type InsertImpersonationSession = z.infer<typeof insertImpersonationSessionSchema>;

// â”€â”€ Marketplace V2 types â”€â”€
export type Cart = typeof carts.$inferSelect;
export type CartItem = typeof cartItems.$inferSelect;
export type Inventory = typeof inventory.$inferSelect;
export type ParentOrder = typeof parentOrders.$inferSelect;
export type StoreOrder = typeof storeOrders.$inferSelect;
export type StoreOrderItem = typeof storeOrderItems.$inferSelect;
export type MarketplacePayment = typeof marketplacePayments.$inferSelect;
export type Refund = typeof refunds.$inferSelect;
export type CityMartBanner = typeof cityMartBanners.$inferSelect;
export type InsertCityMartBanner = typeof cityMartBanners.$inferInsert;

// Extended user types for login
export const residentLoginSchema = z
  .object({
    email: z.string().email().optional(),
    password: z.string().optional(),
    accessCode: z.string().length(6).optional(),
  })
  .refine(
    (data) => (data.email && data.password) || data.accessCode,
    "Either email/password or access code is required",
  );

export const providerLoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

// Sessions
export const session = pgTable("session", {
  sid: varchar("sid", { length: 255 }).primaryKey(),
  sess: jsonb("sess").notNull(),
  expire: timestamp("expire", { mode: "date" }).notNull(),
});

// Refresh Tokens for JWT authentication
export const refreshTokens = pgTable("refresh_tokens", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  tokenId: varchar("token_id", { length: 255 }).notNull().unique(), // Unique identifier for the token
  expiresAt: timestamp("expires_at").notNull(),
  isRevoked: boolean("is_revoked").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow(),
  revokedAt: timestamp("revoked_at"),
});

export type ResidentLoginData = z.infer<typeof residentLoginSchema>;
export type ProviderLoginData = z.infer<typeof providerLoginSchema>;
