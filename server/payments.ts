import { nanoid } from "nanoid";
import type { Wallet } from "@shared/schema";
import { storage } from "./storage";
import { verifyPaystackTransaction } from "./paystack";

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
    serviceRequestId: args.serviceRequestId,
    amount: amountFormatted,
    type: "debit",
    status: "pending",
    description: args.description ?? "Service payment",
    reference,
    meta: {
      ...(args.meta || {}),
    },
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
  if (tx.status === "completed") {
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

  const updatedTx = await storage.updateTransactionByReference(reference, {
    status: "completed",
    description: `Paystack ${charge.channel || "charge"}`,
    meta: {
      ...(tx.meta as Record<string, unknown>),
      paystack: charge,
    },
  });

  if (tx.serviceRequestId) {
    await storage.updateServiceRequest(tx.serviceRequestId, {
      paymentStatus: "paid",
      billedAmount: tx.amount as any,
    });
  }

  return { transaction: updatedTx ?? tx, alreadyProcessed: false };
}
