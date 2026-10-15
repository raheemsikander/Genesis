import type { UserPreferences } from "@repo/shared";
import { relations } from "drizzle-orm";
import {
	type AnyPgColumn,
	integer,
	jsonb,
	pgEnum,
	pgTable,
	serial,
	text,
	timestamp,
	uuid,
} from "drizzle-orm/pg-core";

// NOTE: pgEnum requires literal types for proper Drizzle column type
// inference. Using UserRoleEnum.options (readonly tuple) widens the role
// column type to `string` and breaks downstream type narrowing. The values
// here MUST stay aligned with packages/shared/src/models/user.types.ts —
// this is a paired source-of-truth declaration (DB schema + runtime
// validation).
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
	// AnyPgColumn cast is Drizzle's documented escape hatch for self-FK type
	// resolution — TS can't otherwise resolve the circular reference. Keep.
	createdBy: integer("created_by").references((): AnyPgColumn => users.id),
	createdAt: timestamp("created_at", { withTimezone: true })
		.defaultNow()
		.notNull(),
	updatedBy: integer("updated_by").references((): AnyPgColumn => users.id),
	updatedAt: timestamp("updated_at", { withTimezone: true })
		.defaultNow()
		.notNull(),
	deletedAt: timestamp("deleted_at", { withTimezone: true }),
});

export const usersRelations = relations(users, ({ one }) => ({
	createdByUser: one(users, {
		fields: [users.createdBy],
		references: [users.id],
		relationName: "users_created_by",
	}),
	updatedByUser: one(users, {
		fields: [users.updatedBy],
		references: [users.id],
		relationName: "users_updated_by",
	}),
}));
