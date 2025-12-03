ALTER TABLE "transactions"
  ADD COLUMN IF NOT EXISTS "reference" text,
  ADD COLUMN IF NOT EXISTS "gateway" text DEFAULT 'paystack',
  ADD COLUMN IF NOT EXISTS "meta" jsonb DEFAULT '{}'::jsonb;

-- Ensure existing rows have unique references by backfilling with generated UUIDs
UPDATE "transactions"
SET "reference" = COALESCE("reference", gen_random_uuid()::text)
WHERE "reference" IS NULL;

ALTER TABLE "transactions"
  ALTER COLUMN "reference" SET NOT NULL,
  ADD CONSTRAINT "transactions_reference_unique" UNIQUE ("reference");
