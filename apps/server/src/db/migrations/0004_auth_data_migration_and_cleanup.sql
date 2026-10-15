-- Data migration: copy old id (Clerk ID) into clerk_id
UPDATE "users" SET "clerk_id" = "id";--> statement-breakpoint
-- Convert isAppAdmin to role
UPDATE "users" SET "role" = 'admin' WHERE "is_app_admin" = true;--> statement-breakpoint
-- Backfill null names
UPDATE "users" SET "name" = '' WHERE "name" IS NULL;--> statement-breakpoint
-- Now make clerk_id and name NOT NULL
ALTER TABLE "users" ALTER COLUMN "clerk_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "name" SET NOT NULL;--> statement-breakpoint
-- Drop old columns and PK
ALTER TABLE "users" DROP COLUMN "is_app_admin";--> statement-breakpoint
ALTER TABLE "users" DROP CONSTRAINT "users_pkey";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "id";--> statement-breakpoint
-- Add new serial PK
ALTER TABLE "users" ADD COLUMN "id" serial;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_pkey" PRIMARY KEY ("id");--> statement-breakpoint
-- Add unique constraints
ALTER TABLE "users" ADD CONSTRAINT "users_uuid_unique" UNIQUE("uuid");--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_clerk_id_unique" UNIQUE("clerk_id");--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_email_unique" UNIQUE("email");--> statement-breakpoint
-- Re-create FKs pointing to clerk_id
ALTER TABLE "files" ADD CONSTRAINT "files_created_by_users_clerk_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("clerk_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "files" ADD CONSTRAINT "files_updated_by_users_clerk_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("clerk_id") ON DELETE no action ON UPDATE no action;
