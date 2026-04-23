import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { config as loadEnv } from "dotenv";
import { and, eq } from "drizzle-orm";
import { db, dbReady } from "../server/db";
import { hashPassword } from "../server/auth-utils";
import { storage } from "../server/storage";
import {
  companies,
  companyTasks,
  companyTaskUpdates,
  estates,
  memberships,
  notifications,
  requestMessages,
  serviceRequests,
  users,
} from "../shared/schema";

loadEnv();

async function ensureResident() {
  const passwordHash = await hashPassword("password123");
  let user = await storage.getUserByEmail("resident.mobile@cityconnect.local");
  if (user) {
    user = (await storage.updateUser(user.id, {
      name: "Mobile Resident",
      email: "resident.mobile@cityconnect.local",
      username: "resmobile",
      phone: "08132848732",
      password: passwordHash,
      role: "resident",
      isApproved: true,
      isActive: true,
      accessCode: "123456",
    } as any))!;
  } else {
    user = await storage.createUser({
      name: "Mobile Resident",
      email: "resident.mobile@cityconnect.local",
      username: "resmobile",
      phone: "08132848732",
      password: passwordHash,
      role: "resident",
      isApproved: true,
      isActive: true,
      accessCode: "123456",
    } as any);
  }
  return user;
}

async function ensureProvider() {
  const passwordHash = await hashPassword("password123");
  let user = await storage.getUserByEmail("provider.mobile@cityconnect.local");
  if (user) {
    user = (await storage.updateUser(user.id, {
      name: "Mobile Provider",
      firstName: "Mobile",
      lastName: "Provider",
      email: "provider.mobile@cityconnect.local",
      username: "providermob",
      phone: "08099990000",
      password: passwordHash,
      role: "provider",
      isApproved: true,
      isActive: true,
      serviceCategory: "plumber",
      experience: 6,
    } as any))!;
  } else {
    user = await storage.createUser({
      name: "Mobile Provider",
      firstName: "Mobile",
      lastName: "Provider",
      email: "provider.mobile@cityconnect.local",
      username: "providermob",
      phone: "08099990000",
      password: passwordHash,
      role: "provider",
      isApproved: true,
      isActive: true,
      serviceCategory: "plumber",
      experience: 6,
    } as any);
  }
  return user;
}

async function ensureEstate(residentId: string) {
  let [estate] = await db
    .select()
    .from(estates)
    .where(eq(estates.slug, "mobile-demo-estate"))
    .limit(1);

  if (!estate) {
    const [created] = await db
      .insert(estates)
      .values({
        name: "Mobile Demo Estate",
        slug: "mobile-demo-estate",
        description: "Local estate used for mobile screenshots.",
        address: "Lekki Phase 1, Lagos",
        accessType: "open",
        accessCode: "654321",
        coverage: {
          type: "Polygon",
          coordinates: [[[3.4, 6.4], [3.41, 6.4], [3.41, 6.41], [3.4, 6.41], [3.4, 6.4]]],
        },
        settings: {
          servicesEnabled: ["plumber", "electrician"],
          marketplaceEnabled: true,
          paymentMethods: ["paystack"],
          deliveryRules: {},
        },
        isActive: true,
      } as any)
      .returning();
    estate = created;
  }

  const [membership] = await db
    .select()
    .from(memberships)
    .where(and(eq(memberships.userId, residentId), eq(memberships.estateId, estate.id)))
    .limit(1);

  if (!membership) {
    await db.insert(memberships).values({
      userId: residentId,
      estateId: estate.id,
      role: "resident",
      isPrimary: true,
      isActive: true,
      status: "active",
    } as any);
  }

  return estate;
}

async function ensureCompany(providerId: string) {
  let [company] = await db
    .select()
    .from(companies)
    .where(eq(companies.providerId, providerId))
    .limit(1);

  if (!company) {
    company = await storage.createCompany({
      name: "CityConnect Mobile Services",
      description: "Approved local provider company for mobile screenshots.",
      contactEmail: "provider.mobile@cityconnect.local",
      phone: "08099990000",
      providerId,
      submittedAt: new Date(),
      isActive: true,
      details: {},
    } as any);
  }

  await storage.updateUser(providerId, { company: company.id, isApproved: true } as any);
  return company;
}

async function ensureRequest(input: {
  residentId: string;
  providerId: string;
  estateId: string;
  category: "plumber";
  description: string;
  location: string;
  status: string;
  categoryLabel: string;
  billedAmount?: string;
  paymentRequested?: boolean;
  consultancyReport?: Record<string, unknown>;
}) {
  const [existing] = await db
    .select()
    .from(serviceRequests)
    .where(and(eq(serviceRequests.residentId, input.residentId), eq(serviceRequests.description, input.description)))
    .limit(1);

  const baseValues = {
    estateId: input.estateId,
    category: input.category,
    description: input.description,
    residentId: input.residentId,
    providerId: input.providerId,
    status: input.status as any,
    budget: "45000",
    urgency: "medium" as any,
    location: input.location,
    assignedAt: new Date(),
    categoryLabel: input.categoryLabel,
    billedAmount: input.billedAmount || "45000",
    paymentStatus: input.paymentRequested ? "pending" : "paid",
    paymentRequestedAt: input.paymentRequested ? new Date() : null,
    consultancyReport: input.consultancyReport || null,
    consultancyReportSubmittedAt: input.consultancyReport ? new Date() : null,
    consultancyReportSubmittedBy: input.consultancyReport ? input.providerId : null,
  };

  if (existing) {
    const [updated] = await db
      .update(serviceRequests)
      .set({ ...baseValues, updatedAt: new Date() } as any)
      .where(eq(serviceRequests.id, existing.id))
      .returning();
    return updated;
  }

  const [created] = await db.insert(serviceRequests).values(baseValues as any).returning();
  return created;
}

