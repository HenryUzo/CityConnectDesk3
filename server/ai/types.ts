export type DiagnosisInput = {
  category: string;
  description: string;
  urgency?: "low" | "medium" | "high" | "emergency";
  specialInstructions?: string;
};
