import { ORPCError } from "@orpc/server";
import { MAX_FILE_SIZE_BYTES } from "@repo/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFindFirst = vi.fn();
const mockFindMany = vi.fn();
const mockInsert = vi.fn();
const mockValues = vi.fn(() => ({ returning: mockInsertReturning }));
const mockInsertReturning = vi.fn();
const mockUpdate = vi.fn();
const mockSet = vi.fn(() => ({ where: mockUpdateWhere }));
const mockUpdateWhere = vi.fn();
const mockUploadBuffer = vi.fn();
const mockCreatePresignedUrl = vi.fn();
const mockDeleteObject = vi.fn();
const mockRandomUUID = vi.fn();

vi.mock("../../db/db", () => ({
	db: {
		query: {
			files: {
				findFirst: (...args: unknown[]) => mockFindFirst(...args),
				findMany: (...args: unknown[]) => mockFindMany(...args),
			},
		},
		insert: (...args: unknown[]) => {
			mockInsert(...args);
			return { values: mockValues };
		},
		update: (...args: unknown[]) => {
			mockUpdate(...args);
			return { set: mockSet };
		},
	},
}));

vi.mock("../../db", () => ({
	files: {
		id: "id",
		uuid: "uuid",
		key: "key",
		createdBy: "created_by",
		createdAt: "created_at",
		deletedAt: "deleted_at",
	},
}));

vi.mock("../../storage", () => ({
	uploadBuffer: (...args: unknown[]) => mockUploadBuffer(...args),
	createPresignedUrl: (...args: unknown[]) => mockCreatePresignedUrl(...args),
	deleteObject: (...args: unknown[]) => mockDeleteObject(...args),
}));

vi.mock("../../utils/env", () => ({
	env: { S3_BUCKET: "genesis-test-bucket" },
}));

vi.mock("node:crypto", async () => {
	const actual =
		await vi.importActual<typeof import("node:crypto")>("node:crypto");
	return { ...actual, randomUUID: () => mockRandomUUID() };
});

import {
	getFileUrl,
	handleFileUpload,
	listUserFiles,
	softDeleteFile,
} from "./storage.service";

const DB_USER = { id: 42, uuid: "99999999-9999-4999-8999-999999999999" };
const GENERATED_UUID = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";

function makeFile(name: string, type: string, bytes = "hello") {
	return new File([bytes], name, { type });
}

function makeRecord(overrides: Record<string, unknown> = {}) {
	return {
		id: 7,
		uuid: "11111111-2222-4333-8444-555555555555",
		key: "uploads/x/y.png",
		bucket: "genesis-test-bucket",
		fileName: "photo.png",
		contentType: "image/png",
		sizeBytes: 5,
		createdBy: DB_USER.id,
		createdAt: new Date("2026-01-01T00:00:00Z"),
		updatedBy: DB_USER.id,
		updatedAt: new Date("2026-01-02T00:00:00Z"),
		deletedAt: null,
		...overrides,
	};
}

async function expectOrpcCode(promise: Promise<unknown>, code: string) {
	const error = await promise.then(
		() => {
			throw new Error("expected the call to reject");
		},
		(caught: unknown) => caught,
	);
	expect(error).toBeInstanceOf(ORPCError);
	expect((error as ORPCError<string, unknown>).code).toBe(code);
	return error as ORPCError<string, unknown>;
}

beforeEach(() => {
	vi.resetAllMocks();
	mockRandomUUID.mockReturnValue(GENERATED_UUID);
	mockUploadBuffer.mockResolvedValue(undefined);
	mockUpdateWhere.mockResolvedValue(undefined);
	mockDeleteObject.mockResolvedValue(undefined);
});

