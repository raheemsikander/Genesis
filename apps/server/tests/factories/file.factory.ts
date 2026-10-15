import { randomUUID } from "node:crypto";
import { db } from "../../src/db/db";
import { files } from "../../src/db/schema";
import { env } from "../../src/utils/env";

type FileInsert = typeof files.$inferInsert;

// createdBy is a foreign key, so the caller has to seed a user first.
type FileOverrides = Partial<FileInsert> & Pick<FileInsert, "createdBy">;

export async function createTestFile(overrides: FileOverrides) {
	const defaults: FileInsert = {
		key: `uploads/${randomUUID()}/${randomUUID()}.txt`,
		bucket: env.S3_BUCKET,
		fileName: "seeded.txt",
		contentType: "text/plain",
		sizeBytes: 12,
		createdBy: overrides.createdBy,
		updatedBy: overrides.createdBy,
	};

	const [file] = await db
		.insert(files)
		.values({ ...defaults, ...overrides })
		.returning();

	if (!file) throw new Error("Failed to seed a file row");

	return file;
}
