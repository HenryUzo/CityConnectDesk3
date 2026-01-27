-- Add missing columns to companies table for new flat structure
ALTER TABLE companies
ADD COLUMN IF NOT EXISTS business_details jsonb,
ADD COLUMN IF NOT EXISTS bank_details jsonb,
ADD COLUMN IF NOT EXISTS location_details jsonb,
ADD COLUMN IF NOT EXISTS submitted_at timestamp;
