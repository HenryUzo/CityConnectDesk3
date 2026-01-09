import { describe, expect, it } from "vitest";
import {
  extractSlotsFromText,
  followupQuestionFor,
  isGreetingOrRandom,
  mergeSlots,
  nextMissingSlot,
} from "../citybuddyIntake";

describe("citybuddyIntake", () => {
  it("treats greetings as greeting/random", () => {
    expect(isGreetingOrRandom("Hi")).toBe(true);
  });

  it("extracts a location when present", () => {
    const slots = extractSlotsFromText("There is a leak in the kitchen sink");
    expect(slots.location?.toLowerCase()).toContain("kitchen");
  });

  it("extracts timing/urgency when present", () => {
    const slots = extractSlotsFromText("The gate alarm has been beeping since yesterday. It's urgent.");
    expect(slots.timingOrUrgency).toBeTruthy();
  });

  it("fills symptomOrNeed for non-trivial messages", () => {
    const slots = extractSlotsFromText("My bathroom tap is leaking constantly");
    expect(slots.symptomOrNeed).toContain("bathroom");
  });

  it("chooses next missing slot in correct order", () => {
    expect(nextMissingSlot({})).toBe("location");
    expect(nextMissingSlot({ location: "kitchen" })).toBe("symptomOrNeed");
    expect(nextMissingSlot({ location: "kitchen", symptomOrNeed: "leak" })).toBe("timingOrUrgency");
    expect(nextMissingSlot({ location: "kitchen", symptomOrNeed: "leak", timingOrUrgency: "today" })).toBe(null);
  });

  it("merges slots without deleting existing", () => {
    const merged = mergeSlots(
      { location: "kitchen" },
      { timingOrUrgency: "today" }
    );
    expect(merged.location).toBe("kitchen");
    expect(merged.timingOrUrgency).toBe("today");
  });

  it("asks a short follow-up question", () => {
    expect(followupQuestionFor("location")).toMatch(/Which area/i);
  });
});
