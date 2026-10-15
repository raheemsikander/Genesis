import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockDbExecute = vi.fn();
const mockRedisPing = vi.fn();
const mockS3Send = vi.fn();
const envState: {
	REDIS_URL?: string;
	S3_ENDPOINT?: string;
	S3_ACCESS_KEY_ID?: string;
	S3_SECRET_ACCESS_KEY?: string;
	S3_BUCKET?: string;
} = {};

vi.mock("../db", () => ({
	db: {
		execute: (...args: unknown[]) => mockDbExecute(...args),
	},
}));

vi.mock("../storage", () => ({
	getS3Client: () => ({
		send: (...args: unknown[]) => mockS3Send(...args),
	}),
}));

vi.mock("./redis", () => ({
	getQueueRedis: () => ({
		ping: (...args: unknown[]) => mockRedisPing(...args),
	}),
}));

vi.mock("./env", () => ({
	get env() {
		return envState;
	},
}));

vi.mock("./logger", () => ({
	logger: {
		warn: vi.fn(),
		info: vi.fn(),
		error: vi.fn(),
		debug: vi.fn(),
	},
}));

import { checkHealth } from "./health";

beforeEach(() => {
	vi.clearAllMocks();
	envState.REDIS_URL = "redis://localhost:6379";
	envState.S3_ENDPOINT = "http://localhost:9000";
	envState.S3_ACCESS_KEY_ID = "key";
	envState.S3_SECRET_ACCESS_KEY = "secret";
	envState.S3_BUCKET = "bucket";
	mockDbExecute.mockResolvedValue(undefined);
	mockRedisPing.mockResolvedValue("PONG");
	mockS3Send.mockResolvedValue(undefined);
});

afterEach(() => {
	vi.useRealTimers();
});

describe("checkHealth", () => {
	it("returns status ok when all checks succeed", async () => {
		const report = await checkHealth();

		expect(report.status).toBe("ok");
		expect(report.checks.database.status).toBe("ok");
		expect(report.checks.redis.status).toBe("ok");
		expect(report.checks.storage.status).toBe("ok");
		expect(typeof report.uptimeSeconds).toBe("number");
	});

	it("returns degraded when database check fails", async () => {
		mockDbExecute.mockRejectedValueOnce(
			new Error("connection refused to internal-host:5432"),
		);

		const report = await checkHealth();

		expect(report.status).toBe("degraded");
		expect(report.checks.database.status).toBe("error");
		if (report.checks.database.status === "error") {
			expect(report.checks.database.error).toBe("check failed");
		}
		expect(report.checks.redis.status).toBe("ok");
		expect(report.checks.storage.status).toBe("ok");
	});

	it("returns degraded when redis check fails", async () => {
		mockRedisPing.mockRejectedValueOnce(new Error("redis down"));

		const report = await checkHealth();

		expect(report.status).toBe("degraded");
		expect(report.checks.redis.status).toBe("error");
	});

	it("returns degraded when storage check fails", async () => {
		mockS3Send.mockRejectedValueOnce(new Error("s3 down"));

		const report = await checkHealth();

		expect(report.status).toBe("degraded");
		expect(report.checks.storage.status).toBe("error");
	});

	it("does not degrade overall status when redis is skipped", async () => {
		envState.REDIS_URL = undefined;

		const report = await checkHealth();

		expect(report.status).toBe("ok");
		expect(report.checks.redis.status).toBe("skipped");
		expect(report.checks.database.status).toBe("ok");
		expect(report.checks.storage.status).toBe("ok");
		expect(mockRedisPing).not.toHaveBeenCalled();
	});

	it("does not degrade overall status when storage is skipped", async () => {
		envState.S3_ENDPOINT = undefined;

		const report = await checkHealth();

		expect(report.status).toBe("ok");
		expect(report.checks.storage.status).toBe("skipped");
		expect(mockS3Send).not.toHaveBeenCalled();
	});

	it("sanitizes error messages to a generic string", async () => {
		mockDbExecute.mockRejectedValueOnce(
			new Error("postgres://secret@internal-db.local:5432/app"),
		);

		const report = await checkHealth();

		if (report.checks.database.status === "error") {
			expect(report.checks.database.error).toBe("check failed");
			expect(report.checks.database.error).not.toContain("internal-db.local");
		} else {
			throw new Error("expected database check to error");
		}
	});

	it("marks a check as error when it exceeds the timeout", async () => {
		vi.useFakeTimers();
		// A check that never settles must be forced to error by the 2s timeout.
		mockDbExecute.mockReturnValueOnce(new Promise(() => {}));

		const reportPromise = checkHealth();
		await vi.advanceTimersByTimeAsync(2_000);
		const report = await reportPromise;

		expect(report.status).toBe("degraded");
		expect(report.checks.database.status).toBe("error");
	});
});
