import { describe, expect, it } from "vitest";
import {
  calculateSubscriptionEndDate,
  distributeVisitsAcrossTerm,
  durationToMonths,
  generateScheduleDates,
  shouldMarkScheduleDue,
} from "../server/services/maintenanceScheduleMath";
import { getMaintenanceProviderReminderMilestonesForWindow } from "../server/services/maintenanceReminderMath";

describe("maintenanceScheduleService", () => {
  it("maps supported durations to the expected month interval", () => {
    expect(durationToMonths("monthly")).toBe(1);
    expect(durationToMonths("quarterly_3m")).toBe(3);
    expect(durationToMonths("halfyearly_6m")).toBe(6);
    expect(durationToMonths("yearly")).toBe(12);
  });

  it("calculates the subscription end date from the plan term", () => {
    expect(
      calculateSubscriptionEndDate({
        startDate: new Date("2026-01-05T09:00:00.000Z"),
        duration: "monthly",
      }).toISOString(),
    ).toBe("2026-02-05T09:00:00.000Z");

    expect(
      calculateSubscriptionEndDate({
        startDate: new Date("2026-01-05T09:00:00.000Z"),
        duration: "yearly",
      }).toISOString(),
    ).toBe("2027-01-05T09:00:00.000Z");
  });

  it("spreads visits predictably across the plan term", () => {
    const dates = distributeVisitsAcrossTerm({
      startDate: new Date("2026-01-01T09:00:00.000Z"),
      endDate: new Date("2027-01-01T09:00:00.000Z"),
      visitsIncluded: 4,
    });

    expect(dates.map((date) => date.toISOString())).toEqual([
      "2026-01-01T09:00:00.000Z",
      "2026-04-02T15:00:00.000Z",
      "2026-07-02T21:00:00.000Z",
      "2026-10-02T03:00:00.000Z",
    ]);
  });

  it("generates one schedule for a one-month plan with one included visit", () => {
    const dates = generateScheduleDates({
      startDate: new Date("2026-01-05T09:00:00.000Z"),
      duration: "monthly",
      visitsIncluded: 1,
    });

    expect(dates.map((date) => date.toISOString())).toEqual([
      "2026-01-05T09:00:00.000Z",
    ]);
  });

  it("generates quarterly-term dates using visitsIncluded as the source of truth", () => {
    const dates = generateScheduleDates({
      startDate: new Date("2026-01-15T08:30:00.000Z"),
      duration: "quarterly_3m",
      visitsIncluded: 3,
    });

    expect(dates.map((date) => date.toISOString())).toEqual([
      "2026-01-15T08:30:00.000Z",
      "2026-02-14T08:30:00.000Z",
      "2026-03-16T08:30:00.000Z",
    ]);
  });

  it("keeps generated dates unique when many visits fall within the same term", () => {
    const dates = generateScheduleDates({
      startDate: new Date("2026-01-01T00:00:00.000Z"),
      duration: "monthly",
      visitsIncluded: 12,
    });

    expect(new Set(dates.map((date) => date.toISOString())).size).toBe(dates.length);
    expect(dates).toHaveLength(12);
  });

  it("marks schedules due when they enter the configured lead window", () => {
    expect(
      shouldMarkScheduleDue({
        scheduledFor: new Date("2026-04-10T09:00:00.000Z"),
        leadDays: 3,
        now: new Date("2026-04-07T09:00:00.000Z"),
      }),
    ).toBe(true);

    expect(
      shouldMarkScheduleDue({
        scheduledFor: new Date("2026-04-10T09:00:00.000Z"),
        leadDays: 3,
        now: new Date("2026-04-06T09:00:00.000Z"),
      }),
    ).toBe(false);
  });

  it("emits only the reminder milestone whose checkpoint was crossed in the current sweep window", () => {
    const milestones = getMaintenanceProviderReminderMilestonesForWindow({
      scheduledDate: new Date("2026-04-10T09:00:00.000Z"),
      now: new Date("2026-04-10T08:30:00.000Z"),
      windowMs: 65 * 60 * 1000,
    });

    expect(milestones.map((milestone) => milestone.key)).toEqual(["1h"]);
  });

  it("picks up the daily reminder when its threshold is crossed", () => {
    const milestones = getMaintenanceProviderReminderMilestonesForWindow({
      scheduledDate: new Date("2026-04-10T09:00:00.000Z"),
      now: new Date("2026-04-09T09:15:00.000Z"),
      windowMs: 65 * 60 * 1000,
    });

    expect(milestones.map((milestone) => milestone.key)).toEqual(["1d"]);
  });
});
