DO $$ BEGIN
IF NOT EXISTS (
	SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
	WHERE t.typname = 'bill_status' AND n.nspname = 'public'
) THEN
	CREATE TYPE "public"."bill_status" AS ENUM('draft', 'issued', 'paid', 'cancelled');
END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
IF NOT EXISTS (
	SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
	WHERE t.typname = 'category_scope' AND n.nspname = 'public'
) THEN
	CREATE TYPE "public"."category_scope" AS ENUM('global', 'estate');
END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
IF NOT EXISTS (
	SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
	WHERE t.typname = 'dispute_status' AND n.nspname = 'public'
) THEN
	CREATE TYPE "public"."dispute_status" AS ENUM('open', 'resolved', 'rejected', 'escalated');
END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
IF NOT EXISTS (
	SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
	WHERE t.typname = 'membership_status' AND n.nspname = 'public'
) THEN
	CREATE TYPE "public"."membership_status" AS ENUM('pending', 'active', 'suspended', 'rejected', 'left');
END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
IF NOT EXISTS (
	SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
	WHERE t.typname = 'message_sender' AND n.nspname = 'public'
) THEN
	CREATE TYPE "public"."message_sender" AS ENUM('admin', 'resident', 'provider');
END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
IF NOT EXISTS (
	SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
	WHERE t.typname = 'order_status' AND n.nspname = 'public'
) THEN
	CREATE TYPE "public"."order_status" AS ENUM('pending', 'processing', 'delivered', 'cancelled');
END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
IF NOT EXISTS (
	SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
	WHERE t.typname = 'role_scope' AND n.nspname = 'public'
) THEN
	CREATE TYPE "public"."role_scope" AS ENUM('platform', 'estate', 'business');
END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
IF NOT EXISTS (
	SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
	WHERE t.typname = 'store_approval_status' AND n.nspname = 'public'
) THEN
	CREATE TYPE "public"."store_approval_status" AS ENUM('pending', 'approved', 'rejected');
END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
IF NOT EXISTS (
	SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
	WHERE t.typname = 'unit_of_measure' AND n.nspname = 'public'
) THEN
	CREATE TYPE "public"."unit_of_measure" AS ENUM('kg', 'g', 'liter', 'ml', 'piece', 'bunch', 'pack', 'bag', 'bottle', 'can', 'box', 'dozen', 'yard', 'meter');
END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
IF NOT EXISTS (
	SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid JOIN pg_namespace n ON n.oid = t.typnamespace
	WHERE t.typname = 'service_category' AND n.nspname = 'public' AND e.enumlabel = 'item_vendor'
) THEN
	ALTER TYPE "public"."service_category" ADD VALUE 'item_vendor';
END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
IF NOT EXISTS (
	SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid JOIN pg_namespace n ON n.oid = t.typnamespace
	WHERE t.typname = 'user_role' AND n.nspname = 'public' AND e.enumlabel = 'super_admin'
) THEN
	ALTER TYPE "public"."user_role" ADD VALUE 'super_admin';
END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
IF NOT EXISTS (
	SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid JOIN pg_namespace n ON n.oid = t.typnamespace
	WHERE t.typname = 'user_role' AND n.nspname = 'public' AND e.enumlabel = 'estate_admin'
) THEN
	ALTER TYPE "public"."user_role" ADD VALUE 'estate_admin';
END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
IF NOT EXISTS (
	SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid JOIN pg_namespace n ON n.oid = t.typnamespace
	WHERE t.typname = 'user_role' AND n.nspname = 'public' AND e.enumlabel = 'moderator'
) THEN
	ALTER TYPE "public"."user_role" ADD VALUE 'moderator';
