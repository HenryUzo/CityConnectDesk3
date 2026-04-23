import { DynamicFlowQuestion, RequestCategory } from "../../api/contracts";

export function getCategoryKey(category: RequestCategory) {
  return String(category.categoryKey || category.id);
}

export function getCategoryLabel(category: RequestCategory) {
  return category.name || category.label || category.categoryKey || "Category";
}

export function getCategoryEmoji(category: RequestCategory) {
  return category.emoji || "*";
}

export function summarizeAnswer(value: unknown): string {
  if (value === null || value === undefined) return "No answer recorded";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (Array.isArray(value)) {
    const parts = value.map((item) => summarizeAnswer(item)).filter(Boolean);
    return parts.join(", ");
  }
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    const preferredKeys = ["text", "label", "value", "optionKey", "location", "date", "time"];
    for (const key of preferredKeys) {
      const candidate = record[key];
      if (candidate !== undefined && candidate !== null && String(candidate).trim()) {
        return summarizeAnswer(candidate);
      }
    }
    const plainValues = Object.values(record)
      .filter((candidate) => candidate !== undefined && candidate !== null && String(candidate).trim())
      .map((candidate) => summarizeAnswer(candidate));
    return plainValues.join(", ") || "Structured answer saved";
  }

  return String(value);
}

export function summarizeQuestionAnswer(question: DynamicFlowQuestion, answers?: Record<string, unknown>) {
  const answer = question.answer ?? answers?.[question.questionKey];
  return summarizeAnswer(answer);
}

export function getTypingLabel(
  typingState: Record<string, unknown> | null | undefined,
  viewerRole: "resident" | "provider" | "admin" = "resident",
) {
  if (!typingState) return "";

  const candidates: Array<{ key: "resident" | "provider" | "admin"; label: string }> = [
    { key: "provider", label: "Provider is typing..." },
    { key: "admin", label: "Support team is typing..." },
    { key: "resident", label: "Resident is typing..." },
  ];

  for (const candidate of candidates) {
    if (candidate.key === viewerRole) continue;
    if (typingState[candidate.key]) return candidate.label;
  }

  return "";
}
