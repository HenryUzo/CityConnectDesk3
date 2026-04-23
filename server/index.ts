import "./env";
import express, { type Request, type Response, type NextFunction } from "express";
import cookieParser from "cookie-parser";
import cors, { type CorsOptions } from "cors";
import { sql } from "drizzle-orm";
import { db, dbReady } from "./db";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { setupAuth } from "./auth";
import { authenticateJWT } from "./auth-middleware";
import { ensureInventoryUploadsDir, uploadsRootDir } from "./utils/inventory-image-storage";

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

// Serve locally uploaded assets (intermediate storage before object storage rollout)
await ensureInventoryUploadsDir();
app.use("/uploads", express.static(uploadsRootDir));

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

const configuredFrontendOrigins = new Set(
  [
    process.env.FRONTEND_ORIGIN,
    process.env.FRONTEND_URL,
    process.env.CLIENT_URL,
  ]
    .flatMap((value) => String(value || "").split(","))
    .map((value) => value.trim())
    .filter(Boolean),
);

// CORS (safe defaults for dev; keep credentials if you use cookies)
const corsOptions: CorsOptions = {
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);
    try {
      const u = new URL(origin);
      // Allow localhost (dev) and your dev preview hosts + prod host:
      if (
        u.hostname === 'localhost' ||
        u.hostname === '127.0.0.1' ||
        u.hostname.endsWith('.replit.dev') ||
        u.hostname.endsWith('.vercel.app') ||
        configuredFrontendOrigins.has(origin) ||
        origin === 'https://cityconnect.replit.app'
      ) {
        return cb(null, true);
      }
    } catch {}
    return cb(new Error("CORS blocked for origin: " + origin));
  },
  credentials: true, // <-- cookies allowed
  methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "x-estate-id", "x-user-id", "x-user-email", "x-file-name"],
};
app.use(cors(corsOptions));
app.options("*", cors(corsOptions));

// Setup Passport.js and express-session for authentication
setupAuth(app);
app.use(authenticateJWT);

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
      ADD COLUMN IF NOT EXISTS payment_requested_at timestamp NULL,
      ADD COLUMN IF NOT EXISTS approved_for_job_at timestamp NULL,
      ADD COLUMN IF NOT EXISTS approved_for_job_by varchar(255) NULL,
      ADD COLUMN IF NOT EXISTS consultancy_report jsonb,
      ADD COLUMN IF NOT EXISTS consultancy_report_submitted_at timestamp NULL,
      ADD COLUMN IF NOT EXISTS consultancy_report_submitted_by varchar(255) NULL,
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

  await db.execute(sql`
    ALTER TABLE service_requests
      ADD COLUMN IF NOT EXISTS category_label text,
      ADD COLUMN IF NOT EXISTS issue_type text,
      ADD COLUMN IF NOT EXISTS area_affected text,
      ADD COLUMN IF NOT EXISTS quantity_label text,
      ADD COLUMN IF NOT EXISTS time_window_label text,
      ADD COLUMN IF NOT EXISTS photos_count integer,
      ADD COLUMN IF NOT EXISTS address_line text,
      ADD COLUMN IF NOT EXISTS estate_name text,
      ADD COLUMN IF NOT EXISTS state_name text,
      ADD COLUMN IF NOT EXISTS lga_name text,
      ADD COLUMN IF NOT EXISTS payment_purpose text,
      ADD COLUMN IF NOT EXISTS consultancy_fee numeric(10,2),
      ADD COLUMN IF NOT EXISTS material_cost numeric(10,2),
      ADD COLUMN IF NOT EXISTS service_cost numeric(10,2),
      ADD COLUMN IF NOT EXISTS requested_total numeric(10,2),
      ADD COLUMN IF NOT EXISTS assigned_inspector_id varchar(255),
      ADD COLUMN IF NOT EXISTS assigned_job_provider_id varchar(255);
  `);

  await db.execute(sql`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'users'
      ) THEN
        BEGIN
          ALTER TABLE service_requests
            ADD CONSTRAINT service_requests_approved_for_job_by_fkey
            FOREIGN KEY (approved_for_job_by) REFERENCES users(id);
        EXCEPTION
          WHEN duplicate_object THEN
            NULL;
        END;

        BEGIN
          ALTER TABLE service_requests
            ADD CONSTRAINT service_requests_consultancy_report_submitted_by_fkey
            FOREIGN KEY (consultancy_report_submitted_by) REFERENCES users(id);
        EXCEPTION
          WHEN duplicate_object THEN
            NULL;
        END;
      END IF;
    END$$;
  `);
}

