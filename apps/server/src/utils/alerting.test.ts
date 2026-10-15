import { ORPCError } from "@orpc/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockWarning = vi.fn();
const mockError = vi.fn();
const mockCritical = vi.fn();
const mockWait = vi.fn((cb: () => void) => cb());
const mockLoggerError = vi.fn();

let contextState: Record<string, unknown> | undefined;

vi.mock("./rollbar", () => ({
	rollbar: {
		warning: (...args: unknown[]) => mockWarning(...args),
		error: (...args: unknown[]) => mockError(...args),
		critical: (...args: unknown[]) => mockCritical(...args),
		wait: (cb: () => void) => mockWait(cb),
	},
}));

vi.mock("./request-context", () => ({
	getRequestContext: () => contextState,
	isJobContext: (ctx: Record<string, unknown>) => "jobId" in ctx,
}));

vi.mock("./logger", () => ({
	logger: { error: (...args: unknown[]) => mockLoggerError(...args) },
}));

import {
	AlertSeverity,
	flushAlerts,
	isAlertable,
	reportAlert,
} from "./alerting";

beforeEach(() => {
	vi.clearAllMocks();
	contextState = { requestId: "req-1" };
	mockWait.mockImplementation((cb: () => void) => cb());
});

describe("isAlertable", () => {
	it("rejects client faults", () => {
		expect(isAlertable(new ORPCError("NOT_FOUND"))).toBe(false);
		expect(isAlertable(new ORPCError("BAD_REQUEST"))).toBe(false);
		expect(isAlertable(new ORPCError("UNAUTHORIZED"))).toBe(false);
	});

	it("accepts server faults", () => {
		expect(isAlertable(new ORPCError("INTERNAL_SERVER_ERROR"))).toBe(true);
	});

	it("accepts a bare Error", () => {
		expect(isAlertable(new Error("boom"))).toBe(true);
	});

	it("accepts a thrown non-Error value", () => {
		expect(isAlertable("boom")).toBe(true);
		expect(isAlertable({ code: 1 })).toBe(true);
	});
});

describe("reportAlert", () => {
	it("defaults to the error severity", () => {
		reportAlert(new Error("boom"));
		expect(mockError).toHaveBeenCalledTimes(1);
		expect(mockWarning).not.toHaveBeenCalled();
		expect(mockCritical).not.toHaveBeenCalled();
	});

	it("routes each severity to its tracker method", () => {
		reportAlert(new Error("a"), { severity: AlertSeverity.WARNING });
		reportAlert(new Error("b"), { severity: AlertSeverity.CRITICAL });
		expect(mockWarning).toHaveBeenCalledTimes(1);
		expect(mockCritical).toHaveBeenCalledTimes(1);
	});

	it("attaches the ambient requestId", () => {
		reportAlert(new Error("boom"));
		expect(mockError.mock.calls[0]?.[1]).toMatchObject({
			custom: { requestId: "req-1" },
		});
	});

	it("attaches jobId and queue inside a job context", () => {
		contextState = {
			requestId: "req-2",
			jobId: "job-9",
			queue: "sample.background",
		};
		reportAlert(new Error("boom"));
		expect(mockError.mock.calls[0]?.[1]).toMatchObject({
			custom: {
				requestId: "req-2",
				jobId: "job-9",
				queue: "sample.background",
			},
		});
	});

	it("reports with no correlation fields outside a request or job", () => {
		contextState = undefined;
		reportAlert(new Error("boom"));
		expect(mockError).toHaveBeenCalledTimes(1);
		expect(mockError.mock.calls[0]?.[1]).toMatchObject({ custom: {} });
	});

	it("merges caller context", () => {
		reportAlert(new Error("boom"), {
			context: { queue: "q", attempt: 3 },
		});
		expect(mockError.mock.calls[0]?.[1]).toMatchObject({
			custom: { queue: "q", attempt: 3, requestId: "req-1" },
		});
	});

	/**
	 * The tracker parses headers, query and client IP off the request, and only
	 * when it is passed positionally. Folding it into `custom` would leave the
	 * item's request panel empty.
	 */
	it("passes a request through ahead of the payload", () => {
		const request = { method: "GET", url: "/webhook" };
		reportAlert(new Error("boom"), { request, context: { url: "/webhook" } });
		expect(mockError.mock.calls[0]?.[1]).toBe(request);
		expect(mockError.mock.calls[0]?.[2]).toMatchObject({
			custom: { url: "/webhook", requestId: "req-1" },
		});
	});

	it("omits the request argument entirely when there is none", () => {
		reportAlert(new Error("boom"));
		expect(mockError.mock.calls[0]).toHaveLength(2);
		expect(mockError.mock.calls[0]?.[1]).toMatchObject({
			custom: { requestId: "req-1" },
		});
	});

	it("lets the ambient correlation field win over a colliding caller key", () => {
		reportAlert(new Error("boom"), { context: { requestId: "spoofed" } });
		expect(mockError.mock.calls[0]?.[1]).toMatchObject({
			custom: { requestId: "req-1" },
		});
	});

	it("normalises a thrown non-Error into an Error preserving the value", () => {
		reportAlert("boom");
		const reported = mockError.mock.calls[0]?.[0] as Error;
		expect(reported).toBeInstanceOf(Error);
		expect(reported.message).toContain("boom");
	});

	it("serialises a thrown object into the reported message", () => {
		reportAlert({ code: "E_CONN", detail: "socket hang up" });
		const reported = mockError.mock.calls[0]?.[0] as Error;
		expect(reported.message).toContain('"code":"E_CONN"');
		expect(reported.message).toContain('"detail":"socket hang up"');
	});

	/** A driver's thrown value routinely carries a back-reference to its client. */
	it("still reports a thrown value that cannot be serialised", () => {
		const circular: Record<string, unknown> = { code: "E_CONN" };
		circular.self = circular;

		expect(() => reportAlert(circular)).not.toThrow();
		const reported = mockError.mock.calls[0]?.[0] as Error;
		expect(reported).toBeInstanceOf(Error);
		expect(reported.message).toContain("[object Object]");
	});

	it("passes an Error through unchanged", () => {
		const err = new Error("boom");
		reportAlert(err);
		expect(mockError.mock.calls[0]?.[0]).toBe(err);
	});

	it("never throws when the tracker fails", () => {
		mockError.mockImplementation(() => {
			throw new Error("rollbar down");
		});
		expect(() => reportAlert(new Error("boom"))).not.toThrow();
		expect(mockLoggerError).toHaveBeenCalled();
	});
});

describe("flushAlerts", () => {
	it("resolves once the tracker drains", async () => {
		await expect(flushAlerts()).resolves.toBeUndefined();
		expect(mockWait).toHaveBeenCalled();
	});

	/** A drain that throws must not become the reason an intentional exit hangs. */
	it("resolves when the tracker throws instead of draining", async () => {
		mockWait.mockImplementation(() => {
			throw new Error("rollbar down");
		});

		await expect(flushAlerts()).resolves.toBeUndefined();
		expect(mockLoggerError).toHaveBeenCalled();
	});

	it("resolves on timeout when the tracker never drains", async () => {
		vi.useFakeTimers();
		mockWait.mockImplementation(() => {});
		const pending = flushAlerts(2_000);
		await vi.advanceTimersByTimeAsync(2_000);
		await expect(pending).resolves.toBeUndefined();
		vi.useRealTimers();
	});
});
