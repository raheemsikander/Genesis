import { randomUUID } from "node:crypto";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import {
	deleteAllObjects,
	ensureTestBucket,
	getObjectBytes,
	objectExists,
} from "../../tests/helpers/s3.test-helper";
import { env } from "../utils/env";
import { createPresignedUrl, getPresignClient, uploadBuffer } from "./index";

const PREFIX = "presign-test/";

function bytesOf(size: number): Uint8Array<ArrayBuffer> {
	return new Uint8Array(size).map((_, i) => i % 256);
}

function uniqueKey(): string {
	return `${PREFIX}${randomUUID()}`;
}

/**
 * Signed through the same presign client createPresignedUrl uses, so a
 * direct-upload feature built on it inherits what this proves. It is the path
 * that storage verifying the SDK's default request checksum breaks.
 */
function presignedPutUrl(key: string, contentLength: number): Promise<string> {
	return getSignedUrl(
		getPresignClient(),
		new PutObjectCommand({
			Bucket: env.S3_BUCKET,
			Key: key,
			ContentType: "image/jpeg",
			ContentLength: contentLength,
		}),
		{ expiresIn: 300 },
	);
}

function putTo(url: string, body: Uint8Array<ArrayBuffer>) {
	return fetch(url, {
		method: "PUT",
		body,
		headers: { "Content-Type": "image/jpeg" },
	});
}

beforeAll(ensureTestBucket);

afterEach(async () => {
	await deleteAllObjects(PREFIX);
});

describe("presigned upload URLs (real S3)", () => {
	it("accepts an upload whose size matches the signed length", async () => {
		const key = uniqueKey();
		const body = bytesOf(1024);

		const res = await putTo(await presignedPutUrl(key, body.length), body);

		expect(res.status).toBe(200);
		expect(await getObjectBytes(key)).toEqual(Buffer.from(body));
	});

	it("rejects an upload larger than the signed length and stores nothing", async () => {
		const key = uniqueKey();

		const res = await putTo(await presignedPutUrl(key, 1024), bytesOf(1034));

		expect(res.status).toBe(403);
		expect(await objectExists(key)).toBe(false);
	});
});

describe("presigned download URLs (real S3)", () => {
	it("serves the object with the requested attachment filename", async () => {
		const key = uniqueKey();
		const body = bytesOf(512);
		await uploadBuffer(key, Buffer.from(body), "application/pdf");
		const fileName = "Grüße 日本 report.pdf";
		const encoded = encodeURIComponent(fileName);

		const res = await fetch(
			await createPresignedUrl(key, fileName, "download"),
		);

		expect(res.status).toBe(200);
		expect(res.headers.get("content-disposition")).toBe(
			`attachment; filename="${encoded}"; filename*=UTF-8''${encoded}`,
		);
		expect(Buffer.from(await res.arrayBuffer())).toEqual(Buffer.from(body));
	});
});