async function ensureServiceStatusValues() {
  await db.execute(sql`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM pg_type WHERE typname = 'service_status'
      ) THEN
        ALTER TYPE service_status ADD VALUE IF NOT EXISTS 'assigned_for_job';
        ALTER TYPE service_status ADD VALUE IF NOT EXISTS 'work_completed_pending_resident';
        ALTER TYPE service_status ADD VALUE IF NOT EXISTS 'disputed';
        ALTER TYPE service_status ADD VALUE IF NOT EXISTS 'rework_required';
      END IF;
    END$$;
  `);
}

async function ensureMaintenanceEnums() {
  await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_type WHERE typname = 'maintenance_plan_duration'
      ) THEN
        CREATE TYPE maintenance_plan_duration AS ENUM (
          'monthly',
          'quarterly_3m',
          'halfyearly_6m',
          'yearly'
        );
      END IF;
    END$$;
  `);

  await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_type WHERE typname = 'asset_condition'
      ) THEN
        CREATE TYPE asset_condition AS ENUM (
          'new',
          'good',
          'fair',
          'poor'
        );
      END IF;
    END$$;
  `);

  await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_type WHERE typname = 'asset_subscription_status'
      ) THEN
        CREATE TYPE asset_subscription_status AS ENUM (
          'draft',
          'pending_payment',
          'active',
          'paused',
          'expired',
          'cancelled'
        );
      END IF;
    END$$;
  `);

  await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_type WHERE typname = 'maintenance_schedule_status'
      ) THEN
        CREATE TYPE maintenance_schedule_status AS ENUM (
          'upcoming',
          'due',
          'assigned',
          'in_progress',
          'completed',
          'missed',
          'rescheduled',
          'cancelled'
        );
      END IF;
    END$$;
  `);
}

