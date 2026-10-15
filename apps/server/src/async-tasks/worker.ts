import crypto from "node:crypto";
import { Worker } from "bullmq";
import { logger } from "../utils/logger";
import { getWorkerRedis } from "../utils/redis";
import { runWithRequestContext } from "../utils/request-context";
import {
	closeAllQueues,
	DEFAULT_JOB_OPTIONS,
	DEFAULT_WORKER_OPTIONS,
	getQueue,
	getRegisteredJobs,
	QUEUES,
} from "./jobs/index";

const workers: Worker[] = [];

// DLQ queue instance — used by the handler wrapper to enqueue permanently failed jobs
const deadLetterQueue = getQueue(QUEUES.SYSTEM_DEAD_LETTER);

for (const [queueName, definition] of getRegisteredJobs()) {
	const worker = new Worker(
		queueName,
		async (job) => {
			const jobRequestId = job.data?.requestId;

			const requestId = jobRequestId ?? crypto.randomUUID();

			await runWithRequestContext(
				{
					requestId,
					jobId: job.id ?? "unknown",
					queue: queueName,
				},
				async () => {
					try {
						await definition.handler(job);
					} catch (err) {
						// If this was the final attempt, push to dead letter queue before re-throwing.
						// Skip for the DLQ itself to avoid infinite loops.
						const maxAttempts =
							job.opts.attempts ?? DEFAULT_JOB_OPTIONS.attempts ?? 3;
						if (
							queueName !== QUEUES.SYSTEM_DEAD_LETTER &&
							job.attemptsMade >= maxAttempts
						) {
							await deadLetterQueue.add("dead-letter", {
								originalQueue: queueName,
								jobId: job.id,
								payload: job.data,
								error: err instanceof Error ? err.message : String(err),
								failedAt: new Date().toISOString(),
								requestId,
							});
						}
						throw err;
					}
				},
			);
		},
		{
			connection: getWorkerRedis(),
			...DEFAULT_WORKER_OPTIONS,
			...definition.workerOptions,
		},
	);

	worker.on("completed", (job) => {
		logger.info({ queue: queueName, jobId: job.id }, "Job completed");
	});

	worker.on("failed", (job, err) => {
		logger.error({ queue: queueName, jobId: job?.id, err }, "Job failed");
	});

	worker.on("error", (err) => {
		logger.error({ queue: queueName, err }, "Worker error");
	});

	workers.push(worker);
}

// -- Register scheduled jobs --
// upsertJobScheduler is idempotent — safe to call on every startup.
// This ensures schedules are always in sync with code after each deploy.

async function registerSchedulers() {
	for (const [queueName, definition] of getRegisteredJobs()) {
		if (!definition.schedule) continue;

		const queue = getQueue(definition.queue);
		await queue.upsertJobScheduler(
			definition.schedule.schedulerId,
			{ pattern: definition.schedule.pattern },
			{
				name: queueName,
				data: definition.schedule.data,
			},
		);

		logger.info(
			{
				queue: queueName,
				schedulerId: definition.schedule.schedulerId,
				pattern: definition.schedule.pattern,
			},
			"Registered job scheduler",
		);
	}
}

registerSchedulers()
	.then(() => {
		const queueNames = [...getRegisteredJobs().keys()];
		logger.info(
			{ queues: queueNames, count: queueNames.length },
			"Worker started",
		);
	})
	.catch((err) => {
		logger.error({ err }, "Failed to register job schedulers");
		process.exit(1);
	});

// -- Graceful shutdown --

async function shutdown() {
	logger.info("Shutting down workers...");
	await Promise.all(workers.map((w) => w.close()));
	await closeAllQueues();
	logger.info("All workers shut down");
	process.exit(0);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
