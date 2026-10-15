import IORedis from "ioredis";
import { env } from "./env";
import { logger } from "./logger";

const redisUrl = env.REDIS_URL ?? "redis://localhost:6379";
const baseOptions = { maxRetriesPerRequest: null, lazyConnect: true } as const;

function withLogging(connection: IORedis, label: string) {
	connection.on("connect", () => {
		logger.info(`Redis ${label} connection established`);
	});
	connection.on("error", (err) => {
		logger.error({ err }, `Redis ${label} connection error`);
	});
	return connection;
}

// BullMQ requires separate Redis connections for Queue and Worker instances.
// Connections are created lazily so importing this module doesn't immediately
// open a socket — the API server can import job-registry types without needing Redis.

let _queueRedis: IORedis | null = null;
let _workerRedis: IORedis | null = null;

export function getQueueRedis(): IORedis {
	if (!_queueRedis) {
		_queueRedis = withLogging(new IORedis(redisUrl, baseOptions), "queue");
	}
	return _queueRedis;
}

export function getWorkerRedis(): IORedis {
	if (!_workerRedis) {
		_workerRedis = withLogging(new IORedis(redisUrl, baseOptions), "worker");
	}
	return _workerRedis;
}

export async function closeRedisConnections(): Promise<void> {
	const q = _queueRedis;
	const w = _workerRedis;
	_queueRedis = null;
	_workerRedis = null;
	const closers: Promise<string>[] = [];
	if (q) closers.push(q.quit());
	if (w) closers.push(w.quit());
	await Promise.all(closers);
}
