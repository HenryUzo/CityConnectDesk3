import { PaystackVerifyResponse, verifyPaystackTransaction } from "./paystack";
import type { IStorage } from "./storage";
import { TransactionStatus } from "@prisma/client";
import type { Transaction as PrismaTransaction } from "@prisma/client";
import { Prisma } from "@prisma/client";

export type PaystackVerifyStorage = Pick<
  IStorage,
  "getTransactionByReference" | "updateTransactionByReference" | "updateServiceRequest"
>;

export type PaystackVerifyResult = {
  status: "success" | "failed";
  alreadyProcessed: boolean;
};

export async function handlePaystackVerify({
  reference,
  storage,
  verifyFn = verifyPaystackTransaction,
  transaction,
}: {
  reference: string;
  storage: PaystackVerifyStorage;
  verifyFn?: (ref: string) => Promise<PaystackVerifyResponse>;
  transaction?: PrismaTransaction | null;
}): Promise<PaystackVerifyResult> {
  if (!reference) return { status: "failed", alreadyProcessed: false };
  const tx = transaction || (await storage.getTransactionByReference(reference));
  if (!tx) {
    return { status: "failed", alreadyProcessed: false };
  }
  if (tx.status === TransactionStatus.COMPLETED) {
    return { status: "success", alreadyProcessed: true };
  }

  const verification = await verifyFn(reference);
  const charge = verification.data;
  if (!verification.status || charge?.status !== "success" || charge?.currency !== "NGN") {
    return { status: "failed", alreadyProcessed: false };
  }

  const amountFromGateway = typeof charge.amount === "number" ? charge.amount / 100 : null;
  const expectedAmount = Number(tx.amount);
  if (amountFromGateway === null || Number.isNaN(amountFromGateway)) {
    return { status: "failed", alreadyProcessed: false };
  }
  if (Math.abs(amountFromGateway - expectedAmount) > 0.001) {
    return { status: "failed", alreadyProcessed: false };
  }

  await storage.updateTransactionByReference(reference, {
    status: TransactionStatus.COMPLETED,
    description: `Paystack ${charge.channel || "charge"}`,
    meta: {
      ...((tx.meta as Prisma.JsonObject) || {}),
      paystack: charge as any,
    } as Prisma.InputJsonObject,
  });

  if (tx.serviceRequestId) {
    await storage.updateServiceRequest(tx.serviceRequestId, {
      paymentStatus: "paid",
      billedAmount: tx.amount as any,
    });
  }

  return { status: "success", alreadyProcessed: false };
}

export type PaystackWebhookStorage = Pick<
  IStorage,
  | "createAuditLog"
  | "getTransactionByReference"
  | "updateTransactionByReference"
  | "updateServiceRequest"
>;

export type PaystackWebhookResult = {
  statusCode: number;
  body: { received: boolean };
};

export async function handlePaystackWebhook({
  rawBody,
  signature,
  storage,
  validateSignature,
  logger = console,
}: {
  rawBody: Buffer;
  signature?: string;
  storage: PaystackWebhookStorage;
  validateSignature: (body: Buffer, signature?: string) => boolean;
  logger?: Console;
}): Promise<PaystackWebhookResult> {
  if (!validateSignature(rawBody, signature)) {
    return { statusCode: 401, body: { received: false } };
  }

  try {
    const payload = JSON.parse(rawBody.toString("utf8"));
    const event = payload?.event;
    const data: {
      reference?: string;
      amount?: number;
      currency?: string;
      channel?: string;
      status?: string;
    } = payload?.data || {};
    const reference = data.reference;

    await storage.createAuditLog({
      actorId: "system",
      estateId: null,
      action: "paystack:webhook",
      target: "transaction",
      targetId: reference || "unknown",
      meta: {
        event,
        reference,
        receivedAt: new Date().toISOString(),
      },
      ipAddress: "webhook",
      userAgent: "paystack-webhook",
    });

    if (event !== "charge.success" || !reference) {
      return { statusCode: 200, body: { received: true } };
    }

    const tx = await storage.getTransactionByReference(reference);
    if (!tx) {
      logger.warn?.("Paystack webhook: transaction not found", reference);
      return { statusCode: 200, body: { received: true } };
    }

    if (tx.status === TransactionStatus.COMPLETED) {
      return { statusCode: 200, body: { received: true } };
    }

    const amountFromGateway = typeof data.amount === "number" ? data.amount / 100 : null;
    if (
      data.currency !== "NGN" ||
      amountFromGateway === null ||
      Math.abs(amountFromGateway - Number(tx.amount)) > 0.001
    ) {
      return { statusCode: 200, body: { received: true } };
    }

    await storage.updateTransactionByReference(reference, {
      status: TransactionStatus.COMPLETED,
      description: `Paystack webhook ${data.channel || "charge"}`,
      meta: {
        ...(tx.meta as Record<string, unknown>),
        paystackWebhook: data,
      },
    });

    if (tx.serviceRequestId) {
      await storage.updateServiceRequest(tx.serviceRequestId, {
        paymentStatus: "paid",
        billedAmount: tx.amount as any,
      });
    }
  } catch (error: any) {
    logger.error?.("Paystack webhook handler failed", { message: error?.message });
  }

  return { statusCode: 200, body: { received: true } };
}
