ALTER TABLE categories
ADD COLUMN IF NOT EXISTS tag text NOT NULL DEFAULT 'Facility Management 🏗️';
