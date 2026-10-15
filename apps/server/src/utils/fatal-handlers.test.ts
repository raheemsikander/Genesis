import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockFlushAlerts = vi.fn(async () => {});
const mockLoggerFatal = vi.fn();

vi.mock("./alerting", () => ({
	flushAlerts: () => mockFlushAlerts(),
}));

vi.mock("./logger", () => ({
	logger: { fatal: (...args: unknown[]) => mockLoggerFatal(...args) },
}));

import { installFatalHandlers } from "./fatal-handlers";

let exitSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
	vi.clearAllMocks();
	exitSpy = vi
		.spyOn(process, "exit")
		.mockImplementation(() => undefined as never);
});

afterEach(() => {
	exitSpy.mockRestore();
	for (const listener of process.listeners("unhandledRejection")) {
		process.removeListener("unhandledRejection", listener);
	}
});

describe("installFatalHandlers", () => {
	/**
	 * Rollbar's own listener reports and returns, and its mere presence suppresses
	 * Node's default crash, so without this the process serves on undefined state.
	 */
	it("drains the tracker and exits non-zero on an unhandled rejection", async () => {
		installFatalHandlers();

		process.emit("unhandledRejection", new Error("boom"), Promise.resolve());
		await vi.waitFor(() => expect(exitSpy).toHaveBeenCalledWith(1));

		expect(mockLoggerFatal).toHaveBeenCalled();
		expect(mockFlushAlerts).toHaveBeenCalledTimes(1);
	});

	/**
	 * A `then` here would skip the exit and turn the drain failure into a second
	 * unhandled rejection, re-entering this very handler.
	 */
	it("exits on the first pass even when draining the tracker rejects", async () => {
		mockFlushAlerts.mockRejectedValueOnce(new Error("tracker down"));
		installFatalHandlers();

		process.emit("unhandledRejection", new Error("boom"), Promise.resolve());
		await vi.waitFor(() => expect(exitSpy).toHaveBeenCalledWith(1));

		expect(mockFlushAlerts).toHaveBeenCalledTimes(1);
	});
});
