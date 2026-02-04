import {
  users,
  serviceRequests,
  companies,
  providerRequests,
  mongoIdMappings,
  requestMessages,
  requestBills,
  requestBillItems,
  inspections,
  deviceAssignments,
  auditLogs,
  orders,
  wallets,
  memberships,
  transactions,
  estates,
  notifications,
  type User,
  type InsertUser,
  type ServiceRequest,
  type InsertServiceRequest,
  type Company,
  type InsertCompany,
  type Notification,
  type InsertNotification,
  type ProviderRequest,
  type InsertProviderRequest,
  type RequestMessage,
  type InsertRequestMessage,
  type RequestBill,
  type RequestBillItem,
  type InsertRequestBill,
  type InsertRequestBillItem,
  type Inspection,
  type InsertInspection,
  type DeviceAssignment,
  type Order,
  type AuditLog,
  type InsertAuditLog,
  type Wallet,
  type Membership,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, count, sql, asc, or, inArray, sum, isNull } from "drizzle-orm";
import session from "express-session";
import connectPg from "connect-pg-simple";
const PostgresSessionStore = connectPg(session);
import { pool } from "./db";
import { prisma } from "./lib/prisma";
import { Prisma } from "@prisma/client";
import type {
  Transaction as PrismaTransaction,
  TransactionStatus,
  TransactionType,
  Wallet as PrismaWallet,
  User as PrismaUser,
} from "@prisma/client";
import { randomUUID } from "crypto";

const SHARED_USER_ROLES = [
  "resident",
  "provider",
  "admin",
  "super_admin",
  "estate_admin",
  "moderator",
] as const;

type SharedUserRole = (typeof SHARED_USER_ROLES)[number];
const DEFAULT_USER_ROLE: SharedUserRole = "resident";

function normalizeSharedRole(role?: string | null): SharedUserRole {
  if (!role) return DEFAULT_USER_ROLE;
  const lower = role.toLowerCase();
  if (SHARED_USER_ROLES.includes(lower as SharedUserRole)) {
    return lower as SharedUserRole;
  }
  return DEFAULT_USER_ROLE;
}

