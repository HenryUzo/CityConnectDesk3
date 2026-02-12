import "./env";
import express, { type Request, type Response, type NextFunction } from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import { sql } from "drizzle-orm";
import { db, dbReady } from "./db";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { setupAuth } from "./auth";

// Intercept process.exit to see if anything is trying to exit
const originalExit = process.exit;
process.exit = function(code?: number | string) {
  console.error("[PROCESS] process.exit() called with code:", code);
  console.error("[PROCESS] Stack trace:");
  console.error(new Error().stack);
  return originalExit.call(process, code) as never;
} as any;

const app = express();
app.set("trust proxy", 1);

// Body parsers (use raw body for Paystack webhooks to validate signatures)
const paystackWebhookPaths = new Set([
  "/api/payments/paystack/webhook",
  "/api/paystack/webhook",
]);
const jsonParser = express.json({ limit: "12mb" });
const urlencodedParser = express.urlencoded({ extended: false, limit: "12mb" });
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

// DEV: accept `x-user-email` header to populate `req.user`/`req.auth` for local testing
app.use(async (req, _res, next) => {
  try {
    if (process.env.NODE_ENV === 'development' && !req.auth && !req.user) {
      const hdr = (req.header('x-user-email') || '').toString().trim().toLowerCase();
      if (hdr) {
        // defer import to avoid cycles
        const { storage } = await import('./storage');
        const u = await storage.getUserByEmail(hdr).catch(() => undefined);
        if (u) {
          // attach for downstream handlers and ensureDevAuth will pick this up
          (req as any).user = u;
          req.auth = {
            id: u.id,
            userId: u.id,
            role: (u as any).role,
            globalRole: (u as any).global_role,
          } as any;
        }
      }
    }
  } catch (e) {
    // ignore errors in dev bypass
  }
  next();
});

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

// Setup Passport.js and express-session for authentication
setupAuth(app);

