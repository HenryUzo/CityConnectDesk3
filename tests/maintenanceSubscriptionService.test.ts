import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  selectQueue,
  updateQueue,
  insertQueue,
  mockDb,
  mockStorage,
  mockCreatePendingPaystackTransaction,
  mockEnsureScheduleHorizonForSubscription,
  mockSyncSubscriptionNextScheduleAt,
  mockNotifyMaintenanceSubscriptionActivated,
} = vi.hoisted(() => {
  const selectQueue: any[] = [];
  const updateQueue: any[] = [];
  const insertQueue: any[] = [];
  const mockDb = {
    select: vi.fn(),
    update: vi.fn(),
    insert: vi.fn(),
  };
  const mockStorage = {
    listAssetSubscriptionsByResident: vi.fn(),
    createAssetSubscription: vi.fn(),
    getTransactionByReference: vi.fn(),
    getAssetSubscription: vi.fn(),
    updateAssetSubscription: vi.fn(),
  };
  return {
    selectQueue,
    updateQueue,
    insertQueue,
    mockDb,
    mockStorage,
    mockCreatePendingPaystackTransaction: vi.fn(),
    mockEnsureScheduleHorizonForSubscription: vi.fn(),
    mockSyncSubscriptionNextScheduleAt: vi.fn(),
    mockNotifyMaintenanceSubscriptionActivated: vi.fn(),
  };
});

function createQueryBuilder(result: any) {
  const builder: any = {
    from: vi.fn(() => builder),
    innerJoin: vi.fn(() => builder),
    leftJoin: vi.fn(() => builder),
    where: vi.fn(() => builder),
    orderBy: vi.fn(() => builder),
    limit: vi.fn(() => Promise.resolve(result)),
    returning: vi.fn(() => Promise.resolve(result)),
    set: vi.fn(() => builder),
    values: vi.fn(() => builder),
    then: (resolve: any, reject: any) => Promise.resolve(result).then(resolve, reject),
  };
  return builder;
}

mockDb.select.mockImplementation(() => createQueryBuilder(selectQueue.shift() ?? []));
mockDb.update.mockImplementation(() => createQueryBuilder(updateQueue.shift() ?? []));
mockDb.insert.mockImplementation(() => createQueryBuilder(insertQueue.shift() ?? []));

vi.mock("../server/db", () => ({
  db: mockDb,
}));

vi.mock("../server/storage", () => ({
  storage: mockStorage,
}));

vi.mock("../server/payments", () => ({
  createPendingPaystackTransaction: mockCreatePendingPaystackTransaction,
}));

vi.mock("../server/services/maintenanceScheduleService", () => ({
  ensureScheduleHorizonForSubscription: mockEnsureScheduleHorizonForSubscription,
  syncSubscriptionNextScheduleAt: mockSyncSubscriptionNextScheduleAt,
}));

vi.mock("../server/services/maintenanceNotificationService", () => ({
  notifyMaintenanceSubscriptionActivated: mockNotifyMaintenanceSubscriptionActivated,
}));

import {
  activateMaintenanceSubscriptionFromReference,
  cancelMaintenanceSubscription,
  createMaintenanceSubscriptionCheckout,
  resumeMaintenanceSubscription,
} from "../server/services/maintenanceSubscriptionService";