describe("handleFileUpload", () => {
	it("rejects a file larger than the maximum size without touching S3 or the database", async () => {
		const oversized = makeFile(
			"big.bin",
			"application/octet-stream",
			"x".repeat(MAX_FILE_SIZE_BYTES + 1),
		);

		const error = await expectOrpcCode(
			handleFileUpload(DB_USER, oversized),
			"PAYLOAD_TOO_LARGE",
		);

		expect(error.message).toContain("10 MB");
		expect(mockUploadBuffer).not.toHaveBeenCalled();
		expect(mockInsert).not.toHaveBeenCalled();
	});

	it("accepts a file exactly at the maximum size", async () => {
		const atLimit = makeFile(
			"limit.bin",
			"application/octet-stream",
			"x".repeat(MAX_FILE_SIZE_BYTES),
		);
		mockInsertReturning.mockResolvedValue([
			makeRecord({ sizeBytes: MAX_FILE_SIZE_BYTES }),
		]);

		const result = await handleFileUpload(DB_USER, atLimit);

		expect(result.sizeBytes).toBe(MAX_FILE_SIZE_BYTES);
		expect(mockUploadBuffer).toHaveBeenCalledTimes(1);
	});

	it("builds the key from the user uuid and a random uuid", async () => {
		mockInsertReturning.mockResolvedValue([makeRecord()]);

		await handleFileUpload(DB_USER, makeFile("photo.png", "image/png"));

		expect(mockUploadBuffer).toHaveBeenCalledWith(
			`uploads/${DB_USER.uuid}/${GENERATED_UUID}.png`,
			expect.any(Buffer),
			"image/png",
		);
		expect(mockValues).toHaveBeenCalledWith(
			expect.objectContaining({
				key: `uploads/${DB_USER.uuid}/${GENERATED_UUID}.png`,
			}),
		);
	});

	it("omits the extension when the filename has none", async () => {
		mockInsertReturning.mockResolvedValue([makeRecord()]);

		await handleFileUpload(DB_USER, makeFile("README", "text/plain"));

		expect(mockUploadBuffer).toHaveBeenCalledWith(
			`uploads/${DB_USER.uuid}/${GENERATED_UUID}`,
			expect.any(Buffer),
			"text/plain",
		);
	});

	it("uses only the last segment of a multi-dot filename as the extension", async () => {
		mockInsertReturning.mockResolvedValue([makeRecord()]);

		await handleFileUpload(
			DB_USER,
			makeFile("archive.tar.gz", "application/gzip"),
		);

		expect(mockUploadBuffer).toHaveBeenCalledWith(
			`uploads/${DB_USER.uuid}/${GENERATED_UUID}.gz`,
			expect.any(Buffer),
			"application/gzip",
		);
	});

	it("treats a dotfile name as the extension", async () => {
		mockInsertReturning.mockResolvedValue([makeRecord()]);

		// Current behaviour: ".env" has no name part, so the whole name becomes the suffix. Locked in deliberately.
		await handleFileUpload(DB_USER, makeFile(".env", "text/plain"));

		expect(mockUploadBuffer).toHaveBeenCalledWith(
			`uploads/${DB_USER.uuid}/${GENERATED_UUID}.env`,
			expect.any(Buffer),
			"text/plain",
		);
	});

	it("keeps a quote-and-semicolon filename out of the key", async () => {
		mockInsertReturning.mockResolvedValue([makeRecord()]);

		await handleFileUpload(
			DB_USER,
			makeFile('he said "hi"; drop.txt', "text/plain"),
		);

		expect(mockUploadBuffer).toHaveBeenCalledWith(
			`uploads/${DB_USER.uuid}/${GENERATED_UUID}.txt`,
			expect.any(Buffer),
			"text/plain",
		);
	});

	/**
	 * The extension is everything after the last dot, so a path-like filename
	 * drags slashes into the key and creates extra nested prefixes. That is the
	 * current behaviour, asserted verbatim rather than papered over. It cannot
	 * escape the owner's prefix: the segments before the last dot are dropped,
	 * so no ".." can survive into the suffix.
	 */
	it("puts the whole post-dot remainder of a path-like filename into the key", async () => {
		mockInsertReturning.mockResolvedValue([makeRecord()]);

		await handleFileUpload(DB_USER, makeFile("../../etc/passwd", "text/plain"));

		expect(mockUploadBuffer.mock.calls[0]?.[0]).toBe(
			`uploads/${DB_USER.uuid}/${GENERATED_UUID}./etc/passwd`,
		);
	});

	/**
	 * Guards the property that survives any future change to how the suffix is
	 * derived: whatever the filename, the object stays under the owner's prefix
	 * with no traversal segment. A "fix" that used the raw filename would fail
	 * here rather than quietly widening where a user can write.
	 */
	it.each([
		"a.../../b",
		"../../etc/passwd",
		"..",
		"...",
		"./../../x.png",
		"nested/dir/../file.tar.gz",
	])("never lets the filename %s escape the owner's prefix", async (name) => {
		mockInsertReturning.mockResolvedValue([makeRecord()]);

		await handleFileUpload(DB_USER, makeFile(name, "text/plain"));

		const key = mockUploadBuffer.mock.calls[0]?.[0] as string;
		expect(key.startsWith(`uploads/${DB_USER.uuid}/${GENERATED_UUID}`)).toBe(
			true,
		);
		expect(key.split("/").includes("..")).toBe(false);
	});

	it("falls back to application/octet-stream for both the upload and the stored metadata", async () => {
		mockInsertReturning.mockResolvedValue([makeRecord()]);

		await handleFileUpload(DB_USER, makeFile("mystery", ""));

		expect(mockUploadBuffer).toHaveBeenCalledWith(
			expect.any(String),
			expect.any(Buffer),
			"application/octet-stream",
		);
		expect(mockValues).toHaveBeenCalledWith(
			expect.objectContaining({ contentType: "application/octet-stream" }),
		);
	});

	it("stores the metadata row with the bucket, filename, size and uploader ids", async () => {
		mockInsertReturning.mockResolvedValue([makeRecord()]);

		await handleFileUpload(DB_USER, makeFile("photo.png", "image/png"));

		expect(mockValues).toHaveBeenCalledWith({
			key: `uploads/${DB_USER.uuid}/${GENERATED_UUID}.png`,
			bucket: "genesis-test-bucket",
			fileName: "photo.png",
			contentType: "image/png",
			sizeBytes: 5,
			createdBy: DB_USER.id,
			updatedBy: DB_USER.id,
		});
	});

	it("returns uuids only, never integer ids", async () => {
		const record = makeRecord();
		mockInsertReturning.mockResolvedValue([record]);

		const result = await handleFileUpload(
			DB_USER,
			makeFile("photo.png", "image/png"),
		);

		expect(result).toEqual({
			uuid: record.uuid,
			fileName: record.fileName,
			contentType: record.contentType,
			sizeBytes: record.sizeBytes,
			createdBy: DB_USER.uuid,
			createdAt: record.createdAt,
			updatedBy: DB_USER.uuid,
			updatedAt: record.updatedAt,
			deletedAt: null,
		});
		expect(result).not.toHaveProperty("id");
		expect(result.createdBy).not.toBe(DB_USER.id);
	});

	it("throws INTERNAL_SERVER_ERROR when the insert returns no row", async () => {
		mockInsertReturning.mockResolvedValue([]);

		await expectOrpcCode(
			handleFileUpload(DB_USER, makeFile("photo.png", "image/png")),
			"INTERNAL_SERVER_ERROR",
		);
	});

	it("propagates an S3 upload failure and writes no metadata row", async () => {
		mockUploadBuffer.mockRejectedValue(new Error("PutObject failed"));

		await expect(
			handleFileUpload(DB_USER, makeFile("photo.png", "image/png")),
		).rejects.toThrow("PutObject failed");
		expect(mockInsert).not.toHaveBeenCalled();
	});

	it("uploads the exact bytes of the file", async () => {
		mockInsertReturning.mockResolvedValue([makeRecord()]);
		const contents = "the exact bytes éè";
		const file = makeFile("photo.png", "image/png", contents);

		await handleFileUpload(DB_USER, file);

		const uploaded = mockUploadBuffer.mock.calls[0]?.[1] as Buffer;
		expect(uploaded.equals(Buffer.from(await file.arrayBuffer()))).toBe(true);
	});
});