app.use((req, res, next) => {
  if (req.path === "/api/service-requests" && req.method === "POST") {
    console.log("[DEBUG-INDEX] Incoming POST /api/service-requests", {
      headers: req.headers,
      cookies: req.cookies,
      authenticated: req.isAuthenticated ? req.isAuthenticated() : 'n/a',
      user: !!req.user
    });
  }
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: unknown;

  const originalJson = res.json.bind(res);
  res.json = (body: any, ...rest: any[]) => {
    capturedJsonResponse = body;
    if (res.statusCode === 401) {
      console.log("[DEBUG-401] Path:", req.originalUrl, "Body:", body, "User:", (req as any).user?.id);
    }
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

async function ensureEstatesColumns() {
  await db.execute(sql`
    ALTER TABLE estates
      ADD COLUMN IF NOT EXISTS access_type text,
      ADD COLUMN IF NOT EXISTS access_code text;
  `);
}

async function ensureStoresColumns() {
  await db.execute(sql`
    ALTER TABLE stores
      ADD COLUMN IF NOT EXISTS company_id varchar;
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
      is_active boolean NOT NULL DEFAULT false,
      created_at timestamp DEFAULT now(),
      updated_at timestamp DEFAULT now()
    );
  `);

  await db.execute(sql`
    ALTER TABLE companies
    ADD COLUMN IF NOT EXISTS provider_id varchar REFERENCES users(id),
    ADD COLUMN IF NOT EXISTS details jsonb NOT NULL DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS business_details jsonb,
    ADD COLUMN IF NOT EXISTS bank_details jsonb,
    ADD COLUMN IF NOT EXISTS location_details jsonb,
    ADD COLUMN IF NOT EXISTS submitted_at timestamp;
  `);

  await db.execute(sql`
    ALTER TABLE companies
      ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT false;
  `);
  await db.execute(sql`
    ALTER TABLE companies
      ALTER COLUMN is_active SET DEFAULT false;
  `);
}

async function ensureNotificationsTable() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS notifications (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id varchar NOT NULL REFERENCES users(id),
      title varchar(120) NOT NULL,
      message text NOT NULL,
      type varchar(20) NOT NULL DEFAULT 'info',
      metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
      is_read boolean NOT NULL DEFAULT false,
      created_at timestamp NOT NULL DEFAULT now()
    );
  `);
  await db.execute(sql`
    ALTER TABLE notifications
    ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
    CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at);
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

  await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_type WHERE typname = 'conversation_status'
      ) THEN
        CREATE TYPE conversation_status AS ENUM ('active', 'closed');
      END IF;
    END$$;
  `);

  await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_type WHERE typname = 'conversation_role'
      ) THEN
        CREATE TYPE conversation_role AS ENUM ('user', 'assistant');
      END IF;
    END$$;
  `);

  await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_type WHERE typname = 'conversation_message_type'
      ) THEN
        CREATE TYPE conversation_message_type AS ENUM ('text', 'image');
      END IF;
    END$$;
  `);

  await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_type WHERE typname = 'request_conversation_mode'
      ) THEN
        CREATE TYPE request_conversation_mode AS ENUM ('ai', 'ordinary');
      END IF;
    END$$;
  `);

  await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_type WHERE typname = 'ai_session_status'
      ) THEN
        CREATE TYPE ai_session_status AS ENUM ('active', 'completed');
      END IF;
    END$$;
  `);

  await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_type WHERE typname = 'ai_session_role'
      ) THEN
        CREATE TYPE ai_session_role AS ENUM ('user', 'assistant', 'system');
      END IF;
    END$$;
  `);

  await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_type WHERE typname = 'request_ai_provider'
      ) THEN
        CREATE TYPE request_ai_provider AS ENUM ('gemini', 'ollama', 'openai');
      END IF;
    END$$;
  `);

  await db.execute(sql`
    DO $$
    BEGIN
      ALTER TYPE request_ai_provider ADD VALUE IF NOT EXISTS 'openai';
    END$$;
  `);

  await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_type WHERE typname = 'request_ordinary_presentation'
      ) THEN
        CREATE TYPE request_ordinary_presentation AS ENUM ('chat', 'form');
      END IF;
    END$$;
  `);

  await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_type WHERE typname = 'request_question_mode'
      ) THEN
        CREATE TYPE request_question_mode AS ENUM ('ai', 'ordinary');
      END IF;
    END$$;
  `);

  await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_type WHERE typname = 'request_question_scope'
      ) THEN
        CREATE TYPE request_question_scope AS ENUM ('global', 'category');
      END IF;
    END$$;
  `);

  await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_type WHERE typname = 'request_question_type'
      ) THEN
        CREATE TYPE request_question_type AS ENUM (
          'text',
          'textarea',
          'select',
          'date',
          'datetime',
          'estate',
          'urgency',
          'image',
          'multi_image'
        );
      END IF;
    END$$;
  `);
}

async function ensureTransactionsColumns() {
  try {
    await db.execute(sql`
      ALTER TABLE transactions
        ADD COLUMN IF NOT EXISTS reference text,
        ADD COLUMN IF NOT EXISTS "gatewayReference" text,
        ADD COLUMN IF NOT EXISTS gateway text DEFAULT 'paystack',
        ADD COLUMN IF NOT EXISTS meta jsonb DEFAULT '{}'::jsonb;
    `);

    await db.execute(sql`
      UPDATE transactions
      SET reference = COALESCE(reference, gen_random_uuid()::text)
      WHERE reference IS NULL;
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
          ALTER COLUMN reference SET NOT NULL;
      `);
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

async function ensureConversationsTable() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS conversations (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      resident_id varchar NOT NULL REFERENCES users(id),
      category text NOT NULL,
      status conversation_status NOT NULL DEFAULT 'active',
      created_at timestamp DEFAULT now(),
      updated_at timestamp DEFAULT now()
    );
  `);

  await db.execute(sql`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'conversations_resident_category_unique'
      ) THEN
        ALTER TABLE conversations DROP CONSTRAINT conversations_resident_category_unique;
      END IF;
    END$$;
  `);

  await db.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS conversations_active_unique
      ON conversations(resident_id, category)
      WHERE status = 'active';
  `);

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_conversations_resident_id ON conversations(resident_id);
    CREATE INDEX IF NOT EXISTS idx_conversations_updated_at ON conversations(updated_at);
  `);
}

async function ensureConversationMessagesTable() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS conversation_messages (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      conversation_id varchar NOT NULL REFERENCES conversations(id),
      role conversation_role NOT NULL,
      type conversation_message_type NOT NULL DEFAULT 'text',
      content text NOT NULL,
      meta jsonb,
      created_at timestamp DEFAULT now()
    );
  `);

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_conversation_messages_conversation_id_created_at
      ON conversation_messages(conversation_id, created_at);
  `);
}

