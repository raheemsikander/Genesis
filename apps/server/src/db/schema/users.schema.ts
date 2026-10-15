import type { UserPreferences } from "@genesis/shared";
import {
	jsonb,
	pgEnum,
	pgTable,
	serial,
	text,
	timestamp,
	uuid,
} from "drizzle-orm/pg-core";

export const userRoleEnum = pgEnum("user_role", ["admin", "member"]);

export const users = pgTable("users", {
	id: serial("id").primaryKey(),
	uuid: uuid("uuid").notNull().unique().defaultRandom(),
	clerkId: text("clerk_id").notNull().unique(),
	email: text("email").notNull().unique(),
	name: text("name").notNull(),
	role: userRoleEnum("role").notNull().default("member"),
	imageUrl: text("image_url"),
	preferences: jsonb("preferences")
		.notNull()
		.$type<UserPreferences>()
		.default({}),
	createdBy: text("created_by"),
	createdAt: timestamp("created_at", { withTimezone: true })
		.defaultNow()
		.notNull(),
	updatedBy: text("updated_by"),
	updatedAt: timestamp("updated_at", { withTimezone: true })
		.defaultNow()
		.notNull(),
});
