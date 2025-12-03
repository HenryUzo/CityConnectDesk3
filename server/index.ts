import "./env";
import express, { type Request, type Response, type NextFunction } from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import { sql } from "drizzle-orm";
import { db, dbReady } from "./db";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";

const app = express();
app.set("trust proxy", 1);

// Body parsers (use raw body for Paystack webhooks to validate signatures)
const paystackWebhookPaths = new Set([
  "/api/payments/paystack/webhook",
  "/api/paystack/webhook",
]);
const jsonParser = express.json();
const urlencodedParser = express.urlencoded({ extended: false });
const rawPaystackParser = express.raw({ type: "*/*" });

function isPaystackWebhookPath(path: string) {
  return paystackWebhookPaths.has(path);
}

app.use((req, res, next) => {
  if (isPaystackWebhookPath(req.path)) {
    return rawPaystackParser(req, res, next);
  }
  return jsonParser(req, res, next);
});

app.use((req, res, next) => {
  if (isPaystackWebhookPath(req.path)) {
    return next();
  }
  return urlencodedParser(req, res, next);
});
app.use(cookieParser());

// CORS (safe defaults for dev; keep credentials if you use cookies)
app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);
    try {
      const u = new URL(origin);
      // Allow localhost (dev) and your dev preview hosts + prod host:
      if (
        u.hostname === 'localhost' ||
        u.hostname === '127.0.0.1' ||
        u.hostname.endsWith('.replit.dev') ||
        origin === 'https://cityconnect.replit.app'
      ) {
        return cb(null, true);
      }
    } catch {}
    return cb(new Error("CORS blocked for origin: " + origin));
  },
  credentials: true, // <-- cookies allowed
  methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "x-estate-id", "x-user-id", "x-user-email"],
}));
app.options("*", cors());

/** Request logging for /api responses (trimmed to avoid noisy logs) */
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: unknown;

  const originalJson = res.json.bind(res);
  res.json = (body: any, ...rest: any[]) => {
    capturedJsonResponse = body;
    // @ts-expect-error forwarding variadic args
    return originalJson(body, ...rest);
  };

  res.on("finish", () => {
    if (!path.startsWith("/api")) return;
    const duration = Date.now() - start;
    let line = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
    if (capturedJsonResponse) {
      try {
        line += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      } catch {}
    }
    if (line.length > 80) line = line.slice(0, 79) + "...";
    log(line);
  });

  next();
});

// Lightweight health probes
app.get("/health", (_req, res) => {
  res.json({ status: "ok", ts: new Date().toISOString() });
});

// Schema guard: ensure columns exist (idempotent)
async function ensureServiceRequestsColumns() {
  await db.execute(sql`
    ALTER TABLE service_requests
      ADD COLUMN IF NOT EXISTS admin_notes      text,
      ADD COLUMN IF NOT EXISTS assigned_at      timestamp NULL,
      ADD COLUMN IF NOT EXISTS closed_at        timestamp NULL,
      ADD COLUMN IF NOT EXISTS close_reason     text,
      ADD COLUMN IF NOT EXISTS billed_amount    numeric(10,2) DEFAULT '0',
      ADD COLUMN IF NOT EXISTS payment_status   text DEFAULT 'pending',
      ADD COLUMN IF NOT EXISTS preferred_time   timestamp NULL;
  `);
  await db.execute(sql`
    ALTER TABLE service_requests
      ADD COLUMN IF NOT EXISTS estate_id varchar(255);
  `);
}

// Ensure admin-related columns exist on users table
async function ensureUsersColumns() {
  await db.execute(sql`
    ALTER TABLE users
      ADD COLUMN IF NOT EXISTS global_role user_role;
  `);
  await db.execute(sql`
    ALTER TABLE users
      ADD COLUMN IF NOT EXISTS company text;
  `);
  await db.execute(sql`
    ALTER TABLE users
      ADD COLUMN IF NOT EXISTS documents text[];
  `);
  await db.execute(sql`
    ALTER TABLE users
      ADD COLUMN IF NOT EXISTS last_login_at timestamp NULL;
  `);
  await db.execute(sql`
    ALTER TABLE users
      ADD COLUMN IF NOT EXISTS metadata jsonb;
  `);
}