async function ensureRequestConversationSettingsTable() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS request_conversation_settings (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      mode request_conversation_mode NOT NULL DEFAULT 'ai',
      ai_provider request_ai_provider NOT NULL DEFAULT 'gemini',
      ai_model text,
      ai_temperature double precision,
      ai_system_prompt text,
      ordinary_presentation request_ordinary_presentation NOT NULL DEFAULT 'chat',
      admin_wait_threshold_ms integer DEFAULT 300000,
      created_at timestamp DEFAULT now(),
      updated_at timestamp DEFAULT now()
    );
  `);
  
  // Add column if it doesn't exist (for existing databases)
  try {
    await db.execute(sql`
      ALTER TABLE request_conversation_settings 
      ADD COLUMN IF NOT EXISTS admin_wait_threshold_ms integer DEFAULT 300000;
    `);
  } catch (e) {
    // Column might already exist or other error - safe to ignore
  }
}

async function ensureRequestQuestionsTable() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS request_questions (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      mode request_question_mode NOT NULL,
      scope request_question_scope NOT NULL DEFAULT 'global',
      category_key text,
      key text NOT NULL,
      label text NOT NULL,
      type request_question_type NOT NULL,
      required boolean NOT NULL DEFAULT false,
      options jsonb,
      "order" integer NOT NULL DEFAULT 0,
      is_enabled boolean NOT NULL DEFAULT true,
      created_at timestamp DEFAULT now(),
      updated_at timestamp DEFAULT now()
    );
  `);

  await db.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS request_questions_unique
      ON request_questions(mode, scope, COALESCE(category_key, ''), key);
  `);

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS request_questions_mode_order
      ON request_questions(mode, "order");
  `);
}

