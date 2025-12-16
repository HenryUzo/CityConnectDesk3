import type { DiagnosisInput } from "../index";
import type { AiDiagnosis } from "../schema";

export async function diagnose(_input: DiagnosisInput & { model?: string }): Promise<AiDiagnosis> {
  throw new Error("Gemini provider not configured");
}