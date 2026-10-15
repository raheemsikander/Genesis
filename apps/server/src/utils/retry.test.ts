import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isTransient, withRetry } from "./retry";

beforeEach(() => {
	vi.useFakeTimers();
});

afterEach(() => {
	vi.useRealTimers();
	vi.restoreAllMocks();
});

// Pins jitter to ~full backoff. Use only in tests that assert delay bounds.
function pinJitterToMax() {
	vi.spyOn(Math, "random").mockReturnValue(0.9999999);
}

describe("isTransient", () => {
	it("returns true for network error codes", () => {
		const codes = [
			"ECONNRESET",
			"ETIMEDOUT",
			"ECONNREFUSED",
			"EAI_AGAIN",
			"ENOTFOUND",
			"EPIPE",
		];
		for (const code of codes) {
			const err = Object.assign(new Error("network"), { code });
			expect(isTransient(err)).toBe(true);
		}
	});

	it("returns true for HTTP 5xx status", () => {
		expect(isTransient({ status: 500 })).toBe(true);
		expect(isTransient({ status: 503 })).toBe(true);
		expect(isTransient({ statusCode: 504 })).toBe(true);
		expect(isTransient({ response: { status: 502 } })).toBe(true);
		expect(isTransient({ response: { statusCode: 502 } })).toBe(true);
	});

	it("returns true for HTTP 429", () => {
		expect(isTransient({ status: 429 })).toBe(true);
	});

	it("returns true for HTTP 408", () => {
		expect(isTransient({ status: 408 })).toBe(true);
	});

	it("returns false for 4xx other than 429", () => {
		expect(isTransient({ status: 400 })).toBe(false);
		expect(isTransient({ status: 401 })).toBe(false);
		expect(isTransient({ status: 404 })).toBe(false);
	});

	it("returns false for plain errors with no status or code", () => {
		expect(isTransient(new Error("boom"))).toBe(false);
		expect(isTransient("string")).toBe(false);
		expect(isTransient(undefined)).toBe(false);
	});
});