async function ensureAiSessionsTables() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS ai_sessions (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      resident_id varchar NOT NULL REFERENCES users(id),
      category_key text NOT NULL,
      mode request_conversation_mode NOT NULL DEFAULT 'ai',
      status ai_session_status NOT NULL DEFAULT 'active',
      created_at timestamp DEFAULT now(),
      updated_at timestamp DEFAULT now()
    );
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS ai_session_messages (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      session_id varchar NOT NULL REFERENCES ai_sessions(id),
      role ai_session_role NOT NULL,
      content text NOT NULL,
      meta jsonb,
      created_at timestamp DEFAULT now()
    );
  `);

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_ai_session_messages_session_created
      ON ai_session_messages(session_id, created_at);
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS ai_session_attachments (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      session_id varchar NOT NULL REFERENCES ai_sessions(id) ON DELETE CASCADE,
      message_id varchar REFERENCES ai_session_messages(id) ON DELETE SET NULL,
      type text NOT NULL DEFAULT 'image',
      data_url text NOT NULL,
      mime_type varchar(100),
      byte_size integer,
      sha256 varchar(128),
      created_at timestamp DEFAULT now()
    );
  `);

  await db.execute(sql`
    ALTER TABLE ai_session_attachments
      ADD COLUMN IF NOT EXISTS message_id varchar REFERENCES ai_session_messages(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS mime_type varchar(100),
      ADD COLUMN IF NOT EXISTS byte_size integer,
      ADD COLUMN IF NOT EXISTS sha256 varchar(128);
  `);

  try {
    await db.execute(sql`
      UPDATE ai_session_attachments
      SET byte_size = COALESCE(byte_size, 0)
      WHERE byte_size IS NULL;
    `);
    await db.execute(sql`
      ALTER TABLE ai_session_attachments
        ALTER COLUMN byte_size SET NOT NULL;
    `);
  } catch (e) {
    console.warn("Could not enforce ai_session_attachments.byte_size NOT NULL:", (e as any)?.message || String(e));
  }

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_ai_session_attachments_session_created
      ON ai_session_attachments(session_id, created_at);
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_ai_session_attachments_message_id
      ON ai_session_attachments(message_id);
  `);
}

// Seed example CityMart banners if none exist
async function seedCityMartBanners() {
  try {
    const existingBanners: any = await db.execute(sql`
      SELECT COUNT(*) as count FROM citymart_banners;
    `);
    const count = (existingBanners?.rows?.[0]?.count ?? 0) || 0;
    if (count > 0) return; // Already seeded
    
    await db.execute(sql`
      INSERT INTO citymart_banners (
        type, title, description, heading, button_text, button_variant,
        price, price_label, price_suffix, category, position, is_active, created_at, updated_at
      ) VALUES
      (
        'hero', 
        'Food Items Flash Sale', 
        'Get your fresh food items at market cost. No hidden charges.',
        'Food items',
        'Shop now',
        'primary',
        '₦299,000',
        'Just',
        'Only!',
        'Groceries',
        0,
        true,
        now(),
        now()
      ),
      (
        'horizontal',
        'Premium Electronics',
        'New Google Pixel 6 Pro at unbeatable prices',
        'Google Pixel 6 Pro',
        'Bid Now',
        'dark',
        '₦450,000',
        'Starting from',
        null,
        'Electronics',
        1,
        true,
        now(),
        now()
      ),
      (
        'aside-long',
        '32% Discount on Electronics',
        'For all electronics products',
        null,
        'Shop now',
        'primary',
        null,
        null,
        null,
        'COMPUTER & ACCESSORIES',
        2,
        true,
        now(),
        now()
      ),
      (
        'aside-small',
        '37% DISCOUNT on Smartphones',
        'Limited time offer on SmartPhone products.',
        null,
        'Shop now',
        'secondary',
        null,
        null,
        null,
        'Electronics',
        3,
        true,
        now(),
        now()
      ),
      (
        'full-width',
        'MacBook Pro Premium Deal',
        'Apple M1 Max Chip. 32GB Unified Memory, 1TB SSD Storage',
        'MacBook Pro',
        'Shop now',
        'primary',
        '₦2,499,000',
        'Just',
        'Only!',
        'Electronics',
        4,
        true,
        now(),
        now()
      );
    `);
    log("[SEED] CityMart banners seeded successfully");
  } catch (err) {
    console.warn("[SEED] Failed to seed CityMart banners:", (err as any)?.message || String(err));
    // Don't fail boot if seeding fails
  }
}

async function seedRequestConfigDefaults() {
  const existingSettings: any = await db.execute(sql`
    SELECT id FROM request_conversation_settings LIMIT 1;
  `);
  const hasSettings = Array.isArray(existingSettings?.rows)
    ? existingSettings.rows.length > 0
    : (existingSettings?.length ?? 0) > 0;
  if (!hasSettings) {
    await db.execute(sql`
      INSERT INTO request_conversation_settings (
        mode, ai_provider, ai_model, ordinary_presentation, created_at, updated_at
      ) VALUES (
        'ai', 'gemini', 'qwen2.5:7b', 'chat', now(), now()
      );
    `);
  }

  const existingQuestions: any = await db.execute(sql`
    SELECT id FROM request_questions LIMIT 1;
  `);
  const hasQuestions = Array.isArray(existingQuestions?.rows)
    ? existingQuestions.rows.length > 0
    : (existingQuestions?.length ?? 0) > 0;
  if (hasQuestions) return;

  await db.execute(sql`
    INSERT INTO request_questions (
      mode, scope, key, label, type, required, "order", is_enabled, created_at, updated_at
    ) VALUES
      ('ordinary', 'global', 'estate', 'Which estate are you in?', 'estate', true, 1, true, now(), now()),
      ('ordinary', 'global', 'inspectionDate', 'When should we schedule the inspection?', 'datetime', true, 2, true, now(), now()),
      ('ordinary', 'global', 'urgency', 'How urgent is it?', 'urgency', true, 3, true, now(), now()),
      ('ordinary', 'global', 'images', 'Please upload images if available.', 'multi_image', false, 4, true, now(), now()),
      ('ai', 'global', 'estate', 'Estate', 'estate', true, 1, true, now(), now()),
      ('ai', 'global', 'urgency', 'Urgency', 'urgency', true, 2, true, now(), now()),
      ('ai', 'global', 'images', 'Images', 'multi_image', false, 3, true, now(), now()),
      ('ai', 'global', 'budget', 'Budget', 'text', false, 4, true, now(), now());
  `);
}

// ── Marketplace V2 tables ──
async function ensureMarketplaceV2Tables() {
  // Enum types (CREATE TYPE IF NOT EXISTS workaround)
  for (const [name, values] of Object.entries({
    cart_status: ["active", "checked_out", "abandoned"],
    parent_order_status: ["pending_payment", "paid", "partially_refunded", "refunded", "cancelled"],
    store_order_status: ["pending_acceptance", "accepted", "rejected", "packing", "ready_for_dispatch", "dispatched", "delivered", "cancelled", "refunded"],
    delivery_method: ["pickup", "store_delivery", "cityconnect_rider"],
    payment_provider: ["paystack"],
    payment_status_enum: ["initiated", "paid", "failed", "refunded", "partial_refund"],
    refund_status: ["requested", "approved", "rejected", "processed"],
  })) {
    await db.execute(sql.raw(`
      DO $$ BEGIN
        CREATE TYPE ${name} AS ENUM (${values.map(v => `'${v}'`).join(", ")});
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `));
  }

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS inventory (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      store_id varchar NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
      product_id varchar NOT NULL REFERENCES marketplace_items(id) ON DELETE CASCADE,
      stock_qty integer NOT NULL DEFAULT 0,
      reserved_qty integer NOT NULL DEFAULT 0,
      low_stock_threshold integer,
      updated_at timestamp DEFAULT now(),
      UNIQUE (store_id, product_id)
    );
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS carts (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      resident_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      status cart_status NOT NULL DEFAULT 'active',
      created_at timestamp DEFAULT now(),
      updated_at timestamp DEFAULT now()
    );
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS cart_items (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      cart_id varchar NOT NULL REFERENCES carts(id) ON DELETE CASCADE,
      store_id varchar NOT NULL REFERENCES stores(id),
      product_id varchar NOT NULL REFERENCES marketplace_items(id),
      qty integer NOT NULL DEFAULT 1,
      unit_price integer NOT NULL,
      created_at timestamp DEFAULT now(),
      updated_at timestamp DEFAULT now(),
      UNIQUE (cart_id, product_id)
    );
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS parent_orders (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      resident_id varchar NOT NULL REFERENCES users(id),
      total_amount integer NOT NULL,
      currency varchar(10) NOT NULL DEFAULT 'NGN',
      status parent_order_status NOT NULL DEFAULT 'pending_payment',
      delivery_address jsonb NOT NULL,
      created_at timestamp DEFAULT now(),
      updated_at timestamp DEFAULT now()
    );
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS store_orders (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      order_id varchar NOT NULL REFERENCES parent_orders(id) ON DELETE CASCADE,
      store_id varchar NOT NULL REFERENCES stores(id),
      status store_order_status NOT NULL DEFAULT 'pending_acceptance',
      subtotal_amount integer NOT NULL,
      delivery_fee integer NOT NULL DEFAULT 0,
      delivery_method delivery_method NOT NULL DEFAULT 'pickup',
      note_to_store text,
      created_at timestamp DEFAULT now(),
      updated_at timestamp DEFAULT now(),
      UNIQUE (order_id, store_id)
    );
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS store_order_items (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      store_order_id varchar NOT NULL REFERENCES store_orders(id) ON DELETE CASCADE,
      product_id varchar NOT NULL REFERENCES marketplace_items(id),
      qty integer NOT NULL,
      unit_price integer NOT NULL,
      line_total integer NOT NULL,
      created_at timestamp DEFAULT now()
    );
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS marketplace_payments (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      order_id varchar NOT NULL REFERENCES parent_orders(id),
      provider payment_provider NOT NULL DEFAULT 'paystack',
      reference varchar(255) NOT NULL UNIQUE,
      status payment_status_enum NOT NULL DEFAULT 'initiated',
      amount integer NOT NULL,
      meta jsonb NOT NULL DEFAULT '{}'::jsonb,
      created_at timestamp DEFAULT now(),
      updated_at timestamp DEFAULT now()
    );
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS refunds (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      store_order_id varchar NOT NULL REFERENCES store_orders(id),
      status refund_status NOT NULL DEFAULT 'requested',
      amount integer NOT NULL,
      reason text,
      created_at timestamp DEFAULT now(),
      updated_at timestamp DEFAULT now()
    );
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS citymart_banners (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      type varchar(50) NOT NULL,
      title text NOT NULL,
      description text,
      heading text,
      button_text text,
      button_variant text,
      button_link text,
      image_url text,
      background_image_url text,
      badge jsonb,
      discount jsonb,
      price text,
      price_label text,
      price_suffix text,
      price_top_text text,
      price_bottom_text text,
      promo_badge_text text,
      countdown text,
      category text,
      position integer NOT NULL DEFAULT 0,
      is_active boolean NOT NULL DEFAULT true,
      show_carousel_dots boolean DEFAULT false,
      active_carousel_dot integer DEFAULT 0,
      created_by varchar REFERENCES users(id),
      created_at timestamp DEFAULT now(),
      updated_at timestamp DEFAULT now()
    );
  `);
}

