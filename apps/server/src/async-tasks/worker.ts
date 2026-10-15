import { Worker } from "bullmq";
import { AlertSeverity, flushAlerts, reportAlert } from "../utils/alerting";
import { installFatalHandlers } from "../utils/fatal-handlers";
import { logger } from "../utils/logger";
import { getWorkerRedis } from "../utils/redis";
import { attachWorkerListeners, createJobRunner } from "./job-runner";
import {
	closeAllQueues,
	DEFAULT_WORKER_OPTIONS,
	getQueue,
	getRegisteredJobs,
	QUEUES,
} from "./jobs/index";

installFatalHandlers();

const workers: Worker[] = [];

// DLQ queue instance — used by the handler wrapper to enqueue permanently failed jobs
const deadLetterQueue = getQueue(QUEUES.SYSTEM_DEAD_LETTER);

for (const [queueName, definition] of getRegisteredJobs()) {
	const worker = new Worker(
		queueName,
		createJobRunner({ queueName, definition, deadLetterQueue }),
		{
			connection: getWorkerRedis(),
			...DEFAULT_WORKER_OPTIONS,
			...definition.workerOptions,
		},
	);

	attachWorkerListeners(worker, queueName);
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
	.catch(async (err) => {
		logger.error({ err }, "Failed to register job schedulers");
		reportAlert(err, { severity: AlertSeverity.CRITICAL });
		await flushAlerts();
		process.exit(1);
	});

// -- Graceful shutdown --

async function shutdown() {
	logger.info("Shutting down workers...");
	await Promise.all(workers.map((w) => w.close()));
	await closeAllQueues();
	logger.info("All workers shut down");
	await flushAlerts();
	process.exit(0);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
