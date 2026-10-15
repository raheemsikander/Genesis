CREATE TYPE "public"."user_role" AS ENUM('admin', 'member');--> statement-breakpoint
ALTER TABLE "files" DROP CONSTRAINT "files_created_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "files" DROP CONSTRAINT "files_updated_by_users_id_fk";
--> statement-breakpoint
-- Add new columns as nullable first
ALTER TABLE "users" ADD COLUMN "uuid" uuid DEFAULT gen_random_uuid() NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "clerk_id" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "role" "user_role" DEFAULT 'member' NOT NULL;