async function ensureRequestMessages(requestId: string, residentId: string, providerId: string) {
  const existing = await db
    .select({ id: requestMessages.id })
    .from(requestMessages)
    .where(eq(requestMessages.requestId, requestId));

  if (existing.length > 0) return;

  await db.insert(requestMessages).values([
    {
      requestId,
      senderId: residentId,
      senderRole: "resident",
      message: "Hello, I need help with a leaking kitchen pipe.",
    } as any,
    {
      requestId,
      senderId: providerId,
      senderRole: "provider",
      message: "Received. I am on site and assessing the cause now.",
    } as any,
  ]);
}

async function ensureTask(companyId: string, providerId: string, serviceRequestId: string) {
  const [existing] = await db
    .select()
    .from(companyTasks)
    .where(and(eq(companyTasks.companyId, companyId), eq(companyTasks.serviceRequestId, serviceRequestId)))
    .limit(1);

  let task = existing;
  if (!task) {
    const [created] = await db
      .insert(companyTasks)
      .values({
        companyId,
        title: "Follow up on replacement materials",
        description: "Confirm PVC fittings and pressure valve replacement stock for the assigned job.",
        assigneeId: providerId,
        createdBy: providerId,
        priority: "high",
        status: "in_progress",
        serviceRequestId,
        metadata: {},
      } as any)
      .returning();
    task = created;
  }

  const [update] = await db
    .select()
    .from(companyTaskUpdates)
    .where(eq(companyTaskUpdates.taskId, task.id))
    .limit(1);

  if (!update) {
    await db.insert(companyTaskUpdates).values({
      taskId: task.id,
      authorId: providerId,
      message: "Replacement parts confirmed with supplier. Delivery expected this afternoon.",
      attachments: [],
    } as any);
  }

  return task;
}

async function ensureNotifications(residentId: string, providerId: string) {
  const [residentNotification] = await db
    .select()
    .from(notifications)
    .where(and(eq(notifications.userId, residentId), eq(notifications.title, "Payment requested")))
    .limit(1);

  if (!residentNotification) {
    await storage.createNotification({
      userId: residentId,
      title: "Payment requested",
      message: "A payment request was raised for your active plumbing job.",
      type: "request_update",
      metadata: {},
    } as any);
  }

  const [providerNotification] = await db
    .select()
    .from(notifications)
    .where(and(eq(notifications.userId, providerId), eq(notifications.title, "New assignment")))
    .limit(1);

  if (!providerNotification) {
    await storage.createNotification({
      userId: providerId,
      title: "New assignment",
      message: "You have been assigned a plumbing job in Mobile Demo Estate.",
      type: "request_update",
      metadata: {},
    } as any);
  }
}

async function main() {
  await dbReady;
  const resident = await ensureResident();
  const provider = await ensureProvider();
  const estate = await ensureEstate(resident.id);
  const company = await ensureCompany(provider.id);

  const residentRequest = await ensureRequest({
    residentId: resident.id,
    providerId: provider.id,
    estateId: estate.id,
    category: "plumber",
    description: "Kitchen sink leak requiring urgent inspection and payment confirmation.",
    location: "Block A, Flat 12",
    status: "assigned_for_job",
    categoryLabel: "Plumbing",
    billedAmount: "45000",
    paymentRequested: true,
  });

  const providerJob = await ensureRequest({
    residentId: resident.id,
    providerId: provider.id,
    estateId: estate.id,
    category: "plumber",
    description: "Bathroom pipe pressure issue currently in progress.",
    location: "Block B, Flat 4",
    status: "in_progress",
    categoryLabel: "Plumbing",
    billedAmount: "38000",
    consultancyReport: {
      inspectionDate: "2026-04-05",
      completionDeadline: "2026-04-07",
      actualIssue: "Damaged pressure control joint causing intermittent leaks.",
      causeOfIssue: "Worn valve connection and poor sealing compound.",
      materialCost: 18000,
      serviceCost: 20000,
      preventiveRecommendation: "Replace the joint set and schedule a quarterly inspection.",
    },
  });

  await ensureRequestMessages(residentRequest.id, resident.id, provider.id);
  await ensureRequestMessages(providerJob.id, resident.id, provider.id);
  const task = await ensureTask(company.id, provider.id, providerJob.id);
  await ensureNotifications(resident.id, provider.id);

  const manifest = {
    resident: {
      email: resident.email,
      password: "password123",
      accessCode: resident.accessCode,
    },
    provider: {
      email: provider.email,
      password: "password123",
    },
    requestIds: {
      residentDetail: residentRequest.id,
      providerDetail: providerJob.id,
    },
    taskId: task.id,
  };

  const outputDir = join(process.cwd(), "output", "playwright");
  await mkdir(outputDir, { recursive: true });
  await writeFile(join(outputDir, "mobile-screenshot-seed.json"), JSON.stringify(manifest, null, 2));
  console.log(JSON.stringify(manifest, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
