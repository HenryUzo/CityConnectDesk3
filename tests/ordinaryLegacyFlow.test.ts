import { describe, expect, it } from "vitest";

import { buildEditableLegacyQuestions } from "../client/src/lib/ordinaryLegacyFlow";

describe("buildEditableLegacyQuestions", () => {
  it("maps legacy aliases and suppresses obsolete extra questions", () => {
    const questions = buildEditableLegacyQuestions({
      categoryKey: "general_repairs",
      categoryName: "General Repairs",
      ordinaryQuestions: [
        {
          mode: "ordinary",
          scope: "global",
          key: "estate",
          label: "Legacy estate question",
          type: "estate",
          required: true,
          order: 1,
          isEnabled: true,
        },
        {
          mode: "ordinary",
          scope: "global",
          key: "inspectionDate",
          label: "When should we schedule the inspection?",
          type: "datetime",
          required: true,
          order: 2,
          isEnabled: true,
        },
        {
          mode: "ordinary",
          scope: "global",
          key: "urgency",
          label: "How urgent is this?",
          type: "urgency",
          required: true,
          order: 3,
          isEnabled: true,
        },
        {
          mode: "ordinary",
          scope: "global",
          key: "images",
          label: "Upload images",
          type: "multi_image",
          required: false,
          order: 4,
          isEnabled: true,
        },
      ],
    });

    const keys = questions.map((question) => question.key);
    expect(keys).toContain("location");
    expect(keys).toContain("photos");
    expect(keys).toContain("urgency");
    expect(keys).not.toContain("estate");
    expect(keys).not.toContain("images");
    expect(keys).not.toContain("inspectionDate");
    expect(keys.indexOf("location")).toBeLessThan(keys.indexOf("urgency"));
  });
});
