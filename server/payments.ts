import { nanoid } from "nanoid";
import { TransactionStatus, TransactionType } from "@prisma/client";
import type { Wallet } from "@prisma/client";
import { storage } from "./storage";
import { verifyPaystackTransaction } from "./paystack";
import { Prisma } from "@prisma/client";
import {
  normalizeCategoryKey,
  tryResolveServiceRequestCategory,
} from "./serviceCategoryResolver";

type CreatePendingTxArgs = {
  userId: string;
  amount: number;
  description?: string;
  serviceRequestId?: string;
  meta?: Record<string, unknown>;
};

export type ConsultancyRequestDraft = {
  categoryKey?: string | null;
  categoryLabel?: string | null;
  urgency?: string | null;
  location?: string | null;
  description?: string | null;
  issueType?: string | null;
  areaAffected?: string | null;
  quantityLabel?: string | null;
  timeWindowLabel?: string | null;
  addressLine?: string | null;
  estateName?: string | null;
  stateName?: string | null;
  lgaName?: string | null;
  notes?: string | null;
  attachmentsCount?: number | string | null;
};

export type PaystackSession = {
  reference: string;
  amountKobo: number;
  amountFormatted: string;
  walletId: string;
};

function requirePositiveAmount(amount: number) {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Amount must be a positive number");
  }
}

function trimOrNull(value: unknown) {
  const next = String(value ?? "").trim();
  return next || null;
}

export function buildConsultancyServiceRequestInput(params: {
  residentId: string;
  consultancy: ConsultancyRequestDraft | null | undefined;
}) {
  const consultancy = params.consultancy;
  if (!consultancy || typeof consultancy !== "object") return null;

  const category = tryResolveServiceRequestCategory(
    consultancy.categoryKey || "",
    consultancy.categoryLabel || "",
  );
  if (!category) return null;

  const urgencyInput = normalizeCategoryKey(consultancy.urgency || "");
  const urgency =
    urgencyInput === "emergency" ||
    urgencyInput === "high" ||
    urgencyInput === "medium" ||
    urgencyInput === "low"
      ? urgencyInput
      : "medium";

  const location = String(consultancy.location || "Not specified").trim() || "Not specified";
  const description =
    String(consultancy.description || "Consultancy request").trim() ||
    "Consultancy request";
  const photosCount = Number(consultancy.attachmentsCount || 0);

  return {
    category: category as any,
    categoryLabel: String(consultancy.categoryLabel || "").trim() || category.replace(/_/g, " "),
    description,
    residentId: params.residentId,
    budget: "Consultancy",
    urgency: urgency as any,
    issueType: trimOrNull(consultancy.issueType),
    areaAffected: trimOrNull(consultancy.areaAffected),
    quantityLabel: trimOrNull(consultancy.quantityLabel),
    timeWindowLabel: trimOrNull(consultancy.timeWindowLabel),
    location,
    addressLine: String(consultancy.addressLine || location).trim() || location,
    estateName: trimOrNull(consultancy.estateName),
    stateName: trimOrNull(consultancy.stateName),
    lgaName: trimOrNull(consultancy.lgaName),
    specialInstructions: trimOrNull(consultancy.notes),
    photosCount: Number.isFinite(photosCount) && photosCount > 0 ? photosCount : 0,
    paymentPurpose: "Consultancy / inspection",
    status: "pending" as any,
    paymentStatus: "pending",
  };
}

export async function createConsultancyServiceRequest(params: {
  storage: Pick<typeof storage, "createServiceRequest">;
  residentId: string;
  consultancy: ConsultancyRequestDraft | null | undefined;
}) {
  const input = buildConsultancyServiceRequestInput({
    residentId: params.residentId,
    consultancy: params.consultancy,
  });
  if (!input) return null;
  const created = await params.storage.createServiceRequest(input);
  return created?.id ?? null;
}

async function ensureConsultancyServiceRequest(params: {
  userId: string;
  txMeta?: Prisma.JsonValue | null;
}) {
  const meta = (params.txMeta as any) || {};
  return createConsultancyServiceRequest({
    storage,
    residentId: params.userId,
    consultancy: meta?.consultancyRequest as ConsultancyRequestDraft | undefined,
  });
}

async function ensureWallet(userId: string): Promise<Wallet> {
  let wallet = await storage.getWalletByUserId(userId);
  if (!wallet) {
    wallet = await storage.createWallet({
      userId,
      balance: "0",
    });
  }
  return wallet;
}

export async function createPendingPaystackTransaction(
  args: CreatePendingTxArgs,
): Promise<PaystackSession> {
  requirePositiveAmount(args.amount);
  const wallet = await ensureWallet(args.userId);
  const reference = `CCD-${Date.now()}-${nanoid(8)}`;
  const amountFormatted = args.amount.toFixed(2);
  const amountKobo = Math.round(args.amount * 100);

  await storage.createTransaction({
    walletId: wallet.id,
    userId: args.userId,
    serviceRequestId: args.serviceRequestId ?? null,
    amount: amountFormatted,
    type: TransactionType.DEBIT,
    status: TransactionStatus.PENDING,
    description: args.description ?? "Service payment",
    reference,
    meta: args.meta as Prisma.InputJsonObject,
  });

  return {
    reference,
    amountKobo,
    amountFormatted,
    walletId: wallet.id,
  };
}

export async function verifyAndFinalizePaystackCharge(reference: string) {
  const tx = await storage.getTransactionByReference(reference);
  if (!tx) {
    throw new Error(`Transaction with reference ${reference} not found`);
  }
  if (tx.status === TransactionStatus.COMPLETED) {
    return { transaction: tx, alreadyProcessed: true };
  }

  const verifyResponse = await verifyPaystackTransaction(reference);
  const charge = verifyResponse.data;
  if (!verifyResponse.status || !charge || charge.status !== "success") {
    throw new Error(`Paystack verification failed for ${reference}`);
  }

  const amountFromGateway = Number(charge.amount || 0) / 100;
  const expectedAmount = Number(tx.amount);
  if (amountFromGateway !== expectedAmount) {
    console.warn(
      `[paystack] Amount mismatch for ${reference}. Expected ${expectedAmount}, got ${amountFromGateway}`,
    );
  }

  let serviceRequestId = tx.serviceRequestId ?? null;
  if (!serviceRequestId) {
    try {
      const wallet = tx.walletId ? await storage.getWalletById(tx.walletId) : undefined;
      const userId = wallet?.userId;
      if (userId) {
        serviceRequestId = await ensureConsultancyServiceRequest({
          userId,
          txMeta: tx.meta as any,
        });
      }
    } catch {
      // ignore
    }
  }

  const updatedTx = await storage.updateTransactionByReference(reference, {
    status: TransactionStatus.COMPLETED,
    description: `Paystack ${charge.channel || "charge"}`,
    serviceRequest: serviceRequestId ? { connect: { id: serviceRequestId } } : undefined,
    meta: {
      ...((tx.meta as Prisma.JsonObject) || {}),
      paystack: charge as any,
    } as Prisma.InputJsonObject,
  });

  const finalServiceRequestId = serviceRequestId ?? tx.serviceRequestId;
  if (finalServiceRequestId) {
    await storage.updateServiceRequest(finalServiceRequestId, {
      paymentStatus: "paid",
      billedAmount: tx.amount as any,
    });
  }

  return { transaction: updatedTx ?? tx, alreadyProcessed: false };
}