describe("getFileUrl", () => {
	it("throws NOT_FOUND when no file matches the uuid", async () => {
		mockFindFirst.mockResolvedValue(undefined);

		await expectOrpcCode(
			getFileUrl(DB_USER, { uuid: "missing", mode: "view" }),
			"NOT_FOUND",
		);
		expect(mockCreatePresignedUrl).not.toHaveBeenCalled();
	});

	it("throws NOT_FOUND when the file is soft-deleted", async () => {
		mockFindFirst.mockResolvedValue(
			makeRecord({ deletedAt: new Date("2026-01-03T00:00:00Z") }),
		);

		await expectOrpcCode(
			getFileUrl(DB_USER, { uuid: "deleted", mode: "view" }),
			"NOT_FOUND",
		);
		expect(mockCreatePresignedUrl).not.toHaveBeenCalled();
	});

	it("throws FORBIDDEN for another user's file and signs nothing", async () => {
		mockFindFirst.mockResolvedValue(makeRecord({ createdBy: DB_USER.id + 1 }));

		await expectOrpcCode(
			getFileUrl(DB_USER, { uuid: "someone-elses", mode: "view" }),
			"FORBIDDEN",
		);
		expect(mockCreatePresignedUrl).not.toHaveBeenCalled();
	});

	it("returns a presigned url signed for the file key, name and requested mode", async () => {
		const record = makeRecord({
			key: "uploads/user/abc.png",
			fileName: "holiday.png",
		});
		mockFindFirst.mockResolvedValue(record);
		mockCreatePresignedUrl.mockResolvedValue("https://signed.example/abc.png");

		const result = await getFileUrl(DB_USER, {
			uuid: record.uuid,
			mode: "download",
		});

		expect(result).toEqual({ url: "https://signed.example/abc.png" });
		expect(mockCreatePresignedUrl).toHaveBeenCalledWith(
			"uploads/user/abc.png",
			"holiday.png",
			"download",
		);
	});
});