describe("withRetry", () => {
	it("returns value on first success without retries", async () => {
		const fn = vi.fn().mockResolvedValue("ok");

		await expect(withRetry(fn)).resolves.toBe("ok");
		expect(fn).toHaveBeenCalledTimes(1);
	});

	it("retries on transient error and returns value", async () => {
		const fn = vi
			.fn()
			.mockRejectedValueOnce({ status: 503 })
			.mockResolvedValueOnce("ok");

		const promise = withRetry(fn, { baseDelayMs: 10 });
		await vi.runAllTimersAsync();

		await expect(promise).resolves.toBe("ok");
		expect(fn).toHaveBeenCalledTimes(2);
	});

	it("throws the last error after exhausting attempts", async () => {
		const err = { status: 503 };
		const fn = vi.fn().mockRejectedValue(err);

		const assertion = expect(
			withRetry(fn, { attempts: 3, baseDelayMs: 10 }),
		).rejects.toBe(err);
		await vi.runAllTimersAsync();
		await assertion;

		expect(fn).toHaveBeenCalledTimes(3);
	});

	it("does not retry non-transient errors", async () => {
		const err = { status: 400 };
		const fn = vi.fn().mockRejectedValue(err);

		await expect(withRetry(fn)).rejects.toBe(err);
		expect(fn).toHaveBeenCalledTimes(1);
	});

	it("retries network errors (ECONNRESET)", async () => {
		const err = Object.assign(new Error("reset"), { code: "ECONNRESET" });
		const fn = vi.fn().mockRejectedValueOnce(err).mockResolvedValueOnce("ok");

		const promise = withRetry(fn, { baseDelayMs: 10 });
		await vi.runAllTimersAsync();

		await expect(promise).resolves.toBe("ok");
		expect(fn).toHaveBeenCalledTimes(2);
	});

	it("invokes onRetry between attempts with (err, attempt, delayMs)", async () => {
		const err = { status: 503 };
		const fn = vi.fn().mockRejectedValueOnce(err).mockResolvedValueOnce("ok");
		const onRetry = vi.fn();

		const promise = withRetry(fn, { baseDelayMs: 10, onRetry });
		await vi.runAllTimersAsync();
		await promise;

		expect(onRetry).toHaveBeenCalledTimes(1);
		expect(onRetry).toHaveBeenCalledWith(err, 1, expect.any(Number));
	});

	it("swallows errors thrown by onRetry and continues retrying", async () => {
		const fn = vi
			.fn()
			.mockRejectedValueOnce({ status: 503 })
			.mockResolvedValueOnce("ok");
		const onRetry = vi.fn(() => {
			throw new Error("logger blew up");
		});

		const promise = withRetry(fn, { baseDelayMs: 10, onRetry });
		await vi.runAllTimersAsync();

		await expect(promise).resolves.toBe("ok");
		expect(fn).toHaveBeenCalledTimes(2);
		expect(onRetry).toHaveBeenCalledTimes(1);
	});

	it("uses a custom isRetryable predicate", async () => {
		const err = { status: 400 };
		const fn = vi.fn().mockRejectedValueOnce(err).mockResolvedValueOnce("ok");

		const promise = withRetry(fn, {
			baseDelayMs: 10,
			isRetryable: () => true,
		});
		await vi.runAllTimersAsync();

		await expect(promise).resolves.toBe("ok");
		expect(fn).toHaveBeenCalledTimes(2);
	});

	it("caps delay at maxDelayMs", async () => {
		pinJitterToMax();
		const onRetry = vi.fn();
		const fn = vi.fn().mockRejectedValue({ status: 503 });

		const promise = withRetry(fn, {
			attempts: 5,
			baseDelayMs: 1000,
			maxDelayMs: 1500,
			onRetry,
		}).catch(() => undefined);

		await vi.runAllTimersAsync();
		await promise;

		const delays = onRetry.mock.calls.map(([, , delayMs]) => delayMs);
		for (const delay of delays) {
			expect(delay).toBeLessThanOrEqual(1500);
		}
	});

	it("throws abort reason when signal is already aborted", async () => {
		const controller = new AbortController();
		controller.abort(new Error("cancelled"));
		const fn = vi.fn().mockResolvedValue("ok");

		await expect(withRetry(fn, { signal: controller.signal })).rejects.toThrow(
			"cancelled",
		);
		expect(fn).not.toHaveBeenCalled();
	});

	it("aborts mid-backoff when signal fires", async () => {
		const controller = new AbortController();
		const fn = vi.fn().mockRejectedValue({ status: 503 });
		// Abort fires once onRetry runs, which is the last thing before sleep starts.
		// This avoids fragile microtask-yield timing if more awaits get inserted.
		const onRetry = vi.fn(() => {
			controller.abort(new Error("cancelled"));
		});

		await expect(
			withRetry(fn, {
				baseDelayMs: 1000,
				signal: controller.signal,
				onRetry,
			}),
		).rejects.toThrow("cancelled");

		expect(fn).toHaveBeenCalledTimes(1);
		expect(onRetry).toHaveBeenCalledTimes(1);
	});

	it("does not call onRetry on the final, failing attempt", async () => {
		const onRetry = vi.fn();
		const fn = vi.fn().mockRejectedValue({ status: 503 });

		const promise = withRetry(fn, {
			attempts: 3,
			baseDelayMs: 10,
			onRetry,
		}).catch(() => undefined);
		await vi.runAllTimersAsync();
		await promise;

		expect(fn).toHaveBeenCalledTimes(3);
		// 3 attempts → 2 inter-attempt waits → 2 onRetry calls.
		expect(onRetry).toHaveBeenCalledTimes(2);
	});

	it("throws when attempts is less than 1", async () => {
		await expect(withRetry(vi.fn(), { attempts: 0 })).rejects.toThrow(
			"attempts must be >= 1",
		);
	});

	it("rejects when the signal aborts while waiting between attempts", async () => {
		// Abort must land after the backoff sleep has started (timer pending) to
		// exercise the in-flight abort listener, not the pre-sleep guard. Real
		// timers + a 1ms abort against a ~50ms sleep makes that ordering reliable.
		vi.useRealTimers();
		pinJitterToMax();
		const controller = new AbortController();
		const fn = vi.fn().mockRejectedValue({ status: 503 });
		const onRetry = vi.fn(() => {
			setTimeout(() => controller.abort(new Error("cancelled")), 1);
		});

		await expect(
			withRetry(fn, { baseDelayMs: 50, signal: controller.signal, onRetry }),
		).rejects.toThrow("cancelled");
		expect(fn).toHaveBeenCalledTimes(1);
	});
});