async function ensureMaintenanceTables() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS maintenance_categories (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      name text NOT NULL,
      slug text NOT NULL UNIQUE,
      icon text,
      description text,
      is_active boolean NOT NULL DEFAULT true,
      created_at timestamp DEFAULT now(),
      updated_at timestamp DEFAULT now()
    );
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS maintenance_items (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      category_id varchar NOT NULL REFERENCES maintenance_categories(id),
      name text NOT NULL,
      slug text NOT NULL UNIQUE,
      description text,
      default_frequency maintenance_plan_duration,
      recommended_tasks jsonb,
      image_url text,
      is_active boolean NOT NULL DEFAULT true,
      created_at timestamp DEFAULT now(),
      updated_at timestamp DEFAULT now()
    );
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS resident_assets (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id varchar NOT NULL REFERENCES users(id),
      maintenance_item_id varchar NOT NULL REFERENCES maintenance_items(id),
      estate_id varchar REFERENCES estates(id),
      custom_name text,
      location_label text,
      brand text,
      model text,
      serial_number text,
      purchase_date timestamp,
      installed_at timestamp,
      last_service_date timestamp,
      condition asset_condition NOT NULL DEFAULT 'good',
      notes text,
      metadata jsonb,
      is_active boolean NOT NULL DEFAULT true,
      created_at timestamp DEFAULT now(),
      updated_at timestamp DEFAULT now()
    );
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS maintenance_plans (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      maintenance_item_id varchar NOT NULL REFERENCES maintenance_items(id),
      name text NOT NULL,
      description text,
      duration_type maintenance_plan_duration NOT NULL,
      price numeric(10,2) NOT NULL DEFAULT '0',
      currency varchar(8) NOT NULL DEFAULT 'NGN',
      visits_included integer NOT NULL DEFAULT 1,
      included_tasks jsonb,
      request_lead_days integer NOT NULL DEFAULT 3,
      is_active boolean NOT NULL DEFAULT true,
      created_at timestamp DEFAULT now(),
      updated_at timestamp DEFAULT now()
    );
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS asset_subscriptions (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id varchar NOT NULL REFERENCES users(id),
      resident_asset_id varchar NOT NULL REFERENCES resident_assets(id),
      maintenance_plan_id varchar NOT NULL REFERENCES maintenance_plans(id),
      start_date timestamp NOT NULL,
      end_date timestamp,
      status asset_subscription_status NOT NULL DEFAULT 'draft',
      auto_renew boolean NOT NULL DEFAULT false,
      activated_at timestamp,
      paused_at timestamp,
      expired_at timestamp,
      cancelled_at timestamp,
      billing_amount numeric(10,2) NOT NULL DEFAULT '0',
      currency varchar(8) NOT NULL DEFAULT 'NGN',
      next_schedule_at timestamp,
      created_at timestamp DEFAULT now(),
      updated_at timestamp DEFAULT now()
    );
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS maintenance_schedules (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      subscription_id varchar NOT NULL REFERENCES asset_subscriptions(id),
      scheduled_date timestamp NOT NULL,
      status maintenance_schedule_status NOT NULL DEFAULT 'upcoming',
      completed_at timestamp,
      skipped_at timestamp,
      rescheduled_from varchar REFERENCES maintenance_schedules(id),
      notes text,
      source_request_id varchar REFERENCES service_requests(id) ON DELETE SET NULL,
      created_at timestamp DEFAULT now(),
      updated_at timestamp DEFAULT now()
    );
  `);

  await db.execute(sql`
    ALTER TABLE maintenance_categories
      ADD COLUMN IF NOT EXISTS icon text,
      ADD COLUMN IF NOT EXISTS description text,
      ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
      ADD COLUMN IF NOT EXISTS created_at timestamp DEFAULT now(),
      ADD COLUMN IF NOT EXISTS updated_at timestamp DEFAULT now();
  `);

  await db.execute(sql`
    ALTER TABLE maintenance_items
      ADD COLUMN IF NOT EXISTS description text,
      ADD COLUMN IF NOT EXISTS default_frequency maintenance_plan_duration,
      ADD COLUMN IF NOT EXISTS recommended_tasks jsonb,
      ADD COLUMN IF NOT EXISTS image_url text,
      ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
      ADD COLUMN IF NOT EXISTS created_at timestamp DEFAULT now(),
      ADD COLUMN IF NOT EXISTS updated_at timestamp DEFAULT now();
  `);

  await db.execute(sql`
    ALTER TABLE resident_assets
      ADD COLUMN IF NOT EXISTS estate_id varchar REFERENCES estates(id),
      ADD COLUMN IF NOT EXISTS custom_name text,
      ADD COLUMN IF NOT EXISTS location_label text,
      ADD COLUMN IF NOT EXISTS brand text,
      ADD COLUMN IF NOT EXISTS model text,
      ADD COLUMN IF NOT EXISTS serial_number text,
      ADD COLUMN IF NOT EXISTS purchase_date timestamp,
      ADD COLUMN IF NOT EXISTS installed_at timestamp,
      ADD COLUMN IF NOT EXISTS last_service_date timestamp,
      ADD COLUMN IF NOT EXISTS condition asset_condition NOT NULL DEFAULT 'good',
      ADD COLUMN IF NOT EXISTS notes text,
      ADD COLUMN IF NOT EXISTS metadata jsonb,
      ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
      ADD COLUMN IF NOT EXISTS created_at timestamp DEFAULT now(),
      ADD COLUMN IF NOT EXISTS updated_at timestamp DEFAULT now();
  `);

  await db.execute(sql`
    ALTER TABLE maintenance_plans
      ADD COLUMN IF NOT EXISTS name text,
      ADD COLUMN IF NOT EXISTS description text,
      ADD COLUMN IF NOT EXISTS duration_type maintenance_plan_duration,
      ADD COLUMN IF NOT EXISTS price numeric(10,2) NOT NULL DEFAULT '0',
      ADD COLUMN IF NOT EXISTS currency varchar(8) NOT NULL DEFAULT 'NGN',
      ADD COLUMN IF NOT EXISTS visits_included integer NOT NULL DEFAULT 1,
      ADD COLUMN IF NOT EXISTS included_tasks jsonb,
      ADD COLUMN IF NOT EXISTS request_lead_days integer NOT NULL DEFAULT 3,
      ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
      ADD COLUMN IF NOT EXISTS created_at timestamp DEFAULT now(),
      ADD COLUMN IF NOT EXISTS updated_at timestamp DEFAULT now();
  `);

  await db.execute(sql`
    ALTER TABLE asset_subscriptions
      ADD COLUMN IF NOT EXISTS user_id varchar REFERENCES users(id),
      ADD COLUMN IF NOT EXISTS resident_asset_id varchar REFERENCES resident_assets(id),
      ADD COLUMN IF NOT EXISTS maintenance_plan_id varchar REFERENCES maintenance_plans(id),
      ADD COLUMN IF NOT EXISTS start_date timestamp,
      ADD COLUMN IF NOT EXISTS end_date timestamp,
      ADD COLUMN IF NOT EXISTS status asset_subscription_status NOT NULL DEFAULT 'draft',
      ADD COLUMN IF NOT EXISTS auto_renew boolean NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS activated_at timestamp,
      ADD COLUMN IF NOT EXISTS paused_at timestamp,
      ADD COLUMN IF NOT EXISTS expired_at timestamp,
      ADD COLUMN IF NOT EXISTS cancelled_at timestamp,
      ADD COLUMN IF NOT EXISTS billing_amount numeric(10,2) NOT NULL DEFAULT '0',
      ADD COLUMN IF NOT EXISTS currency varchar(8) NOT NULL DEFAULT 'NGN',
      ADD COLUMN IF NOT EXISTS next_schedule_at timestamp,
      ADD COLUMN IF NOT EXISTS created_at timestamp DEFAULT now(),
      ADD COLUMN IF NOT EXISTS updated_at timestamp DEFAULT now();
  `);

  await db.execute(sql`
    ALTER TABLE maintenance_schedules
      ADD COLUMN IF NOT EXISTS completed_at timestamp,
      ADD COLUMN IF NOT EXISTS skipped_at timestamp,
      ADD COLUMN IF NOT EXISTS rescheduled_from varchar REFERENCES maintenance_schedules(id),
      ADD COLUMN IF NOT EXISTS notes text,
      ADD COLUMN IF NOT EXISTS source_request_id varchar REFERENCES service_requests(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS created_at timestamp DEFAULT now(),
      ADD COLUMN IF NOT EXISTS updated_at timestamp DEFAULT now();
  `);

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS maintenance_items_category_idx
      ON maintenance_items(category_id);
    CREATE INDEX IF NOT EXISTS resident_assets_user_idx
      ON resident_assets(user_id);
    CREATE INDEX IF NOT EXISTS resident_assets_maintenance_item_idx
      ON resident_assets(maintenance_item_id);
    CREATE INDEX IF NOT EXISTS maintenance_plans_maintenance_item_idx
      ON maintenance_plans(maintenance_item_id);
    CREATE INDEX IF NOT EXISTS asset_subscriptions_user_idx
      ON asset_subscriptions(user_id);
    CREATE INDEX IF NOT EXISTS asset_subscriptions_resident_asset_idx
      ON asset_subscriptions(resident_asset_id);
    CREATE INDEX IF NOT EXISTS asset_subscriptions_maintenance_plan_idx
      ON asset_subscriptions(maintenance_plan_id);
    CREATE INDEX IF NOT EXISTS asset_subscriptions_status_idx
      ON asset_subscriptions(status);
    CREATE INDEX IF NOT EXISTS maintenance_schedules_subscription_idx
      ON maintenance_schedules(subscription_id);
    CREATE INDEX IF NOT EXISTS maintenance_schedules_status_idx
      ON maintenance_schedules(status);
    CREATE INDEX IF NOT EXISTS maintenance_schedules_scheduled_date_idx
      ON maintenance_schedules(scheduled_date);
    CREATE INDEX IF NOT EXISTS maintenance_schedules_source_request_idx
      ON maintenance_schedules(source_request_id);
  `);
}

