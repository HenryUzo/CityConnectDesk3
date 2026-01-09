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
  // Ensure location fields exist on service_requests (added in newer schema)
  await db.execute(sql`
    ALTER TABLE service_requests
      ADD COLUMN IF NOT EXISTS location text,
      ADD COLUMN IF NOT EXISTS latitude double precision,
      ADD COLUMN IF NOT EXISTS longitude double precision;
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
      ADD COLUMN IF NOT EXISTS first_name text,
      ADD COLUMN IF NOT EXISTS last_name text,
      ADD COLUMN IF NOT EXISTS access_code text,
      ADD COLUMN IF NOT EXISTS role user_role DEFAULT 'resident'::user_role,
      ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
      ADD COLUMN IF NOT EXISTS is_approved boolean NOT NULL DEFAULT true,
      ADD COLUMN IF NOT EXISTS categories varchar(100)[],
      ADD COLUMN IF NOT EXISTS service_category service_category,
      ADD COLUMN IF NOT EXISTS experience integer,
      ADD COLUMN IF NOT EXISTS location text,
      ADD COLUMN IF NOT EXISTS latitude double precision,
      ADD COLUMN IF NOT EXISTS longitude double precision,
      ADD COLUMN IF NOT EXISTS rating numeric(3,2) DEFAULT '0',
      ADD COLUMN IF NOT EXISTS created_at timestamp DEFAULT now(),
      ADD COLUMN IF NOT EXISTS updated_at timestamp DEFAULT now();
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

// Ensure minimal users table exists so schema guard ALTERs can run.
async function ensureUsersTable() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS users (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      name text,
      email text,
      phone text,
      password text,
      role text DEFAULT 'resident',
      created_at timestamp DEFAULT now(),
      updated_at timestamp DEFAULT now()
    );
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

// Ensure the service_requests table exists (minimal schema) so the schema-guard ALTERs can run safely.
async function ensureServiceRequestsTable() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS service_requests (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      resident_id varchar,
      provider_id varchar,
      category varchar,
      description text,
      status text DEFAULT 'pending',
      budget text DEFAULT '0',
      urgency varchar DEFAULT 'medium',
      preferred_time timestamp NULL,
      special_instructions text,
      created_at timestamp DEFAULT now(),
      updated_at timestamp DEFAULT now()
    );
  `);
}

// Ensure required Postgres extensions and enums exist before column ALTERs
async function ensureExtensionsAndEnums() {
  // gen_random_uuid() requires pgcrypto
  await db.execute(sql`CREATE EXTENSION IF NOT EXISTS pgcrypto;`);

  // Ensure user_role enum exists (used by users.global_role and others)
  await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_type WHERE typname = 'user_role'
      ) THEN
        CREATE TYPE user_role AS ENUM (
          'resident',
          'provider',
          'admin',
          'super_admin',
          'estate_admin',
          'moderator'
        );
      END IF;
    END$$;
  `);

  // Ensure service_category enum exists for provider fields and service requests
  await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_type WHERE typname = 'service_category'
      ) THEN
        CREATE TYPE service_category AS ENUM (
          'electrician', 'plumber', 'carpenter', 'hvac_technician', 'painter', 'tiler', 'mason',
          'roofer', 'gardener', 'cleaner', 'security_guard', 'cook', 'laundry_service', 'pest_control',
          'welder', 'mechanic', 'phone_repair', 'appliance_repair', 'tailor', 'market_runner', 'item_vendor'
        );
      END IF;
    END$$;
  `);
}

async function ensureTransactionsColumns() {
  try {
    await db.execute(sql`
      ALTER TABLE transactions
        ADD COLUMN IF NOT EXISTS "gatewayReference" text,
        ADD COLUMN IF NOT EXISTS gateway text DEFAULT 'paystack',
        ADD COLUMN IF NOT EXISTS meta jsonb DEFAULT '{}'::jsonb;
    `);

    // Backfill any NULL gatewayReference with generated UUID text
    await db.execute(sql`
      UPDATE transactions
      SET "gatewayReference" = COALESCE("gatewayReference", gen_random_uuid()::text)
      WHERE "gatewayReference" IS NULL;
    `);

    // Try to make the column NOT NULL and add a unique constraint if possible
    try {
      await db.execute(sql`
        ALTER TABLE transactions
          ALTER COLUMN "gatewayReference" SET NOT NULL;
      `);
      // Add unique constraint if it doesn't already exist
      await db.execute(sql`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM pg_constraint WHERE conname = 'transactions_gatewayreference_unique'
          ) THEN
            ALTER TABLE transactions ADD CONSTRAINT transactions_gatewayreference_unique UNIQUE ("gatewayReference");
          END IF;
        END$$;
      `);
    } catch (e) {
      console.warn("Could not set transactions.gatewayReference NOT NULL or add unique constraint:", (e as any)?.message || String(e));
    }
  } catch (err) {
    console.error("ensureTransactionsColumns failed:", (err as any)?.message || String(err));
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

// Boot sequence
(async () => {
  try {
    await dbReady;
    // Create required extensions and enums first to avoid ALTER type errors
    await ensureExtensionsAndEnums();
    await ensureServiceRequestsTable();
    await ensureServiceRequestsColumns();
    await ensureUsersTable();
    await ensureUsersColumns();
    await ensureCompaniesTable();
    await ensureProviderRequestsTable();
    await ensureTransactionsColumns();
    await ensureMongoIdMappingTable();
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
  // Listen on IPv6 unspecified address so both IPv6 (::1) and IPv4 (127.0.0.1) work locally.
  server.listen({ port, host: "::", reusePort: true }, () =>
    log(`serving on port ${port}`)
  );
})();
