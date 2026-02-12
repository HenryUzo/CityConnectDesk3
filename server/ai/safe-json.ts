export function safeParseJsonFromText(raw: string) {
  const first = raw.indexOf("{");
  const last = raw.lastIndexOf("}");
  if (first === -1 || last === -1 || last <= first) {
    throw new Error("Model did not return JSON.");
  }
  const jsonStr = raw.slice(first, last + 1);
  return JSON.parse(jsonStr);
}