function mapPrismaUser(user: PrismaUser & { providerCompany?: { name?: string | null } | null }): User {
  const sharedRole = normalizeSharedRole(user.globalRole);
  return {
    id: user.id,
    firstName: (user as any).firstName ?? null,
    lastName: (user as any).lastName ?? null,
    name: (user.name || [ (user as any).firstName, (user as any).lastName ].filter(Boolean).join(" ")) || user.email,
    email: user.email,
    phone: user.phone ?? "",
    password: user.passwordHash,
    accessCode: null,
    role: sharedRole,
    globalRole: sharedRole,
    rating: "0",
    isActive: user.isActive,
    isApproved: user.isApproved,
    categories: [],
    serviceCategory: null,
    experience: null,
    company: user.providerCompany?.name ?? null,
    documents: [],
    location: null,
    latitude: null,
    longitude: null,
    lastLoginAt: null,
    metadata: null,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

const includeProviderCompany = { providerCompany: true };

type OrderUserSummary = Pick<User, "id" | "name" | "email" | "phone">;

export interface OrdersPagination {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface OrdersQueryParams {
  search?: string;
  status?: string;
  hasDispute?: boolean;
  startDate?: string;
  endDate?: string;
  minTotal?: number;
  maxTotal?: number;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

export interface OrderStats {
  totalOrders: number;
  totalRevenue: number;
  disputedOrders: number;
  avgOrderValue: number;
}

// AdminOrder extends Order but overrides 'total' type from string to number
// because Drizzle's decimal type returns string, but we convert it to number
// for calculation and display purposes in the admin interface
export interface AdminOrder extends Omit<Order, 'total'> {
  _id: string;
  buyer: OrderUserSummary | null;
  vendor: OrderUserSummary | null;
  total: number;
}

export interface OrdersListResult {
  orders: AdminOrder[];
  pagination: OrdersPagination;
}

type WalletCreationInput = {
  userId: string;
  balance?: string;
  id?: string;
  createdAt?: Date;
  updatedAt?: Date;
  currency?: string;
};

type CreateTransactionInput = {
  walletId: string;
  serviceRequestId?: string | null;
  userId?: string;
  amount: string;
  type: TransactionType;
  status: TransactionStatus;
  description?: string | null;
  reference: string;
  meta?: Prisma.InputJsonValue | null;
  currency?: string;
  gateway?: string;
  id?: string;
  createdAt?: Date;
  updatedAt?: Date;
  gatewayReference?: string;
};

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByAccessCode(accessCode: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, updates: Partial<User>): Promise<User | undefined>;
  getMembershipsForUser(userId: string): Promise<Membership[]>;
  getMembershipByUserAndEstate(userId: string, estateId: string): Promise<Membership | undefined>;
  // Service Requests
  createServiceRequest(request: InsertServiceRequest): Promise<ServiceRequest>;
  getServiceRequest(id: string): Promise<ServiceRequest | undefined>;
  getServiceRequestsByResident(
    residentId: string,
    options?: { estateId?: string },
  ): Promise<ServiceRequest[]>;
  getServiceRequestsByProvider(providerId: string): Promise<ServiceRequest[]>;
  getAvailableServiceRequests(category?: string): Promise<ServiceRequest[]>;
  getAllServiceRequests(): Promise<ServiceRequest[]>;
  updateServiceRequest(id: string, updates: Partial<ServiceRequest>): Promise<ServiceRequest | undefined>;
  assignServiceRequest(id: string, providerId: string): Promise<ServiceRequest | undefined>;
  
  // Wallets
  getWalletByUserId(userId: string): Promise<PrismaWallet | undefined>;
  createWallet(wallet: WalletCreationInput): Promise<PrismaWallet>;
  updateWalletBalance(userId: string, amount: string): Promise<PrismaWallet | undefined>;

  // Transactions
  createTransaction(transaction: CreateTransactionInput): Promise<PrismaTransaction>;
  getTransactionsByWallet(walletId: string): Promise<PrismaTransaction[]>;
  getTransactionByReference(reference: string): Promise<PrismaTransaction | undefined>;
  updateTransactionByReference(
    reference: string,
    updates: Prisma.TransactionUpdateInput,
  ): Promise<PrismaTransaction | undefined>;
  
  // Admin functions
  getUsers(role?: string): Promise<User[]>;
  getPendingProviders(): Promise<User[]>;
  approveProvider(providerId: string): Promise<User | undefined>;
  getUserStats(): Promise<any>;
  getCompanies(): Promise<Company[]>;
  createCompany(company: InsertCompany): Promise<Company>;
  updateCompany(id: string, company: Partial<InsertCompany>): Promise<Company | undefined>;
  deleteCompany(id: string): Promise<boolean>;
  createProviderRequest(request: InsertProviderRequest): Promise<ProviderRequest>;
  getProviderRequests(): Promise<ProviderRequest[]>;
  deleteUser(userId: string): Promise<boolean>;
  deleteProviderRequestByProviderId(providerId: string): Promise<void>;
  getProviderRequestById(requestId: string): Promise<ProviderRequest | null>;
  deleteProviderRequest(requestId: string): Promise<void>;
  createNotification(input: InsertNotification): Promise<Notification>;
  listNotificationsForUser(
    userId: string,
    options?: { limit?: number; offset?: number },
  ): Promise<Notification[]>;
  markNotificationRead(userId: string, notificationId: string): Promise<Notification | undefined>;
  markAllNotificationsRead(userId: string): Promise<{ updated: number }>;
  getPostgresIdFromMongoId(entityType: string, mongoId: string): Promise<string | null>;
  createAuditLog(entry: InsertAuditLog): Promise<AuditLog>;
  getOrders(params?: OrdersQueryParams): Promise<OrdersListResult>;
  getOrderStats(): Promise<OrderStats>;
  updateOrderStatus(orderId: string, status: string): Promise<Order | undefined>;
  createOrderDispute(
    orderId: string,
    payload: { reason: string; description?: string },
  ): Promise<Order | undefined>;
  updateOrderDispute(
    orderId: string,
    payload: {
      status: string;
      resolution: string;
      refundAmount?: number;
    },
  ): Promise<Order | undefined>;

  sessionStore: session.Store;
}

export class DatabaseStorage implements IStorage {
  sessionStore: session.Store;

  constructor() {
    this.sessionStore = new PostgresSessionStore({ 
      pool, 
      createTableIfMissing: true 
    });
  }

  private async ensureCompanyId(value: unknown): Promise<string | undefined> {
    if (value === undefined) return undefined;
    const normalized = String(value ?? "").trim();
    if (!normalized) return "";
    const [company] = await db
      .select({ id: companies.id })
      .from(companies)
      .where(eq(companies.id, normalized))
      .limit(1);
    if (!company) {
      const error = new Error("company must be a valid company id");
      (error as any).status = 400;
      throw error;
    }
    return normalized;
  }

  private async mapUser(user: PrismaUser | null): Promise<User | undefined> {
    if (!user) return undefined;
    const mapped = mapPrismaUser(user);
    return mapped;
  }

  async getUser(id: string): Promise<User | undefined> {
    // Fetch from Drizzle (source of truth), not Prisma
    // This ensures we always get the correct role data
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1);
    return user as User | undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const normalized = (username || "").trim();
    // Fetch from Drizzle (source of truth), not Prisma
    // Try email first
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, normalized))
      .limit(1);
    if (user) return user as User;
    
    // If not found by email, try by name
    const byName = await db
      .select()
      .from(users)
      .where(eq(users.name, normalized))
      .limit(1);
    return byName[0] as User | undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    // Fetch from Drizzle (source of truth), not Prisma
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);
    return user as User | undefined;
  }

  async getUserByAccessCode(accessCode: string): Promise<User | undefined> {
    const normalized = (accessCode || "").trim();
    if (!normalized) return undefined;
    const [row] = await db
      .select()
      .from(users)
      .where(eq(users.accessCode, normalized))
      .limit(1);
    return row as any;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    if (insertUser.company !== undefined) {
      insertUser.company = await this.ensureCompanyId(insertUser.company);
    }
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    
    // Mirror the user in Prisma so wallet FK works
    // Map Drizzle role (e.g., "super_admin") to Prisma enum (e.g., "SUPER_ADMIN")
    const mapRoleToPrisma = (role: any) => {
      if (!role) return "RESIDENT";
      const lower = String(role).toLowerCase();
      const map: Record<string, any> = {
        "resident": "RESIDENT",
        "provider": "PROVIDER",
        "admin": "ADMIN",
        "super_admin": "SUPER_ADMIN",
        "estate_admin": "ESTATE_ADMIN",
        "moderator": "MODERATOR",
        "support": "SUPPORT",
      };
      return map[lower] || "RESIDENT";
    };
    
    try {
      await prisma.user.upsert({
        where: { id: user.id },
        update: {
          email: user.email,
          name: user.name,
          passwordHash: user.password,
          globalRole: mapRoleToPrisma(user.globalRole),
          isApproved: user.isApproved,
          isActive: user.isActive,
        },
        create: {
          id: user.id,
          email: user.email,
          name: user.name,
          passwordHash: user.password,
          globalRole: mapRoleToPrisma(user.globalRole),
          isApproved: user.isApproved,
          isActive: user.isActive,
        },
      });
    } catch (error) {
      console.warn("Failed to mirror user in Prisma:", (error as Error).message);
    }

    // Create wallet for new user
    if (user.role === "resident") {
      await this.createWallet({ userId: user.id, balance: "25000" });
    }
    
    return user;
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User | undefined> {
    if (updates.company !== undefined) {
      updates.company = await this.ensureCompanyId(updates.company);
    }
    const [user] = await db
      .update(users)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    
    // Keep Prisma in sync with Drizzle
    if (user) {
      try {
        // Map Drizzle role (e.g., "super_admin") to Prisma enum (e.g., "SUPER_ADMIN")
        const mapRoleToPrisma = (role: any) => {
          if (!role) return "RESIDENT";
          const lower = String(role).toLowerCase();
          const map: Record<string, any> = {
            "resident": "RESIDENT",
            "provider": "PROVIDER",
            "admin": "ADMIN",
            "super_admin": "SUPER_ADMIN",
            "estate_admin": "ESTATE_ADMIN",
            "moderator": "MODERATOR",
            "support": "SUPPORT",
          };
          return map[lower] || "RESIDENT";
        };
        
        await prisma.user.update({
          where: { id: user.id },
          data: {
            email: user.email,
            name: user.name,
            passwordHash: user.password,
            globalRole: mapRoleToPrisma(user.globalRole),
            isApproved: user.isApproved,
            isActive: user.isActive,
          },
        });
      } catch (error) {
        console.warn("Failed to sync user update to Prisma:", (error as Error).message);
      }
    }
    
    return user || undefined;
  }

  async getMembershipsForUser(userId: string): Promise<Membership[]> {
    const rows = await db
      .select()
      .from(memberships)
      .where(eq(memberships.userId, userId))
      .orderBy(asc(memberships.createdAt));
    return rows;
  }

  async getMembershipByUserAndEstate(userId: string, estateId: string): Promise<Membership | undefined> {
    const [row] = await db
      .select()
      .from(memberships)
      .where(and(eq(memberships.userId, userId), eq(memberships.estateId, estateId)))
      .limit(1);
    return row || undefined;
  }

  
  
  // Service Requests
  async createServiceRequest(request: InsertServiceRequest): Promise<ServiceRequest> {
    const [serviceRequest] = await db
      .insert(serviceRequests)
      .values(request)
      .returning();
    return serviceRequest;
  }

  async getServiceRequest(id: string): Promise<ServiceRequest | undefined> {
    const [request] = await db.select().from(serviceRequests).where(eq(serviceRequests.id, id));
    return request || undefined;
  }

  async getServiceRequestsByResident(
    residentId: string,
    options?: { estateId?: string },
  ): Promise<ServiceRequest[]> {
    const whereParts = [eq(serviceRequests.residentId, residentId)];
    if (options?.estateId) {
      whereParts.push(eq(serviceRequests.estateId, options.estateId));
    }
    const where = whereParts.length > 1 ? and(...whereParts) : whereParts[0];
    const requests = await db
      .select({
        id: serviceRequests.id,
        category: serviceRequests.category,
        description: serviceRequests.description,
        status: serviceRequests.status,
        urgency: serviceRequests.urgency,
        budget: serviceRequests.budget,
        paymentStatus: serviceRequests.paymentStatus,
        createdAt: serviceRequests.createdAt,
        estateId: serviceRequests.estateId,
      })
      .from(serviceRequests)
      .where(where)
      .orderBy(desc(serviceRequests.createdAt));
    return requests;
  }

  // --- LIST artisan requests (optional filters) ---
  async getArtisanRequests(params?: { status?: string; category?: string; q?: string }) {
    const whereParts: any[] = [];
    if (params?.status) whereParts.push(eq(serviceRequests.status, params.status as any));
    if (params?.category) whereParts.push(eq(serviceRequests.category, params.category as any));
    if (params?.q) whereParts.push(sql`${serviceRequests.description} ILIKE ${'%' + params.q + '%'}`);
    const where = whereParts.length ? and(...whereParts) : undefined;

    const rows = await db
      .select()
      .from(serviceRequests)
      .where(where as any)
      .orderBy(desc(serviceRequests.createdAt));
    return rows;
  }

  // --- GET one request (with inspection, bill, items, messages) ---
  async getServiceRequestFull(id: string) {
    const [reqRow] = await db.select().from(serviceRequests).where(eq(serviceRequests.id, id));
    if (!reqRow) return undefined;

    const msgs = await db
      .select()
      .from(requestMessages)
      .where(eq(requestMessages.requestId, id))
      .orderBy(desc(requestMessages.createdAt));

    const [bill] = await db.select().from(requestBills).where(eq(requestBills.requestId, id));
    const items = bill
      ? await db.select().from(requestBillItems).where(eq(requestBillItems.billId, bill.id))
      : [];

    const [insp] = await db.select().from(inspections).where(eq(inspections.requestId, id));
    return { request: reqRow, messages: msgs, bill, billItems: items, inspection: insp };
  }

  // --- ASSIGN provider to request ---
  async assignProviderToRequest(requestId: string, providerId: string) {
    const [updated] = await db
      .update(serviceRequests)
      .set({ providerId, status: "assigned", assignedAt: new Date(), updatedAt: new Date() })
      .where(eq(serviceRequests.id, requestId))
      .returning();
    return updated || undefined;
  }

  // --- UPDATE request status ---
  async updateRequestStatus(
    requestId: string,
    status: "pending" | "pending_inspection" | "assigned" | "in_progress" | "completed" | "cancelled",
    closeReason?: string
  ) {
    const patch: any = { status, updatedAt: new Date() };
    if (status === "completed" || status === "cancelled") {
      patch.closedAt = new Date();
      patch.closeReason = closeReason ?? null;
    }
    const [row] = await db.update(serviceRequests).set(patch).where(eq(serviceRequests.id, requestId)).returning();
    return row || undefined;
  }

  // --- CREATE inspection ---
  async createInspection(requestId: string, data: {
    summary: string; findings?: string; recommendedWork?: string; estimatedCost?: string; createdByAdminId?: string;
  }) {
    const [row] = await db.insert(inspections).values({
      requestId,
      summary: data.summary,
      findings: data.findings,
      recommendedWork: data.recommendedWork,
      estimatedCost: data.estimatedCost as any,
      createdByAdminId: data.createdByAdminId,
      createdAt: new Date(),
      updatedAt: new Date()
    }).returning();

    await db.update(serviceRequests)
      .set({ adminNotes: sql`${serviceRequests.adminNotes} || '\nInspection: ' || ${data.summary}` })
      .where(eq(serviceRequests.id, requestId));

    return row;
  }

  // --- CREATE/UPDATE bill (header + items) ---
  async createOrUpdateBill(requestId: string, payload: {
    currency: string;
    items: { label: string; quantity: number; unitPrice: string }[];
    taxRate?: number;
    status?: "draft" | "issued" | "paid" | "cancelled";
  }) {
    const subtotalNum = payload.items.reduce((s, it) => s + Number(it.unitPrice) * it.quantity, 0);
    const taxNum = Number(((payload.taxRate ?? 0) * subtotalNum).toFixed(2));
    const totalNum = subtotalNum + taxNum;

    const existing = await db.select().from(requestBills).where(eq(requestBills.requestId, requestId));
    let billId: string;

    if (existing.length) {
      const [b] = await db.update(requestBills).set({
        currency: payload.currency,
        subtotal: String(subtotalNum),
        tax: String(taxNum),
        total: String(totalNum),
        status: (payload.status ?? "draft") as any,
        updatedAt: new Date(),
      }).where(eq(requestBills.id, existing[0].id)).returning();
      billId = b.id;
      await db.delete(requestBillItems).where(eq(requestBillItems.billId, billId));
    } else {
      const [b] = await db.insert(requestBills).values({
        requestId,
        currency: payload.currency,
        subtotal: String(subtotalNum),
        tax: String(taxNum),
        total: String(totalNum),
        status: (payload.status ?? "draft") as any,
      }).returning();
      billId = b.id;
    }

    for (const it of payload.items) {
      await db.insert(requestBillItems).values({
        billId,
        label: it.label,
        quantity: it.quantity,
        unitPrice: it.unitPrice,
        lineTotal: String(Number(it.unitPrice) * it.quantity),
      });
    }

    await db.update(serviceRequests)
      .set({ billedAmount: String(totalNum), updatedAt: new Date() })
      .where(eq(serviceRequests.id, requestId));

    const [bill] = await db.select().from(requestBills).where(eq(requestBills.id, billId));
    const items = await db.select().from(requestBillItems).where(eq(requestBillItems.billId, billId));
    return { bill, items };
  }

  // --- MESSAGING (admin ↔ provider ↔ resident) ---
  async addRequestMessage(
    requestId: string,
    senderId: string,
    senderRole: "admin" | "resident" | "provider",
    message: string,
    attachmentUrl?: string
  ) {
    const [row] = await db.insert(requestMessages).values({
      requestId, senderId, senderRole: senderRole as any, message, attachmentUrl
    }).returning();
    return row;
  }
  async getRequestMessages(requestId: string) {
    return await db
      .select()
      .from(requestMessages)
      .where(eq(requestMessages.requestId, requestId))
      .orderBy(desc(requestMessages.createdAt));
  }

  // --- TELEMATICS pointers (bodycam/GPS/mic) ---
  async getProviderTelematics(providerId: string) {
    const [assign] = await db.select().from(deviceAssignments).where(eq(deviceAssignments.providerId, providerId));
    return assign || null;
  }


  async getServiceRequestsByProvider(providerId: string): Promise<ServiceRequest[]> {
    const requests = await db
      .select()
      .from(serviceRequests)
      .where(eq(serviceRequests.providerId, providerId))
      .orderBy(desc(serviceRequests.createdAt));
    return requests;
  }

  async getProviders(filters?: { search?: string; approved?: boolean; category?: string }) {
    const conditions: any[] = [eq(users.role, "provider")];

    if (filters?.approved !== undefined) {
      conditions.push(eq(users.isApproved, filters.approved));
    }

    if (filters?.search) {
      conditions.push(sql`${users.name} ILIKE ${'%' + filters.search + '%'}`);
    }

    if (filters?.category) {
      // we'll come back to this field (see #2 below)
      conditions.push(sql`${users.categories} @> ARRAY[${filters.category}]::varchar[]`);
    }

    return await db
      .select()
      .from(users)
      .where(and(...conditions))
      .orderBy(desc(users.createdAt));
  }




  async getAvailableServiceRequests(category?: string): Promise<ServiceRequest[]> {
    // Only show pending requests that haven't been assigned to any provider yet
    // (i.e., providerId is NULL)
    if (category) {
      const requests = await db
        .select()
        .from(serviceRequests)
        .where(
          and(
            eq(serviceRequests.status, "pending"),
            eq(serviceRequests.category, category as any),
            isNull(serviceRequests.providerId)
          )
        )
        .orderBy(desc(serviceRequests.createdAt));
      return requests;
    }
    
    const requests = await db
      .select()
      .from(serviceRequests)
      .where(
        and(
          eq(serviceRequests.status, "pending"),
          isNull(serviceRequests.providerId)
        )
      )
      .orderBy(desc(serviceRequests.createdAt));
    return requests;
  }

  async getAllServiceRequests(): Promise<ServiceRequest[]> {
    const requests = await db
      .select()
      .from(serviceRequests)
      .orderBy(desc(serviceRequests.createdAt));
    return requests;
  }

  async updateServiceRequest(id: string, updates: Partial<ServiceRequest>): Promise<ServiceRequest | undefined> {
    const [request] = await db
      .update(serviceRequests)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(serviceRequests.id, id))
      .returning();
    return request || undefined;
  }

  async assignServiceRequest(id: string, providerId: string): Promise<ServiceRequest | undefined> {
    const [request] = await db
      .update(serviceRequests)
      .set({ 
        providerId, 
        status: "assigned", 
        updatedAt: new Date() 
      })
      .where(eq(serviceRequests.id, id))
      .returning();
    return request || undefined;
  }

  // Wallets
  async getWalletByUserId(userId: string): Promise<PrismaWallet | undefined> {
    const [res] = await db.select().from(wallets).where(eq(wallets.userId, userId));
    return (res as any as PrismaWallet) ?? undefined;
  }

  async createWallet(wallet: WalletCreationInput): Promise<PrismaWallet> {
    const [w] = await db
      .insert(wallets)
      .values({
        id: wallet.id ?? randomUUID(),
        userId: wallet.userId,
        balance: wallet.balance ?? "0",
        createdAt: wallet.createdAt ?? new Date(),
        updatedAt: wallet.updatedAt ?? new Date(),
      })
      .returning();
    return w as any as PrismaWallet;
  }

  async updateWalletBalance(userId: string, amount: string): Promise<PrismaWallet | undefined> {
    const [w] = await db
      .update(wallets)
      .set({ balance: amount, updatedAt: new Date() })
      .where(eq(wallets.userId, userId))
      .returning();
    return (w as any as PrismaWallet) ?? undefined;
  }

  // Transactions
  async createTransaction(transaction: CreateTransactionInput): Promise<PrismaTransaction> {
    const toDrizzleType = (t: TransactionType): any =>
      t === ("CREDIT" as any) ? "credit" : "debit";
    const toDrizzleStatus = (s: TransactionStatus): any => {
      if (s === ("COMPLETED" as any)) return "completed";
      if (s === ("FAILED" as any)) return "failed";
      return "pending";
    };

    const [row] = await db
      .insert(transactions)
      .values({
        id: transaction.id ?? randomUUID(),
        walletId: transaction.walletId,
        serviceRequestId: transaction.serviceRequestId ?? null,
        amount: transaction.amount,
        type: toDrizzleType(transaction.type),
        status: toDrizzleStatus(transaction.status),
        description: transaction.description ?? null,
        reference: transaction.reference,
        meta: (transaction.meta as any) ?? {},
        gateway: transaction.gateway ?? "paystack",
        gatewayReference: transaction.gatewayReference ?? transaction.reference,
        createdAt: transaction.createdAt ?? new Date(),
        updatedAt: transaction.updatedAt ?? new Date(),
      })
      .returning();

    return this.#mapDrizzleTxToPrismaLike(row) as any as PrismaTransaction;
  }

  async getTransactionsByWallet(walletId: string): Promise<PrismaTransaction[]> {
    const rows = await db
      .select()
      .from(transactions)
      .where(eq(transactions.walletId, walletId))
      .orderBy(desc(transactions.createdAt));
    return rows.map((r: any) => this.#mapDrizzleTxToPrismaLike(r) as any as PrismaTransaction);
  }

  async getTransactionByReference(reference: string): Promise<PrismaTransaction | undefined> {
    const [row] = await db
      .select()
      .from(transactions)
      .where(eq(transactions.reference, reference))
      .limit(1);
    return row ? (this.#mapDrizzleTxToPrismaLike(row) as any as PrismaTransaction) : undefined;
  }

  async updateTransactionByReference(
    reference: string,
    updates: Prisma.TransactionUpdateInput,
  ): Promise<PrismaTransaction | undefined> {
    const toDrizzleStatus = (s: any): any => {
      if (s === ("COMPLETED" as any)) return "completed";
      if (s === ("FAILED" as any)) return "failed";
      if (s === ("PENDING" as any)) return "pending";
      return undefined;
    };

    const patch: any = {};
    if (updates.status) {
      const sVal = (updates.status as any);
      patch.status = toDrizzleStatus(typeof sVal === "object" && "set" in sVal ? (sVal as any).set : sVal);
    }
    if (updates.description !== undefined) {
      const dVal = updates.description as any;
      patch.description = typeof dVal === "object" && dVal?.set !== undefined ? dVal.set : dVal;
    }
    if (updates.meta !== undefined) {
      const mVal = updates.meta as any;
      patch.meta = typeof mVal === "object" && mVal?.set !== undefined ? mVal.set : mVal;
    }

    const [row] = await db
      .update(transactions)
      .set({ ...patch, ...(Object.keys(patch).length ? { } : {}) })
      .where(eq(transactions.reference, reference))
      .returning();

    return row ? (this.#mapDrizzleTxToPrismaLike(row) as any as PrismaTransaction) : undefined;
  }

  #mapDrizzleTxToPrismaLike(row: any) {
    const toPrismaStatus = (s: string): any => {
      switch (String(s).toLowerCase()) {
        case "completed":
          return "COMPLETED";
        case "failed":
          return "FAILED";
        default:
          return "PENDING";
      }
    };
    const toPrismaType = (t: string): any => (String(t).toLowerCase() === "credit" ? "CREDIT" : "DEBIT");
    return {
      id: row.id,
      walletId: row.walletId,
      serviceRequestId: row.serviceRequestId,
      amount: row.amount,
      type: toPrismaType(row.type),
      status: toPrismaStatus(row.status),
      description: row.description,
      meta: row.meta,
      gateway: row.gateway,
      gatewayReference: row.reference,
      createdAt: row.createdAt,
      // Prisma model has updatedAt; Drizzle doesn't. Omit or reuse createdAt.
      updatedAt: row.createdAt,
      currency: (row.currency ?? "NGN"),
    };
  }

  // Admin functions
  async getUsers(role?: string): Promise<User[]> {
    if (role) {
      const userList = await db
        .select()
        .from(users)
        .where(eq(users.role, role as any))
        .orderBy(desc(users.createdAt));
      return userList;
    }
    
    const userList = await db
      .select()
      .from(users)
      .orderBy(desc(users.createdAt));
    return userList;
  }

  async getPendingProviders(): Promise<User[]> {
    const providers = await db
      .select()
      .from(users)
      .where(
        and(
          eq(users.role, "provider"),
          eq(users.isApproved, false)
        )
      )
      .orderBy(desc(users.createdAt));
    return providers;
  }

  async approveProvider(providerId: string): Promise<User | undefined> {
    const [provider] = await db
      .update(users)
      .set({ isApproved: true, updatedAt: new Date() })
      .where(eq(users.id, providerId))
      .returning();
    
    // Keep Prisma in sync with Drizzle
    if (provider) {
      try {
        await prisma.user.update({
          where: { id: provider.id },
          data: {
            isApproved: true,
          },
        });
      } catch (error) {
        console.warn("Failed to sync provider approval to Prisma:", (error as Error).message);
      }
    }
    
    return provider || undefined;
  }

  async deleteUser(userId: string): Promise<boolean> {
    // Delete from Drizzle users table
    const deleted = await db
      .delete(users)
      .where(eq(users.id, userId))
      .returning();
    
    // Also delete from Prisma User table to keep both in sync
    try {
      await prisma.user.delete({ where: { id: userId } });
    } catch (error) {
      // User might not exist in Prisma, which is fine
      console.warn("User not found in Prisma during delete:", userId);
    }
    
    return deleted.length > 0;
  }

  async getPostgresIdFromMongoId(entityType: string, mongoId: string): Promise<string | null> {
    const [row] = await db
      .select({ postgresId: mongoIdMappings.postgresId })
      .from(mongoIdMappings)
      .where(
        and(
          eq(mongoIdMappings.entityType, entityType),
          eq(mongoIdMappings.mongoId, mongoId),
        ),
      )
      .limit(1);
    return row?.postgresId || null;
  }

  

  async getUserStats(): Promise<any> {
    const [totalUsers] = await db.select({ count: count() }).from(users);
    const [totalResidents] = await db.select({ count: count() }).from(users).where(eq(users.role, "resident"));
    const [totalProviders] = await db.select({ count: count() }).from(users).where(eq(users.role, "provider"));
    const [totalRequests] = await db.select({ count: count() }).from(serviceRequests);
    // Active requests = any request not completed/cancelled
    const [activeRequests] = await db
      .select({ count: count() })
      .from(serviceRequests)
      .where(sql`${serviceRequests.status} not in ('completed','cancelled')`);
    const [pendingApprovals] = await db.select({ count: count() }).from(users).where(
      and(eq(users.role, "provider"), eq(users.isApproved, false))
    );

    const [totalEstates] = await db.select({ count: count() }).from(estates);
    const [revenueRow] = await db
      .select({ total: sum(transactions.amount) })
      .from(transactions)
      .where(eq(transactions.status, "completed"));

    const totalRevenue = Number(revenueRow?.total ?? 0);

    return {
      totalUsers: totalUsers.count,
      totalResidents: totalResidents.count,
      totalProviders: totalProviders.count,
      totalRequests: totalRequests.count,
      activeRequests: activeRequests.count,
      pendingApprovals: pendingApprovals.count,
      totalEstates: totalEstates.count,
      totalRevenue,
    };
  }

  async getCompanies(): Promise<Company[]> {
    try {
      console.log("Storage: Getting companies from database...");
      const list = await db
        .select()
        .from(companies)
        .orderBy(desc(companies.createdAt));

      console.log("Storage: Retrieved", list.length, "companies");
      return list as any;
    } catch (error) {
      console.error("Storage: Error in getCompanies:", error);
      console.error("Storage: Error details:", {
        message: error instanceof Error ? error.message : String(error),
        code: (error as any)?.code,
        detail: (error as any)?.detail,
      });
      throw error;
    }
  }

  async createCompany(company: InsertCompany): Promise<Company> {
    const [row] = await db
      .insert(companies)
      .values(company)
      .returning();
    return row as any;
  }

  async updateCompany(id: string, company: Partial<InsertCompany>): Promise<Company | undefined> {
    console.log("Storage: Updating company", id);
    console.log("Storage: Update payload:", JSON.stringify(company, null, 2));
    
    const [row] = await db
      .update(companies)
      .set(company)
      .where(eq(companies.id, id))
      .returning();
    
    console.log("Storage: Updated company result:", JSON.stringify(row, null, 2));
    return row as any;
  }

  async deleteCompany(id: string): Promise<boolean> {
    const result = await db
      .delete(companies)
      .where(eq(companies.id, id));
    return true;
  }

  async createProviderRequest(
    request: InsertProviderRequest,
    providerId?: string,
  ): Promise<ProviderRequest> {
    const [row] = await db
      .insert(providerRequests)
      .values({
        ...request,
        providerId: providerId ?? null,
        createdAt: new Date(),
      })
      .returning();
    return row;
  }

  async createNotification(input: InsertNotification): Promise<Notification> {
    const [row] = await db
      .insert(notifications)
      .values(input)
      .returning();
    return row as any;
  }

  async listNotificationsForUser(
    userId: string,
    options: { limit?: number; offset?: number } = {},
  ): Promise<Notification[]> {
    const limit = Math.max(1, options.limit ?? 50);
    const offset = Math.max(0, options.offset ?? 0);
    const rows = await db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, userId))
      .orderBy(desc(notifications.createdAt))
      .limit(limit)
      .offset(offset);
    return rows as any;
  }

  async markNotificationRead(
    userId: string,
    notificationId: string,
  ): Promise<Notification | undefined> {
    const [row] = await db
      .update(notifications)
      .set({ isRead: true })
      .where(and(eq(notifications.id, notificationId), eq(notifications.userId, userId)))
      .returning();
    return row as any;
  }

  async markAllNotificationsRead(userId: string): Promise<{ updated: number }> {
    const rows = await db
      .update(notifications)
      .set({ isRead: true })
      .where(eq(notifications.userId, userId))
      .returning();
    return { updated: rows.length };
  }

  async createAuditLog(entry: InsertAuditLog): Promise<AuditLog> {
    const [log] = await db.insert(auditLogs).values(entry).returning();
    return log;
  }

  async getProviderRequests(): Promise<ProviderRequest[]> {
    const rows = await db
      .select()
      .from(providerRequests)
      .orderBy(desc(providerRequests.createdAt));
    return rows;
  }

  async deleteProviderRequestByProviderId(providerId: string): Promise<void> {
    await db
      .delete(providerRequests)
      .where(eq(providerRequests.providerId, providerId));
  }

  async getProviderRequestById(requestId: string): Promise<ProviderRequest | null> {
    const [row] = await db
      .select()
      .from(providerRequests)
      .where(eq(providerRequests.id, requestId));
    return row || null;
  }

  async deleteProviderRequest(requestId: string): Promise<void> {
    await db
      .delete(providerRequests)
      .where(eq(providerRequests.id, requestId));
  }

  async getOrders(params: OrdersQueryParams = {}): Promise<OrdersListResult> {
    const page = Math.max(1, params.page ?? 1);
    const limit = Math.max(1, params.limit ?? 20);
    const offset = (page - 1) * limit;
    const whereClauses: any[] = [];
    if (params.status) {
      whereClauses.push(eq(orders.status, params.status as any));
    }
    if (params.hasDispute !== undefined) {
      const disputeCondition = params.hasDispute
        ? sql`${orders.dispute} IS NOT NULL AND (${orders.dispute}->>'reason') <> ''`
        : sql`${orders.dispute} IS NULL OR (${orders.dispute}->>'reason') = ''`;
      whereClauses.push(disputeCondition);
    }
    if (params.startDate) {
      const start = new Date(params.startDate);
      if (!isNaN(start.getTime())) {
        whereClauses.push(sql`${orders.createdAt} >= ${start}`);
      }
    }
    if (params.endDate) {
      const end = new Date(params.endDate);
      if (!isNaN(end.getTime())) {
        whereClauses.push(sql`${orders.createdAt} <= ${end}`);
      }
    }
    if (params.minTotal !== undefined && !Number.isNaN(params.minTotal)) {
      whereClauses.push(sql`${orders.total} >= ${params.minTotal}`);
    }
    if (params.maxTotal !== undefined && !Number.isNaN(params.maxTotal)) {
      whereClauses.push(sql`${orders.total} <= ${params.maxTotal}`);
    }

    if (params.search) {
      const trimmed = params.search.trim();
      if (trimmed) {
        const likeTerm = `%${trimmed}%`;
        const matchingUsers = await db
          .select({ id: users.id })
          .from(users)
          .where(
            or(
              sql`${users.name} ILIKE ${likeTerm}`,
              sql`${users.email} ILIKE ${likeTerm}`,
              sql`${users.phone} ILIKE ${likeTerm}`,
            ),
          );
        const searchConditions: any[] = [sql`${orders.id} ILIKE ${likeTerm}`];
        if (matchingUsers.length) {
          const userIds = matchingUsers.map((u: any) => u.id);
          searchConditions.push(inArray(orders.buyerId, userIds));
          searchConditions.push(inArray(orders.vendorId, userIds));
        }
        let combined = searchConditions[0];
        for (let i = 1; i < searchConditions.length; i += 1) {
          combined = or(combined, searchConditions[i]);
        }
        whereClauses.push(combined);
      }
    }

    const whereCondition = whereClauses.length ? and(...whereClauses) : undefined;
    let totalQuery = db.select({ count: count() }).from(orders);
    if (whereCondition) {
      totalQuery = totalQuery.where(whereCondition);
    }
    const [totalRow] = await totalQuery;
    const total = Number(totalRow?.count ?? 0);

    let mainQuery = db
      .select({
        id: orders.id,
        estateId: orders.estateId,
        storeId: orders.storeId,
        buyerId: orders.buyerId,
        vendorId: orders.vendorId,
        items: orders.items,
        total: orders.total,
        currency: orders.currency,
        status: orders.status,
        deliveryAddress: orders.deliveryAddress,
        paymentMethod: orders.paymentMethod,
        dispute: orders.dispute,
        createdAt: orders.createdAt,
        updatedAt: orders.updatedAt,
      })
      .from(orders);
    if (whereCondition) {
      mainQuery = mainQuery.where(whereCondition);
    }

    const normalizedSortOrder =
      params.sortOrder && params.sortOrder.toLowerCase() === "asc"
        ? "asc"
        : "desc";
    const sortColumn = params.sortBy === "total" ? orders.total : orders.createdAt;
    const orderByClause = normalizedSortOrder === "asc" ? asc(sortColumn) : desc(sortColumn);
    const orderRows = await mainQuery
      .orderBy(orderByClause)
      .limit(limit)
      .offset(offset);

    const userIds = Array.from(
      new Set(
        orderRows
          .flatMap((orderRow: any) => [orderRow.buyerId, orderRow.vendorId])
          .filter(Boolean),
      ),
    );
    const userRows = userIds.length
      ? await db
          .select({
            id: users.id,
            name: users.name,
            email: users.email,
            phone: users.phone,
          })
          .from(users)
          .where(inArray(users.id, userIds as string[]))
      : [];
    const userMap = new Map(userRows.map((userRow: any) => [userRow.id, userRow]));

    const formattedOrders: AdminOrder[] = orderRows.map((orderRow: any) => ({
      ...orderRow,
      _id: orderRow.id,
      total: Number(orderRow.total),
      buyer: userMap.get(orderRow.buyerId) ?? null,
      vendor: userMap.get(orderRow.vendorId) ?? null,
    }));

    const pagination: OrdersPagination = {
      total,
      page,
      limit,
      totalPages: limit > 0 ? Math.ceil(total / limit) : 0,
    };

    return {
      orders: formattedOrders,
      pagination,
    };
  }

  async getOrderStats(): Promise<OrderStats> {
    const [totalRow] = await db.select({ count: count() }).from(orders);
    const [revenueRow] = await db.select({ total: sum(orders.total) }).from(orders);
    const [disputeRow] = await db
      .select({ count: count() })
      .from(orders)
      .where(sql`${orders.dispute} IS NOT NULL AND (${orders.dispute}->>'reason') <> ''`);

    const totalOrders = Number(totalRow?.count ?? 0);
    const totalRevenue = Number(revenueRow?.total ?? 0);
    const disputedOrders = Number(disputeRow?.count ?? 0);

    return {
      totalOrders,
      totalRevenue,
      disputedOrders,
      avgOrderValue: totalOrders ? totalRevenue / totalOrders : 0,
    };
  }

  async updateOrderStatus(orderId: string, status: string): Promise<Order | undefined> {
    const [order] = await db
      .update(orders)
      .set({ status: status as any, updatedAt: new Date() })
      .where(eq(orders.id, orderId))
      .returning();
    return order || undefined;
  }

  async createOrderDispute(
    orderId: string,
    payload: { reason: string; description?: string },
  ): Promise<Order | undefined> {
    const dispute = {
      reason: payload.reason,
      description: payload.description ?? null,
      status: "open",
      createdAt: new Date().toISOString(),
    };
    const [order] = await db
      .update(orders)
      .set({ dispute, updatedAt: new Date() })
      .where(eq(orders.id, orderId))
      .returning();
    return order || undefined;
  }

  async updateOrderDispute(
    orderId: string,
    payload: { status: string; resolution: string; refundAmount?: number },
  ): Promise<Order | undefined> {
    const [existing] = await db
      .select()
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1);
    if (!existing) return undefined;
    const updatedDispute = {
      ...(existing.dispute ?? {}),
      status: payload.status,
      resolution: payload.resolution,
      refundAmount: payload.refundAmount ?? existing.dispute?.refundAmount ?? null,
      resolvedAt: new Date().toISOString(),
    };
    const [order] = await db
      .update(orders)
      .set({ dispute: updatedDispute, updatedAt: new Date() })
      .where(eq(orders.id, orderId))
      .returning();
    return order || undefined;
  }
}

export const storage = new DatabaseStorage();