END IF;
END $$;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "app_settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb DEFAULT '{}' NOT NULL,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "audit_logs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_id" varchar NOT NULL,
	"estate_id" varchar,
	"action" text NOT NULL,
	"target" text NOT NULL,
	"target_id" text NOT NULL,
	"meta" jsonb DEFAULT '{}' NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "categories" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scope" "category_scope" NOT NULL,
	"estate_id" varchar,
	"name" text NOT NULL,
	"key" text NOT NULL,
	"emoji" text,
	"description" text,
	"icon" text,
	"tag" text DEFAULT 'Facility Management 🏗️' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "companies" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"contact_email" text,
	"phone" text,
	"provider_id" varchar,
	"details" jsonb DEFAULT '{}' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "device_assignments" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider_id" varchar NOT NULL,
	"bodycam_stream_url" text,
	"gps_device_id" text,
	"last_known_lat" double precision,
	"last_known_lng" double precision,
	"mic_enabled" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "estates" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"address" text NOT NULL,
	"coverage" jsonb NOT NULL,
	"settings" jsonb DEFAULT '{"servicesEnabled":[],"marketplaceEnabled":true,"paymentMethods":[],"deliveryRules":{}}' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "estates_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "inspections" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" varchar NOT NULL,
	"summary" text NOT NULL,
	"findings" text,
	"recommended_work" text,
	"estimated_cost" numeric(10, 2),
	"created_by_admin_id" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "item_categories" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"emoji" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "marketplace_items" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"estate_id" varchar,
	"store_id" varchar,
	"vendor_id" varchar NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"price" numeric(10, 2) NOT NULL,
	"currency" varchar(10) DEFAULT 'NGN' NOT NULL,
	"unit_of_measure" "unit_of_measure" DEFAULT 'piece',
	"category" text NOT NULL,
	"subcategory" text,
	"stock" integer DEFAULT 0 NOT NULL,
	"images" text[],
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "membership_roles" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"membership_id" varchar NOT NULL,
	"role_id" varchar NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "memberships" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"estate_id" varchar NOT NULL,
	"role" "user_role" NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"status" "membership_status" DEFAULT 'active' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"permissions" text[],
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "mongo_id_mappings" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"mongo_id" text NOT NULL,
	"postgres_id" varchar NOT NULL,
	"entity_type" text NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "orders" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"estate_id" varchar NOT NULL,
	"store_id" varchar,
	"buyer_id" varchar NOT NULL,
	"vendor_id" varchar NOT NULL,
	"items" jsonb NOT NULL,
	"total" numeric(10, 2) NOT NULL,
	"currency" varchar(10) DEFAULT 'NGN' NOT NULL,
	"status" "order_status" DEFAULT 'pending' NOT NULL,
	"delivery_address" text NOT NULL,
	"payment_method" text,
	"payment_id" text,
	"dispute" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "permissions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "permissions_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "provider_requests" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text,
	"company" text,
	"categories" varchar(100)[],
	"experience" integer DEFAULT 0 NOT NULL,
	"description" text,
	"provider_id" varchar,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "refresh_tokens" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"token_id" varchar(255) NOT NULL,
	"expires_at" timestamp NOT NULL,
	"is_revoked" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"revoked_at" timestamp,
	CONSTRAINT "refresh_tokens_token_id_unique" UNIQUE("token_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "request_bill_items" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bill_id" varchar NOT NULL,
	"label" text NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"unit_price" numeric(10, 2) DEFAULT '0' NOT NULL,
	"line_total" numeric(10, 2) DEFAULT '0' NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "request_bills" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" varchar NOT NULL,
	"currency" varchar(8) DEFAULT 'NGN' NOT NULL,
	"subtotal" numeric(10, 2) DEFAULT '0' NOT NULL,
	"tax" numeric(10, 2) DEFAULT '0' NOT NULL,
	"total" numeric(10, 2) DEFAULT '0' NOT NULL,
	"status" "bill_status" DEFAULT 'draft' NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "request_messages" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" varchar NOT NULL,
	"sender_id" varchar NOT NULL,
	"sender_role" "message_sender" NOT NULL,
	"message" text NOT NULL,
	"attachment_url" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "role_permissions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"role_id" varchar NOT NULL,
	"permission_id" varchar NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "roles" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"scope" "role_scope" DEFAULT 'platform' NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "roles_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "session" (
	"sid" varchar(255) PRIMARY KEY NOT NULL,
	"sess" jsonb NOT NULL,
	"expire" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "store_estates" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" varchar NOT NULL,
	"estate_id" varchar NOT NULL,
	"allocated_by" varchar NOT NULL,
	"allocated_at" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "store_members" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"can_manage_items" boolean DEFAULT true NOT NULL,
	"can_manage_orders" boolean DEFAULT true NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "stores" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"estate_id" varchar,
	"owner_id" varchar,
	"name" text NOT NULL,
	"description" text,
	"location" text NOT NULL,
	"latitude" double precision,
	"longitude" double precision,
	"phone" text,
	"email" text,
	"logo" text,
	"approval_status" "store_approval_status" DEFAULT 'pending' NOT NULL,
	"approved_by" varchar,
	"approved_at" timestamp,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "service_requests" ADD COLUMN IF NOT EXISTS "estate_id" varchar;--> statement-breakpoint
ALTER TABLE "service_requests" ADD COLUMN IF NOT EXISTS "advice_message" text;--> statement-breakpoint
ALTER TABLE "service_requests" ADD COLUMN IF NOT EXISTS "inspection_dates" text[];--> statement-breakpoint
ALTER TABLE "service_requests" ADD COLUMN IF NOT EXISTS "inspection_times" text[];--> statement-breakpoint
ALTER TABLE "service_requests" ADD COLUMN IF NOT EXISTS "admin_notes" text;--> statement-breakpoint
ALTER TABLE "service_requests" ADD COLUMN IF NOT EXISTS "assigned_at" timestamp;--> statement-breakpoint
ALTER TABLE "service_requests" ADD COLUMN IF NOT EXISTS "closed_at" timestamp;--> statement-breakpoint
ALTER TABLE "service_requests" ADD COLUMN IF NOT EXISTS "close_reason" text;--> statement-breakpoint
ALTER TABLE "service_requests" ADD COLUMN IF NOT EXISTS "billed_amount" numeric(10, 2) DEFAULT '0';--> statement-breakpoint
ALTER TABLE "service_requests" ADD COLUMN IF NOT EXISTS "payment_status" text DEFAULT 'pending';--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "reference" text NOT NULL;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "gateway" text DEFAULT 'paystack' NOT NULL;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "meta" jsonb DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "first_name" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "last_name" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "global_role" "user_role";--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "company" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "documents" text[];--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "last_login_at" timestamp;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "metadata" jsonb;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_estate_id_estates_id_fk" FOREIGN KEY ("estate_id") REFERENCES "public"."estates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_estate_id_estates_id_fk" FOREIGN KEY ("estate_id") REFERENCES "public"."estates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "companies" ADD CONSTRAINT "companies_provider_id_users_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "device_assignments" ADD CONSTRAINT "device_assignments_provider_id_users_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inspections" ADD CONSTRAINT "inspections_request_id_service_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."service_requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketplace_items" ADD CONSTRAINT "marketplace_items_estate_id_estates_id_fk" FOREIGN KEY ("estate_id") REFERENCES "public"."estates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketplace_items" ADD CONSTRAINT "marketplace_items_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketplace_items" ADD CONSTRAINT "marketplace_items_vendor_id_users_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "membership_roles" ADD CONSTRAINT "membership_roles_membership_id_memberships_id_fk" FOREIGN KEY ("membership_id") REFERENCES "public"."memberships"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "membership_roles" ADD CONSTRAINT "membership_roles_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_estate_id_estates_id_fk" FOREIGN KEY ("estate_id") REFERENCES "public"."estates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_estate_id_estates_id_fk" FOREIGN KEY ("estate_id") REFERENCES "public"."estates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_buyer_id_users_id_fk" FOREIGN KEY ("buyer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_vendor_id_users_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "provider_requests" ADD CONSTRAINT "provider_requests_provider_id_users_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "request_bill_items" ADD CONSTRAINT "request_bill_items_bill_id_request_bills_id_fk" FOREIGN KEY ("bill_id") REFERENCES "public"."request_bills"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "request_bills" ADD CONSTRAINT "request_bills_request_id_service_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."service_requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "request_messages" ADD CONSTRAINT "request_messages_request_id_service_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."service_requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_permissions_id_fk" FOREIGN KEY ("permission_id") REFERENCES "public"."permissions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_estates" ADD CONSTRAINT "store_estates_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_estates" ADD CONSTRAINT "store_estates_estate_id_estates_id_fk" FOREIGN KEY ("estate_id") REFERENCES "public"."estates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_estates" ADD CONSTRAINT "store_estates_allocated_by_users_id_fk" FOREIGN KEY ("allocated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_members" ADD CONSTRAINT "store_members_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_members" ADD CONSTRAINT "store_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stores" ADD CONSTRAINT "stores_estate_id_estates_id_fk" FOREIGN KEY ("estate_id") REFERENCES "public"."estates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stores" ADD CONSTRAINT "stores_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stores" ADD CONSTRAINT "stores_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_requests" ADD CONSTRAINT "service_requests_estate_id_estates_id_fk" FOREIGN KEY ("estate_id") REFERENCES "public"."estates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_reference_unique" UNIQUE("reference");