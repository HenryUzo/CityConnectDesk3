-- Add first_name and last_name to users and backfill from name
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS first_name text,
  ADD COLUMN IF NOT EXISTS last_name text;

-- Backfill: split name into first and last (first token -> first_name, rest -> last_name)
UPDATE users
SET
  first_name = split_part(name, ' ', 1),
  last_name = NULLIF(trim(substr(name, length(split_part(name, ' ', 1)) + 2)), '')
WHERE (first_name IS NULL OR first_name = '') AND (name IS NOT NULL AND name <> '');
