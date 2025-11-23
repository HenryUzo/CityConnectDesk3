import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const rootDir = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const envFiles = [".env.local", ".env"];

for (const file of envFiles) {
  const envPath = path.join(rootDir, file);
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath, override: true });
  }
}

const isProd = process.env.NODE_ENV === "production";

function ensureEnv(key: string, fallback?: string) {
  if (process.env[key] && process.env[key]!.length > 0) {
    return process.env[key]!;
  }

  if (!isProd && typeof fallback === "string") {
    process.env[key] = fallback;
    console.warn(`[env] ${key} not set; using development fallback.`);
    return fallback;
  }

  throw new Error(`[env] Missing required environment variable: ${key}`);
}

const sessionSecret = ensureEnv("SESSION_SECRET", "dev-session-secret");

if (!process.env.JWT_SECRET) {
  ensureEnv("JWT_SECRET", `${sessionSecret}-jwt`);
}
