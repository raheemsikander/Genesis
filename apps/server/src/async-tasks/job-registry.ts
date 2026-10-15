import type { ScheduleConfig } from "@repo/shared";
import { type Job, type JobsOptions, Queue, type WorkerOptions } from "bullmq";
import { closeRedisConnections, getQueueRedis } from "../utils/redis";

export type {
	DeadLetterPayload,
	SampleBackgroundPayload,
	ScheduleConfig,
} from "@repo/shared";

// -- Queue name constants (single source of truth) --
// Format: <domain>.<action> in lowercase kebab-case (BullMQ reserves ":" internally)

export const QUEUES = {
	SAMPLE_BACKGROUND: "sample.background",
	SAMPLE_SCHEDULED: "sample.scheduled",
	SYSTEM_DEAD_LETTER: "system.dead-letter",
} as const;

export type QueueName = (typeof QUEUES)[keyof typeof QUEUES];

// -- Job definition types --

export interface JobDefinition<T = unknown> {
	queue: QueueName;
	handler: (job: Job<T>) => Promise<void>;
	schedule?: ScheduleConfig;
	workerOptions?: Partial<WorkerOptions>;
}

// -- Default policies --

export const DEFAULT_JOB_OPTIONS: JobsOptions = {
	attempts: 3,
	backoff: {
		type: "exponential",
		delay: 1000, // 1 second base delay, doubles each retry (1s, 2s, 4s)
	},
	removeOnComplete: { age: 86_400 }, // keep completed jobs for 24 hours (in seconds)
	removeOnFail: { age: 604_800 }, // keep failed jobs for 7 days (in seconds)
};

export const DEFAULT_WORKER_OPTIONS: Partial<WorkerOptions> = {
	concurrency: 5, // process up to 5 jobs in parallel per worker
	lockDuration: 30_000, // 30 seconds (in ms) before a job is considered stalled
	metrics: { maxDataPoints: 100 }, // retain last 100 data points for metrics
};

// -- Internal registry --

const jobRegistry = new Map<QueueName, JobDefinition>();
const queueCache = new Map<QueueName, Queue>();

export function registerJob<T>(definition: JobDefinition<T>) {
	if (jobRegistry.has(definition.queue)) {
		throw new Error(`Job already registered for queue: ${definition.queue}`);
	}
	jobRegistry.set(definition.queue, definition as JobDefinition);
}

export function getRegisteredJobs(): ReadonlyMap<QueueName, JobDefinition> {
	return jobRegistry;
}

export function getQueue(name: QueueName): Queue {
	const cached = queueCache.get(name);
	if (cached) return cached;

	const queue = new Queue(name, {
		connection: getQueueRedis(),
		defaultJobOptions: DEFAULT_JOB_OPTIONS,
	});

	queueCache.set(name, queue);
	return queue;
}

export async function closeAllQueues(): Promise<void> {
	await Promise.all([...queueCache.values()].map((q) => q.close()));
	queueCache.clear();
	await closeRedisConnections();
}
