import crypto from "node:crypto";
import type { Job, Queue, Worker } from "bullmq";
import { AlertSeverity, reportAlert } from "../utils/alerting";
import { logger } from "../utils/logger";
import { runWithRequestContext } from "../utils/request-context";
import {
	DEFAULT_JOB_OPTIONS,
	type JobDefinition,
	QUEUES,
	type QueueName,
} from "./job-registry";

const WORKER_ERROR_ALERT_WINDOW_MS = 5 * 60 * 1_000;

export interface JobRunnerArgs {
	queueName: QueueName;
	definition: JobDefinition;
	deadLetterQueue: Pick<Queue, "add">;
}

export function createJobRunner({
	queueName,
	definition,
	deadLetterQueue,
}: JobRunnerArgs): (job: Job) => Promise<void> {
	return async (job) => {
		const requestId =
			(job.data as { requestId?: string } | undefined)?.requestId ??
			crypto.randomUUID();

		await runWithRequestContext(
			{ requestId, jobId: job.id ?? "unknown", queue: queueName },
			async () => {
				try {
					await definition.handler(job);
				} catch (err) {
					const maxAttempts =
						job.opts.attempts ?? DEFAULT_JOB_OPTIONS.attempts ?? 3;
					const isDeadLetterQueue = queueName === QUEUES.SYSTEM_DEAD_LETTER;
					/**
					 * BullMQ increments `attemptsMade` only once the processor has
					 * settled, and stops retrying when `attemptsMade + 1` reaches
					 * `opts.attempts`. Comparing the raw counter would miss the
					 * genuinely final attempt by one and never dead-letter.
					 */
					const attempt = job.attemptsMade + 1;
					const exhaustedRetries = attempt >= maxAttempts;

					// The DLQ is where failures go to be seen, so a failure on it never
					// gets re-enqueued onto itself.
					if (exhaustedRetries && !isDeadLetterQueue) {
						await deadLetter({
							deadLetterQueue,
							queueName,
							job,
							err,
							requestId,
						});
					}

					if (exhaustedRetries) {
						reportAlert(err, {
							severity: AlertSeverity.CRITICAL,
							context: {
								queue: queueName,
								jobId: job.id,
								requestId,
								attempt,
								maxAttempts,
							},
						});
					}

					throw err;
				}
			},
		);
	};
}

export function attachWorkerListeners(
	worker: Pick<Worker, "on">,
	queueName: QueueName,
): void {
	worker.on("completed", (job) => {
		logger.info({ queue: queueName, jobId: job.id }, "Job completed");
	});

	// A retry that later succeeds is not an incident; createJobRunner raises the terminal alert.
	worker.on("failed", (job, err) => {
		logger.error({ queue: queueName, jobId: job?.id, err }, "Job failed");
	});

	/**
	 * Redis reconnect failures arrive on this listener every ~50ms ramping to
	 * every 2s, for as long as the outage lasts. Reporting each one would burn
	 * the tracker's rate limit on a single incident and drop the new items the
	 * outage is actually causing, so one report per window stands in for the
	 * burst. Every error is still logged.
	 */
	let lastReportedAt = Number.NEGATIVE_INFINITY;

	worker.on("error", (err) => {
		logger.error({ queue: queueName, err }, "Worker error");

		const now = Date.now();
		if (now - lastReportedAt < WORKER_ERROR_ALERT_WINDOW_MS) return;
		lastReportedAt = now;

		reportAlert(err, {
			severity: AlertSeverity.ERROR,
			context: { queue: queueName },
		});
	});
}

/** Never let a dead-letter enqueue failure mask the job error that caused it. */
async function deadLetter({
	deadLetterQueue,
	queueName,
	job,
	err,
	requestId,
}: {
	deadLetterQueue: Pick<Queue, "add">;
	queueName: QueueName;
	job: Job;
	err: unknown;
	requestId: string;
}): Promise<void> {
	try {
		await deadLetterQueue.add("dead-letter", {
			originalQueue: queueName,
			jobId: job.id,
			payload: job.data,
			error: err instanceof Error ? err.message : String(err),
			failedAt: new Date().toISOString(),
			requestId,
		});
	} catch (enqueueError) {
		logger.error(
			{ queue: queueName, jobId: job.id, err: enqueueError },
			"Failed to enqueue dead-letter job",
		);
		reportAlert(enqueueError, {
			severity: AlertSeverity.CRITICAL,
			context: { queue: queueName, jobId: job.id, requestId },
		});
	}
}
