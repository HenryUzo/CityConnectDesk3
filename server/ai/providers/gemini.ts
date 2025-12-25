import type { DiagnosisInput } from "../types";
import type { AiDiagnosis } from "../schema";
import { runDiagnosis } from "../diagnose";

export async function diagnose(input: DiagnosisInput & { model?: string }): Promise<AiDiagnosis> {
  return runDiagnosis(input);
}
