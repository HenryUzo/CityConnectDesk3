import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, integer, decimal, boolean, pgEnum } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Enums
export const userRoleEnum = pgEnum("user_role", ["resident", "provider", "admin"]);
export const serviceStatusEnum = pgEnum("service_status", ["pending", "assigned", "in_progress", "completed", "cancelled"]);
export const urgencyEnum = pgEnum("urgency", ["low", "medium", "high", "emergency"]);
export const serviceCategoryEnum = pgEnum("service_category", ["electrician", "plumber", "carpenter", "market_runner"]);
export const transactionTypeEnum = pgEnum("transaction_type", ["debit", "credit"]);
export const transactionStatusEnum = pgEnum("transaction_status", ["pending", "completed", "failed"]);

// Users table
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  phone: text("phone").notNull(),
  password: text("password").notNull(),
  accessCode: text("access_code"), // 6-digit code for residents
  role: userRoleEnum("role").notNull().default("resident"),
  rating: decimal("rating", { precision: 3, scale: 2 }).default("0"),
  isActive: boolean("is_active").notNull().default(true),
  isApproved: boolean("is_approved").notNull().default(true), // for providers
  serviceCategory: serviceCategoryEnum("service_category"), // for providers
  experience: integer("experience"), // years of experience for providers
  location: text("location"), // building/block info for residents
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Service Requests table
export const serviceRequests = pgTable("service_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  category: serviceCategoryEnum("category").notNull(),
  description: text("description").notNull(),
  residentId: varchar("resident_id").notNull().references(() => users.id),
  providerId: varchar("provider_id").references(() => users.id),
  status: serviceStatusEnum("status").notNull().default("pending"),
  budget: text("budget").notNull(), // budget range as string
  urgency: urgencyEnum("urgency").notNull(),
  location: text("location").notNull(),
  preferredTime: timestamp("preferred_time"),
  specialInstructions: text("special_instructions"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Wallets table
export const wallets = pgTable("wallets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  balance: decimal("balance", { precision: 10, scale: 2 }).notNull().default("0"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Transactions table
export const transactions = pgTable("transactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  walletId: varchar("wallet_id").notNull().references(() => wallets.id),
  serviceRequestId: varchar("service_request_id").references(() => serviceRequests.id),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  type: transactionTypeEnum("type").notNull(),
  status: transactionStatusEnum("status").notNull().default("pending"),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Relations
export const usersRelations = relations(users, ({ many, one }) => ({
  serviceRequestsAsResident: many(serviceRequests, { relationName: "residentRequests" }),
  serviceRequestsAsProvider: many(serviceRequests, { relationName: "providerRequests" }),
  wallet: one(wallets),
}));

export const serviceRequestsRelations = relations(serviceRequests, ({ one }) => ({
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
}));

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

export const insertServiceRequestSchema = createInsertSchema(serviceRequests).omit({
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
export const residentLoginSchema = z.object({
  email: z.string().email().optional(),
  password: z.string().optional(),
  accessCode: z.string().length(6).optional(),
}).refine(
  (data) => (data.email && data.password) || data.accessCode,
  "Either email/password or access code is required"
);

export const providerLoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export type ResidentLoginData = z.infer<typeof residentLoginSchema>;
export type ProviderLoginData = z.infer<typeof providerLoginSchema>;