// Boot sequence - start immediately without IIFE
let bootPromise = (async () => {
  console.log("[BOOT] Starting boot sequence...");
  try {
    await dbReady;
    // Create required extensions and enums first to avoid ALTER type errors
    await ensureExtensionsAndEnums();
    await ensureServiceRequestsTable();
    await ensureServiceRequestsColumns();
    await ensureUsersTable();
    await ensureUsersColumns();
    await ensureEstatesColumns();
    await ensureStoresColumns();
    await ensureCompaniesTable();
    await ensureNotificationsTable();
    await ensureProviderRequestsTable();
    await ensureTransactionsColumns();
    await ensureMongoIdMappingTable();
    await ensureConversationsTable();
    await ensureConversationMessagesTable();
    await ensureRequestConversationSettingsTable();
    await ensureRequestQuestionsTable();
    await ensureAiSessionsTables();
    await ensureMarketplaceV2Tables();
    await seedRequestConfigDefaults();
    await seedCityMartBanners();
    log("[DB] Schema guard OK");
  } catch (e) {
    console.error("[DB] Schema guard failed:", e);
    // keep running so you can see logs and fix in place
  }

  // Register the rest of your routes (SSR/API defined in ./routes)
  let server;
  try {
    log("[BOOT] Registering routes...");
    server = await registerRoutes(app);
    log("[BOOT] Routes registered successfully");
  } catch (e) {
    console.error("[BOOT] Failed to register routes:", e);
    process.exit(1);
  }

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

    try {
      log("[BOOT] Setting up Vite...");
      await setupVite(app, server);
      log("[BOOT] Vite setup complete");
    } catch (e) {
      console.error("[BOOT] Failed to setup Vite:", e);
      process.exit(1);
    }
  } else {
    try {
      // In production, ensure frontend build is accessible at client/dist
      await import("./prepare-static").then((m) => m.prepareStaticFiles()).catch(console.error);
      serveStatic(app);
    } catch (e) {
      console.error("[BOOT] Failed to prepare static files:", e);
      process.exit(1);
    }
  }

  // Replit/Render/Heroku style port
  const port = parseInt(process.env.PORT || "5000", 10);
  // Allow overriding the host via the HOST env var for development (defaults to localhost for Windows compatibility)
  const host = process.env.HOST || "127.0.0.1";
  
  // Handle unhandled promise rejections
  process.on('unhandledRejection', (reason, promise) => {
    console.error('[UNHANDLED REJECTION]', { 
      reason, 
      message: reason instanceof Error ? reason.message : String(reason),
      stack: reason instanceof Error ? reason.stack : undefined
    });
    console.error('[UNHANDLED REJECTION] Details:', reason);
    // Don't exit - let the process stay alive to see the error
  });
  
  // Handle unhandled exceptions
  process.on('uncaughtException', (error) => {
    console.error('[UNCAUGHT EXCEPTION]', {
      message: error.message,
      stack: error.stack
    });
    // Don't exit - let the process stay alive
  });
  
  log("[BOOT] Starting server listener on " + host + ":" + port);
  console.log("[TIMESTAMP] " + new Date().toISOString());
  console.log("[BOOT] Server object type:", typeof server);
  console.log("[BOOT] Server methods:", Object.getOwnPropertyNames(Object.getPrototypeOf(server)).slice(0, 20).join(", "));
  
  server.on('error', (err) => {
    console.error('[SERVER ERROR]', err);
  });
  server.on('listening', () => {
    log(`✓ Server is now listening on ${host}:${port}`);
    console.log("[TIMESTAMP] Server listening at " + new Date().toISOString());
  });
  
  console.log("[TIMESTAMP] Calling server.listen() at " + new Date().toISOString());
  server.listen(port, host, () => {
    log(`serving on port ${port}`);
    console.log("[BOOT] Server is now listening and ready to accept connections");
    console.log("[TIMESTAMP] Listen callback executed at " + new Date().toISOString());
    // Keep stdin open to prevent process exit
    if (process.stdin.isTTY === false) {
      process.stdin.resume();
    }
  });
  
  console.log("[TIMESTAMP] After server.listen() call at " + new Date().toISOString());
  
  // Set keepalive timeouts to verify the process is still running
  setInterval(() => {
    console.log("[KEEPALIVE] Process running at " + new Date().toISOString());
  }, 1000);
  
  // Never complete this promise to keep the process alive
  return new Promise(() => {
    console.log("[BOOT] Promise waiting - process should stay alive");
  });
})();

bootPromise.then(() => {
  console.log("[BOOT] Boot promise resolved - this should never happen");
}).catch(e => {
  console.error("[BOOT] Boot promise failed:", e);
  process.exit(1);
});
