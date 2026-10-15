import type { Job, Queue, Worker } from "bullmq";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockReportAlert = vi.fn();
const mockDlqAdd = vi.fn();
const mockLoggerError = vi.fn();
const mockLoggerInfo = vi.fn();

vi.mock("../utils/alerting", () => ({
	AlertSeverity: {
		WARNING: "warning",
		ERROR: "error",
		CRITICAL: "critical",
	},
	reportAlert: (...args: unknown[]) => mockReportAlert(...args),
	flushAlerts: vi.fn(async () => {}),
}));

vi.mock("../utils/logger", () => ({
	logger: {
		error: (...args: unknown[]) => mockLoggerError(...args),
		info: (...args: unknown[]) => mockLoggerInfo(...args),
		warn: vi.fn(),
	},
}));

vi.mock("../utils/request-context", () => ({
	runWithRequestContext: (_ctx: unknown, fn: () => unknown) => fn(),
}));

vi.mock("../utils/redis", () => ({
	getQueueRedis: () => ({}),
	getWorkerRedis: () => ({}),
	closeRedisConnections: async () => {},
}));

import { QUEUES } from "./job-registry";
import { attachWorkerListeners, createJobRunner } from "./job-runner";

const deadLetterQueue = {
	add: (...args: unknown[]) => mockDlqAdd(...args),
} as unknown as Queue;

function makeJob(overrides: Partial<Job> = {}): Job {
	return {
		id: "job-1",
		data: { requestId: "req-1" },
		attemptsMade: 0,
		opts: { attempts: 3 },
		...overrides,
	} as unknown as Job;
}

beforeEach(() => {
	vi.clearAllMocks();
	mockDlqAdd.mockResolvedValue(undefined);
});

describe("createJobRunner", () => {
	it("runs the handler and reports nothing on success", async () => {
		const handler = vi.fn(async () => {});
		const run = createJobRunner({
			queueName: QUEUES.SAMPLE_BACKGROUND,
			definition: { queue: QUEUES.SAMPLE_BACKGROUND, handler },
			deadLetterQueue,
		});

		await run(makeJob());

		expect(handler).toHaveBeenCalledTimes(1);
		expect(mockReportAlert).not.toHaveBeenCalled();
		expect(mockDlqAdd).not.toHaveBeenCalled();
	});

	it("does not alert or dead-letter while retries remain", async () => {
		const run = createJobRunner({
			queueName: QUEUES.SAMPLE_BACKGROUND,
			definition: {
				queue: QUEUES.SAMPLE_BACKGROUND,
				handler: async () => {
					throw new Error("boom");
				},
			},
			deadLetterQueue,
		});

		await expect(run(makeJob({ attemptsMade: 1 }))).rejects.toThrow("boom");
		expect(mockReportAlert).not.toHaveBeenCalled();
		expect(mockDlqAdd).not.toHaveBeenCalled();
	});

	/**
	 * BullMQ increments attemptsMade after the processor settles, so the third
	 * and final run of a 3-attempt job sees attemptsMade === 2. Comparing the
	 * raw counter against maxAttempts silently never dead-letters anything.
	 */
	it("treats the last attempt BullMQ will run as terminal", async () => {
		const run = createJobRunner({
			queueName: QUEUES.SAMPLE_BACKGROUND,
			definition: {
				queue: QUEUES.SAMPLE_BACKGROUND,
				handler: async () => {
					throw new Error("boom");
				},
			},
			deadLetterQueue,
		});

		await expect(
			run(makeJob({ attemptsMade: 2, opts: { attempts: 3 } as Job["opts"] })),
		).rejects.toThrow("boom");

		expect(mockDlqAdd).toHaveBeenCalledTimes(1);
		expect(mockReportAlert).toHaveBeenCalledTimes(1);
		expect(mockReportAlert.mock.calls[0]?.[1]).toMatchObject({
			severity: "critical",
			context: { attempt: 3, maxAttempts: 3 },
		});
	});

	it("dead-letters and alerts critical on the final attempt", async () => {
		const err = new Error("boom");
		const run = createJobRunner({
			queueName: QUEUES.SAMPLE_BACKGROUND,
			definition: {
				queue: QUEUES.SAMPLE_BACKGROUND,
				handler: async () => {
					throw err;
				},
			},
			deadLetterQueue,
		});

		await expect(run(makeJob({ attemptsMade: 3 }))).rejects.toThrow("boom");

		expect(mockDlqAdd).toHaveBeenCalledTimes(1);
		expect(mockReportAlert).toHaveBeenCalledTimes(1);
		expect(mockReportAlert.mock.calls[0]?.[0]).toBe(err);
		expect(mockReportAlert.mock.calls[0]?.[1]).toMatchObject({
			severity: "critical",
			context: {
				queue: QUEUES.SAMPLE_BACKGROUND,
				jobId: "job-1",
				requestId: "req-1",
				attempt: 4,
				maxAttempts: 3,
			},
		});
	});

	it("does not re-enqueue a failing dead-letter job onto itself", async () => {
		const run = createJobRunner({
			queueName: QUEUES.SYSTEM_DEAD_LETTER,
			definition: {
				queue: QUEUES.SYSTEM_DEAD_LETTER,
				handler: async () => {
					throw new Error("boom");
				},
			},
			deadLetterQueue,
		});

		await expect(run(makeJob({ attemptsMade: 2 }))).rejects.toThrow("boom");
		expect(mockDlqAdd).not.toHaveBeenCalled();
		expect(mockReportAlert).toHaveBeenCalledTimes(1);
	});

	it("pages once for a dead-letter job, not once per retry", async () => {
		const run = createJobRunner({
			queueName: QUEUES.SYSTEM_DEAD_LETTER,
			definition: {
				queue: QUEUES.SYSTEM_DEAD_LETTER,
				handler: async () => {
					throw new Error("boom");
				},
			},
			deadLetterQueue,
		});

		await expect(run(makeJob({ attemptsMade: 0 }))).rejects.toThrow("boom");
		await expect(run(makeJob({ attemptsMade: 1 }))).rejects.toThrow("boom");
		expect(mockReportAlert).not.toHaveBeenCalled();

		await expect(run(makeJob({ attemptsMade: 2 }))).rejects.toThrow("boom");
		expect(mockReportAlert).toHaveBeenCalledTimes(1);
	});

	it("rethrows the original error and alerts separately when the dead-letter enqueue fails", async () => {
		mockDlqAdd.mockRejectedValue(new Error("redis down"));
		const run = createJobRunner({
			queueName: QUEUES.SAMPLE_BACKGROUND,
			definition: {
				queue: QUEUES.SAMPLE_BACKGROUND,
				handler: async () => {
					throw new Error("original");
				},
			},
			deadLetterQueue,
		});

		await expect(run(makeJob({ attemptsMade: 3 }))).rejects.toThrow("original");

		const messages = mockReportAlert.mock.calls.map(
			(call) => (call[0] as Error).message,
		);
		expect(messages).toContain("redis down");
		expect(messages).toContain("original");
	});
});

