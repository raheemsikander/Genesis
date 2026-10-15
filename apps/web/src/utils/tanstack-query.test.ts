import { ORPCError } from "@orpc/client";
import { describe, expect, it } from "vitest";
import { isRetryableError, RETRYABLE_CODES } from "./tanstack-query";

describe("isRetryableError", () => {
	it("retries non-ORPCError errors (network failures, etc.)", () => {
		expect(isRetryableError(new Error("Network error"))).toBe(true);
		expect(isRetryableError(new TypeError("fetch failed"))).toBe(true);
	});

	it.each([...RETRYABLE_CODES])("retries ORPCError with code %s", (code) => {
		const error = new ORPCError(
			code as ConstructorParameters<typeof ORPCError>[0],
		);
		expect(isRetryableError(error)).toBe(true);
	});

	it.each([
		"NOT_FOUND",
		"UNAUTHORIZED",
		"FORBIDDEN",
		"BAD_REQUEST",
		"CONFLICT",
	])("does not retry ORPCError with code %s", (code) => {
		const error = new ORPCError(
			code as ConstructorParameters<typeof ORPCError>[0],
		);
		expect(isRetryableError(error)).toBe(false);
	});
});