async function ensureOtpTables() {
  await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_type WHERE typname = 'otp_purpose'
      ) THEN
        CREATE TYPE otp_purpose AS ENUM ('signup_verify', 'login_verify');
      END IF;
    END$$;
  `);

  await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_type WHERE typname = 'otp_channel'
      ) THEN
        CREATE TYPE otp_channel AS ENUM ('sms', 'email');
      END IF;
    END$$;
  `);

  await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_type WHERE typname = 'otp_status'
      ) THEN
        CREATE TYPE otp_status AS ENUM ('pending', 'verified', 'expired', 'cancelled', 'locked');
      END IF;
    END$$;
  `);

  await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_type WHERE typname = 'pending_registration_status'
      ) THEN
        CREATE TYPE pending_registration_status AS ENUM ('pending', 'verified', 'expired', 'cancelled');
      END IF;
    END$$;
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS pending_registrations (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      role user_role NOT NULL,
      payload jsonb NOT NULL DEFAULT '{}'::jsonb,
      contact_channel otp_channel NOT NULL,
      contact_value text NOT NULL,
      status pending_registration_status NOT NULL DEFAULT 'pending',
      expires_at timestamp NOT NULL,
      created_at timestamp DEFAULT now(),
      updated_at timestamp DEFAULT now()
    );
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS otp_challenges (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id varchar REFERENCES users(id) ON DELETE CASCADE,
      pending_registration_id varchar REFERENCES pending_registrations(id) ON DELETE CASCADE,
      purpose otp_purpose NOT NULL,
      channel otp_channel NOT NULL,
      destination text NOT NULL,
      code_hash text NOT NULL,
      status otp_status NOT NULL DEFAULT 'pending',
      attempt_count integer NOT NULL DEFAULT 0,
      max_attempts integer NOT NULL DEFAULT 5,
      expires_at timestamp NOT NULL,
      last_sent_at timestamp DEFAULT now(),
      verified_at timestamp,
      created_at timestamp DEFAULT now(),
      updated_at timestamp DEFAULT now()
    );
  `);

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS pending_registrations_contact_value_idx
      ON pending_registrations (contact_value);
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS pending_registrations_status_expires_idx
      ON pending_registrations (status, expires_at);
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS otp_challenges_destination_purpose_status_idx
      ON otp_challenges (destination, purpose, status);
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS otp_challenges_expires_idx
      ON otp_challenges (expires_at);
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
  await db.execute(sql`
    ALTER TABLE users
      ADD COLUMN IF NOT EXISTS username text,
      ADD COLUMN IF NOT EXISTS profile_image text,
      ADD COLUMN IF NOT EXISTS bio text,
      ADD COLUMN IF NOT EXISTS website text,
      ADD COLUMN IF NOT EXISTS country_code varchar(2),
      ADD COLUMN IF NOT EXISTS timezone text;
  `);
  await db.execute(sql`
    DO $$
    BEGIN
      CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_lower_unique
        ON users (lower(email));
    EXCEPTION
      WHEN unique_violation THEN
        RAISE NOTICE 'Skipping idx_users_email_lower_unique due to existing duplicate emails';
    END$$;
  `);
  await db.execute(sql`
    DO $$
    BEGIN
      CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username_lower_unique
        ON users (lower(username))
        WHERE username IS NOT NULL;
    EXCEPTION
      WHEN unique_violation THEN
        RAISE NOTICE 'Skipping idx_users_username_lower_unique due to existing duplicate usernames';
    END$$;
  `);
  await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'users_username_length_check'
      ) THEN
        ALTER TABLE users
          ADD CONSTRAINT users_username_length_check
          CHECK (username IS NULL OR char_length(username) BETWEEN 3 AND 30);
      END IF;
    END$$;
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

