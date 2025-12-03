-- Add advice and inspection fields to service_requests table
ALTER TABLE service_requests 
ADD COLUMN IF NOT EXISTS advice_message text,
ADD COLUMN IF NOT EXISTS inspection_dates text[],
ADD COLUMN IF NOT EXISTS inspection_times text[];
