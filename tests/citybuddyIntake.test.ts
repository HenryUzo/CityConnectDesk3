import { describe, expect, it } from "vitest";
import {
  extractSlotsFromText,
  followupQuestionFor,
  isGreetingOrRandom,
  isUrgentOrDistressed,
  mergeSlots,
  nextMissingSlot,
} from "../client/src/components/resident/citybuddyIntake";

describe("CityBuddy intake slot filling", () => {
  it("treats greetings as random", () => {
    expect(isGreetingOrRandom("Hi"))
      .toBe(true);
    expect(isGreetingOrRandom("thanks"))
      .toBe(true);
  });

  it("extracts location, symptom, timing when present", () => {
    const slots = extractSlotsFromText(
      "There is a leak in the kitchen sink since yesterday and it's urgent"
    );
    expect(slots.location?.toLowerCase()).toContain("kitchen");
    expect(slots.symptomOrNeed?.toLowerCase()).toContain("leak");
    expect(slots.timingOrUrgency).toBeTruthy();
  });

  it("detects urgent/distressed messages", () => {
    expect(isUrgentOrDistressed("I am stuck"))
      .toBe(true);
    expect(isUrgentOrDistressed("Emergency please help"))
      .toBe(true);
    expect(isUrgentOrDistressed("Can't move my car"))
      .toBe(true);
    expect(isUrgentOrDistressed("Just checking"))
      .toBe(false);
  });

  it("asks one next question in the right order", () => {
    const s0 = {};
    expect(nextMissingSlot(s0)).toBe("location");

    const s1 = { location: "kitchen" };
    expect(nextMissingSlot(s1)).toBe("symptomOrNeed");

    const s2 = { location: "kitchen", symptomOrNeed: "leak" };
    expect(nextMissingSlot(s2)).toBe("timingOrUrgency");

    const s3 = { location: "kitchen", symptomOrNeed: "leak", timingOrUrgency: "today" };
    expect(nextMissingSlot(s3)).toBe(null);
  });

  it("mergeSlots keeps existing values", () => {
    const merged = mergeSlots({ location: "gate" }, { timingOrUrgency: "today" });
    expect(merged.location).toBe("gate");
    expect(merged.timingOrUrgency).toBe("today");
  });

  it("followup questions are short", () => {
    expect(followupQuestionFor("location")).toMatch(/Which area/i);
    expect(followupQuestionFor("symptomOrNeed")).toMatch(/What exactly/i);
    expect(followupQuestionFor("timingOrUrgency")).toMatch(/When did it start/i);
  });
});
