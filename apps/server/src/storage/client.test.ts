import { beforeEach, describe, expect, it, vi } from "vitest";

// Shared env state mutated per test: mirrors the pattern in health.test.ts
const envState: {
	S3_ENDPOINT?: string;
	S3_PUBLIC_ENDPOINT?: string;
	S3_REGION?: string;
	S3_ACCESS_KEY_ID?: string;
	S3_SECRET_ACCESS_KEY?: string;
} = {};

// Track construction args for each S3Client instance
const constructorCalls: Array<{
	region?: string;
	endpoint?: string;
	credentials?: { accessKeyId?: string; secretAccessKey?: string };
	forcePathStyle?: boolean;
}> = [];

vi.mock("@aws-sdk/client-s3", () => ({
	S3Client: class MockS3Client {
		constructor(config: {
			region?: string;
			endpoint?: string;
			credentials?: { accessKeyId?: string; secretAccessKey?: string };
			forcePathStyle?: boolean;
		}) {
			constructorCalls.push({
				region: config.region,
				endpoint: config.endpoint,
				credentials: config.credentials,
				forcePathStyle: config.forcePathStyle,
			});
		}
	},
}));

vi.mock("../utils/env", () => ({
	get env() {
		return envState;
	},
}));

beforeEach(() => {
	// Reset modules before each test to get fresh singleton instances
	vi.resetModules();
	constructorCalls.length = 0;
	envState.S3_ENDPOINT = "http://localhost:9000";
	envState.S3_PUBLIC_ENDPOINT = undefined;
	envState.S3_REGION = "us-east-1";
	envState.S3_ACCESS_KEY_ID = "key";
	envState.S3_SECRET_ACCESS_KEY = "secret";
});

describe("getS3Client", () => {
	it("throws when S3_ENDPOINT is not set", async () => {
		envState.S3_ENDPOINT = undefined;
		envState.S3_ACCESS_KEY_ID = undefined;
		const { getS3Client } = await import("./client");
		expect(() => getS3Client()).toThrow("Storage is not configured");
	});

	it("throws when only S3_ACCESS_KEY_ID is missing", async () => {
		envState.S3_ACCESS_KEY_ID = undefined;
		const { getS3Client } = await import("./client");
		expect(() => getS3Client()).toThrow("Storage is not configured");
	});

	it("throws when only S3_SECRET_ACCESS_KEY is missing", async () => {
		envState.S3_SECRET_ACCESS_KEY = undefined;
		const { getS3Client } = await import("./client");
		expect(() => getS3Client()).toThrow("Storage is not configured");
	});

	it("caches the client across calls, constructing only once", async () => {
		const { getS3Client } = await import("./client");
		const first = getS3Client();
		const second = getS3Client();
		expect(first).toBe(second);
		expect(constructorCalls.length).toBe(1);
	});

	it("constructs the internal client with the full expected config", async () => {
		const { getS3Client } = await import("./client");
		getS3Client();
		expect(constructorCalls).toEqual([
			{
				region: "us-east-1",
				endpoint: "http://localhost:9000",
				credentials: { accessKeyId: "key", secretAccessKey: "secret" },
				forcePathStyle: true,
			},
		]);
	});
});

describe("getPresignClient", () => {
	it("returns the internal client when S3_PUBLIC_ENDPOINT is not set", async () => {
		const { getPresignClient, getS3Client } = await import("./client");
		const presign = getPresignClient();
		const internal = getS3Client();
		// Both references must be the same singleton: no second client constructed
		expect(presign).toBe(internal);
		expect(constructorCalls.length).toBe(1);
		expect(constructorCalls[0]?.endpoint).toBe("http://localhost:9000");
	});

	it("returns a client when S3_PUBLIC_ENDPOINT is set", async () => {
		envState.S3_PUBLIC_ENDPOINT = "http://192.168.1.10:9000";
		const { getPresignClient, getS3Client } = await import("./client");
		getPresignClient();
		getS3Client();
		// Presign client has the public endpoint
		expect(constructorCalls).toContainEqual(
			expect.objectContaining({ endpoint: "http://192.168.1.10:9000" }),
		);
		// Internal client has the internal endpoint
		expect(constructorCalls).toContainEqual(
			expect.objectContaining({ endpoint: "http://localhost:9000" }),
		);
	});

	it("presigned client is distinct from the internal client when S3_PUBLIC_ENDPOINT is set", async () => {
		envState.S3_PUBLIC_ENDPOINT = "http://192.168.1.10:9000";
		const { getPresignClient, getS3Client } = await import("./client");
		const presign = getPresignClient();
		const internal = getS3Client();
		/**
		 * When a public endpoint is configured the presign client must be a
		 * separate instance so that SigV4 signatures cover the correct host.
		 */
		expect(presign).not.toBe(internal);
	});

	it("throws when S3_PUBLIC_ENDPOINT is set but credentials are missing", async () => {
		envState.S3_PUBLIC_ENDPOINT = "http://192.168.1.10:9000";
		envState.S3_ACCESS_KEY_ID = undefined;
		const { getPresignClient } = await import("./client");
		expect(() => getPresignClient()).toThrow("Storage is not configured");
	});

	it("throws when S3_PUBLIC_ENDPOINT is set and only S3_SECRET_ACCESS_KEY is missing", async () => {
		envState.S3_PUBLIC_ENDPOINT = "http://192.168.1.10:9000";
		envState.S3_SECRET_ACCESS_KEY = undefined;
		const { getPresignClient } = await import("./client");
		expect(() => getPresignClient()).toThrow("Storage is not configured");
	});

	it("constructs the presign client with the full expected config when S3_PUBLIC_ENDPOINT is set", async () => {
		envState.S3_PUBLIC_ENDPOINT = "http://192.168.1.10:9000";
		const { getPresignClient } = await import("./client");
		getPresignClient();
		expect(constructorCalls).toContainEqual({
			region: "us-east-1",
			endpoint: "http://192.168.1.10:9000",
			credentials: { accessKeyId: "key", secretAccessKey: "secret" },
			forcePathStyle: true,
		});
	});

	it("caches the presign client across calls when S3_PUBLIC_ENDPOINT is set", async () => {
		envState.S3_PUBLIC_ENDPOINT = "http://192.168.1.10:9000";
		const { getPresignClient } = await import("./client");
		const first = getPresignClient();
		const second = getPresignClient();
		expect(first).toBe(second);
		expect(constructorCalls.length).toBe(1);
	});
});
