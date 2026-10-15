import { MAX_FILE_SIZE_BYTES } from "@repo/shared";
import { eq } from "drizzle-orm";
import {
	afterAll,
	afterEach,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
} from "vitest";
import { createTestFile, createTestUser } from "../../../tests/factories";
import { truncateTables } from "../../../tests/helpers/db.test-helper";
import {
	startTestServer,
	type TestClient,
	type TestServer,
} from "../../../tests/helpers/orpc-client.test-helper";
import {
	deleteAllObjects,
	ensureTestBucket,
	getObjectBytes,
	listObjectKeys,
	objectExists,
} from "../../../tests/helpers/s3.test-helper";
import { db } from "../../db/db";
import { files, users } from "../../db/schema";
import { env } from "../../utils/env";

type FileBytes = string | Uint8Array<ArrayBuffer>;

const UPLOAD_PREFIX = "uploads/";
const OTHER_CLERK_USER_ID = "user_test_clerk_other_456";

let server: TestServer;
let client: TestClient;

function testFile(name: string, bytes: FileBytes, type?: string) {
	return new File([bytes], name, type === undefined ? undefined : { type });
}

async function upload(
	as: TestClient,
	name: string,
	bytes: FileBytes,
	type?: string,
) {
	return as.storage.uploadFile({ file: testFile(name, bytes, type) });
}

async function rejection(promise: Promise<unknown>) {
	try {
		await promise;
	} catch (error) {
		return error as { code?: string; message?: string };
	}
	throw new Error("Expected the call to reject, but it resolved");
}

async function fileRow(uuid: string) {
	return db.query.files.findFirst({ where: eq(files.uuid, uuid) });
}

/**
 * Fails with the missing uuid rather than a null dereference further down,
 * which is what a bare non-null assertion would give us.
 */
async function requireFileRow(uuid: string) {
	const row = await fileRow(uuid);
	if (!row) throw new Error(`No file row for uuid ${uuid}`);
	return row;
}

async function seedOtherUser() {
	return createTestUser({
		clerkId: OTHER_CLERK_USER_ID,
		email: "other@example.com",
		name: "Other User",
	});
}

beforeAll(async () => {
	await ensureTestBucket();
	server = await startTestServer();
	client = server.client();
});

afterAll(async () => {
	await server?.close();
});

beforeEach(async () => {
	await createTestUser();
});

afterEach(async () => {
	await truncateTables(files, users);
	await deleteAllObjects(UPLOAD_PREFIX);
});

describe("storage.uploadFile", () => {
	it("stores the bytes in the bucket and returns the metadata record", async () => {
		const bytes = new Uint8Array([0, 1, 2, 250, 251, 252, 253, 254, 255]);

		const record = await upload(client, "report.bin", bytes, "application/pdf");

		expect(record.uuid).toMatch(
			/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
		);
		expect(record.fileName).toBe("report.bin");
		expect(record.contentType).toBe("application/pdf");
		expect(record.sizeBytes).toBe(bytes.byteLength);

		const row = await requireFileRow(record.uuid);
		expect(row.key.startsWith(UPLOAD_PREFIX)).toBe(true);
		expect(row.sizeBytes).toBe(bytes.byteLength);

		expect(await objectExists(row.key)).toBe(true);
		expect(await getObjectBytes(row.key)).toEqual(Buffer.from(bytes));
	});

	it("records bucket, size and the uploader as createdBy", async () => {
		const [seeded] = await db.select().from(users);
		if (!seeded) throw new Error("Expected a seeded user");
		const record = await upload(client, "owned.txt", "owned");

		const row = await requireFileRow(record.uuid);
		expect(row.bucket).toBe(env.S3_BUCKET);
		expect(row.sizeBytes).toBe(5);
		expect(row.createdBy).toBe(seeded.id);
		expect(row.updatedBy).toBe(seeded.id);
		expect(record.createdBy).toBe(seeded.uuid);
	});

	it("stores application/octet-stream for an empty type, which the multipart transport normalises before the service runs", async () => {
		const record = await upload(client, "unknown.bin", "x", "");

		expect(record.contentType).toBe("application/octet-stream");
		const row = await fileRow(record.uuid);
		expect(row?.contentType).toBe("application/octet-stream");
	});

	it("uploads and reads back a zero-byte file", async () => {
		const record = await upload(
			client,
			"empty.txt",
			new Uint8Array(0),
			"text/plain",
		);

		expect(record.sizeBytes).toBe(0);
		const row = await requireFileRow(record.uuid);
		expect(await getObjectBytes(row.key)).toHaveLength(0);
	});

	it("keeps two uploads of the same filename as distinct records and objects", async () => {
		const first = await upload(client, "same.txt", "first");
		const second = await upload(client, "same.txt", "second");

		expect(first.uuid).not.toBe(second.uuid);

		const firstRow = await requireFileRow(first.uuid);
		const secondRow = await requireFileRow(second.uuid);
		expect(firstRow.key).not.toBe(secondRow.key);

		expect(await getObjectBytes(firstRow.key)).toEqual(Buffer.from("first"));
		expect(await getObjectBytes(secondRow.key)).toEqual(Buffer.from("second"));
	});

	it("rejects a file above the size limit without writing a row or an object", async () => {
		const oversized = new Uint8Array(MAX_FILE_SIZE_BYTES + 1);

		const error = await rejection(
			upload(client, "huge.bin", oversized, "application/octet-stream"),
		);

		expect(error.code).toBe("PAYLOAD_TOO_LARGE");
		expect(await db.select().from(files)).toHaveLength(0);
		expect(await listObjectKeys(UPLOAD_PREFIX)).toHaveLength(0);
	});
});

