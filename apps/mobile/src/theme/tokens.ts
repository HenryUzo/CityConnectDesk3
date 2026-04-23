export const tokens = {
  color: {
    background: "#FAFAF7",
    surface: "#FFFFFF",
    surfaceMuted: "#F3F5F1",
    text: "#101828",
    textMuted: "#667085",
    border: "#E7EAE3",
    primary: "#027A48",
    primaryPressed: "#05603A",
    primarySoft: "#ECFDF3",
    accent: "#1570EF",
    accentSoft: "#EFF8FF",
    warning: "#B54708",
    warningSoft: "#FFF7ED",
    danger: "#D92D20",
    dangerSoft: "#FEF3F2",
    success: "#12B76A",
    providerShell: "#052E2B",
    residentShell: "#F0FDF4",
  },
  spacing: {
    xxs: 4,
    xs: 8,
    sm: 12,
    md: 16,
    lg: 20,
    xl: 24,
    xxl: 32,
  },
  radius: {
    sm: 12,
    md: 16,
    lg: 24,
    pill: 999,
  },
  type: {
    caption: 12,
    body: 15,
    bodyLarge: 17,
    title: 22,
    heading: 30,
  },
  shadow: {
    card: {
      shadowColor: "transparent",
      shadowOpacity: 0,
      shadowRadius: 0,
      shadowOffset: { width: 0, height: 0 },
      elevation: 0,
    },
  },
} as const;

export const requestStatusMeta: Record<string, { label: string; tone: string }> = {
  pending: { label: "Pending", tone: "warning" },
  pending_inspection: { label: "Pending inspection", tone: "warning" },
  assigned: { label: "Assigned", tone: "accent" },
  assigned_for_job: { label: "Approved for job", tone: "accent" },
  in_progress: { label: "In progress", tone: "accent" },
  work_completed_pending_resident: { label: "Awaiting confirmation", tone: "success" },
  completed: { label: "Completed", tone: "success" },
  disputed: { label: "Disputed", tone: "danger" },
  rework_required: { label: "Rework required", tone: "danger" },
  cancelled: { label: "Cancelled", tone: "danger" },
};

export function getStatusMeta(status?: string | null) {
  const key = String(status || "").trim().toLowerCase();
  return requestStatusMeta[key] || {
    label: key ? key.replace(/_/g, " ") : "Unknown",
    tone: "neutral",
  };
}