async function ensureResidentSettingsTables() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS resident_notification_preferences (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      event_key varchar(64) NOT NULL,
      in_app_enabled boolean NOT NULL DEFAULT true,
      email_enabled boolean NOT NULL DEFAULT false,
      sms_enabled boolean NOT NULL DEFAULT false,
      created_at timestamp NOT NULL DEFAULT now(),
      updated_at timestamp NOT NULL DEFAULT now(),
      UNIQUE (user_id, event_key)
    );
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS resident_settings (
      user_id varchar PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      quiet_hours_enabled boolean NOT NULL DEFAULT false,
      quiet_hours_start varchar(5),
      quiet_hours_end varchar(5),
      digest_frequency varchar(16) NOT NULL DEFAULT 'off',
      login_alerts_enabled boolean NOT NULL DEFAULT true,
      profile_visibility varchar(16) NOT NULL DEFAULT 'private',
      show_phone_to_provider boolean NOT NULL DEFAULT false,
      show_email_to_provider boolean NOT NULL DEFAULT false,
      allow_marketing boolean NOT NULL DEFAULT false,
      allow_analytics boolean NOT NULL DEFAULT true,
      allow_personalization boolean NOT NULL DEFAULT true,
      created_at timestamp NOT NULL DEFAULT now(),
      updated_at timestamp NOT NULL DEFAULT now()
    );
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS user_device_sessions (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      session_id text NOT NULL UNIQUE,
      user_agent text,
      ip_address text,
      last_seen_at timestamp NOT NULL DEFAULT now(),
      revoked_at timestamp,
      created_at timestamp NOT NULL DEFAULT now()
    );
  `);

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_user_device_sessions_user_active_last_seen
      ON user_device_sessions(user_id, revoked_at, last_seen_at DESC);
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

async function ensureServiceRequestCancellationCasesTable() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS service_request_cancellation_cases (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      request_id varchar NOT NULL REFERENCES service_requests(id) ON DELETE CASCADE,
      resident_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      status text NOT NULL DEFAULT 'requested',
      reason_code text NOT NULL,
      reason_detail text NOT NULL,
      preferred_resolution text NOT NULL DEFAULT 'full_refund',
      evidence jsonb NOT NULL DEFAULT '[]'::jsonb,
      admin_decision text,
      admin_note text,
      refund_decision text NOT NULL DEFAULT 'none',
      refund_amount numeric(10,2),
      assigned_admin_id varchar REFERENCES users(id),
      provider_feedback text,
      company_feedback text,
      resolved_at timestamp,
      created_at timestamp NOT NULL DEFAULT now(),
      updated_at timestamp NOT NULL DEFAULT now()
    );
  `);

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_src_cases_request_id
      ON service_request_cancellation_cases(request_id);
    CREATE INDEX IF NOT EXISTS idx_src_cases_status_created_at
      ON service_request_cancellation_cases(status, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_src_cases_resident_id
      ON service_request_cancellation_cases(resident_id);
  `);

  await db.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS uniq_open_src_case_per_request
      ON service_request_cancellation_cases(request_id)
      WHERE status IN ('requested', 'under_review');
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
          'welder', 'mechanic', 'phone_repair', 'appliance_repair', 'tailor', 'market_runner', 'item_vendor',
          'surveillance_monitoring', 'alarm_system', 'cleaning_janitorial', 'catering_services', 'it_support',
          'maintenance_repair', 'general_repairs', 'locksmith', 'glass_windows', 'packaging_solutions',
          'marketing_advertising', 'home_tutors', 'furniture_making'
        );
      END IF;
    END$$;
  `);

  await db.execute(sql`
    ALTER TYPE service_category ADD VALUE IF NOT EXISTS 'general_repairs';
    ALTER TYPE service_category ADD VALUE IF NOT EXISTS 'locksmith';
    ALTER TYPE service_category ADD VALUE IF NOT EXISTS 'glass_windows';
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

  await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_type WHERE typname = 'ordinary_flow_scope'
      ) THEN
        CREATE TYPE ordinary_flow_scope AS ENUM ('global', 'estate');
      END IF;
    END$$;
  `);

  await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_type WHERE typname = 'ordinary_flow_definition_status'
      ) THEN
        CREATE TYPE ordinary_flow_definition_status AS ENUM ('draft', 'published', 'archived');
      END IF;
    END$$;
  `);

  await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_type WHERE typname = 'ordinary_flow_input_type'
      ) THEN
        CREATE TYPE ordinary_flow_input_type AS ENUM (
          'single_select',
          'multi_select',
          'text',
          'number',
          'date',
          'time',
          'datetime',
          'location',
          'file',
          'yes_no',
          'urgency',
          'estate'
        );
      END IF;
    END$$;
  `);

  await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_type WHERE typname = 'ordinary_flow_rule_action'
      ) THEN
        CREATE TYPE ordinary_flow_rule_action AS ENUM ('goto_question', 'terminate', 'set_value', 'skip');
      END IF;
    END$$;
  `);

  await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_type WHERE typname = 'ordinary_flow_session_status'
      ) THEN
        CREATE TYPE ordinary_flow_session_status AS ENUM ('active', 'completed', 'cancelled');
      END IF;
    END$$;
  `);

  await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_type WHERE typname = 'ordinary_flow_answered_by'
      ) THEN
        CREATE TYPE ordinary_flow_answered_by AS ENUM ('resident', 'admin', 'system');
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