describe("attachWorkerListeners", () => {
	function makeWorker() {
		const handlers = new Map<string, (...args: unknown[]) => void>();
		const worker = {
			on: (event: string, cb: (...args: unknown[]) => void) => {
				handlers.set(event, cb);
				return worker;
			},
		} as unknown as Worker;
		return { worker, handlers };
	}

	it("logs completion without alerting", () => {
		const { worker, handlers } = makeWorker();
		attachWorkerListeners(worker, QUEUES.SAMPLE_BACKGROUND);
		handlers.get("completed")?.({ id: "job-1" });
		expect(mockLoggerInfo).toHaveBeenCalled();
		expect(mockReportAlert).not.toHaveBeenCalled();
	});

	it("logs a job failure without alerting", () => {
		const { worker, handlers } = makeWorker();
		attachWorkerListeners(worker, QUEUES.SAMPLE_BACKGROUND);
		handlers.get("failed")?.({ id: "job-1" }, new Error("boom"));
		expect(mockLoggerError).toHaveBeenCalled();
		expect(mockReportAlert).not.toHaveBeenCalled();
	});

	it("alerts on a worker-level error", () => {
		const { worker, handlers } = makeWorker();
		attachWorkerListeners(worker, QUEUES.SAMPLE_BACKGROUND);
		const err = new Error("connection lost");
		handlers.get("error")?.(err);
		expect(mockReportAlert).toHaveBeenCalledWith(err, {
			severity: "error",
			context: { queue: QUEUES.SAMPLE_BACKGROUND },
		});
	});

	/**
	 * A Redis outage fires this listener every ~50ms for its whole duration, so
	 * reporting each one would spend the tracker's rate limit on one incident.
	 */
	it("reports a repeating worker error once per window, but logs every one", () => {
		vi.useFakeTimers();
		try {
			const { worker, handlers } = makeWorker();
			attachWorkerListeners(worker, QUEUES.SAMPLE_BACKGROUND);

			for (let i = 0; i < 50; i++) {
				handlers.get("error")?.(new Error("connection lost"));
				vi.advanceTimersByTime(2_000);
			}

			expect(mockReportAlert).toHaveBeenCalledTimes(1);
			expect(mockLoggerError).toHaveBeenCalledTimes(50);

			vi.advanceTimersByTime(5 * 60 * 1_000);
			handlers.get("error")?.(new Error("connection lost"));
			expect(mockReportAlert).toHaveBeenCalledTimes(2);
		} finally {
			vi.useRealTimers();
		}
	});

	it("throttles each worker independently", () => {
		const first = makeWorker();
		const second = makeWorker();
		attachWorkerListeners(first.worker, QUEUES.SAMPLE_BACKGROUND);
		attachWorkerListeners(second.worker, QUEUES.SYSTEM_DEAD_LETTER);

		first.handlers.get("error")?.(new Error("boom"));
		second.handlers.get("error")?.(new Error("boom"));

		expect(mockReportAlert).toHaveBeenCalledTimes(2);
	});
});