async function ensureCompaniesTable() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS companies (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      name text NOT NULL,
      description text,
      contact_email text,
      phone text,
      is_active boolean NOT NULL DEFAULT true,
      created_at timestamp DEFAULT now(),
      updated_at timestamp DEFAULT now()
    );
  `);

  await db.execute(sql`
    ALTER TABLE companies
    ADD COLUMN IF NOT EXISTS provider_id varchar REFERENCES users(id),
    ADD COLUMN IF NOT EXISTS details jsonb NOT NULL DEFAULT '{}';
  `);
}

async function ensureProviderRequestsTable() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS provider_requests (
      id varchar(255) PRIMARY KEY DEFAULT gen_random_uuid(),
      name text NOT NULL,
      email text NOT NULL,
      phone text,
      company text,
      categories varchar(100)[] DEFAULT '{}',
      experience integer NOT NULL DEFAULT 0,
      description text,
      provider_id varchar(255) REFERENCES users(id),
      created_at timestamp NOT NULL DEFAULT now()
    );
  `);
  
  // Add provider_id column if it doesn't exist (for existing tables)
  await db.execute(sql`
    ALTER TABLE provider_requests
    ADD COLUMN IF NOT EXISTS provider_id varchar(255) REFERENCES users(id);
  `);
}

async function ensureTransactionsColumns() {
  try {
    await db.execute(sql`
      ALTER TABLE transactions
        ADD COLUMN IF NOT EXISTS reference text,
        ADD COLUMN IF NOT EXISTS gateway text DEFAULT 'paystack',
        ADD COLUMN IF NOT EXISTS meta jsonb DEFAULT '{}'::jsonb;
    `);

    // Backfill any NULL references with generated UUID text
    await db.execute(sql`
      UPDATE transactions
      SET reference = COALESCE(reference, gen_random_uuid()::text)
      WHERE reference IS NULL;
    `);

    // Try to make the column NOT NULL and add a unique constraint if possible
    try {
      await db.execute(sql`
        ALTER TABLE transactions
          ALTER COLUMN reference SET NOT NULL;
      `);
      // Add unique constraint if it doesn't already exist
      await db.execute(sql`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM pg_constraint WHERE conname = 'transactions_reference_unique'
          ) THEN
            ALTER TABLE transactions ADD CONSTRAINT transactions_reference_unique UNIQUE (reference);
          END IF;
        END$$;
      `);
    } catch (e: any) {
      console.warn("Could not set transactions.reference NOT NULL or add unique constraint:", e?.message || e);
    }
  } catch (err: any) {
    console.error("ensureTransactionsColumns failed:", err?.message || err);
  }
}

async function ensureMongoIdMappingTable() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS mongo_id_mappings (
      id varchar(255) PRIMARY KEY DEFAULT gen_random_uuid(),
      mongo_id text NOT NULL,
      postgres_id varchar(255) NOT NULL,
      entity_type text NOT NULL,
      created_at timestamp NOT NULL DEFAULT now()
    );
  `);
}

async function ensureRefreshTokensTable() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS refresh_tokens (
      id varchar(255) PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id varchar(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_id varchar(255) NOT NULL UNIQUE,
      expires_at timestamp NOT NULL,
      is_revoked boolean NOT NULL DEFAULT false,
      created_at timestamp DEFAULT now(),
      revoked_at timestamp NULL
    );
  `);
  
  // Add index on user_id for faster queries
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS refresh_tokens_user_id_idx ON refresh_tokens(user_id);
  `);
  
  // Add index on token_id for faster lookups
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS refresh_tokens_token_id_idx ON refresh_tokens(token_id);
  `);
}

// Boot sequence
(async () => {
  try {
    await dbReady;
    await ensureServiceRequestsColumns();
    await ensureUsersColumns();
    await ensureCompaniesTable();
    await ensureProviderRequestsTable();
    await ensureTransactionsColumns();
    await ensureMongoIdMappingTable();
    await ensureRefreshTokensTable();
    log("[DB] Schema guard OK");
  } catch (e) {
    console.error("[DB] Schema guard failed:", e);
    // keep running so you can see logs and fix in place
  }

  // Register the rest of your routes (SSR/API defined in ./routes)
  const server = await registerRoutes(app);

  // Global error handler — do NOT throw/rethrow
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err?.status || err?.statusCode || 500;
    const message = err?.message || "Internal Server Error";
    console.error("[UNHANDLED ERROR]", { status, message, stack: err?.stack });
    if (!res.headersSent) res.status(status).json({ error: message });
  });

  // Dev: Vite middleware; Prod: static assets
  if (app.get("env") === "development") {
    // Dev-only request logger to help diagnose missing-module/404 issues.
    app.use((req, _res, next) => {
      try {
        const accept = (req.headers.accept || "").toString();
        console.log(`[DEV REQUEST] ${req.method} ${req.originalUrl} Accept:${accept}`);
      } catch (e) {}
      next();
    });

    await setupVite(app, server);
  } else {
    // In production, ensure frontend build is accessible at client/dist
    await import("./prepare-static").then((m) => m.prepareStaticFiles()).catch(console.error);
    serveStatic(app);
  }

  // Replit/Render/Heroku style port
  const port = parseInt(process.env.PORT || "5000", 10);
  server.listen({ port, host: "0.0.0.0", reusePort: true }, () =>
    log(`serving on port ${port}`)
  );
})();
