import { relations } from "drizzle-orm";
import {
	integer,
	pgTable,
	serial,
	text,
	timestamp,
	uuid,
} from "drizzle-orm/pg-core";
import { users } from "./users.schema";

export const files = pgTable("files", {
	id: serial("id").primaryKey(),
	uuid: uuid("uuid").notNull().unique().defaultRandom(),
	key: text("key").notNull().unique(),
	bucket: text("bucket").notNull(),
	fileName: text("file_name").notNull(),
	contentType: text("content_type").notNull(),
	sizeBytes: integer("size_bytes").notNull(),
	createdBy: integer("created_by")
		.notNull()
		.references(() => users.id),
	createdAt: timestamp("created_at", { withTimezone: true })
		.defaultNow()
		.notNull(),
	updatedBy: integer("updated_by")
		.notNull()
		.references(() => users.id),
	updatedAt: timestamp("updated_at", { withTimezone: true })
		.defaultNow()
		.notNull(),
	deletedAt: timestamp("deleted_at", { withTimezone: true }),
});

export const filesRelations = relations(files, ({ one }) => ({
	createdByUser: one(users, {
		fields: [files.createdBy],
		references: [users.id],
		relationName: "files_created_by",
	}),
	updatedByUser: one(users, {
		fields: [files.updatedBy],
		references: [users.id],
		relationName: "files_updated_by",
	}),
}));
