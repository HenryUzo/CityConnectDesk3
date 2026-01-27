import { z } from "zod";
import { AIDiagnosisResponseSchema } from "./schema";
import type { DiagnosisInput } from "./types";
import { db } from "../db";
import { appSettings } from "@shared/schema";
import { eq, sql } from "drizzle-orm";

export type { DiagnosisInput } from "./types";

export type AiDiagnosis = z.infer<typeof AIDiagnosisResponseSchema>;

type Provider = "openai" | "ollama" | "gemini";

const DEFAULT_GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-1.5-flash";

let activeProvider: Provider = (process.env.AI_PROVIDER as Provider) || "openai";
let activeModel: string =
  activeProvider === "gemini" ? DEFAULT_GEMINI_MODEL : process.env.OPENAI_DIAGNOSIS_MODEL || "gpt-5.2-codex";
let loadedFromDb = false;

async function ensureLoaded() {
  if (loadedFromDb) return;
  try {
    const rows = await db.select().from(appSettings).where(eq(appSettings.key, "ai_provider"));
    if (rows && rows[0]) {
      const v: any = rows[0].value || {};
      if (v.provider) activeProvider = v.provider as Provider;
      if (v.model) {
        activeModel = String(v.model);
      } else if (activeProvider === "gemini") {
        activeModel = DEFAULT_GEMINI_MODEL;
      }
    }
    loadedFromDb = true;
  } catch {
    // ignore DB errors; fall back to env values
  }
}

export async function getActiveProvider() {
  await ensureLoaded();
  return { provider: activeProvider, model: activeModel };
}

export async function setActiveProvider(provider: Provider, model?: string) {
  activeProvider = provider;
  if (model) {
    activeModel = model;
  } else if (provider === "gemini") {
    activeModel = DEFAULT_GEMINI_MODEL;
  }
  try {
    // Ensure table exists (best-effort)
    await db.execute(sql`CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value JSONB NOT NULL DEFAULT '{}'::jsonb,
      updated_at TIMESTAMP DEFAULT NOW()
    )`);
    const value = { provider: activeProvider, model: activeModel } as any;
    const rows = await db.select().from(appSettings).where(eq(appSettings.key, "ai_provider"));
    if (rows && rows[0]) {
      await db.update(appSettings).set({ value, updatedAt: new Date() }).where(eq(appSettings.key, "ai_provider"));
    } else {
      await db.insert(appSettings).values({ key: "ai_provider", value });
    }
    loadedFromDb = true;
  } catch {
    // swallow errors, keep in-memory values
  }
}

export async function diagnose(input: DiagnosisInput): Promise<AiDiagnosis> {
  switch (activeProvider) {
    case "openai": {
      const { diagnose } = await import("./providers/openai");
      const out = await diagnose({ ...input, model: activeModel });
      return AIDiagnosisResponseSchema.parse(out);
    }
    case "ollama": {
      const { diagnose } = await import("./providers/ollama");
      const out = await diagnose({ ...input, model: activeModel });
      return AIDiagnosisResponseSchema.parse(out);
    }
    case "gemini": {
      const { diagnose } = await import("./providers/gemini");
      const out = await diagnose({ ...input, model: activeModel });
      return AIDiagnosisResponseSchema.parse(out);
    }
    default:
      throw new Error("Unsupported AI provider");
  }
}

export function availableProviders(): Provider[] {
  return ["openai", "ollama", "gemini"];
}
