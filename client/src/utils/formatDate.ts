export default function formatDate(d?: string | Date | null) {
  if (!d) return "—";
  try {
    const date = typeof d === "string" ? new Date(d) : d as Date;
    if (Number.isNaN((date as Date).getTime())) return "—";
    return (date as Date).toLocaleString(undefined, { timeZoneName: "short" });
  } catch (e) {
    return "—";
  }
}
