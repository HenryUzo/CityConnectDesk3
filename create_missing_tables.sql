-- Create enums if they don't exist
DO $$ BEGIN
    CREATE TYPE category_scope AS ENUM ('global', 'estate');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE service_status AS ENUM ('pending', 'pending_inspection', 'assigned', 'in_progress', 'completed', 'cancelled');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE urgency AS ENUM ('low', 'medium', 'high', 'emergency');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE service_category AS ENUM ('electrician', 'plumber', 'carpenter', 'hvac_technician', 'painter', 'tiler', 'mason', 'roofer', 'gardener', 'cleaner', 'security_guard', 'cook', 'laundry_service', 'pest_control', 'welder', 'mechanic', 'phone_repair', 'appliance_repair', 'tailor', 'surveillance_monitoring', 'alarm_system', 'cleaning_janitorial', 'catering_services', 'it_support', 'maintenance_repair', 'packaging_solutions', 'marketing_advertising', 'home_tutors', 'furniture_making', 'market_runner', 'item_vendor');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE store_approval_status AS ENUM ('pending', 'approved', 'rejected');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- Create estates table
CREATE TABLE IF NOT EXISTS estates (
  id varchar(255) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  description text,
  address text NOT NULL,
  coverage jsonb NOT NULL,
  settings jsonb NOT NULL DEFAULT '{"servicesEnabled":[],"marketplaceEnabled":true,"paymentMethods":[],"deliveryRules":{}}',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

-- Create item_categories table
CREATE TABLE IF NOT EXISTS item_categories (
  id varchar(255) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name text NOT NULL,
  description text,
  emoji text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

-- Create stores table
CREATE TABLE IF NOT EXISTS stores (
  id varchar(255) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  estate_id varchar(255),
  owner_id varchar(255),
  name text NOT NULL,
  description text,
  location text NOT NULL,
  latitude double precision,
  longitude double precision,
  phone text,
  email text,
  logo text,
  approval_status store_approval_status NOT NULL DEFAULT 'pending',
  approved_by varchar(255),
  approved_at timestamp,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

-- Create audit_logs table
CREATE TABLE IF NOT EXISTS audit_logs (
  id varchar(255) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  actor_id varchar(255) NOT NULL,
  estate_id varchar(255),
  action text NOT NULL,
  target text NOT NULL,
  target_id text NOT NULL,
  meta jsonb NOT NULL DEFAULT '{}',
  ip_address text,
  user_agent text,
  created_at timestamp DEFAULT now()
);

-- Create categories table
CREATE TABLE IF NOT EXISTS categories (
  id varchar(255) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  scope category_scope NOT NULL,
  estate_id varchar(255),
  name text NOT NULL,
  key text NOT NULL,
  emoji text,
  description text,
  icon text,
  tag text NOT NULL DEFAULT 'Facility Management 🏗️',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

-- Create service_requests table
CREATE TABLE IF NOT EXISTS service_requests (
  id varchar(255) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  estate_id varchar(255),
  category service_category NOT NULL,
  description text NOT NULL,
  resident_id varchar(255) NOT NULL,
  provider_id varchar(255),
  status service_status NOT NULL DEFAULT 'pending',
  budget text NOT NULL,
  urgency urgency NOT NULL,
  location text NOT NULL,
  latitude double precision,
  longitude double precision,
  preferred_time timestamp,
  special_instructions text,
  advice_message text,
  inspection_dates text[],
  inspection_times text[],
  admin_notes text,
  assigned_at timestamp,
  closed_at timestamp,
  close_reason text,
  billed_amount decimal(10, 2) DEFAULT 0,
  payment_status text DEFAULT 'pending',
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

-- Create indices for better query performance
CREATE INDEX IF NOT EXISTS idx_estates_slug ON estates(slug);
CREATE INDEX IF NOT EXISTS idx_estates_active ON estates(is_active);
CREATE INDEX IF NOT EXISTS idx_audit_logs_estate_id ON audit_logs(estate_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_id ON audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_categories_estate_id ON categories(estate_id);
CREATE INDEX IF NOT EXISTS idx_categories_scope ON categories(scope);
CREATE INDEX IF NOT EXISTS idx_categories_key ON categories(key);
CREATE INDEX IF NOT EXISTS idx_item_categories_active ON item_categories(is_active);
CREATE INDEX IF NOT EXISTS idx_stores_estate_id ON stores(estate_id);
CREATE INDEX IF NOT EXISTS idx_stores_owner_id ON stores(owner_id);
CREATE INDEX IF NOT EXISTS idx_stores_approval_status ON stores(approval_status);
CREATE INDEX IF NOT EXISTS idx_stores_created_at ON stores(created_at);
CREATE INDEX IF NOT EXISTS idx_service_requests_estate_id ON service_requests(estate_id);
CREATE INDEX IF NOT EXISTS idx_service_requests_resident_id ON service_requests(resident_id);
CREATE INDEX IF NOT EXISTS idx_service_requests_provider_id ON service_requests(provider_id);
CREATE INDEX IF NOT EXISTS idx_service_requests_status ON service_requests(status);
CREATE INDEX IF NOT EXISTS idx_service_requests_category ON service_requests(category);
CREATE INDEX IF NOT EXISTS idx_service_requests_created_at ON service_requests(created_at);
