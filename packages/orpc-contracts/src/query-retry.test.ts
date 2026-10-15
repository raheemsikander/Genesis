import { ORPCError } from "@orpc/client";
import { describe, expect, it } from "vitest";
import { isRetryableError, queryRetryOptions } from "./query-retry";

describe("isRetryableError", () => {
	it("returns true for ORPCError with a retryable code", () => {
		expect(isRetryableError(new ORPCError("INTERNAL_SERVER_ERROR"))).toBe(true);
	});

	it("returns true for ORPCError with TIMEOUT code", () => {
		expect(isRetryableError(new ORPCError("TIMEOUT"))).toBe(true);
	});

	it("returns false for ORPCError with a non-retryable code", () => {
		expect(isRetryableError(new ORPCError("NOT_FOUND"))).toBe(false);
	});

	it("returns false for ORPCError with UNAUTHORIZED code", () => {
		expect(isRetryableError(new ORPCError("UNAUTHORIZED"))).toBe(false);
	});

	it("returns true for a plain Error (non-ORPCError)", () => {
		expect(isRetryableError(new Error("network failure"))).toBe(true);
	});

	it("returns true for non-Error values", () => {
		expect(isRetryableError("some string error")).toBe(true);
		expect(isRetryableError(null)).toBe(true);
	});
});

describe("queryRetryOptions.retry", () => {
	it("returns false when the error is non-retryable regardless of failureCount", () => {
		const nonRetryable = new ORPCError("NOT_FOUND");
		expect(queryRetryOptions.retry(0, nonRetryable)).toBe(false);
		expect(queryRetryOptions.retry(1, nonRetryable)).toBe(false);
		expect(queryRetryOptions.retry(5, nonRetryable)).toBe(false);
	});

	it("returns true for a retryable error when failureCount is below 3", () => {
		const retryable = new ORPCError("INTERNAL_SERVER_ERROR");
		expect(queryRetryOptions.retry(0, retryable)).toBe(true);
		expect(queryRetryOptions.retry(2, retryable)).toBe(true);
	});

	it("returns false for a retryable error when failureCount reaches 3", () => {
		const retryable = new ORPCError("INTERNAL_SERVER_ERROR");
		expect(queryRetryOptions.retry(3, retryable)).toBe(false);
	});

	it("returns true for a plain Error below the failure cap", () => {
		expect(queryRetryOptions.retry(1, new Error("network"))).toBe(true);
	});
});

describe("queryRetryOptions.retryDelay", () => {
	it("returns 1000 ms for attemptIndex 0", () => {
		expect(queryRetryOptions.retryDelay(0)).toBe(1000);
	});

	it("returns 4000 ms for attemptIndex 2", () => {
		expect(queryRetryOptions.retryDelay(2)).toBe(4000);
	});

	it("caps at 30000 ms for large attemptIndex values", () => {
		expect(queryRetryOptions.retryDelay(10)).toBe(30000);
	});

	it("returns 2000 ms for attemptIndex 1", () => {
		expect(queryRetryOptions.retryDelay(1)).toBe(2000);
	});
});