describe("listUserFiles", () => {
	it("maps every file to the uuid-only shape with the owner uuid", async () => {
		const rows = [
			makeRecord({ uuid: "file-a", fileName: "a.png" }),
			makeRecord({ uuid: "file-b", fileName: "b.png" }),
		];
		mockFindMany.mockResolvedValue(rows);

		const result = await listUserFiles(DB_USER);

		expect(result).toEqual({
			files: rows.map((row) => ({
				uuid: row.uuid,
				fileName: row.fileName,
				contentType: row.contentType,
				sizeBytes: row.sizeBytes,
				createdBy: DB_USER.uuid,
				createdAt: row.createdAt,
				updatedBy: DB_USER.uuid,
				updatedAt: row.updatedAt,
				deletedAt: null,
			})),
		});
		for (const file of result.files) {
			expect(file).not.toHaveProperty("id");
			expect(file).not.toHaveProperty("key");
		}
	});

	it("returns an empty list when the user has no files", async () => {
		mockFindMany.mockResolvedValue([]);

		await expect(listUserFiles(DB_USER)).resolves.toEqual({ files: [] });
	});
});

describe("softDeleteFile", () => {
	it("throws NOT_FOUND when no file matches the uuid", async () => {
		mockFindFirst.mockResolvedValue(undefined);

		await expectOrpcCode(
			softDeleteFile(DB_USER, { uuid: "missing" }),
			"NOT_FOUND",
		);
		expect(mockUpdate).not.toHaveBeenCalled();
		expect(mockDeleteObject).not.toHaveBeenCalled();
	});

	it("throws NOT_FOUND when the file is already soft-deleted", async () => {
		mockFindFirst.mockResolvedValue(
			makeRecord({ deletedAt: new Date("2026-01-03T00:00:00Z") }),
		);

		await expectOrpcCode(
			softDeleteFile(DB_USER, { uuid: "already-gone" }),
			"NOT_FOUND",
		);
		expect(mockUpdate).not.toHaveBeenCalled();
		expect(mockDeleteObject).not.toHaveBeenCalled();
	});

	it("throws FORBIDDEN for another user's file and leaves the object alone", async () => {
		mockFindFirst.mockResolvedValue(makeRecord({ createdBy: DB_USER.id + 1 }));

		await expectOrpcCode(
			softDeleteFile(DB_USER, { uuid: "someone-elses" }),
			"FORBIDDEN",
		);
		expect(mockUpdate).not.toHaveBeenCalled();
		expect(mockDeleteObject).not.toHaveBeenCalled();
	});

	it("stamps deletedAt and updatedBy, then removes the object", async () => {
		const record = makeRecord({ key: "uploads/user/abc.png" });
		mockFindFirst.mockResolvedValue(record);

		const result = await softDeleteFile(DB_USER, { uuid: record.uuid });

		expect(result).toEqual({ deleted: true });
		expect(mockSet).toHaveBeenCalledWith(
			expect.objectContaining({
				deletedAt: expect.any(Date),
				updatedBy: DB_USER.id,
			}),
		);
		expect(mockDeleteObject).toHaveBeenCalledWith("uploads/user/abc.png");
		expect(Number(mockUpdateWhere.mock.invocationCallOrder[0])).toBeLessThan(
			Number(mockDeleteObject.mock.invocationCallOrder[0]),
		);
	});

	it("leaves the object in place when the soft delete fails", async () => {
		mockFindFirst.mockResolvedValue(makeRecord());
		mockUpdateWhere.mockRejectedValue(new Error("update failed"));

		await expect(softDeleteFile(DB_USER, { uuid: "any" })).rejects.toThrow(
			"update failed",
		);
		expect(mockDeleteObject).not.toHaveBeenCalled();
	});

	it("propagates a failing object delete after the row is already soft-deleted", async () => {
		mockFindFirst.mockResolvedValue(makeRecord());
		mockDeleteObject.mockRejectedValue(new Error("DeleteObject failed"));

		// The row stays soft-deleted while the object survives: the orphan-object window.
		await expect(softDeleteFile(DB_USER, { uuid: "any" })).rejects.toThrow(
			"DeleteObject failed",
		);
		expect(mockUpdateWhere).toHaveBeenCalledTimes(1);
	});
});
