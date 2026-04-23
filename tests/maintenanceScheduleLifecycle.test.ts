import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  selectQueue,
  updateQueue,
  insertQueue,
  mockDb,
  mockStorage,
  mockNotifyMaintenanceReminder,
  mockNotifyMaintenanceVisitRescheduled,
  mockNotifyExpiringMaintenanceSubscriptionsSoon,
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
    updateAssetSubscription: vi.fn(),
    createMaintenanceSchedule: vi.fn(),
    getMaintenanceSchedule: vi.fn(),
    getAssetSubscription: vi.fn(),
    updateMaintenanceSchedule: vi.fn(),
  };
  return {
    selectQueue,
    updateQueue,
    insertQueue,
    mockDb,
    mockStorage,
    mockNotifyMaintenanceReminder: vi.fn(),
    mockNotifyMaintenanceVisitRescheduled: vi.fn(),
    mockNotifyExpiringMaintenanceSubscriptionsSoon: vi.fn(),
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

vi.mock("../server/services/maintenanceNotificationService", () => ({
  notifyMaintenanceReminder: mockNotifyMaintenanceReminder,
  notifyMaintenanceVisitRescheduled: mockNotifyMaintenanceVisitRescheduled,
  notifyExpiringMaintenanceSubscriptionsSoon: mockNotifyExpiringMaintenanceSubscriptionsSoon,
}));

import {
  ensureScheduleHorizonForSubscription,
  rescheduleMaintenanceVisit,
} from "../server/services/maintenanceScheduleService";

describe("maintenanceScheduleService lifecycle guards", () => {
  beforeEach(() => {
    selectQueue.length = 0;
    updateQueue.length = 0;
    insertQueue.length = 0;
    vi.clearAllMocks();
    mockNotifyExpiringMaintenanceSubscriptionsSoon.mockResolvedValue(0);
  });

  it("does not generate new schedules for subscriptions that have already expired", async () => {
    selectQueue.push(
      [
        {
          subscription: {
            id: "sub-1",
            status: "active",
            startDate: new Date("2026-01-01T09:00:00.000Z"),
            endDate: new Date("2026-02-01T09:00:00.000Z"),
            expiredAt: null,
          },
          plan: {
            id: "plan-1",
            name: "Monthly Care",
            durationType: "monthly",
            visitsIncluded: 1,
          },
          asset: { id: "asset-1" },
        },
      ],
      [],
      [],
    );
    mockStorage.updateAssetSubscription.mockResolvedValue({
      id: "sub-1",
      status: "expired",
    });

    const result = await ensureScheduleHorizonForSubscription("sub-1");

    expect(mockStorage.updateAssetSubscription).toHaveBeenCalledWith(
      "sub-1",
      expect.objectContaining({ status: "expired" }),
    );
    expect(mockStorage.createMaintenanceSchedule).not.toHaveBeenCalled();
    expect(Array.isArray(result)).toBe(true);
  });

  it("prevents duplicate schedule rows when the same horizon is generated again", async () => {
    const scheduledDate = new Date("2026-05-01T09:00:00.000Z");
    selectQueue.push(
      [
        {
          subscription: {
            id: "sub-1",
            status: "active",
            startDate: scheduledDate,
            endDate: new Date("2026-06-01T09:00:00.000Z"),
            expiredAt: null,
          },
          plan: {
            id: "plan-1",
            name: "Monthly Care",
            durationType: "monthly",
            visitsIncluded: 1,
          },
          asset: { id: "asset-1" },
        },
      ],
      [{ id: "sched-1", subscriptionId: "sub-1", scheduledDate }],
      [{ scheduledDate }],
      [{ id: "sched-1", subscriptionId: "sub-1", scheduledDate }],
    );
    mockStorage.updateAssetSubscription.mockResolvedValue({
      id: "sub-1",
      nextScheduleAt: scheduledDate,
    });

    const result = await ensureScheduleHorizonForSubscription("sub-1");

    expect(mockStorage.createMaintenanceSchedule).not.toHaveBeenCalled();
    expect(result).toHaveLength(1);
  });

  it("treats reschedule retries as idempotent and preserves reschedule tracking", async () => {
    const replacementDate = new Date("2026-06-01T10:00:00.000Z");
    mockStorage.getMaintenanceSchedule.mockResolvedValue({
      id: "sched-1",
      subscriptionId: "sub-1",
      scheduledDate: new Date("2026-05-01T10:00:00.000Z"),
      notes: "Original visit",
      status: "upcoming",
      skippedAt: null,
    });
    mockStorage.getAssetSubscription.mockResolvedValue({
      id: "sub-1",
      status: "active",
    });
    selectQueue.push(
      [
        {
          id: "sched-2",
          subscriptionId: "sub-1",
          scheduledDate: replacementDate,
          status: "upcoming",
        },
      ],
      [{ scheduledDate: replacementDate }],
    );
    mockStorage.updateMaintenanceSchedule.mockResolvedValue({
      id: "sched-1",
      status: "rescheduled",
    });
    mockStorage.updateAssetSubscription.mockResolvedValue({
      id: "sub-1",
      nextScheduleAt: replacementDate,
    });

    const result = await rescheduleMaintenanceVisit({
      scheduleId: "sched-1",
      scheduledDate: replacementDate,
    });

    expect(result).toMatchObject({ id: "sched-2" });
    expect(mockStorage.createMaintenanceSchedule).not.toHaveBeenCalled();
    expect(mockStorage.updateMaintenanceSchedule).toHaveBeenCalledWith(
      "sched-1",
      expect.objectContaining({
        status: "rescheduled",
        skippedAt: expect.any(Date),
      }),
    );
    expect(mockNotifyMaintenanceVisitRescheduled).not.toHaveBeenCalled();
  });
});
