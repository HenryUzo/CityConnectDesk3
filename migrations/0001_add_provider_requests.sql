CREATE TABLE IF NOT EXISTS provider_requests (
  id varchar(255) PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text NOT NULL,
  phone text,
  company text,
  categories varchar(100)[] DEFAULT '{}',
  experience integer NOT NULL DEFAULT 0,
  description text,
  created_at timestamp NOT NULL DEFAULT now()
);