describe("storage.getFileUrl", () => {
	it("serves the exact bytes inline for mode view", async () => {
		const bytes = new Uint8Array([10, 20, 30, 40, 50]);
		const record = await upload(
			client,
			"view-me.bin",
			bytes,
			"application/octet-stream",
		);

		const { url } = await client.storage.getFileUrl({
			uuid: record.uuid,
			mode: "view",
		});
		const response = await fetch(url);

		expect(response.status).toBe(200);
		expect(response.headers.get("content-disposition")).toBe("inline");
		expect(Buffer.from(await response.arrayBuffer())).toEqual(
			Buffer.from(bytes),
		);
	});

	it("serves the file as an attachment carrying the filename for mode download", async () => {
		const record = await upload(
			client,
			"invoice.pdf",
			"pdf-bytes",
			"application/pdf",
		);

		const { url } = await client.storage.getFileUrl({
			uuid: record.uuid,
			mode: "download",
		});
		const response = await fetch(url);

		expect(response.status).toBe(200);
		const disposition = response.headers.get("content-disposition");
		expect(disposition).toContain("attachment");
		expect(disposition).toContain('filename="invoice.pdf"');
		expect(Buffer.from(await response.arrayBuffer())).toEqual(
			Buffer.from("pdf-bytes"),
		);
	});

	it("round-trips a non-ASCII filename through the download URL", async () => {
		const record = await upload(client, "résumé.pdf", "cv", "application/pdf");
		expect(record.fileName).toBe("résumé.pdf");

		const { url } = await client.storage.getFileUrl({
			uuid: record.uuid,
			mode: "download",
		});
		const response = await fetch(url);

		const disposition = response.headers.get("content-disposition");
		expect(disposition).toContain('filename="r%C3%A9sum%C3%A9.pdf"');
		expect(disposition).toContain("filename*=UTF-8''r%C3%A9sum%C3%A9.pdf");
		expect(Buffer.from(await response.arrayBuffer())).toEqual(
			Buffer.from("cv"),
		);
	});

	it("returns NOT_FOUND for an unknown uuid", async () => {
		const error = await rejection(
			client.storage.getFileUrl({
				uuid: "00000000-0000-4000-8000-000000000000",
				mode: "view",
			}),
		);

		expect(error.code).toBe("NOT_FOUND");
	});

	it("returns NOT_FOUND for a soft-deleted file", async () => {
		const record = await upload(client, "gone.txt", "gone");
		await client.storage.deleteFile({ uuid: record.uuid });

		const error = await rejection(
			client.storage.getFileUrl({ uuid: record.uuid, mode: "view" }),
		);

		expect(error.code).toBe("NOT_FOUND");
	});

	it("rejects a malformed uuid with a validation error", async () => {
		const error = await rejection(
			client.storage.getFileUrl({ uuid: "not-a-uuid", mode: "view" }),
		);

		expect(error.code).toBe("BAD_REQUEST");
	});
});

