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

// Users table
export const users = pgTable("users", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  phone: text("phone").notNull(),
  password: text("password").notNull(),
  accessCode: text("access_code"), // 6-digit code for residents
  role: userRoleEnum("role").notNull().default("resident"),
  rating: decimal("rating", { precision: 3, scale: 2 }).default("0"),
  isActive: boolean("is_active").notNull().default(true),
  isApproved: boolean("is_approved").notNull().default(true), // for providers
  categories: varchar("categories", { length: 100 }).array(), // for providers
  serviceCategory: serviceCategoryEnum("service_category"), // for providers
  experience: integer("experience"), // years of experience for providers
  location: text("location"), // building/block info for residents
  latitude: doublePrecision("latitude"), // optional latitude for location
  longitude: doublePrecision("longitude"), // optional longitude for location
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Service Requests table
export const serviceRequests = pgTable("service_requests", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
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
  // ADD these fields inside serviceRequests table definition
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
export const usersRelations = relations(users, ({ many, one }) => ({
  serviceRequestsAsResident: many(serviceRequests, {
    relationName: "residentRequests",
  }),
  serviceRequestsAsProvider: many(serviceRequests, {
    relationName: "providerRequests",
  }),
  wallet: one(wallets),
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
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
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
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type ServiceRequest = typeof serviceRequests.$inferSelect;
export type InsertServiceRequest = z.infer<typeof insertServiceRequestSchema>;
export type Wallet = typeof wallets.$inferSelect;
export type InsertWallet = z.infer<typeof insertWalletSchema>;
export type Transaction = typeof transactions.$inferSelect;
export type InsertTransaction = z.infer<typeof insertTransactionSchema>;

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
