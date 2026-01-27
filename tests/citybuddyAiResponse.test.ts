import { describe, expect, it } from "vitest";
import { parseCityBuddyAiResponse } from "../client/src/lib/citybuddy-gemini";
import { classifyCityBuddySituation } from "../client/src/components/resident/citybuddySituation";

describe("CityBuddy AI response JSON", () => {
  it("parses strict JSON and preserves steps", () => {
    const raw = JSON.stringify({
      intent: "guide",
      message: "Try resetting the breaker once.",
      steps: ["Turn off the main switch", "Wait 30 seconds", "Turn it back on"],
    });
    const parsed = parseCityBuddyAiResponse(raw);
    expect(parsed.intent).toBe("guide");
    expect(parsed.message).toContain("Try");
    expect(parsed.steps?.length).toBe(3);
  });

  it("extracts JSON object when model includes extra text", () => {
    const raw =
      "Sure! Here you go:\n" +
      JSON.stringify({ intent: "guide", message: "Check the tap for a loose handle." });
    const parsed = parseCityBuddyAiResponse(raw);
    expect(parsed.intent).toBe("guide");
    expect(parsed.message.toLowerCase()).toContain("tap");
  });

  it("only allows followUpQuestion when intent is clarify", () => {
    const raw = JSON.stringify({
      intent: "guide",
      message: "Clean the filter and retry.",
      followUpQuestion: "What model is it?",
    });
    const parsed = parseCityBuddyAiResponse(raw);
    expect(parsed.intent).toBe("guide");
    expect(parsed.followUpQuestion).toBeUndefined();
  });

  it("sanitizes section-like prefixes in message", () => {
    const raw = JSON.stringify({
      intent: "guide",
      message: "Recommended approach: Try turning it off and on.",
    });
    const parsed = parseCityBuddyAiResponse(raw);
    expect(parsed.message.toLowerCase()).not.toContain("recommended approach");
  });
});

describe("CityBuddy situation classifier", () => {
  it("flags high risk for sparks/fire words", () => {
    const s = classifyCityBuddySituation({
      categoryId: "electrician",
      description: "There are sparks and a burning smell near the socket.",
    });
    expect(s.risk).toBe("high");
    expect(s.diySafe).toBe(false);
  });

  it("marks higher clarity for longer descriptions", () => {
    const s = classifyCityBuddySituation({
      categoryId: "plumbing",
      description:
        "Kitchen sink is leaking under the cabinet only when the tap is running. Started yesterday, gets worse when water pressure is high.",
    });
    expect(["medium", "high"]).toContain(s.clarity);
  });
});
