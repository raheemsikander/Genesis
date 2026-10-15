import { ORPCError } from "@orpc/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockTrackerError = vi.fn();
const mockTrackerWarning = vi.fn();
const mockTrackerCritical = vi.fn();
const mockLoggerWarn = vi.fn();
const mockLoggerError = vi.fn();

vi.mock("../utils/rollbar", () => ({
	rollbar: {
		warning: (...args: unknown[]) => mockTrackerWarning(...args),
		error: (...args: unknown[]) => mockTrackerError(...args),
		critical: (...args: unknown[]) => mockTrackerCritical(...args),
		wait: (cb: () => void) => cb(),
	},
}));

vi.mock("../utils/logger", () => ({
	logger: {
		warn: (...args: unknown[]) => mockLoggerWarn(...args),
		error: (...args: unknown[]) => mockLoggerError(...args),
	},
}));

import { handleRpcError } from "./error-interceptor";

beforeEach(() => {
	vi.clearAllMocks();
});

describe("handleRpcError", () => {
	it("reports a bare Error thrown by a handler", () => {
		const err = new Error("boom");
		handleRpcError(err);
		expect(mockTrackerError).toHaveBeenCalledTimes(1);
		expect(mockTrackerError.mock.calls[0]?.[0]).toBe(err);
		expect(mockLoggerError).toHaveBeenCalled();
	});

	it("reports a 5xx ORPCError", () => {
		const err = new ORPCError("INTERNAL_SERVER_ERROR");
		handleRpcError(err);
		expect(mockTrackerError).toHaveBeenCalledTimes(1);
		expect(mockTrackerError.mock.calls[0]?.[0]).toBe(err);
	});

	it("does not report a 4xx ORPCError", () => {
		handleRpcError(new ORPCError("NOT_FOUND"));
		expect(mockTrackerError).not.toHaveBeenCalled();
		expect(mockTrackerWarning).not.toHaveBeenCalled();
		expect(mockTrackerCritical).not.toHaveBeenCalled();
	});

	it("logs a 4xx at warn, not error", () => {
		handleRpcError(new ORPCError("BAD_REQUEST"));
		expect(mockLoggerWarn).toHaveBeenCalled();
		expect(mockLoggerError).not.toHaveBeenCalled();
	});

	it("reports a thrown non-Error value", () => {
		handleRpcError("boom");
		expect(mockTrackerError).toHaveBeenCalledTimes(1);
		expect((mockTrackerError.mock.calls[0]?.[0] as Error).message).toContain(
			"boom",
		);
	});
});