describe("maintenanceSubscriptionService", () => {
  beforeEach(() => {
    selectQueue.length = 0;
    updateQueue.length = 0;
    insertQueue.length = 0;
    vi.clearAllMocks();
  });

  it("rejects subscription checkout for assets the resident does not own", async () => {
    selectQueue.push([]);
    mockStorage.listAssetSubscriptionsByResident.mockResolvedValue([]);

    await expect(
      createMaintenanceSubscriptionCheckout({
        residentId: "resident-1",
        residentAssetId: "asset-404",
        maintenancePlanId: "plan-1",
      }),
    ).rejects.toThrow("Asset or maintenance plan not found");

    expect(mockStorage.createAssetSubscription).not.toHaveBeenCalled();
  });

  it("rejects inactive maintenance plans during checkout", async () => {
    selectQueue.push([
      {
        asset: { id: "asset-1", userId: "resident-1", isActive: true },
        plan: {
          id: "plan-1",
          isActive: false,
          maintenanceItemId: "item-1",
          durationType: "monthly",
          price: "15000",
          currency: "NGN",
        },
        itemType: { id: "item-1", isActive: true },
        category: { id: "category-1", isActive: true },
      },
    ]);
    mockStorage.listAssetSubscriptionsByResident.mockResolvedValue([]);

    await expect(
      createMaintenanceSubscriptionCheckout({
        residentId: "resident-1",
        residentAssetId: "asset-1",
        maintenancePlanId: "plan-1",
      }),
    ).rejects.toThrow("not available for purchase");

    expect(mockCreatePendingPaystackTransaction).not.toHaveBeenCalled();
  });

  it("treats successful activation retries as idempotent when the subscription is already active", async () => {
    mockStorage.getTransactionByReference.mockResolvedValue({
      reference: "ref-1",
      meta: {
        kind: "maintenance_subscription_activation",
        subscriptionId: "sub-1",
      },
    });
    mockStorage.getAssetSubscription
      .mockResolvedValueOnce({
        id: "sub-1",
        status: "active",
        endDate: new Date("2026-12-31T00:00:00.000Z"),
        billingAmount: "10000",
      })
      .mockResolvedValueOnce({
        id: "sub-1",
        status: "active",
        endDate: new Date("2026-12-31T00:00:00.000Z"),
        billingAmount: "10000",
      });
    mockEnsureScheduleHorizonForSubscription.mockResolvedValue([]);
    mockSyncSubscriptionNextScheduleAt.mockResolvedValue(
      new Date("2026-05-01T09:00:00.000Z"),
    );

    const result = await activateMaintenanceSubscriptionFromReference("ref-1");

    expect(mockEnsureScheduleHorizonForSubscription).toHaveBeenCalledWith("sub-1");
    expect(mockSyncSubscriptionNextScheduleAt).toHaveBeenCalledWith("sub-1");
    expect(mockStorage.updateAssetSubscription).not.toHaveBeenCalled();
    expect(mockNotifyMaintenanceSubscriptionActivated).not.toHaveBeenCalled();
    expect(result).toMatchObject({ id: "sub-1", status: "active" });
  });

  it("marks past-end paused subscriptions as expired instead of resuming them", async () => {
    mockStorage.getAssetSubscription.mockResolvedValue({
      id: "sub-1",
      status: "paused",
      endDate: new Date("2020-01-01T00:00:00.000Z"),
      expiredAt: null,
    });
    mockStorage.updateAssetSubscription.mockResolvedValue({
      id: "sub-1",
      status: "expired",
      expiredAt: new Date(),
    });
    mockSyncSubscriptionNextScheduleAt.mockResolvedValue(null);

    await expect(resumeMaintenanceSubscription("sub-1")).rejects.toThrow(
      "already expired",
    );

    expect(mockStorage.updateAssetSubscription).toHaveBeenCalledWith(
      "sub-1",
      expect.objectContaining({ status: "expired" }),
    );
  });

  it("keeps cancellation idempotent when the subscription is already cancelled", async () => {
    mockStorage.getAssetSubscription.mockResolvedValue({
      id: "sub-1",
      status: "cancelled",
      cancelledAt: new Date("2026-02-01T00:00:00.000Z"),
    });

    const result = await cancelMaintenanceSubscription("sub-1");

    expect(result).toMatchObject({ id: "sub-1", status: "cancelled" });
    expect(mockDb.select).not.toHaveBeenCalled();
    expect(mockStorage.updateAssetSubscription).not.toHaveBeenCalled();
  });
});
