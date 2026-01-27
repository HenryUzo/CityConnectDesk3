-- Migration: add ai_prepared_requests observability table
-- Run this against your Postgres dev database (psql or migration tool)

CREATE TABLE IF NOT EXISTS ai_prepared_requests (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id text NOT NULL UNIQUE,
  resident_hash text NOT NULL,
  estate_id varchar REFERENCES estates(id),
  category service_category NOT NULL,
  urgency urgency NOT NULL,
  recommended_approach text NOT NULL,
  confidence_score integer NOT NULL DEFAULT 0,
  requires_consultancy boolean NOT NULL DEFAULT false,
  ready_to_book boolean NOT NULL DEFAULT false,
  snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

-- Helpful indexes
CREATE INDEX IF NOT EXISTS ai_prepared_requests_resident_hash_idx ON ai_prepared_requests (resident_hash);
CREATE INDEX IF NOT EXISTS ai_prepared_requests_created_at_idx ON ai_prepared_requests (created_at);
