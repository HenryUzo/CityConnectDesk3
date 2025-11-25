-- Add provider_id column to provider_requests table if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'provider_requests' 
    AND column_name = 'provider_id'
  ) THEN
    ALTER TABLE provider_requests 
    ADD COLUMN provider_id VARCHAR REFERENCES users(id);
  END IF;
END $$;
