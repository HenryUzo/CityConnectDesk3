export function formatCurrency(value: unknown, currency = "NGN") {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return `${currency} 0`;
  return `${currency} ${amount.toLocaleString()}`;
}

export function formatDateTime(value: unknown) {
  if (!value) return "Not available";
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return "Not available";
  return date.toLocaleString();
}

export function formatDate(value: unknown) {
  if (!value) return "Not available";
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return "Not available";
  return date.toLocaleDateString();
}

export function summarizeText(value: unknown, max = 120) {
  const text = String(value || "").trim();
  if (text.length <= max) return text;
  return `${text.slice(0, Math.max(0, max - 3))}...`;
}