async function ensureCompanyTasksTables() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS company_tasks (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      company_id varchar NOT NULL REFERENCES companies(id),
      title text NOT NULL,
      description text,
      assignee_id varchar REFERENCES users(id),
      created_by varchar NOT NULL REFERENCES users(id),
      priority text NOT NULL DEFAULT 'medium',
      status text NOT NULL DEFAULT 'open',
      due_date timestamp,
      service_request_id varchar REFERENCES service_requests(id),
      metadata jsonb NOT NULL DEFAULT '{}',
      completed_at timestamp,
      created_at timestamp DEFAULT now(),
      updated_at timestamp DEFAULT now()
    );
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS company_task_updates (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      task_id varchar NOT NULL REFERENCES company_tasks(id) ON DELETE CASCADE,
      author_id varchar NOT NULL REFERENCES users(id),
      message text NOT NULL,
      attachments jsonb NOT NULL DEFAULT '[]',
      created_at timestamp DEFAULT now()
    );
  `);

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_company_tasks_company_id ON company_tasks(company_id);
    CREATE INDEX IF NOT EXISTS idx_company_tasks_assignee_id ON company_tasks(assignee_id);
    CREATE INDEX IF NOT EXISTS idx_company_tasks_status ON company_tasks(status);
    CREATE INDEX IF NOT EXISTS idx_company_task_updates_task_id_created_at
      ON company_task_updates(task_id, created_at);
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

async function ensureOrdinaryFlowTables() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS ordinary_flow_definitions (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      category_key text NOT NULL,
      scope ordinary_flow_scope NOT NULL DEFAULT 'global',
      estate_id varchar,
      name text NOT NULL,
      version integer NOT NULL DEFAULT 1,
      status ordinary_flow_definition_status NOT NULL DEFAULT 'draft',
      published_at timestamp,
      published_by varchar,
      created_by varchar,
      is_default boolean NOT NULL DEFAULT false,
      created_at timestamp DEFAULT now(),
      updated_at timestamp DEFAULT now()
    );
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS ordinary_flow_questions (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      flow_id varchar NOT NULL REFERENCES ordinary_flow_definitions(id) ON DELETE CASCADE,
      question_key text NOT NULL,
      prompt text NOT NULL,
      description text,
      input_type ordinary_flow_input_type NOT NULL DEFAULT 'text',
      is_required boolean NOT NULL DEFAULT true,
      is_terminal boolean NOT NULL DEFAULT false,
      order_index integer NOT NULL DEFAULT 0,
      validation jsonb NOT NULL DEFAULT '{}',
      ui_meta jsonb NOT NULL DEFAULT '{}',
      default_next_question_id varchar REFERENCES ordinary_flow_questions(id) ON DELETE SET NULL,
      created_at timestamp DEFAULT now(),
      updated_at timestamp DEFAULT now()
    );
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS ordinary_flow_options (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      question_id varchar NOT NULL REFERENCES ordinary_flow_questions(id) ON DELETE CASCADE,
      option_key text NOT NULL,
      label text NOT NULL,
      value text NOT NULL,
      icon text,
      order_index integer NOT NULL DEFAULT 0,
      next_question_id varchar REFERENCES ordinary_flow_questions(id) ON DELETE SET NULL,
      meta jsonb NOT NULL DEFAULT '{}'
    );
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS ordinary_flow_rules (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      flow_id varchar NOT NULL REFERENCES ordinary_flow_definitions(id) ON DELETE CASCADE,
      from_question_id varchar NOT NULL REFERENCES ordinary_flow_questions(id) ON DELETE CASCADE,
      priority integer NOT NULL DEFAULT 100,
      condition_json jsonb NOT NULL DEFAULT '{}',
      action ordinary_flow_rule_action NOT NULL DEFAULT 'goto_question',
      next_question_id varchar REFERENCES ordinary_flow_questions(id) ON DELETE SET NULL,
      action_payload jsonb NOT NULL DEFAULT '{}',
      is_active boolean NOT NULL DEFAULT true,
      created_at timestamp DEFAULT now(),
      updated_at timestamp DEFAULT now()
    );
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS ordinary_flow_sessions (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      request_id varchar NOT NULL UNIQUE,
      resident_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      category_key text NOT NULL,
      flow_id varchar NOT NULL REFERENCES ordinary_flow_definitions(id) ON DELETE CASCADE,
      flow_version integer NOT NULL,
      status ordinary_flow_session_status NOT NULL DEFAULT 'active',
      current_question_id varchar REFERENCES ordinary_flow_questions(id) ON DELETE SET NULL,
      answers_snapshot jsonb NOT NULL DEFAULT '{}',
      active_path jsonb NOT NULL DEFAULT '[]',
      state_revision integer NOT NULL DEFAULT 0,
      started_at timestamp DEFAULT now(),
      completed_at timestamp,
      updated_at timestamp DEFAULT now()
    );
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS ordinary_flow_answers (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      session_id varchar NOT NULL REFERENCES ordinary_flow_sessions(id) ON DELETE CASCADE,
      question_id varchar NOT NULL REFERENCES ordinary_flow_questions(id) ON DELETE CASCADE,
      question_key text NOT NULL,
      answer_json jsonb NOT NULL DEFAULT '{}',
      answered_by ordinary_flow_answered_by NOT NULL DEFAULT 'resident',
      revision integer NOT NULL DEFAULT 1,
      answered_at timestamp DEFAULT now()
    );
  `);

  await db.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS ordinary_flow_definitions_unique_version
      ON ordinary_flow_definitions(category_key, scope, COALESCE(estate_id, ''), version);
    CREATE UNIQUE INDEX IF NOT EXISTS ordinary_flow_questions_unique_key
      ON ordinary_flow_questions(flow_id, question_key);
    CREATE UNIQUE INDEX IF NOT EXISTS ordinary_flow_options_unique_key
      ON ordinary_flow_options(question_id, option_key);
    CREATE UNIQUE INDEX IF NOT EXISTS ordinary_flow_answers_unique_question
      ON ordinary_flow_answers(session_id, question_id);
    CREATE INDEX IF NOT EXISTS ordinary_flow_rules_from_priority_idx
      ON ordinary_flow_rules(flow_id, from_question_id, priority);
    CREATE INDEX IF NOT EXISTS ordinary_flow_sessions_resident_status_updated_idx
      ON ordinary_flow_sessions(resident_id, status, updated_at DESC);
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
        'â‚¦299,000',
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
        'â‚¦450,000',
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
        'â‚¦2,499,000',
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

