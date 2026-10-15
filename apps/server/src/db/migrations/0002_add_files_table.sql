CREATE TABLE "files" (
	"id" serial PRIMARY KEY NOT NULL,
	"uuid" uuid DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"bucket" text NOT NULL,
	"file_name" text NOT NULL,
	"content_type" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "files_uuid_unique" UNIQUE("uuid"),
	CONSTRAINT "files_key_unique" UNIQUE("key")
);
--> statement-breakpoint
ALTER TABLE "files" ADD CONSTRAINT "files_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "files" ADD CONSTRAINT "files_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
