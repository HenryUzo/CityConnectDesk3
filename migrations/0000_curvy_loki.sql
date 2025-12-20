DO $$ BEGIN
IF NOT EXISTS (
	SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
	WHERE t.typname = 'service_category' AND n.nspname = 'public'
) THEN
	CREATE TYPE "public"."service_category" AS ENUM('electrician', 'plumber', 'carpenter', 'hvac_technician', 'painter', 'tiler', 'mason', 'roofer', 'gardener', 'cleaner', 'security_guard', 'cook', 'laundry_service', 'pest_control', 'welder', 'mechanic', 'phone_repair', 'appliance_repair', 'tailor', 'market_runner');
END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
IF NOT EXISTS (
	SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
	WHERE t.typname = 'service_status' AND n.nspname = 'public'
) THEN
	CREATE TYPE "public"."service_status" AS ENUM('pending', 'assigned', 'in_progress', 'completed', 'cancelled');
END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
IF NOT EXISTS (
	SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
	WHERE t.typname = 'transaction_status' AND n.nspname = 'public'
) THEN
	CREATE TYPE "public"."transaction_status" AS ENUM('pending', 'completed', 'failed');
END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
IF NOT EXISTS (
	SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
	WHERE t.typname = 'transaction_type' AND n.nspname = 'public'
) THEN
	CREATE TYPE "public"."transaction_type" AS ENUM('debit', 'credit');
END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
IF NOT EXISTS (
	SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
	WHERE t.typname = 'urgency' AND n.nspname = 'public'
) THEN
	CREATE TYPE "public"."urgency" AS ENUM('low', 'medium', 'high', 'emergency');
END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
IF NOT EXISTS (
	SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
	WHERE t.typname = 'user_role' AND n.nspname = 'public'
) THEN
	CREATE TYPE "public"."user_role" AS ENUM('resident', 'provider', 'admin');
END IF;
END $$;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "service_requests" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category" "service_category" NOT NULL,
	"description" text NOT NULL,
	"resident_id" varchar NOT NULL,
	"provider_id" varchar,
	"status" "service_status" DEFAULT 'pending' NOT NULL,
	"budget" text NOT NULL,
	"urgency" "urgency" NOT NULL,
	"location" text NOT NULL,
	"latitude" double precision,
	"longitude" double precision,
	"preferred_time" timestamp,
	"special_instructions" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "transactions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"wallet_id" varchar NOT NULL,
	"service_request_id" varchar,
	"amount" numeric(10, 2) NOT NULL,
	"type" "transaction_type" NOT NULL,
	"status" "transaction_status" DEFAULT 'pending' NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text NOT NULL,
	"password" text NOT NULL,
	"access_code" text,
	"role" "user_role" DEFAULT 'resident' NOT NULL,
	"rating" numeric(3, 2) DEFAULT '0',
	"is_active" boolean DEFAULT true NOT NULL,
	"is_approved" boolean DEFAULT true NOT NULL,
	"categories" varchar(100)[],
	"service_category" "service_category",
	"experience" integer,
	"location" text,
	"latitude" double precision,
	"longitude" double precision,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "wallets" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"balance" numeric(10, 2) DEFAULT '0' NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
DO $$ BEGIN
IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'service_requests_resident_id_users_id_fk') AND EXISTS (
	SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'service_requests' AND column_name = 'resident_id'
) THEN
	ALTER TABLE "service_requests" ADD CONSTRAINT "service_requests_resident_id_users_id_fk" FOREIGN KEY ("resident_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'service_requests_provider_id_users_id_fk') AND EXISTS (
	SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'service_requests' AND column_name = 'provider_id'
) THEN
	ALTER TABLE "service_requests" ADD CONSTRAINT "service_requests_provider_id_users_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'transactions_wallet_id_wallets_id_fk') AND EXISTS (
	SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'transactions' AND column_name = 'wallet_id'
) THEN
	ALTER TABLE "transactions" ADD CONSTRAINT "transactions_wallet_id_wallets_id_fk" FOREIGN KEY ("wallet_id") REFERENCES "public"."wallets"("id") ON DELETE no action ON UPDATE no action;
END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'transactions_service_request_id_service_requests_id_fk') AND EXISTS (
	SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'transactions' AND column_name = 'service_request_id'
) THEN
	ALTER TABLE "transactions" ADD CONSTRAINT "transactions_service_request_id_service_requests_id_fk" FOREIGN KEY ("service_request_id") REFERENCES "public"."service_requests"("id") ON DELETE no action ON UPDATE no action;
END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'wallets_user_id_users_id_fk') AND EXISTS (
	SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'wallets' AND column_name = 'user_id'
) THEN
	ALTER TABLE "wallets" ADD CONSTRAINT "wallets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
END IF;
END $$;