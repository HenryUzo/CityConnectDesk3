import {
  users,
  serviceRequests,
  wallets,
  transactions,
  companies,
  providerRequests,
  mongoIdMappings,
  requestMessages,
  requestBills,
  requestBillItems,
  inspections,
  deviceAssignments,
  auditLogs,
  type User,
  type InsertUser,
  type ServiceRequest,
  type InsertServiceRequest,
  type Wallet,
  type InsertWallet,
  type Transaction,
  type InsertTransaction,
  type Company,
  type InsertCompany,
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
  type AuditLog,
  type InsertAuditLog,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, count, sql } from "drizzle-orm";
import session from "express-session";
import connectPg from "connect-pg-simple";
import { pool } from "./db";

const PostgresSessionStore = connectPg(session);

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByAccessCode(accessCode: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, updates: Partial<User>): Promise<User | undefined>;
  
  // Service Requests
  createServiceRequest(request: InsertServiceRequest): Promise<ServiceRequest>;
  getServiceRequest(id: string): Promise<ServiceRequest | undefined>;
  getServiceRequestsByResident(residentId: string): Promise<ServiceRequest[]>;
  getServiceRequestsByProvider(providerId: string): Promise<ServiceRequest[]>;
  getAvailableServiceRequests(category?: string): Promise<ServiceRequest[]>;
  getAllServiceRequests(): Promise<ServiceRequest[]>;
  updateServiceRequest(id: string, updates: Partial<ServiceRequest>): Promise<ServiceRequest | undefined>;
  assignServiceRequest(id: string, providerId: string): Promise<ServiceRequest | undefined>;
  
  // Wallets
  getWalletByUserId(userId: string): Promise<Wallet | undefined>;
  createWallet(wallet: InsertWallet): Promise<Wallet>;
  updateWalletBalance(userId: string, amount: string): Promise<Wallet | undefined>;
  
  // Transactions
  createTransaction(transaction: InsertTransaction): Promise<Transaction>;
  getTransactionsByWallet(walletId: string): Promise<Transaction[]>;
  
  // Admin functions
  getUsers(role?: string): Promise<User[]>;
  getPendingProviders(): Promise<User[]>;
  approveProvider(providerId: string): Promise<User | undefined>;
  getUserStats(): Promise<any>;
  getCompanies(): Promise<Company[]>;
  createCompany(company: InsertCompany): Promise<Company>;
  createProviderRequest(request: InsertProviderRequest): Promise<ProviderRequest>;
  getProviderRequests(): Promise<ProviderRequest[]>;
  deleteUser(userId: string): Promise<boolean>;
  deleteProviderRequestByProviderId(providerId: string): Promise<void>;
  getProviderRequestById(requestId: string): Promise<ProviderRequest | null>;
  deleteProviderRequest(requestId: string): Promise<void>;
  getPostgresIdFromMongoId(entityType: string, mongoId: string): Promise<string | null>;
  createAuditLog(entry: InsertAuditLog): Promise<AuditLog>;
  
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

  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db
      .select({
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        name: users.name,
        email: users.email,
        phone: users.phone,
        password: users.password,
        role: users.role,
        globalRole: users.globalRole,
        company: users.company,
        documents: users.documents,
        metadata: users.metadata,
        lastLoginAt: users.lastLoginAt,
        isActive: users.isActive,
        isApproved: users.isApproved,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      })
      .from(users)
      .where(eq(users.id, id));
    return (user as unknown as User) || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db
      .select({
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        name: users.name,
        email: users.email,
        phone: users.phone,
        password: users.password,
        role: users.role,
        globalRole: users.globalRole,
        company: users.company,
        documents: users.documents,
        metadata: users.metadata,
        lastLoginAt: users.lastLoginAt,
        isActive: users.isActive,
        isApproved: users.isApproved,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      })
      .from(users)
      .where(eq(users.email, username));
    return (user as unknown as User) || undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db
      .select({
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        name: users.name,
        email: users.email,
        phone: users.phone,
        password: users.password,
        role: users.role,
        globalRole: users.globalRole,
        company: users.company,
        documents: users.documents,
        metadata: users.metadata,
        lastLoginAt: users.lastLoginAt,
        isActive: users.isActive,
        isApproved: users.isApproved,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      })
      .from(users)
      .where(eq(users.email, email));
    return (user as unknown as User) || undefined;
  }

  async getUserByAccessCode(accessCode: string): Promise<User | undefined> {
    const [user] = await db
      .select({
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        name: users.name,
        email: users.email,
        phone: users.phone,
        password: users.password,
        role: users.role,
        globalRole: users.globalRole,
        company: users.company,
        documents: users.documents,
        metadata: users.metadata,
        lastLoginAt: users.lastLoginAt,
        isActive: users.isActive,
        isApproved: users.isApproved,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      })
      .from(users)
      .where(
        and(
          eq(users.accessCode, accessCode),
          eq(users.role, "resident")
        )
      );
    return (user as unknown as User) || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    
    // Create wallet for new user
    if (user.role === "resident") {
      await this.createWallet({ userId: user.id, balance: "25000" });
    }
    
    return user;
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return user || undefined;
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

  async getServiceRequestsByResident(residentId: string): Promise<ServiceRequest[]> {
    const requests = await db
      .select()
      .from(serviceRequests)
      .where(eq(serviceRequests.residentId, residentId))
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
    status: "pending" | "assigned" | "in_progress" | "completed" | "cancelled",
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
    if (category) {
      const requests = await db
        .select()
        .from(serviceRequests)
        .where(
          and(
            eq(serviceRequests.status, "pending"),
            eq(serviceRequests.category, category as any)
          )
        )
        .orderBy(desc(serviceRequests.createdAt));
      return requests;
    }
    
    const requests = await db
      .select()
      .from(serviceRequests)
      .where(eq(serviceRequests.status, "pending"))
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
  async getWalletByUserId(userId: string): Promise<Wallet | undefined> {
    const [wallet] = await db.select().from(wallets).where(eq(wallets.userId, userId));
    return wallet || undefined;
  }

  async createWallet(wallet: InsertWallet): Promise<Wallet> {
    const [newWallet] = await db
      .insert(wallets)
      .values(wallet)
      .returning();
    return newWallet;
  }

  async updateWalletBalance(userId: string, amount: string): Promise<Wallet | undefined> {
    const [wallet] = await db
      .update(wallets)
      .set({ balance: amount, updatedAt: new Date() })
      .where(eq(wallets.userId, userId))
      .returning();
    return wallet || undefined;
  }

  // Transactions
  async createTransaction(transaction: InsertTransaction): Promise<Transaction> {
    const [newTransaction] = await db
      .insert(transactions)
      .values(transaction)
      .returning();
    return newTransaction;
  }

  async getTransactionsByWallet(walletId: string): Promise<Transaction[]> {
    const transactionList = await db
      .select()
      .from(transactions)
      .where(eq(transactions.walletId, walletId))
      .orderBy(desc(transactions.createdAt));
    return transactionList;
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
    return provider || undefined;
  }

  async deleteUser(userId: string): Promise<boolean> {
    const deleted = await db
      .delete(users)
      .where(eq(users.id, userId))
      .returning();
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
    const [activeRequests] = await db.select({ count: count() }).from(serviceRequests).where(eq(serviceRequests.status, "pending"));
    const [pendingApprovals] = await db.select({ count: count() }).from(users).where(
      and(eq(users.role, "provider"), eq(users.isApproved, false))
    );

    return {
      totalUsers: totalUsers.count,
      totalResidents: totalResidents.count,
      totalProviders: totalProviders.count,
      totalRequests: totalRequests.count,
      activeRequests: activeRequests.count,
      pendingApprovals: pendingApprovals.count
    };
  }

  async getCompanies(): Promise<Company[]> {
    const list = await db.select().from(companies).orderBy(desc(companies.createdAt));
    return list;
  }

  async createCompany(company: InsertCompany): Promise<Company> {
    const [row] = await db.insert(companies).values(company).returning();
    return row;
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
}

export const storage = new DatabaseStorage();
