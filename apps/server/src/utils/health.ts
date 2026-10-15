import { HeadBucketCommand } from "@aws-sdk/client-s3";
import type { HealthCheckResult, HealthReport } from "@repo/shared";
import { sql } from "drizzle-orm";
import { db } from "../db";
import { getS3Client } from "../storage";
import { env } from "./env";
import { logger } from "./logger";
import { getQueueRedis } from "./redis";

const CHECK_TIMEOUT_MS = 2_000;

// Note: timeout fires the response but the underlying I/O may keep running; acceptable for an infrequently-polled endpoint.
async function withTimeout<T>(
	label: string,
	work: () => Promise<T>,
): Promise<T> {
	let timeoutId: NodeJS.Timeout | undefined;
	const timeout = new Promise<never>((_, reject) => {
		timeoutId = setTimeout(
			() =>
				reject(
					new Error(`${label} check timed out after ${CHECK_TIMEOUT_MS}ms`),
				),
			CHECK_TIMEOUT_MS,
		);
	});
	try {
		return await Promise.race([work(), timeout]);
	} finally {
		if (timeoutId) clearTimeout(timeoutId);
	}
}

async function timed(
	label: string,
	work: () => Promise<unknown>,
): Promise<HealthCheckResult> {
	const startedAt = Date.now();
	try {
		await withTimeout(label, work);
		return { status: "ok", latencyMs: Date.now() - startedAt };
	} catch (err) {
		logger.warn({ err, label }, "health check failed");
		return {
			status: "error",
			error: "check failed",
			latencyMs: Date.now() - startedAt,
		};
	}
}

async function checkDatabase(): Promise<HealthCheckResult> {
	return timed("database", () => db.execute(sql`select 1`));
}

async function checkRedis(): Promise<HealthCheckResult> {
	if (!env.REDIS_URL) {
		return { status: "skipped", reason: "REDIS_URL not set" };
	}
	return timed("redis", () => getQueueRedis().ping());
}

async function checkStorage(): Promise<HealthCheckResult> {
	if (!env.S3_ENDPOINT || !env.S3_ACCESS_KEY_ID || !env.S3_SECRET_ACCESS_KEY) {
		return { status: "skipped", reason: "S3 credentials not set" };
	}
	return timed("storage", () =>
		getS3Client().send(new HeadBucketCommand({ Bucket: env.S3_BUCKET })),
	);
}

export async function checkHealth(): Promise<HealthReport> {
	const [database, redis, storage] = await Promise.all([
		checkDatabase(),
		checkRedis(),
		checkStorage(),
	]);

	const anyFailed = [database, redis, storage].some(
		(c) => c.status === "error",
	);

	return {
		status: anyFailed ? "degraded" : "ok",
		uptimeSeconds: Math.round(process.uptime()),
		checks: { database, redis, storage },
	};
}
