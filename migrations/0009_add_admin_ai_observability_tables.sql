-- Super Admin AI observability/config tables

CREATE TABLE IF NOT EXISTS "ai_prepared_requests" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "session_id" text NOT NULL UNIQUE,
  "resident_hash" text NOT NULL,
  "estate_id" varchar REFERENCES "estates"("id"),
  "category" service_category NOT NULL,
  "urgency" urgency NOT NULL,
  "recommended_approach" text NOT NULL,
  "confidence_score" integer NOT NULL DEFAULT 0,
  "requires_consultancy" boolean NOT NULL DEFAULT false,
  "ready_to_book" boolean NOT NULL DEFAULT false,
  "snapshot" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "pricing_rules" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" text NOT NULL,
  "category" service_category,
  "scope" text,
  "urgency" urgency,
  "min_price" numeric(10,2) NOT NULL DEFAULT 0,
  "max_price" numeric(10,2) NOT NULL DEFAULT 0,
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "provider_matching_settings" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "provider_id" varchar NOT NULL UNIQUE REFERENCES "users"("id") ON DELETE CASCADE,
  "is_enabled" boolean NOT NULL DEFAULT true,
  "settings" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "updated_at" timestamp DEFAULT now()
);
