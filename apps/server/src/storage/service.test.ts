import { beforeEach, describe, expect, it, vi } from "vitest";

const envState: { S3_BUCKET?: string } = {};

const putObjectCalls: Array<Record<string, unknown>> = [];
const getObjectCalls: Array<Record<string, unknown>> = [];
const deleteObjectCalls: Array<Record<string, unknown>> = [];

const mockSend = vi.fn();

vi.mock("@aws-sdk/client-s3", () => ({
	PutObjectCommand: class PutObjectCommand {
		input: Record<string, unknown>;
		constructor(input: Record<string, unknown>) {
			this.input = input;
			putObjectCalls.push(input);
		}
	},
	GetObjectCommand: class GetObjectCommand {
		input: Record<string, unknown>;
		constructor(input: Record<string, unknown>) {
			this.input = input;
			getObjectCalls.push(input);
		}
	},
	DeleteObjectCommand: class DeleteObjectCommand {
		input: Record<string, unknown>;
		constructor(input: Record<string, unknown>) {
			this.input = input;
			deleteObjectCalls.push(input);
		}
	},
}));

const mockGetSignedUrl = vi.fn();

vi.mock("@aws-sdk/s3-request-presigner", () => ({
	getSignedUrl: (...args: unknown[]) => mockGetSignedUrl(...args),
}));

vi.mock("../utils/env", () => ({
	get env() {
		return envState;
	},
}));

const internalClient = { send: mockSend };
const presignClient = {};

vi.mock("./client", () => ({
	getS3Client: () => internalClient,
	getPresignClient: () => presignClient,
}));

import { createPresignedUrl, deleteObject, uploadBuffer } from "./service";

beforeEach(() => {
	vi.clearAllMocks();
	putObjectCalls.length = 0;
	getObjectCalls.length = 0;
	deleteObjectCalls.length = 0;
	envState.S3_BUCKET = "test-bucket";
	mockSend.mockResolvedValue(undefined);
	mockGetSignedUrl.mockResolvedValue("https://signed.example.com/object");
});

describe("uploadBuffer", () => {
	it("sends a PutObjectCommand with the bucket, key, body, and content type", async () => {
		const body = Buffer.from("hello world");

		await uploadBuffer("uploads/user-1/file.txt", body, "text/plain");

		expect(putObjectCalls).toEqual([
			{
				Bucket: "test-bucket",
				Key: "uploads/user-1/file.txt",
				Body: body,
				ContentType: "text/plain",
			},
		]);
		// The internal client, not the presign client, performs uploads.
		expect(mockSend).toHaveBeenCalledTimes(1);
	});

	it("propagates a rejecting send", async () => {
		mockSend.mockRejectedValueOnce(new Error("upload failed"));

		await expect(
			uploadBuffer("uploads/user-1/file.txt", Buffer.from("x"), "text/plain"),
		).rejects.toThrow("upload failed");
	});
});

describe("deleteObject", () => {
	it("sends a DeleteObjectCommand with the bucket and key", async () => {
		await deleteObject("uploads/user-1/file.txt");

		expect(deleteObjectCalls).toEqual([
			{ Bucket: "test-bucket", Key: "uploads/user-1/file.txt" },
		]);
		expect(mockSend).toHaveBeenCalledTimes(1);
	});

	it("propagates a rejecting send", async () => {
		mockSend.mockRejectedValueOnce(new Error("delete failed"));

		await expect(deleteObject("uploads/user-1/file.txt")).rejects.toThrow(
			"delete failed",
		);
	});
});

describe("createPresignedUrl", () => {
	it("signs against the presign client, not the internal client", async () => {
		await createPresignedUrl("uploads/user-1/file.txt", "file.txt", "view");

		expect(mockGetSignedUrl).toHaveBeenCalledTimes(1);
		expect(mockGetSignedUrl.mock.calls[0]?.[0]).toBe(presignClient);
	});

	it("expires in 3600 seconds", async () => {
		await createPresignedUrl("uploads/user-1/file.txt", "file.txt", "view");

		expect(mockGetSignedUrl.mock.calls[0]?.[2]).toEqual({ expiresIn: 3600 });
	});

	it("sets ResponseContentDisposition to inline for view mode", async () => {
		await createPresignedUrl("uploads/user-1/file.txt", "file.txt", "view");

		expect(getObjectCalls[0]?.ResponseContentDisposition).toBe("inline");
	});

	it("sets attachment with filename and filename* for download mode", async () => {
		await createPresignedUrl("uploads/user-1/file.txt", "file.txt", "download");

		expect(getObjectCalls[0]?.ResponseContentDisposition).toBe(
			"attachment; filename=\"file.txt\"; filename*=UTF-8''file.txt",
		);
	});

	it("encodes a plain ASCII filename unchanged", async () => {
		await createPresignedUrl(
			"uploads/user-1/report.pdf",
			"report.pdf",
			"download",
		);

		expect(getObjectCalls[0]?.ResponseContentDisposition).toBe(
			"attachment; filename=\"report.pdf\"; filename*=UTF-8''report.pdf",
		);
	});

	/**
	 * The last row pins encodeURIComponent's real output: it leaves ! ' ( ) *
	 * untouched, and the header reflects that rather than a stricter encoding.
	 */
	it.each([
		["résumé.pdf", "r%C3%A9sum%C3%A9.pdf"],
		['weird"name;here.pdf', "weird%22name%3Bhere.pdf"],
		["my file name.pdf", "my%20file%20name.pdf"],
		["quote's(1)!*.pdf", "quote's(1)!*.pdf"],
	])("encodes %j as %s in the download header", async (fileName, encoded) => {
		await createPresignedUrl("uploads/user-1/file.pdf", fileName, "download");

		expect(encodeURIComponent(fileName)).toBe(encoded);
		expect(getObjectCalls[0]?.ResponseContentDisposition).toBe(
			`attachment; filename="${encoded}"; filename*=UTF-8''${encoded}`,
		);
	});

	it("returns exactly what getSignedUrl resolves to", async () => {
		mockGetSignedUrl.mockResolvedValueOnce("https://example.com/specific-url");

		const result = await createPresignedUrl(
			"uploads/user-1/file.txt",
			"file.txt",
			"view",
		);

		expect(result).toBe("https://example.com/specific-url");
	});
});
