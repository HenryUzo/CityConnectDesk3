import { users, serviceRequests, wallets, transactions, type User, type InsertUser, type ServiceRequest, type InsertServiceRequest, type Wallet, type InsertWallet, type Transaction, type InsertTransaction } from "@shared/schema";
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
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, username));
    return user || undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user || undefined;
  }

  async getUserByAccessCode(accessCode: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(
      and(
        eq(users.accessCode, accessCode),
        eq(users.role, "resident")
      )
    );
    return user || undefined;
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

  async getServiceRequestsByProvider(providerId: string): Promise<ServiceRequest[]> {
    const requests = await db
      .select()
      .from(serviceRequests)
      .where(eq(serviceRequests.providerId, providerId))
      .orderBy(desc(serviceRequests.createdAt));
    return requests;
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
}

export const storage = new DatabaseStorage();
