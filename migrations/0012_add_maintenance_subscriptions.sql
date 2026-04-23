DO $$
BEGIN
  CREATE TYPE maintenance_plan_duration AS ENUM ('monthly', 'quarterly_3m', 'halfyearly_6m', 'yearly');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE asset_condition AS ENUM ('new', 'good', 'fair', 'poor');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE asset_subscription_status AS ENUM ('draft', 'pending_payment', 'active', 'paused', 'expired', 'cancelled');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE maintenance_schedule_status AS ENUM ('upcoming', 'due', 'assigned', 'in_progress', 'completed', 'missed', 'rescheduled', 'cancelled');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS maintenance_categories (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  icon TEXT,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

CREATE TABLE IF NOT EXISTS maintenance_items (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id VARCHAR NOT NULL REFERENCES maintenance_categories(id),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  default_frequency maintenance_plan_duration,
  recommended_tasks JSONB,
  image_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

CREATE TABLE IF NOT EXISTS resident_assets (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR NOT NULL REFERENCES users(id),
  maintenance_item_id VARCHAR NOT NULL REFERENCES maintenance_items(id),
  estate_id VARCHAR REFERENCES estates(id),
  custom_name TEXT,
  location_label TEXT,
  brand TEXT,
  model TEXT,
  serial_number TEXT,
  purchase_date TIMESTAMP,
  installed_at TIMESTAMP,
  last_service_date TIMESTAMP,
  condition asset_condition NOT NULL DEFAULT 'good',
  notes TEXT,
  metadata JSONB,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

CREATE TABLE IF NOT EXISTS maintenance_plans (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  maintenance_item_id VARCHAR NOT NULL REFERENCES maintenance_items(id),
  name TEXT NOT NULL,
  description TEXT,
  duration_type maintenance_plan_duration NOT NULL,
  price NUMERIC(10, 2) NOT NULL DEFAULT 0,
  currency VARCHAR(8) NOT NULL DEFAULT 'NGN',
  visits_included INTEGER NOT NULL DEFAULT 1,
  included_tasks JSONB,
  request_lead_days INTEGER NOT NULL DEFAULT 3,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

CREATE TABLE IF NOT EXISTS asset_subscriptions (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR NOT NULL REFERENCES users(id),
  resident_asset_id VARCHAR NOT NULL REFERENCES resident_assets(id),
  maintenance_plan_id VARCHAR NOT NULL REFERENCES maintenance_plans(id),
  start_date TIMESTAMP NOT NULL,
  end_date TIMESTAMP,
  status asset_subscription_status NOT NULL DEFAULT 'draft',
  auto_renew BOOLEAN NOT NULL DEFAULT FALSE,
  activated_at TIMESTAMP,
  paused_at TIMESTAMP,
  expired_at TIMESTAMP,
  cancelled_at TIMESTAMP,
  billing_amount NUMERIC(10, 2) NOT NULL DEFAULT 0,
  currency VARCHAR(8) NOT NULL DEFAULT 'NGN',
  next_schedule_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

CREATE TABLE IF NOT EXISTS maintenance_schedules (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id VARCHAR NOT NULL REFERENCES asset_subscriptions(id),
  scheduled_date TIMESTAMP NOT NULL,
  status maintenance_schedule_status NOT NULL DEFAULT 'upcoming',
  completed_at TIMESTAMP,
  skipped_at TIMESTAMP,
  rescheduled_from VARCHAR REFERENCES maintenance_schedules(id),
  notes TEXT,
  source_request_id VARCHAR REFERENCES service_requests(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

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
