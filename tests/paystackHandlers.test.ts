import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  handlePaystackVerify,
  handlePaystackWebhook,
  PaystackVerifyResult,
} from "../server/paystackHandlers";

const createStorageMocks = () => ({
  getTransactionByReference: vi.fn(),
  updateTransactionByReference: vi.fn().mockResolvedValue(undefined),
  updateServiceRequest: vi.fn().mockResolvedValue(undefined),
  createAuditLog: vi.fn().mockResolvedValue(undefined),
});

describe("handlePaystackVerify", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns success when Paystack responds successfully and amounts match", async () => {
    const storage = createStorageMocks();
    storage.getTransactionByReference.mockResolvedValue({
      id: "tx1",
      amount: "1000",
      status: "pending",
      meta: {},
      serviceRequestId: "req1",
    });

    const result = await handlePaystackVerify({
      reference: "ref-1",
      storage: storage as any,
      verifyFn: vi.fn().mockResolvedValue({
        status: true,
        data: {
          status: "success",
          amount: 100000,
          currency: "NGN",
          reference: "ref-1",
        },
      }),
    });

    expect(result.status).toBe("success");
    expect(result.alreadyProcessed).toBe(false);
    expect(storage.updateTransactionByReference).toHaveBeenCalled();
    expect(storage.updateServiceRequest).toHaveBeenCalled();
  });

  it("is idempotent when transaction already completed", async () => {
    const storage = createStorageMocks();
    storage.getTransactionByReference.mockResolvedValue({
      id: "tx1",
      amount: "1000",
      status: "completed",
      meta: {},
      serviceRequestId: "req1",
    });

    const result = await handlePaystackVerify({
      reference: "ref-1",
      storage: storage as any,
    });

    expect(result.status).toBe("success");
    expect(result.alreadyProcessed).toBe(true);
    expect(storage.updateTransactionByReference).not.toHaveBeenCalled();
  });

  it("fails when currency or amount mismatch", async () => {
    const storage = createStorageMocks();
    storage.getTransactionByReference.mockResolvedValue({
      id: "tx1",
      amount: "1000",
      status: "pending",
      meta: {},
      serviceRequestId: "req1",
    });

    const result = await handlePaystackVerify({
      reference: "ref-1",
      storage: storage as any,
      verifyFn: vi.fn().mockResolvedValue({
        status: true,
        data: {
          status: "success",
          amount: 200000,
          currency: "USD",
          reference: "ref-1",
        },
      }),
    });

    expect(result.status).toBe("failed");
    expect(result.alreadyProcessed).toBe(false);
    expect(storage.updateTransactionByReference).not.toHaveBeenCalled();
  });
});

describe("handlePaystackWebhook", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("rejects invalid signatures", async () => {
    const storage = createStorageMocks();
    const result = await handlePaystackWebhook({
      rawBody: Buffer.from(""),
      signature: "invalid",
      storage: storage as any,
      validateSignature: () => false,
    });
    expect(result.statusCode).toBe(401);
    expect(result.body.received).toBe(false);
    expect(storage.createAuditLog).not.toHaveBeenCalled();
  });

  it("acknowledges charge.success without reference", async () => {
    const storage = createStorageMocks();
    const payload = Buffer.from(JSON.stringify({ event: "charge.success", data: {} }));
    const result = await handlePaystackWebhook({
      rawBody: payload,
      signature: "ok",
      storage: storage as any,
      validateSignature: () => true,
    });
    expect(result.statusCode).toBe(200);
    expect(result.body.received).toBe(true);
    expect(storage.createAuditLog).toHaveBeenCalled();
  });

  it("ignores webhook if amount/currency mismatch", async () => {
    const storage = createStorageMocks();
    storage.getTransactionByReference.mockResolvedValue({
      id: "tx1",
      amount: "1000",
      status: "pending",
      meta: {},
      serviceRequestId: "req1",
    });

    const payload = Buffer.from(
      JSON.stringify({
        event: "charge.success",
        data: {
          reference: "ref-1",
          amount: 200000,
          currency: "USD",
          channel: "card",
        },
      }),
    );

    const result = await handlePaystackWebhook({
      rawBody: payload,
      signature: "ok",
      storage: storage as any,
      validateSignature: () => true,
      logger: { warn: vi.fn(), error: vi.fn() } as any,
    });

    expect(result.statusCode).toBe(200);
    expect(storage.updateTransactionByReference).not.toHaveBeenCalled();
  });

  it("updates payment on matching charge.success", async () => {
    const storage = createStorageMocks();
    storage.getTransactionByReference.mockResolvedValue({
      id: "tx1",
      amount: "1000",
      status: "pending",
      meta: {},
      serviceRequestId: "req1",
    });

    const payload = Buffer.from(
      JSON.stringify({
        event: "charge.success",
        data: {
          reference: "ref-1",
          amount: 100000,
          currency: "NGN",
          channel: "card",
        },
      }),
    );

    const result = await handlePaystackWebhook({
      rawBody: payload,
      signature: "ok",
      storage: storage as any,
      validateSignature: () => true,
      logger: { warn: vi.fn(), error: vi.fn() } as any,
    });

    expect(result.statusCode).toBe(200);
    expect(storage.updateTransactionByReference).toHaveBeenCalled();
    expect(storage.updateServiceRequest).toHaveBeenCalled();
  });
});