// â”€â”€ Marketplace V2 tables â”€â”€
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

async function ensureMarketTrendTables() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS market_trend_series (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      name text NOT NULL,
      slug varchar(120) NOT NULL,
      color varchar(20) NOT NULL DEFAULT '#039855',
      unit varchar(20) NOT NULL DEFAULT 'NGN',
      position integer NOT NULL DEFAULT 0,
      is_active boolean NOT NULL DEFAULT true,
      created_by varchar REFERENCES users(id),
      created_at timestamp DEFAULT now(),
      updated_at timestamp DEFAULT now()
    );
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS market_trend_points (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      series_id varchar NOT NULL REFERENCES market_trend_series(id) ON DELETE CASCADE,
      month_index integer NOT NULL,
      value numeric(12, 2) NOT NULL DEFAULT 0,
      created_at timestamp DEFAULT now(),
      updated_at timestamp DEFAULT now()
    );
  `);

  await db.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS market_trend_series_slug_unique
    ON market_trend_series (slug);
  `);

  await db.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS market_trend_points_series_month_unique
    ON market_trend_points (series_id, month_index);
  `);
}

async function seedMarketTrends() {
  const seeded = await db.execute(sql`
    SELECT COUNT(*)::int AS count FROM market_trend_series;
  `);
  const currentCount = Number((seeded as any)?.rows?.[0]?.count || 0);
  if (currentCount > 0) return;

  await db.execute(sql`
    INSERT INTO market_trend_series (name, slug, color, unit, position, is_active)
    VALUES
      ('Bag of Rice', 'bag-of-rice', '#05603A', 'NGN', 1, true),
      ('Crate of Eggs', 'crate-of-eggs', '#32D583', 'NGN', 2, true),
      ('Tuber of Yam', 'tuber-of-yam', '#039855', 'NGN', 3, true);
  `);

  await db.execute(sql`
    INSERT INTO market_trend_points (series_id, month_index, value)
    SELECT mts.id, values_table.month_index, values_table.value
    FROM market_trend_series mts
    JOIN (
      VALUES
        ('bag-of-rice', 1, 50), ('bag-of-rice', 2, 80), ('bag-of-rice', 3, 120), ('bag-of-rice', 4, 150),
        ('bag-of-rice', 5, 180), ('bag-of-rice', 6, 210), ('bag-of-rice', 7, 240), ('bag-of-rice', 8, 200),
        ('bag-of-rice', 9, 280), ('bag-of-rice', 10, 320), ('bag-of-rice', 11, 380), ('bag-of-rice', 12, 420),
        ('crate-of-eggs', 1, 320), ('crate-of-eggs', 2, 340), ('crate-of-eggs', 3, 360), ('crate-of-eggs', 4, 370),
        ('crate-of-eggs', 5, 380), ('crate-of-eggs', 6, 390), ('crate-of-eggs', 7, 400), ('crate-of-eggs', 8, 420),
        ('crate-of-eggs', 9, 440), ('crate-of-eggs', 10, 450), ('crate-of-eggs', 11, 460), ('crate-of-eggs', 12, 470),
        ('tuber-of-yam', 1, 600), ('tuber-of-yam', 2, 620), ('tuber-of-yam', 3, 640), ('tuber-of-yam', 4, 660),
        ('tuber-of-yam', 5, 680), ('tuber-of-yam', 6, 700), ('tuber-of-yam', 7, 650), ('tuber-of-yam', 8, 600),
        ('tuber-of-yam', 9, 720), ('tuber-of-yam', 10, 760), ('tuber-of-yam', 11, 780), ('tuber-of-yam', 12, 800)
    ) AS values_table (slug, month_index, value)
      ON values_table.slug = mts.slug;
  `);

  log("[SEED] Market trends seeded successfully");
}

// Boot sequence - start immediately without IIFE
let bootPromise = (async () => {
  console.log("[BOOT] Starting boot sequence...");
  try {
    await dbReady;
    // Create required extensions and enums first to avoid ALTER type errors
    await ensureExtensionsAndEnums();
    await ensureServiceStatusValues();
    await ensureServiceRequestsTable();
    await ensureServiceRequestCancellationCasesTable();
    await ensureUsersTable();
    await ensureUsersColumns();
    await ensureServiceRequestsColumns();
    await ensureMaintenanceEnums();
    await ensureMaintenanceTables();
    await ensureOtpTables();
    await ensureEstatesColumns();
    await ensureStoresColumns();
    await ensureCompaniesTable();
    await ensureNotificationsTable();
    await ensureResidentSettingsTables();
    await ensureProviderRequestsTable();
    await ensureTransactionsColumns();
    await ensureMongoIdMappingTable();
    await ensureConversationsTable();
    await ensureConversationMessagesTable();
    await ensureCompanyTasksTables();
    await ensureRequestConversationSettingsTable();
    await ensureRequestQuestionsTable();
    await ensureOrdinaryFlowTables();
    await ensureAiSessionsTables();
    await ensureMarketplaceV2Tables();
    await ensureMarketTrendTables();
    await seedRequestConfigDefaults();
    await seedCityMartBanners();
    await seedMarketTrends();
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

  // Global error handler â€” do NOT throw/rethrow
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
    log(`âœ“ Server is now listening on ${host}:${port}`);
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
