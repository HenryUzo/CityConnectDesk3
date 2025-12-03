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
  "assigned",
  "in_progress",
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

// Estates table (from MongoDB)
export const estates = pgTable("estates", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description"),
  address: text("address").notNull(),
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
  isActive: boolean("is_active").notNull().default(true),
  permissions: text("permissions").array(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
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
  // Optional emoji for category display (e.g., 🔌)
  emoji: text("emoji"),
  description: text("description"),
  icon: text("icon"),
  tag: text("tag").notNull().default("Facility Management 🏗️"),
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
  details: jsonb("details").notNull().default("{}"),
  isActive: boolean("is_active").notNull().default(true),
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
  closedAt: timestamp("closed_at"),
  closeReason: text("close_reason"),
  billedAmount: decimal("billed_amount", { precision: 10, scale: 2 }).default(
    "0",
  ),
  paymentStatus: text("payment_status").default("pending"),
});

// Wallets table
export const wallets = pgTable("wallets", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar("user_id")
    .notNull()
    .references(() => users.id),
  balance: decimal("balance", { precision: 10, scale: 2 })
    .notNull()
    .default("0"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
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
  walletId: varchar("wallet_id")
    .notNull()
    .references(() => wallets.id),
  serviceRequestId: varchar("service_request_id").references(
    () => serviceRequests.id,
  ),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  type: transactionTypeEnum("type").notNull(),
  status: transactionStatusEnum("status").notNull().default("pending"),
  description: text("description"),
  meta: jsonb("meta").notNull().default("{}"),
  createdAt: timestamp("created_at").defaultNow(),
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

// Relations
export const estatesRelations = relations(estates, ({ many }) => ({
  memberships: many(memberships),
  serviceRequests: many(serviceRequests),
  marketplaceItems: many(marketplaceItems),
  orders: many(orders),
  categories: many(categories),
  auditLogs: many(auditLogs),
  stores: many(stores),
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

export const insertWalletSchema = createInsertSchema(wallets).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertTransactionSchema = createInsertSchema(transactions).omit({
  id: true,
  createdAt: true,
});

// Types
export type Estate = typeof estates.$inferSelect;
export type InsertEstate = z.infer<typeof insertEstateSchema>;
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Membership = typeof memberships.$inferSelect;
export type InsertMembership = z.infer<typeof insertMembershipSchema>;
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
export type Wallet = typeof wallets.$inferSelect;
export type InsertWallet = z.infer<typeof insertWalletSchema>;
export type Transaction = typeof transactions.$inferSelect;
export type InsertTransaction = z.infer<typeof insertTransactionSchema>;
export type RequestMessage = typeof requestMessages.$inferSelect;
export type InsertRequestMessage = typeof requestMessages.$inferInsert;
export type RequestBill = typeof requestBills.$inferSelect;
export type InsertRequestBill = typeof requestBills.$inferInsert;
export type RequestBillItem = typeof requestBillItems.$inferSelect;
export type InsertRequestBillItem = typeof requestBillItems.$inferInsert;
export type Inspection = typeof inspections.$inferSelect;
export type InsertInspection = typeof inspections.$inferInsert;
export type DeviceAssignment = typeof deviceAssignments.$inferSelect;

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

export type ResidentLoginData = z.infer<typeof residentLoginSchema>;
export type ProviderLoginData = z.infer<typeof providerLoginSchema>;
