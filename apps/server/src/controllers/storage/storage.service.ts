import { randomUUID } from "node:crypto";
import { MAX_FILE_SIZE_BYTES } from "@genesis/shared";
import { ORPCError } from "@orpc/server";
import { eq } from "drizzle-orm";
import { files } from "../../db";
import { db } from "../../db/db";
import { createPresignedUrl, deleteObject, uploadBuffer } from "../../storage";
import { env } from "../../utils/env";

export async function handleFileUpload(userId: string, file: File) {
	if (file.size > MAX_FILE_SIZE_BYTES) {
		throw new ORPCError("PAYLOAD_TOO_LARGE", {
			message: `File too large. Maximum size is ${MAX_FILE_SIZE_BYTES / (1024 * 1024)} MB.`,
		});
	}

	const extension = file.name.includes(".")
		? file.name.substring(file.name.lastIndexOf("."))
		: "";
	const key = `uploads/${userId}/${randomUUID()}${extension}`;

	const arrayBuffer = await file.arrayBuffer();
	await uploadBuffer(
		key,
		Buffer.from(arrayBuffer),
		file.type || "application/octet-stream",
	);

	const [record] = await db
		.insert(files)
		.values({
			key,
			bucket: env.S3_BUCKET,
			fileName: file.name,
			contentType: file.type || "application/octet-stream",
			sizeBytes: file.size,
			createdBy: userId,
			updatedBy: userId,
		})
		.returning();

	if (!record) {
		throw new ORPCError("INTERNAL_SERVER_ERROR", {
			message: "Failed to save file record",
		});
	}

	return {
		uuid: record.uuid,
		fileName: record.fileName,
		contentType: record.contentType,
		sizeBytes: record.sizeBytes,
		createdBy: record.createdBy,
		createdAt: record.createdAt,
		updatedBy: record.updatedBy,
		updatedAt: record.updatedAt,
		deletedAt: record.deletedAt,
	};
}

export async function getFileUrl(
	userId: string,
	input: { uuid: string; mode: "view" | "download" },
) {
	const file = await db.query.files.findFirst({
		where: eq(files.uuid, input.uuid),
	});

	if (!file || file.deletedAt) {
		throw new ORPCError("NOT_FOUND", { message: "File not found" });
	}

	if (file.createdBy !== userId) {
		throw new ORPCError("FORBIDDEN", {
			message: "You can only access your own files",
		});
	}

	const url = await createPresignedUrl(file.key, file.fileName, input.mode);
	return { url };
}

export async function listUserFiles(userId: string) {
	const userFiles = await db.query.files.findMany({
		where: (files, { eq, and, isNull }) =>
			and(eq(files.createdBy, userId), isNull(files.deletedAt)),
		orderBy: (files, { desc }) => [desc(files.createdAt)],
	});

	return {
		files: userFiles.map((f) => ({
			uuid: f.uuid,
			fileName: f.fileName,
			contentType: f.contentType,
			sizeBytes: f.sizeBytes,
			createdBy: f.createdBy,
			createdAt: f.createdAt,
			updatedBy: f.updatedBy,
			updatedAt: f.updatedAt,
			deletedAt: f.deletedAt,
		})),
	};
}

export async function softDeleteFile(userId: string, input: { uuid: string }) {
	const file = await db.query.files.findFirst({
		where: eq(files.uuid, input.uuid),
	});

	if (!file || file.deletedAt) {
		throw new ORPCError("NOT_FOUND", { message: "File not found" });
	}

	if (file.createdBy !== userId) {
		throw new ORPCError("FORBIDDEN", {
			message: "You can only delete your own files",
		});
	}

	// Soft-delete the metadata row first — if this fails, S3 is untouched and recoverable
	await db
		.update(files)
		.set({
			deletedAt: new Date(),
			updatedBy: userId,
			updatedAt: new Date(),
		})
		.where(eq(files.uuid, input.uuid));

	// Remove from S3 after DB is committed
	await deleteObject(file.key);

	return { deleted: true };
}
