-- GENESIS-136 — retarget audit FKs from users.clerk_id (text) to users.id (integer).
-- Non-destructive: existing rows are preserved by backfilling each text Clerk ID
-- to the corresponding users.id via a JOIN. Any files row whose created_by /
-- updated_by doesn't resolve to a current users.clerk_id aborts the migration
-- (orphan guard). For users.* the audit columns are nullable, so unresolved
-- values are set to NULL.

-- 1. Drop existing FK constraints on files (target users.clerk_id).
ALTER TABLE "files" DROP CONSTRAINT "files_created_by_users_clerk_id_fk";
--> statement-breakpoint
ALTER TABLE "files" DROP CONSTRAINT "files_updated_by_users_clerk_id_fk";
--> statement-breakpoint

-- 2. Orphan guard for files. If any text Clerk ID in files.created_by /
--    files.updated_by isn't present in users.clerk_id, abort — we can't
--    convert to NOT NULL integer without dropping data.
DO $$
DECLARE orphan_count INT;
BEGIN
	SELECT COUNT(*) INTO orphan_count
	FROM "files" f
	WHERE NOT EXISTS (SELECT 1 FROM "users" u WHERE u."clerk_id" = f."created_by")
	   OR NOT EXISTS (SELECT 1 FROM "users" u WHERE u."clerk_id" = f."updated_by");
	IF orphan_count > 0 THEN
		RAISE EXCEPTION 'GENESIS-136: % files rows have created_by/updated_by that do not resolve to users.clerk_id', orphan_count;
	END IF;
END $$;
--> statement-breakpoint

-- 3. Files: swap text columns for nullable integer columns, backfill from
--    users.clerk_id → users.id, then mark NOT NULL and rename.
ALTER TABLE "files" ADD COLUMN "created_by_new" integer;
--> statement-breakpoint
ALTER TABLE "files" ADD COLUMN "updated_by_new" integer;
--> statement-breakpoint
UPDATE "files" f SET "created_by_new" = u."id" FROM "users" u WHERE u."clerk_id" = f."created_by";
--> statement-breakpoint
UPDATE "files" f SET "updated_by_new" = u."id" FROM "users" u WHERE u."clerk_id" = f."updated_by";
--> statement-breakpoint
ALTER TABLE "files" ALTER COLUMN "created_by_new" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "files" ALTER COLUMN "updated_by_new" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "files" DROP COLUMN "created_by";
--> statement-breakpoint
ALTER TABLE "files" DROP COLUMN "updated_by";
--> statement-breakpoint
ALTER TABLE "files" RENAME COLUMN "created_by_new" TO "created_by";
--> statement-breakpoint
ALTER TABLE "files" RENAME COLUMN "updated_by_new" TO "updated_by";
--> statement-breakpoint
ALTER TABLE "files" ADD CONSTRAINT "files_created_by_users_id_fk"
	FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "files" ADD CONSTRAINT "files_updated_by_users_id_fk"
	FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint

-- 4. Users: same swap pattern but the columns stay nullable. Unresolved
--    Clerk-id text values become NULL after the JOIN-based backfill (the
--    LEFT semantic is implicit — the UPDATE only sets rows where the
--    FROM clause matches, leaving the rest at their new-column default NULL).
ALTER TABLE "users" ADD COLUMN "created_by_new" integer;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "updated_by_new" integer;
--> statement-breakpoint
UPDATE "users" u SET "created_by_new" = c."id" FROM "users" c WHERE c."clerk_id" = u."created_by";
--> statement-breakpoint
UPDATE "users" u SET "updated_by_new" = c."id" FROM "users" c WHERE c."clerk_id" = u."updated_by";
--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "created_by";
--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "updated_by";
--> statement-breakpoint
ALTER TABLE "users" RENAME COLUMN "created_by_new" TO "created_by";
--> statement-breakpoint
ALTER TABLE "users" RENAME COLUMN "updated_by_new" TO "updated_by";
--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_created_by_users_id_fk"
	FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_updated_by_users_id_fk"
	FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
