CREATE TABLE IF NOT EXISTS mongo_id_mappings (
  id varchar(255) PRIMARY KEY DEFAULT gen_random_uuid(),
  mongo_id text NOT NULL,
  postgres_id varchar(255) NOT NULL,
  entity_type text NOT NULL,
  created_at timestamp NOT NULL DEFAULT now()
);