describe("storage.listFiles", () => {
	it("returns only the caller's non-deleted files, newest first", async () => {
		const older = await upload(client, "older.txt", "older");
		const newer = await upload(client, "newer.txt", "newer");
		const deleted = await upload(client, "deleted.txt", "deleted");
		await client.storage.deleteFile({ uuid: deleted.uuid });

		const other = await seedOtherUser();
		await createTestFile({ createdBy: other.id, fileName: "not-mine.txt" });

		const { files: listed } = await client.storage.listFiles();

		expect(listed.map((file) => file.uuid)).toEqual([newer.uuid, older.uuid]);
	});

	it("returns an empty list for a user with no files", async () => {
		await upload(client, "mine.txt", "mine");
		await seedOtherUser();

		const { files: listed } = await server
			.client(OTHER_CLERK_USER_ID)
			.storage.listFiles();

		expect(listed).toEqual([]);
	});
});

describe("storage.deleteFile", () => {
	it("removes the object, keeps the soft-deleted row and hides the file from the list", async () => {
		const record = await upload(client, "bye.txt", "bye");
		const row = await requireFileRow(record.uuid);

		expect(await client.storage.deleteFile({ uuid: record.uuid })).toEqual({
			deleted: true,
		});

		expect(await objectExists(row.key)).toBe(false);

		const survivingRow = await fileRow(record.uuid);
		expect(survivingRow).toBeDefined();
		expect(survivingRow?.deletedAt).toBeInstanceOf(Date);

		const { files: listed } = await client.storage.listFiles();
		expect(listed).toEqual([]);

		const error = await rejection(
			client.storage.getFileUrl({ uuid: record.uuid, mode: "view" }),
		);
		expect(error.code).toBe("NOT_FOUND");
	});

	it("returns NOT_FOUND for an unknown uuid", async () => {
		const error = await rejection(
			client.storage.deleteFile({
				uuid: "00000000-0000-4000-8000-000000000001",
			}),
		);

		expect(error.code).toBe("NOT_FOUND");
	});

	it("returns NOT_FOUND for an already-deleted file", async () => {
		const record = await upload(client, "twice.txt", "twice");
		await client.storage.deleteFile({ uuid: record.uuid });

		const error = await rejection(
			client.storage.deleteFile({ uuid: record.uuid }),
		);

		expect(error.code).toBe("NOT_FOUND");
	});
});

describe("cross-user access", () => {
	let otherClient: TestClient;

	beforeEach(async () => {
		await seedOtherUser();
		otherClient = server.client(OTHER_CLERK_USER_ID);
	});

	it("refuses getFileUrl on another user's file", async () => {
		const record = await upload(client, "private.txt", "private");

		const error = await rejection(
			otherClient.storage.getFileUrl({ uuid: record.uuid, mode: "view" }),
		);

		expect(error.code).toBe("FORBIDDEN");
	});

	it("refuses deleteFile on another user's file and leaves the object in the bucket", async () => {
		const record = await upload(client, "private.txt", "private");
		const row = await requireFileRow(record.uuid);

		const error = await rejection(
			otherClient.storage.deleteFile({ uuid: record.uuid }),
		);

		expect(error.code).toBe("FORBIDDEN");
		expect(await objectExists(row.key)).toBe(true);
		expect((await fileRow(record.uuid))?.deletedAt).toBeNull();
	});
});

describe("authentication", () => {
	it("rejects every storage procedure without auth", async () => {
		const anonymous = server.anonymousClient();
		const uuid = "00000000-0000-4000-8000-000000000002";

		const errors = await Promise.all([
			rejection(anonymous.storage.uploadFile({ file: testFile("a.txt", "a") })),
			rejection(anonymous.storage.getFileUrl({ uuid, mode: "view" })),
			rejection(anonymous.storage.listFiles()),
			rejection(anonymous.storage.deleteFile({ uuid })),
		]);

		expect(errors.map((error) => error.code)).toEqual([
			"UNAUTHORIZED",
			"UNAUTHORIZED",
			"UNAUTHORIZED",
			"UNAUTHORIZED",
		]);
	});
});
