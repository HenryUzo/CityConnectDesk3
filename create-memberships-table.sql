-- Create enum types for memberships table
CREATE TYPE user_role AS ENUM (
  'resident',
  'provider',
  'admin',
  'super_admin',
  'estate_admin',
  'moderator'
);

CREATE TYPE membership_status AS ENUM (
  'pending',
  'active',
  'suspended',
  'rejected',
  'left'
);

-- Create memberships table
CREATE TABLE memberships (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR NOT NULL REFERENCES "User"(id),
  estate_id VARCHAR NOT NULL REFERENCES estates(id),
  role user_role NOT NULL,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  status membership_status NOT NULL DEFAULT 'active',
  is_active BOOLEAN NOT NULL DEFAULT true,
  permissions TEXT[],
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX idx_memberships_user_id ON memberships(user_id);
CREATE INDEX idx_memberships_estate_id ON memberships(estate_id);
CREATE INDEX idx_memberships_user_estate ON memberships(user_id, estate_id);
