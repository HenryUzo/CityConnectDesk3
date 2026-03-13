import { nanoid } from "nanoid";
import { TransactionStatus, TransactionType } from "@prisma/client";
import type { Wallet } from "@prisma/client";
import { storage } from "./storage";
import { verifyPaystackTransaction } from "./paystack";
import { Prisma } from "@prisma/client";
import { normalizeCategoryKey, resolveServiceRequestCategory } from "./serviceCategoryResolver";

type CreatePendingTxArgs = {
  userId: string;
  amount: number;
  description?: string;
  serviceRequestId?: string;
  meta?: Record<string, unknown>;
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

async function ensureConsultancyServiceRequest(params: {
  userId: string;
  txMeta?: Prisma.JsonValue | null;
}) {
  const meta = (params.txMeta as any) || {};
  const consultancy = meta?.consultancyRequest;
  if (!consultancy || typeof consultancy !== "object") return null;

  const category = resolveServiceRequestCategory(consultancy.categoryKey || "", consultancy.categoryLabel || "");
  const urgencyInput = normalizeCategoryKey(consultancy.urgency || "");
  const urgency =
    urgencyInput === "emergency" ||
    urgencyInput === "high" ||
    urgencyInput === "medium" ||
    urgencyInput === "low"
      ? urgencyInput
      : "medium";
  const location = String(consultancy.location || "Not specified");
  const description =
    String(consultancy.description || "Consultancy request").trim() ||
    "Consultancy request";

  const created = await storage.createServiceRequest({
    category: category as any,
    categoryLabel:
      String(consultancy.categoryLabel || "").trim() ||
      category.replace(/_/g, " "),
    description,
    residentId: params.userId,
    budget: "Consultancy",
    urgency: urgency as any,
    issueType: String((consultancy as any).issueType || "").trim() || null,
    areaAffected: String((consultancy as any).areaAffected || "").trim() || null,
    quantityLabel: String((consultancy as any).quantityLabel || "").trim() || null,
    timeWindowLabel: String((consultancy as any).timeWindowLabel || "").trim() || null,
    location,
    addressLine: String((consultancy as any).addressLine || location).trim() || location,
    estateName: String((consultancy as any).estateName || "").trim() || null,
    stateName: String((consultancy as any).stateName || "").trim() || null,
    lgaName: String((consultancy as any).lgaName || "").trim() || null,
    specialInstructions: String((consultancy as any).notes || "").trim() || null,
    photosCount: Number((consultancy as any).attachmentsCount || 0) || 0,
    paymentPurpose: "Consultancy / inspection",
    status: "pending_inspection" as any,
    paymentStatus: "pending",
  } as any);

  return created?.id ?? null;
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
