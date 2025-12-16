import { z } from "zod";

export const AIDiagnosisResponseSchema = z.object({
  summary: z.string(),
  probableCauses: z
    .array(
      z.object({
        cause: z.string(),
        likelihood: z.enum(["low", "medium", "high"]),
      })
    )
    .default([]),
  severity: z.enum(["low", "medium", "high", "critical"]),
  shouldAvoidDIY: z.boolean(),
  safetyNotes: z.array(z.string()).default([]),
  suggestedChecks: z.array(z.string()).default([]),
  whenToCallPro: z.string(),
  suggestedCategory: z.string().nullable(),
});

export type AiDiagnosis = z.infer<typeof AIDiagnosisResponseSchema>;